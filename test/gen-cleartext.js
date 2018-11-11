// This is what we expect the algorithm to produce when applied to the
// default testdata.
let standardCleartext = Buffer.alloc(256+16*2);
Buffer.from('Example starting').copy(standardCleartext);
for (let i = 0; i < 256; i++) {
	standardCleartext[i + 16] = i;
}
Buffer.from('Example finished').copy(standardCleartext, 256+16);
//fs.writeFileSync('cleartxt.bin', standardCleartext);

module.exports = standardCleartext;
