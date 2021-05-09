/*
 * Captain Comic RLE compression algorithm.
 *
 * This algorithm is fully documented on the ModdingWiki:
 *   https://moddingwiki.shikadi.net/wiki/Captain_Comic_Image_Format
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

const FORMAT_ID = 'cmp-rle-ccomic';

import { RecordBuffer, RecordType } from '@camoto/record-io-buffer';
import Debug from '../util/debug.js';
const g_debug = Debug.extend(FORMAT_ID);

import { pad_chunked } from './index.js';

export default class Compress_RLE_CComic
{
	static metadata() {
		return {
			id: FORMAT_ID,
			title: 'Captain Comic RLE compression',
			options: {
			},
		};
	}

	static reveal(content)
	{
		const debug = g_debug.extend('reveal');

		let input = new RecordBuffer(content);

		const lenPlane = input.read(RecordType.int.u16le);
		const outputLength = lenPlane * 4;

		let output = new RecordBuffer(outputLength);

		const getByte = input.read.bind(input, RecordType.int.u8);
		const putByte = output.write.bind(output, RecordType.int.u8);

		while (
			(input.distFromEnd() > 1) // At least two input bytes (RLE code + val)
			&& (
				(outputLength === 0) // And no output limit was given
				|| (output.length < outputLength) // Or a limit was given and we are below it
			)
		) {
			const v = getByte();
			if (v & 0x80) {
				let repeat = v & 0x7F;
				let n = getByte();
				while (repeat--) putByte(n);
			} else {
				let lenEscape = v;
				if (lenEscape > input.distFromEnd()) {
					debug(`Tried to escape ${lenEscape} bytes, but there are only `
						+ `${input.distFromEnd()} bytes left.`);
					// Just limit to whatever's left.
					lenEscape = input.distFromEnd();
				}
				output.put(input.get(lenEscape));
			}
		}

		return output.getU8();
	}

	static obscure(content) {
		const lenPlane = content.length / 4;

		let rle = pad_chunked.obscure(content, {
			length: lenPlane, // one plane at a time
			callback: chunk => this.obscureBlock(chunk),
		});

		// Write the plane length.
		let output = new RecordBuffer(rle.length + 2);
		output.write(RecordType.int.u16le, lenPlane);

		output.put(rle);

		return output.getU8();
	}

	static obscureBlock(content) {
		const debug = g_debug.extend('obscureBlock');

		let input = new RecordBuffer(content);
		let output = new RecordBuffer(content.length);

		const getByte = input.read.bind(input, RecordType.int.u8);
		const putByte = output.write.bind(output, RecordType.int.u8);

		let prevByte = getByte();

		let pending = 1;
		function flushPending() {
			// This word is different to the last, write out the cached run.
			if (pending > 2) {
				if (diff.length) {
					// Write out the escaped values first.
					flushDiff();
				}
				putByte(0x80 | pending);
				putByte(prevByte);
			} else {
				// Too short to bother with RLE, just cache it.
				while (pending--) diff.push(prevByte);
			}
			pending = 0;
		}

		let diff = [];
		function flushDiff() {
			// Had different bytes but now have repeated ones.  Write out all the
			// different bytes ready for the repeated ones.
			while (diff.length) {
				let len = Math.min(diff.length, 128);
				putByte(len);
				for (let i = 0; i < len; i++) {
					putByte(diff[i]);
				}
				diff = diff.slice(len);
			}
		}

		while (input.distFromEnd() > 0) {
			const v = getByte();
			if (v === prevByte) {
				if (pending === 127) {
					flushPending();
				}
				pending++;

			} else { // not the same byte as the last one.
				if (pending) {
					flushPending();
				}
				prevByte = v;
				pending = 1;
			}
		}
		if (pending) {
			flushPending(); // may write to diff
		}
		if (diff.length) {
			flushDiff();
		}

		return output.getU8();
	}
}
