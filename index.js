const fileTypes = [
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
