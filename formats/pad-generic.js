/*
 * Generic padding algorithm.
 *
 * This algorithm adds or removes one or more bytes after a certain number of
 * bytes have been read or written.
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

const FORMAT_ID = 'pad-generic';

import { RecordBuffer } from '@camoto/record-io-buffer';
import Debug from '../util/debug.js';
const g_debug = Debug.extend(FORMAT_ID);

export default class Pad_Generic
{
	static metadata() {
		return {
			id: FORMAT_ID,
			title: 'Generic padding',
			options: {
				pass: 'Number of bytes to pass through before padding (16)',
				pad: 'Number of padding bytes to insert or remove (1)',
				value: 'Byte value (0..255) to use for padding (0)',
				final: '1=pad when pass chunk ends at EOF (0)',
			},
		};
	}

	static reveal(content, options = {})
	{
		const debug = g_debug.extend('reveal');

		if (!options.pass) options.pass = 16;
		if (!options.pad) options.pad = 1;

		let input = new RecordBuffer(content);
		let output = new RecordBuffer(content.length - Math.floor(content.length / options.pass) * options.pad);

		while (input.distFromEnd() > 0) {
			// Pass through a chunk.
			output.put(
				input.get(
					Math.min(input.distFromEnd(), options.pass)
				)
			);
			// Skip over the padding bytes in the input.
			input.seekRel(options.pad);
		}

		return output.getU8();
	}

	static obscure(content, options = {}) {
		const debug = g_debug.extend('obscure');

		if (!options.pass) options.pass = 16;
		if (!options.pad) options.pad = 1;
		if (!options.value) options.value = 0;

		let input = new RecordBuffer(content);
		let output = new RecordBuffer(content.length - Math.floor(content.length / options.pass) * options.pad);

		// Create a padding chunk to write as needed.
		let pad = new Uint8Array(options.pad);
		pad.fill(options.value);

		const finalPad = parseInt(options.final, 10) === 1;

		while (input.distFromEnd() > 0) {
			// Pass through a chunk.
			output.put(
				input.get(
					Math.min(input.distFromEnd(), options.pass)
				)
			);
			// Add padding bytes.
			if (finalPad || (input.distFromEnd() > 0)) {
				output.put(pad);
			}
		}

		return output.getU8();
	}
}
