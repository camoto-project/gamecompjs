/*
 * Stargunner .DLT filename XOR encryption algorithm.
 *
 * This algorithm is fully documented on the ModdingWiki:
 *   https://moddingwiki.shikadi.net/wiki/DLT_Format
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

const FORMAT_ID = 'enc-dlt-stargunner-filename';

export default class Encrypt_DLT_Stargunner_Filename
{
	static metadata() {
		return {
			id: FORMAT_ID,
			title: 'Stargunner DLT filename encryption',
			options: {},
		};
	}

	static reveal(content)
	{
		let output = new Uint8Array(content);

		for (let i = 1; i < content.length; i++) {
			output[i] ^= output[i - 1] + i;
		}

		return output;
	}

	static obscure(content) {
		let output = new Uint8Array(content);

		for (let i = content.length - 1; i > 0; i--) {
			output[i] ^= output[i - 1] + i;
		}

		return output;
	}
}
