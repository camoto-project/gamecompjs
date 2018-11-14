const assert = require('assert');

const TestUtil = require('./util.js');
const standardCleartext = require('./gen-cleartext.js');
const GameCompression = require('../index.js');

const handler = GameCompression.getHandler('cmp-lzw');
const md = handler.metadata();
let testutil = new TestUtil(md.id);
describe(`Extra tests for ${md.title} [${md.id}]`, function() {

	let content = {};
	let presets = {
		/*
		epfs: {
			title: 'Lion King',
			params: {
				initialBits: 9,
				maxBits: 14,
				cwEOF: -1,    // max codeword
				cwReset: -2, // max-1
				cwFirst: 256,
				bigEndian: true,
			}
		},
		*/
		mbash: {
			title: 'Monster Bash',
			params: {
				initialBits: 9,
				maxBits: 12,
				//cwEOF: 256,
				cwFirst: 257,
				bigEndian: false,
			}
		},
		/*
		sierra: {
			title: 'Sierra',
			params: {
				initialBits: 9,
				maxBits: 9,
				cwEOF: 257,
				cwReset: 256,
				cwFirst: 258,
				bigEndian: false,
			}
		},
		stellar7: {
			title: 'Stellar 7',
			params: {
				initialBits: 9,
				maxBits: 12,
				cwEOF: undefined,
				cwReset: 256,
				cwFirst: 257,
				bigEndian: false,
				flushOnReset: true,
			}
		},
		*/
	};
	before('load test data from local filesystem', function() {
		content.default = testutil.loadData('default.bin');
		content.mbash = testutil.loadData('mbash.bin');
	});

	describe('reveal()', function() {
		Object.keys(presets).forEach(id => {
			const p = presets[id];

			it(`works with ${p.title} settings`, function() {
				const contentRevealed = handler.reveal(content[id], p.params);
				testutil.buffersEqual(standardCleartext, contentRevealed);
			});
		});
	});

	describe('obscure()', function() {
		Object.keys(presets).forEach(id => {
			const p = presets[id];

			it(`works with ${p.title} settings`, function() {
				const contentObscured = handler.obscure(standardCleartext, p.params);
				testutil.buffersEqual(content[id], contentObscured);
			});
		});
	});

	describe('obscure() then reveal() are lossless', function() {
		Object.keys(presets).forEach(id => {
			const p = presets[id];

			it(`works with ${p.title} settings`, function() {
				const contentObscured = handler.obscure(standardCleartext, p.params);
				const contentRevealed = handler.reveal(contentObscured, p.params);
				testutil.buffersEqual(standardCleartext, contentRevealed);
			});
		});
	});
});
