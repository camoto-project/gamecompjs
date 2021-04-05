/*
 * Extra tests for cmp-rlew-id.
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
import { cmp_rlew_id as handler } from '../index.js';

const md = handler.metadata();
describe(`Extra tests for ${md.title} [${md.id}]`, function() {

	function run(rev, obs, options) {
		const b_rev = Uint8Array.from(rev);
		const b_obs = Uint8Array.from(obs);

		it('decodes correctly', function() {
			const contentRevealed = handler.reveal(b_obs, options);
			TestUtil.buffersEqual(b_rev, contentRevealed);
		});

		it('encodes correctly', function() {
			const contentObscured = handler.obscure(b_rev, options);
			TestUtil.buffersEqual(b_obs, contentObscured);
		});
	}

	describe('RLE trigger is escaped at EOF', function() {
		run([
			0x34,0x12, 0xFE,0xFE,
		], [
			0x34,0x12, 0xFE,0xFE, 0x01,0x00, 0xFE,0xFE,
		]);
	});

	describe('RLE trigger is escaped with trailing data', function() {
		run([
			0x34,0x12, 0xFE,0xFE, 0x00,0x00,
		], [
			0x34,0x12, 0xFE,0xFE, 0x01,0x00, 0xFE,0xFE, 0x00,0x00,
		]);
	});

	describe('RLE ignores two-word sequences', function() {
		run([
			0x34,0x12, 0xAA,0xAA, 0xAA,0xAA,
		], [
			0x34,0x12, 0xAA,0xAA, 0xAA,0xAA,
		]);
	});

	describe('RLE processes four-word sequences', function() {
		run([
			0x34,0x12, 0xAA,0xAA, 0xAA,0xAA, 0xAA,0xAA, 0xAA,0xAA,
		], [
			0x34,0x12, 0xFE,0xFE, 0x04,0x00, 0xAA,0xAA,
		]);
	});

	describe('RLE works on trigger byte', function() {
		run([
			0x34,0x12, 0xFE,0xFE, 0xFE,0xFE, 0xFE,0xFE, 0xFE,0xFE,
		], [
			0x34,0x12, 0xFE,0xFE, 0x04,0x00, 0xFE,0xFE,
		]);
	});

	describe('RLE of 64k words is split with non-RLE trailer', function() {
		run([
			0x34,0x12, ...Array(65535 * 2).fill(0x55), 0x34,0x12,
		], [
			0x34,0x12, 0xFE,0xFE, 0xFF,0xFF, 0x55,0x55, 0x34,0x12,
		]);
	});

	describe('RLE of 64k+1 words is split with RLE trailer', function() {
		run([
			0x34,0x12, ...Array(65535 * 2 + 2).fill(0x55), 0x34,0x12,
		], [
			0x34,0x12, 0xFE,0xFE, 0xFF,0xFF, 0x55,0x55, 0x55,0x55, 0x34,0x12,
		]);
	});

	describe('ending with RLE-escape works', function() {
		run([
			0x34,0x12, 0xFE,0xFE,
		], [
			0x34,0x12, 0xFE,0xFE, 0x01,0x00, 0xFE,0xFE,
		]);
	});

	describe('different RLE trigger works', function() {
		run([
			0x34,0x12, 0xAA,0xAA, 0xAA,0xAA, 0xAA,0xAA, 0xAA,0xAA,
		], [
			0x34,0x12, 0xCD,0xAB, 0x04,0x00, 0xAA,0xAA,
		], {
			code: 0xABCD,
		});
	});

	describe('different RLE trigger (as string) works', function() {
		run([
			0x34,0x12, 0xAA,0xAA, 0xAA,0xAA, 0xAA,0xAA, 0xAA,0xAA,
		], [
			0x34,0x12, 0xCD,0xAB, 0x04,0x00, 0xAA,0xAA,
		], {
			code: '0xABCD',
		});
	});

});
