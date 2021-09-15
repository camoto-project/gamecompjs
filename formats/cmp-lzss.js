/*
 * LZSS compression algorithm.
 *
 * This algorithm is fully documented on the ModdingWiki:
 *   http://www.shikadi.net/moddingwiki/LZSS_compression
 *
 * A portion of this implementation is based on Andy McFadden's annotated
 * LZSS compressor source, which in turn is based on Haruhiko Okumura's code.
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

const FORMAT_ID = 'cmp-lzss';

import { RecordBuffer, RecordType } from '@camoto/record-io-buffer';
import Debug from '../util/debug.js';
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

export default class Compress_LZSS
{
	static metadata() {
		return {
			id: FORMAT_ID,
			title: 'LZSS compression',
			options: {
				sizeLength: 'Size of the backreference length field, in bits [4]',
				minLen: 'Minimum length of a backreference string, in bytes [3]',
				prefillByte: 'Byte used to prefill the sliding window buffer [0x20]',
				lengthFieldInHighBits: 'Whether the backreference length field is ' +
					'stored in the high-order bits of the second backreference byte. ' +
					'If this is false, then the little-endian interpretation of the ' +
					'backreference byte pair will have the offset field split into ' +
					'two chunks with the length field in the middle [false]',
				windowStartAt0: 'true to start at the beginning of the window, false '
					+ 'to start at the end of the window (false)',
				splitMethod: 'How to split 16-bit code into offset+length: '
					+ '0 = big (AB CD -> ABC+D), '
					+ '1 = little (AB CD -> CDA+B), '
					+ '2 = big-byte (AB CD -> CAB+D), '
					+ '3 = little-byte (AB CD -> ACD+B) [2]',
			},
		};
	}

	static reveal(content, options = {}) {
		const debug = g_debug.extend('reveal');

		options.sizeLength = parseInt(options.sizeLength || 4);
		options.minLen = parseInt(options.minLen || 3);
		if (options.prefillByte !== 0) {
			options.prefillByte = parseInt(options.prefillByte || 0x20);
		}
		options.lengthFieldInHighBits = parseBool(options.lengthFieldInHighBits);
		options.windowStartAt0 = parseBool(options.windowStartAt0);
		if (options.splitMethod !== 0) {
			options.splitMethod = parseInt(options.splitMethod || 2);
		}

		if (options.sizeLength > 8) {
			throw new Error('Backreference length fields longer than 8 bits are not supported.');
		}

		if ((options.splitMethod < 0) || (options.splitMethod > 3)) {
			throw new Error(`Invalid splitMethod ${options.splitMethod}.`);
		}

		const sizeOffset = (16 - options.sizeLength);
		const windowSize = (1 << sizeOffset);
		const maxBackrefSize = (1 << options.sizeLength) + options.minLen - 1;
		const windowStartPos = options.windowStartAt0 ? 0 : windowSize - maxBackrefSize;

		// 2 bytes for each of 8 backrefs, plus flag byte
		const minEncodedBytesPer8Chunks = (8 * 2) + 1;
		const maxDecodedBytesPer8Chunks = (8 * maxBackrefSize);

		const maxTheoreticalCompressionRatio =
			Math.ceil(maxDecodedBytesPer8Chunks / minEncodedBytesPer8Chunks);

		let input = new RecordBuffer(content);
		let output = new RecordBuffer(content.length * maxTheoreticalCompressionRatio);

		let windowPos = windowStartPos;
		let slidingWindow = new Array(windowSize).fill(options.prefillByte);

		while (input.distFromEnd() > 0) {

			let flagBitPos = 0;
			const flagByte = input.read(RecordType.int.u8);

			while (flagBitPos < 8) {

				// if the flag indicates that this chunk is a literal...
				if ((flagByte & (1 << flagBitPos)) != 0) {
					if (input.distFromEnd() <= 0) break;

					const literal = input.read(RecordType.int.u8);
					output.write(RecordType.int.u8, literal);
					slidingWindow[windowPos++] = literal;
					windowPos %= windowSize;

				} else { // otherwise, this chunk is a backreference
					// verify that there are enough bytes left in the input stream to
					// describe the backreference
					if (input.distFromEnd() < 2) break;

					// Use bit 1 in options.splitMethod to control big or little endian.
					let brWord = input.read((options.splitMethod & 1) ? RecordType.int.u16le : RecordType.int.u16be);

					if (options.splitMethod & 2) {
						// Byte endian. (0xCDAB -> 0xACDB)
						// the first (low-order) byte will always contain the low-order
						// bits from the offset into the sliding window
						brWord = ((brWord & 0xFF00) >> 4)
							| ((brWord & 0x00F0) << 8)
							| (brWord & 0x000F);
					}

					// Calculate the shifts and masks needed to extract the length and
					// offset values from the word we just read.
					let sizeShift, offShift;
					if (options.lengthFieldInHighBits) {
						sizeShift = 16 - options.sizeLength;
						offShift = 0;
					} else {
						sizeShift = 0;
						offShift = options.sizeLength;
					}
					const sizeMask = (1 << options.sizeLength) - 1;
					const offMask = (1 << (16 - options.sizeLength)) - 1;

					let backrefOffset = (brWord >> offShift) & offMask;
					let backrefSize = (brWord >> sizeShift) & sizeMask;

					backrefSize += options.minLen;

					// copy the bytes from the sliding window to the output, and also
					// to the end of the sliding window
					for (var brByteIdx = 0; brByteIdx < backrefSize; brByteIdx++) {

						const curByte = slidingWindow[backrefOffset];
						output.write(RecordType.int.u8, curByte);

						slidingWindow[windowPos] = curByte;

						++backrefOffset; backrefOffset %= windowSize;
						++windowPos; windowPos %= windowSize;
					}
				}

				flagBitPos++;
			}
		}

		return output.getU8();
	}

	static obscure(content, options = {}) {

		function findMatch(r_inputPos, buf, bufSize, maxMatchLength) {

			let searchPos = 0;
			let curMatchLen = 0;
			let bestMatchStartPos = 0;
			let bestMatchLen = 0;

			// walk through the sliding window buffer looking for a string match until either:
			// (a) we find the longest possible match, or
			// (b) we search the entire buffer
			while ((searchPos < bufSize) && (bestMatchLen < maxMatchLength)) {

				let searchIsWithinSourceStrA =
					((searchPos >= r_inputPos) && (searchPos < (r_inputPos + maxMatchLength)));

				let searchIsWithinSourceStrB =
					(r_inputPos >= (bufSize - maxMatchLength))
					&& (searchPos <= r_inputPos)
					&& (searchPos < ((r_inputPos + maxMatchLength) % bufSize))
				;

				// ensure that we don't try to start matching within the same string
				if (!searchIsWithinSourceStrA && !searchIsWithinSourceStrB) {

					curMatchLen = 0;

					// match characters (up to the maximum string match length)
					// between the cleartext/readahead section and sliding window history
					while (
						(curMatchLen < maxMatchLength)
						&& (buf[r_inputPos + curMatchLen] == buf[searchPos + curMatchLen])
					) {
						curMatchLen++;
					}

					// if we found a match that is better than the best match so far,
					// save its position and offset
					if (curMatchLen > bestMatchLen) {
						bestMatchLen = curMatchLen;
						bestMatchStartPos = searchPos;
					}
				}
				searchPos++;
			}

			return { bestMatchStartPos, bestMatchLen };
		}

		const debug = g_debug.extend('obscure');

		options.sizeLength = parseInt(options.sizeLength || 4);
		options.minLen = parseInt(options.minLen || 3);
		if (options.prefillByte !== 0) {
			options.prefillByte = parseInt(options.prefillByte || 0x20);
		}
		options.lengthFieldInHighBits = parseBool(options.lengthFieldInHighBits);
		options.windowStartAt0 = parseBool(options.windowStartAt0);
		if (options.splitMethod !== 0) {
			options.splitMethod = parseInt(options.splitMethod || 2);
		}

		const sizeOffset = (16 - options.sizeLength);
		const windowSize = (1 << sizeOffset);
		const maxBackrefSize = (1 << options.sizeLength) + options.minLen - 1;
		const windowStartPos = options.windowStartAt0 ? 0 : windowSize - maxBackrefSize;

		// worst case is an increase in content size by 12.5% (negative compression)
		let output = new RecordBuffer(content.length * 1.13);

		let textBuf = new Uint8Array(windowSize + maxBackrefSize - 1).fill(options.prefillByte);
		let r_windowInputPos = windowStartPos;
		let inputPos = 0;
		let chunkIndex = 0;
		let inputStringLen = 0;
		let i = 0;

		// s starts maxBackrefSize bytes after windowStartPos, wrapping around to
		// the start of the window if needed.
		let s = (windowStartPos + maxBackrefSize + windowSize) % windowSize;

		// we buffer up 8 chunks at a time (a mixture of literals and backreferences)
		// because the flags that indicate the chunk type are packed together into
		// a single prefix byte
		let chunkBuf = new Array();

		// init the flag byte with all the flags clear;
		// we'll OR-in individual flags as literals are added
		chunkBuf.push(0);

		// Fill the read buffer until it is full or the end of the data is reached.
		const lenRead = Math.min(
			maxBackrefSize - inputStringLen,
			content.length - inputPos
		);

		textBuf.set(
			// Copy this input data...
			content.slice(inputStringLen, inputStringLen + lenRead),
			// ...into this offset in textBuf.
			r_windowInputPos + inputStringLen
		);
		inputPos += lenRead;
		inputStringLen += lenRead;

		while (inputStringLen > 0) {

			let { bestMatchStartPos, bestMatchLen } =
				findMatch(r_windowInputPos, textBuf, windowSize, maxBackrefSize);

			if (bestMatchLen > inputStringLen) {
				bestMatchLen = inputStringLen;
			}

			// if a match was found, produce a backreference in the output stream
			if (bestMatchLen >= options.minLen) {

				let sizeShift, offShift;
				if (options.lengthFieldInHighBits) {
					sizeShift = 16 - options.sizeLength;
					offShift = 0;
				} else {
					sizeShift = 0;
					offShift = options.sizeLength;
				}

				let backrefOffset = bestMatchStartPos << offShift;
				let backrefSize = (bestMatchLen - options.minLen) << sizeShift;

				const word = backrefOffset | backrefSize;
				switch (options.splitMethod) {
					case 0: // 0xABCD -> AB CD
						chunkBuf.push(word >> 8);
						chunkBuf.push(word & 0xFF);
						break;
					case 1: // 0xABCD -> CD AB
						chunkBuf.push(word & 0xFF);
						chunkBuf.push(word >> 8);
						break;
					case 2: // 0xABCD -> BC AD
						chunkBuf.push((word >> 4) & 0xFF);
						chunkBuf.push(((word >> 8) & 0xF0) | (word & 0x0F));
						break;
					case 3: // 0xABCD -> AD BC
						chunkBuf.push(((word >> 8) & 0xF0) | (word & 0x0F));
						chunkBuf.push((word >> 4) & 0xFF);
						break;
					default:
						throw new Error('Unsupported splitMethod.');
				}

			} else { // otherwise, produce a literal
				bestMatchLen = 1;
				// set the flag indicating that this chunk is a literal
				chunkBuf[0] |= (1 << chunkIndex);
				chunkBuf.push(textBuf[r_windowInputPos]);
			}

			// once we've finished 8 chunks, write them to the output
			if (++chunkIndex >= 8) {

				const binaryChunkBuf = new Uint8Array(chunkBuf);
				output.put(binaryChunkBuf);

				chunkIndex = 0;
				chunkBuf.length = 0;
				chunkBuf.push(0);
			}

			// replace the matched parts of the string
			i = 0;
			while ((i < bestMatchLen) && (inputPos < content.length)) {

				textBuf[s] = content[inputPos];
				if (s < (maxBackrefSize - 1)) {
					textBuf[s + windowSize] = content[inputPos];
				}

				s = (s + 1) & (windowSize - 1);
				r_windowInputPos = (r_windowInputPos + 1) & (windowSize - 1);

				i++;
				inputPos++;
			}

			const advance = bestMatchLen - i;
			i += advance;
			inputStringLen -= advance;
			s = (s + advance) & (windowSize - 1);
			r_windowInputPos = (r_windowInputPos + advance) & (windowSize - 1);
		}

		// if there's a partial set of eight chunks, write it to the output
		if (chunkIndex > 0) {
			const binaryChunkBuf = new Uint8Array(chunkBuf);
			output.put(binaryChunkBuf);
		}

		return output.getU8();
	}
}
