/*
 * Extra tests for cmp-rle-id.
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
import { cmp_rle_id as handler } from '../index.js';

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
			0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07,
		], [
			0x86, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07,
		]);
	});

	describe('RLE', function() {
		run({
		}, [
			0x01, 0x01, 0x01,
		], [
			0x00, 0x01,
		]);
	});

	describe('RLE, RLE', function() {
		run({
		}, [
			0x01, 0x01, 0x01, 0x03, 0x03, 0x03, 0x03, 0x03,
		], [
			0x00, 0x01, 0x02, 0x03,
		]);
	});

	describe('pass, RLE', function() {
		run({
		}, [
			0x01, 0x02, 0x03, 0x03, 0x03,
		], [
			0x81, 0x01, 0x02, 0x00, 0x03,
		]);
	});

	describe('RLE, pass', function() {
		run({
		}, [
			0x03, 0x03, 0x03, 0x01, 0x02,
		], [
			0x00, 0x03, 0x81, 0x01, 0x02
		]);
	});

	describe('RLE, pass, RLE', function() {
		run({
		}, [
			0x01, 0x01, 0x01, 0xFF, 0x03, 0x03, 0x03, 0x03, 0x03,
		], [
			0x00, 0x01, 0x80, 0xFF, 0x02, 0x03,
		]);
	});

	describe('pass, RLE, pass', function() {
		run({
		}, [
			0x01, 0x02, 0x02, 0x02, 0x03,
		], [
			0x80, 0x01, 0x00, 0x02, 0x80, 0x03,
		]);
	});

	describe('insufficient-RLE, RLE', function() {
		run({
		}, [
			0x01, 0x01, 0x03, 0x03, 0x03, 0x03, 0x03,
		], [
			0x81, 0x01, 0x01, 0x02, 0x03,
		]);
	});

	describe('insufficient-RLE, insufficient-RLE', function() {
		run({
		}, [
			0x01, 0x01, 0x03, 0x03,
		], [
			0x83, 0x01, 0x01, 0x03, 0x03,
		]);
	});

	describe('127-RLE', function() {
		run({
		}, [
			...Array(127).fill(0x01),
		], [
			0x7C, 0x01,
		]);
	});

	describe('max-RLE', function() {
		run({
		}, [
			...Array(130).fill(0x01),
		], [
			0x7F, 0x01,
		]);
	});

	describe('max-RLE, 1-leftover (to pass)', function() {
		run({
		}, [
			...Array(131).fill(0x01),
		], [
			0x7F, 0x01, 0x80, 0x01,
		]);
	});

	describe('max-RLE, 3-leftover (to RLE)', function() {
		run({
		}, [
			...Array(133).fill(0x01),
		], [
			0x7F, 0x01, 0x00, 0x01,
		]);
	});

	describe('2x-max-RLE', function() {
		run({
		}, [
			...Array(130*2).fill(0x01),
		], [
			0x7F, 0x01, 0x7F, 0x01,
		]);
	});

	describe('2x-max-RLE, 1-leftover (to pass)', function() {
		run({
		}, [
			...Array(130*2+1).fill(0x01),
		], [
			0x7F, 0x01, 0x7F, 0x01, 0x80, 0x01,
		]);
	});

	describe('max-pass', function() {
		let nonrepeat = Array(128).fill(0x01);
		for (let i = 0; i < nonrepeat.length; i += 2) nonrepeat[i] = 0x02;
		run({
		}, [
			...nonrepeat,
		], [
			0xFF, ...nonrepeat,
		]);
	});

	describe('max-pass, 1-leftover', function() {
		let nonrepeat = Array(128).fill(0x01);
		for (let i = 0; i < nonrepeat.length; i += 2) nonrepeat[i] = 0x02;
		let nonrepeat2 = Array(1).fill(0x01);
		for (let i = 0; i < nonrepeat2.length; i += 2) nonrepeat2[i] = 0x02;
		run({
		}, [
			...nonrepeat, ...nonrepeat2,
		], [
			0xFF, ...nonrepeat, 0x80, ...nonrepeat2,
		]);
	});

	describe('max-pass, 2-leftover', function() {
		let nonrepeat = Array(128).fill(0x01);
		for (let i = 0; i < nonrepeat.length; i += 2) nonrepeat[i] = 0x02;
		let nonrepeat2 = Array(2).fill(0x01);
		for (let i = 0; i < nonrepeat2.length; i += 2) nonrepeat2[i] = 0x02;
		run({
		}, [
			...nonrepeat, ...nonrepeat2,
		], [
			0xFF, ...nonrepeat, 0x81, ...nonrepeat2,
		]);
	});

	describe('RLE RLE-code', function() {
		run({
		}, [
			0x80, 0x80, 0x80,
		], [
			0x00, 0x80,
		]);
	});

	describe('outputLength limit', function() {
		const b_rev = Uint8Array.from([0x01, 0x02, 0x03, 0x04]);
		const b_obs = Uint8Array.from([0x83, 0x01, 0x02, 0x03, 0x04, 0x82, 0x05, 0x06, 0x07]);

		it('decodes correctly', function() {
			const contentRevealed = handler.reveal(b_obs, { outputLength: 4 });
			TestUtil.buffersEqual(b_rev, contentRevealed);
		});
	});

	describe('chunk length - no extra bytes', function() {
		let obs = [];
		for (let i = 0; i < 502; i++) {
			obs.push(0x7F); // repeat 130 times
			obs.push(0x01); // value to repeat
		}
		let rev = Array(130 * 502).fill(0x01);
		run({
			chunkLength: 0xFF00,
		}, [
			...rev, // 0xFEEC length
			0x02, 0x02, 0x02, 0x02, 0x02, 0x02, 0x02, 0x02,
			0x02, 0x02, 0x02, 0x02, 0x02, 0x02, 0x02, 0x02,
			0x02, 0x02, 0x02, // 0xFEFF length
			0x02, // 0xFF00 length
		], [
			...obs,
			0x11, 0x02,
		]);
	});

	describe('chunk length - one extra byte', function() {
		let obs = [];
		for (let i = 0; i < 502; i++) {
			obs.push(0x7F); // repeat 130 times
			obs.push(0x01); // value to repeat
		}
		let rev = Array(130 * 502).fill(0x01);
		run({
			chunkLength: 0xFF00,
		}, [
			...rev, // 0xFEEC length
			0x02, 0x02, 0x02, 0x02, 0x02, 0x02, 0x02, 0x02,
			0x02, 0x02, 0x02, 0x02, 0x02, 0x02, 0x02, 0x02,
			0x02, 0x02, 0x02, // 0xFEFF length
			0x02, // 0xFF00 length
			0x02,
		], [
			...obs,
			0x11, 0x02, // this RLE could should break at the boundary
			0x80, 0x02,
		]);
	});

	describe('chunk length - two extra bytes', function() {
		let obs = [];
		for (let i = 0; i < 502; i++) {
			obs.push(0x7F); // repeat 130 times
			obs.push(0x01); // value to repeat
		}
		let rev = Array(130 * 502).fill(0x01);
		run({
			chunkLength: 0xFF00,
		}, [
			...rev, // 0xFEEC length
			0x02, 0x02, 0x02, 0x02, 0x02, 0x02, 0x02, 0x02,
			0x02, 0x02, 0x02, 0x02, 0x02, 0x02, 0x02, 0x02,
			0x02, 0x02, 0x02, // 0xFEFF length
			0x02, // 0xFF00 length
			0x02, 0x02,
		], [
			...obs,
			0x11, 0x02, // this RLE could should break at the boundary
			0x81, 0x02, 0x02,
		]);
	});

	describe('chunk length - one extra byte, crossing boundary, no truncate', function() {
		let obs = [];
		for (let i = 0; i < 502; i++) {
			obs.push(0x7F); // repeat 130 times
			obs.push(0x01); // value to repeat
		}
		obs.push(...[
			0x12, 0x02, // crosses boundary
			0x80, 0x03, // should overwrite byte that crossed boundary
		]);

		let rev = [
			...Array(130 * 502).fill(0x01), // 0xFEEC length
			0x02, 0x02, 0x02, 0x02, 0x02, 0x02, 0x02, 0x02,
			0x02, 0x02, 0x02, 0x02, 0x02, 0x02, 0x02, 0x02,
			0x02, 0x02, 0x02, // 0xFEFF length
			0x02, // 0xFF00 length
			//0x02, // should get overwritten
			0x03,
		];

		const b_rev = Uint8Array.from(rev);
		const b_obs = Uint8Array.from(obs);

		it('decodes correctly', function() {
			const contentRevealed = handler.reveal(b_obs, {
				chunkLength: 0xFF00,
			});
			TestUtil.buffersEqual(b_rev, contentRevealed);
		});
	});

	describe('chunk length - one extra byte, crossing boundary, truncate', function() {
		let obs = [];
		for (let i = 0; i < 502; i++) {
			obs.push(0x7F); // repeat 130 times
			obs.push(0x01); // value to repeat
		}
		obs.push(...[
			0x12, 0x02, // crosses boundary
			0x80, 0x03, // should overwrite byte that crossed boundary
		]);

		let rev = [
			...Array(130 * 502).fill(0x01), // 0xFEEC length
			0x02, 0x02, 0x02, 0x02, 0x02, 0x02, 0x02, 0x02,
			0x02, 0x02, 0x02, 0x02, 0x02, 0x02, 0x02, 0x02,
			0x02, 0x02, 0x02, // 0xFEFF length
			0x02, // 0xFF00 length
			//0x02, // should get overwritten
			0x03,
		];

		const b_rev = Uint8Array.from(rev);
		const b_obs = Uint8Array.from(obs);

		it('decodes correctly', function() {
			const contentRevealed = handler.reveal(b_obs, {
				chunkLength: 0xFF00,
				outputLength: 0xFF01,
			});
			TestUtil.buffersEqual(b_rev, contentRevealed);
		});
	});

	describe('chunk length - two extra bytes, crossing boundary, no truncate', function() {
		let obs = [];
		for (let i = 0; i < 502; i++) {
			obs.push(0x7F); // repeat 130 times
			obs.push(0x01); // value to repeat
		}
		obs.push(...[
			0x13, 0x02, // crosses boundary
			0x80, 0x03, // should overwrite byte that crossed boundary and drop following byte
		]);

		let rev = [
			...Array(130 * 502).fill(0x01), // 0xFEEC length
			0x02, 0x02, 0x02, 0x02, 0x02, 0x02, 0x02, 0x02,
			0x02, 0x02, 0x02, 0x02, 0x02, 0x02, 0x02, 0x02,
			0x02, 0x02, 0x02, // 0xFEFF length
			0x02, // 0xFF00 length
			/*0x02*/0x03, 0x02, // first byte should get overwritten
		];

		const b_rev = Uint8Array.from(rev);
		const b_obs = Uint8Array.from(obs);

		it('decodes correctly', function() {
			const contentRevealed = handler.reveal(b_obs, {
				chunkLength: 0xFF00,
			});
			TestUtil.buffersEqual(b_rev, contentRevealed);
		});
	});

	describe('chunk length - two extra bytes, crossing boundary, truncate', function() {
		let obs = [];
		for (let i = 0; i < 502; i++) {
			obs.push(0x7F); // repeat 130 times
			obs.push(0x01); // value to repeat
		}
		obs.push(...[
			0x13, 0x02, // crosses boundary
			0x80, 0x03, // should overwrite byte that crossed boundary and drop following byte
		]);

		let rev = [
			...Array(130 * 502).fill(0x01), // 0xFEEC length
			0x02, 0x02, 0x02, 0x02, 0x02, 0x02, 0x02, 0x02,
			0x02, 0x02, 0x02, 0x02, 0x02, 0x02, 0x02, 0x02,
			0x02, 0x02, 0x02, // 0xFEFF length
			0x02, // 0xFF00 length
			//0x02, 0x02, // first byte should get overwritten, second truncated
			0x03,
		];

		const b_rev = Uint8Array.from(rev);
		const b_obs = Uint8Array.from(obs);

		it('decodes correctly', function() {
			const contentRevealed = handler.reveal(b_obs, {
				chunkLength: 0xFF00,
				outputLength: 0xFF00 + 1,
			});
			TestUtil.buffersEqual(b_rev, contentRevealed);
		});
	});

	describe('chunk length - 15 extra bytes, crossing boundary, no truncate', function() {
		let obs = [];
		for (let i = 0; i < 502; i++) {
			obs.push(0x7F); // repeat 130 times
			obs.push(0x01); // value to repeat
		}
		obs.push(...[
			0x11 + 15, 0x02, // crosses boundary
			0x81, 0x03, 0x03, // should overwrite bytes that crossed boundary
		]);

		let rev = [
			...Array(130 * 502).fill(0x01), // 0xFEEC length
			0x02, 0x02, 0x02, 0x02, 0x02, 0x02, 0x02, 0x02,
			0x02, 0x02, 0x02, 0x02, 0x02, 0x02, 0x02, 0x02,
			0x02, 0x02, 0x02, // 0xFEFF length
			0x02, // 0xFF00 length
			// Past boundary
			/*0x02*/0x03, /*0x02*/0x03, 0x02, 0x02, 0x02, 0x02, 0x02, 0x02,
			0x02, 0x02, 0x02, 0x02, 0x02, 0x02, 0x02,
		];

		const b_rev = Uint8Array.from(rev);
		const b_obs = Uint8Array.from(obs);

		it('decodes correctly', function() {
			const contentRevealed = handler.reveal(b_obs, {
				chunkLength: 0xFF00,
			});
			TestUtil.buffersEqual(b_rev, contentRevealed);
		});
	});

	describe('chunk length - 15 extra bytes, crossing boundary, truncate', function() {
		let obs = [];
		for (let i = 0; i < 502; i++) {
			obs.push(0x7F); // repeat 130 times
			obs.push(0x01); // value to repeat
		}
		obs.push(...[
			0x11 + 15, 0x02, // crosses boundary
			0x81, 0x03, 0x03 // should overwrite byte that crossed boundary
		]);

		let rev = [
			...Array(130 * 502).fill(0x01), // 0xFEEC length
			0x02, 0x02, 0x02, 0x02, 0x02, 0x02, 0x02, 0x02,
			0x02, 0x02, 0x02, 0x02, 0x02, 0x02, 0x02, 0x02,
			0x02, 0x02, 0x02, // 0xFEFF length
			0x02, // 0xFF00 length
			//0x02 * [15] that will get overwritten/truncated
			0x03, 0x03,
		];

		const b_rev = Uint8Array.from(rev);
		const b_obs = Uint8Array.from(obs);

		it('decodes correctly', function() {
			const contentRevealed = handler.reveal(b_obs, {
				chunkLength: 0xFF00,
				outputLength: 0xFF00 + 2,
			});
			TestUtil.buffersEqual(b_rev, contentRevealed);
		});
	});


	describe('chunk length - 16 extra bytes, crossing boundary, no truncate', function() {
		let obs = [];
		for (let i = 0; i < 502; i++) {
			obs.push(0x7F); // repeat 130 times
			obs.push(0x01); // value to repeat
		}
		obs.push(...[
			0x11 + 16, 0x02, // crosses boundary
			0x81, 0x03, 0x03, // should overwrite bytes that crossed boundary
		]);

		let rev = [
			...Array(130 * 502).fill(0x01), // 0xFEEC length
			0x02, 0x02, 0x02, 0x02, 0x02, 0x02, 0x02, 0x02,
			0x02, 0x02, 0x02, 0x02, 0x02, 0x02, 0x02, 0x02,
			0x02, 0x02, 0x02, // 0xFEFF length
			0x02, // 0xFF00 length
			// Past boundary
			0x02, 0x02, 0x02, 0x02, 0x02, 0x02, 0x02, 0x02,
			0x02, 0x02, 0x02, 0x02, 0x02, 0x02, 0x02, 0x02,
			// 16 bytes past boundary will be kept
			0x03, 0x03,
		];

		const b_rev = Uint8Array.from(rev);
		const b_obs = Uint8Array.from(obs);

		it('decodes correctly', function() {
			const contentRevealed = handler.reveal(b_obs, {
				chunkLength: 0xFF00,
			});
			TestUtil.buffersEqual(b_rev, contentRevealed);
		});
	});

	describe('chunk length - 16 extra bytes, crossing boundary, truncate', function() {
		let obs = [];
		for (let i = 0; i < 502; i++) {
			obs.push(0x7F); // repeat 130 times
			obs.push(0x01); // value to repeat
		}
		obs.push(...[
			0x11 + 16, 0x02, // crosses boundary
			0x81, 0x03, 0x03 // should overwrite byte that crossed boundary
		]);

		let rev = [
			...Array(130 * 502).fill(0x01), // 0xFEEC length
			0x02, 0x02, 0x02, 0x02, 0x02, 0x02, 0x02, 0x02,
			0x02, 0x02, 0x02, 0x02, 0x02, 0x02, 0x02, 0x02,
			0x02, 0x02, 0x02, // 0xFEFF length
			0x02, // 0xFF00 length
			// Past boundary
			0x02, 0x02, 0x02, 0x02, 0x02, 0x02, 0x02, 0x02,
			0x02, 0x02, 0x02, 0x02, 0x02, 0x02, 0x02, 0x02,
			// 16 bytes past boundary will be kept
			0x03, 0x03,
		];

		const b_rev = Uint8Array.from(rev);
		const b_obs = Uint8Array.from(obs);

		it('decodes correctly', function() {
			const contentRevealed = handler.reveal(b_obs, {
				chunkLength: 0xFF00,
				outputLength: 0xFF00 + 16 + 2,
			});
			TestUtil.buffersEqual(b_rev, contentRevealed);
		});
	});


	describe('chunk length - 17 extra bytes, crossing boundary, no truncate', function() {
		let obs = [];
		for (let i = 0; i < 502; i++) {
			obs.push(0x7F); // repeat 130 times
			obs.push(0x01); // value to repeat
		}
		obs.push(...[
			0x11 + 17, 0x02, // crosses boundary
			0x81, 0x03, 0x03, // should overwrite bytes that crossed boundary
		]);

		let rev = [
			...Array(130 * 502).fill(0x01), // 0xFEEC length
			0x02, 0x02, 0x02, 0x02, 0x02, 0x02, 0x02, 0x02,
			0x02, 0x02, 0x02, 0x02, 0x02, 0x02, 0x02, 0x02,
			0x02, 0x02, 0x02, // 0xFEFF length
			0x02, // 0xFF00 length
			// Past boundary
			0x02, 0x02, 0x02, 0x02, 0x02, 0x02, 0x02, 0x02,
			0x02, 0x02, 0x02, 0x02, 0x02, 0x02, 0x02, 0x02,
			// 16 bytes past boundary will be kept
			/*0x02*/0x03, 0x03, // 17th byte will be overwritten
		];

		const b_rev = Uint8Array.from(rev);
		const b_obs = Uint8Array.from(obs);

		it('decodes correctly', function() {
			const contentRevealed = handler.reveal(b_obs, {
				chunkLength: 0xFF00,
			});
			TestUtil.buffersEqual(b_rev, contentRevealed);
		});
	});

	describe('chunk length - 17 extra bytes, crossing boundary, truncate', function() {
		let obs = [];
		for (let i = 0; i < 502; i++) {
			obs.push(0x7F); // repeat 130 times
			obs.push(0x01); // value to repeat
		}
		obs.push(...[
			0x11 + 17, 0x02, // crosses boundary
			0x81, 0x03, 0x03 // should overwrite byte that crossed boundary
		]);

		let rev = [
			...Array(130 * 502).fill(0x01), // 0xFEEC length
			0x02, 0x02, 0x02, 0x02, 0x02, 0x02, 0x02, 0x02,
			0x02, 0x02, 0x02, 0x02, 0x02, 0x02, 0x02, 0x02,
			0x02, 0x02, 0x02, // 0xFEFF length
			0x02, // 0xFF00 length
			// Past boundary
			0x02, 0x02, 0x02, 0x02, 0x02, 0x02, 0x02, 0x02,
			0x02, 0x02, 0x02, 0x02, 0x02, 0x02, 0x02, 0x02,
			// 16 bytes past boundary will be kept
			/*0x02*/0x03, 0x03, // 17th byte will be overwritten
		];

		const b_rev = Uint8Array.from(rev);
		const b_obs = Uint8Array.from(obs);

		it('decodes correctly', function() {
			const contentRevealed = handler.reveal(b_obs, {
				chunkLength: 0xFF00,
				outputLength: 0xFF00 + 17 + 2,
			});
			TestUtil.buffersEqual(b_rev, contentRevealed);
		});
	});

});
