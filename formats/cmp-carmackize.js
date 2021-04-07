/*
 * id Software Carmackization compression algorithm.
 *
 * This algorithm is fully documented on the ModdingWiki:
 *   http://www.shikadi.net/moddingwiki/Carmack_compression
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

const FORMAT_ID = 'cmp-carmackize';

import { RecordBuffer, RecordType } from '@camoto/record-io-buffer';
import Debug from '../util/debug.js';
const g_debug = Debug.extend(FORMAT_ID);

export default class Compress_Carmackize
{
	static metadata() {
		return {
			id: FORMAT_ID,
			title: 'id Software Carmackization compression',
			options: {
			},
		};
	}

	static reveal(content)
	{
		const debug = g_debug.extend('reveal');

		let input = new RecordBuffer(content);
		let output = new RecordBuffer(content.length * 1.2);

		const getWord = input.read.bind(input, RecordType.int.u16le);
		const getByte = input.read.bind(input, RecordType.int.u8);
		const putWord = output.write.bind(output, RecordType.int.u16le);

		while (input.distFromEnd() >= 2) {
			const v = getWord();
			if (v >> 8 === 0xA7) {
				let count = v & 0xFF;
				const distance = getByte();
				if (count === 0) { // escape
					putWord((v & 0xFF00) | distance);
				} else {
					const window = output.getU8(output.getPos() - distance * 2, count * 2);
					output.put(window);
				}
			} else if (v >> 8 === 0xA8) {
				let count = v & 0xFF;
				if (count === 0) { // escape
					const low = getByte();
					putWord((v & 0xFF00) | low);
				} else {
					const distance = getWord();
					const window = output.getU8(output.getPos() - distance * 2, count * 2);
					output.put(window);
				}
			} else {
				putWord(v);
			}
		}

		// Take across any trailing byte.
		if (input.distFromEnd() === 1) {
			// Trailing byte.
			const b = input.read(RecordType.int.u8);
			output.write(RecordType.int.u8, b);
		}

		return output.getU8();
	}

	static obscure(content) {
		const debug = g_debug.extend('obscure');

		let input = new RecordBuffer(content);

		// Have to round the Uint16Array to a multiple of 2.
		const lenInWords = input.length >> 1;

		// Create a typed array for speed.  This isn't endian-safe, but as we're
		// only comparing one value against another in the same array, the byte
		// order doesn't actually matter.
		const inputWords = new Uint16Array(input.buffer, input.buffer.byteOffset, lenInWords);

		let output = new RecordBuffer(content.length * 1.2);

		const putWord = output.write.bind(output, RecordType.int.u16le);
		const putByte = output.write.bind(output, RecordType.int.u8);

		while (input.distFromEnd() > 1) {
			let offPos = input.getPos() >> 1; // divide by two, round to int

			// Look back in the input data, comparing it to the upcoming input data,
			// and see if there is a match for a number of UINT16LE words.
			let maxRun = 0, maxRunStart = 0;
			for (let o = 1; o < 65536; o++) {
				// Jump back one more word.
				if (o > offPos) {
					// Gone all the way back to the start of the output data.
					break;
				}
				//debug('    looking back', o, 'words (index', offPos - o, ')');
				// See if the sequence from this point matches the input data.
				let i;
				const maxLookForward = Math.min(255, o, inputWords.length - offPos);
				for (i = 0; i < maxLookForward; i++) {
					//debug(`    in: ${input.getPos()}, out: ${output.getPos()}`);
					const nextInput = inputWords[offPos - o + i];
					const nextOutput = inputWords[offPos + i];
					//debug(`        nextInput = ${nextInput.toString(16)}, nextOutput = ${nextOutput.toString(16)}`);
					if (nextInput !== nextOutput) break;
				}
				// The run finished with `i` bytes matching.
				//debug(`        run finished with ${i} words matching`);
				if (maxRun < i) {
					maxRun = i;
					maxRunStart = o;
				}
				// Keep going with the next word back to see if we can find a longer run.
			}
			//debug(`found run of ${maxRun} @ -${maxRunStart}`);
			if (maxRun >= 2) {
				// We found a run worth compressing.
				if (maxRunStart > 255) {
					putWord((0xA8 << 8) | maxRun);
					putWord(maxRunStart);
				} else {
					putWord((0xA7 << 8) | maxRun);
					putByte(maxRunStart);
				}
				input.seekRel(maxRun * 2);
			} else {
				// Just copy across the next word.
				const nextInput = input.read(RecordType.int.u16le);
				switch (nextInput >> 8) {
					case 0xA7: // fall through
					case 0xA8:
						putWord(nextInput & 0xFF00);
						putByte(nextInput & 0xFF);
						break;
					default:
						putWord(nextInput);
				}
			}
		}

		// Take across any trailing byte.
		if (input.distFromEnd() === 1) {
			// Trailing byte.
			const b = input.read(RecordType.int.u8);
			output.write(RecordType.int.u8, b);
		}

		return output.getU8();
	}
}
