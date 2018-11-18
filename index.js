/**
 * @file Main library interface.
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

const fileTypes = [
	require('./compress/cmp-lzw.js'),
	require('./compress/cmp-rle-bash.js'),
	require('./encrypt/enc-xor-blood.js'),
];

module.exports = class GameCompression
{
	/// Get a handler by ID directly.
	/**
	 * @param string type
	 *   Identifier of desired file format.
	 *
	 * @return Type from formats/*.js matching requested code, or null
	 *   if the code is invalid.
	 */
	static getHandler(type)
	{
		return fileTypes.find(x => type === x.metadata().id);
	}

	/// Get a list of all the available handlers.
	/**
	 * This is probably only useful when testing the library.
	 *
	 * @return Array of file format handlers, with each element being
	 *   just like getHandler() returns.
	 */
	static listHandlers() {
		return fileTypes;
	}
}
