/*
 * Incremental XOR encryption algorithm.
 *
 * This algorithm is fully documented on the ModdingWiki:
 *   https://moddingwiki.shikadi.net/wiki/DAT_Format_(God_of_Thunder)
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

const FORMAT_ID = 'enc-xor-incremental';

export default class Encrypt_XOR_Blood
{
	static metadata() {
		return {
			id: FORMAT_ID,
			title: 'Incremental XOR encryption',
			options: {
				seed: 'Initial seed for the first XOR byte [0]',
				limit: 'Number of bytes to affect (0=all) [0]',
				step: 'Amount to increment seed by at each byte [0]',
			},
		};
	}

	static reveal(content, options = {})
	{
		let output = new Uint8Array(content);

		let seed = parseInt(options.seed || 0);
		const limit = parseInt(options.limit || 0);
		const step = parseInt(options.step || 0);
		const lenEncrypt = limit === 0 ? output.length : Math.min(limit, output.length);

		for (let i = 0; i < lenEncrypt; i++) {
			output[i] ^= seed;
			seed = (seed + step) & 0xFF;
		}

		return output;
	}

	static obscure(content, options = {}) {
		// Symmetric algorithm
		return this.reveal(content, options);
	}
}
