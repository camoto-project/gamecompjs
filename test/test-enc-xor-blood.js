const assert = require('assert');

const TestUtil = require('./util.js');
const standardCleartext = require('./gen-cleartext.js');
const GameCompression = require('../index.js');

const handler = GameCompression.getHandler('enc-xor-blood');
const md = handler.metadata();
let testutil = new TestUtil(md.id);
describe(`Extra tests for ${md.title} [${md.id}]`, function() {

	let content = {};
	before('load test data from local filesystem', function() {
		content.default = testutil.loadData('default.bin');
		content.seed4f = testutil.loadData('seed4f.bin');

		content.default_v300 = testutil.loadData('default-v300.bin');
		content.seed4f_v300 = testutil.loadData('seed4f-v300.bin');

		content.default_full = testutil.loadData('default-full.bin');
	});

	describe('reveal()', function() {
		it('works with a different seed', function() {
			const params = {seed: 0x4f};
			const contentRevealed = handler.reveal(content.seed4f, params);
			testutil.buffersEqual(standardCleartext, contentRevealed);
		});

		it('works with a string seed', function() {
			const params = {seed: '0x4f'};
			const contentRevealed = handler.reveal(content.seed4f, params);
			testutil.buffersEqual(standardCleartext, contentRevealed);
		});

		it('works with a different offset', function() {
			const params = {offset: 1};
			const contentRevealed = handler.reveal(content.default_v300, params);
			testutil.buffersEqual(standardCleartext, contentRevealed);
		});

		it('works with a different offset and seed', function() {
			const params = {offset: 1, seed: 0x4f};
			const contentRevealed = handler.reveal(content.seed4f_v300, params);
			testutil.buffersEqual(standardCleartext, contentRevealed);
		});

		it('does the full file when limit=0', function() {
			const params = {limit: 0};
			const contentRevealed = handler.reveal(content.default_full, params);
			testutil.buffersEqual(standardCleartext, contentRevealed);
		});

	});

	describe('obscure()', function() {
		it('works with a different seed', function() {
			const params = {seed: 0x4f};
			const contentObscured = handler.obscure(standardCleartext, params);
			testutil.buffersEqual(content.seed4f, contentObscured);
		});
	});
});
