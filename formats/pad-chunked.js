/*
 * Generic chunking algorithm.
 *
 * This algorithm applies others but in fixed-size chunks.  It is used in cases
 * where a game might read data in say 64 kB blocks, and applying an algorithm
 * to each block after being read.  In this case applying the algorithm to the
 * data as a whole might be wrong (e.g. an RLE repeat code might run across the
 * 64 kB block boundary) so by using this chunking algorithm it ensures each
 * chunk is self-contained.
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

const FORMAT_ID = 'pad-chunked';

import { RecordBuffer } from '@camoto/record-io-buffer';
import Debug from '../util/debug.js';
const g_debug = Debug.extend(FORMAT_ID);

export default class Pad_Chunked
{
	static metadata() {
		return {
			id: FORMAT_ID,
			title: 'Generic chunking',
			options: {
				length: 'Size of each chunk, in bytes (16)',
				callback: 'Function to call to apply other algorithms to each chunk',
			},
		};
	}

	static reveal(content, options = {})
	{
		if (!options.callback) return content;

		let input = new RecordBuffer(content);
		let output = new RecordBuffer(content.length);

		while (input.distFromEnd() > 0) {
			// Pass through a chunk.
			const inChunk = input.get(
				Math.min(input.distFromEnd(), options.length)
			);
			const outChunk = options.callback(inChunk);
			output.put(outChunk);
		}

		return output.getU8();
	}

	static obscure(content, options = {}) {
		// Symmetrical as it depends on the callback.
		return this.reveal(content, options);
	}
}
