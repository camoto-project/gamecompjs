/*
 * Extra tests for cmp-lzw.
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

import assert from 'assert';
import { BitStream } from 'bit-buffer';
import TestUtil from './util.js';
import standardCleartext from './gen-cleartext.js';
import { cmp_lzw as handler } from '../index.js';

function makeU8(as) {
	let s = as.join('');
	let ab = new ArrayBuffer(s.length);
	let u8 = new Uint8Array(ab);
	for (let i = 0; i < s.length; i++) {
		u8[i] = s.charCodeAt(i);
	}
	return u8;
}

const md = handler.metadata();
let testutil = new TestUtil(md.id);
describe(`Extra tests for ${md.title} [${md.id}]`, function() {

	let content = {};
	let presets = {
		lionking: {
			title: 'Lion King',
			options: {
				initialBits: 9,
				maxBits: 14,
				cwEOF: -1,    // max codeword
				cwDictReset: -2,  // max-1
				cwFirst: 256,
				bigEndian: true,
				flushOnReset: false,
			}
		},
		mbash: {
			title: 'Monster Bash',
			options: {
				initialBits: 9,
				maxBits: 12,
				cwEOF: undefined,//256?
				cwDictReset: undefined,//256?
				cwFirst: 257,
				bigEndian: false,
				flushOnReset: false,
			}
		},
		/*
		sierra: {
			title: 'Sierra',
			options: {
				initialBits: 9,
				maxBits: 9,
				cwEOF: 257,
				cwDictReset: 256,
				cwFirst: 258,
				bigEndian: false,
				flushOnReset: false,
			}
		},
		stellar7: {
			title: 'Stellar 7',
			options: {
				initialBits: 9,
				maxBits: 12,
				cwEOF: undefined,
				cwDictReset: 256,
				cwFirst: 257,
				bigEndian: false,
				flushOnReset: true,
			}
		},
		*/
	};
	before('load test data from local filesystem', function() {
		content = testutil.loadContent(handler, [
			'default.bin',
			'lionking.bin',
			'mbash.bin',
		]);
	});

	describe('reveal()', function() {
		Object.keys(presets).forEach(id => {
			const p = presets[id];

			it(`works with ${p.title} settings`, function() {
				assert.notEqual(content[`${id}.bin`].main, null, `Content for ${p.title} is null`);
				assert.notEqual(content[`${id}.bin`].main, undefined, `Content for ${p.title} is undefined`);

				const contentRevealed = handler.reveal(content[`${id}.bin`].main, p.options);
				TestUtil.buffersEqual(standardCleartext, contentRevealed);
			});
		});

		describe(`self-referencing codewords are handled correctly`, function() {

			it(`with single dictionary step`, function() {
				let input = new ArrayBuffer(6);
				let bs = new BitStream(input);

				bs.writeBits(65, 9);  // A => 256 [A]
				bs.writeBits(66, 9);  // B => 257 [AB]
				bs.writeBits(67, 9);  // C => 258 [BC]
				bs.writeBits(68, 9);  // D => 259 [CD]
				bs.writeBits(260, 9); // Own codeword
				const expected = ['A', 'B', 'C', 'D', 'DD'];

				const contentRevealed = handler.reveal(new Uint8Array(input), presets.mbash.options);
				TestUtil.buffersEqual(makeU8(expected), contentRevealed);
			});

			it(`with double dictionary step`, function() {
				let input = new ArrayBuffer(6);
				let bs = new BitStream(input);

				bs.writeBits(65, 9);  // A => 256 [A]
				bs.writeBits(66, 9);  // B => 257 [AB]
				bs.writeBits(67, 9);  // C => 258 [BC]
				bs.writeBits(258, 9); // BC => 259 [BC,B]
				bs.writeBits(260, 9); // Own codeword [BCB] => 260 [BCB,B]
				const expected = ['A', 'B', 'C', 'BC', 'BCB'];

				const contentRevealed = handler.reveal(new Uint8Array(input), presets.mbash.options);
				TestUtil.buffersEqual(makeU8(expected), contentRevealed);
			});

			it(`with triple dictionary step`, function() {
				let input = new ArrayBuffer(6);
				let bs = new BitStream(input);

				bs.writeBits(65, 9);  // A => 256 [A]
				bs.writeBits(66, 9);  // B => 257 [AB]
				bs.writeBits(257, 9); // AB => 258 [B,A]
				bs.writeBits(258, 9); // BA => 259 [AB,B]
				bs.writeBits(260, 9); // Own codeword [BA,B] => 260 [BA,B]
				const expected = ['A', 'B', 'AB', 'BA', 'BAB'];

				const contentRevealed = handler.reveal(new Uint8Array(input), presets.mbash.options);
				TestUtil.buffersEqual(makeU8(expected), contentRevealed);
			});

			it(`with triple dictionary step and double self-code`, function() {
				let input = new ArrayBuffer(7);
				let bs = new BitStream(input);

				bs.writeBits(65, 9);  // A => 256 [A]
				bs.writeBits(66, 9);  // B => 257 [AB]
				bs.writeBits(257, 9); // AB => 258 [B,A]
				bs.writeBits(258, 9); // BA => 259 [AB,B]
				bs.writeBits(260, 9); // Own codeword [BA,B] => 260 [BA,B]
				bs.writeBits(261, 9); // Own codeword [BAB,B] => 261 [BAB,B]
				const expected = ['A', 'B', 'AB', 'BA', 'BAB', 'BABB'];

				const contentRevealed = handler.reveal(new Uint8Array(input), presets.mbash.options);
				TestUtil.buffersEqual(makeU8(expected), contentRevealed);
			});

			it(`with single dictionary step, double self-code and 0x00 value`, function() {
				let input = new ArrayBuffer(7);
				let bs = new BitStream(input);

				bs.writeBits(65, 9);  // A => 256 [A]
				bs.writeBits(66, 9);  // B => 257 [AB]
				bs.writeBits(0, 9);   // 0 => 258 [B,0]
				bs.writeBits(259, 9); // Own codeword [0,0] => 259 [0,0]
				bs.writeBits(260, 9); // Own codeword [00,0] => 260 [00,0]
				bs.writeBits(67, 9);  // Trailer to ensure nulls aren't lost
				const expected = ['A', 'B', '\u0000', '\u0000\u0000', '\u0000\u0000\u0000', 'C'];

				const contentRevealed = handler.reveal(new Uint8Array(input), presets.mbash.options);
				TestUtil.buffersEqual(makeU8(expected), contentRevealed);
			});

		});
	});

	describe('obscure()', function() {
		Object.keys(presets).forEach(id => {
			const p = presets[id];

			it(`works with ${p.title} settings`, function() {
				assert.notEqual(content[`${id}.bin`].main, null, `Content for ${p.title} is null`);
				assert.notEqual(content[`${id}.bin`].main, undefined, `Content for ${p.title} is undefined`);

				const contentObscured = handler.obscure(standardCleartext, p.options);
				TestUtil.buffersEqual(content[`${id}.bin`].main, contentObscured);
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

				const contentObscured = handler.obscure(makeU8(input), presets.mbash.options);
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

				const contentObscured = handler.obscure(makeU8(input), presets.mbash.options);
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

				const contentObscured = handler.obscure(makeU8(input), presets.mbash.options);
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

				const contentObscured = handler.obscure(makeU8(input), presets.mbash.options);
				TestUtil.buffersEqual(expected, contentObscured);
			});

		});
	});

	describe('obscure() then reveal() are lossless', function() {
		Object.keys(presets).forEach(id => {
			const p = presets[id];

			describe(`with ${p.title} settings`, function() {

				// Only the default settings are covered by the default tests, so run this
				// one again with different options.
				it(`standard content`, function() {
					const contentObscured = handler.obscure(standardCleartext, p.options);
					const contentRevealed = handler.reveal(contentObscured, p.options);
					TestUtil.buffersEqual(standardCleartext, contentRevealed);
				});

				it(`enough data to hit dictionary limit`, function() {
					let u8input = new Uint8Array(7168);
					for (let i = 0; i < u8input.length; i++) {
						u8input[i] = ((i*5) & 0xFF) ^ (i >> 5);
					}

					const contentObscured = handler.obscure(u8input, p.options);
					const contentRevealed = handler.reveal(contentObscured, p.options);
					TestUtil.buffersEqual(u8input, contentRevealed);
				});

			});
		});
	});
});
