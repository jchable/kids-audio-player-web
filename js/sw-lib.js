/* Fonctions du service worker. Script classique : aucun import ni export. */
globalThis.SwLib = {
  parseRange(header, size) {
    if (!header) return null;
    const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
    if (!match || (match[1] === '' && match[2] === '')) return null;

    let start;
    let end;
    if (match[1] === '') {
      start = Math.max(0, size - Number(match[2]));
      end = size - 1;
    } else {
      start = Number(match[1]);
      end = match[2] === '' ? size - 1 : Math.min(Number(match[2]), size - 1);
    }
    return start > end || start >= size ? 'unsatisfiable' : { start, end };
  },

  /* Un seul fichier manquant fait échouer l'installation : l'ancienne version reste en place. */
  async precache(cache, assets, makeRequest) {
    await Promise.all(assets.map((asset) => cache.add(makeRequest(asset))));
  },

  /* Garde le dernier catalogue valide et les couvertures lors d'un changement de version. */
  async carryOver(caches, targetName, prefix) {
    const target = await caches.open(targetName);
    const names = (await caches.keys()).filter((n) => n !== targetName && n.startsWith(prefix));
    for (const name of names) {
      const previous = await caches.open(name);
      for (const request of await previous.keys()) {
        if (/catalogue\.json$|\/bibliotheque\//.test(request.url) && !(await target.match(request))) {
          await target.put(request, await previous.match(request));
        }
      }
    }
  },

  isAudioPath(pathname) {
    return /\/bibliotheque\/.+\.mp3$/i.test(pathname);
  },

  /* Un SVG ouvert directement (lien, QR code) pourrait exécuter un script sur l'origine du site.
     Affiché par <img>, il n'est pas concerné par cette politique et reste identique. */
  withSvgPolicy(response, pathname) {
    const type = response.headers.get('Content-Type') || '';
    if (!/\.svg$/i.test(pathname) && !/^image\/svg\+xml/i.test(type)) return response;
    const headers = new Headers(response.headers);
    headers.set('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox");
    headers.set('X-Content-Type-Options', 'nosniff');
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  },

  /* Seuls les fichiers de l'application vont dans le cache du shell. */
  isShellAsset(url, scope, assets) {
    const { origin, pathname } = new URL(url);
    return assets.some((asset) => new URL(asset, scope).href === origin + pathname);
  },

  isValidCatalogueText(text) {
    try {
      return Array.isArray(JSON.parse(text).books);
    } catch {
      return false;
    }
  },
};
