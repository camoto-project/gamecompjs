/**
 * @file Extra tests for cmp-lzw.
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

const BitStream = require('bit-buffer').BitStream;

const TestUtil = require('./util.js');
const standardCleartext = require('./gen-cleartext.js');
const GameCompression = require('../index.js');

function makeU8(as) {
	let s = as.join('');
	let ab = new ArrayBuffer(s.length);
	let u8 = new Uint8Array(ab);
	for (let i = 0; i < s.length; i++) {
		u8[i] = s.charCodeAt(i);
	}
	return u8;
}

const handler = GameCompression.getHandler('cmp-lzw');
const md = handler.metadata();
let testutil = new TestUtil(md.id);
describe(`Extra tests for ${md.title} [${md.id}]`, function() {

	let content = {};
	let presets = {
		/*
		epfs: {
			title: 'Lion King',
			params: {
				initialBits: 9,
				maxBits: 14,
				cwEOF: -1,    // max codeword
				cwReset: -2, // max-1
				cwFirst: 256,
				bigEndian: true,
			}
		},
		*/
		mbash: {
			title: 'Monster Bash',
			params: {
				initialBits: 9,
				maxBits: 12,
				//cwEOF: 256,
				cwFirst: 257,
				bigEndian: false,
			}
		},
		/*
		sierra: {
			title: 'Sierra',
			params: {
				initialBits: 9,
				maxBits: 9,
				cwEOF: 257,
				cwReset: 256,
				cwFirst: 258,
				bigEndian: false,
			}
		},
		stellar7: {
			title: 'Stellar 7',
			params: {
				initialBits: 9,
				maxBits: 12,
				cwEOF: undefined,
				cwReset: 256,
				cwFirst: 257,
				bigEndian: false,
				flushOnReset: true,
			}
		},
		*/
	};
	before('load test data from local filesystem', function() {
		content.default = testutil.loadData('default.bin');
		content.mbash = testutil.loadData('mbash.bin');
	});

	describe('reveal()', function() {
		Object.keys(presets).forEach(id => {
			const p = presets[id];

			it(`works with ${p.title} settings`, function() {
				const contentRevealed = handler.reveal(content[id], p.params);
				TestUtil.buffersEqual(standardCleartext, contentRevealed);
			});
		});

		describe(`self-referencing codewords are handled correctly`, function() {

			it(`with single dictionary step`, function() {
				let input = new ArrayBuffer(6);
				let bs = new BitStream(input);

				bs.writeBits(65, 9); // A => 256 [A]
				bs.writeBits(66, 9); // B => 257 [AB]
				bs.writeBits(67, 9); // C => 258 [BC]
				bs.writeBits(68, 9); // D => 259 [CD]
				bs.writeBits(260, 9); // Own codeword
				const expected = ['A', 'B', 'C', 'D', 'DD'];

				const contentRevealed = handler.reveal(new Uint8Array(input), presets.mbash.params);
				TestUtil.buffersEqual(makeU8(expected), contentRevealed);
			});

			it(`with double dictionary step`, function() {
				let input = new ArrayBuffer(6);
				let bs = new BitStream(input);

				bs.writeBits(65, 9); // A => 256 [A]
				bs.writeBits(66, 9); // B => 257 [AB]
				bs.writeBits(67, 9); // C => 258 [BC]
				bs.writeBits(258, 9); // BC => 259 [BC,B]
				bs.writeBits(260, 9); // Own codeword [BCB] => 260 [BCB,B]
				const expected = ['A', 'B', 'C', 'BC', 'BCB'];

				const contentRevealed = handler.reveal(new Uint8Array(input), presets.mbash.params);
				TestUtil.buffersEqual(makeU8(expected), contentRevealed);
			});

			it(`with triple dictionary step`, function() {
				let input = new ArrayBuffer(6);
				let bs = new BitStream(input);

				bs.writeBits(65, 9); // A => 256 [A]
				bs.writeBits(66, 9); // B => 257 [AB]
				bs.writeBits(257, 9); // AB => 258 [B,A]
				bs.writeBits(258, 9); // BA => 259 [AB,B]
				bs.writeBits(260, 9); // Own codeword [BA,B] => 260 [BA,B]
				const expected = ['A', 'B', 'AB', 'BA', 'BAB'];

				const contentRevealed = handler.reveal(new Uint8Array(input), presets.mbash.params);
				TestUtil.buffersEqual(makeU8(expected), contentRevealed);
			});

			it(`with triple dictionary step and double self-code`, function() {
				let input = new ArrayBuffer(7);
				let bs = new BitStream(input);

				bs.writeBits(65, 9); // A => 256 [A]
				bs.writeBits(66, 9); // B => 257 [AB]
				bs.writeBits(257, 9); // AB => 258 [B,A]
				bs.writeBits(258, 9); // BA => 259 [AB,B]
				bs.writeBits(260, 9); // Own codeword [BA,B] => 260 [BA,B]
				bs.writeBits(261, 9); // Own codeword [BAB,B] => 261 [BAB,B]
				const expected = ['A', 'B', 'AB', 'BA', 'BAB', 'BABB'];

				const contentRevealed = handler.reveal(new Uint8Array(input), presets.mbash.params);
				TestUtil.buffersEqual(makeU8(expected), contentRevealed);
			});

		});
	});

	describe('obscure()', function() {
		Object.keys(presets).forEach(id => {
			const p = presets[id];

			it(`works with ${p.title} settings`, function() {
				const contentObscured = handler.obscure(standardCleartext, p.params);
				TestUtil.buffersEqual(content[id], contentObscured);
			});
		});

		describe(`self-referencing codewords are produced correctly`, function() {

			it(`with single dictionary step`, function() {
				let expected = new ArrayBuffer(6);
				let bs = new BitStream(expected);

				bs.writeBits(65, 9); // A => 256 [A]
				bs.writeBits(66, 9); // B => 257 [AB]
				bs.writeBits(67, 9); // C => 258 [BC]
				bs.writeBits(68, 9); // D => 259 [CD]
				bs.writeBits(260, 9); // Own codeword
				const input = ['A', 'B', 'C', 'D', 'DD'];

				const contentObscured = handler.obscure(makeU8(input), presets.mbash.params);
				TestUtil.buffersEqual(expected, contentObscured);
			});

			it(`with double dictionary step`, function() {
				let expected = new ArrayBuffer(6);
				let bs = new BitStream(expected);

				bs.writeBits(65, 9); // A => 256 [A]
				bs.writeBits(66, 9); // B => 257 [AB]
				bs.writeBits(67, 9); // C => 258 [BC]
				bs.writeBits(258, 9); // BC => 259 [BC,B]
				bs.writeBits(260, 9); // Own codeword [BCB] => 260 [BCB,B]
				const input = ['A', 'B', 'C', 'BC', 'BCB'];

				const contentObscured = handler.obscure(makeU8(input), presets.mbash.params);
				TestUtil.buffersEqual(expected, contentObscured);
			});

			it(`with triple dictionary step`, function() {
				let expected = new ArrayBuffer(6);
				let bs = new BitStream(expected);

				bs.writeBits(65, 9); // A => 256 [A]
				bs.writeBits(66, 9); // B => 257 [AB]
				bs.writeBits(257, 9); // AB => 258 [B,A]
				bs.writeBits(258, 9); // BA => 259 [AB,B]
				bs.writeBits(260, 9); // Own codeword [BA,B] => 260 [BA,B]
				const input = ['A', 'B', 'AB', 'BA', 'BAB'];

				const contentObscured = handler.obscure(makeU8(input), presets.mbash.params);
				TestUtil.buffersEqual(expected, contentObscured);
			});

			it(`with triple dictionary step and double self-code`, function() {
				let expected = new ArrayBuffer(7);
				let bs = new BitStream(expected);

				bs.writeBits(65, 9); // A => 256 [A]
				bs.writeBits(66, 9); // B => 257 [AB]
				bs.writeBits(257, 9); // AB => 258 [B,A]
				bs.writeBits(258, 9); // BA => 259 [AB,B]
				bs.writeBits(260, 9); // Own codeword [BA,B] => 260 [BA,B]
				bs.writeBits(261, 9); // Own codeword [BAB,B] => 261 [BAB,B]
				const input = ['A', 'B', 'AB', 'BA', 'BAB', 'BABB'];

				const contentObscured = handler.obscure(makeU8(input), presets.mbash.params);
				TestUtil.buffersEqual(expected, contentObscured);
			});

		});
	});

	describe('obscure() then reveal() are lossless', function() {
		Object.keys(presets).forEach(id => {
			const p = presets[id];

			it(`works with ${p.title} settings`, function() {
				const contentObscured = handler.obscure(standardCleartext, p.params);
				const contentRevealed = handler.reveal(contentObscured, p.params);
				TestUtil.buffersEqual(standardCleartext, contentRevealed);
			});
		});
	});
});
