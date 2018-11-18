/**
 * @file Command line interface to the library.
 *
 * Copyright (C) 2018 Adam Nielsen <malvineous@shikadi.net>
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

const fs = require('fs');
const GameCompression = require('../index.js');
const Debug = require('../util/utl-debug.js');

if (process.argv[2] == '--debug') {
	Debug.mute(false);
	process.argv.shift();
}

const param = process.argv[2];

if (['-h', '--help', '-?', '?', undefined].some(v => param == v)) {
	console.log('gamecomp --formats | [--debug] (+|-)format [opt=val [opt=val ...]]\n');
	console.log('gamecomp --formats    // List algorithms and their options');
	console.log('gamecomp +example     // Compress/encrypt with "example" algorithm');
	console.log('gamecomp -example     // Decompress/decrypt with "example"');
	console.log('gamecomp +ex opt=123  // Pass parameter to algorithm');
	process.exit(0);
}

if (param == '--formats') {
	GameCompression.listHandlers().forEach(handler => {
		const md = handler.metadata();
		console.log(`${md.id}: ${md.title}`);
		if (md.params) Object.keys(md.params).forEach(p => {
			console.log(`  * ${p}: ${md.params[p]}`);
		});
	});
	process.exit(0);
}

// Parse any name=value parameters
let params = {};
for (let i = 3; i < process.argv.length; i++) {
	const [name, value] = process.argv[i].split('=');
	params[name] = value;
}

let obscure;
switch (param[0]) {
	case '+':
		obscure = true;
		break;
	case '-':
		obscure = false;
		break;
	default:
		console.error('Parameter must be format ID prefixed with + or -');
		process.exit(1);
}

const id = param.substr(1);

let handler = GameCompression.getHandler(id);
if (!handler) {
	console.error('Invalid format code:', id);
	process.exit(2);
}

const content = fs.readFileSync(0, null);
let outBuffer;
if (obscure) {
	outBuffer = handler.obscure(content, params);
} else {
	outBuffer = handler.reveal(content, params);
}

process.stdout.write(outBuffer);
