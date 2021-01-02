/*
 * Raptor .GLB archive encryption algorithm.
 *
 * This algorithm is fully documented on the ModdingWiki:
 *   http://www.shikadi.net/moddingwiki/GLB_Format
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

const FORMAT_ID = 'enc-glb-raptor';

import { RecordType } from '@camoto/record-io-buffer';

export default class Encrypt_GLB_Raptor
{
	static metadata() {
		return {
			id: FORMAT_ID,
			title: 'Raptor GLB encryption',
			options: {
				key: 'Encryption key (string)',
				seed: 'Initial index into key, default 1',
				blockSize: 'Reset key index after this many bytes, 0 to disable',
			},
		};
	}

	static reveal(content, options = {})
	{
		let output = new Uint8Array(content.length);

		const seed = parseInt(options.seed || 1);
		const key = RecordType.string.toU8(options.key || '32768GLB');
		const lenBlock = parseInt(options.blockSize || 0);
		const lenKey = key.length;

		let idxKey = seed;
		let lastByte = key[idxKey % lenKey];
		for (let i = 0; i < content.length; i++) {
			if ((lenBlock !== 0) && (i !== 0) && (i % lenBlock === 0)) {
				idxKey = seed;
				lastByte = key[idxKey % lenKey];
			}

			output[i] = (content[i] - key[idxKey % lenKey] - lastByte) & 0xFF;
			lastByte = content[i];
			idxKey++;
		}

		return output;
	}

	static obscure(content, options = {}) {
		let output = new Uint8Array(content.length);

		const seed = parseInt(options.seed || 1);
		const key = RecordType.string.toU8(options.key || '32768GLB');
		const lenBlock = parseInt(options.blockSize || 0);
		const lenKey = key.length;

		let idxKey = seed;
		let lastByte = key[idxKey % lenKey];
		for (let i = 0; i < content.length; i++) {
			if ((lenBlock !== 0) && (i !== 0) && (i % lenBlock === 0)) {
				idxKey = seed;
				lastByte = key[idxKey % lenKey];
			}

			lastByte = output[i] = (content[i] + key[idxKey % lenKey] + lastByte) & 0xFF;
			idxKey++;
		}

		return output;
	}
}
