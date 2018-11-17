const { RecordBuffer, RecordType } = require('@malvineous/record-io-buffer');
const Debug = require('../util/utl-debug.js');

const FORMAT_ID = 'cmp-rle-bash';

/// Trigger byte value for an RLE event.
const RLE_TRIGGER = 0x90;

module.exports = class Compress_RLE_MonsterBash
{
	static metadata() {
		return {
			id: FORMAT_ID,
			title: 'Monster Bash RLE compression',
			options: {
			},
		};
	}

	static reveal(content, options = {})
	{
		try {
			const md = this.metadata();
			Debug.push(md.id, 'reveal');

			let input = new RecordBuffer(content);
			let output = new RecordBuffer(content.length * 1.2);

			const getByte = input.read.bind(input, RecordType.int.u8);
			const putByte = output.write.bind(output, RecordType.int.u8);

			let prevByte = 0;
			while (input.distFromEnd() > 0) {
				const v = getByte();
				if (v === RLE_TRIGGER) {
					let n = getByte();
					if (n !== 0) {
						while (--n) putByte(prevByte);
						continue;
					}
				}
				putByte(v);
				prevByte = v;
			}

			return output.getBuffer();

		} finally {
			Debug.pop();
		}
	}

	static obscure(content, options = {}) {
		try {
			const md = this.metadata();
			Debug.push(md.id, 'obscure');

			let input = new RecordBuffer(content);
			let output = new RecordBuffer(content.length * 1.2);

			const getByte = input.read.bind(input, RecordType.int.u8);
			const putByte = output.write.bind(output, RecordType.int.u8);

			let prevByte = -1, pending = 0;
			while (input.distFromEnd() > 0) {
				const v = getByte();
				if (v === prevByte) {
					pending++;
					if (pending === 255) {
						putByte(RLE_TRIGGER);
						putByte(255);
						pending = 1; // one left over
					}
				} else {
					if (pending) {
						// This byte is different to the last, write out the cached run
						if (pending > 1) {
							putByte(RLE_TRIGGER);
							putByte(pending + 1); // will never be > 255
						} else {
							// For only two chars, it's more efficient not to use the RLE code
							putByte(prevByte);
						}
						pending = 0;
					}
					if (v === RLE_TRIGGER) {
						putByte(RLE_TRIGGER);
						putByte(0);
					} else {
						putByte(v);
					}
					prevByte = v;
				}
			}
			if (pending) {
				// Write out a pending RLE pending
				putByte(RLE_TRIGGER);
				putByte(pending + 1); // will never be > 255
			}

			return output.getBuffer();

		} finally {
			Debug.pop();
		}
	}
};
