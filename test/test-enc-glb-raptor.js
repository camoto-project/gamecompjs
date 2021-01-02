/*
 * Extra tests for enc-glb-raptor.
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
import { enc_glb_raptor as handler } from '../index.js';

const md = handler.metadata();
let testutil = new TestUtil(md.id);
describe(`Extra tests for ${md.title} [${md.id}]`, function() {

	let content = {};
	before('load test data from local filesystem', function() {
		content.fat = testutil.loadData('fat.bin');
		content.hello = testutil.loadData('hello.bin');
	});

	describe('reveal()', function() {

		it('works with a block size', function() {
			const options = {blockSize: 28};
			const contentRevealed = handler.reveal(content.fat, options);
			TestUtil.buffersEqual(standardCleartext, contentRevealed);
		});

		it('works with a string block size', function() {
			const options = {blockSize: '28'};
			const contentRevealed = handler.reveal(content.fat, options);
			TestUtil.buffersEqual(standardCleartext, contentRevealed);
		});

		it('works with a different key', function() {
			const options = {key: 'Hello'};
			const contentRevealed = handler.reveal(content.hello, options);
			TestUtil.buffersEqual(standardCleartext, contentRevealed);
		});

	});

	describe('obscure()', function() {

		it('works with a block size', function() {
			const options = {blockSize: 28};
			const contentObscured = handler.obscure(standardCleartext, options);
			TestUtil.buffersEqual(content.fat, contentObscured);
		});

		it('works with a string block size', function() {
			const options = {blockSize: '28'};
			const contentObscured = handler.obscure(standardCleartext, options);
			TestUtil.buffersEqual(content.fat, contentObscured);
		});

		it('works with a different key', function() {
			const options = {key: 'Hello'};
			const contentObscured = handler.obscure(standardCleartext, options);
			TestUtil.buffersEqual(content.hello, contentObscured);
		});

	});
});
