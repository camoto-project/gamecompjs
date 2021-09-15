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
		papyrus: {
			title: 'Papyrus',
			options: {
				// defaults
			},
		},
		lostvikings: {
			title: 'Lost Vikings',
			options: {
				sizeLength: 4,
				minLen: 3,
				prefillByte: 0,
				lengthFieldInHighBits: true,
				windowStartAt0: true,
				splitMethod: 1,
			},
		},
	};
	before('load test data from local filesystem', function() {
		content = testutil.loadContent(handler, [
			'default',
			'lostvikings',
			'papyrus',
		]);
	});

	describe('reveal()', function() {
		Object.keys(presets).forEach(id => {
			const p = presets[id];

			it(`works with ${p.title} settings`, function() {
				assert.notEqual(content[id].main, null, `Content for ${p.title} is null`);
				assert.notEqual(content[id].main, undefined, `Content for ${p.title} is undefined`);

				const contentRevealed = handler.reveal(content[id].main, p.options);
				TestUtil.buffersEqual(standardCleartext, contentRevealed);
			});
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
					const contentRevealed = handler.reveal(contentObscured, p.options);
					TestUtil.buffersEqual(standardCleartext, contentRevealed);
				});

				it(`enough data to exceed window size`, function() {
					let u8input = new Uint8Array(9216);
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
