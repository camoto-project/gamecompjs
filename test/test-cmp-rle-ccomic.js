/*
 * Extra tests for cmp-rle-ccomic.
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
import { cmp_rle_ccomic as handler } from '../index.js';

const md = handler.metadata();
describe(`Extra tests for ${md.title} [${md.id}]`, function() {

	function run(opt, rev, obs) {
		const b_rev = Uint8Array.from(rev);
		const b_obs = Uint8Array.from(obs);

		it('decodes correctly', function() {
			const contentRevealed = handler.reveal(b_obs, opt);
			TestUtil.buffersEqual(b_rev, contentRevealed);
		});

		it('encodes correctly', function() {
			const contentObscured = handler.obscure(b_rev, opt);
			TestUtil.buffersEqual(b_obs, contentObscured);
		});
	}

	describe('pass', function() {
		run({
		}, [
			0x01, 0x02, 0x03, 0x04,
		], [
			0x04, 0x01, 0x02, 0x03, 0x04,
		]);
	});

	describe('shortest RLE', function() {
		run({
		}, [
			0x01, 0x01,
		], [
			0x82, 0x01,
		]);
	});

	describe('RLE, RLE', function() {
		run({
		}, [
			0x01, 0x01, 0x01, 0x03, 0x03, 0x03, 0x03, 0x03,
		], [
			0x83, 0x01,
			0x85, 0x03,
		]);
	});

	describe('pass, RLE', function() {
		run({
		}, [
			0x01, 0x02, 0x03, 0x03, 0x03,
		], [
			0x02, 0x01, 0x02,
			0x83, 0x03,
		]);
	});

	describe('RLE, pass', function() {
		run({
		}, [
			0x03, 0x03, 0x03, 0x01, 0x02,
		], [
			0x83, 0x03,
			0x02, 0x01, 0x02
		]);
	});

	describe('RLE, pass, RLE', function() {
		run({
		}, [
			0x01, 0x01, 0x01, 0xFF, 0x03, 0x03, 0x03, 0x03, 0x03,
		], [
			0x83, 0x01,
			0x01, 0xFF,
			0x85, 0x03,
		]);
	});

	describe('pass, RLE, pass', function() {
		run({
		}, [
			0x01, 0x02, 0x02, 0x02, 0x03,
		], [
			0x01, 0x01,
			0x83, 0x02, 0x01, 0x03,
		]);
	});

	describe('shortest-RLE, shortest-RLE', function() {
		run({
		}, [
			0x01, 0x01, 0x03, 0x03,
		], [
			0x82, 0x01, 0x82, 0x03,
		]);
	});

	describe('max-RLE', function() {
		run({
		}, [
			...Array(127).fill(0x01),
		], [
			0xFF, 0x01,
		]);
	});

	describe('max-RLE, 1-leftover (to pass)', function() {
		run({
		}, [
			...Array(127+1).fill(0x01),
		], [
			0xFF, 0x01,
			0x01, 0x01,
		]);
	});

	describe('max-RLE, 3-leftover (to RLE)', function() {
		run({
		}, [
			...Array(127+3).fill(0x01),
		], [
			0xFF, 0x01,
			0x83, 0x01,
		]);
	});

	describe('2x-max-RLE', function() {
		run({
		}, [
			...Array(127*2).fill(0x01),
		], [
			0xFF, 0x01,
			0xFF, 0x01,
		]);
	});

	describe('2x-max-RLE, 1-leftover (to pass)', function() {
		run({
		}, [
			...Array(127*2+1).fill(0x01),
		], [
			0xFF, 0x01,
			0xFF, 0x01,
			0x01, 0x01,
		]);
	});

	describe('max-pass', function() {
		let nonrepeat = Array(127).fill(0x01);
		for (let i = 0; i < nonrepeat.length; i += 2) nonrepeat[i] = 0x02;
		run({
		}, [
			...nonrepeat,
		], [
			0x7F, ...nonrepeat,
		]);
	});

	describe('max-pass, 1-leftover', function() {
		let nonrepeat = Array(127).fill(0x10);
		for (let i = 0; i < nonrepeat.length; i += 2) nonrepeat[i] = 0x20;
		run({
		}, [
			...nonrepeat, 0x10,
		], [
			0x7F, ...nonrepeat, 0x01, 0x10,
		]);
	});

	describe('max-pass, 2-leftover', function() {
		let nonrepeat = Array(127).fill(0x10);
		for (let i = 0; i < nonrepeat.length; i += 2) nonrepeat[i] = 0x20;
		run({
		}, [
			...nonrepeat, 0x30, 0x40,
		], [
			0x7F, ...nonrepeat, 0x02, 0x30, 0x40,
		]);
	});

	describe('outputLength limit', function() {
		const b_rev = Uint8Array.from([0x01, 0x02, 0x03, 0x04]);
		const b_obs = Uint8Array.from([0x04, 0x01, 0x02, 0x03, 0x04, 0x03, 0x05, 0x06, 0x07]);

		it('decodes correctly', function() {
			const contentRevealed = handler.reveal(b_obs, { outputLength: 4 });
			TestUtil.buffersEqual(b_rev, contentRevealed);
		});
	});

});
