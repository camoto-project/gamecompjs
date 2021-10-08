/*
 * Extra tests for cmp-pklite.
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

import assert from 'assert';
import TestUtil from './util.js';
import { cmp_pklite as handler } from '../index.js';

const files = {
	h100:  { ver: '1.00', large: 1, extra: 0 },
	h103:  { ver: '1.03', large: 1, extra: 0 },
	h105:  { ver: '1.05', large: 1, extra: 0 },
	h10c:  { ver: '1.12', large: 1, extra: 0 },
	h10cr: { ver: '1.12', large: 1, extra: 1 },
	h10d:  { ver: '1.13', large: 1, extra: 0 },
	h10dr: { ver: '1.13', large: 1, extra: 1 },
	h10e:  { ver: '1.14', large: 1, extra: 0 },
	h10f:  { ver: '1.15', large: 1, extra: 0 },
	h10fr: { ver: '1.15', large: 1, extra: 1 },
	h132:  { ver: '1.50', large: 1, extra: 0 },
	h201:  { ver: '2.01', large: 1, extra: 0 },
	t100:  { ver: '1.00', large: 0, extra: 0 },
	t103:  { ver: '1.03', large: 0, extra: 0 },
	t105:  { ver: '1.05', large: 0, extra: 0 },
	t10c:  { ver: '1.12', large: 0, extra: 0 },
	t10cr: { ver: '1.12', large: 0, extra: 1 },
	t10d:  { ver: '1.13', large: 0, extra: 0 },
	t10dr: { ver: '1.13', large: 0, extra: 1 },
	t10e:  { ver: '1.14', large: 0, extra: 0 },
	t10f:  { ver: '1.15', large: 0, extra: 0 },
	t10fr: { ver: '1.15', large: 0, extra: 1 },
	t132:  { ver: '1.50', large: 0, extra: 0 },
	t201:  { ver: '2.01', large: 0, extra: 0 },
};

const gameFiles = {
	'doofus.exe': 'VmqvCKBMwuLlArImCd4p/XoaoEk=',
	'kdreams.exe': 'W18lw4zeVHM0Yapzac62r2HNfr8=',
};

const md = handler.metadata();
let testutil = new TestUtil(md.id);
describe(`Extra tests for ${md.title} [${md.id}]`, function() {
	let content = {};

	before('load test data from local filesystem', function() {

		content = testutil.loadContent(handler, [
			'h.unc',
			't.unc',
			...Object.keys(files).map(n => `${n}.exe`),
			...Object.keys(files).filter(n => n.substr(-1) === 'r').map(n => `${n}.unc`),
		]);
	});

	for (const [ code, info ] of Object.entries(files)) {
		const { ver, large, extra } = info;
		const strLarge = ['off', 'on'][large];
		const strExtra = ['off', 'on'][extra];
		const clear = [
			['t', 'h'][large],
			code,
		][extra];
		describe(`works with PKLite ${ver}, large=${strLarge}, extra=${strExtra}`, function() {

			it(`reveal()`, function() {
				const contentRevealed = handler.reveal(content[`${code}.exe`].main);

				// There is currently no known way to restore the "extra memory
				// required" field, so we will just replace it with the correct value.
				if (extra) {
					contentRevealed[10] = content[`${clear}.unc`].main[10];
					contentRevealed[11] = content[`${clear}.unc`].main[11];
				}
				TestUtil.buffersEqual(content[`${clear}.unc`].main, contentRevealed);
			});

			it('identify()', function() {
				const result = handler.identify(content[`${code}.exe`].main);

				assert.equal(result.reason, `Compressed with PKLite v${ver}, flags: `
					+ `${['-', '+'][large]}large ${['-', '+'][extra]}extra.`);
				assert.equal(result.valid, true);
			});

		}); // describe()
	}

	describe('identify()', function() {

		it('ignores short files', function() {
			const result = handler.identify(TestUtil.u8FromString('12345678'));

			assert.equal(result.reason, 'File too short.');
			assert.equal(result.valid, false);
		});

	}); // identify()

});

describe(`Tests with real game files for ${md.title} [${md.id}]`, function() {
	let content = {};

	before('load test data from local filesystem', function() {
		for (const filename of Object.keys(gameFiles)) {
			try {
				content = {
					...content,
					...testutil.loadContent(handler, [filename]),
				};
			} catch (e) {
				console.log(e.message);
			}
		}
	});

	for (const [ filename, targetHash ] of Object.entries(gameFiles)) {
		describe(`works with ${filename}`, function() {

			it(`reveal()`, function() {
				// Skip the test if the game file doesn't exist.
				if (!content[filename]) {
					this.skip();
					return;
				}

				const contentRevealed = handler.reveal(content[filename].main);

				assert.equal(TestUtil.hash(contentRevealed), targetHash,
					`Content for "${filename}" differs to what was expected.`);
			});

			it('identify()', function() {
				// Skip the test if the game file doesn't exist.
				if (!content[filename]) {
					this.skip();
					return;
				}

				const result = handler.identify(content[filename].main);
				assert.equal(result.valid, true);
			});

		}); // describe()
	}

});
