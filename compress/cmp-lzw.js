/*
 * LZW compression algorithm.
 *
 * This algorithm is fully documented on the ModdingWiki:
 *   http://www.shikadi.net/moddingwiki/LZW_Compression
 *
 * Copyright (C) 2010-2021 Adam Nielsen <malvineous@shikadi.net>
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

const FORMAT_ID = 'cmp-lzw';

import { BitStream, BitView } from 'bit-buffer';
import { RecordBuffer, RecordType } from '@camoto/record-io-buffer';
import Debug from '../util/utl-debug.js';
const g_debug = Debug.extend(FORMAT_ID);

function parseBool(s) {
	if (s === undefined) {
		return false;
	} else if (s === true || s === false) {
		return s;
	} else if (s.toLowerCase) {
		return s.toLowerCase() === 'true';
	}
	return !!s;
}

// Extract dictionary entry i as an array of bytes
function dictEntry(dict, i) {
	const debug = g_debug.extend('dictEntry');
	let s = [];
	do {
		if (!dict[i]) {
			debug(`Tried to retrieve undefined dict[${i}]`);
			break;
		}
		s.unshift(dict[i].ch);
		i = dict[i].ptr;
	} while (i !== null);
	return s;
}

export default class Compress_LZW
{
	static metadata() {
		return {
			id: FORMAT_ID,
			title: 'LZW compression',
			options: {
				initialBits: 'Length of the initial codeword, in bits (9)',
				maxBits: 'Maximum length of codeword, in bits (14)',
				cwFirst: 'The first valid codeword.  Will be 256 for 9-bit '
					+ 'codewords with no reserved values, or e.g. 258 for 9-bit '
					+ 'codewords with two reserved values (1 << (initialBits-1))',
				cwEOF: 'Codeword for end of data (undefined)',
				cwDictReset: 'Codeword for dictionary reset (undefined)',
				bigEndian: 'Read bytes in big endian order (false)',
				resetDictWhenFull: 'Wipe dictionary when full (false)',
				resetCodewordLen: 'Return codeword bitlength to initialBits on '
					+ 'dictionary reset (true)',
				flushOnReset: 'Skip to next word boundary on dictionary reset (false)',
				finalSize: 'Final data size if known to avoid buffer reallocations '
					+ '(default 0.5 MB)',
			},
		};
	}

	static reveal(content, options = {})
	{
		const debug = g_debug.extend('reveal');

		options.initialBits = parseInt(options.initialBits || 9);
		options.maxBits = parseInt(options.maxBits || 14);
		options.cwFirst = parseInt(options.cwFirst || 256);
		if (options.cwEOF !== undefined) {
			options.cwEOF = parseInt(options.cwEOF);
		}
		if (options.cwDictReset !== undefined) {
			options.cwDictReset = parseInt(options.cwDictReset);
		}
		options.bigEndian = parseBool(options.bigEndian);
		options.resetDictWhenFull = parseBool(options.resetDictWhenFull);
		options.resetCodewordLen = parseBool(options.resetCodewordLen);
		options.flushOnReset = parseBool(options.flushOnReset);
		options.finalSize = parseInt(options.finalSize || 512 * 1024);

		let output = new RecordBuffer(options.finalSize);

		let bs = new BitStream(
			new BitView(content.buffer, content.byteOffset, content.byteLength)
		);
		bs.bigEndian = options.bigEndian;

		let dict, dictIsClean;
		function resetDict() {
			dict = [];
			for (let i = 0; i < options.cwFirst; i++) {
				dict[i] = {
					ch: i < 256 ? i : 0,
					ptr: null,
					//full: [i],
				};
			}
			dictIsClean = true;
		}
		resetDict();

		let lenCodeword = options.initialBits;
		let cwPrev = null;
		let offCW = 0;

		let nextDictCode, lastDictCode, cwEOF, cwDictReset;
		function recalcCodewords() {
			nextDictCode = 1 << lenCodeword;
			lastDictCode = nextDictCode - 1;

			cwEOF = options.cwEOF;
			if (cwEOF < 0) {
				// The code option is negative, with -1 being the last valid code.
				// This means we have one less code to work with, so the codeword
				// length will increase one dictionary entry sooner.
				cwEOF += nextDictCode;
				lastDictCode = Math.min(cwEOF - 1, lastDictCode);
			}

			cwDictReset = options.cwDictReset;
			if (cwDictReset <= 0) {
				// The code option is negative, with -1 being the last valid code.
				// This means we have one less code to work with, so the codeword
				// length will increase one dictionary entry sooner.
				cwDictReset += nextDictCode;
				lastDictCode = Math.min(cwDictReset - 1, lastDictCode);
			}

			debug(`lenCodeword=${lenCodeword}, cwEOF=${cwEOF}, `
				+ `cwDictReset=${cwDictReset}, lastDictCode=${lastDictCode}`);
		}
		recalcCodewords();

		while (bs.bitsLeft >= lenCodeword) {

			let cw;
			try {
				cw = bs.readBits(lenCodeword, false);
				debug(`@0x${bs.byteIndex.toString(16)} -> CW#${offCW}: end of `
					+ `next codeword ${cw}`);
			} catch (e) {
				console.error(e);
				break;
			}
			if (cw === cwEOF) {
				debug('Received EOF codeword');
				break;
			}
			if (cw === cwDictReset) {
				debug('Received dictionary reset codeword');
				resetDict();
				if (options.flushOnReset) {
					// TODO flush byte
				}
				if (options.resetCodewordLen) {
					lenCodeword = options.initialBits;
					recalcCodewords();
				}
				continue;
			}

			let dictVal;
			if (dict[cw] !== undefined) {
				dictVal = dictEntry(dict, cw);
			} else {
				// Codeword isn't in the dictionary, act as if we got the previous
				// codeword again.
				debug(`CW ${cw} isn't in dict, using prev CW ${cwPrev}`);
				if (dict[cwPrev] !== undefined) {
					dictVal = dictEntry(dict, cwPrev);
					// Append the first char onto the end of the dictionary string.  This
					// is what happens when we add it to the dictionary below, so it's
					// like we are writing out the dictionary value for this codeword
					// just before it has made it into the dictionary.
					if (dict.length <= lastDictCode) { // unless the dict is full
						dictVal.push(dictVal[0]);
					}
				} else {
					console.error(`Previous codeword ${cwPrev} isn't in the dictionary!  Aborting.`);
					break;
				}
			}

			// Write out the value from the dictionary
			output.put(dictVal);

			if (dictIsClean) {
				// The first codeword after a dictionary reset is used for the next
				// dictionary entry, but not added to the dictionary on its own.  It
				// is, however, output as-is.
				dictIsClean = false;
			} else {
				// The new dictionary entry is the previous codeword plus the first
				// character we just wrote.
				if (dict.length <= lastDictCode) { // unless the dict is full
					dict.push({
						ptr: cwPrev,
						ch: dictVal[0],
						//full: [...(dict[cwPrev] && dict[cwPrev].full || []), dictVal[0]],
					});
				}
			}

			if (debug.enabled) {
				const sdest = dictEntry(dict, dict.length-1);
				const str = RecordType.string.fromArray(sdest)
					// eslint-disable-next-line no-control-regex
					.replace(/\u0000/g, '\u2400'); // make nulls visible

				const cwdest = dictVal;
				const cwstr = RecordType.string.fromArray(cwdest)
					// eslint-disable-next-line no-control-regex
					.replace(/\u0000/g, '\u2400'); // make nulls visible

				debug(`CW#${offCW} -> @0x${output.getPos().toString(16)} `
					+ `CW ${cw} [${cwstr}] => Dict #${dict.length-1} [${str}]`);
				offCW++;
			}

			// This may put an invalid codeword into the dictionary, perhaps we
			// should skip this step if 'cw' is invalid?
			cwPrev = cw;

			// Do this last so the codeword gets increased before we check how many
			// bits are still left to read.
			if (dict.length > lastDictCode) {
				// Time to extend bitwidth
				debug('Codeword reached maximum width at', lenCodeword,
					'bits, now at', dict.length, 'of', lastDictCode);
				if (lenCodeword < options.maxBits) {
					lenCodeword++;
				} else {
					// Reached maximum codeword length
					if (options.resetDictWhenFull) {
						debug('Emptying dictionary');
						resetDict();
						if (options.resetCodewordLen) {
							lenCodeword = options.initialBits;
						}
					}
				}
				recalcCodewords();
			}
		}

		return output.getU8();
	}

	static obscure(content, options = {}) {
		const debug = g_debug.extend('obscure');

		options.initialBits = parseInt(options.initialBits || 9);
		options.maxBits = parseInt(options.maxBits || 14);
		options.cwFirst = parseInt(options.cwFirst || 256);
		if (options.cwEOF !== undefined) {
			options.cwEOF = parseInt(options.cwEOF);
		}
		if (options.cwDictReset !== undefined) {
			options.cwDictReset = parseInt(options.cwDictReset);
		}
		options.bigEndian = parseBool(options.bigEndian);
		options.resetDictWhenFull = parseBool(options.resetDictWhenFull);
		options.resetCodewordLen = parseBool(options.resetCodewordLen);
		options.flushOnReset = parseBool(options.flushOnReset);
		options.finalSize = parseInt(options.finalSize || 512 * 1024);

		let buffer = new ArrayBuffer(content.length * 2);
		let bs = new BitStream(buffer);
		bs.bigEndian = options.bigEndian;

		let dict, dictIsClean;
		function resetDict() {
			dict = [];
			for (let i = 0; i < options.cwFirst; i++) {
				dict[i] = {
					ch: i < 256 ? i : 0,
					ptr: null,
					//full: [i],
				};
			}
			dictIsClean = true;
		}
		resetDict();

		let idxPending = null;
		let lenCodeword = options.initialBits;
		let cwPrev = null;

		let nextDictCode, lastDictCode, cwEOF, cwDictReset;
		function recalcCodewords() {
			nextDictCode = 1 << lenCodeword;
			lastDictCode = nextDictCode - 1;
			cwEOF = options.cwEOF;
			if (cwEOF < 0) {
				cwEOF += nextDictCode;
				lastDictCode = Math.min(cwEOF - 1, lastDictCode);
			}

			cwDictReset = options.cwDictReset;
			if (cwDictReset <= 0) {
				cwDictReset += nextDictCode;
				lastDictCode = Math.min(cwDictReset - 1, lastDictCode);
			}
			debug(`lenCodeword=${lenCodeword}, cwEOF=${cwEOF}, `
				+ `cwDictReset=${cwDictReset}, lastDictCode=${lastDictCode}`);
		}
		recalcCodewords();

		let offCW = -1; // offset of codeword, in number of codewords from start
		for (let t of content) {
			offCW++;
			debug(`@${offCW}->0x${bs.byteIndex.toString(16)} Next char `
				+ `${String.fromCharCode(t)}`);

			// Find t in the dictionary
			let inDict = false;
			for (let i = 0; i < dict.length; i++) {
				// Skip over reserved codes, even though they appear to be added to
				// the dictionary normally.
				if (i === options.cwEOF) continue;
				if (i === options.cwDictReset) continue;

				const d = dict[i];

				if ((d.ch === t) && (d.ptr === idxPending)) {
					idxPending = i;
					inDict = true;

					if (debug.enabled) {
						let pendingStr = '';
						if (idxPending !== null) {
							const ps = dictEntry(dict, idxPending);
							pendingStr = RecordType.string.fromArray(ps);
						}
						debug(`@${offCW}->0x${bs.byteIndex.toString(16)} Pending `
							+ `[${pendingStr}] + ${t} [${String.fromCharCode(t)}] in dict `
							+ `as #${idxPending} -> new pending`);
					}
					// 'continue;' here?
					break;
				}
			}
			if (idxPending === null) {
				debug('Unable to find codeword', t, 'in dict', dict);
				break;
			}
			if (!inDict) {
				// This previous codeword (at idxPending) was in the dictionary, but
				// that followed by the current byte is not in the dictionary.  So we
				// will write out the previous codeword and then start again.
				try {
					// But first we check to see whether the letter happens to be the
					// same as the first one in the dictionary entry, because if it is,
					// we can use a trick and write out the codeword for the next
					// dictionary entry before we have created it.

					const dictVal = dictEntry(dict, idxPending);
					if ((idxPending === cwPrev) && (t == dictVal[0])) {
						if (debug.enabled) {
							let pendingStr = '';
							if (idxPending !== null) {
								const ps = dictEntry(dict, idxPending);
								pendingStr = RecordType.string.fromArray(ps);
							}

							debug(`@${offCW}->0x${bs.byteIndex.toString(16)} Pending `
								+ `[${pendingStr}] + ${t} [${String.fromCharCode(t)}] matches `
								+ `prev code + prevcode[0], using self-referencing codeword `
								+ `#${dict.length}`);
						}
						idxPending = dict.length;
						t = null;
					}

					if (dictIsClean) {
						// The first codeword after a dictionary reset is used for the
						// next dictionary entry, but not added to the dictionary on its
						// own.  It is, however, output as-is.
						dictIsClean = false;
					} else {
						// The new dictionary entry is the previous codeword plus the
						// first character we just wrote.
						if (dict.length <= lastDictCode) { // unless the dict is full
							dict.push({
								ptr: cwPrev,
								ch: dictVal[0],
							});
						}
					}

					bs.writeBits(idxPending, lenCodeword);
					cwPrev = idxPending;

					if (debug.enabled) {
						const sdest = dictEntry(dict, dict.length-1);
						const str = RecordType.string.fromArray(sdest);

						let pendingStr = '';
						if (idxPending !== null) {
							const ps = dictEntry(dict, idxPending);
							pendingStr = RecordType.string.fromArray(ps);
						}

						debug(`@${offCW}->0x${bs.byteIndex.toString(16)} Pending `
							+ `[${pendingStr}] + ${t} [${String.fromCharCode(t)}] not in `
							+ `dict, writing pending as codeword ${idxPending} => new dict `
							+ `#${dict.length-1} <- ${idxPending} [${str}]`);
					}
				} catch (e) {
					debug('Bitstream error, ending early:', e);
					idxPending = null;
					break;
				}

				if (dict.length > lastDictCode) {
					// Time to extend bitwidth
					debug(`Codeword reached max val at width=${lenCodeword}, dict `
						+ `now at ${dict.length} of ${lastDictCode}`);
					if (lenCodeword < options.maxBits) {
						lenCodeword++;
						lastDictCode = (1 << lenCodeword) - 1;
					} else {
						// Reached maximum codeword length
						if (options.resetDictWhenFull) {
							debug('Emptying dictionary');
							resetDict();
							if (options.resetCodewordLen) {
								lenCodeword = options.initialBits;
							}
						}
					}
					recalcCodewords();
				}

				// We can cheat here because we know the first 256 dictionary entries
				// are going to match the same character codes, so we can just use the
				// value as-is without searching the dictionary again.
				idxPending = t;
			}
		}
		if (idxPending) {
			try {
				bs.writeBits(idxPending, lenCodeword);
			} catch (e) {
				debug('Bitstream error at EOF, ignoring:', e);
			}
		}
		if (options.cwEOF) {
			try {
				bs.writeBits(options.cwEOF, lenCodeword);
			} catch (e) {
				debug('Bitstream error writing EOF codeword, ignoring:', e);
			}
		}

		// Write zero bits until the next byte boundary.
		const bitsLeft = (8 - (bs.index % 8)) % 8;
		if (bitsLeft) bs.writeBits(0, bitsLeft);

		return new Uint8Array(buffer, 0, bs.byteIndex);
	}
}
