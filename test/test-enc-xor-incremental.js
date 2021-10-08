/*
 * Extra tests for enc-xor-incremental.
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

import TestUtil from './util.js';
import standardCleartext from './gen-cleartext.js';
import { enc_xor_incremental as handler } from '../index.js';

const md = handler.metadata();
let testutil = new TestUtil(md.id);
describe(`Extra tests for ${md.title} [${md.id}]`, function() {

	let content = {};
	before('load test data from local filesystem', function() {
		content = testutil.loadContent(handler, [
			'gotfat.bin',
			'string.bin',
		]);
	});

	describe('reveal()', function() {

		it('works with God of Thunder FAT parameters', function() {
			const options = {
				seed: 0x80,
				limit: 0,
				step: 1,
			};
			const contentRevealed = handler.reveal(content['gotfat.bin'].main, options);
			TestUtil.buffersEqual(standardCleartext, contentRevealed);
		});

		it('works with string parameters', function() {
			const options = {
				seed: '0x4f',
				step: '255',
				limit: '64',
			};
			const contentRevealed = handler.reveal(content['string.bin'].main, options);
			TestUtil.buffersEqual(standardCleartext, contentRevealed);
		});

	});

	describe('obscure()', function() {

		it('works with God of Thunder FAT settings', function() {
			const options = {
				seed: 0x80,
				limit: 0,
				step: 1,
			};
			const contentObscured = handler.obscure(standardCleartext, options);
			TestUtil.buffersEqual(content['gotfat.bin'].main, contentObscured);
		});

		it('works with a string seed', function() {
			const options = {
				seed: '0x4f',
				step: '255',
				limit: '64',
			};
			const contentObscured = handler.obscure(standardCleartext, options);
			TestUtil.buffersEqual(content['string.bin'].main, contentObscured);
		});

	});
});
