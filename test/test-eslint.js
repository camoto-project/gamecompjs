const lint = require('mocha-eslint');

const paths = [
	'cli',
	'compress',
	'encrypt',
	'test',
	'util',
];

lint(paths);
