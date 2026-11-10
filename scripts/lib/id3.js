/* Lecture du titre (cadre TIT2) d'un tag ID3v2.3 ou 2.4, sans dépendance. */

const syncsafe = (b, o) => (b[o] << 21) | (b[o + 1] << 14) | (b[o + 2] << 7) | b[o + 3];

function decodeText(bytes) {
  const encoding = bytes[0];
  const data = bytes.subarray(1);
  let text;
  if (encoding === 0) {
    text = data.toString('latin1');
  } else if (encoding === 3) {
    text = data.toString('utf8');
  } else if (encoding === 1 && data[0] === 0xfe && data[1] === 0xff) {
    text = Buffer.from(data.subarray(2)).swap16().toString('utf16le');
  } else if (encoding === 1) {
    text = data.subarray(data[0] === 0xff ? 2 : 0).toString('utf16le');
  } else if (encoding === 2) {
    text = Buffer.from(data.subarray(0, data.length & ~1)).swap16().toString('utf16le');
  } else {
    return null;
  }
  return text.replace(/\0+$/, '').trim() || null;
}

export function readId3Title(buf) {
  if (buf.length < 10 || buf.toString('latin1', 0, 3) !== 'ID3') return null;
  const version = buf[3];
  if (version !== 3 && version !== 4) return null;

  let pos = 10;
  const end = Math.min(10 + syncsafe(buf, 6), buf.length);
  if (buf[5] & 0x40) pos += version === 4 ? syncsafe(buf, pos) : buf.readUInt32BE(pos) + 4;

  while (pos + 10 <= end) {
    const id = buf.toString('latin1', pos, pos + 4);
    if (!/^[A-Z0-9]{4}$/.test(id)) return null;
    const size = version === 4 ? syncsafe(buf, pos + 4) : buf.readUInt32BE(pos + 4);
    const start = pos + 10;
    if (id === 'TIT2') return decodeText(buf.subarray(start, Math.min(start + size, end)));
    pos = start + size;
  }
  return null;
}
