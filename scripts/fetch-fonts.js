/* Récupère Fredoka (variable, sous-ensemble latin) dans fonts/. À lancer une seule fois. */
import fs from 'node:fs';

const CSS_URL = 'https://fonts.googleapis.com/css2?family=Fredoka:wght@400..700&display=swap';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const headers = { 'User-Agent': USER_AGENT };

const css = await (await fetch(CSS_URL, { headers })).text();
const block = css.split('/* latin */')[1];
const url = /url\(([^)]+)\)/.exec(block)[1];
const font = Buffer.from(await (await fetch(url, { headers })).arrayBuffer());

fs.mkdirSync('fonts', { recursive: true });
fs.writeFileSync('fonts/fredoka.woff2', font);
console.log(`fonts/fredoka.woff2 : ${font.length} octets`);
