/*
 * Base class and defaults for supported algorithms.
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

export default class Algorithm
{
	/**
	 * Retrieve information about the algorithm.
	 *
	 * This must be overridden by all implementations.  It returns a structure
	 * detailed below.
	 *
	 * @return {Metadata} object.
	 */
	static metadata() {
		return {
			/**
			 * @typedef {Object} Metadata
			 *
			 * @property {string} id
			 *   A unique identifier for the format.
			 *
			 * @property {string} title
			 *   The user-friendly title for the format.
			 *
			 * @property {Object} params
			 *   Available parameters that can be passed to reveal() and obscure().
			 *   The key is the parameter name and the value is a user-friendly
			 *   description of what the parameter does.  When reveal() or obscure()
			 *   are called, the same keys are used but the values contain the actual
			 *   value selected for that parameter.
			 */
			id: 'unknown',
			title: 'Unknown format',
			params: {},
		};
	}

	/**
	 * Reveal the original data by reversing the algorithm.
	 *
	 * @param {Buffer} content
	 *   Compressed or encrypted data.
	 *
	 * @param {Object} params
	 *   Optional list of parameters for the algorithm.  Valid options are listed
	 *   in the 'params' field returned by metadata().
	 *
	 * @return {Buffer} containing decompressed/decrypted data.
	 */
	static reveal(content, params = {}) {
		throw new Error('Not implemented yet.');
	};

	/**
	 * Obscure some data by applying the algorithm to it.
	 *
	 * @param {Buffer} content
	 *   Source data to process.
	 *
	 * @param {Object} params
	 *   Optional list of parameters for the algorithm.  Valid options are listed
	 *   in the 'params' field returned by metadata().
	 *
	 * @return {Buffer} containing the compressed/encrypted result.
	 */
	static obscure(content, params = {}) {
		throw new Error('Not implemented yet.');
	};
}
