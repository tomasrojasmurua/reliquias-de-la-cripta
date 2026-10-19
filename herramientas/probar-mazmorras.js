// Prueba de humo en un navegador de verdad: abre el juego, entra a cada mazmorra por el menú y
// revisa que arranque sin errores, con el mapa armado y los tesoros contados.
// Uso: node herramientas/probar-mazmorras.js   (necesita Playwright: npm install)

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { MAZMORRAS } from '../datos/mazmorras.js';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const TIPOS = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };

const servidor = createServer(async (pet, res) => {
  const ruta = normalize(decodeURIComponent(new URL(pet.url, 'http://x').pathname)).replace(/^[/\\]+/, '') || 'index.html';
  try {
    const datos = await readFile(join(RAIZ, ruta));
    res.writeHead(200, { 'Content-Type': TIPOS[extname(ruta)] || 'application/octet-stream' });
    res.end(datos);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise(r => servidor.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${servidor.address().port}/`;

// WebGL por software, para que corra en máquinas sin tarjeta gráfica (como la de GitHub)
const navegador = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const fallos = [];

for (const [i, m] of MAZMORRAS.entries()) {
  const pagina = await navegador.newPage({ viewport: { width: 1280, height: 720 } });
  const errores = [];
  pagina.on('pageerror', e => errores.push(e.message));
  pagina.on('console', msg => { if (msg.type() === 'error') errores.push(msg.text()); });
  // sin conexión a las fuentes de Google no pasa nada: se usan las del sistema
  await pagina.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  try {
    await pagina.goto(url);
    await pagina.click('#portada [data-ir="mazmorras"]');
    await pagina.locator('#lista-mazmorras .mazmorra').nth(i).click();
    await pagina.click('#btn-entrar');
    await pagina.waitForSelector('body.jugando', { timeout: 15000 });
    await pagina.waitForTimeout(1500);   // unos cuantos cuadros de juego
    const tesoros = await pagina.textContent('#hud-tesoros');
    const total = Number(tesoros.split('/')[1]);
    if (!(total > 0)) errores.push(`el marcador de tesoros dice «${tesoros}»`);
    const vacia = await pagina.evaluate(() => {
      const c = document.querySelector('#vista');
      return !c || c.width === 0 || c.height === 0;
    });
    if (vacia) errores.push('la vista del juego no tiene tamaño');
  } catch (e) {
    errores.push(e.message.split('\n')[0]);
  }
  await pagina.close();
  const ignorados = errores.filter(e => !/fonts\.(googleapis|gstatic)|ERR_FAILED/.test(e));
  if (ignorados.length) fallos.push(`${m.id}:\n  ${ignorados.join('\n  ')}`);
  console.log(`${ignorados.length ? '✗' : '✓'} ${m.nombre}`);
}

await navegador.close();
servidor.close();
if (fallos.length) {
  console.error(`\n${fallos.join('\n')}`);
  process.exit(1);
}
