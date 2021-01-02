import lint from 'mocha-eslint';

const paths = [
	'cli',
	'compress',
	'encrypt',
	'test',
	'util',
];

lint(paths);
