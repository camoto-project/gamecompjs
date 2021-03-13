/*
 * Extra tests for pad-generic.
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
import { pad_generic as handler } from '../index.js';

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

	describe('padding with one byte', function() {
		run({
			pass: 4,
			pad: 1,
		}, [
			0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07,
		], [
			0x01, 0x02, 0x03, 0x04, 0x00, 0x05, 0x06, 0x07,
		]);
	});

	describe('padding with two bytes', function() {
		run({
			pass: 4,
			pad: 2,
		}, [
			0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07,
		], [
			0x01, 0x02, 0x03, 0x04, 0x00, 0x00, 0x05, 0x06, 0x07,
		]);
	});

	describe('padding with custom value', function() {
		run({
			pass: 4,
			pad: 2,
			value: 0xFF,
		}, [
			0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07,
		], [
			0x01, 0x02, 0x03, 0x04, 0xFF, 0xFF, 0x05, 0x06, 0x07,
		]);
	});

	describe('no final padding at EOF', function() {
		run({
			pass: 4,
			pad: 1,
		}, [
			0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
		], [
			0x01, 0x02, 0x03, 0x04, 0x00, 0x05, 0x06, 0x07, 0x08,
		]);
	});

	describe('final padding at EOF', function() {
		run({
			pass: 4,
			pad: 1,
			final: 1,
		}, [
			0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
		], [
			0x01, 0x02, 0x03, 0x04, 0x00, 0x05, 0x06, 0x07, 0x08, 0x00,
		]);
	});

	describe('single padding at EOF', function() {
		run({
			pass: 8,
			pad: 1,
			final: 1,
		}, [
			0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
		], [
			0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x00,
		]);
	});

});
