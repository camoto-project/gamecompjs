/*
 * Decompress an .exe if it is compressed, otherwise return it unchanged.
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

import cmp_lzexe from '../formats/cmp-lzexe.js';
import cmp_pklite from '../formats/cmp-pklite.js';

/**
 * Decompress the executable, if it is compressed with a supported runtime
 * decompressor such as LZEXE or PKLite.
 */
export function decompress_exe(content)
{
	if (cmp_lzexe.identify(content).valid) {
		return cmp_lzexe.reveal(content);
	}

	if (cmp_pklite.identify(content).valid) {
		return cmp_pklite.reveal(content);
	}

	return content;
}
