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
    // y la casilla que se sella no puede ser un cruce: así el sello nunca le cierra el paso a otra cosa (la salida, un sello de zona)
    const sellable = (x, y, dx, dy) => (dx || dy) && !enSala(x + dx, y + dy) && V.filter(([vx, vy]) => g[y + dy + vy][x + dx + vx] !== '#').length === 2;
    const libre = ([x, y]) => { const [dx, dy] = V.find(([dx, dy]) => g[y + dy][x + dx] === '.') || [0, 0]; return sellable(x, y, dx, dy); };
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
    if (camara && sellable(x, y, dx, dy)) {
      g[y + dy][x + dx] = camara.sello;
      if (!ponerTablilla(t, camara.tablilla, true)) g[y + dy][x + dx] = '.';
      else camara.puesta = true;
    } else if (azar() < 0.5 && (dx || dy) && !enSala(x + dx, y + dy)) g[y + dy][x + dx] = 'S';
  });
  for (const [x, y] of finales) {
    const r = azar();
    if (r < 0.2) g[y][x] = azar() < 0.4 ? 'q' : 'b';
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
const CARACTERES_ACERTIJO = [['U', 'Y'], ['V', 'W'], ['H', 'I'], ['J', 'K'], ['E', 'F'], ['G', 'N'], ['A', 'B'], ['C', 'O'], ['M', 'R'], ['α', 'β'], ['γ', 'δ'], ['ε', 'ζ'], ['η', 'θ'],
  ['ι', 'κ'], ['λ', 'μ'], ['ν', 'ξ'], ['ο', 'π'], ['ρ', 'σ'], ['τ', 'υ'], ['φ', 'χ'], ['ψ', 'ω'],
  ['Б', 'Г'], ['Д', 'Ж'], ['З', 'И'], ['Л', 'П'], ['Ф', 'Ц'], ['Ч', 'Ш'], ['Э', 'Ю'], ['Я', 'Щ']];
function paresLibres(def) {
  const usados = new Set([...def.plano.join(''), ...Object.keys(def.acertijos || {}), ...Object.values(def.acertijos || {}).map(a => a.sello), ...Object.keys(def.leyenda || {}), 'R']);
  return CARACTERES_ACERTIJO.filter(([a, b]) => !usados.has(a) && !usados.has(b));
}
const TITULOS_PALANCAS = ['El mecanismo de los símbolos', 'Las palancas del relicario', 'La cerradura del constructor', 'El cerrojo de los cuatro signos'];
const TITULOS_CAMARA = ['La inscripción del nicho', 'La placa del guardián', 'El grabado del relicario', 'Las palabras del constructor', 'La marca del saqueador', 'El acertijo de la cámara', 'La plegaria del sepulturero', 'El verso del umbral'];

// Prepara `n` cámaras selladas con sus acertijos; después de poblar, `cerrar` quita las que no cupieron.
// Una de cada dos se abre con palancas (js/palancas.js) en vez de una pista críptica.
function camarasNuevas(n, pares, acertijos, def) {
  const camaras = [];
  for (let k = 0; k < n && pares.length; k++) {
    const [tablilla, sello] = pares.shift();
    const num = Object.values(acertijos).filter(a => a.camara).length;
    const palancas = num % 2 === 1;
    acertijos[tablilla] = {
      id: `${def.id}-camara${num + 1}`, tipo: palancas ? 'palancas' : 'pista', dificultad: [2, 3], sello, camara: true,
      titulo: palancas ? TITULOS_PALANCAS[(num >> 1) % TITULOS_PALANCAS.length] : TITULOS_CAMARA[num % TITULOS_CAMARA.length],
    };
    camaras.push({ tablilla, sello });
  }
  camaras.cerrar = () => { for (const c of camaras) if (!c.puesta) delete acertijos[c.tablilla]; };
  return camaras;
}

const TITULOS_VIA = ['El grabado del atajo', 'La losa de la puerta lateral', 'El códice de la galería oculta', 'La advertencia del arquitecto', 'El sello del almacén', 'La clave del pasadizo', 'El relieve del dintel', 'La cifra del portal', 'El epitafio del vigía', 'La leyenda del cerrojo', 'La estrofa del centinela', 'El mensaje del cantero'];

// Un acertijo de más: una tablilla que abre una puerta de un camino opcional (atajo o sala lateral).
// Devuelve { tablilla, sello } o null si ya no quedan caracteres libres.
function nuevaVia(pares, acertijos, def, dificultad) {
  if (!pares.length) return null;
  const [tablilla, sello] = pares.shift();
  const num = Object.values(acertijos).filter(a => a.via).length;
  const palancas = num % 3 === 2;
  acertijos[tablilla] = {
    id: `${def.id}-via${num + 1}`, tipo: palancas ? 'palancas' : 'pista', dificultad, sello, via: true,
    titulo: palancas ? TITULOS_PALANCAS[(num + 1) % TITULOS_PALANCAS.length] + (num >= 8 ? ' II' : '') : TITULOS_VIA[num % TITULOS_VIA.length] + (num >= TITULOS_VIA.length ? ' II' : ''),
  };
  return { tablilla, sello };
}
const quitarVia = (acertijos, v) => { delete acertijos[v.tablilla]; };

// Atajos tras una puerta con acertijo: un muro entre dos pasillos que quedan lejos uno de otro por el
// camino normal. Sin resolver la tablilla, todo sigue igual; resuelta, la puerta ahorra un buen rodeo.
function ponerAtajos(t, n, pares, acertijos, def, dificultad) {
  const { g, dentro, d, enSala, alt } = t;
  const nivel = c => c === 'a' ? -1 : c === '1' ? 1 : 0;
  const hechos = [];
  for (let k = 0; k < n; k++) {
    const candidatos = [];
    for (let y = 2; y < t.H - 2; y++) for (let x = 2; x < t.W - 2; x++) {
      if (g[y][x] !== '#' || enSala(x, y)) continue;
      for (const [dx, dy] of [[1, 0], [0, 1]]) {
        const ax = x - dx, ay = y - dy, bx = x + dx, by = y + dy;
        if (g[ay]?.[ax] !== '.' || g[by]?.[bx] !== '.') continue;
        if (g[y + dx]?.[x + dy] !== '#' || g[y - dx]?.[x - dy] !== '#') continue;
        if (Math.abs(nivel(alt[ay][ax]) - nivel(alt[by][bx])) > 1) continue;
        const salto = Math.abs(d(ax, ay) - d(bx, by));
        if (salto >= 18 && !hechos.some(([hx, hy]) => Math.abs(hx - x) + Math.abs(hy - y) < 8)) candidatos.push([x, y, salto]);
      }
    }
    if (!candidatos.length) break;
    candidatos.sort((a, b) => b[2] - a[2]);
    const [x, y] = herramientas(t.azar).elegir(candidatos.slice(0, Math.max(1, Math.ceil(candidatos.length / 3))));
    const via = nuevaVia(pares, acertijos, def, dificultad);
    if (!via) break;
    g[y][x] = via.sello;
    if (!ponerTablilla(t, via.tablilla, true)) { g[y][x] = '#'; quitarVia(acertijos, via); continue; }
    hechos.push([x, y]);
  }
  return hechos.length;
}

// Trampas de dardos: un muro al fondo de un pasillo recto (de 6 casillas o más) que dispara a lo largo de él.
// `g` es la rejilla de caracteres; no se ponen cerca del inicio ni dentro de las salas.
function ponerDardos(g, azar, n, enSala = () => false) {
  const { mezclar } = herramientas(azar);
  const H = g.length, W = g[0].length;
  const inicio = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (g[y][x] === 'P') inicio.push([x, y]);
  const candidatos = [];
  for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) {
    if (g[y][x] !== '#' || enSala(x, y)) continue;
    const abiertos = V.filter(([dx, dy]) => g[y + dy][x + dx] === '.');
    if (abiertos.length !== 1) continue;
    const [dx, dy] = abiertos[0];
    let largo = 0;
    while (g[y + dy * (largo + 1)]?.[x + dx * (largo + 1)] === '.') largo++;
    if (largo < 6 || inicio.some(([px, py]) => Math.abs(px - x) + Math.abs(py - y) < 12)) continue;
    candidatos.push([x, y]);
  }
  mezclar(candidatos);
  const puestos = [];
  for (const [x, y] of candidatos) {
    if (puestos.length >= n) break;
    if (puestos.some(([px, py]) => Math.abs(px - x) + Math.abs(py - y) < 10)) continue;
    g[y][x] = 'ð';
    puestos.push([x, y]);
  }
  return puestos.length;
}

// Rocas rodantes: la casilla marcada ('ŗ') está en el medio de un tramo recto de 7 casillas libres o más;
// js/mapa.js calcula por dónde rueda. Lejos del inicio, fuera de las salas y espaciadas entre sí.
function ponerRocas(g, azar, n, enSala = () => false) {
  const { mezclar } = herramientas(azar);
  const H = g.length, W = g[0].length;
  const inicio = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (g[y][x] === 'P') inicio.push([x, y]);
  const libre = (x, y) => g[y]?.[x] === '.' && !enSala(x, y);
  const candidatos = [];
  for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) {
    for (const [dx, dy] of [[1, 0], [0, 1]]) {
      if (!libre(x, y) || libre(x - dx, y - dy)) continue;   // el primero de un tramo
      let largo = 0;
      while (libre(x + dx * largo, y + dy * largo)) largo++;
      if (largo < 7) continue;
      const mx = x + dx * (largo >> 1), my = y + dy * (largo >> 1);
      if (inicio.some(([px, py]) => Math.abs(px - mx) + Math.abs(py - my) < 12)) continue;
      candidatos.push([mx, my]);
    }
  }
  mezclar(candidatos);
  const puestas = [];
  for (const [x, y] of candidatos) {
    if (puestas.length >= n) break;
    if (puestas.some(([px, py]) => Math.abs(px - x) + Math.abs(py - y) < 12)) continue;
    g[y][x] = 'ŗ';
    puestas.push([x, y]);
  }
  return puestas.length;
}

// En un callejón libre de la rejilla: `car` (hasta `n` veces, el más hondo primero).
function ponerEnCallejones(t, car, n) {
  let puestos = 0;
  for (const [x, y] of t.finales()) {
    if (puestos >= n) break;
    if (t.g[y][x] !== '.') continue;
    t.g[y][x] = car; puestos++;
  }
  // sin callejones libres: la casilla de pasillo más lejana que quede
  for (; puestos < n; puestos++) {
    let mejor = null;
    for (let y = 1; y < t.H - 1; y++) for (let x = 1; x < t.W - 1; x++) if (t.g[y][x] === '.' && !t.enSala(x, y) && (!mejor || t.d(x, y) > t.d(...mejor))) mejor = [x, y];
    if (!mejor) break;
    t.g[mejor[1]][mejor[0]] = car;
  }
  return puestos;
}

// ---------- El plano fijo cambia en cada partida ----------
//
// El plano de datos/mazmorras.js es solo un punto de partida. En cada partida se le suman, siempre sin
// quitarle caminos (así nunca queda un tramo imposible):
//  - pasos nuevos entre pasillos lejanos (a veces con una puerta, a veces un pasadizo secreto),
//  - pilares en las salas grandes,
//  - salas escondidas en la roca maciza: tras un pasadizo secreto, tras una puerta que abre una tablilla
//    o tras una puerta común. Una de ellas guarda el revólver, que ya no está en un sitio fijo.
const VECINOS8 = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];

function variarPlano(def, azar, pares, acertijos, tipos) {
  const { elegir, mezclar } = herramientas(azar);
  const H = def.plano.length, W = Math.max(...def.plano.map(f => f.length));
  const g = def.plano.map(f => f.padEnd(W, '#').split(''));
  const nivel = (x, y) => { const h = def.alturas?.[y]?.[x]; return !h || h === ' ' ? '.' : h; };
  for (const f of g) for (let x = 0; x < W; x++) if (f[x] === 'R') f[x] = '.';

  // paredes y demás casillas por donde no se camina
  const macizas = new Set(['#', '!', '%', 'X', '_', '~', ...Object.keys(def.acertijos || {}), ...Object.keys(def.avisos || {})]);
  for (const [c, l] of Object.entries(def.leyenda || {})) if (['muro', 'vacio', 'aviso'].includes(l.tipo)) macizas.add(c);
  const selladas = new Set(Object.values(def.acertijos || {}).map(a => a.sello));
  const inicio = (() => { for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (g[y][x] === 'P') return [x, y]; return [1, 1]; })();
  // distancias desde el inicio; `cerradas`: sellos por los que no se pasa
  const distancias = cerradas => {
    const dist = new Map([[inicio.join(), 0]]), q = [inicio];
    while (q.length) {
      const [x, y] = q.shift();
      for (const [dx, dy] of V) {
        const nx = x + dx, ny = y + dy, k = nx + ',' + ny, c = g[ny]?.[nx];
        if (c === undefined || macizas.has(c) || cerradas.has(c) || dist.has(k)) continue;
        dist.set(k, dist.get(x + ',' + y) + 1); q.push([nx, ny]);
      }
    }
    return dist;
  };
  const suelo = (x, y) => g[y]?.[x] === '.';

  // 1. pasos nuevos entre pasillos que por el camino normal quedan lejos uno del otro
  const dist0 = distancias(selladas);
  const pasos = [];
  for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) {
    if (g[y][x] !== '#') continue;
    for (const [dx, dy] of [[1, 0], [0, 1]]) {
      if (!suelo(x - dx, y - dy) || !suelo(x + dx, y + dy) || g[y + dx][x + dy] !== '#' || g[y - dx][x - dy] !== '#') continue;
      if (nivel(x - dx, y - dy) !== nivel(x + dx, y + dy) || nivel(x, y) !== nivel(x + dx, y + dy)) continue;
      const a = dist0.get((x - dx) + ',' + (y - dy)), b = dist0.get((x + dx) + ',' + (y + dy));
      if (a !== undefined && b !== undefined && Math.abs(a - b) >= 10) pasos.push([x, y]);
    }
  }
  mezclar(pasos);
  const abiertos = [];
  for (const [x, y] of pasos) {
    if (abiertos.length >= 2 + Math.floor(azar() * 3)) break;
    if (abiertos.some(([ax, ay]) => Math.abs(ax - x) + Math.abs(ay - y) < 6)) continue;
    const r = azar();
    g[y][x] = r < 0.6 ? '.' : r < 0.8 ? 'D' : 'S';
    abiertos.push([x, y]);
  }

  // 2. pilares en las salas grandes (con las ocho casillas de alrededor libres no cortan ningún paso)
  for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) {
    if (!suelo(x, y) || azar() > 0.12 || Math.abs(x - inicio[0]) + Math.abs(y - inicio[1]) < 5) continue;
    if (VECINOS8.every(([dx, dy]) => suelo(x + dx, y + dy) && nivel(x + dx, y + dy) === nivel(x, y))) g[y][x] = '#';
  }

  // 3. salas escondidas
  const dist = distancias(selladas);
  const ocupado = new Set();
  const buscar = (profundo) => {
    const pisables = [...dist.keys()].map(k => k.split(',').map(Number)).filter(([x, y]) => suelo(x, y));
    const halladas = [];
    for (let intento = 0; intento < 3000 && halladas.length < 30; intento++) {
      const [fx, fy] = elegir(pisables), [dx, dy] = elegir(V);
      const largo = 1 + Math.floor(azar() * 4);
      // si los muros son finos, se achican las salas hasta un simple nicho
      const chico = intento > 1200;
      const ancho = chico ? 1 : elegir([1, 3, 3, 3, 5]), hondo = chico ? 1 : elegir([1, 3, 3, 5]);
      const nuevas = new Map();
      for (let i = 1; i <= largo; i++) nuevas.set((fx + dx * i) + ',' + (fy + dy * i), i === 1 ? 'puerta' : 'pasillo');
      const cx = fx + dx * (largo + 1 + (hondo >> 1)), cy = fy + dy * (largo + 1 + (hondo >> 1));
      for (let a = -(ancho >> 1); a <= ancho >> 1; a++) for (let b = -(hondo >> 1); b <= hondo >> 1; b++) nuevas.set((cx - dy * a + dx * b) + ',' + (cy + dx * a + dy * b), 'sala');
      let ok = true;
      for (const k of nuevas.keys()) {
        const [x, y] = k.split(',').map(Number);
        if (x < 2 || y < 2 || x > W - 3 || y > H - 3 || g[y][x] !== '#' || nivel(x, y) !== nivel(fx, fy) || ocupado.has(k)) { ok = false; break; }
        for (const [vx, vy] of V) {
          const nx = x + vx, ny = y + vy;
          if (nuevas.has(nx + ',' + ny) || (nx === fx && ny === fy)) continue;
          if (g[ny]?.[nx] !== '#' || ocupado.has(nx + ',' + ny)) { ok = false; break; }
        }
        if (!ok) break;
      }
      if (!ok) continue;
      const celdas = [...nuevas].map(([k, tipo]) => [...k.split(',').map(Number), tipo]);
      halladas.push({ celdas, desde: [fx, fy], lejos: dist.get(fx + ',' + fy), puerta: celdas.find(c => c[2] === 'puerta') });
    }
    if (!halladas.length) return null;
    halladas.sort((a, b) => b.lejos - a.lejos);
    const pool = profundo ? halladas.slice(0, Math.max(1, Math.ceil(halladas.length / 3))) : halladas;
    return elegir(pool);
  };
  const excavar = (h, puerta) => {
    for (const [x, y, tipo] of h.celdas) {
      g[y][x] = tipo === 'puerta' ? puerta : '.';
      ocupado.add(x + ',' + y);
      for (const [dx, dy] of VECINOS8) ocupado.add((x + dx) + ',' + (y + dy));
    }
    h.sala = h.celdas.filter(c => c[2] === 'sala');
    h.interior = h.celdas.filter(c => c[2] !== 'puerta');
  };

  const revolverTrasTablilla = azar() < 0.4;
  const plan = [{ uso: 'revolver', puerta: revolverTrasTablilla ? 'via' : 'S', profundo: true }];
  plan.push({ uso: 'barreta', puerta: 'S', profundo: true });   // la palanca de hierro: siempre tras un pasadizo secreto
  plan.push({ uso: 'escopeta', puerta: azar() < 0.5 ? 'via' : 'S', profundo: true });   // la escopeta: una sala oculta de la primera zona
  if (azar() < 0.85) plan.push({ uso: 'botin', puerta: 'via' });
  if (azar() < 0.9) plan.push({ uso: 'botin', puerta: 'S' });
  if (azar() < 0.75) plan.push({ uso: 'trampa', puerta: 'S' });
  if (azar() < 0.8) plan.push({ uso: 'emboscada', puerta: 'D' });
  const nuevasVias = [];
  let revolverPuesto = false;
  for (const p of plan) {
    const h = buscar(p.profundo);
    if (!h) {
      // sin sitio en la roca, el revólver queda a la vista en uno de los rincones más lejanos
      if (p.uso === 'revolver' || p.uso === 'barreta' || p.uso === 'escopeta') {
        const objeto = { revolver: 'R', barreta: 'w', escopeta: 'z' }[p.uso];
        // en un plano de salas abiertas se emparedan una o dos casillas junto a una pared: un nicho tras un pasadizo secreto
        const antes = distancias(new Set()).size;
        const candidatas = mezclar([...dist.keys()].map(k => k.split(',').map(Number)).filter(([x, y]) => suelo(x, y) && x > 2 && y > 2 && x < W - 3 && y < H - 3 && dist.get(x + ',' + y) >= 8));
        candidatas.sort((a, b) => V.filter(([dx, dy]) => g[b[1] + dy][b[0] + dx] === '#').length - V.filter(([dx, dy]) => g[a[1] + dy][a[0] + dx] === '#').length);
        for (const [x, y] of candidatas.slice(0, 60)) {
          const [dx, dy] = elegir(V);
          const [px, py] = [x + dx, y + dy], [zx, zy] = [x + dx * 2, y + dy * 2];
          if (g[py][px] !== '.' || g[zy]?.[zx] !== '.' || nivel(x, y) !== nivel(px, py) || nivel(px, py) !== nivel(zx, zy)) continue;
          const cambios = [[x, y, objeto], [px, py, 'S'], ...V.filter(([vx, vy]) => (vx !== dx || vy !== dy) && g[y + vy][x + vx] === '.').map(([vx, vy]) => [x + vx, y + vy, '#'])];
          if (cambios.some(([cx, cy]) => nivel(cx, cy) !== nivel(x, y))) continue;
          const previo = cambios.map(([cx, cy]) => g[cy][cx]);
          cambios.forEach(([cx, cy, c]) => { g[cy][cx] = c; });
          // nada que se alcanzaba antes debe quedar aislado (salvo las casillas emparedadas)
          if (distancias(new Set()).size === antes - (cambios.length - 2)) { revolverPuesto = true; break; }
          cambios.forEach(([cx, cy], i) => { g[cy][cx] = previo[i]; });
        }
        if (revolverPuesto) { revolverPuesto = false; continue; }
        if (p.uso === 'barreta') continue;   // sin nicho posible, esta partida no trae palanca
        const lejanas = [...dist].filter(([k]) => { const [x, y] = k.split(',').map(Number); return suelo(x, y); }).sort((a, b) => b[1] - a[1]);
        const [x, y] = elegir(lejanas.slice(0, Math.max(1, Math.ceil(lejanas.length / 4))))[0].split(',').map(Number);
        g[y][x] = objeto;
      }
      continue;
    }
    let puerta = p.puerta;
    let via = null;
    if (puerta === 'via') {
      via = nuevaVia(pares, acertijos, def, p.uso === 'revolver' ? [2, 3] : [1, 3]);
      puerta = via ? via.sello : 'S';
    }
    excavar(h, puerta);
    h.uso = p.uso; h.via = via;
    const libres = mezclar(h.sala.length && p.uso !== 'escopeta' ? h.sala.map(c => c.slice()) : h.interior.map(c => c.slice()));
    const poner = c => { const k = libres.pop(); if (k) g[k[1]][k[0]] = c; };
    if (p.uso === 'revolver') { poner('R'); poner('b'); }
    else if (p.uso === 'barreta') { poner('w'); poner('b'); }
    else if (p.uso === 'escopeta') { poner('z'); poner('q'); poner('q'); }
    else if (p.uso === 'botin') { poner('b'); poner('v'); if (azar() < 0.5) poner('b'); if (azar() < 0.4) poner('q'); }
    else if (p.uso === 'trampa') { for (const [x, y] of libres.slice(0, 3)) g[y][x] = '^'; if (azar() < 0.5) poner(elegir(tipos.length ? tipos : ['k'])); }
    else { for (let i = 0; i < 2 + Math.floor(azar() * 2); i++) poner(elegir(tipos.length ? tipos : ['k'])); poner('b'); }
    if (via) nuevasVias.push(h);
  }

  // 4. las tablillas de esas puertas, en paredes a las que se llega sin abrir ninguna de ellas
  const cerradas = new Set([...selladas, ...nuevasVias.map(h => h.via.sello)]);
  for (const h of nuevasVias) {
    const alcance = distancias(cerradas);
    const sitios = [];
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      if (g[y][x] !== '#') continue;
      const libres = V.filter(([dx, dy]) => g[y + dy][x + dx] === '.');
      const otros = V.filter(([dx, dy]) => g[y + dy][x + dx] !== '#');
      if (libres.length !== 1 || otros.length !== 1) continue;
      const [dx, dy] = libres[0];
      if ((alcance.get((x + dx) + ',' + (y + dy)) ?? -1) >= 6) sitios.push([x, y]);
    }
    if (sitios.length) { const [x, y] = elegir(sitios); g[y][x] = h.via.tablilla; }
    else {
      // sin sitio para la tablilla: la puerta pasa a ser un pasadizo secreto
      for (const [x, y] of h.celdas) if (g[y][x] === h.via.sello) g[y][x] = 'S';
      quitarVia(acertijos, h.via);
    }
  }
  ponerDardos(g, azar, 2);
  return g.map(f => f.join(''));
}

// Las salas de un bloque tallado, en coordenadas del plano total (para los hitos de js/hitos.js).
const desplazar = (salas, dx, dy) => salas.map(s => ({ x0: s.x0 + dx, y0: s.y0 + dy, x1: s.x1 + dx, y1: s.y1 + dy }));

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
    salas: desplazar(t.salas, rect[0], rect[1]),
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
// Una mazmorra más chica: solo sus primeras `n` zonas, sin la cámara extra. La última zona que queda
// no tiene tablilla hacia la siguiente y la salida se esconde en alguna de las que quedan.
export function recortarZonas(def, n) {
  const Z = def.sectores;
  if (!Z || n >= Z.zonas.length) return def;
  const salida = Z.salida.filter(i => i < n);
  return {
    ...def,
    sectores: {
      ...Z, extra: -1,
      zonas: Z.zonas.slice(0, n).map((z, i) => i === n - 1 ? { ...z, acertijo: undefined } : z),
      bloques: Z.bloques.filter(b => b.zona < n),
      pasos: Z.pasos.filter(([, hacia]) => hacia < n),
      salida: salida.length ? salida : [n - 1],
    },
  };
}

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
  const ultima = Z.extra ?? Z.zonas.length - 1;   // la cámara extra (-1 si se recortó)
  const selloDe = {}, tablillaDe = {};
  Z.zonas.forEach((z, i) => {
    if (!z.acertijo || i === ultima) return;
    const [car, sello] = pares.shift();
    acertijos[car] = { id: `${def.id}-zona${i + 1}`, tipo: 'pista', dificultad: z.acertijo.dificultad, sello, titulo: z.acertijo.titulo };
    selloDe[i + 1] = sello;
    tablillaDe[i] = car;
    z.caracterTablilla = car;
  });

  // el plano fijo de arriba cambia en cada partida (y esconde el revólver)
  const fijo = variarPlano(def, azar, pares, acertijos, tipos);
  fijo.forEach((f, y) => { for (let x = 0; x < f.length; x++) plano[y][x] = f[x]; });

  // la salida va a una de las zonas posibles
  const zonaSalida = elegir(Z.salida);
  // las tablillas que hay que descifrar sí o sí para llegar a la salida (las de las zonas anteriores a ella)
  // son fáciles: las que esconden zonas o tesoros pueden ser más duras
  for (let i = 0; i < zonaSalida; i++) {
    const a = acertijos[tablillaDe[i]];
    if (a) a.dificultad = [Math.min(a.dificultad[0], 1), Math.min(a.dificultad[1], 2)];
  }
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
    // atajos tras puertas con acertijo (la cámara extra no los tiene)
    if (b.zona !== ultima) ponerAtajos(t, Math.max(1, Math.round(b.ancho * b.alto / 900)), pares, acertijos, def, z.acertijo?.dificultad ?? [2, 3]);
    // trampas de dardos en los pasillos largos (la cámara extra no las tiene)
    if (b.zona !== ultima) ponerDardos(t.g, azar, Math.max(1, Math.round(b.ancho * b.alto / 1100)), t.enSala);
    // de la segunda zona en adelante: rocas rodantes y, en la primera de ellas, la Tommy gun con sus cargadores
    if (b.zona !== ultima && b.zona >= 1) {
      ponerRocas(t.g, azar, Math.max(1, Math.round(b.ancho * b.alto / 1500)), t.enSala);
      if (b.zona === 1 && Z.bloques.findIndex(o => o.zona === 1) === k) { ponerEnCallejones(t, 'ɸ', 1); ponerEnCallejones(t, 'ʠ', 2); }
      else if (azar() < 0.75) ponerEnCallejones(t, 'ʠ', 1 + (azar() < 0.4 ? 1 : 0));
    }
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
    salas: talladas.flatMap((t, k) => desplazar(t.salas, Z.bloques[k].x, Z.bloques[k].y)),
  };
}
