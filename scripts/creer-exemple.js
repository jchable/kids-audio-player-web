/* Crée une bibliothèque de démonstration dans bibliotheque/ pour le développement. */
import fs from 'node:fs';
import path from 'node:path';

const SECONDS = 20;
const FRAME_SECONDS = 1152 / 44100;

function silentMp3(title) {
  // Trame MPEG1 Layer III, 128 kbit/s, 44,1 kHz, mono, sans données : du silence.
  const frame = Buffer.alloc(417);
  frame.set([0xff, 0xfb, 0x90, 0xc4]);
  const frames = Array(Math.ceil(SECONDS / FRAME_SECONDS)).fill(frame);

  const text = Buffer.concat([Buffer.from([0]), Buffer.from(title, 'latin1')]);
  const tag = Buffer.concat([
    Buffer.from('TIT2'), Buffer.from([0, 0, text.length >> 8, text.length & 0xff, 0, 0]), text,
  ]);
  const size = [(tag.length >> 21) & 0x7f, (tag.length >> 14) & 0x7f, (tag.length >> 7) & 0x7f, tag.length & 0x7f];
  return Buffer.concat([Buffer.from('ID3'), Buffer.from([3, 0, 0, ...size]), tag, ...frames]);
}

const BEAR = `<circle cx="-13" cy="-14" r="8" fill="#8A5630"/><circle cx="13" cy="-14" r="8" fill="#8A5630"/><circle cx="-13" cy="-14" r="4" fill="#E9C9A0"/><circle cx="13" cy="-14" r="4" fill="#E9C9A0"/><circle r="20" fill="#9C6137"/><ellipse cy="6" rx="10" ry="8" fill="#E9C9A0"/><circle cx="-7" cy="-4" r="2.4" fill="#2A1A10"/><circle cx="7" cy="-4" r="2.4" fill="#2A1A10"/><ellipse cy="2.5" rx="3.4" ry="2.4" fill="#2A1A10"/><path d="M-4 9q4 3 8 0" stroke="#2A1A10" stroke-width="1.4" fill="none" stroke-linecap="round"/>`;
const bear = (x, y, scale) => `<g transform="translate(${x} ${y}) scale(${scale})">${BEAR}</g>`;

const SCENES = {
  foret: `<rect width="100" height="100" fill="#FFD66B"/><circle cx="78" cy="22" r="12" fill="#FFF3C4"/><path d="M0 62Q30 44 58 60T100 56V100H0Z" fill="#7CBF5B"/><path d="M14 66 26 30 38 66Z" fill="#2F8F5B"/><path d="M68 64 80 34 92 64Z" fill="#3AA06A"/><path d="M0 78Q40 64 100 78V100H0Z" fill="#5DA748"/>${bear(50, 70, 0.95)}`,
  riviere: `<rect width="100" height="100" fill="#A8E3F2"/><path d="M0 50Q50 38 100 50V100H0Z" fill="#7CBF5B"/><path d="M32 46Q58 62 34 78T48 100H92Q66 82 86 68T64 46Z" fill="#3FA9E0"/><path d="M58 74q5-3 10 0M50 88q5-3 10 0" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round"/>${bear(24, 66, 0.8)}`,
  miel: `<rect width="100" height="100" fill="#FFE9A8"/><path d="M0 74Q50 62 100 74V100H0Z" fill="#7CBF5B"/><path d="M58 14h24q7 6 9 13 2 7-2 14 3 8 0 15-5 8-12 10H60q-8-3-11-11-2-7 1-14-4-8-1-15 3-8 9-12Z" fill="#F2A52B"/><path d="M50 30h40M48 44h42M52 58h36" stroke="#C97F12" stroke-width="2.5"/><circle cx="70" cy="50" r="5" fill="#5B3A10"/>${bear(28, 72, 0.82)}`,
  dodo: `<rect width="100" height="100" fill="#28316B"/><circle cx="74" cy="24" r="13" fill="#FFE9A8"/><circle cx="80" cy="20" r="11" fill="#28316B"/><g fill="#FFE9A8"><circle cx="20" cy="18" r="1.8"/><circle cx="42" cy="30" r="1.4"/><circle cx="58" cy="12" r="1.5"/><circle cx="12" cy="42" r="1.4"/></g><path d="M0 76Q50 62 100 76V100H0Z" fill="#3F5A3A"/>${bear(50, 70, 0.95)}`,
  lune: `<rect width="100" height="100" fill="#3A3F91"/><circle cx="50" cy="42" r="24" fill="#FFE9A8"/><circle cx="42" cy="36" r="4" fill="#EBD07F"/><circle cx="60" cy="50" r="5.5" fill="#EBD07F"/><g fill="#FFE9A8"><circle cx="80" cy="60" r="1.6"/><circle cx="20" cy="58" r="1.6"/></g><path d="M0 82Q50 68 100 82V100H0Z" fill="#232768"/>`,
};

const svg = (scene) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">${SCENES[scene]}</svg>\n`;

function writeBook(id, files) {
  const dir = path.join('bibliotheque', id);
  fs.mkdirSync(dir, { recursive: true });
  for (const [name, content] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), content);
}

writeBook('le-petit-ours', {
  'album.json': `${JSON.stringify({ title: 'Le petit ours' }, null, 2)}\n`,
  'couverture.svg': svg('foret'),
  '01-la-foret.mp3': silentMp3('La forêt'),
  '01-la-foret.svg': svg('foret'),
  '02-la-riviere.mp3': silentMp3('La rivière'),
  '02-la-riviere.svg': svg('riviere'),
  '03-le-miel.mp3': silentMp3('Le miel'),
  '03-le-miel.svg': svg('miel'),
  '04-au-dodo.mp3': silentMp3('Au dodo'),
  '04-au-dodo.svg': svg('dodo'),
});

const longBook = { 'album.json': `${JSON.stringify({ title: 'Bonne nuit' }, null, 2)}\n`, 'couverture.svg': svg('lune') };
for (let n = 1; n <= 12; n += 1) {
  longBook[`${String(n).padStart(2, '0')}-chapitre.mp3`] = silentMp3(`Chapitre ${n}`);
}
writeBook('bonne-nuit', longBook);

console.log('Bibliothèque de démonstration créée. Lancez ensuite : npm run catalogue');
