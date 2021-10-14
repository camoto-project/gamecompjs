/*
 * Stargunner .DLT byte-pair-encoding compression algorithm.
 *
 * This algorithm is fully documented on the ModdingWiki:
 *   http://www.shikadi.net/moddingwiki/DLT_Format
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

const FORMAT_ID = 'cmp-bpe-stargunner';

import { RecordBuffer, RecordType } from '@camoto/record-io-buffer';
import Debug from '../util/debug.js';
const g_debug = Debug.extend(FORMAT_ID);

export default class Compress_BPE_Stargunner
{
	static metadata() {
		return {
			id: FORMAT_ID,
			title: 'Stargunner byte-pair compression',
			options: {
			},
		};
	}

	static reveal(content)
	{
		const debug = g_debug.extend('reveal');

		let input = new RecordBuffer(content);
		let output = new RecordBuffer(content.length * 1.2);

		const sig = input.read(RecordType.string.fixed.noTerm(4));
		if (sig !== 'PGBP') {
			throw new Error('cmp-bpe-stargunner: Missing PGBP signature.');
		}

		let lenDecomp = input.read(RecordType.int.u32le);

		while (input.getPos() < input.length) {
			let lenChunkComp = input.read(RecordType.int.u16le);
			if (lenChunkComp > 4096 + 256) {
				throw new Error(`cmp-bpe-stargunner: Chunk size of ${lenChunkComp} `
					+ `is too large.`);
			}
			let lenChunkDecomp = Math.min(4096, lenDecomp);
			lenDecomp -= lenChunkDecomp;

			while (lenChunkDecomp > 0) {
				// Initialise the dictionary so that no bytes are codewords (or if you
				// prefer, each byte expands to itself only.)
				let dictA = new Uint8Array(256);
				let dictB = new Uint8Array(256);
				for (let i = 0; i < dictA.length; i++) {
					dictA[i] = i;
				}

				let dictIndex = 0;
				do {
					let code = input.read(RecordType.int.u8);
					// If the code has the high bit set, the lower 7 bits plus one is the
					// number of codewords that will be skipped from the dictionary.
					// (Those codewords were initialised to expand to themselves in the
					// loop above.)
					if (code & 0x80) {
						dictIndex += 1 + (code & 0x7F);
						code = 0;
					}
					if (dictIndex == 256) break;

					// Read in the indicated number of codewords.
					for (let i = 0; i <= code; i++) {
						if (dictIndex >= 256) {
							throw new Error('cmp-bpe-stargunner: Exceeded dictionary size.');
						}

						const data = input.read(RecordType.int.u8);
						dictA[dictIndex] = data;
						if (dictIndex != data) {
							// If this codeword didn't expand to itself, store the second byte
							// of the expansion pair.
							dictB[dictIndex] = input.read(RecordType.int.u8);
						}
						dictIndex++;
					}
				} while (dictIndex < 256);

				// Read the length of the data encoded with this dictionary
				let lenSubchunk = input.read(RecordType.int.u16le);

				// Decompress the data

				let expbufpos = 0;
				// This is the maximum number of bytes a single codeword can expand to.
				let expbuf = new Uint8Array(32);
				let code;
				for (;;) {
					if (expbufpos) {
						// There is data in the expansion buffer, use that
						code = expbuf[--expbufpos];
					} else {
						// There is no data in the expansion buffer, use the input data
						if (--lenSubchunk === -1) break; // no more input data
						code = input.read(RecordType.int.u8);
					}

					if (code === dictA[code]) {
						// This byte is itself, write this to the output
						output.write(RecordType.int.u8, code);
						lenChunkDecomp--;
					} else {
						// This byte is actually a codeword, expand it into the expansion buffer
						if (expbufpos >= expbuf.length - 2) {
							throw new Error('cmp-bpe-stargunner: Exceeded expansion buffer length.');
						}
						expbuf[expbufpos++] = dictB[code];
						expbuf[expbufpos++] = dictA[code];
					}
				}
			}
		}

		return output.getU8();
	}

	// This is only a dummy compressor.  It puts the data in uncompressed, but in
	// an arrangement that looks like valid compressed data and will "decompress"
	// back to the original data.
	static obscure(content) {
		const debug = g_debug.extend('obscure');

		let output = new RecordBuffer(content.length * 1.2);

		output.write(RecordType.string.fixed.noTerm(4), 'PGBP');
		output.write(RecordType.int.u32le, content.length);

		let offset = 0;
		let remaining = content.length;
		do {
			const lenChunk = Math.min(remaining, 4096);

			output.write(RecordType.int.u16le, lenChunk + 4);

			// Empty dictionary (no compression).
			output.write(RecordType.int.u8, 0xFF);
			output.write(RecordType.int.u8, 0x80);
			output.write(RecordType.int.u8, 0xFE);
			output.write(RecordType.int.u16le, lenChunk); // lenSubchunk

			output.put(content.slice(offset, offset + lenChunk));

			offset += lenChunk;
			remaining -= lenChunk;
		} while (offset < content.length);

		return output.getU8();
	}
}
