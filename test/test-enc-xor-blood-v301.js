const assert = require('assert');

const TestUtil = require('./util.js');
const standardCleartext = require('./gen-cleartext.js');
const GameCompression = require('../index.js');

const format = 'enc-xor-blood-v301';

const handler = GameCompression.getHandler(format);
const md = handler.metadata();
let testutil = new TestUtil(md.id);
describe(`Extra tests for ${md.title} [${md.id}]`, function() {

	let content = {};
	before('load test data from local filesystem', function() {
		content.default = testutil.loadData('default.bin');
		content.seed4f = testutil.loadData('seed4f.bin');
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
	});

	describe('obscure()', function() {
		it('works with a different seed', function() {
			const params = {seed: 0x4f};
			const contentObscured = handler.obscure(standardCleartext, params);
			testutil.buffersEqual(content.seed4f, contentObscured);
		});
	});
});
