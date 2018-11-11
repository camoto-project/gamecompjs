const fs = require('fs');
const GameCompression = require('../index.js');
const Debug = require('../util/utl-debug.js');

// Uncomment to enable debugging messages
//Debug.mute(false);

const param = process.argv[2];

if (['-h', '--help', '-?', '?', undefined].some(v => param == v)) {
	console.log('gamecomp --list | (+|-)format [opt=val [opt=val ...]]\n');
	console.log('gamecomp --list       // List algorithms and their options');
	console.log('gamecomp +example     // Compress/encrypt with "example" algorithm');
	console.log('gamecomp -example     // Decompress/decrypt with "example"');
	console.log('gamecomp +ex opt=123  // Pass parameter to algorithm');
	process.exit(0);
}

if (param == '--list') {
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
