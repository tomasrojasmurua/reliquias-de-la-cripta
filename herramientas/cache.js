// Mantiene al día la lista de archivos que sw.js guarda para jugar sin conexión.
// ARCHIVOS se arma con todo lo que el juego carga, y el nombre del CACHE lleva una huella de su
// contenido: cualquier cambio en esos archivos da un CACHE nuevo y los jugadores reciben la versión nueva.
// Uso: node herramientas/cache.js            reescribe sw.js
//      node herramientas/cache.js --revisar  solo avisa si sw.js quedó desactualizado (lo usa la revisión automática)

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const CARPETAS = ['js', 'datos', 'iconos', 'fuentes-web'];
const SUELTOS = ['index.html', 'css/estilo.css', 'manifest.webmanifest'];

// recorre las subcarpetas (js/vendor) y deja fuera los textos de licencias
const listar = c => readdirSync(join(RAIZ, c), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))
  .flatMap(e => e.isDirectory() ? listar(`${c}/${e.name}`) : e.name.endsWith('.txt') ? [] : [`${c}/${e.name}`]);
const archivos = [...SUELTOS, ...CARPETAS.flatMap(listar)];
const huella = createHash('sha256');
for (const a of archivos) huella.update(a).update(readFileSync(join(RAIZ, a)));
const cache = `reliquias-${huella.digest('hex').slice(0, 10)}`;

// en líneas de unos 110 caracteres, como estaba escrita a mano
const lineas = [];
let linea = "  './',";
for (const a of archivos) {
  const pieza = ` '${a}',`;
  if (linea.length + pieza.length > 110) { lineas.push(linea); linea = ' '; }
  linea += pieza;
}
lineas.push(linea);

const ruta = join(RAIZ, 'sw.js');
const antes = readFileSync(ruta, 'utf8');
const despues = antes
  .replace(/const CACHE = '[^']*';/, `const CACHE = '${cache}';`)
  .replace(/const ARCHIVOS = \[[\s\S]*?\];/, `const ARCHIVOS = [\n${lineas.join('\n')}\n];`);

if (process.argv.includes('--revisar')) {
  if (antes !== despues) {
    console.error('✗ sw.js está desactualizado: corre «node herramientas/cache.js» y sube el cambio.');
    process.exit(1);
  }
  console.log(`✓ sw.js al día (${archivos.length + 1} archivos, ${cache}).`);
} else {
  writeFileSync(ruta, despues);
  console.log(antes === despues ? `sw.js ya estaba al día (${cache}).` : `sw.js actualizado: ${cache}.`);
}
