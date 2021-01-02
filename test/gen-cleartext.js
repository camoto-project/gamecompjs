// This is what we expect the algorithm to produce when applied to the
// default testdata.
let standardCleartext = new Uint8Array(36+256+16);
const s1 = 'she sells sea shells by the seashore';
for (let i = 0; i < s1.length; i++) {
	standardCleartext[i] = s1.charCodeAt(i);
}
for (let i = 0; i < 256; i++) {
	standardCleartext[i + 36] = i;
}
const s2 = 'Example finished';
for (let i = 0; i < s2.length; i++) {
	standardCleartext[36 + 256 + i] = s2.charCodeAt(i);
}
//require('fs').writeFileSync('cleartxt.bin', standardCleartext);

export default standardCleartext;
