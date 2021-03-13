/*
 * Command line interface to the library.
 *
 * Copyright (C) 2010-2021 Adam Nielsen <malvineous@shikadi.net>
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

import fs from 'fs';
import { all as gamecompAll } from '../index.js';

import Debug from '../util/debug.js';
const debug = Debug.extend('cli');

export default function cli() {

	const param = process.argv[2];

	if (['-h', '--help', '-?', '?', undefined].some(v => param == v)) {
		console.log('gamecomp --formats | (+|-)format [opt=val [opt=val ...]]\n');
		console.log('gamecomp --formats    // List algorithms and their options');
		console.log('gamecomp +example     // Compress/encrypt with "example" algorithm');
		console.log('gamecomp -example     // Decompress/decrypt with "example"');
		console.log('gamecomp +ex opt=123  // Pass parameter to algorithm');
		console.log('gamecomp +ex @opt=file.dat  // Pass file content as parameter');
		console.log('DEBUG=\'gamecomp:*\' gamecomp ...  // Troubleshoot');
		process.exit(0);
	}

	if (param == '--formats') {
		for (const handler of gamecompAll) {
			const md = handler.metadata();
			console.log(`${md.id}: ${md.title}`);
			if (md.options) Object.keys(md.options).forEach(p => {
				console.log(`  * ${p}: ${md.options[p]}`);
			});
		}
		process.exit(0);
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

	let handler = gamecompAll.find(h => h.metadata().id === id);
	if (!handler) {
		console.error('Invalid format code:', id);
		process.exit(2);
	}

	const md = handler.metadata();
	// Parse any name=value parameters
	let options = {};
	for (let i = 3; i < process.argv.length; i++) {
		let [name, value] = process.argv[i].split('=');
		if (name[0] === '@') {
			name = name.slice(1);
			try {
				value = fs.readFileSync(value);
			} catch (e) {
				throw new Error(`Unable to open ${value}: ${e.message}`);
			}
		}
		if (!md.options[name]) {
			console.error(`Unknown option: ${name}`);
			process.exit(1);
		}
		options[name] = value;
	}

	const content = fs.readFileSync(0, null);
	let outBuffer;
	try {
		if (obscure) {
			outBuffer = handler.obscure(content, options);
		} else {
			outBuffer = handler.reveal(content, options);
		}
	} catch (e) {
		debug(e);
		console.error(`ERROR: ${e.message}`);
		process.exit(2);
	}

	process.stdout.write(outBuffer);
}
