/*
 * Extra tests for cmp-lzss.
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
import TestUtil from './util.js';
import standardCleartext from './gen-cleartext.js';
import { cmp_lzss as handler } from '../index.js';

const md = handler.metadata();
let testutil = new TestUtil(md.id);
describe(`Extra tests for ${md.title} [${md.id}]`, function() {

	let content = {};
	let presets = {
		'default': {
			title: 'default',
			options: {
				// defaults
			},
		},
		indy500: {
			title: 'Indy 500',
			options: {
				bitstream: false,
				invertFlag: true,
				lengthHigh: false,
				littleEndian: false,
				minDistance: 0,
				minLen: 3,
				offsetRotate: 8,
				prefillByte: 0x20,
				relativeDistance: false,
				sizeDistance: 12,
				sizeLength: 4,
				windowStartAt0: false,
			},
		},
		lostvikings: {
			title: 'Lost Vikings',
			options: {
				bitstream: false,
				invertFlag: true,
				lengthHigh: true,
				littleEndian: true,
				minDistance: 0,
				minLen: 3,
				offsetRotate: 0,
				prefillByte: 0x00,
				relativeDistance: false,
				sizeDistance: 12,
				sizeLength: 4,
				windowStartAt0: true,
			},
		},
		nomad: {
			title: 'Nomad',
			options: {
				bitstream: false,
				invertFlag: true,
				lengthHigh: true,
				littleEndian: true,
				minDistance: 0,
				minLen: 3,
				offsetRotate: 0,
				prefillByte: 0x20,
				relativeDistance: false,
				sizeDistance: 12,
				sizeLength: 4,
				windowStartAt0: false,
			},
		},
		prehistorik: {
			title: 'Prehistorik',
			options: {
				bitstream: true,
				invertFlag: false,
				lengthHigh: true,
				littleEndian: false,
				minDistance: 1,
				minLen: 2,
				offsetRotate: 0,
				prefillByte: 0x00,
				relativeDistance: true,
				sizeDistance: 8,
				sizeLength: 2,
				windowStartAt0: true,
			},
		},
	};
	before('load test data from local filesystem', function() {
		content = testutil.loadContent(handler, [
			'default',
			'indy500',
			'lostvikings',
			'nomad',
			'prehistorik',
		]);
	});

	describe('reveal()', function() {
		Object.keys(presets).forEach(id => {
			const p = presets[id];

			it(`works with ${p.title} settings`, function() {
				assert.notEqual(content[id].main, null, `Content for ${p.title} is null`);
				assert.notEqual(content[id].main, undefined, `Content for ${p.title} is undefined`);

				let contentRevealed = handler.reveal(content[id].main, p.options);

				// Because there must be flags padded up to the next byte, there is
				// always trailing data we have to chop off.
				contentRevealed = contentRevealed.slice(0, standardCleartext.length);

				TestUtil.buffersEqual(standardCleartext, contentRevealed);
			});
		});

		// Some formats will go back beyond the start of the window for 0x00 bytes.
		// Confirm 1) this works, 2) the prefill byte is used, and 3) the prefill
		// byte still works when it's zero.
		it(`works with lookbacks beyond start of new window`, function() {
			const b_obs = Uint8Array.from([
				0xFE, 0xFD, 0x0F, 0x01,
			]);
			const b_rev = Uint8Array.from([
				0x00, 0x00, 0x00, 0x01,
			]);

			let contentRevealed = handler.reveal(b_obs, presets.lostvikings.options);

			// Because there must be flags padded up to the next byte, there is
			// always trailing data we have to chop off.
			contentRevealed = contentRevealed.slice(0, b_rev.length);

			TestUtil.buffersEqual(b_rev, contentRevealed);
		});
	});

	describe('obscure()', function() {
		Object.keys(presets).forEach(id => {
			const p = presets[id];

			it(`works with ${p.title} settings`, function() {
				assert.notEqual(content[id].main, null, `Content for ${p.title} is null`);
				assert.notEqual(content[id].main, undefined, `Content for ${p.title} is undefined`);

				const contentObscured = handler.obscure(standardCleartext, p.options);
				TestUtil.buffersEqual(content[id].main, contentObscured);
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
					let contentRevealed = handler.reveal(contentObscured, p.options);

					// Because there must be flags padded up to the next byte, there is
					// always trailing data we have to chop off.
					contentRevealed = contentRevealed.slice(0, standardCleartext.length);

					TestUtil.buffersEqual(standardCleartext, contentRevealed);
				});

				it(`enough data to exceed window size`, function() {
					let u8input = new Uint8Array(9216);
					for (let i = 0; i < u8input.length; i++) {
						u8input[i] = ((i*5) & 0xFF) ^ (i >> 5);
					}

					const contentObscured = handler.obscure(u8input, p.options);
					let contentRevealed = handler.reveal(contentObscured, p.options);

					// Because there must be flags padded up to the next byte, there is
					// always trailing data we have to chop off.
					contentRevealed = contentRevealed.slice(0, u8input.length);

					TestUtil.buffersEqual(u8input, contentRevealed);
				});

				// Confirm the lookback is limited to the maximum length.
				it(`compressible data larger than the maximum length`, function() {
					const ct = new Uint8Array(32).fill(65);
					const contentObscured = handler.obscure(ct, p.options);
					let contentRevealed = handler.reveal(contentObscured, p.options);

					// Because there must be flags padded up to the next byte, there is
					// always trailing data we have to chop off.
					contentRevealed = contentRevealed.slice(0, ct.length);

					TestUtil.buffersEqual(ct, contentRevealed);
				});

			});
		});
	});

});
