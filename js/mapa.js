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
  'ĥ': { tipo: 'muro', tex: 'antorcha_apagada', apagada: true },   // se enciende sola al acercarle la antorcha del jugador
  'R': { tipo: 'suelo', objeto: 'revolver' },
  'b': { tipo: 'suelo', objeto: 'balas' },
  'v': { tipo: 'suelo', objeto: 'vendas' },
  'w': { tipo: 'suelo', objeto: 'barreta' },
  'ʞ': { tipo: 'suelo', objeto: 'llave' },   // llave de un solo uso para un cofre
  'z': { tipo: 'suelo', objeto: 'escopeta' },
  'q': { tipo: 'suelo', objeto: 'cartuchos' },
  'ɸ': { tipo: 'suelo', objeto: 'tommy' },
  'ʠ': { tipo: 'suelo', objeto: 'municionT' },
  // casilla por donde pasa una roca rodante (su pasillo se calcula más abajo)
  'ŗ': { tipo: 'suelo', roca: true },
  // muro de una trampa de dardos: dispara a lo largo del pasillo recto que tiene delante
  'ð': { tipo: 'muro', tex: 'dardos', dardos: true },
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

const V4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
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
        antorcha: !!l.antorcha, apagada: !!l.apagada, dardos: !!l.dardos, roca: !!l.roca,
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
      if (l.tesoro) {
        const cofre = !!def.cofres?.includes(car);   // el tesoro está dentro de un cofre cerrado con llave
        objetos.push({ tipo: 'tesoro', tesoro: l.tesoro, x: cx, z: cz, zona: 0, cofre, cerrado: cofre });
      }
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

  // El resplandor de una antorcha de muro sobre las casillas de alrededor (también al encenderse una apagada).
  mapa.iluminar = (x, y) => {
    for (let j = -4; j <= 4; j++) for (let i = -4; i <= 4; i++) {
      const c = mapa.celda(x + i, y + j);
      if (!c) continue;
      const d = Math.hypot(i, j);
      if (c.luz <= 1) c.luz = Math.min(1, c.luz + Math.max(0, 0.6 * (1 - d / 4.5)));
    }
  };
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
    if (fuente.antorcha) mapa.iluminar(x, y);
  }

  // Trampas de dardos: hacia dónde dispara cada una y hasta dónde llega (hasta el primer obstáculo, 14 casillas como mucho).
  mapa.dardos = [];
  celdas.forEach((c, i) => {
    if (!c.dardos) return;
    const x = i % ancho, y = Math.floor(i / ancho);
    const libres = V4.filter(([dx, dy]) => { const v = mapa.celda(x + dx, y + dy); return v && v.tipo === 'suelo' && !v.peligro; });
    if (libres.length !== 1) return;
    const [dx, dy] = libres[0];
    let largo = 0;
    for (let k = 1; k <= 14; k++) { const v = mapa.celda(x + dx * k, y + dy * k); if (!v || v.tipo !== 'suelo' || v.peligro === 'abismo') break; largo = k; }
    if (largo < 3) return;
    const carril = Array.from({ length: largo }, (_, k) => [x + dx * (k + 1), y + dy * (k + 1)]);   // las casillas por donde pasa el dardo
    mapa.dardos.push({ carril, x: x + 0.5, z: y + 0.5, dx, dz: dy, largo: largo - 0.2, y: mapa.piso(x + dx, y + dy), fase: (x * 0.37 + y * 0.61) % 3.4 });
  });

  // Rocas rodantes: la casilla marcada está en un pasillo; la roca va y viene por el tramo recto más largo que pasa por ella
  // (sobre suelo llano, sin abismos, de 7 a 16 casillas).
  mapa.rocas = [];
  celdas.forEach((c, i) => {
    if (!c.roca) return;
    const x = i % ancho, y = Math.floor(i / ancho);
    const firme = (cx, cy) => { const v = mapa.celda(cx, cy); return v && v.tipo === 'suelo' && !v.peligro && !v.trampa; };
    let mejor = null;
    for (const [dx, dy] of [[1, 0], [0, 1]]) {
      let a = 0, b = 0;
      while (a < 16 && firme(x - dx * (a + 1), y - dy * (a + 1))) a++;
      while (b < 16 && firme(x + dx * (b + 1), y + dy * (b + 1))) b++;
      if (!mejor || a + b > mejor.a + mejor.b) mejor = { dx, dy, a, b };
    }
    if (mejor.a + mejor.b < 6) return;
    const { dx, dy, a, b } = mejor;
    mapa.rocas.push({ x0: x + 0.5 - dx * (a + 0.5), z0: y + 0.5 - dy * (a + 0.5), dx, dz: dy, largo: a + b, y: mapa.piso(x, y), fase: (x * 0.73 + y * 0.41) % 7 });
  });

  // Pinturas, relieves y estatuas en las salas de los laberintos (con su propio azar, para no
  // cambiar la mazmorra que sale de la semilla).
  mapa.hitos = colocarHitos(mapa, def.salas || [], azarConSemilla(semilla ^ 0x5bd1e995));
  // Qué monstruos salen y dónde (también con su propio azar).
  repartirEnemigos(mapa, azarConSemilla(semilla ^ 0x2f6b1c3d));
  mapa.puestos = repartirPuestos(mapa);
  return mapa;
}

// Dónde empieza cada cazador de una sala (hasta 4): el puesto 0 es el inicio de siempre y los demás se reparten por lo que
// se puede recorrer sin abrir sellos, lo más lejos posible unos de otros (por camino, no en línea recta).
// Solo depende del mapa, así que todos los navegadores calculan los mismos puestos.
export const PUESTOS = 4;
function repartirPuestos(m) {
  const { ancho, alto } = m, N = ancho * alto;
  const origen = { x: m.inicio.x, z: m.inicio.z };
  const camina = (x, y) => { const c = m.celda(x, y); return !!c && !c.peligro && !c.estatua && (c.tipo === 'suelo' || c.tipo === 'puerta'); };
  const bfs = desde => {
    const d = new Int32Array(N).fill(-1), q = [desde];
    d[desde] = 0;
    for (let k = 0; k < q.length; k++) {
      const i = q[k], x = i % ancho, y = (i - x) / ancho;
      for (const [dx, dy] of V4) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= ancho || ny >= alto || !camina(nx, ny)) continue;
        const j = ny * ancho + nx;
        if (d[j] < 0) { d[j] = d[i] + 1; q.push(j); }
      }
    }
    return d;
  };
  // casillas que no sirven para empezar: trampas, el pasillo de un dardo o una roca, y lo que queda cerca de un objeto o un enemigo
  const mala = new Uint8Array(N);
  const vetar = (x, y, r) => { for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) { const nx = Math.floor(x) + i, ny = Math.floor(y) + j; if (nx >= 0 && ny >= 0 && nx < ancho && ny < alto) mala[ny * ancho + nx] = 1; } };
  for (const o of m.objetos) vetar(o.x, o.z, 1);
  for (const e of m.enemigos) vetar(e.x, e.z, 5);
  for (const d of m.dardos || []) for (let k = 0; k <= d.largo + 1; k++) vetar(d.x + d.dx * k, d.z + d.dz * k, 0);
  for (const r of m.rocas || []) for (let k = 0; k <= r.largo; k++) vetar(r.x0 + r.dx * k, r.z0 + r.dz * k, 1);
  m.celdas.forEach((c, i) => { if (c.trampa || c.roca || c.tipo !== 'suelo') mala[i] = 1; });
  const dist = [bfs(Math.floor(origen.z) * ancho + Math.floor(origen.x))];
  const lista = [{ ...origen, yaw: m.def.angulo || 0 }];
  while (lista.length < PUESTOS) {
    let mejor = -1, md = 0;
    for (let i = 0; i < N; i++) {
      if (mala[i] || dist[0][i] < 0) continue;
      const d = Math.min(...dist.map(q => q[i]));
      if (d > md) { md = d; mejor = i; }
    }
    if (mejor < 0 || md < 6) { lista.push({ ...lista[0] }); continue; }   // mapa diminuto: se comparte el inicio
    const x = mejor % ancho, y = (mejor - x) / ancho;
    // mira hacia donde el pasillo se abre más
    let yaw = 0, largo = -1;
    for (const [dx, dy] of V4) { let k = 0; while (k < 12 && camina(x + dx * (k + 1), y + dy * (k + 1))) k++; if (k > largo) { largo = k; yaw = Math.atan2(dy, dx); } }
    lista.push({ x: x + 0.5, z: y + 0.5, yaw });
    dist.push(bfs(mejor));
  }
  return lista;
}
