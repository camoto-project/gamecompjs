const fs = require('fs');
const GameCompression = require('../index.js');
const Debug = require('../util/utl-debug.js');

// Uncomment to enable debugging messages
//Debug.mute(false);

const param = process.argv[2];

if (['-h', '--help', '-?', '?', undefined].some(v => param == v)) {
	console.log('gamecomp --list    // List algorithms');
	console.log('gamecomp +example  // Compress/encrypt with "example" algorithm');
	console.log('gamecomp -example  // Decompress/decrypt with "example"');
	process.exit(0);
}

if (param == '--list') {
	GameCompression.listHandlers().forEach(handler => {
		const md = handler.metadata();
		console.log(`${md.id}: ${md.title}`);
	});
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

let handler = GameCompression.getHandler(id);
if (!handler) {
	console.error('Invalid format code:', id);
	process.exit(2);
}

const content = fs.readFileSync(0, null);
let outBuffer;
if (obscure) {
	outBuffer = handler.obscure(content);
} else {
	outBuffer = handler.reveal(content);
}

process.stdout.write(outBuffer);
