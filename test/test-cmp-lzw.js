const assert = require('assert');

const TestUtil = require('./util.js');
const standardCleartext = require('./gen-cleartext.js');
const GameCompression = require('../index.js');

const handler = GameCompression.getHandler('cmp-lzw');
const md = handler.metadata();
let testutil = new TestUtil(md.id);
describe(`Extra tests for ${md.title} [${md.id}]`, function() {

	let content = {};
	let presets = [
		/*
		{
			id: 'epfs',
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
		{
			id: 'mbash',
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
		{
			id: 'sierra',
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
		{
			id: 'stellar7',
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
	];
	before('load test data from local filesystem', function() {
		content.default = testutil.loadData('default.bin');
		content.mbash = testutil.loadData('mbash.bin');
	});

	describe('reveal()', function() {
		presets.forEach(p => {
			it(`works with ${p.title} settings`, function() {
				const contentRevealed = handler.reveal(content[p.id], p.params);
				testutil.buffersEqual(standardCleartext, contentRevealed);
			});
		});
	});

	describe('obscure()', function() {
		presets.forEach(p => {
			it(`works with ${p.title} settings`, function() {
				const contentObscured = handler.obscure(standardCleartext, p.params);
				testutil.buffersEqual(content[p.id], contentObscured);
			});
		});
	});

	describe('obscure() then reveal() are lossless', function() {
		presets.forEach(p => {
			it(`works with ${p.title} settings`, function() {
				const contentObscured = handler.obscure(standardCleartext, p.params);
				const contentRevealed = handler.reveal(contentObscured, p.params);
				testutil.buffersEqual(standardCleartext, contentRevealed);
			});
		});
	});
});
