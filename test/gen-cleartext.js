// This is what we expect the algorithm to produce when applied to the
// default testdata.
let standardCleartext = Buffer.alloc(36+256+16);
Buffer.from('she sells sea shells by the seashore').copy(standardCleartext);
for (let i = 0; i < 256; i++) {
	standardCleartext[i + 36] = i;
}
Buffer.from('Example finished').copy(standardCleartext, 256+36);
//require('fs').writeFileSync('cleartxt.bin', standardCleartext);

module.exports = standardCleartext;
