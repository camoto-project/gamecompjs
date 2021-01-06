import lint from 'mocha-eslint';

const paths = [
	'index.js',
	'cli/*.js',
	'compress',
	'encrypt',
	'test',
	'util',
];

lint(paths);
