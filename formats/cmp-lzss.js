/*
 * LZSS compression algorithm.
 *
 * This algorithm is fully documented on the ModdingWiki:
 *   http://www.shikadi.net/moddingwiki/LZSS_compression
 *
 * A portion of this implementation is based on Andy McFadden's annotated
 * LZSS compressor source, which in turn is based on Haruhiko Okumura's code.
 *
 * Copyright (C) 2021 Colin Bourassa
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

/**
 * Explanation of options:
 *
 * The length/offset code is read as a single 16-bit integer, which is then
 * split into the separate length and offset values.  How this split happens is
 * controlled by multiple options.
 *
 * Assuming the two bytes are AB followed by CD (i.e. a big-endian value 0xABCD)
 * then decoding that into length+offset happens as follows:
 *
 * Split | lengthHigh | bigEndian | offsetRotate
 * ------+------------+-----------+-------------
 * ABC+D | false      | true      | 0
 * A+BCD | true       | true      | 0
 * CDA+B | false      | false     | 0
 * C+DAB | true       | false     | 0
 * BCA+D | false      | true      | 4
 * A+CDB | true       | true      | 4
 * DAC+B | false      | false     | 4
 * C+ABD | true       | false     | 4
 * CAB+D | false      | true      | 8
 * A+DBC | true       | true      | 8
 * ACD+B | false      | false     | 8
 * C+BDA | true       | false     | 8
 *
 * Note that here, the 12-bit value in the "split" column is the LZSS offset,
 * and the 4-bit value is the LZSS length/size.
 */
export default class Compress_LZSS
{
	static metadata() {
		return {
			id: FORMAT_ID,
			title: 'LZSS compression',
			options: {
				sizeLength: 'Size of the backreference length field, in bits [4]',
				minLen: 'Minimum length of a backreference string, in bytes [3]',
				prefillByte: 'Byte used to prefill the sliding window buffer [0x00]',
				windowStartAt0: 'true to start at the beginning of the window, false '
					+ 'to start at the end of the window (false)',
				littleEndian: 'Endian of 16-bit offset+length value: '
					+ 'true = little, false = big [false]',
				lengthHigh: 'Whether the backreference length field is stored in the '
					+ 'upper (most significant) bits of the code (true) or the lower '
					+ 'bits. [false]',
				offsetRotate: 'How many bits to rotate the backreference offset '
					+ 'field [0]',
			},
		};
	}

	static reveal(content, options = {}) {
		const debug = g_debug.extend('reveal');

		options.sizeLength = parseInt(options.sizeLength || 4);
		options.minLen = parseInt(options.minLen || 3);
		options.prefillByte = parseInt(options.prefillByte || 0x00);
		options.windowStartAt0 = parseBool(options.windowStartAt0);
		options.littleEndian = parseBool(options.littleEndian);
		options.lengthHigh = parseBool(options.lengthHigh);
		options.offsetRotate = parseInt(options.offsetRotate || 0);

		if (options.sizeLength > 8) {
			throw new Error('Backreference length fields longer than 8 bits are not supported.');
		}

		const sizeOffset = 16 - options.sizeLength;
		const windowSize = (1 << sizeOffset);
		const maxBackrefSize = (1 << options.sizeLength) + options.minLen - 1;
		const windowStartPos = options.windowStartAt0 ? 0 : windowSize - maxBackrefSize;

		// 2 bytes for each of 8 backrefs, plus flag byte
		const minEncodedBytesPer8Chunks = (8 * 2) + 1;
		const maxDecodedBytesPer8Chunks = (8 * maxBackrefSize);

		const maxTheoreticalCompressionRatio =
			Math.ceil(maxDecodedBytesPer8Chunks / minEncodedBytesPer8Chunks);

		// Calculate the shifts and masks needed to extract the length and
		// offset values from the word we just read.
		let sizeShift, offShift;
		if (options.lengthHigh) {
			sizeShift = sizeOffset;
			offShift = 0;
		} else {
			sizeShift = 0;
			offShift = options.sizeLength;
		}
		const sizeMask = (1 << options.sizeLength) - 1;
		const offMask = (1 << sizeOffset) - 1;

		let input = new RecordBuffer(content);
		let output = new RecordBuffer(content.length * maxTheoreticalCompressionRatio);

		let windowPos = windowStartPos;
		let slidingWindow = new Array(windowSize).fill(options.prefillByte);

		const fnReadWord = input.read.bind(
			input,
			options.littleEndian ? RecordType.int.u16le : RecordType.int.u16be
		);

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

					const brWord = fnReadWord();

					let backrefOffset = (brWord >> offShift) & offMask;
					let backrefSize = (brWord >> sizeShift) & sizeMask;

					backrefSize += options.minLen;

					// Rotate the offset by the given number of bits, e.g. 0xABC rotated
					// by 4 = BCA.
					if (options.offsetRotate) {
						backrefOffset =
							(
								(backrefOffset << options.offsetRotate)
								| (backrefOffset >> (sizeOffset - options.offsetRotate))
							) & offMask
						;
					}

					// copy the bytes from the sliding window to the output, and also
					// to the end of the sliding window
					for (let brByteIdx = 0; brByteIdx < backrefSize; brByteIdx++) {

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
		options.prefillByte = parseInt(options.prefillByte || 0x00);
		options.windowStartAt0 = parseBool(options.windowStartAt0);
		options.littleEndian = parseBool(options.littleEndian);
		options.lengthHigh = parseBool(options.lengthHigh);
		options.offsetRotate = parseInt(options.offsetRotate || 0);

		const sizeOffset = 16 - options.sizeLength;
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

		let sizeShift, offShift;
		if (options.lengthHigh) {
			sizeShift = sizeOffset;
			offShift = 0;
		} else {
			sizeShift = 0;
			offShift = options.sizeLength;
		}

		const offMask = (1 << sizeOffset) - 1;

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

				let backrefOffset = bestMatchStartPos;
				let backrefSize = (bestMatchLen - options.minLen) << sizeShift;

				// Rotate the offset by the given number of bits, e.g. 0xABC rotated
				// by 4 = CAB.  This is the opposite direction to when we read it.
				if (options.offsetRotate) {
					backrefOffset =
						(
							(backrefOffset >> options.offsetRotate)
							| (backrefOffset << (sizeOffset - options.offsetRotate))
						) & offMask
					;
				}

				backrefOffset <<= offShift;

				const word = backrefOffset | backrefSize;
				if (options.littleEndian) {
					chunkBuf.push(word & 0xFF);
					chunkBuf.push(word >> 8);
				} else {
					chunkBuf.push(word >> 8);
					chunkBuf.push(word & 0xFF);
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
