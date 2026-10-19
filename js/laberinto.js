// Laberintos que cambian en cada partida: túneles con bifurcaciones y callejones sin salida,
// salas con hordas o vacías, trampas, y unos pocos tesoros escondidos en los ramales más hondos.
//
// Dos usos (ver datos/mazmorras.js):
//  - `laberinto`: un bloque de túneles pegado abajo o a la derecha del plano fijo.
//  - `sectores`: la mazmorra crece en varias zonas generadas. Cada zona tiene sus salas, sus reliquias
//    y una tablilla cuyo acertijo abre el sello hacia la siguiente; la última esconde un pasadizo secreto
//    hacia una cámara extra. La salida se esconde en un ramal hondo de alguna zona del medio.
//
// Todo el azar sale de `azar`, así que con la misma semilla sale la misma mazmorra (para el multijugador).

const ENEMIGOS = 'mkgpjcn';
const V = [[0, -1], [1, 0], [0, 1], [-1, 0]];

// Generador con semilla (mulberry32).
export function azarConSemilla(semilla) {
  let s = semilla >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function herramientas(azar) {
  return {
    elegir: a => a[Math.floor(azar() * a.length)],
    mezclar: a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(azar() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; },
  };
}

// Talla un bloque de W x H (impares, con su propio borde de muro). `entradas` son casillas del borde por
// donde se llega; la primera es la principal y desde ella se miden las distancias.
export function tallar(W, H, entradas, { salas: nSalas, azar }) {
  const { elegir, mezclar } = herramientas(azar);
  const g = Array.from({ length: H }, () => Array(W).fill('#'));
  const alt = Array.from({ length: H }, () => Array(W).fill('.'));
  const dentro = (x, y) => x > 0 && y > 0 && x < W - 1 && y < H - 1;
  const impar = (n, lado) => Math.min(Math.max(n | 1, 1), lado - 2);

  // cada entrada se une por un pasillo corto a la casilla impar más cercana
  const interiores = entradas.map(([ex, ey]) => {
    let x = ex, y = ey;
    g[y][x] = '.';
    if (ey === 0) y = 1; else if (ey === H - 1) y = H - 2; else if (ex === 0) x = 1; else x = W - 2;
    const ix = impar(x, W), iy = impar(y, H);
    for (; x !== ix; x += Math.sign(ix - x)) g[y][x] = '.';
    for (; y !== iy; y += Math.sign(iy - y)) g[y][x] = '.';
    g[iy][ix] = '.';
    return [ix, iy];
  });
  const [ix, iy] = interiores[0];

  // 1. Túneles: backtracker recursivo, que deja muchos callejones sin salida.
  const visto = new Set([ix + ',' + iy]);
  const pila = [[ix, iy]];
  while (pila.length) {
    const [x, y] = pila[pila.length - 1];
    const opciones = mezclar(V.slice()).filter(([dx, dy]) => dentro(x + dx * 2, y + dy * 2) && !visto.has((x + dx * 2) + ',' + (y + dy * 2)));
    if (!opciones.length) { pila.pop(); continue; }
    const [dx, dy] = opciones[0];
    g[y + dy][x + dx] = '.'; g[y + dy * 2][x + dx * 2] = '.';
    visto.add((x + dx * 2) + ',' + (y + dy * 2));
    pila.push([x + dx * 2, y + dy * 2]);
  }

  // 2. Salas en medio de los túneles (cortan los pasillos que cruzan).
  const salas = [];
  nSalas = nSalas ?? Math.round(W * H / 110);
  for (let k = 0, intentos = 0; k < nSalas && intentos < 200; intentos++) {
    const w = elegir([3, 3, 5, 5, 7]), h = elegir([3, 3, 5]);
    const x0 = 1 + 2 * Math.floor(azar() * ((W - 1 - w) / 2)), y0 = 1 + 2 * Math.floor(azar() * ((H - 1 - h) / 2));
    if (x0 + w > W - 1 || y0 + h > H - 1) continue;
    if (interiores.some(([ex, ey]) => Math.abs(x0 - ex) + Math.abs(y0 - ey) < 6)) continue; // las entradas quedan libres
    if (salas.some(s => x0 < s.x1 + 2 && s.x0 < x0 + w + 2 && y0 < s.y1 + 2 && s.y0 < y0 + h + 2)) continue;
    const s = { x0, y0, x1: x0 + w - 1, y1: y0 + h - 1 };
    for (let y = s.y0; y <= s.y1; y++) for (let x = s.x0; x <= s.x1; x++) g[y][x] = '.';
    // algunas salas están un escalón más arriba o más abajo
    const nivel = elegir(['.', '.', 'a', '1']);
    for (let y = s.y0; y <= s.y1; y++) for (let x = s.x0; x <= s.x1; x++) alt[y][x] = nivel;
    salas.push(s); k++;
  }

  // 3. Algunos atajos: se tumba la pared de un tercio de los callejones (quedan muchos).
  const abiertos = (x, y) => V.filter(([dx, dy]) => g[y + dy]?.[x + dx] !== '#' && g[y + dy]?.[x + dx] !== undefined).length;
  const esEntrada = (x, y) => interiores.some(([a, b]) => a === x && b === y);
  const callejones = () => {
    const r = [];
    for (let y = 1; y < H - 1; y += 2) for (let x = 1; x < W - 1; x += 2) if (g[y][x] === '.' && abiertos(x, y) === 1 && !esEntrada(x, y)) r.push([x, y]);
    return r;
  };
  for (const [x, y] of callejones()) {
    if (azar() > 0.3) continue;
    const muros = V.filter(([dx, dy]) => g[y + dy][x + dx] === '#' && dentro(x + dx * 2, y + dy * 2) && g[y + dy * 2][x + dx * 2] === '.');
    if (muros.length) { const [dx, dy] = elegir(muros); g[y + dy][x + dx] = '.'; }
  }

  // Una sala puede caer sobre casillas macizas y quedar aislada: se le abre un paso.
  for (let vuelta = 0; vuelta < 50; vuelta++) {
    const llega = new Set([ix + ',' + iy]);
    const q = [[ix, iy]];
    while (q.length) {
      const [x, y] = q.pop();
      for (const [dx, dy] of V) { const k = (x + dx) + ',' + (y + dy); if (dentro(x + dx, y + dy) && g[y + dy][x + dx] !== '#' && !llega.has(k)) { llega.add(k); q.push([x + dx, y + dy]); } }
    }
    let unido = true;
    busca: for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      if (g[y][x] === '#' || llega.has(x + ',' + y)) continue;
      unido = false;
      for (const [dx, dy] of V) if (dentro(x + dx * 2, y + dy * 2) && g[y + dy][x + dx] === '#' && llega.has((x + dx * 2) + ',' + (y + dy * 2))) { g[y + dy][x + dx] = '.'; break busca; }
    }
    if (unido) break;
  }

  // Distancia desde la entrada principal (para esconder lo valioso en lo más hondo).
  const dist = new Map([[ix + ',' + iy, 0]]);
  const cola = [[ix, iy]];
  while (cola.length) {
    const [x, y] = cola.shift();
    for (const [dx, dy] of V) {
      const nx = x + dx, ny = y + dy, k = nx + ',' + ny;
      if (dentro(nx, ny) && g[ny][nx] !== '#' && !dist.has(k)) { dist.set(k, dist.get(x + ',' + y) + 1); cola.push([nx, ny]); }
    }
  }
  const d = (x, y) => dist.get(x + ',' + y) ?? 0;
  const enSala = (x, y) => salas.some(s => x >= s.x0 && x <= s.x1 && y >= s.y0 && y <= s.y1);
  // callejones fuera de las salas, del más hondo al menos hondo
  const finales = () => callejones().filter(([x, y]) => !enSala(x, y)).sort((a, b) => d(...b) - d(...a));
  return { W, H, g, alt, salas, dentro, d, enSala, finales, interiores, azar };
}

// El muro del fondo de un callejón (el opuesto a su abertura).
function fondo(t, [x, y]) {
  const ab = V.find(([dx, dy]) => t.g[y + dy][x + dx] !== '#');
  if (!ab) return null;
  return [x - ab[0], y - ab[1]];
}

// Pone una tablilla en el muro de la sala más honda (o al fondo del callejón más hondo).
function ponerTablilla(t, car, alAzar = false) {
  const { g, salas, d, dentro } = t;
  const porHondura = salas.slice().sort((a, b) => d(b.x0, b.y0) - d(a.x0, a.y0));
  // las tablillas de las cámaras van en cualquier sala, empezando por una al azar
  if (alAzar) herramientas(t.azar).mezclar(porHondura);
  for (const s of porHondura) {
    const muros = [];
    for (let x = s.x0; x <= s.x1; x++) { muros.push([x, s.y0 - 1]); muros.push([x, s.y1 + 1]); }
    for (let y = s.y0; y <= s.y1; y++) { muros.push([s.x0 - 1, y]); muros.push([s.x1 + 1, y]); }
    const ok = muros.filter(([x, y]) => dentro(x, y) && g[y][x] === '#');
    if (ok.length) { const [x, y] = herramientas(t.azar).elegir(ok); g[y][x] = car; return [x, y]; }
  }
  for (const pos of t.finales()) {
    const f = fondo(t, pos);
    if (f && g[f[1]][f[0]] === '#') { g[f[1]][f[0]] = car; return f; }
  }
  return null;
}

// Tesoros al fondo de los callejones, y en el resto balas, vendas, emboscadas o nada. Los primeros
// `camaras.length` tesoros quedan en cámaras selladas: el sello se abre con el acertijo de una tablilla
// que está en alguna sala del mismo bloque. Los demás, la mitad de las veces tras un muro agrietado.
// Después, algunos enemigos en las salas, antorchas y trampas de pinchos.
function poblar(t, ids, nuevoCaracter, tiposEnemigo, camaras = []) {
  const { g, W, H, salas, dentro, d, enSala, azar } = t;
  const { elegir, mezclar } = herramientas(azar);
  const enemigo = () => elegir(tiposEnemigo.length ? tiposEnemigo : ['k']);
  const finales = t.finales();
  const tesoros = {};
  const hondos = finales.slice(0, Math.max(ids.length + 1, Math.ceil(finales.length * 0.4)));
  mezclar(hondos);
  ids.forEach((id, n) => {
    const c = nuevoCaracter();
    tesoros[c] = id;
    const camara = camaras[n];
    // una cámara sellada necesita un callejón cuyo pasillo no dé a una sala
    const libre = ([x, y]) => { const [dx, dy] = V.find(([dx, dy]) => g[y + dy][x + dx] === '.') || [0, 0]; return (dx || dy) && !enSala(x + dx, y + dy); };
    let pos = camara ? (hondos.find(libre) || finales.find(libre)) : null;
    if (pos && hondos.includes(pos)) hondos.splice(hondos.indexOf(pos), 1);
    pos = pos || hondos.shift() || finales.pop();
    if (!pos) { // casi sin callejones: la casilla de pasillo más lejana
      let mejor = null;
      for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) if (g[y][x] === '.' && !enSala(x, y) && (!mejor || d(x, y) > d(...mejor))) mejor = [x, y];
      pos = mejor;
    }
    if (finales.includes(pos)) finales.splice(finales.indexOf(pos), 1);
    const [x, y] = pos;
    // la mitad de las veces el callejón se tapia con un muro agrietado: un nicho secreto
    g[y][x] = c;
    const [dx, dy] = V.find(([dx, dy]) => g[y + dy][x + dx] === '.') || [0, 0];
    if (camara && (dx || dy) && !enSala(x + dx, y + dy)) {
      g[y + dy][x + dx] = camara.sello;
      if (!ponerTablilla(t, camara.tablilla, true)) g[y + dy][x + dx] = '.';
      else camara.puesta = true;
    } else if (azar() < 0.5 && (dx || dy) && !enSala(x + dx, y + dy)) g[y + dy][x + dx] = 'S';
  });
  for (const [x, y] of finales) {
    const r = azar();
    if (r < 0.2) g[y][x] = 'b';
    else if (r < 0.3) g[y][x] = 'v';
    else if (r < 0.4) g[y][x] = enemigo(); // algo espera al fondo del callejón
  }

  for (const s of salas) {
    const casillas = [];
    for (let y = s.y0; y <= s.y1; y++) for (let x = s.x0; x <= s.x1; x++) if (g[y][x] === '.') casillas.push([x, y]);
    mezclar(casillas);
    const r = azar();
    const n = r < 0.4 ? 1 + Math.floor(azar() * 3) : r < 0.65 ? 1 : 0;
    for (let i = 0; i < n && casillas.length; i++) { const [x, y] = casillas.pop(); g[y][x] = enemigo(); }
    if (azar() < 0.35 && casillas.length) { const [x, y] = casillas.pop(); g[y][x] = azar() < 0.6 ? 'b' : 'v'; }
    // antorcha en una pared de la sala
    if (azar() < 0.6) {
      const muros = [];
      for (let x = s.x0; x <= s.x1; x++) { muros.push([x, s.y0 - 1]); muros.push([x, s.y1 + 1]); }
      for (let y = s.y0; y <= s.y1; y++) { muros.push([s.x0 - 1, y]); muros.push([s.x1 + 1, y]); }
      const ok = muros.filter(([x, y]) => dentro(x, y) && g[y][x] === '#');
      if (ok.length) { const [x, y] = elegir(ok); g[y][x] = '!'; }
    }
  }

  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    if (g[y][x] !== '.' || enSala(x, y) || d(x, y) < 4 || azar() > 0.03) continue;
    const recto = (g[y][x - 1] === '#' && g[y][x + 1] === '#') || (g[y - 1][x] === '#' && g[y + 1][x] === '#');
    if (recto) g[y][x] = '^';
  }
  return tesoros;
}

const tiposDe = def => [...new Set(def.plano.join('').split('').filter(c => ENEMIGOS.includes(c)))];

// Caracteres libres para tablillas y sellos nuevos (los que no usa ya el plano ni sus acertijos).
const CARACTERES_ACERTIJO = [['U', 'Y'], ['V', 'W'], ['H', 'I'], ['J', 'K'], ['E', 'F'], ['G', 'N'], ['A', 'B'], ['C', 'O'], ['M', 'R']];
function paresLibres(def) {
  const usados = new Set([...def.plano.join(''), ...Object.keys(def.acertijos || {}), ...Object.values(def.acertijos || {}).map(a => a.sello), ...Object.keys(def.leyenda || {}), 'R']);
  return CARACTERES_ACERTIJO.filter(([a, b]) => !usados.has(a) && !usados.has(b));
}
const TITULOS_CAMARA = ['La inscripción del nicho', 'La placa del guardián', 'El grabado del relicario', 'Las palabras del constructor', 'La marca del saqueador', 'El acertijo de la cámara', 'La plegaria del sepulturero', 'El verso del umbral'];

// Prepara `n` cámaras selladas con sus acertijos; después de poblar, `cerrar` quita las que no cupieron.
function camarasNuevas(n, pares, acertijos, def) {
  const camaras = [];
  for (let k = 0; k < n && pares.length; k++) {
    const [tablilla, sello] = pares.shift();
    const num = Object.values(acertijos).filter(a => a.camara).length;
    acertijos[tablilla] = { id: `${def.id}-camara${num + 1}`, tipo: 'pista', dificultad: [2, 3], sello, titulo: TITULOS_CAMARA[num % TITULOS_CAMARA.length], camara: true };
    camaras.push({ tablilla, sello });
  }
  camaras.cerrar = () => { for (const c of camaras) if (!c.puesta) delete acertijos[c.tablilla]; };
  return camaras;
}

// Devuelve una copia de la definición con el laberinto añadido al plano.
export function conLaberinto(def, azar = Math.random) {
  const L = def.laberinto;
  // impares: las casillas del laberinto van en coordenadas impares
  let W = L.ancho | 1, H = L.alto | 1;
  if (L.lado === 'abajo' && W > def.plano[0].length) W -= 2;
  const abajo = L.lado === 'abajo';
  const [px, py] = L.puerta;
  const t = tallar(W, H, [abajo ? [px, 0] : [0, py]], { salas: L.salas, azar });
  const libres = '0123456789'.split('').filter(c => !(c in def.tesoros));
  const acertijos = { ...def.acertijos };
  const camaras = camarasNuevas(L.camaras ?? Math.min(2, L.tesoros.length), paresLibres(def), acertijos, def);
  const tesoros = { ...def.tesoros, ...poblar(t, L.tesoros, () => libres.shift(), tiposDe(def), camaras) };
  camaras.cerrar();

  // Pegar el laberinto al plano fijo.
  const filas = t.g.map(r => r.join('')), filasAlt = t.alt.map(r => r.join(''));
  const base = def.plano.map(f => f.split(''));
  base[py][px] = 'D';
  const anchoBase = def.plano[0].length, altoBase = def.plano.length;
  const altBase = def.alturas || def.plano.map(f => '.'.repeat(f.length));
  let plano, alturas, rect;
  if (abajo) {
    plano = [...base.map(f => f.join('')), ...filas.map(f => f.padEnd(anchoBase, '#'))];
    alturas = [...altBase, ...filasAlt.map(f => f.padEnd(anchoBase, '.'))];
    rect = [0, altoBase, W - 1, altoBase + H - 1];
  } else {
    plano = base.map((f, y) => f.join('') + (filas[y] ?? '#'.repeat(W)));
    alturas = altBase.map((f, y) => f + (filasAlt[y] ?? '.'.repeat(W)));
    for (let y = altoBase; y < H; y++) { plano.push('#'.repeat(anchoBase) + filas[y]); alturas.push('.'.repeat(anchoBase) + filasAlt[y]); }
    rect = [anchoBase, 0, anchoBase + W - 1, H - 1];
  }
  const luz = L.luz ?? def.luz * 0.75;
  return {
    ...def, plano, alturas, tesoros, acertijos,
    luces: [[...rect, luz], ...(def.luces || [])],
    zonas: [...(def.zonas || []), ...(L.zona ? [[...rect, L.zona]] : [])],
    regionLaberinto: rect,
  };
}

// ---------- Mazmorra por zonas ----------
//
// def.sectores: {
//   bloques: [{ x, y, ancho, alto, zona }]  bloques de túneles en el plano total (cada uno con su borde);
//                                          `zona` es el índice en `zonas` (0 = la del plano fijo).
//   zonas: [{ nombre, tesoros: [ids], acertijo: { dificultad, titulo }, camaras }]
//          `camaras`: cuántas de sus reliquias quedan en cámaras selladas con su propia tablilla.
//          la zona i (salvo la última) tiene una tablilla que abre el sello hacia la zona i + 1;
//          la última (la cámara extra) se alcanza por un pasadizo secreto y un sello que abre la tablilla
//          de la penúltima.
//   pasos: [[desde, hacia, x, y]]  muro compartido entre dos bloques por donde va el sello: (x, y) es la
//          casilla del borde del bloque `desde`; la de al lado, en el bloque `hacia`, se abre como entrada.
//   entrada: [x, y] casilla del borde del primer bloque que da al plano fijo (puerta).
//   salida: [zonas posibles] la salida se esconde en un ramal hondo de una de ellas, al azar.
// }
const CARACTERES_TESORO = 'ΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩ';

export function conZonas(def, azar = Math.random) {
  const Z = def.sectores, { elegir } = herramientas(azar);
  const anchoBase = def.plano[0].length, altoBase = def.plano.length;
  const ancho = Math.max(anchoBase, ...Z.bloques.map(b => b.x + b.ancho));
  const alto = Math.max(altoBase, ...Z.bloques.map(b => b.y + b.alto));
  const plano = Array.from({ length: alto }, (_, y) => Array.from({ length: ancho }, (_, x) => def.plano[y]?.[x] ?? '#'));
  const altBase = def.alturas || [];
  const alturas = Array.from({ length: alto }, (_, y) => Array.from({ length: ancho }, (_, x) => {
    const h = altBase[y]?.[x];
    return x < anchoBase && y < altoBase && h ? h : '.';
  }));
  const tesoros = { ...def.tesoros }, acertijos = { ...def.acertijos };
  const usados = new Set(def.plano.join(''));
  const pares = paresLibres(def);
  const caracteresTesoro = [...CARACTERES_TESORO].filter(c => !usados.has(c));
  const tipos = tiposDe(def);

  // dónde cae cada paso: el sello en el bloque de origen, la entrada en el de destino
  const dentroDe = (b, x, y) => x >= b.x && y >= b.y && x < b.x + b.ancho && y < b.y + b.alto;
  const bloqueEn = (x, y) => Z.bloques.findIndex(b => dentroDe(b, x, y));
  const entradas = Z.bloques.map(() => []);
  const sellos = Z.bloques.map(() => []);
  const [ex0, ey0] = Z.entrada;
  entradas[bloqueEn(ex0, ey0)].push([ex0, ey0]);
  for (const [desde, hacia, x, y] of Z.pasos) {
    const vecina = V.map(([dx, dy]) => [x + dx, y + dy]).find(([nx, ny]) => bloqueEn(nx, ny) >= 0 && Z.bloques[bloqueEn(nx, ny)].zona === hacia);
    sellos[Z.bloques.findIndex(b => b.zona === desde && dentroDe(b, x, y))].push({ x, y, hacia });
    entradas[bloqueEn(...vecina)].push(vecina);
  }

  // un acertijo por zona que abre el paso a la siguiente
  const ultima = Z.zonas.length - 1;
  const selloDe = {};
  Z.zonas.forEach((z, i) => {
    if (!z.acertijo || i === ultima) return;
    const [car, sello] = pares.shift();
    acertijos[car] = { id: `${def.id}-zona${i + 1}`, tipo: 'pista', dificultad: z.acertijo.dificultad, sello, titulo: z.acertijo.titulo };
    selloDe[i + 1] = sello;
    z.caracterTablilla = car;
  });

  // la salida va a una de las zonas posibles
  const zonaSalida = elegir(Z.salida);
  const talladas = Z.bloques.map((b, k) => {
    const loc = entradas[k].map(([x, y]) => [x - b.x, y - b.y]);
    // las casillas donde van los sellos se abren hacia dentro desde el bloque: son entradas también
    for (const s of sellos[k]) loc.push([s.x - b.x, s.y - b.y]);
    const t = tallar(b.ancho, b.alto, loc, { azar });
    const z = Z.zonas[b.zona];
    // la tablilla de la zona va en su primer bloque
    if (z.caracterTablilla && Z.bloques.findIndex(o => o.zona === b.zona) === k) ponerTablilla(t, z.caracterTablilla);
    if (b.zona === zonaSalida && Z.bloques.findIndex(o => o.zona === b.zona) === k) {
      // un ramal hondo, pero no el más hondo de todos (esos son para las reliquias)
      const fin = t.finales();
      const candidatos = fin.slice(Math.min(fin.length - 1, 2), Math.max(3, Math.ceil(fin.length * 0.5)));
      for (const pos of candidatos) {
        const f = fondo(t, pos);
        if (f && t.g[f[1]][f[0]] === '#') { t.g[f[1]][f[0]] = 'X'; break; }
      }
    }
    const primero = Z.bloques.findIndex(o => o.zona === b.zona) === k;
    const camaras = camarasNuevas(primero ? z.camaras ?? 0 : 0, pares, acertijos, def);
    Object.assign(tesoros, poblar(t, primero ? z.tesoros : [], () => caracteresTesoro.shift(), tipos, camaras));
    camaras.cerrar();
    // los sellos (y el pasadizo secreto antes del sello de la cámara extra)
    for (const s of sellos[k]) {
      const lx = s.x - b.x, ly = s.y - b.y;
      t.g[ly][lx] = s.hacia === ultima ? 'S' : selloDe[s.hacia];
    }
    return t;
  });
  // en la cámara extra, el sello va justo después del pasadizo secreto
  for (const [desde, hacia, x, y] of Z.pasos) {
    if (hacia !== ultima) continue;
    const [nx, ny] = V.map(([dx, dy]) => [x + dx, y + dy]).find(([nx, ny]) => bloqueEn(nx, ny) >= 0 && Z.bloques[bloqueEn(nx, ny)].zona === hacia);
    const k = bloqueEn(nx, ny), b = Z.bloques[k];
    talladas[k].g[ny - b.y][nx - b.x] = selloDe[hacia];
  }
  // pegar los bloques
  Z.bloques.forEach((b, k) => {
    const t = talladas[k];
    for (let y = 0; y < b.alto; y++) for (let x = 0; x < b.ancho; x++) { plano[b.y + y][b.x + x] = t.g[y][x]; alturas[b.y + y][b.x + x] = t.alt[y][x]; }
  });
  // la puerta del plano fijo hacia el primer bloque
  const pf = V.map(([dx, dy]) => [ex0 + dx, ey0 + dy]).find(([x, y]) => x < anchoBase && y < altoBase && bloqueEn(x, y) < 0);
  if (pf) plano[pf[1]][pf[0]] = 'D';

  // regiones de cada zona (para el HUD y el automapa)
  const regiones = Z.zonas.map((z, i) => ({
    nombre: z.nombre,
    rects: [...(i === 0 ? [[0, 0, anchoBase - 1, altoBase - 1]] : []), ...Z.bloques.filter(b => b.zona === i).map(b => [b.x, b.y, b.x + b.ancho - 1, b.y + b.alto - 1])],
  }));
  const luces = Z.bloques.map(b => [b.x, b.y, b.x + b.ancho - 1, b.y + b.alto - 1, b.luz ?? def.luz * 0.75]);
  return {
    ...def, tesoros, acertijos,
    plano: plano.map(f => f.join('')), alturas: alturas.map(f => f.join('')),
    luces: [...luces, ...(def.luces || [])],
    zonas: [...(def.zonas || []), ...Z.bloques.filter(b => b.textura).map(b => [b.x, b.y, b.x + b.ancho - 1, b.y + b.alto - 1, b.textura])],
    regiones,
  };
}
