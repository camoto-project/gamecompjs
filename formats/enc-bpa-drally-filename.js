/*
 * Death Rally .BPA archive filename encryption algorithm.
 *
 * This algorithm is fully documented on the ModdingWiki:
 *   http://www.shikadi.net/moddingwiki/Death_Rally_BPA_Format
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

const FORMAT_ID = 'enc-bpa-drally-filename';

export default class Encrypt_BPA_DeathRally_Filename
{
	static metadata() {
		return {
			id: FORMAT_ID,
			title: 'Death Rally BPA filename encryption',
			options: {},
		};
	}

	static reveal(content)
	{
		let output = new Uint8Array(content);

		for (let i = 0; i < output.length; i++) {
			if (output[i] === 0x00) break; // end of string
			output[i] = ((output[i] - (117 - 3 * i)) >>> 0) & 0xFF;
		}

		return output;
	}

	static obscure(content) {
		let output = new Uint8Array(content);

		for (let i = 0; i < output.length; i++) {
			if (output[i] === 0x00) break; // end of string
			output[i] = ((output[i] + (117 - 3 * i)) >>> 0) & 0xFF;
		}

		return output;
	}
}
