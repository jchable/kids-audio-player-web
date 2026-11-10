import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('sw.js', 'utf8');
const list = /const SHELL_ASSETS = \[([\s\S]*?)\];/.exec(source)[1];
const assets = [...list.matchAll(/'([^']+)'/g)].map((m) => m[1]);

test('tous les fichiers du shell existent : un seul manquant bloquerait l\'installation', () => {
  for (const asset of assets) assert.ok(fs.existsSync(asset), asset);
});

test('tous les scripts du site sont dans le shell', () => {
  const scripts = fs.readdirSync('js', { recursive: true })
    .filter((f) => f.endsWith('.js'))
    .map((f) => `js/${f.replaceAll('\\', '/')}`);
  for (const script of scripts) assert.ok(assets.includes(script), script);
});

test('index.html déclare une politique de sécurité limitée à l\'origine du site', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  const policy = /<meta http-equiv="Content-Security-Policy" content="([^"]+)">/.exec(html)?.[1];
  assert.ok(policy, 'balise CSP absente');
  assert.match(policy, /default-src 'self'/);
  assert.match(policy, /script-src 'self'(;|$)/);
  assert.match(policy, /object-src 'none'/);
  assert.match(policy, /base-uri 'none'/);
  assert.doesNotMatch(policy, /unsafe-eval|https?:|\*/);
});
