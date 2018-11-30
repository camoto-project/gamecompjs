/**
 * @file Extra tests for enc-glb-raptor.
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

const TestUtil = require('./util.js');
const standardCleartext = require('./gen-cleartext.js');
const GameCompression = require('../index.js');

const handler = GameCompression.getHandler('enc-glb-raptor');
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
			const params = {blockSize: 28};
			const contentRevealed = handler.reveal(content.fat, params);
			TestUtil.buffersEqual(standardCleartext, contentRevealed);
		});

		it('works with a string block size', function() {
			const params = {blockSize: '28'};
			const contentRevealed = handler.reveal(content.fat, params);
			TestUtil.buffersEqual(standardCleartext, contentRevealed);
		});

		it('works with a different key', function() {
			const params = {key: 'Hello'};
			const contentRevealed = handler.reveal(content.hello, params);
			TestUtil.buffersEqual(standardCleartext, contentRevealed);
		});

	});

	describe('obscure()', function() {

		it('works with a block size', function() {
			const params = {blockSize: 28};
			const contentObscured = handler.obscure(standardCleartext, params);
			TestUtil.buffersEqual(content.fat, contentObscured);
		});

		it('works with a string block size', function() {
			const params = {blockSize: '28'};
			const contentObscured = handler.obscure(standardCleartext, params);
			TestUtil.buffersEqual(content.fat, contentObscured);
		});

		it('works with a different key', function() {
			const params = {key: 'Hello'};
			const contentObscured = handler.obscure(standardCleartext, params);
			TestUtil.buffersEqual(content.hello, contentObscured);
		});

	});
});
