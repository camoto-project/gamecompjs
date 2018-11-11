const Debug = require('../util/utl-debug.js');

const FORMAT_ID = 'enc-xor-blood';

// Number of bytes encrypted from start of file
const RFF_FILE_CRYPT_LEN = 256;

module.exports = class Encrypt_XOR_Blood
{
	static metadata() {
		return {
			id: FORMAT_ID,
			title: 'Blood XOR encryption',
			params: {
				seed: 'Initial seed for the first XOR byte',
			},
		};
	}

	static reveal(content, params = {})
	{
		let output = Buffer.from(content);

		const seed = parseInt(params.seed || 0);
		const lenEncrypt = Math.min(RFF_FILE_CRYPT_LEN, output.length);

		for (let i = 0; i < lenEncrypt; i++) {
			output[i] ^= seed + (i >> 1);
		}

		return output;
	}

	static obscure(content, params = {}) {
		// Symmetric algorithm
		return this.reveal(content, params);
	}

};
