/*
 * PKLite .exe decompression algorithm.
 *
 * Algorithm originally from OpenTESArena: (MIT licence)
 *   https://github.com/afritz1/OpenTESArena/blob/master/OpenTESArena/src/Assets/ExeUnpacker.cpp
 *
 * Parts also from refkeen: (MIT Licence)
 *   https://github.com/NY00123/refkeen/blob/master/src/depklite/depklite.c
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
		regIP: RecordType.int.u16le,
	},
};

// Bit table from pklite_specification.md, section 4.3.1 "Number of bytes".
// The decoded value for a given vector is (index + 2) before index 11, and
// (index + 1) after index 11.
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

// This is not quite right yet.
const btCountSmall = [
	[ // 0b0
		[ // 0b00
			3, // 0b000
			[ // 0b001
				2, // 0b0010
				-1  // 0b0011
			]
		], [ // 0b01
			[ // 0b010
				4, // 0b0100
				5  // 0b0101
			], [ // 0b011
				[ // 0b0110
					6, // 0b01100
					7 // 0b01101
				], [ // 0b0111
					-1, // 0b01110
					9  // 0b01111
				]
			]
		]
	], [ // 0b1
		2, // 0b10
		3  // 0b11
	]
];

// Bit table from pklite_specification.md, section 4.3.2 "Offset".
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
			options: {},
		};
	}

	static identify(content) {
		const debug = g_debug.extend('identify');

		let input = new RecordBuffer(content);

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

	static reveal(content)
	{
		const debug = g_debug.extend('reveal');

		let input = new RecordBuffer(content);
		let outEXE = new RecordBuffer(content.length * 2); // TODO: Length

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

		debug(`PKLite version ${version}, large=${flagLarge ? 'on' : 'off'}, `
			+ `extra=${flagExtra ? 'on' : 'off'}`);

		debug(`EXE header size: 0x${(exeHeader.pgLenHeader << 4).toString(16)}`);
		debug(`Relocation table at 0x${exeHeader.offRelocTable.toString(16)}`);
		debug(`Relocation table size: 0x${exeHeader.relocCount.toString(16)}`);
		const offOrigHeader = exeHeader.offRelocTable + exeHeader.relocCount * 4;
		debug(`Offset of original header: 0x${offOrigHeader.toString(16)}`);

		if (!flagLarge) {
			throw new Error('Unable to decompress files where "large" flag is off.');
		}

		// PKLite doesn't use a relocation table but that's the offset where the
		// original .exe header sits (minus the 'MZ').
		// Decode it so we can use some values from it.
		input.seekAbs(offOrigHeader);
		const origHeader = input.readRecord(recordTypes.exeHeader);
		// And also extract it as a raw block to preserve any extra header data
		// before the relocation table that we aren't handing in recordTypes.
		const lenOrigHeader = origHeader.offRelocTable - 2;
		const origHeaderRaw = input.getU8(exeHeader.offRelocTable, lenOrigHeader);

		// Write 'MZ' followed by the original header.
		outEXE.writeRecord(recordTypes.exeSig, sig);
		outEXE.put(origHeaderRaw);

		//input.seekAbs(800);//process.env.offset);
		//input.seekAbs(parseInt(process.env.offset));

		// Use the original .exe header to work out how large the file was.  This
		// size includes the full original header, but not any non-EXE data that
		// may have been tacked onto the end of the file.
		let lenLastBlock = origHeader.lenLastBlock;
		if (lenLastBlock === 0) lenLastBlock = 512;
		const decompressedSize = ((origHeader.blockCount - 1) * 512)
			+ lenLastBlock;

		let output = new RecordBuffer(decompressedSize); // will expand if needed

		// Start of the code, where the PKLite decompressor sits.
		const offDecompressor = exeHeader.pgLenHeader << 4;
		// Jump to code where the address of the compressed data is loaded.
		input.seekAbs(offDecompressor + 0x4E);
		const pgOffCompressedData = input.read(RecordType.int.u8);
		// The data at offset offDecompressor is loaded in memory at segment offset
		// 0x100, so pgCompressedData is relative to the data starting at 0x100.
		// We need to adjust it to start from wherever offDecompressor is to convert
		// the value to a file offset.
		const memoffDecompStart = pgOffCompressedData << 4;
		const decompStart = offDecompressor + memoffDecompStart - 0x100;
		debug(`Compressed data starts at segment offset `
			+ `0x${memoffDecompStart.toString(16)} / file offset `
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

		while (input.distFromEnd() >= 1) {

			if (nextBit()) {  // "duplication" mode

				let count = btRead(btCount, nextBit);

				if (count === -1) { // special case
					const code = input.read(RecordType.int.u8);
					if (code === 0xFE) {
						// Skip this bit.
						continue;
					} else if (code === 0xFF) {
						// Finished decompression.
						debug(`Code decompression complete at offset 0x${input.getPos().toString(16)}`);
						break;
					} else {
						count = code + (flagLarge ? 25 : 10);
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

		// Decompress the relocation table.
		do {
			// Values are 16-bit if large flag is on, otherwise 8-bit.
			let count = input.read(flagLarge ? RecordType.int.u16le : RecordType.int.u8);
			debug(`0x${count.toString(16)} entries in next relocation table block`);
			if (count === 0xFFFF) break; // end of list
			if (count === 0x00) break; // end of list
			const relMSB = 0;//input.read(RecordType.int.u16le) << 16;
			for (let i = 0; i < count; i++) {
				const relLSB = input.read(RecordType.int.u16le);
				const rel = relMSB | relLSB;
				debug(`Reloc ${j++}, entry ${k++}, remaining ${input.distFromEnd()}: 0x${rel.toString(16)}`);
				outEXE.write(RecordType.int.u32le, rel);
			}
		} while (input.distFromEnd() > 1);
		debug(`Relocation table restoration complete at offset `
			+ `0x${input.getPos().toString(16)} with ${input.distFromEnd()} `
			+ `trailing bytes.`);

		if (input.distFromEnd() >= 8) {
			const pkliteFooter = input.readRecord(recordTypes.pkliteFooter);
			debug(pkliteFooter);
		} else {
			debug('Missing PKLite footer');
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
