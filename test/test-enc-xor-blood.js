/*
 * Extra tests for enc-xor-blood.
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
import { enc_xor_blood as handler } from '../index.js';

const md = handler.metadata();
let testutil = new TestUtil(md.id);
describe(`Extra tests for ${md.title} [${md.id}]`, function() {

	let content = {};
	before('load test data from local filesystem', function() {
		content = testutil.loadContent(handler, [
			'default-full',
			'default-v300',
			'seed4f',
			'seed4f-v300',
		]);
	});

	describe('reveal()', function() {

		it('works with a different seed', function() {
			const options = {seed: 0x4f};
			const contentRevealed = handler.reveal(content['seed4f'].main, options);
			TestUtil.buffersEqual(standardCleartext, contentRevealed);
		});

		it('works with a string seed', function() {
			const options = {seed: '0x4f'};
			const contentRevealed = handler.reveal(content['seed4f'].main, options);
			TestUtil.buffersEqual(standardCleartext, contentRevealed);
		});

		it('works with a different offset', function() {
			const options = {offset: 1};
			const contentRevealed = handler.reveal(content['default-v300'].main, options);
			TestUtil.buffersEqual(standardCleartext, contentRevealed);
		});

		it('works with a different offset and seed', function() {
			const options = {offset: 1, seed: 0x4f};
			const contentRevealed = handler.reveal(content['seed4f-v300'].main, options);
			TestUtil.buffersEqual(standardCleartext, contentRevealed);
		});

		it('does the full file when limit=0', function() {
			const options = {limit: 0};
			const contentRevealed = handler.reveal(content['default-full'].main, options);
			TestUtil.buffersEqual(standardCleartext, contentRevealed);
		});

	});

	describe('obscure()', function() {

		it('works with a different seed', function() {
			const options = {seed: 0x4f};
			const contentObscured = handler.obscure(standardCleartext, options);
			TestUtil.buffersEqual(content['seed4f'].main, contentObscured);
		});

		it('works with a string seed', function() {
			const options = {seed: '0x4f'};
			const contentObscured = handler.obscure(standardCleartext, options);
			TestUtil.buffersEqual(content['seed4f'].main, contentObscured);
		});

	});
});
