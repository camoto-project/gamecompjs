import lint from 'mocha-eslint';

const paths = [
	'index.js',
	'cli/*.js',
	'formats',
	'test',
	'util',
];

lint(paths);
