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
			0x05, 0x06, 0x07, 0x08,
			0x09, 0x0A, 0x0B, 0x0C,
			0x0D, 0x0E, 0x0F, 0x10,
		], [
			0x04, 0x00,
			0x04, 0x01, 0x02, 0x03, 0x04,
			0x04, 0x05, 0x06, 0x07, 0x08,
			0x04, 0x09, 0x0A, 0x0B, 0x0C,
			0x04, 0x0D, 0x0E, 0x0F, 0x10,
		]);
	});

	describe('RLE', function() {
		run({
		}, [
			0x01, 0x01, 0x01, 0x01,
			0x05, 0x05, 0x05, 0x05,
			0x09, 0x09, 0x09, 0x09,
			0x0D, 0x0D, 0x0D, 0x0D,
		], [
			0x04, 0x00,
			0x84, 0x01,
			0x84, 0x05,
			0x84, 0x09,
			0x84, 0x0D,
		]);
	});

});
