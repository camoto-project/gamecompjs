const BitStream = require('bit-buffer').BitStream;
const { RecordBuffer, RecordType } = require('@malvineous/record-io-buffer');
const Debug = require('../util/utl-debug.js');
//Debug.mute(false);

const FORMAT_ID = 'cmp-lzw';

function parseBool(s) {
	return s ? ((s.toLowerCase() == 'true') || !!s) : false;
}

// Extract dictionary entry i as an array of bytes
function dictEntry(dict, i) {
	let s = [];
	do {
		s.unshift(dict[i].ch);
		i = dict[i].ptr;
	} while (i !== null);
	return s;
}

module.exports = class Compress_LZW
{
	static metadata() {
		return {
			id: FORMAT_ID,
			title: 'LZW encryption',
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
				resetCodewordLen: 'Return codeword bitlength to initialBits on dictionary reset (true)',
				flushOnReset: 'Skip to next word boundary on dictionary reset (false)',
				finalSize: 'Final data size if known to avoid buffer reallocations (default 0.5 MB)',
			},
		};
	}

	static reveal(content, options = {})
	{
		try {
			const md = this.metadata();
			Debug.push(md.id, 'reveal');

			options.initialBits = parseInt(options.initialBits || 9);
			options.maxBits = parseInt(options.maxBits || 14);
			options.cwFirst = parseInt(options.cwFirst || 256);
			if (options.cwEOF !== undefined) options.cwEOF = parseInt(options.cwEOF);
			if (options.cwDictReset !== undefined) options.cwDictReset = parseInt(options.cwDictReset);
			options.bigEndian = parseBool(options.bigEndian);
			options.resetDictWhenFull = parseBool(options.resetDictWhenFull);
			options.resetCodewordLen = parseBool(options.resetCodewordLen);
			options.flushOnReset = parseBool(options.flushOnReset);
			options.finalSize = parseInt(options.finalSize || 512 * 1024);

			let output = new RecordBuffer(options.finalSize);

			let bs = new BitStream(content); // TODO endian
			if (options.bigEndian) {
				throw new Error('Big endian not implemented in bitstream library yet');
			}

			let dict = [];
			let dictSize; // current dict size
			function resetDict() {
				for (let i = 0; i < 256; i++) {
					dict[i] = {
						ch: i,
						ptr: null,
						//full: [i],
					};
				}
			}
			resetDict();

			let lenCodeword = options.initialBits || 9;
			let lastDictCode = (1 << lenCodeword) - 1;
			let cwPrev = null, chPrev = 0;
			let offCW = 0;
			while (bs.bitsLeft >= lenCodeword) {

				let cw;
				try {
					cw = bs.readBits(lenCodeword, false);
				} catch (e) {
					console.error(e);
					break;
				}
				if (cw === options.cwEOF) {
					Debug.log('Received EOF codeword');
					break;
				}
				if (cw === options.cwDictReset) {
					Debug.log('Received dictionary reset codeword');
					resetDict();
					if (options.flushOnReset) {
						// TODO flush byte
					}
					continue;
				}

				let dictVal;
				if (dict[cw] !== undefined) {
					dictVal = dictEntry(dict, cw);
				} else {
					// Codeword isn't in the dictionary, act as if we got the previous
					// codeword again.
					dictVal = dictEntry(dict, cwPrev);
					// Append the first char onto the end of the dictionary string.  This
					// is what happens when we add it to the dictionary below, so it's
					// like we are writing out the dictionary value for this codeword
					// just before it has made it into the dictionary.
					dictVal.push(dictVal[0]);
				}

				// Write out the value from the dictionary
				output.put(Buffer.from(dictVal));

				// The new dictionary entry is the previous codeword plus the first
				// character we just wrote.
				dict.push({
					ptr: cwPrev,
					ch: dictVal[0],
					//full: [...(dict[cwPrev] && dict[cwPrev].full || []), dictVal[0]],
				});

				if (Debug.enabled) {
					const sdest = dictEntry(dict, dict.length-1);
					const str = Buffer.from(sdest).toString();

					const cwdest = dictEntry(dict, cw);
					const cwstr = Buffer.from(cwdest).toString();

					Debug.log(`@${offCW} CW ${cw} [${cwstr}] => Dict #${dict.length-1} [${str}]`);
					offCW++;
				}
				cwPrev = cw;

				// Do this last so the codeword gets increased before we check how many
				// bits are still left to read.
				if (dict.length > lastDictCode) {
					// Time to extend bitwidth
					Debug.log('Codeword reached maximum width at', lenCodeword, 'bits, now at', dictSize, 'of', lastDictCode);
					lenCodeword++;
					lastDictCode = (1 << lenCodeword) - 1;
				}
			}

			return output.getBuffer();

		} finally {
			Debug.pop();
		}
	}

	static obscure(content, options = {}) {
		try {
			const md = this.metadata();
			Debug.push(md.id, 'obscure');

			options.initialBits = parseInt(options.initialBits || 9);
			options.maxBits = parseInt(options.maxBits || 14);
			options.cwFirst = parseInt(options.cwFirst || 256);
			if (options.cwEOF !== undefined) options.cwEOF = parseInt(options.cwEOF);
			if (options.cwDictReset !== undefined) options.cwDictReset = parseInt(options.cwDictReset);
			options.bigEndian = parseBool(options.bigEndian);
			options.resetDictWhenFull = parseBool(options.resetDictWhenFull);
			options.resetCodewordLen = parseBool(options.resetCodewordLen);
			options.flushOnReset = parseBool(options.flushOnReset);
			options.finalSize = parseInt(options.finalSize || 512 * 1024);

			//let buffer = Buffer.alloc(content.length * 2);
			let buffer = new ArrayBuffer(content.length * 2);
			let bs = new BitStream(buffer); // TODO endian
			if (options.bigEndian) {
				throw new Error('Big endian not implemented in bitstream library yet');
			}

			let dict = [];
			function resetDict() {
				dict = [];
				for (let i = 0; i < 256; i++) {
					dict[i] = {
						ch: i,
						ptr: null,
					};
				}
			}
			resetDict();

			let lenCodeword = options.initialBits || 9;
			let lastDictCode = (1 << lenCodeword) - 1;
			let idxPending = null;
			let cwPrev = null;

			let offCW = 0; // offset of codeword, in number of codewords from start
			for (let t of content) {
				Debug.log(`Next char ${String.fromCharCode(t)}`);

				// Find t in the dictionary
				let inDict = false;
				for (let i = 0; i < dict.length; i++) {
					// Skip over reserved codes, even though they appear to be added to
					// the dictionary normally.
					if (i === options.cwEOF) continue;
					if (i === options.cwDictReset) continue;

					const d = dict[i];

					if ((d.ch === t) && (d.ptr === idxPending)) {
						let pendingStr = '';
						if (idxPending !== null) {
							const ps = dictEntry(dict, idxPending);
							pendingStr = Buffer.from(ps).toString();
						}
						idxPending = i;
						inDict = true;
						Debug.log(`@${offCW} Pending [${pendingStr}] + ${t} `
							+ `[${String.fromCharCode(t)}] in dict as #${idxPending} -> `
							+ `new pending`);
						// 'continue;' here?
						break;
					}
				}
				if (idxPending === null) {
					Debug.log('Unable to find codeword', t, 'in dict', dict);
					break;
				}
				if (!inDict) {
					// This previous codeword (at idxPending) was in the dictionary, but
					// that followed by the current byte is not in the dictionary.  So we
					// will write out the previous codeword and then start again.
					try {
						// But first we check to see whether the letter happens to be the same
						// as the first one in the dictionary entry, because if it is, we can
						// use a trick and write out the codeword for the next dictionary
						// entry before we have created it.

						const dictVal = dictEntry(dict, idxPending);
						if ((idxPending === cwPrev) && (t == dictVal[0])) {
							if (Debug.enabled) {
								let pendingStr = '';
								if (idxPending !== null) {
									const ps = dictEntry(dict, idxPending);
									pendingStr = Buffer.from(ps).toString();
								}

								Debug.log(`@${offCW} Pending [${pendingStr}] + ${t} `
									+ `[${String.fromCharCode(t)}] matches prev code + `
									+ `prevcode[0], using self-referencing codeword `
									+ `#${dict.length}`);
							}
							idxPending = dict.length;
							t = null;
						}
						let newDictEntry = {
							ptr: cwPrev,
							ch: dictVal[0],
						};
						dict.push(newDictEntry);

						bs.writeBits(idxPending, lenCodeword);
						cwPrev = idxPending;

						if (Debug.enabled) {
							const sdest = dictEntry(dict, dict.length-1);
							const str = Buffer.from(sdest).toString();

							let pendingStr = '';
							if (idxPending !== null) {
								const ps = dictEntry(dict, idxPending);
								pendingStr = Buffer.from(ps).toString();
							}

							Debug.log(`@${offCW} Pending [${pendingStr}] + ${t} [${String.fromCharCode(t)}] `
								+ `not in dict, writing pending as codeword ${idxPending} => new `
								+ `dict #${dict.length-1} <- ${idxPending} [${str}]`);
							offCW++;
						}
					} catch (e) {
						Debug.log('Bitstream error, ending early:', e);
						idxPending = null;
						break;
					}

					if (dict.length > lastDictCode) {
						// Time to extend bitwidth
						Debug.log(`@${bs.indexByte}: Codeword reached max val at width=${lenCodeword}, dict now at ${dict.length} of ${lastDictCode}`);
						lenCodeword++;
						lastDictCode = (1 << lenCodeword) - 1;
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
					Debug.log('Bitstream error at EOF, ignoring:', e);
				}
			}
			if (options.cwEOF) {
				try {
					bs.writeBits(options.cwEOF, lenCodeword);
				} catch (e) {
					Debug.log('Bitstream error writing EOF codeword, ignoring:', e);
				}
			}

			// Write zero bits until the next byte boundary.
			const bitsLeft = (8 - (bs.index % 8)) % 8;
			if (bitsLeft) bs.writeBits(0, bitsLeft);

			return Buffer.from(buffer, 0, bs.byteIndex);

		} finally {
			Debug.pop();
		}
	}
};
