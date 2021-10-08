/*
 * PKLite .exe decompression algorithm.
 *
 * Algorithm originally from OpenTESArena: (MIT licence)
 *   https://github.com/afritz1/OpenTESArena/blob/master/OpenTESArena/src/Assets/ExeUnpacker.cpp
 *
 * Parts also from refkeen: (MIT Licence)
 *   https://github.com/NY00123/refkeen/blob/master/src/depklite/depklite.c
 *
 * The algorithms for non-large files were deciphered from MZExplode, a reverse
 * engineering project:
 *   https://github.com/virginwidow/mz-explode/blob/master/src/explode/unpklite.cc
 *
 * This code was rewritten from scratch using the above sources as a reference
 * and is thus placed under the GPL.
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

const FORMAT_ID = 'cmp-pklite';

import { RecordBuffer, RecordType } from '@camoto/record-io-buffer';
import Debug from '../util/debug.js';
const g_debug = Debug.extend(FORMAT_ID);

function parseBool(s) {
	if (s === undefined) {
		return false;
	} else if (s === true || s === false) {
		return s;
	} else if (s.toLowerCase) {
		return s.toLowerCase() === 'true';
	}
	return !!s;
}

const recordTypes = {
	exeSig: {
		signature: RecordType.string.fixed.noTerm(2),
	},
	exeHeader: {
		lenLastBlock: RecordType.int.u16le,
		blockCount: RecordType.int.u16le,
		relocCount: RecordType.int.u16le,
		pgLenHeader: RecordType.int.u16le,
		pgMinExtra: RecordType.int.u16le,
		pgMaxExtra: RecordType.int.u16le,
		segSS: RecordType.int.s16le,
		regSP: RecordType.int.u16le,
		checksum: RecordType.int.u16le,
		regIP: RecordType.int.u16le,
		segCS: RecordType.int.s16le,
		offRelocTable: RecordType.int.u16le,
		overlayIndex: RecordType.int.u16le,
	},
	pkliteHeader: {
		verMinor: RecordType.int.u8,
		verMajor: RecordType.int.u8,
	},
	pkliteFooter: {
		segSS: RecordType.int.u16le,
		regSP: RecordType.int.u16le,
		segCS: RecordType.int.u16le,
		// This field is treated as the .exe checksum in some other decompressors,
		// yet others treat it as the IP field.  The .exe header only seems to come
		// out correctly when you treat it as the IP field.
		regIP: RecordType.int.u16le,
	},
};

// Bit table from pklite_specification.md, section 4.3.1 "Number of bytes".
// The decoded value for a given vector is (index + 2) before index 11, and
// (index + 1) after index 11.
// Huffman table to use for the "count" values when the "large" flag is set.
const btCountLarge = [
	[ // 0b0
		[ // 0b00
			4, // 0b000
			[ // 0b001
				5, // 0b0010
				6  // 0b0011
			]
		], [ // 0b01
			[ // 0b010
				7, // 0b0100
				[  // 0b0101
					8, // 0b01010
					9, // 0b01011
				]
			], [ // 0b011
				[ // 0b0110
					10, // 0b01100
					[ // 0b01101
						11, // 0b011010
						12, // 0b011011
					]
				], [ // 0b0111
					[ // 0b01110
						-1, // 0b011100
						[ // 0b011101
							13, // 0b0111010
							14, // 0b0111011
						]
					], [ // 0b01111
						[ // 0b011110
							15, // 0b0111100
							[ // 0b0111101
								16, // 0b01111010
								17, // 0b01111011
							]
						], [ // 0b011111
							[ // 0b0111110
								18, // 0b01111100
								[ // 0b01111101
									19, // 0b011111010
									20, // 0b011111011
								]
							], [ // 0b0111111
								[ // 0b01111110
									21, // 0b011111100
									22, // 0b011111101
								], [ // 0b01111111
									23, // 0b011111110
									24, // 0b011111111
								]
							]
						]
					]
				]
			]
		]
	], [ // 0b1
		2, // 0b10
		3  // 0b11
	]
];

// Huffman table to use for the "count" values when the "large" flag is not set.
const btCountSmall = [
	[ // 0b0
		3, // 0b00
		[  // 0b01
			2, // 0b010
			-1, // 0b011
		],
	], [ // 0b1
		[ // 0b10
			4, // 0b100
			5, // 0b101
		], [ // 0b11
			[ // 0b110
				6, // 0b1100
				7, // 0b1101
			], [ // 0b111
				8, // 0b1110
				9, // 0b1111
			],
		],
	]
];

// Bit table from pklite_specification.md, section 4.3.2 "Offset".
// Huffman table to use for the "offset" values regardless of the "large" flag.
const btOffset = [
	[          // 0b0
		[        // 0b00
			[      // 0b000
				1,   // 0b0000
				2,   // 0b0001
			], [   // 0b001
				[    // 0b0010
					3, // 0b00100
					4, // 0b00101
				], [ // 0b0011
					5, // 0b00110
					6, // 0b00111
				]
			]
		], [        // 0b01
			[         // 0b010
				[       // 0b0100
					[     // 0b01000
						7,  // 0b010000
						8,  // 0b010001
					], [  // 0b01001
						9,  // 0b010010
						10, // 0b010011
					]
				], [      // 0b0101
					[       // 0b01010
						11,   // 0b010100
						12,   // 0b010101
					], [    // 0b01011
						13,   // 0b010110
						[     // 0b010111
							14, // 0b0101110
							15, // 0b0101111
						]
					]
				]
			], [        // 0b011
				[         // 0b0110
					[       // 0b01100
						[     // 0b011000
							16, // 0b0110000
							17, // 0b0110001
						], [  // 0b011001
							18, // 0b0110010
							19, // 0b0110011
						]
					], [    // 0b01101
						[     // 0b011010
							20, // 0b0110100
							21, // 0b0110101
						], [  // 0b011011
							22, // 0b0110110
							23, // 0b0110111
						]
					]
				], [      // 0b0111
					[       // 0b01110
						[     // 0b011100
							24, // 0b0111000
							25, // 0b0111001
						], [  // 0b011101
							26, // 0b0111010
							27, // 0b0111011
						]
					], [    // 0b01111
						[     // 0b011110
							28, // 0b0111100
							29, // 0b0111101
						], [  // 0b011111
							30, // 0b0111110
							31, // 0b0111111
						]
					]
				]
			]
		]
	],
	0  // 0b1
];

// Walk the binary tree and return the leaf node.
function btRead(bt, fnNextBit) {
	const b = fnNextBit();
	const r = bt[b];
	return (r[0] !== undefined) && btRead(r, fnNextBit) || r;
}

export default class Compress_PKLite
{
	static metadata() {
		return {
			id: FORMAT_ID,
			title: 'PKLite compression',
			options: {
				recalcHeader: 'If true, recalculate all the fields in the output .exe '
					+ 'header. Always true if "extra" PKLite flag was used. Only needed '
					+ 'if .exe has been tampered with [false]',
			},
		};
	}

	static identify(content) {
		const debug = g_debug.extend('identify');

		let input = new RecordBuffer(content);

		if (content.length < 0x290) {
			return {
				valid: false,
				reason: 'File too short.',
			};
		}

		input.seekAbs(0x1E);
		const sig = input.read(RecordType.string.fixed.noTerm(6));
		if (sig !== 'PKLITE') {
			debug('PKLITE copyright message not found, searching for Huffman table');

			// Look for the Huffman table as it's impossible to tweak after compression
			// without breaking the decompression.
			const sig = [
				0x03, 0x04, 0x05, 0x06, 0x00, 0x00, 0x00, 0x00,
				0x00, 0x00, 0x00, 0x00, 0x07, 0x08, 0x09, 0x0A,
				0x0B, 0x0C, 0x0D,
			];
			const len = Math.min(0x320, content.length);
			let match = false;

			for (let i = 0; i < len; i++) {
				if (content[i] === sig[0]) {
					match = true;
					for (let j = 1; j < Math.min(sig.length, len); j++) {
						if (content[i + j] !== sig[j]) {
							match = false;
							break;
						}
					}
					if (match) break;
				}
			}
			if (!match) {
				// TODO: Could be a compressed file, where the Huffman table is encrypted.
				return {
					valid: false,
					reason: 'Not compressed with PKLite.',
				};
			}
		}

		input.seekAbs(0x1C);
		const pkliteHeader = input.readRecord(recordTypes.pkliteHeader);

		const verMajor = pkliteHeader.verMajor & 0x0F;
		const version = verMajor.toString()
			+ '.'
			+ pkliteHeader.verMinor.toString().padStart(2, '0');

		const flagLarge = !!(pkliteHeader.verMajor & 0x20);
		const flagExtra = !!(pkliteHeader.verMajor & 0x10);

		return {
			valid: true,
			reason: `Compressed with PKLite v${version}, flags: `
				+ `${flagLarge ? '+' : '-'}large ${flagExtra ? '+' : '-'}extra.`,
		};
	}

	static reveal(content, options = {})
	{
		const debug = g_debug.extend('reveal');

		let recalcHeader = parseBool(options.recalcHeader);

		let input = new RecordBuffer(content);

		input.seekAbs(0);
		const sig = input.readRecord(recordTypes.exeSig);
		const exeHeader = input.readRecord(recordTypes.exeHeader);
		const pkliteHeader = input.readRecord(recordTypes.pkliteHeader);

		const verMajor = pkliteHeader.verMajor & 0x0F;
		const version = verMajor.toString()
			+ '.'
			+ pkliteHeader.verMinor.toString().padStart(2, '0');

		const flagLarge = !!(pkliteHeader.verMajor & 0x20);
		const flagExtra = !!(pkliteHeader.verMajor & 0x10);

		// Start of the code, where the PKLite decompressor sits.
		const offDecompressor = exeHeader.pgLenHeader << 4;

		// Always recalculate the output .exe header if the 'extra' flag has been
		// specified, because in this case PKLite does not store the original
		// header.
		recalcHeader = recalcHeader || flagExtra;

		debug(`PKLite version ${version}, large=${flagLarge ? 'on' : 'off'}, `
			+ `extra=${flagExtra ? 'on' : 'off'}`);

		debug(`EXE header size: 0x${(exeHeader.pgLenHeader << 4).toString(16)}`);
		debug(`Relocation table at 0x${exeHeader.offRelocTable.toString(16)}`);
		debug(`Relocation table size: 0x${exeHeader.relocCount.toString(16)}`);
		const offOrigHeader = exeHeader.offRelocTable + exeHeader.relocCount * 4;
		debug(`Offset of original header: 0x${offOrigHeader.toString(16)}`);

		// Figure out where the start of the compressed data is.
		const verCode = (pkliteHeader.verMajor << 8) | pkliteHeader.verMinor;
		const verBase = verCode & 0x0FFF;
		let lenDecompressor = {
			0x0100: 0x1D0,
			0x0103: 0x1D0,
			0x0105: 0x1D0,
			0x010C: 0x1D0,
			0x010D: 0x1D0,
			0x010E: 0x1D0,
			0x010F: 0x1D0,
			0x0132: -1,
			0x0201: -1,

			0x1103: 0x1E0,
			0x110C: 0x1E0,
			0x110D: 0x1E0,
			0x110E: 0x200,
			0x110F: 0x200,
			//0x1132: -2, // needs calc
			//0x1201: -2, // probably the same

			0x2100: 0x290,
			0x2103: 0x290,
			0x2105: 0x290,
			0x210A: 0x290,
			0x210C: 0x290,
			0x210D: 0x290,
			0x210E: 0x290,
			0x210F: 0x290,
			0x2132: -1,
			0x2201: -1,

			0x3103: 0x2A0,
			0x310C: 0x290, // doesn't follow the pattern, but correct
			0x310D: 0x290, // doesn't follow the pattern, but correct
			0x310E: 0x2C0,
			0x310F: 0x2C0,
			//0x3132: -2, // needs calc
			//0x3201: -2, // probably the same
		}[verCode];

		if (lenDecompressor === -1) {
			input.seekAbs(offDecompressor + 0x48);
			lenDecompressor = input.read(RecordType.int.u16le);
			lenDecompressor <<= 1;
			lenDecompressor += 0x62;
			lenDecompressor &= 0xFFFFFFF0;
		}

		/* untested
		if (lenDecompressor === -2) {
			input.seekAbs(offDecompressor + 0x59);
			lenDecompressor = input.read(RecordType.int.u8);
			lenDecompressor += 0xFFFFFF10;
			lenDecompressor &= 0xFFFFFFF0;
			debug('Decompressor size:', lenDecompressor);
		}
		*/

		if (!lenDecompressor) {
			throw new Error(`Unsupported PKLite version ${version} (0x${verCode.toString(16)})`);
		}

		let output = new RecordBuffer(content.length * 2); // will expand if needed

		// Work out how large the decompressed image is.  This could be more than
		// the data we'll get after decompression, but we need the value to
		// correctly calculate the pgMinExtra header field.
		//
		// TODO: This code produces the wrong header value, due to the decompSize
		// being incorrect.  The unit tests replace this with the correct value
		// so if changing this, be sure to remove that from the tests.
		let decompSizeOffset;
		if (verBase >= 0x132) {
			decompSizeOffset = offDecompressor + 2;
		} else {
			decompSizeOffset = offDecompressor + 1;
		}
		let decompSize = (
			(content[decompSizeOffset + 0])
			| (content[decompSizeOffset + 1] << 8)
		) << 4;
		if (verCode > 0x105) {
			decompSize += 0x100;
		}
		debug(`Decompressed size is: 0x${decompSize.toString(16)}`);

		const decompStart = offDecompressor + lenDecompressor;
		debug(`Compressed data starts at code offset `
			+ `0x${lenDecompressor.toString(16)} / file offset `
			+ `0x${decompStart.toString(16)}`);
		input.seekAbs(decompStart);

		const btCount = flagLarge ? btCountLarge : btCountSmall;

		let bitIndex = 15, bitCache = 0;
		const nextBit = () => {
			const bit = (bitCache >> bitIndex) & 1;
			bitIndex++;
			if (bitIndex === 16) {
				bitCache = input.read(RecordType.int.u16le);
				bitIndex = 0;
			}
			return bit;
		};
		nextBit(); // Fill the bitCache

		readCompressedData: // Name this loop so we can break out of it later.
		while (input.distFromEnd() >= 1) {

			if (nextBit()) {  // "duplication" mode

				let count = btRead(btCount, nextBit);

				if (count === -1) { // special case
					const code = input.read(RecordType.int.u8);
					switch (code) {
						case 0xFE:
							// Skip this bit.
							if (!flagLarge) {
								// TODO: This only applies to later PKLite versions.
								throw new Error('cmp-pklite: Uncompressed regions are not supported.');
							}
							continue;

						case 0xFF:
							// Finished decompression.
							debug(`Code decompression complete at offset 0x${input.getPos().toString(16)}`);
							break readCompressedData; // break out of the switch and the loop

						case 0xFD:
							if (flagLarge) {
								// TODO: This only applies to later PKLite versions.
								throw new Error('cmp-pklite: Uncompressed regions are not supported.');
							}
							// else fall through

						default:
							count = code + (flagLarge ? 25 : 10);
							break;
					}
				}

				let offset = 0;
				if (count !== 2) {
					const offsetCode = btRead(btOffset, nextBit);
					offset = offsetCode << 8;
				}
				const offsetLSB = input.read(RecordType.int.u8);
				offset |= offsetLSB;

				// Copy previously decompressed data to end of output buffer.  Since
				// the window we're copying may overlap with the data we're writing we
				// have to do this manually.
				const offIn = output.getPos() - offset;

				try {
					for (let i = 0; i < count; i++) {
						const off = offIn + i;
						let b;
						if (off < 0) {
							// Offsets that point back before the start of the data should be
							// 0x00 bytes.
							b = 0;
						} else {
							try {
								b = output.dataview.getUint8(off);
							} catch (e) {
								debug(`ERROR: Offset ${off} is out of range 0..${output.length}`);
								b = 0xFF;
							}
						}
						output.write(RecordType.int.u8, b);
					}
				} catch (e) {
					throw new Error(`Window out of range (offset ${offset} => ${offIn}..${offIn + count} of chunk 0..${output.length})`);
				}

			} else { // copy/decryption mode
				const encryptedByte = input.read(RecordType.int.u8);
				let decryptedByte = encryptedByte;
				if (flagExtra) {
					// Decrypt an encrypted byte with an XOR operation based
					// on the current bit index. "bitsRead" is between 0 and 15.
					// It is 0 if the 16th bit of the previous array was used to get here.
					decryptedByte = encryptedByte ^ ((16 - bitIndex) & 0xFF);
				}

				output.write(RecordType.int.u8, decryptedByte);
			}
		}
		debug(`Reached end of data at ${input.getPos()}, ${input.distFromEnd()} bytes remaining`);

		// Use a different method for relocation table expansion if the 'extra'
		// flag is set, and the version is new enough.
		const relocLarge = (
			flagExtra
			&& (verBase >= 0x010C)
		);

		// Decompress the relocation table.
		let relocTable = [];
		let relMSB = -0x0FFF;
		do {
			let count;
			if (relocLarge) {
				count = input.read(RecordType.int.u16le);
				if (count === 0xFFFF) break; // end of list
				relMSB += 0x0FFF;
			} else {
				count = input.read(RecordType.int.u8);
				if (count === 0x00) break;   // end of list
				relMSB = input.read(RecordType.int.u16le);
			}
			debug(`0x${count.toString(16)} entries in next relocation table block`);
			for (let i = 0; i < count; i++) {
				const relLSB = input.read(RecordType.int.u16le);
				relocTable.push((relMSB << 16) | relLSB);
			}
		} while (input.distFromEnd() > 1);

		debug(`Relocation table restoration complete at offset `
			+ `0x${input.getPos().toString(16)} with ${input.distFromEnd()} `
			+ `trailing bytes.`);

		const pkliteFooter = input.readRecord(recordTypes.pkliteFooter);

		// PKLite doesn't use a relocation table but that's the offset where the
		// original .exe header sits (minus the 'MZ').  However if the 'extra' flag
		// is set, it's zeroed out, so only use it if it's available.
		// Decode it so we can use some values from it.
		let origHeader = {}, origHeaderExtra;
		if (!flagExtra) {
			input.seekAbs(offOrigHeader);
			origHeader = input.readRecord(recordTypes.exeHeader);
			const lenOriginalHeader = (exeHeader.pgLenHeader << 4) - offOrigHeader;
			// The original data does from the end of the standard .exe header (which
			// PKLite has copied in to where we are now) until where the original
			// relocation table is supposed to start.  We can't just grab until the
			// end of the PKLite .exe header because PKLite pads it out to the next
			// paragraph boundary and we don't want to copy those padding bytes.
			const lenOriginalTail = Math.min(origHeader.offRelocTable - 2, lenOriginalHeader) - 26;

			// And also extract it as a raw block to preserve any extra header data
			// before the relocation table that we aren't handing in recordTypes.
			debug(`Length of extra data in original header: 0x${lenOriginalTail.toString(16)}`);
			if (lenOriginalTail > 0) {
				origHeaderExtra = input.getU8(offOrigHeader + 26, lenOriginalTail);
			}
		} else {
			// In extra mode, an extra two byte 'signature' is added, so the .exe can
			// check to confirm it was decompressed by PKLite.
			origHeaderExtra = new Uint8Array([
				pkliteHeader.verMinor,
				pkliteHeader.verMajor,
			]);
		}

		if (recalcHeader) {
			// Technically we don't need to recalculate these if !flagExtra, but in
			// case they were tampered with this will restore valid values.  In most
			// cases this will won't change any header values.
			origHeader.offRelocTable = 0x1C + origHeaderExtra.length;
			origHeader.relocCount = relocTable.length;
			origHeader.pgLenHeader = (origHeader.offRelocTable + origHeader.relocCount * 4 + 0x0F) >> 4;
			const lenTotal = (origHeader.pgLenHeader << 4) + output.length;
			origHeader.blockCount = (lenTotal + 0x1FF) >> 9;
			origHeader.lenLastBlock = lenTotal & 0x1FF;

			origHeader.pgMaxExtra = 0xFFFF;
			// TODO: This calculation produces the wrong value, due to the decompSize
			// being incorrect.  The unit tests replace this with the correct value
			// so if changing this, be sure to remove that from the tests.
			origHeader.pgMinExtra = (decompSize - output.length + 0xF) >> 4;
		}

		// We prefer the original header values here rather than the ones PKLite
		// saved as PKLite doesn't always seem to save the correct ones.  It always
		// puts the IP register at 0, even when the original .exe had it as 0x100,
		// which means it runs a bunch of random instructions if the compiler left
		// space in the .exe for the PSP.
		if (origHeader.segSS === undefined) {
			origHeader.segSS = pkliteFooter.segSS;
			origHeader.regSP = pkliteFooter.regSP;
			origHeader.segCS = pkliteFooter.segCS;
			// Other code considers pkliteFooter.regIP the checksum field, but it
			// matches the regIP value in the header and I can't see why it would be
			// important to save the checksum over the IP register, so I'm going to
			// treat it as regIP.
			origHeader.regIP = pkliteFooter.regIP;
		}
		if (origHeader.checksum === undefined) {
			origHeader.checksum = 0;//pkliteFooter.checksum;
		}

		// Start writing the output file, beginning with the 'MZ' signature.
		let outEXE = new RecordBuffer(output.length + origHeader.pgLenHeader + 512);
		outEXE.writeRecord(recordTypes.exeSig, sig);

		// Write out the header and any extra header data.
		outEXE.writeRecord(recordTypes.exeHeader, origHeader);
		if (origHeaderExtra) outEXE.put(origHeaderExtra);

		// Safety check - make sure we're at the expected position.
		if (outEXE.getPos() !== origHeader.offRelocTable) {
			throw new Error(`BUG: Relocation table is supposed to be at offset `
				+ `${origHeader.offRelocTable} but we were going to write it at `
				+ `offset ${outEXE.getPos()}.`);
		}

		// Write out the relocation table.
		for (const r of relocTable) {
			outEXE.write(RecordType.int.u32le, r);
		}

		// Pad from the end of the relocation table up to the end of the original
		// header.
		const lenHeader = origHeader.pgLenHeader << 4;
		const lenPad = lenHeader - outEXE.getPos();
		debug(`Padding relocation table with 0x${lenPad} bytes`);
		if (lenPad < 0) {
			throw new Error(`Original .exe says code is supposed to start at offset `
				+ `0x${lenHeader.toString(16)} but the .exe header ends after this `
				+ `point, at offset 0x${outEXE.getPos().toString(16)}.`);
		}
		outEXE.put(new Uint8Array(lenPad));

		outEXE.put(output);

		// TODO: Copy any trailing data that may have been appended to the .exe.

		return outEXE.getU8();
	}

	/*
	static obscure(content, options = {}) {
		const debug = g_debug.extend('obscure');

		debug('PKLite compression not implemented, doing nothing');

		return content;
	}
	*/
}
