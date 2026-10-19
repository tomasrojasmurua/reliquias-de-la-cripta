// Convierte la definición de una mazmorra (datos/mazmorras.js) en casillas y objetos.

import { conLaberinto, conZonas, azarConSemilla } from './laberinto.js';
import { colocarHitos } from './hitos.js';
import { repartirEnemigos } from './fauna.js';

// tipo: muro | vacio | suelo | puerta | secreto | sello | tablilla | aviso | salida
// Peligros en el suelo: trampa 'pinchos' (suben y bajan), peligro 'lava' (quema) y 'abismo' (caída mortal).
const LEYENDA_BASE = {
  '#': { tipo: 'muro' },
  ' ': { tipo: 'vacio' },
  '.': { tipo: 'suelo' },
  'P': { tipo: 'suelo', inicio: true },
  'D': { tipo: 'puerta', tex: 'puerta' },
  'S': { tipo: 'secreto', tex: 'piedra_grieta' },
  'X': { tipo: 'salida', tex: 'salida' },
  '%': { tipo: 'muro', tex: 'derrumbe' },
  '!': { tipo: 'muro', tex: 'antorcha', antorcha: true },
  'R': { tipo: 'suelo', objeto: 'revolver' },
  'b': { tipo: 'suelo', objeto: 'balas' },
  'v': { tipo: 'suelo', objeto: 'vendas' },
  'm': { tipo: 'suelo', enemigo: 'momia' },
  'k': { tipo: 'suelo', enemigo: 'esqueleto' },
  'g': { tipo: 'suelo', enemigo: 'draugr' },
  'p': { tipo: 'suelo', enemigo: 'pirata' },
  'j': { tipo: 'suelo', enemigo: 'jaguar' },
  'c': { tipo: 'suelo', enemigo: 'sectario' },
  'n': { tipo: 'suelo', enemigo: 'caballero' },
  '^': { tipo: 'suelo', trampa: 'pinchos', suelo: 'agujeros' },
  '~': { tipo: 'suelo', peligro: 'lava', suelo: 'lava' },
  '_': { tipo: 'suelo', peligro: 'abismo', suelo: 'abismo' },
  ':': { tipo: 'suelo', suelo: 'abismo_puente' },
  'f': { tipo: 'suelo', objeto: 'falso' },
};

const ALTO = 1.25;       // altura de un tramo de muro (igual que ALTO_MURO en render.js)
export const HONDO = 6.25; // profundidad del abismo

// Las mazmorras son oscuras: la luz propia de cada sala se multiplica por esto
// y el resto lo ponen las antorchas de los muros, la lava y la antorcha del jugador.
const PENUMBRA = 0.3;

const SOLIDOS_FIJOS = new Set(['muro', 'vacio', 'tablilla', 'aviso', 'salida']);
export const MOVILES = new Set(['puerta', 'secreto', 'sello']);

// Alturas del suelo: '1'..'9' suben 0.3 m por número; 'a'..'e' bajan 0.3 m por letra.
export function altura(h) {
  if (h >= '1' && h <= '9') return (h.charCodeAt(0) - 48) * 0.3;
  if (h >= 'a' && h <= 'e') return -(h.charCodeAt(0) - 96) * 0.3;
  return 0;
}

// `semilla`: con la misma semilla salen los mismos laberintos (para que todos jueguen la misma mazmorra).
export function cargarMazmorra(def, semilla = Math.floor(Math.random() * 4294967296)) {
  const azar = azarConSemilla(semilla);
  if (def.sectores) def = conZonas(def, azar);
  else if (def.laberinto) def = conLaberinto(def, azar);
  const alto = def.plano.length;
  const ancho = Math.max(...def.plano.map(f => f.length));
  const leyenda = { ...LEYENDA_BASE, ...(def.leyenda || {}) };
  const celdas = [];
  const objetos = [];
  const enemigos = [];
  let inicio = { x: 1.5, z: 1.5 };
  let totalSecretos = 0;
  const acertijos = {};

  for (const [car, texto] of Object.entries(def.avisos || {})) {
    leyenda[car] = { tipo: 'aviso', tex: def.texTablilla || 'tablilla', texto };
  }
  for (const [car, a] of Object.entries(def.acertijos || {})) {
    acertijos[a.id] = { ...a, caracter: car, resuelto: false };
    leyenda[car] = { tipo: 'tablilla', tex: a.texTablilla || def.texTablilla || 'tablilla', acertijo: a.id };
    leyenda[a.sello] = { tipo: 'sello', tex: def.texSello || 'sello', acertijo: a.id };
  }

  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      const car = def.plano[y][x] ?? ' ';
      let l = leyenda[car];
      if (!l && def.tesoros?.[car]) l = { tipo: 'suelo', tesoro: def.tesoros[car] };
      if (!l) throw new Error(`Carácter desconocido «${car}» en ${def.id} (${x}, ${y})`);
      const c = {
        tipo: l.tipo,
        tex: l.tex || (l.tipo === 'suelo' ? null : def.muro),
        suelo: l.suelo || def.suelo, techo: l.techo || def.techo,
        luz: def.luz * PENUMBRA,
        piso: 0, techoY: ALTO, // alturas del suelo y del techo de la casilla
        abierto: 0, abriendo: false,
        acertijo: l.acertijo || null,
        antorcha: !!l.antorcha,
        trampa: l.trampa || null, peligro: l.peligro || null, texto: l.texto || null,
        zona: 0,
      };
      const h = def.alturas?.[y]?.[x];
      if (h && h !== '.' && h !== ' ') { c.piso = altura(h); c.techoY = Math.max(ALTO, c.piso + ALTO); }
      if (l.peligro === 'lava') c.luz = 1.2;
      if (l.tipo === 'puerta' || l.tipo === 'sello') c.tex = l.tex;
      if (l.tipo === 'secreto') totalSecretos++;
      celdas.push(c);
      const cx = x + 0.5, cz = y + 0.5;
      if (l.inicio) inicio = { x: cx, z: cz };
      if (l.objeto) objetos.push({ tipo: l.objeto, x: cx, z: cz });
      if (l.tesoro) objetos.push({ tipo: 'tesoro', tesoro: l.tesoro, x: cx, z: cz, zona: 0 });
      if (l.enemigo) enemigos.push({ tipo: l.enemigo, x: cx, z: cz });
    }
  }

  const mapa = {
    def, ancho, alto, celdas, objetos, enemigos, inicio, acertijos, totalSecretos, semilla,
    regiones: def.regiones || null,
    celda(x, y) {
      if (x < 0 || y < 0 || x >= ancho || y >= alto) return null;
      return celdas[y * ancho + x];
    },
    // ¿Bloquea el paso (y la vista)?
    solida(x, y) {
      const c = this.celda(x, y);
      if (!c) return true;
      if (c.estatua) return true;
      if (SOLIDOS_FIJOS.has(c.tipo)) return true;
      if (MOVILES.has(c.tipo)) return c.abierto < 0.9;
      return false;
    },
    // Altura del suelo en (x, y); las casillas sólidas no cuentan.
    piso(x, y) {
      const c = this.celda(x, y);
      return c ? c.piso : 0;
    },
    // Los enemigos además evitan la lava y el abismo.
    bloqueaEnemigo(x, y) {
      return this.solida(x, y) || !!this.celda(x, y).peligro;
    },
    // ¿Es parte fija de la geometría (no se mueve nunca)?
    fija(x, y) {
      const c = this.celda(x, y);
      return !c || SOLIDOS_FIJOS.has(c.tipo);
    },
  };

  // Zonas con otro suelo, techo o muro: [x0, y0, x1, y1, {suelo, techo, muro, piso, cielo, desnivel}].
  // piso: altura del suelo (escalones de 0.25 a 0.45 se suben caminando); cielo: altura del techo
  // (por defecto piso + 1.25); desnivel: textura de los escalones y paredes entre alturas.
  for (const [x0, y0, x1, y1, z] of def.zonas || []) {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const c = mapa.celda(x, y);
      if (!c) continue;
      if (z.suelo) c.suelo = z.suelo;
      if (z.techo) c.techo = z.techo;
      if (z.piso !== undefined) { c.piso = z.piso; c.techoY = Math.max(c.techoY, z.piso + ALTO); }
      if (z.cielo !== undefined) c.techoY = z.cielo;
      if (z.desnivel) c.muroDesnivel = z.desnivel;
      if (z.muro && c.tipo === 'muro' && !c.antorcha && def.plano[y][x] === '#') c.tex = z.muro;
    }
  }

  // Zonas de la mazmorra (si las tiene): cada casilla y cada tesoro saben a cuál pertenecen.
  (def.regiones || []).forEach((r, i) => {
    for (const [x0, y0, x1, y1] of r.rects) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const c = mapa.celda(x, y); if (c) c.zona = i; }
  });
  for (const o of objetos) o.zona = mapa.celda(Math.floor(o.x), Math.floor(o.z)).zona;

  // El abismo se hunde bajo el suelo de su zona.
  for (const c of celdas) if (c.peligro === 'abismo') c.piso -= HONDO;

  // Luces por zona y resplandor de antorchas.
  for (const [x0, y0, x1, y1, luz] of def.luces || []) {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const c = mapa.celda(x, y); if (c && c.peligro !== 'lava') c.luz = luz * PENUMBRA; }
  }
  for (let y = 0; y < alto; y++) for (let x = 0; x < ancho; x++) {
    const fuente = mapa.celda(x, y);
    if (fuente.peligro === 'lava') {
      for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) {
        const c = mapa.celda(x + i, y + j);
        if (c && c.luz <= 1) c.luz = Math.min(1, c.luz + 0.3 * (1 - Math.hypot(i, j) / 3.2));
      }
      continue;
    }
    if (!fuente.antorcha) continue;
    for (let j = -4; j <= 4; j++) for (let i = -4; i <= 4; i++) {
      const c = mapa.celda(x + i, y + j);
      if (!c) continue;
      const d = Math.hypot(i, j);
      if (c.luz <= 1) c.luz = Math.min(1, c.luz + Math.max(0, 0.6 * (1 - d / 4.5)));
    }
  }

  // Pinturas, relieves y estatuas en las salas de los laberintos (con su propio azar, para no
  // cambiar la mazmorra que sale de la semilla).
  mapa.hitos = colocarHitos(mapa, def.salas || [], azarConSemilla(semilla ^ 0x5bd1e995));
  // Qué monstruos salen y dónde (también con su propio azar).
  repartirEnemigos(mapa, azarConSemilla(semilla ^ 0x2f6b1c3d));
  return mapa;
}
