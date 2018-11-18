/**
 * @file Standard tests.
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

const assert = require('assert');

const TestUtil = require('./util.js');
const standardCleartext = require('./gen-cleartext.js');
const GameCompression = require('../index.js');

// Override the default colours so we can actually see them
var colors = require('mocha/lib/reporters/base').colors;
colors['diff added'] = '1;33';
colors['diff removed'] = '1;31';
colors['green'] = '1;32';
colors['fail'] = '1;31';
colors['error message'] = '1;31';
colors['error stack'] = '1;37';

GameCompression.listHandlers().forEach(handler => {
	const md = handler.metadata();
	let testutil = new TestUtil(md.id);

	describe(`Standard tests for ${md.title} [${md.id}]`, function() {
		let content = {};
		before('load test data from local filesystem', function() {
			content.default = testutil.loadData('default.bin');
		});

		describe('reveal()', function() {
			it('should reveal correctly', function() {
				let contentInput = Buffer.from(content.default);
				const contentRevealed = handler.reveal(contentInput);
				testutil.buffersEqual(standardCleartext, contentRevealed);
				testutil.buffersEqual(content.default, contentInput, 'Input buffer was changed during reveal');
			});
		});

		describe('obscure()', function() {
			it('should obscure correctly', function() {
				// Copy buffer to ensure no changes
				let contentInput = Buffer.from(standardCleartext);
				const contentObscured = handler.obscure(contentInput);
				testutil.buffersEqual(content.default, contentObscured);
				testutil.buffersEqual(standardCleartext, contentInput, 'Input buffer was changed during obscure');
			});
		});

		describe('obscure() then reveal() are lossless', function() {
			it(`should be able to undo own transformation`, function() {
				let contentInput = Buffer.from(standardCleartext);
				const contentObscured = handler.obscure(contentInput);
				const contentRevealed = handler.reveal(contentObscured);
				testutil.buffersEqual(standardCleartext, contentRevealed);
			});
		});
	});
});
