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
import { BitStream, BitView } from 'bit-buffer';
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
 * In byte mode (bitstream = false), the length/offset code is read as a single
 * 16-bit integer, which is then split into the separate length and offset
 * values.  How this split happens is controlled by multiple options.
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
	static metadata()
	{
		return {
			id: FORMAT_ID,
			title: 'LZSS compression',
			options: {
				bitstream: 'Embed flag bits in the stream (true) or group them into '
					+ 'an initial byte. [false]',
				invertFlag: 'If true, flag=0 is codeword, if false flag=1 is codeword '
					+ '[false]',
				lengthHigh: 'Whether the backreference length field is stored in the '
					+ 'upper (most significant) bits of the code (true) or the lower '
					+ 'bits. [false]',
				littleEndian: 'Endian of 16-bit offset+length value: '
					+ 'true = little, false = big [false]',
				minDistance: 'Minimum distance of a backreference string (when '
					+ 'distance value is 0), in bytes [0]',
				minLen: 'Minimum length of a backreference string (when length value '
					+ 'is 0), in bytes [3]',
				offsetRotate: 'How many bits to rotate the backreference offset '
					+ 'field [0]',
				prefillByte: 'Byte used to prefill the sliding window buffer [0x00]',
				relativeDistance: 'Backreference distance is relative to current '
					+ 'window position (true) or to the start of the sliding window '
					+ '[false]',
				sizeDistance: 'Size of the backreference distance field, in bits [12]',
				sizeLength: 'Size of the backreference length field, in bits [4]',
				windowStartAt0: 'true to start at the beginning of the window, false '
					+ 'to start at the end of the window (false)',
			},
		};
	}

	static reveal(content, options = {})
	{
		const debug = g_debug.extend('reveal');

		options.bitstream = parseBool(options.bitstream);
		options.invertFlag = parseBool(options.invertFlag);
		options.lengthHigh = parseBool(options.lengthHigh);
		options.littleEndian = parseBool(options.littleEndian);
		options.minDistance = parseInt(options.minDistance || 0);
		// minLen can't be 0.
		options.minLen = parseInt(options.minLen || 3);
		options.offsetRotate = parseInt(options.offsetRotate || 0);
		options.prefillByte = parseInt(options.prefillByte || 0x00);
		options.relativeDistance = parseBool(options.relativeDistance);
		// sizeDistance can't be 0.
		options.sizeDistance = parseInt(options.sizeDistance || 12);
		// sizeLength can't be 0.
		options.sizeLength = parseInt(options.sizeLength || 4);
		options.windowStartAt0 = parseBool(options.windowStartAt0);

		if (!options.bitstream) { // byte mode
			if (options.sizeLength > 8) {
				throw new Error('Backreference length fields longer than 8 bits are '
					+ 'not supported in byte mode.');
			}
			if (options.sizeLength + options.sizeDistance != 16) {
				throw new Error('Backreference length + distance fields must total '
					+ '16 bits in byte mode.');
			}
		}

		const windowSize = (1 << options.sizeDistance);
		const maxBackrefSize = (1 << options.sizeLength) + options.minLen - 1;
		const windowStartPos = options.windowStartAt0 ? 0 : windowSize - maxBackrefSize;

		// 2 bytes for each of 8 backrefs, plus flag byte
		const minEncodedBytesPer8Chunks = (8 * 2) + 1;
		const maxDecodedBytesPer8Chunks = (8 * maxBackrefSize);

		const maxTheoreticalCompressionRatio =
			Math.ceil(maxDecodedBytesPer8Chunks / minEncodedBytesPer8Chunks);

		let output = new RecordBuffer(content.length * maxTheoreticalCompressionRatio);

		// Calculate the shifts and masks needed to extract the length and
		// offset values from the word we just read.
		let sizeShift, offShift;
		if (options.lengthHigh) {
			sizeShift = options.sizeDistance;
			offShift = 0;
		} else {
			sizeShift = 0;
			offShift = options.sizeLength;
		}
		const sizeMask = (1 << options.sizeLength) - 1;
		const offMask = (1 << options.sizeDistance) - 1;

		let windowPos = windowStartPos;
		let slidingWindow = new Array(windowSize).fill(options.prefillByte);

		const invert = options.invertFlag ? 1 : 0;

		let fnNextFlag, fnReadByte, fnReadLengthDistance, fnBitsRemaining;
		if (options.bitstream) {
			// Support functions for bit-level LZSS.
			let bs = new BitStream(
				new BitView(content.buffer, content.byteOffset, content.byteLength)
			);
			bs.bigEndian = !options.littleEndian;

			fnNextFlag = () => bs.readBits(1, false) ^ invert;

			fnReadByte = () => bs.readBits(8, false);

			fnReadLengthDistance = () => {
				let sizeA, sizeB;
				if (options.lengthHigh) {
					sizeA = options.sizeLength;
					sizeB = options.sizeDistance;
				} else {
					sizeA = options.sizeDistance;
					sizeB = options.sizeLength;
				}
				return [
					bs.readBits(sizeA, false),
					bs.readBits(sizeB, false),
				];
			};

			fnBitsRemaining = () => bs.bitsLeft;

		} else {
			// Support functions for byte-level LZSS.
			let input = new RecordBuffer(content);

			let flagBitPos = 8;
			let flagByte = 0;
			fnNextFlag = () => {
				if (flagBitPos >= 8) {
					flagByte = input.read(RecordType.int.u8);
					flagBitPos = 0;
				}
				const f = flagByte & 1;
				flagByte >>= 1;
				flagBitPos++;
				return f ^ invert;
			};

			fnReadByte = () => {
				return input.read(RecordType.int.u8);
			};

			// Put this outside fnReadLengthDistance() so we avoid a conditional on
			// each read operation.
			const fnReadWord = input.read.bind(
				input,
				options.littleEndian ? RecordType.int.u16le : RecordType.int.u16be
			);

			fnReadLengthDistance = () => {
				const brWord = fnReadWord();

				let backrefOffset = (brWord >> offShift) & offMask;
				let backrefSize = (brWord >> sizeShift) & sizeMask;

				return [
					backrefSize,
					backrefOffset,
				];
			};

			fnBitsRemaining = () => input.distFromEnd() * 8;
		}

		while (fnBitsRemaining() > 0) {

			const flag = fnNextFlag();

			// if the flag indicates that this chunk is a backreference...
			if (flag) {
				// verify that there are enough bytes left in the input stream to
				// describe the backreference
				if (fnBitsRemaining() < 16) break;

				let [ backrefSize, backrefOffset ] = fnReadLengthDistance();

				// Rotate the offset by the given number of bits, e.g. 0xABC rotated
				// by 4 = BCA.
				if (options.offsetRotate) {
					backrefOffset =
						(
							(backrefOffset << options.offsetRotate)
							| (backrefOffset >> (options.sizeDistance - options.offsetRotate))
						) & offMask
					;
				}

				backrefSize += options.minLen;
				backrefOffset += options.minDistance;

				if (options.relativeDistance) {
					backrefOffset = windowSize + windowPos - backrefOffset;
				}

				// copy the bytes from the sliding window to the output, and also
				// to the end of the sliding window
				for (let brByteIdx = 0; brByteIdx < backrefSize; brByteIdx++) {
					backrefOffset %= windowSize;

					const curByte = slidingWindow[backrefOffset];
					output.write(RecordType.int.u8, curByte);

					slidingWindow[windowPos] = curByte;

					++backrefOffset;
					++windowPos; windowPos %= windowSize;
				}

			} else { // otherwise, this chunk is a literal
				if (fnBitsRemaining() < 8) break;

				const literal = fnReadByte();
				output.write(RecordType.int.u8, literal);

				slidingWindow[windowPos++] = literal;
				windowPos %= windowSize;
			}

		}

		return output.getU8();
	}

	static obscure(content, options = {})
	{
		const debug = g_debug.extend('obscure');

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

		options.bitstream = parseBool(options.bitstream);
		options.invertFlag = parseBool(options.invertFlag);
		options.lengthHigh = parseBool(options.lengthHigh);
		options.littleEndian = parseBool(options.littleEndian);
		options.minDistance = parseInt(options.minDistance || 0);
		// minLen can't be 0 (infinite loop).
		options.minLen = parseInt(options.minLen || 3);
		options.offsetRotate = parseInt(options.offsetRotate || 0);
		options.prefillByte = parseInt(options.prefillByte || 0x00);
		options.relativeDistance = parseBool(options.relativeDistance);
		// sizeDistance can't be 0.
		options.sizeDistance = parseInt(options.sizeDistance || 12);
		// sizeLength can't be 0.
		options.sizeLength = parseInt(options.sizeLength || 4);
		options.windowStartAt0 = parseBool(options.windowStartAt0);

		const windowSize = (1 << options.sizeDistance);
		const maxBackrefSize = (1 << options.sizeLength) + options.minLen - 1;
		const windowStartPos = options.windowStartAt0 ? 0 : windowSize - maxBackrefSize;

		// worst case is an increase in content size by 12.5% (negative compression)
		let output = new RecordBuffer(content.length * 1.13);

		let textBuf = new Uint8Array(windowSize + maxBackrefSize - 1).fill(options.prefillByte);
		let r_windowInputPos = windowStartPos;
		let inputPos = 0;
		let inputStringLen = 0;
		let i = 0;

		// s starts maxBackrefSize bytes after windowStartPos, wrapping around to
		// the start of the window if needed.
		let s = (windowStartPos + maxBackrefSize + windowSize) % windowSize;

		let sizeShift, offShift;
		if (options.lengthHigh) {
			sizeShift = options.sizeDistance;
			offShift = 0;
		} else {
			sizeShift = 0;
			offShift = options.sizeLength;
		}

		const offMask = (1 << options.sizeDistance) - 1;

		const invert = options.invertFlag ? 1 : 0;

		let fnWriteLiteral, fnWriteLengthDistance, fnFlush;
		if (options.bitstream) {
			// Support functions for bit-level LZSS.

			let bs = new BitStream(
				new BitView(output.buffer, output.byteOffset, output.byteLength)
			);
			bs.bigEndian = !options.littleEndian;

			fnWriteLiteral = literalByte => {
				bs.writeBits(0 ^ invert, 1);
				bs.writeBits(literalByte, 8);
			};

			fnWriteLengthDistance = (backrefSize, backrefOffset) => {
				bs.writeBits(1 ^ invert, 1);
				if (options.lengthHigh) {
					bs.writeBits(backrefSize, options.sizeLength);
					bs.writeBits(backrefOffset, options.sizeDistance);
				} else {
					bs.writeBits(backrefOffset, options.sizeDistance);
					bs.writeBits(backrefSize, options.sizeLength);
				}
			};

			fnFlush = () => {
				// Write zero bits until the next byte boundary.
				const bitsLeft = (8 - (bs.index % 8)) % 8;
				if (bitsLeft) bs.writeBits(0, bitsLeft);

				return new Uint8Array(output.buffer, 0, bs.byteIndex);
			};

		} else {
			// Support functions for byte-level LZSS.

			let chunkIndex = 0;

			// we buffer up 8 chunks at a time (a mixture of literals and
			// backreferences) because the flags that indicate the chunk type are
			// packed together into a single prefix byte
			let chunkBuf = new Array();

			// init the flag byte with all the flags clear;
			// we'll OR-in individual flags as literals are added
			chunkBuf.push(0);

			function flushChunks() {
				// once we've finished 8 chunks, write them to the output
				if (++chunkIndex >= 8) {

					const binaryChunkBuf = new Uint8Array(chunkBuf);
					output.put(binaryChunkBuf);

					chunkIndex = 0;
					chunkBuf.length = 0;
					chunkBuf.push(0);
				}
			}

			fnWriteLiteral = literalByte => {
				// set the flag indicating that this chunk is a literal
				chunkBuf[0] |= ((0 ^ invert) << chunkIndex);
				chunkBuf.push(literalByte);

				flushChunks();
			};

			fnWriteLengthDistance = (backrefSize, backrefOffset) => {
				chunkBuf[0] |= ((1 ^ invert) << chunkIndex);

				// Rotate the offset by the given number of bits, e.g. 0xABC rotated
				// by 4 = CAB.  This is the opposite direction to when we read it.
				if (options.offsetRotate) {
					backrefOffset =
						(
							(backrefOffset >> options.offsetRotate)
							| (backrefOffset << (options.sizeDistance - options.offsetRotate))
						) & offMask
					;
				}

				backrefSize <<= sizeShift;
				backrefOffset <<= offShift;

				const word = backrefOffset | backrefSize;
				if (options.littleEndian) {
					chunkBuf.push(word & 0xFF);
					chunkBuf.push(word >> 8);
				} else {
					chunkBuf.push(word >> 8);
					chunkBuf.push(word & 0xFF);
				}

				flushChunks();
			};

			fnFlush = () => {
				// if there's a partial set of eight chunks, write it to the output
				if (chunkIndex > 0) {
					const binaryChunkBuf = new Uint8Array(chunkBuf);
					output.put(binaryChunkBuf);
				}

				return output.getU8();
			};
		}

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
			if (
				(bestMatchLen >= options.minLen)
				&& (bestMatchStartPos >= options.minDistance)
			) {

				if (options.relativeDistance) {
					bestMatchStartPos = (windowSize + r_windowInputPos - bestMatchStartPos) % windowSize;
				}

				let backrefOffset = bestMatchStartPos - options.minDistance;
				let backrefSize = bestMatchLen - options.minLen;

				fnWriteLengthDistance(backrefSize, backrefOffset);

			} else { // otherwise, produce a literal
				bestMatchLen = 1;
				fnWriteLiteral(textBuf[r_windowInputPos]);
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

		return fnFlush();
	}
}
