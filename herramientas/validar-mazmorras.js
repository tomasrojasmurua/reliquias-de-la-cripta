import { readFileSync } from 'node:fs';
// Revisa que las mazmorras se puedan jugar: carga cada una con varias semillas y en cada tamaño
// (pequeña, mediana y grande) y busca errores que no saltan a la vista en el plano de texto.
// Uso: node herramientas/validar-mazmorras.js [semillas]   (por defecto 25 semillas por mazmorra)

import { MAZMORRAS, tesorosDe, tesorosDeMapa } from '../datos/mazmorras.js';
import { TESORO, TESOROS } from '../datos/tesoros.js';
import { HISTORIAS } from '../datos/historias.js';
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
  const inicios = m.def.plano.join('').split('P').length - 1;
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
  // cofres: se llega a cada uno y hay al menos una llave por cofre, todas a las que se llega
  const cofres = m.objetos.filter(o => o.cerrado), llaves = m.objetos.filter(o => o.tipo === 'llave');
  for (const o of cofres) if (!llega(Math.floor(o.x), Math.floor(o.z))) error(donde, `no se puede llegar al cofre de «${o.tesoro}»`);
  // un cofre solo guarda reliquias (nada de armas, munición ni vendas) y de rareza rara o mejor
  for (const o of cofres) if (o.tipo !== 'tesoro' || !TESORO[o.tesoro] || TESORO[o.tesoro].rareza === 'comun') error(donde, `un cofre guarda «${o.tesoro}», que no es una reliquia rara o mejor`);
  for (const o of llaves) if (!llega(Math.floor(o.x), Math.floor(o.z))) error(donde, `no se puede llegar a una llave en (${Math.floor(o.x)}, ${Math.floor(o.z)})`);
  if (llaves.length < cofres.length) error(donde, `hay ${cofres.length} cofres y solo ${llaves.length} llaves`);
  // la palanca de hierro: a lo más una, y si está se llega a ella (nunca hace falta para salir: solo abre sellos)
  const barretas = m.objetos.filter(o => o.tipo === 'barreta');
  if (barretas.length > 1) error(donde, `hay ${barretas.length} palancas de hierro (a lo más una)`);
  else if (!barretas.length) error(donde, 'no tiene palanca de hierro oculta');
  else if (!llega(Math.floor(barretas[0].x), Math.floor(barretas[0].z))) error(donde, 'no se puede llegar a la palanca de hierro');
  // la escopeta: una sola, y se llega a ella desde el inicio
  const escopetas = m.objetos.filter(o => o.tipo === 'escopeta');
  if (escopetas.length !== 1) error(donde, `hay ${escopetas.length} escopetas (debe haber una)`);
  else if (!llega(Math.floor(escopetas[0].x), Math.floor(escopetas[0].z))) error(donde, 'no se puede llegar a la escopeta');
  // la Tommy gun, las rocas y los brujos: de la segunda zona en adelante (y solo ahí)
  const zonasN = m.regiones?.length || 1;
  const tommys = m.objetos.filter(o => o.tipo === 'tommy');
  if (zonasN >= 2) {
    if (tommys.length !== 1) error(donde, `hay ${tommys.length} Tommy guns (debe haber una)`);
    else if (!llega(Math.floor(tommys[0].x), Math.floor(tommys[0].z))) error(donde, 'no se puede llegar a la Tommy gun');
    if (!(m.rocas || []).length) error(donde, 'no tiene rocas rodantes');
  } else if (tommys.length || (m.rocas || []).length || m.enemigos.some(e => e.tipo === 'brujo')) error(donde, 'tiene Tommy gun, rocas o brujos en una mazmorra de una sola zona');
  for (const r of m.rocas || []) {
    const fin = [r.x0 + r.dx * r.largo, r.z0 + r.dz * r.largo];
    for (const [x, z] of [[r.x0 + r.dx * 0.5, r.z0 + r.dz * 0.5], fin]) {
      const c = m.celda(Math.floor(x), Math.floor(z));
      if (!c || SOLIDOS.has(c.tipo)) error(donde, `una roca rodante se sale del pasillo en (${x.toFixed(1)}, ${z.toFixed(1)})`);
    }
    if (Math.hypot(r.x0 - m.inicio.x, r.z0 - m.inicio.z) < 8) error(donde, 'una roca rueda demasiado cerca del inicio');
  }
  for (const e of m.enemigos) if (e.tipo === 'brujo' && (m.celda(Math.floor(e.x), Math.floor(e.z))?.zona || 0) < 1) error(donde, 'un brujo en la primera zona');
  if (m.totalSecretos < 1) error(donde, 'no tiene ningún pasadizo secreto');

  // el guardián está en su puesto y se llega a él
  if (def.guardian) {
    const g = juego.guardian;
    if (!g) error(donde, `no hay lugar para el guardián «${def.guardian.nombre}»`);
    else if (!llega(Math.floor(g.x), Math.floor(g.z))) error(donde, `no se puede llegar al guardián en (${Math.floor(g.x)}, ${Math.floor(g.z)})`);
    // la reliquia que suelta: legendaria, única de este guardián y fuera del resto del mapa
    const botin = juego.botinGuardian, id = def.guardian.tesoro;
    if (!id || TESORO[id]?.rareza !== 'legendario') error(donde, `el guardián «${def.guardian.nombre}» no suelta una reliquia legendaria`);
    else if (!botin || botin.tesoro !== id || !botin.cogido) error(donde, 'la reliquia del guardián no está preparada (oculta) al empezar');
    else if (m.objetos.some(o => o.tipo === 'tesoro' && o.tesoro === id)) error(donde, `la reliquia del guardián «${id}» también está escondida en el mapa`);
    else if (juego.objetos.filter(o => o.tipo === 'tesoro' && o.tesoro === id).length !== 1) error(donde, `la reliquia del guardián «${id}» está repetida`);
    else {
      // al caer suelta su reliquia en una casilla a la que se llega, y se puede recoger
      juego.herir(g, g.vida + 1);
      if (botin.cogido) error(donde, 'el guardián cae y no suelta su reliquia');
      else if (!llega(Math.floor(botin.x), Math.floor(botin.z))) error(donde, `la reliquia del guardián cae donde no se llega (${botin.x.toFixed(1)}, ${botin.z.toFixed(1)})`);
      else {
        juego.tomar(botin);   // (con los eventos de mentira, `recoger` espera la respuesta de un anfitrión que no hay)
        if (!juego.tesoros.includes(id)) error(donde, 'la reliquia del guardián no se puede recoger');
      }
    }
  } else error(donde, 'no tiene guardián');

  // cada coloso de piedra lleva una reliquia común de esta mazmorra que suelta al caer
  const comunesDe = new Set(tesorosDeMapa(def).filter(t => TESORO[t]?.rareza === 'comun'));
  for (const e of juego.enemigos.filter(q => q.tipo === 'coloso')) {
    const b = e.botin;
    if (!b || !b.oculto || !b.cogido) { error(donde, 'un coloso no lleva su reliquia'); continue; }
    if (!comunesDe.has(b.tesoro)) error(donde, `el coloso lleva «${b.tesoro}», que no es una reliquia común de la mazmorra`);
    const total = juego.totalTesoros;
    juego.herir(e, e.vida + 1);
    if (b.cogido || b.oculto || juego.totalTesoros !== total + 1) error(donde, 'el coloso cae y no suelta su reliquia');
    else if (!llega(Math.floor(b.x), Math.floor(b.z))) error(donde, `la reliquia del coloso cae donde no se llega (${b.x.toFixed(1)}, ${b.z.toFixed(1)})`);
    else { juego.tomar(b); if (!juego.tesoros.includes(b.tesoro)) error(donde, 'la reliquia del coloso no se puede recoger'); }
  }

  // tesoros: existen en el catálogo y se puede llegar a ellos
  for (const o of m.objetos) {
    if (o.tipo !== 'tesoro') continue;
    if (!TESORO[o.tesoro]) error(donde, `el tesoro «${o.tesoro}» no está en datos/tesoros.js`);
    if (!llega(Math.floor(o.x), Math.floor(o.z))) error(donde, `no se puede llegar al tesoro «${o.tesoro}» en (${Math.floor(o.x)}, ${Math.floor(o.z)})`);
  }
}

// Mismas semillas, misma mazmorra (lo necesitan las salas, donde todos entran a la misma cripta).
function firma(m) {
  return m.celdas.map(c => c.tipo[0]).join('') + JSON.stringify(m.objetos);
}

// el juego avisa de lo que pasa con estos eventos; aquí no hace falta escucharlos
const SIN_EVENTOS = new Proxy({}, { get: () => () => {} });

// cada reliquia tiene su propia descripción, su propia historia y su propio dibujo (js/tesoros-arte.js; la forma de js/texturas.js sirve a una sola por forma)
for (const campo of ['nombre', 'descripcion']) {
  const vistos = new Map();
  for (const t of TESOROS) {
    if (vistos.has(t[campo])) error(t.id, `su ${campo} es igual al de ${vistos.get(t[campo])}`);
    vistos.set(t[campo], t.id);
  }
}
const historias = new Map();
for (const t of TESOROS) {
  const h = HISTORIAS[t.id];
  if (!h) error(t.id, 'no tiene historia en datos/historias.js');
  else if (historias.has(h)) error(t.id, `su historia es igual a la de ${historias.get(h)}`);
  else historias.set(h, t.id);
}
for (const id of Object.keys(HISTORIAS)) if (!TESORO[id]) error(id, 'tiene historia pero no existe en datos/tesoros.js');

// dibujo propio: cada forma conserva el suyo para una sola reliquia, el resto tiene `D.<id>` en js/tesoros-arte.js
const propios = new Set([...readFileSync(new URL('../js/tesoros-arte.js', import.meta.url), 'utf8').matchAll(/^\s{2}D\.(\w+) =/gm)].map(m => m[1]));
for (const id of propios) if (!TESORO[id]) error(id, 'tiene dibujo propio pero no existe en datos/tesoros.js');
const sinPropio = {};
for (const t of TESOROS) if (!propios.has(t.id)) (sinPropio[t.forma] ||= []).push(t.id);
for (const [forma, lista] of Object.entries(sinPropio)) if (lista.length > 1) error(forma, `${lista.join(', ')} comparten el mismo dibujo`);

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

    // salas de varios cazadores: puestos lejanos entre sí, un revólver por cazador y los mismos tesoros
    for (let s = 1; s <= Math.min(SEMILLAS, 15); s++) for (const n2 of [2, 3, 4]) {
      const donde = `${id} (zonas: ${n === Infinity ? 'todas' : n}, ${n2} cazadores, semilla ${s})`;
      let juego;
      try { juego = new Juego(variante, SIN_EVENTOS, s, { jugadores: n2, puesto: 0, real: true }); } catch (e) { error(donde, `no carga: ${e.message}`); continue; }
      const m = juego.mapa;
      if (!m.puestos || m.puestos.length < n2) { error(donde, `solo ${m.puestos?.length || 0} puestos de salida`); continue; }
      const aEl = alcanzables(m);
      for (const q of m.puestos.slice(0, n2)) if (!aEl(Math.floor(q.x), Math.floor(q.z))) error(donde, 'un puesto de salida queda aislado');
      const revolveres = m.objetos.filter(o => o.tipo === 'revolver').length;
      if (revolveres < n2) error(donde, `hay ${revolveres} revólveres para ${n2} cazadores`);
      const tes = m.objetos.filter(o => o.tipo === 'tesoro').length;
      if (tes !== new Juego(variante, SIN_EVENTOS, s).mapa.objetos.filter(o => o.tipo === 'tesoro').length) error(donde, 'cambia el número de tesoros con varios cazadores');
    }
  }
}

// Los acertijos de palancas tienen una sola solución: se prueban todos los órdenes contra las pistas.
for (let s = 1; s <= 300; s++) {
  const p = crearPalancas(azarConSemilla(s));
  if (!p.unica) error('palancas', `con la semilla ${s} las pistas no dejan un solo orden`);
}

// El mismo error suele repetirse en muchas semillas: se muestra una vez con el número de veces.
const cuenta = new Map(); if (process.env.VERBOSO) console.log(errores);
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
