import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import type { Plugin } from 'vite'
export function offlineShell(): Plugin {
  return { name: 'mahjong-offline-shell', apply: 'build', enforce: 'post', generateBundle(_, bundle) {
    const publicFiles = (directory: string, prefix = ''): string[] => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? publicFiles(join(directory, entry.name), prefix + entry.name + '/') : [prefix + entry.name])
    const files = publicFiles('public').filter((name) => name !== '_headers')
    const hash = createHash('sha256')
    for (const name of Object.keys(bundle).sort()) { hash.update(name); const output = bundle[name]; hash.update(output.type === 'asset' ? output.source : output.code) }
    for (const name of files.sort()) hash.update(readFileSync(join('public', name)))
    const cache = 'mahjong-buddy-shell-' + hash.digest('hex').slice(0, 16)
    const urls = [...new Set([...Object.keys(bundle), ...files].map((name) => '/' + name))]
    this.emitFile({ type: 'asset', fileName: 'sw.js', source: `
const CACHE = ${JSON.stringify(cache)};
const ASSETS = ${JSON.stringify(urls)};
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS))));
// Wait for old documents to close; never replace code or reload during a hand.
self.addEventListener('activate', event => event.waitUntil(Promise.all([
  caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('mahjong-buddy-shell-') && key !== CACHE).map(key => caches.delete(key)))), self.clients.claim()
])));
self.addEventListener('fetch', event => {
  const request = event.request; const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then(response => { if (!response.ok) throw Error('Navigation unavailable'); return response; }).catch(() => caches.open(CACHE).then(cache => cache.match('/index.html'))));
  } else if (ASSETS.includes(url.pathname) || url.pathname.startsWith('/assets/')) {
    event.respondWith(caches.match(request).then(cached => cached || fetch(request)));
  }
});
` })
  } }
}
