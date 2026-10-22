/**
 * servidor.mjs — Servidor local para probar Finax en la computadora.
 * Sin dependencias: solo Node. Uso:
 *   node servidor.mjs          → http://localhost:5173
 *   node servidor.mjs --red    → también visible en tu Wi-Fi (para abrirlo en el iPhone)
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { networkInterfaces } from 'node:os';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = fileURLToPath(new URL('.', import.meta.url));
const puerto = Number(process.env.PORT) || 5173;
const enRed = process.argv.includes('--red');
const tipos = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

createServer(async (req, res) => {
  let ruta = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  if (ruta.endsWith('/')) ruta += 'index.html';
  const archivo = normalize(join(raiz, ruta));
  if (!archivo.startsWith(raiz)) return res.writeHead(403).end();
  try {
    const contenido = await readFile(archivo);
    res.writeHead(200, { 'Content-Type': tipos[extname(archivo)] ?? 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(contenido);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('No encontrado');
  }
}).listen(puerto, enRed ? '0.0.0.0' : '127.0.0.1', () => {
  console.log(`Finax en http://localhost:${puerto}`);
  if (enRed) {
    for (const red of Object.values(networkInterfaces()).flat()) {
      if (red.family === 'IPv4' && !red.internal) console.log(`En tu Wi-Fi: http://${red.address}:${puerto}`);
    }
  }
});
