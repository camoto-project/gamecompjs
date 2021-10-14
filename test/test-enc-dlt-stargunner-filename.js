/*
 * Extra tests for enc-dlt-stargunner-filename.
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
import { enc_dlt_stargunner_filename as handler } from '../index.js';

const md = handler.metadata();
describe(`Extra tests for ${md.title} [${md.id}]`, function() {

	function run(rev, obs) {
		const b_rev = Uint8Array.from(rev);
		const b_obs = Uint8Array.from(obs);

		it('decodes correctly', function() {
			const contentRevealed = handler.reveal(b_obs);
			TestUtil.buffersEqual(b_rev, contentRevealed);
		});

		it('encodes correctly', function() {
			const contentObscured = handler.obscure(b_rev);
			TestUtil.buffersEqual(b_obs, contentObscured);
		});
	}

	describe('normal filename', function() {
		run([
			0x73, 0x65, 0x74, 0x75, 0x70, 0x2e, 0x70, 0x63,
			0x78, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
			0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
			0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
		], [
			0x73, 0x11, 0x13, 0x02, 0x09, 0x5B, 0x44, 0x14,
			0x13, 0x81, 0x0A, 0x0B, 0x0C, 0x0D, 0x0E, 0x0F,
			0x10, 0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17,
			0x18, 0x19, 0x1A, 0x1B, 0x1C, 0x1D, 0x1E, 0x1F,
		]);
	});

	describe('short filename with embedded null', function() {
		run([
			0x64, 0x65, 0x6d, 0x6f, 0x30, 0x31, 0x2e, 0x72,
			0x65, 0x63,
		], [
			0x64, 0x00, 0x0A, 0x1F, 0x43, 0x04, 0x19, 0x47,
			0x1F, 0x0D,
		]);
	});

});
