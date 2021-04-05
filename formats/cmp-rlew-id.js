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

const defaultCodeWord = 0xFEFE;

export default class Compress_RLEW_id
{
	static metadata() {
		return {
			id: FORMAT_ID,
			title: 'id Software RLEW compression',
			options: {
				code: 'Code word for RLE data (0xFEFE)',
			},
		};
	}

	static reveal(content, options = {})
	{
		const debug = g_debug.extend('reveal');

		const codeWord = parseInt(options.code) || defaultCodeWord;

		let input = new RecordBuffer(content);
		let output = new RecordBuffer(content.length * 1.2);

		const getWord = input.read.bind(input, RecordType.int.u16le);
		const putWord = output.write.bind(output, RecordType.int.u16le);

		while (input.distFromEnd() > 1) {
			const v = getWord();
			if (v === codeWord) {
				let count = getWord();
				const repeat = getWord();
				while (count--) putWord(repeat);
			} else {
				putWord(v);
			}
		}

		return output.getU8();
	}

	static obscure(content, options = {}) {
		const debug = g_debug.extend('obscure');

		const codeWord = parseInt(options.code) || defaultCodeWord;

		let input = new RecordBuffer(content);
		let output = new RecordBuffer(content.length * 1.2);

		const getWord = input.read.bind(input, RecordType.int.u16le);
		const putWord = output.write.bind(output, RecordType.int.u16le);

		let prevWord = -1, pending = 0;

		const putRLE = () => {
			putWord(codeWord);
			putWord(pending);
			putWord(prevWord);
			pending = 0;
		};

		while (input.distFromEnd() > 1) {
			const v = getWord();
			if (v === prevWord) {
				if (pending === 65535) {
					putRLE();
				}
				pending++;
			} else {
				if (pending) {
					// This word is different to the last, write out the cached run
					if ((pending > 3) || (prevWord === codeWord)) {
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
			if ((pending > 3) || (prevWord === codeWord)) {
				putRLE();
			} else {
				while (pending--) putWord(prevWord);
			}
		}

		return output.getU8();
	}
}
