/**
 * @file Monster Bash RLE compression algorithm.
 *
 * This algorithm is fully documented on the ModdingWiki:
 *   http://www.shikadi.net/moddingwiki/DAT_Format_%28Monster_Bash%29
 *
 * Copyright (C) 2018 Adam Nielsen <malvineous@shikadi.net>
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

const { RecordBuffer, RecordType } = require('@malvineous/record-io-buffer');
const Debug = require('../util/utl-debug.js');

const FORMAT_ID = 'cmp-rle-bash';

/// Trigger byte value for an RLE event.
const RLE_TRIGGER = 0x90;

module.exports = class Compress_RLE_MonsterBash
{
	static metadata() {
		return {
			id: FORMAT_ID,
			title: 'Monster Bash RLE compression',
			options: {
			},
		};
	}

	static reveal(content)
	{
		try {
			const md = this.metadata();
			Debug.push(md.id, 'reveal');

			let input = new RecordBuffer(content);
			let output = new RecordBuffer(content.length * 1.2);

			const getByte = input.read.bind(input, RecordType.int.u8);
			const putByte = output.write.bind(output, RecordType.int.u8);

			let prevByte = 0;
			while (input.distFromEnd() > 0) {
				const v = getByte();
				if (v === RLE_TRIGGER) {
					let n = getByte();
					if (n !== 0) {
						while (--n) putByte(prevByte);
						continue;
					}
				}
				putByte(v);
				prevByte = v;
			}

			return output.getU8();

		} finally {
			Debug.pop();
		}
	}

	static obscure(content) {
		try {
			const md = this.metadata();
			Debug.push(md.id, 'obscure');

			let input = new RecordBuffer(content);
			let output = new RecordBuffer(content.length * 1.2);

			const getByte = input.read.bind(input, RecordType.int.u8);
			const putByte = output.write.bind(output, RecordType.int.u8);

			let prevByte = -1, pending = 0;
			while (input.distFromEnd() > 0) {
				const v = getByte();
				if (v === prevByte) {
					pending++;
					if (pending === 255) {
						putByte(RLE_TRIGGER);
						putByte(255);
						pending = 1; // one left over
					}
				} else {
					if (pending) {
						// This byte is different to the last, write out the cached run
						if (pending > 1) {
							putByte(RLE_TRIGGER);
							putByte(pending + 1); // will never be > 255
						} else {
							// For only two chars, it's more efficient not to use the RLE code
							putByte(prevByte);
						}
						pending = 0;
					}
					if (v === RLE_TRIGGER) {
						putByte(RLE_TRIGGER);
						putByte(0);
					} else {
						putByte(v);
					}
					prevByte = v;
				}
			}
			if (pending) {
				// Write out a pending RLE pending
				putByte(RLE_TRIGGER);
				putByte(pending + 1); // will never be > 255
			}

			return output.getU8();

		} finally {
			Debug.pop();
		}
	}
};
