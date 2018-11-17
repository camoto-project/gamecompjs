/**
 * @brief Extra tests for cmp-rle-bash.
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
const GameCompression = require('../index.js');

const handler = GameCompression.getHandler('cmp-rle-bash');
const md = handler.metadata();
let testutil = new TestUtil(md.id);
describe(`Extra tests for ${md.title} [${md.id}]`, function() {

	function run(rev, obs) {
		const b_rev = Buffer.from(rev);
		const b_obs = Buffer.from(obs);

		it('decodes correctly', function() {
			const contentRevealed = handler.reveal(b_obs);
			testutil.buffersEqual(b_rev, contentRevealed);
		});

		it('encodes correctly', function() {
			const contentObscured = handler.obscure(b_rev);
			testutil.buffersEqual(b_obs, contentObscured);
		});
	}

	describe('zero run-length escapes RLE trigger', function() {
		run([
			0x12, 0x90, 0x34,
		], [
			0x12, 0x90, 0x00, 0x34,
		]);
	});

	describe('RLE ignores two-byte sequences', function() {
		run([
			0x12, 0x55, 0x55, 0x34,
		], [
			0x12, 0x55, 0x55, 0x34,
		]);
	});

	describe('RLE processes three-byte sequences', function() {
		run([
			0x12, 0x55, 0x55, 0x55, 0x34,
		], [
			0x12, 0x55, 0x90, 0x03, 0x34,
		]);
	});

	describe('RLE works on trigger byte', function() {
		run([
			0x12, 0x90, 0x90, 0x90, 0x34,
		], [
			0x12, 0x90, 0x00, 0x90, 0x03, 0x34,
		]);
	});

	describe('RLE of 256 chars is split with non-RLE trailer', function() {
		run([
			0x12, ...Array(256).fill(0x55), 0x34,
		], [
			0x12, 0x55, 0x90, 0xFF, 0x55, 0x34,
		]);
	});

	describe('RLE of 257 chars is split with RLE trailer', function() {
		run([
			0x12, ...Array(257).fill(0x55), 0x34,
		], [
			0x12, 0x55, 0x90, 0xFF, 0x90, 0x03, 0x34,
		]);
	});

	describe('ending with RLE-escape works', function() {
		run([
			0x12, 0x90,
		], [
			0x12, 0x90, 0x00,
		]);
	});

	describe('ending with RLE run works', function() {
		run([
			0x12, 0x55, 0x55, 0x55,
		], [
			0x12, 0x55, 0x90, 0x03,
		]);
	});
});
