const assert = require('assert');

const TestUtil = require('./util.js');
const standardCleartext = require('./gen-cleartext.js');
const GameCompression = require('../index.js');

// Override the default colours so we can actually see them
var colors = require('mocha/lib/reporters/base').colors;
colors['diff added'] = '1;33';
colors['diff removed'] = '1;31';
colors['green'] = '1;32';
colors['fail'] = '1;31';
colors['error message'] = '1;31';
colors['error stack'] = '1;37';

GameCompression.listHandlers().forEach(handler => {
	const md = handler.metadata();
	let testutil = new TestUtil(md.id);

	describe(`Standard tests for ${md.title} [${md.id}]`, function() {
		let content = {};
		before('load test data from local filesystem', function() {
			content.default = testutil.loadData('default.bin');
		});

		describe('reveal()', function() {
			it('should reveal correctly', function() {
				let contentInput = Buffer.from(content.default);
				const contentRevealed = handler.reveal(contentInput);
				testutil.buffersEqual(standardCleartext, contentRevealed);
				testutil.buffersEqual(content.default, contentInput, 'Input buffer was changed during reveal');
			});
		});

		describe('obscure()', function() {
			it('should obscure correctly', function() {
				// Copy buffer to ensure no changes
				let contentInput = Buffer.from(standardCleartext);
				const contentObscured = handler.obscure(contentInput);
				testutil.buffersEqual(content.default, contentObscured);
				testutil.buffersEqual(standardCleartext, contentInput, 'Input buffer was changed during obscure');
			});
		});
	});
});
