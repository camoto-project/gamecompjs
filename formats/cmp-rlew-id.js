/*
 * id Software RLEW compression algorithm.
 *
 * This algorithm is fully documented on the ModdingWiki:
 *   http://www.shikadi.net/moddingwiki/RLEW_compression
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

const FORMAT_ID = 'cmp-rlew-id';

import { RecordBuffer, RecordType } from '@camoto/record-io-buffer';
import Debug from '../util/debug.js';
const g_debug = Debug.extend(FORMAT_ID);

export default class Compress_RLEW_id
{
	static metadata() {
		return {
			id: FORMAT_ID,
			title: 'id Software RLEW compression',
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
		const putWord = output.write.bind(output, RecordType.int.u16le);

		while (input.distFromEnd() > 0) {
			const v = getWord();
			if (v === 0xFEFE) {
				let count = getWord();
				const repeat = getWord();
				while (count--) putWord(repeat);
			} else {
				putWord(v);
			}
		}

		return output.getU8();
	}

	static obscure(content) {
		const debug = g_debug.extend('obscure');

		let input = new RecordBuffer(content);
		let output = new RecordBuffer(content.length * 1.2);

		const getWord = input.read.bind(input, RecordType.int.u16le);
		const putWord = output.write.bind(output, RecordType.int.u16le);

		let prevWord = -1, pending = 0;

		const putRLE = () => {
			putWord(0xFEFE);
			putWord(pending);
			putWord(prevWord);
			pending = 0;
		};

		while (input.distFromEnd() > 0) {
			const v = getWord();
			if (v === prevWord) {
				if (pending === 65535) {
					putRLE();
				}
				pending++;
			} else {
				if (pending) {
					// This word is different to the last, write out the cached run
					if ((pending > 3) || (prevWord === 0xFEFE)) {
						putRLE();
					} else {
						while (pending--) putWord(prevWord);
					}
				}
				prevWord = v;
				pending = 1;
			}
		}
		if (pending) {
			// Write out a pending RLE pending
			if ((pending > 3) || (prevWord === 0xFEFE)) {
				putRLE();
			} else {
				while (pending--) putWord(prevWord);
			}
		}

		return output.getU8();
	}
}
