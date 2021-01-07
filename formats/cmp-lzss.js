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
				sizeLength: 'Size of the backreference length field, in bits (4)',
				minLen: 'Minimum length of a backreference string, in bytes (3)',
				prefillByte: 'Byte used to prefill the sliding window buffer (0x20)',
				lengthFieldInHighBits: 'Whether the backreference length field is ' +
					'stored in the high-order bits of the second backreference byte. ' +
					'If this is false, then the little-endian interpretation of the ' +
					'backreference byte pair will have the offset field split into ' +
					'two chunks within the length field in the middle.',
			},
		};
	}

	static reveal(content, options = {}) {
		const debug = g_debug.extend('reveal');

		options.sizeLength = parseInt(options.sizeLength || 4);
		options.minLen = parseInt(options.minLen || 3);
		options.prefillByte = parseInt(options.prefillByte || 0x20);
		options.lengthFieldInHighBits = parseBool(options.lengthFieldInHighBits || true);

		if (options.sizeLength > 8) {
			throw ('Error: backreference length fields longer than 8 bits are not supported.');
		}

		const sizeOffset = (16 - options.sizeLength);
		const windowSize = (1 << sizeOffset);
		const maxBackrefSize = (1 << options.sizeLength) + options.minLen - 1;
		const windowStartPos = windowSize - maxBackrefSize;

		// 2 bytes for each of 8 backrefs, plus flag byte
		const minEncodedBytesPer8Chunks = (8 * 2) + 1;
		const maxDecodedBytesPer8Chunks = (8 * maxBackrefSize);

		const maxTheoreticalCompressionRatio =
			Math.ceil(maxDecodedBytesPer8Chunks / minEncodedBytesPer8Chunks);

		let input = new RecordBuffer(content);
		let output = new RecordBuffer(content.length * maxTheoreticalCompressionRatio);

		let windowPos = windowStartPos;
		let slidingWindow = new Array(windowSize).fill(options.prefillByte);

		const getByte = input.read.bind(input, RecordType.int.u8);
		const putByte = output.write.bind(output, RecordType.int.u8);

		let result = true;

		while (result && (input.distFromEnd() > 0)) {

			let flagBitPos = 0;
			const flagByte = getByte();

			while (result && (flagBitPos < 8)) {

				// if the flag indicates that this chunk is a literal...
				if ((flagByte & (1 << flagBitPos)) != 0) {
					if (input.distFromEnd() > 0) {

						const literal = getByte();
						putByte(literal);
						slidingWindow[windowPos++] = literal;
						if (windowPos >= windowSize) {
							windowPos = 0;
						}
					} else {
						result = false;
					}
				} else { // otherwise, this chunk is a backreference
					// verify that there are enough bytes left in the input stream to
					// describe the backreference
					if (input.distFromEnd() >= 2) {
						let brByte0 = getByte();
						let brByte1 = getByte();

						// the first (low-order) byte will always contain the low-order
						// bits from the offset into the sliding window
						var backrefOffset = brByte0;
						var backrefSize;

						if (options.lengthFieldInHighBits) {

							backrefSize = brByte1 >> (8 - options.sizeLength);

							// the high-order bits of the offset are in the lower portion of
							// this byte, so mask off the other bits and shift them up by a
							// full byte before ORing them in
							var backrefOffsetHighMask = (1 << (8 - options.sizeLength)) - 1;
							var backrefOffsetHigh = (brByte1 & backrefOffsetHighMask) << 8;
							backrefOffset |= backrefOffsetHigh;

						} else {

							backrefSize = brByte1 & ((1 << options.sizeLength) - 1);

							// the high-order bits of the offset are in the higher portion of
							// this byte
							backrefOffset |= ((brByte1 << (8 - options.sizeLength)) & 0xFF00);
						}

						backrefSize += options.minLen;

						// copy the bytes from the sliding window to the output, and also
						// to the end of the sliding window
						for (var brByteIdx = 0; brByteIdx < backrefSize; brByteIdx++) {

							const curByte = slidingWindow[backrefOffset];
							putByte(curByte);

							if (++backrefOffset >= windowSize) {
								backrefOffset = 0;
							}

							slidingWindow[windowPos] = curByte;
							if (++windowPos >= windowSize) {
								windowPos = 0;
							}
						}
					} // end check for sufficient data to cover backref
					else {
						result = false;
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

				let searchIsWithinSourceStrB = (r_inputPos >= (bufSize - maxMatchLength));
				searchIsWithinSourceStrB = searchIsWithinSourceStrB && (searchPos <= r_inputPos);
				searchIsWithinSourceStrB = searchIsWithinSourceStrB &&
					(searchPos < ((r_inputPos + maxMatchLength) & (bufSize - 1)));

				// ensure that we don't try to start matching within the same string
				if (!searchIsWithinSourceStrA && !searchIsWithinSourceStrB) {

					curMatchLen = 0;

					// match characters (up to the maximum string match length)
					// between the cleartext/readahead section and sliding window history
					while ((curMatchLen < maxMatchLength) &&
						(buf[r_inputPos + curMatchLen] == buf[searchPos + curMatchLen])) {
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

			return [bestMatchStartPos, bestMatchLen];
		}

		const debug = g_debug.extend('obscure');

		options.sizeLength = parseInt(options.sizeLength || 4);
		options.minLen = parseInt(options.minLen || 3);
		options.prefillByte = parseInt(options.prefillByte || 0x20);
		options.lengthFieldInHighBits = parseBool(options.lengthFieldInHighBits || true);

		const sizeOffset = (16 - options.sizeLength);
		const windowSize = (1 << sizeOffset);
		const maxBackrefSize = (1 << options.sizeLength) + options.minLen - 1;
		const windowStartPos = windowSize - maxBackrefSize;
		// LSB-aligned mask for the width of the size field
		const sizeFieldMask = ((1 << options.sizeLength) - 1);
		// and a mask for the hi-order bits of the offset field
		const offsetFieldHiBitsMask = ((1 << (8 - options.sizeLength)) - 1) << 8;

		// worst case is an increase in content size by 12.5% (negative compression)
		let output = new RecordBuffer(content.length * 1.13);
		const putByte = output.write.bind(output, RecordType.int.u8);

		let textBuf = new Array(windowSize + maxBackrefSize - 1).fill(options.prefillByte);
		let r_windowInputPos = windowStartPos;
		let inputPos = 0;
		let chunkIndex = 0;
		let inputStringLen = 0;
		let s = 0;
		let i = 0;

		// we buffer up 8 chunks at a time (a mixture of literals and backreferences)
		// because the flags that indicate the chunk type are packed together into
		// a single prefix byte
		let chunkBuf = new Array();

		// init the flag byte with all the flags clear;
		// we'll OR-in individual flags as literals are added
		chunkBuf.push(0);

		// fill the read-ahead section
		while ((inputStringLen < maxBackrefSize) &&
			(inputPos < content.length)) {
			textBuf[r_windowInputPos + inputStringLen] = content[inputStringLen++];
			inputPos++;
		}

		while (inputStringLen > 0) {

			let match = findMatch(r_windowInputPos, textBuf, windowSize, maxBackrefSize);
			if (match[1] > inputStringLen) {
				match[1] = inputStringLen;
			}

			// if a match was found, produce a backreference in the output stream
			if (match[1] >= options.minLen) {

				// the first byte is always the low 8 bits of the offset
				const byte0 = match[0] & 0xFF;
				// also capture the high bits of the offset, shifted down to be aligned to bit 0
				const offsetFieldHiBits = ((match[0] & offsetFieldHiBitsMask) >> 8);

				// the second byte contains the size field; we'll place it
				// in the low-order bits for now, and shift it up during the
				// next step (if necessary)
				let byte1 = ((match[1] - options.minLen) & sizeFieldMask);

				if (options.lengthFieldInHighBits) {
					// the 'length' field is in the high bits of the second byte,
					// so shift it up and OR in the rest of the offset below
					byte1 <<= (8 - options.sizeLength);
					byte1 |= offsetFieldHiBits;
				} else {
					// the 'length' field is in the low bits of the second byte,
					// so leave that field as-is and OR in the rest of the offset above
					byte1 |= (offsetFieldHiBits << options.sizeLength);
				}

				chunkBuf.push(byte0);
				chunkBuf.push(byte1);

			} else { // otherwise, produce a literal

				match[1] = 1;
				// set the flag indicating that this chunk is a literal
				chunkBuf[0] |= (1 << chunkIndex);
				chunkBuf.push(textBuf[r_windowInputPos]);
			}

			// once we've finished 8 chunks, write them to the output
			if (++chunkIndex >= 8) {

				for (let i = 0; i < chunkBuf.length; i++) {
					putByte(chunkBuf[i]);
				}

				chunkIndex = 0;
				chunkBuf.length = 0;
				chunkBuf.push(0);
			}

			// replace the matched parts of the string
			i = 0;
			while ((i < match[1]) && (inputPos < content.length)) {

				textBuf[s] = content[inputPos];
				if (s < (maxBackrefSize - 1)) {
					textBuf[s + windowSize] = content[inputPos];
				}

				s = (s + 1) & (windowSize - 1);
				r_windowInputPos = (r_windowInputPos + 1) & (windowSize - 1);

				i++;
				inputPos++;
			}

			while (i++ < match[1]) {
				s = (s + 1) & (windowSize - 1);
				r_windowInputPos = (r_windowInputPos + 1) & (windowSize - 1);
				inputStringLen--;
			}
		}

		// if there's a partial set of eight chunks, write it to the output
		if (chunkIndex > 0) {
			for (let i = 0; i < chunkBuf.length; i++) {
				putByte(chunkBuf[i]);
			}
		}

		return output.getU8();
	}
}
