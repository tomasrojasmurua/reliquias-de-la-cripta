// Revisa que las mazmorras se puedan jugar: carga cada una con varias semillas y en cada tamaño
// (pequeña, mediana y grande) y busca errores que no saltan a la vista en el plano de texto.
// Uso: node herramientas/validar-mazmorras.js [semillas]   (por defecto 25 semillas por mazmorra)

import { MAZMORRAS, tesorosDe } from '../datos/mazmorras.js';
import { TESORO } from '../datos/tesoros.js';
import { EMBLEMAS } from '../datos/emblemas.js';
import { PISTAS } from '../datos/pistas.js';
import { cargarMazmorra } from '../js/mapa.js';
import { recortarZonas } from '../js/laberinto.js';
import { Juego } from '../js/juego.js';
import { crearPalancas } from '../js/palancas.js';
import { azarConSemilla } from '../js/laberinto.js';

const SEMILLAS = Number(process.argv[2]) || 25;
const PASO = 0.45 + 1e-6;   // el escalón más alto que se sube caminando (PASO en js/juego.js)
const SOLIDOS = new Set(['muro', 'vacio', 'tablilla', 'aviso', 'salida']);
const V = [[1, 0], [-1, 0], [0, 1], [0, -1]];

const errores = [];
const error = (donde, texto) => errores.push(`${donde}: ${texto}`);

// Casillas a las que se llega a pie desde el inicio. Las puertas, pasadizos y sellos cuentan como
// abiertos (se abren al jugar); el abismo, las estatuas y los escalones altos de subida, no.
// `abiertos`: si se da, los sellos solo cuentan como abiertos si su acertijo está ahí.
function alcanzables(m, abiertos = null) {
  const pisable = (x, y) => {
    const c = m.celda(x, y);
    if (c && c.tipo === 'sello' && abiertos && !abiertos.has(c.acertijo)) return false;
    return c && !SOLIDOS.has(c.tipo) && !c.estatua && c.peligro !== 'abismo';
  };
  const visto = new Uint8Array(m.ancho * m.alto);
  const x0 = Math.floor(m.inicio.x), y0 = Math.floor(m.inicio.z);
  const cola = [[x0, y0]];
  visto[y0 * m.ancho + x0] = 1;
  while (cola.length) {
    const [x, y] = cola.pop();
    for (const [dx, dy] of V) {
      const nx = x + dx, ny = y + dy;
      if (!pisable(nx, ny) || visto[ny * m.ancho + nx]) continue;
      if (m.piso(nx, ny) - m.piso(x, y) > PASO) continue;
      visto[ny * m.ancho + nx] = 1;
      cola.push([nx, ny]);
    }
  }
  return (x, y) => x >= 0 && y >= 0 && x < m.ancho && y < m.alto && visto[y * m.ancho + x] === 1;
}
// Una casilla sólida (tablilla, salida, aviso) se usa desde una vecina a la que se llega.
const junto = (llega, x, y) => V.some(([dx, dy]) => llega(x + dx, y + dy));

function revisarMapa(def, m, donde, juego) {
  // inicio único
  const inicios = def.plano.join('').split('P').length - 1;
  if (inicios !== 1) error(donde, `tiene ${inicios} casillas de inicio «P» (debe haber una)`);

  // bordes cerrados: nada pisable en el contorno del plano
  for (let y = 0; y < m.alto; y++) for (let x = 0; x < m.ancho; x++) {
    if (x > 0 && y > 0 && x < m.ancho - 1 && y < m.alto - 1) continue;
    const c = m.celda(x, y);
    if (!SOLIDOS.has(c.tipo)) error(donde, `el borde está abierto en (${x}, ${y}): «${c.tipo}»`);
  }

  const llega = alcanzables(m);
  const salidas = [];
  const tablillas = {}, sellos = {};
  for (let y = 0; y < m.alto; y++) for (let x = 0; x < m.ancho; x++) {
    const c = m.celda(x, y);
    if (c.tipo === 'salida') salidas.push([x, y]);
    if (c.tipo === 'tablilla') (tablillas[c.acertijo] ||= []).push([x, y]);
    if (c.tipo === 'sello') (sellos[c.acertijo] ||= []).push([x, y]);
  }
  if (!salidas.length) error(donde, 'no tiene salida «X»');
  else if (!salidas.some(([x, y]) => junto(llega, x, y))) error(donde, 'no se puede llegar a la salida desde el inicio');

  // cada acertijo tiene su tablilla y al menos un sello, y la tablilla se puede leer
  for (const a of Object.values(m.acertijos)) {
    if (!tablillas[a.id]) { error(donde, `al acertijo «${a.id}» le falta su tablilla «${a.caracter}» en el plano`); continue; }
    if (!sellos[a.id]) error(donde, `el acertijo «${a.id}» no abre ningún sello «${a.sello}»`);
    if (!tablillas[a.id].some(([x, y]) => junto(llega, x, y))) error(donde, `no se puede llegar a la tablilla del acertijo «${a.id}»`);
  }
  // sellos sin acertijo que los abra
  for (const id of Object.keys(sellos)) if (!m.acertijos[id]) error(donde, `hay sellos del acertijo «${id}», que no existe`);

  // jugando de verdad: cada tablilla se descifra desde donde se llega con los sellos que ya abriste,
  // así que ninguna puerta puede quedar esperando a una tablilla que está detrás de ella
  const abiertos = new Set();
  for (let cambio = true; cambio;) {
    cambio = false;
    const llegaAhora = alcanzables(m, abiertos);
    for (const [id, pos] of Object.entries(tablillas)) {
      if (!abiertos.has(id) && pos.some(([x, y]) => junto(llegaAhora, x, y))) { abiertos.add(id); cambio = true; }
    }
  }
  for (const id of Object.keys(tablillas)) if (!abiertos.has(id)) error(donde, `la tablilla «${id}» solo se alcanza tras abrir su propia puerta (o una que depende de ella)`);

  // los acertijos sin los que no se llega a la salida no pueden ser difíciles (los demás, que esconden tesoros o
  // zonas, sí)
  if (salidas.length) {
    const todos = Object.keys(m.acertijos);
    for (const id of todos) {
      const sin = alcanzables(m, new Set(todos.filter(o => o !== id)));
      if (salidas.some(([x, y]) => junto(sin, x, y))) continue;
      const max = m.acertijos[id].dificultad[1];
      if (max > 2) error(donde, `el acertijo «${id}» es necesario para salir y tiene dificultad hasta ${max} (máximo 2)`);
    }
  }

  // el revólver: uno solo, y se llega a él desde el inicio
  const revolveres = m.objetos.filter(o => o.tipo === 'revolver');
  if (revolveres.length !== 1) error(donde, `hay ${revolveres.length} revólveres (debe haber uno)`);
  else if (!llega(Math.floor(revolveres[0].x), Math.floor(revolveres[0].z))) error(donde, 'no se puede llegar al revólver');
  if (m.totalSecretos < 1) error(donde, 'no tiene ningún pasadizo secreto');

  // el guardián está en su puesto y se llega a él
  if (def.guardian) {
    const g = juego.guardian;
    if (!g) error(donde, `no hay lugar para el guardián «${def.guardian.nombre}»`);
    else if (!llega(Math.floor(g.x), Math.floor(g.z))) error(donde, `no se puede llegar al guardián en (${Math.floor(g.x)}, ${Math.floor(g.z)})`);
  } else error(donde, 'no tiene guardián');

  // tesoros: existen en el catálogo y se puede llegar a ellos
  for (const o of m.objetos) {
    if (o.tipo !== 'tesoro') continue;
    if (!TESORO[o.tesoro]) error(donde, `el tesoro «${o.tesoro}» no está en datos/tesoros.js`);
    if (!llega(Math.floor(o.x), Math.floor(o.z))) error(donde, `no se puede llegar al tesoro «${o.tesoro}» en (${Math.floor(o.x)}, ${Math.floor(o.z)})`);
  }
}

// Mismas semillas, misma mazmorra (lo necesitan la contrarreloj y una futura expedición diaria).
function firma(m) {
  return m.celdas.map(c => c.tipo[0]).join('') + JSON.stringify(m.objetos);
}

// el juego avisa de lo que pasa con estos eventos; aquí no hace falta escucharlos
const SIN_EVENTOS = new Proxy({}, { get: () => () => {} });

const ids = new Set();
const dueño = {};
const dificultades = new Set(PISTAS.map(p => p[8]));
for (const def of MAZMORRAS) {
  const id = def.id;
  if (ids.has(id)) error(id, 'la id está repetida');
  ids.add(id);
  if (!EMBLEMAS[id]) error(id, 'no tiene emblema en datos/emblemas.js');

  // cada tesoro está en el catálogo y en una sola mazmorra
  for (const t of tesorosDe(def)) {
    if (!TESORO[t]) error(id, `el tesoro «${t}» no está en datos/tesoros.js`);
    if (dueño[t] && dueño[t] !== id) error(id, `el tesoro «${t}» también está en ${dueño[t]}`);
    dueño[t] = id;
  }

  // hay pistas para la dificultad de cada acertijo
  const pedidas = [...Object.values(def.acertijos || {}), ...(def.sectores?.zonas || []).map(z => z.acertijo).filter(Boolean)];
  for (const a of pedidas) {
    const [min, max] = a.dificultad;
    if (![...dificultades].some(d => d >= min && d <= max)) error(id, `no hay pistas de dificultad ${min} a ${max} para «${a.titulo}»`);
  }

  const tamaños = def.sectores ? [1, 2, Infinity] : [Infinity];
  for (const n of tamaños) {
    const variante = recortarZonas(def, n);
    for (let s = 1; s <= SEMILLAS; s++) {
      const donde = `${id} (zonas: ${n === Infinity ? 'todas' : n}, semilla ${s})`;
      let juego;
      try { juego = new Juego(variante, SIN_EVENTOS, s); } catch (e) { error(donde, `no carga: ${e.message}`); continue; }
      const m = juego.mapa;
      revisarMapa(def, m, donde, juego);
      if (s === 1 && firma(cargarMazmorra(variante, s)) !== firma(m)) error(donde, 'la misma semilla da mazmorras distintas');
    }
  }
}

// Los acertijos de palancas tienen una sola solución: se prueban todos los órdenes contra las pistas.
for (let s = 1; s <= 300; s++) {
  const p = crearPalancas(azarConSemilla(s));
  if (!p.unica) error('palancas', `con la semilla ${s} las pistas no dejan un solo orden`);
}

// El mismo error suele repetirse en muchas semillas: se muestra una vez con el número de veces.
const cuenta = new Map();
for (const e of errores) {
  const clave = e.replace(/, semilla \d+\)/, ')');
  cuenta.set(clave, (cuenta.get(clave) || 0) + 1);
}
if (cuenta.size) {
  for (const [e, n] of cuenta) console.error(`✗ ${e}${n > 1 ? ` (${n} semillas)` : ''}`);
  console.error(`\n${cuenta.size} problemas en las mazmorras.`);
  process.exit(1);
}
console.log(`✓ ${MAZMORRAS.length} mazmorras revisadas con ${SEMILLAS} semillas en cada tamaño.`);
