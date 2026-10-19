// Texturas y sprites pixel art generados por código (sin archivos de imagen).
// Todo va a un atlas de COLS x FILAS casillas de T x T píxeles.

export const T = 64;
export const COLS = 16;
export const FILAS = 24;

const casillas = {};   // nombre -> [col, fila]
const dibujos = [];

function rng(semilla) {
  let s = semilla >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function registrar(nombre, dibujar) {
  const i = dibujos.length;
  casillas[nombre] = [i % COLS, Math.floor(i / COLS)];
  dibujos.push(dibujar);
}

export function casilla(nombre) {
  const c = casillas[nombre];
  if (!c) throw new Error('Textura desconocida: ' + nombre);
  return c;
}

// ---------- Utilidades de píxel ----------

function lienzo() {
  const d = new Uint8ClampedArray(T * T * 4);
  return {
    d,
    set(x, y, r, g, b, a = 255) {
      if (x < 0 || y < 0 || x >= T || y >= T) return;
      const i = (y * T + x) * 4;
      d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = a;
    },
    get(x, y) {
      const i = (((y + T) % T) * T + ((x + T) % T)) * 4;
      return [d[i], d[i + 1], d[i + 2], d[i + 3]];
    },
    rect(x, y, w, h, c) {
      for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.set(i, j, c[0], c[1], c[2], c[3] ?? 255);
    },
    tinte(x, y, f) {
      if (x < 0 || y < 0 || x >= T || y >= T) return;
      const i = (y * T + x) * 4;
      d[i] *= f; d[i + 1] *= f; d[i + 2] *= f;
    },
  };
}

// Ruido suave (interpolado) para manchas grandes dentro de cada pieza, que se repite sin costuras.
function ruidoSuave(r, celdas = 8) {
  const v = Array.from({ length: celdas * celdas }, () => r());
  const at = (i, j) => v[((j + celdas) % celdas) * celdas + ((i + celdas) % celdas)];
  return (x, y) => {
    const fx = x / T * celdas, fy = y / T * celdas, i = Math.floor(fx), j = Math.floor(fy);
    let tx = fx - i, ty = fy - j; tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty);
    return (at(i, j) * (1 - tx) + at(i + 1, j) * tx) * (1 - ty) + (at(i, j + 1) * (1 - tx) + at(i + 1, j + 1) * tx) * ty;
  };
}

function aCanvas(b) {
  const c = document.createElement('canvas');
  c.width = c.height = T;
  c.getContext('2d').putImageData(new ImageData(b.d, T, T), 0, 0);
  return c;
}

// ---------- Superficies con relieve ----------
// Cada textura se arma con un campo de alturas (0 = junta honda, 1 = cara del bloque, más de 1 = lo que
// sobresale) y un color por píxel. `superficie` saca la normal, ilumina desde arriba a la izquierda,
// oscurece lo hundido y reduce los tonos con trama ordenada: pixel art con volumen que se repite sin costuras.

const envolver = v => ((v % T) + T) % T;
const suave = t => t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
const mezclar = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const escalar = (c, f) => [c[0] * f, c[1] * f, c[2] * f];
const LUZ_T = (() => { const v = [-0.5, -0.7, 0.85], l = Math.hypot(...v); return v.map(x => x / l); })();
const PLANO = 0.3 + LUZ_T[2] * 0.85;
const TRAMA_T = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

// Ruido fractal: varias capas de ruido suave, cada una al doble de detalle y la mitad de fuerza.
function fbm(r, base = 4, octavas = 3) {
  // se calcula una vez por píxel y luego solo se consulta (siempre con coordenadas enteras)
  const tabla = new Float32Array(T * T), curva = new Float32Array(T);
  let norma = 0;
  for (let k = 0; k < octavas; k++) {
    const n = base << k, lado = T / n, peso = 0.5 ** k, v = Array.from({ length: n * n }, () => r());
    norma += peso;
    for (let p = 0; p < T; p++) { const t = (p % lado) / lado; curva[p] = t * t * (3 - 2 * t); }
    for (let y = 0; y < T; y++) {
      const j = Math.floor(y / lado), j2 = (j + 1) % n, ty = curva[y];
      for (let x = 0; x < T; x++) {
        const i = Math.floor(x / lado), i2 = (i + 1) % n, tx = curva[x];
        const a = v[j * n + i] + (v[j * n + i2] - v[j * n + i]) * tx, b = v[j2 * n + i] + (v[j2 * n + i2] - v[j2 * n + i]) * tx;
        tabla[y * T + x] += (a + (b - a) * ty) * peso;
      }
    }
  }
  for (let i = 0; i < T * T; i++) tabla[i] /= norma;
  return (x, y) => tabla[(y & (T - 1)) * T + (x & (T - 1))];
}

// color(x, y, altura, i) devuelve [r, g, b] y, si quiere, un cuarto valor con el brillo especular.
// emite(x, y, i) devuelve un color que se pinta tal cual, sin sombrear (llamas, lava, luz de la salida).
function superficie(b, alto, color, { fuerza = 2.4, hondo = 0.5, brillo = 0, niveles = 32, emite } = {}) {
  const H = new Float32Array(T * T);
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) H[y * T + x] = Math.max(0, Math.min(1.6, alto(x, y)));
  const M = T - 1, paso = 255 / niveles, c = [0, 0, 0];
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const i = y * T + x, v = H[i];
    const e = emite && emite(x, y, i);
    if (e) { c[0] = e[0]; c[1] = e[1]; c[2] = e[2]; } else {
      const fa = ((y - 1) & M) * T, fb = ((y + 1) & M) * T, f2a = ((y - 2) & M) * T, f2b = ((y + 2) & M) * T, fy = y * T;
      const xa = (x - 1) & M, xb = (x + 1) & M;
      const nx = (H[fy + xa] - H[fy + xb]) * fuerza, ny = (H[fa + x] - H[fb + x]) * fuerza;
      const dif = Math.max(0, (nx * LUZ_T[0] + ny * LUZ_T[1] + LUZ_T[2]) / Math.sqrt(nx * nx + ny * ny + 1));
      // oclusión: lo que queda por debajo de sus vecinos recibe menos luz
      const media = (H[fy + ((x - 2) & M)] + H[fy + ((x + 2) & M)] + H[f2a + x] + H[f2b + x] + H[fa + xa] + H[fb + xb] + H[fb + xa] + H[fa + xb]) / 8;
      const oc = Math.max(0.3, 1 - Math.max(0, media - v) * hondo * 3);
      const f = (0.3 + dif * 0.85) / PLANO * oc * (1 - hondo * 0.5 + hondo * 0.5 * Math.min(1.3, v));
      const base = color(x, y, v, i);
      const esp = base[3] ?? brillo, luz = esp ? Math.pow(dif, 14) * esp * 200 : 0;
      c[0] = base[0] * f + luz; c[1] = base[1] * f + luz; c[2] = base[2] * f + luz;
    }
    const u = (TRAMA_T[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
    for (let k = 0; k < 3; k++) { const q = Math.min(255, Math.max(0, c[k])) / paso, n = Math.floor(q); c[k] = Math.min(255, (n + (q - n > u ? 1 : 0)) * paso); }
    b.set(x, y, c[0], c[1], c[2]);
  }
}

// Aparejo de bloques: filas de `alto` px y bloques de `ancho` px; cada fila se corre `corrido` de bloque.
// Da la altura (bisel redondeado, bordes algo mellados) y un número por bloque para variar su tono.
function bloques(r, { alto = 16, ancho = 32, corrido = 0.5, junta = 0.8, bisel = 2.5, mella = 1 } = {}) {
  const filas = Math.round(T / alto), cols = Math.round(T / ancho);
  alto = T / filas; ancho = T / cols;
  const bx = fbm(r, 8, 2), by = fbm(r, 8, 2);
  const a = new Float32Array(T * T), id = new Int32Array(T * T), fila = new Int32Array(T * T);
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const i = y * T + x;
    const wy = envolver(y + 0.5 + (by(x, y) - 0.5) * mella * 2), f = Math.min(filas - 1, Math.floor(wy / alto));
    const wx = envolver(x + 0.5 + (bx(x, y) - 0.5) * mella * 2 + f * corrido * ancho), c = Math.min(cols - 1, Math.floor(wx / ancho));
    const lx = wx - c * ancho, ly = wy - f * alto;
    a[i] = suave((Math.min(lx, ancho - lx, ly, alto - ly) - junta) / bisel);
    id[i] = f * cols + c; fila[i] = f;
  }
  return { a, id, fila, tono: Array.from({ length: filas * cols }, () => r()) };
}

// Piedras irregulares (celdas de Voronoi que se repiten): `n` x `n` piedras por casilla.
function adoquines(r, n, { junta = 1, bisel = 3, mella = 1.5 } = {}) {
  const lado = T / n;
  const p = [];
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) p.push([(i + 0.2 + r() * 0.6) * lado, (j + 0.2 + r() * 0.6) * lado]);
  const bx = fbm(r, 8, 2), by = fbm(r, 8, 2);
  const a = new Float32Array(T * T), id = new Int32Array(T * T), fila = new Int32Array(T * T);
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const wx = envolver(x + 0.5 + (bx(x, y) - 0.5) * mella * 2), wy = envolver(y + 0.5 + (by(x, y) - 0.5) * mella * 2);
    const ci = Math.floor(wx / lado), cj = Math.floor(wy / lado);
    let d1 = Infinity, d2 = Infinity, k1 = 0;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const ii = ci + di, jj = cj + dj, mi = ((ii % n) + n) % n, mj = ((jj % n) + n) % n, k = mj * n + mi;
      const d = Math.hypot(p[k][0] + (ii - mi) / n * T - wx, p[k][1] + (jj - mj) / n * T - wy);
      if (d < d1) { d2 = d1; d1 = d; k1 = k; } else if (d < d2) d2 = d;
    }
    const i = y * T + x;
    a[i] = suave(((d2 - d1) / 2 - junta) / bisel); id[i] = k1; fila[i] = Math.floor(k1 / n);
  }
  return { a, id, fila, tono: p.map(() => r()) };
}

// Grietas: trazos que bajan zigzagueando; devuelve cuánto se hunde cada píxel.
function grietas(r, trazos) {
  const m = new Float32Array(T * T);
  for (let [x, y, pasos] of trazos) for (let k = 0; k < pasos; k++) {
    m[envolver(y) * T + envolver(x)] = 1;
    const j = envolver(y) * T + envolver(x + 1); m[j] = Math.max(m[j], 0.4);
    y += 1; x += Math.floor(r() * 3) - 1;
  }
  return m;
}
const unir = (a, b) => !a ? b : !b ? a : a.map((v, i) => Math.max(v, b[i]));

// Una capa añade cosas sobre una superficie: alto(x, y, v, i, B) y color(x, y, v, c, i, B) devuelven el
// valor nuevo, y emite(x, y, i) un color sin sombra. Dos capas se aplican una sobre otra.
function componer(a, b) {
  if (!a) return b; if (!b) return a;
  return {
    alto: (x, y, v, i, B) => { if (a.alto) v = a.alto(x, y, v, i, B); return b.alto ? b.alto(x, y, v, i, B) : v; },
    color: (x, y, v, c, i, B) => { if (a.color) c = a.color(x, y, v, c, i, B); return b.color ? b.color(x, y, v, c, i, B) : c; },
    emite: (x, y, i) => (b.emite && b.emite(x, y, i)) || (a.emite && a.emite(x, y, i)),
  };
}

// Muro, suelo o techo de bloques (o de piedras sueltas con `adoquines: n`), con manchas, poros y grietas.
function muro(b, r, base, op = {}) {
  const B = op.adoquines ? adoquines(r, op.adoquines, op) : bloques(r, op);
  const mortero = op.mortero ?? escalar(base, 0.4), variacion = op.variacion ?? 0.2;
  const mancha = fbm(r, 4, 3), grano = ruidoSuave(r, 32), poro = ruidoSuave(r, 64);
  const capa = op.capa ?? {}, marcas = op.marcas;
  superficie(b,
    (x, y) => {
      const i = y * T + x;
      let v = B.a[i] * (0.88 + grano(x, y) * 0.12);
      if (poro(x, y) > 0.975) v *= 0.82;
      if (marcas) v -= marcas[i] * 0.6;
      return capa.alto ? capa.alto(x, y, v, i, B) : v;
    },
    (x, y, v, i) => {
      const t = 1 + (B.tono[B.id[i]] - 0.5) * variacion * 2;
      let c = mezclar(mortero, escalar(base, t * (0.8 + mancha(x, y) * 0.34)), suave(B.a[i] * 3));
      if (marcas && marcas[i]) c = escalar(c, 1 - marcas[i] * 0.35);
      return capa.color ? capa.color(x, y, v, c, i, B) : c;
    },
    { ...op, emite: capa.emite });
  return B;
}

const semilla = r => rng(Math.floor(r() * 4294967296));

// ---------- Muros ----------

const PIEDRA = [104, 96, 86], ARENISCA = [178, 142, 94];

function dibujaPiedra(b, r, capa, marcas) { muro(b, r, PIEDRA, { mortero: [40, 35, 31], capa, marcas }); }

// Jeroglíficos de 5 x 7 tallados en la arenisca.
const GLIFOS = [
  ['.###.', '#...#', '.###.', '..#..', '#####', '..#..', '..#..'],   // anj
  ['.....', '.###.', '#.#.#', '.###.', '...#.', '..#..', '.....'],   // ojo
  ['#.#..', '.#.#.', '..#.#', '.....', '#.#..', '.#.#.', '..#.#'],   // agua
  ['..##.', '.###.', '###..', '.####', '..##.', '..#.#', '.#..#'],   // ave
  ['.#...', '.#.#.', '.###.', '.#...', '.#...', '.#...', '###..'],   // junco
];
function jeroglificos(r, filas, cuantos = 4) {
  const m = new Float32Array(T * T), alto = T / filas;
  for (let n = 0; n < cuantos; n++) {
    const g = GLIFOS[Math.floor(r() * GLIFOS.length)];
    const x0 = 4 + Math.floor(r() * 7) * 8, y0 = Math.floor((n % filas) * alto + (alto - 7) / 2);
    g.forEach((fila, j) => [...fila].forEach((ch, i) => { if (ch === '#') m[(y0 + j) * T + envolver(x0 + i)] = 0.7; }));
  }
  return m;
}
function dibujaArenisca(b, r, capa, marcas) {
  muro(b, r, ARENISCA, {
    alto: T / 3, ancho: 32, mortero: [98, 74, 46], variacion: 0.14, bisel: 2,
    marcas: unir(jeroglificos(semilla(r), 3), marcas),
    capa: componer({ color: (x, y, v, c) => escalar(c, 1 + Math.sin(y * 0.8 + x * 0.05) * 0.03) }, capa),
  });
}

registrar('piedra', b => dibujaPiedra(b, rng(11)));
registrar('piedra_grieta', b => dibujaPiedra(b, rng(11), null, grietas(rng(5), [[30, 6, 26], [22, 34, 22]])));
registrar('musgo', b => {
  const r = rng(13), m = fbm(semilla(r), 4, 3), mota = ruidoSuave(semilla(r), 64);
  const cuanto = (x, y) => suave((m(x, y) + y / T * 0.7 - 0.78) * 5);
  dibujaPiedra(b, r, {
    alto: (x, y, v) => v + cuanto(x, y) * (0.18 + mota(x, y) * 0.12),
    color: (x, y, v, c) => { const k = cuanto(x, y); return k ? mezclar(c, mota(x, y) > 0.7 ? [92, 122, 52] : [54, 84, 38], k) : c; },
  });
});
// Escombros que tapan la entrada derrumbada: piedras sueltas de todos los tamaños y polvo.
registrar('derrumbe', b => {
  const r = rng(15), polvo = fbm(semilla(r), 4, 3);
  const chicas = adoquines(semilla(r), 8, { junta: 0.8, bisel: 2, mella: 1.5 });
  muro(b, r, [112, 102, 90], { adoquines: 4, junta: 1.4, bisel: 4, mella: 2.5, mortero: [30, 26, 22], variacion: 0.35, fuerza: 3,
    capa: {
      alto: (x, y, v, i) => v < 0.35 ? Math.max(v, chicas.a[i] * 0.7) : v,
      color: (x, y, v, c) => mezclar(c, [150, 136, 112], suave((polvo(x, y) - 0.55) * 4) * 0.6),
    } });
});
registrar('arenisca', b => dibujaArenisca(b, rng(21)));
registrar('arenisca_grieta', b => dibujaArenisca(b, rng(21), null, grietas(rng(7), [[33, 4, 30], [12, 30, 24]])));

// Llama dibujada con capas de color y bordes en trama (sin sombra: se pinta encima tal cual).
function llama(x, y, cx, arriba, abajo, ancho) {
  const dx = (x + 0.5 - cx) / ancho, dy = (y + 0.5 - abajo) / (abajo - arriba);
  if (dy > 0.15 || dy < -1) return null;
  const lado = dy < 0 ? Math.pow(-dy, 0.55) * (1 + dy) * 2.1 : 1 - dy / 0.15;
  const d = Math.abs(dx) / Math.max(0.01, lado);
  if (d >= 1) return null;
  const t = (1 - d) * (dy < 0 ? 1 - Math.pow(-dy, 1.6) * 0.6 : 1) + (TRAMA_T[(y & 3) * 4 + (x & 3)] / 16 - 0.5) * 0.25;
  return t > 0.8 ? [255, 250, 214] : t > 0.55 ? [255, 214, 92] : t > 0.3 ? [250, 146, 40] : [196, 70, 26];
}

registrar('antorcha', b => {
  const r = rng(11), oxido = fbm(rng(12), 8, 2);
  const zona = new Uint8Array(T * T);
  dibujaPiedra(b, r, {
    alto: (x, y, v, i) => {
      // placa clavada al muro, brazo y copa de hierro, mango de madera
      if (x >= 29 && x < 35 && y >= 36 && y < 48) { zona[i] = 1; return 1.2 + suave(Math.min(x - 29, 34 - x, y - 36, 47 - y) / 1.5) * 0.15; }
      if (x >= 31 && x < 33 && y >= 31 && y < 36) { zona[i] = 1; return 1.35; }
      const ancho = 4 + (31 - y) * 0.6;
      if (y >= 26 && y < 31 && Math.abs(x + 0.5 - 32) < ancho) { zona[i] = 1; return 1.3 + (1 - Math.abs(x + 0.5 - 32) / ancho) * 0.2; }
      if (y >= 22 && y < 26 && Math.abs(x + 0.5 - 32) < 2) { zona[i] = 2; return 1.45; }
      return v;
    },
    color: (x, y, v, c, i) => {
      if (zona[i] === 1) return [...mezclar([62, 58, 54], [116, 62, 34], suave((oxido(x, y) - 0.55) * 5)), 0.7];
      if (zona[i] === 2) return [96, 62, 34];
      // resplandor cálido alrededor de la llama
      const d = Math.hypot(x + 0.5 - 32, y + 0.5 - 16);
      const k = Math.max(0, 1 - d / 30);
      return [c[0] * (0.78 + k * 0.6), c[1] * (0.74 + k * 0.42), c[2] * (0.7 + k * 0.2)];
    },
  });
  // la llama va encima, sin sombrear
  for (let y = 4; y < 27; y++) for (let x = 22; x < 42; x++) {
    const c = llama(x, y, 32, 4, 24, 6.5);
    if (c) b.set(x, y, ...c);
  }
});

registrar('puerta', b => {
  const r = rng(31), veta = fbm(r, 4, 3), oxido = fbm(semilla(r), 8, 2), tono = Array.from({ length: 6 }, () => r());
  const TABLA = T / 6, BANDAS = [[8, 15], [49, 56]];
  const zona = new Uint8Array(T * T);
  superficie(b, (x, y) => {
    const i = y * T + x, px = x + 0.5, py = y + 0.5;
    // argolla y su placa
    const ra = Math.abs(Math.hypot(px - 46, py - 39) - 5);
    if (ra < 1.4 && py > 35) { zona[i] = 2; return 1.4 + (1.4 - ra) * 0.15; }
    if (Math.abs(px - 46) < 3.5 && Math.abs(py - 33) < 3) { zona[i] = 2; return 1.22 + suave(Math.min(3.5 - Math.abs(px - 46), 3 - Math.abs(py - 33)) / 1.2) * 0.12; }
    for (const [y0, y1] of BANDAS) if (y >= y0 && y < y1) {
      zona[i] = 2;
      for (let xc = TABLA / 2; xc < T; xc += TABLA) {
        const d = Math.hypot(px - xc, py - (y0 + y1) / 2);
        if (d < 1.8) return 1.3 + Math.sqrt(1 - (d / 1.8) ** 2) * 0.25;
      }
      return 1.15 + suave(Math.min(py - y0, y1 - py) / 1.5) * 0.12;
    }
    zona[i] = 1;
    const lx = px - Math.floor(x / TABLA) * TABLA;
    return suave((Math.min(lx, TABLA - lx) - 0.6) / 1.8) * (0.94 + Math.sin(px * 1.4 + veta(x, y) * 14) * 0.04);
  }, (x, y, v, i) => {
    if (zona[i] === 2) return [...mezclar([70, 68, 66], [118, 64, 34], suave((oxido(x, y) - 0.55) * 4)), 0.8];
    const t = 0.86 + tono[Math.floor(x / TABLA)] * 0.2;
    const g = 0.86 + Math.sin(x * 1.25 + veta(x, y) * 16) * 0.1;
    return escalar([116, 74, 42], t * g);
  });
});

// Sello: losa con un aro de metal en relieve y un glifo. glifo: ojo | runa | ancla | sol
function enGlifo(glifo, dx, dy, d) {
  if (glifo === 'ojo') { if (d < 3.5) return 'hueco'; return Math.abs(dy) < 7 * Math.sqrt(Math.max(0, 1 - (dx / 13) ** 2)) && !(d < 5.5 && d > 3.5) ? 'si' : ''; }
  if (glifo === 'runa') return (Math.abs(dx) < 2 && dy > -14 && dy < 15) || (dy < 0 && dy > -14 && Math.abs(Math.abs(dx) + dy * 0.9) < 2 && Math.abs(dx) < 12) ? 'si' : '';
  if (glifo === 'ancla') return (Math.abs(dx) < 2 && dy > -10 && dy < 12) || (Math.abs(dy + 7) < 2 && Math.abs(dx) < 8) ||
    (Math.abs(Math.hypot(dx, dy - 2) - 11) < 2 && dy > 4) || Math.abs(Math.hypot(dx, dy + 13) - 3) < 1.5 ? 'si' : '';
  if (glifo === 'sol') { if (d < 3) return 'hueco'; return d < 7 || (d < 16 && Math.cos(Math.atan2(dy, dx) * 8) > 0.6) ? 'si' : ''; }
  return '';
}
function dibujaSello(b, base, metal, glifo) {
  const r = rng(41), m = fbm(r, 4, 3), g = ruidoSuave(semilla(r), 32);
  const zona = new Uint8Array(T * T);
  superficie(b, (x, y) => {
    const i = y * T + x, dx = x + 0.5 - 32, dy = y + 0.5 - 32, d = Math.hypot(dx, dy);
    if (d > 18.5 && d < 23.5) { zona[i] = 1; return 1.12 + suave(Math.min(d - 18.5, 23.5 - d) / 1.6) * 0.25; }
    if (d <= 18.5) {
      const e = enGlifo(glifo, dx, dy, d);
      if (e === 'hueco') { zona[i] = 3; return 0.45; }
      if (e) { zona[i] = 1; return 1.0; }
      zona[i] = 2; return 0.72 + g(x, y) * 0.04;
    }
    return suave(Math.min(y, T - 1 - y) / 2.5) * (0.9 + g(x, y) * 0.1);
  }, (x, y, v, i) => {
    if (zona[i] === 1) return [...escalar(metal, 0.86 + m(x, y) * 0.24), 1];
    if (zona[i] === 3) return escalar(metal, 0.3);
    return escalar(base, (zona[i] === 2 ? 0.72 : 0.84) + m(x, y) * 0.32);
  }, { fuerza: 3 });
}

registrar('sello', b => dibujaSello(b, [86, 80, 74], [200, 160, 60], 'ojo'));
registrar('sello_runa', b => dibujaSello(b, [120, 150, 170], [210, 235, 250], 'runa'));
registrar('sello_ancla', b => dibujaSello(b, [90, 64, 40], [190, 160, 90], 'ancla'));
registrar('sello_sol', b => dibujaSello(b, [80, 96, 70], [230, 180, 50], 'sol'));

// Tablilla: placa en relieve con renglones grabados, encima del muro de cada mazmorra, y su sombra.
function capaTablilla(placa) {
  const r = rng(43), m = fbm(r, 4, 3);
  const surco = new Uint8Array(T * T);
  for (let fila = 0; fila < 6; fila++) {
    let x = 15;
    while (x < 48) {
      const w = 2 + Math.floor(r() * 6), y = 14 + fila * 7;
      for (let k = x; k < Math.min(x + w, 49); k++) { surco[y * T + k] = 1; surco[(y + 1) * T + k] = 1; }
      if (r() < 0.4) { surco[(y - 1) * T + x] = 1; surco[(y - 2) * T + x] = 1; }
      x += w + 2;
    }
  }
  const dentro = (x, y) => x >= 10 && x < 54 && y >= 8 && y < 56;
  return {
    alto: (x, y, v, i) => {
      if (!dentro(x, y)) return v;
      const e = Math.min(x - 10, 53 - x, y - 8, 55 - y);
      return 1.08 + suave(e / 2.5) * 0.22 - (surco[i] ? 0.26 : 0);
    },
    color: (x, y, v, c, i) => {
      if (dentro(x, y)) return escalar(placa, 0.84 + m(x, y) * 0.28);
      if ((x >= 54 && x < 57 && y >= 10 && y < 58) || (y >= 56 && y < 59 && x >= 12 && x < 57)) return escalar(c, 0.6);
      return c;
    },
  };
}

registrar('tablilla', b => dibujaPiedra(b, rng(11), capaTablilla([150, 138, 112])));
registrar('tablilla_arenisca', b => dibujaArenisca(b, rng(21), capaTablilla([196, 170, 120])));
registrar('tablilla_hielo', b => dibujaHielo(b, rng(101), capaTablilla([150, 170, 184])));
registrar('tablilla_roca', b => dibujaRoca(b, rng(111), capaTablilla([140, 120, 96])));
registrar('tablilla_madera', b => dibujaMadera(b, rng(121), capaTablilla([178, 150, 104])));
registrar('tablilla_selva', b => dibujaSelva(b, rng(131), capaTablilla([130, 140, 112])));

// ---------- Glaciar ----------

function dibujaHielo(b, r, capa, marcas) {
  const prof = fbm(semilla(r), 2, 3);
  muro(b, r, [156, 196, 220], {
    alto: T / 3, ancho: 32, mortero: [78, 108, 132], variacion: 0.12, bisel: 4, mella: 0.6, fuerza: 1.8, marcas,
    capa: componer({
      color: (x, y, v, c) => {
        let k = mezclar([84, 128, 170], c, 0.4 + prof(x, y) * 0.7);
        if (envolver(x * 2 - y + 7) % 23 < 1 || envolver(x - y * 2) % 37 < 1) k = escalar(k, 1.2);   // vetas
        return [...k, 0.9];
      },
    }, capa),
  });
}
registrar('hielo', b => dibujaHielo(b, rng(101)));
registrar('hielo_grieta', b => dibujaHielo(b, rng(101), null, grietas(rng(9), [[28, 3, 30], [40, 30, 24]])));
registrar('nieve', b => {
  const r = rng(103), duna = fbm(r, 2, 4), chispa = ruidoSuave(semilla(r), 64), pisada = fbm(semilla(r), 4, 2);
  superficie(b, (x, y) => 0.55 + duna(x, y) * 0.45 - suave((pisada(x, y) - 0.72) * 6) * 0.12,
    (x, y) => [218, 226, 238, 0.35],
    { fuerza: 3, hondo: 0.3, niveles: 40, emite: (x, y) => chispa(x, y) > 0.985 ? [255, 255, 255] : null });
});
registrar('techo_hielo', b => {
  const r = rng(105), rugoso = fbm(r, 4, 4), escarcha = ruidoSuave(semilla(r), 64);
  const raiz = Array.from({ length: 8 }, () => [Math.floor(r() * T), 3 + r() * 3]);
  superficie(b, (x, y) => {
    let v = 0.5 + rugoso(x, y) * 0.5;
    for (const [cx, w] of raiz) { const d = Math.abs(envolver(x - cx + 32) - 32); if (d < w) v += (1 - d / w) * 0.35; }
    return v;
  }, (x, y, v) => [...mezclar([70, 96, 116], [170, 200, 218], suave(v - 0.35)), 0.6], { fuerza: 2,
    emite: (x, y) => escarcha(x, y) > 0.99 ? [230, 244, 255] : null });
});

// ---------- Cueva pirata ----------

function dibujaRoca(b, r, capa, marcas) {
  const bulto = fbm(semilla(r), 4, 3);
  muro(b, r, [104, 90, 76], {
    adoquines: 3, junta: 1.2, bisel: 7, mella: 3, mortero: [42, 34, 28], variacion: 0.32, fuerza: 3, marcas,
    capa: componer({ alto: (x, y, v) => v + (bulto(x, y) - 0.5) * 0.4 }, capa),
  });
}
// Tablones horizontales con vetas y clavos en las juntas.
function dibujaMadera(b, r, capa) {
  const veta = fbm(semilla(r), 4, 3);
  const clavo = (x, y, B, i) => {
    const f = B.fila[i], cy = f * 8 + 4, costura = envolver(-(f * 32));
    for (const cx of [costura + 3.5, costura - 3.5]) { const d = Math.hypot(envolver(x + 0.5 - cx + 32) - 32, y + 0.5 - cy); if (d < 1.4) return d; }
    return -1;
  };
  muro(b, r, [108, 72, 44], {
    alto: 8, ancho: 64, corrido: 0.5, junta: 0.6, bisel: 1.6, mella: 0.3, mortero: [34, 22, 14], variacion: 0.3,
    capa: componer({
      alto: (x, y, v, i, B) => { const d = clavo(x, y, B, i); return d >= 0 ? 1.25 : v; },
      color: (x, y, v, c, i, B) => clavo(x, y, B, i) >= 0 ? [62, 58, 54, 0.25] : escalar(c, 0.88 + Math.sin(y * 1.9 + veta(x, y) * 12 + x * 0.04) * 0.1),
    }, capa),
  });
}
registrar('roca', b => dibujaRoca(b, rng(111)));
registrar('roca_grieta', b => dibujaRoca(b, rng(111), null, grietas(rng(13), [[30, 2, 40], [31, 2, 40]])));
registrar('madera', b => dibujaMadera(b, rng(121)));
registrar('cubierta', b => {
  const r = rng(123), veta = fbm(semilla(r), 4, 3), gasto = fbm(semilla(r), 2, 2);
  muro(b, r, [122, 88, 54], {
    alto: 64, ancho: 16, junta: 0.6, bisel: 1.6, mella: 0.3, mortero: [36, 24, 14], variacion: 0.25,
    capa: {
      alto: (x, y, v) => { const lx = envolver(x) % 16, d = Math.hypot(lx + 0.5 - 8, envolver(y + 0.5 - 4 + 32) - 32); return d < 1.3 ? 1.2 : v; },
      color: (x, y, v, c) => {
        const lx = x % 16; if (Math.hypot(lx + 0.5 - 8, envolver(y + 0.5 - 4 + 32) - 32) < 1.3) return [62, 58, 54, 0.25];
        return escalar(c, (0.88 + Math.sin(x * 1.6 + veta(x, y) * 12) * 0.1) * (0.92 + gasto(x, y) * 0.16));
      },
    },
  });
});
registrar('techo_madera', b => {
  const r = rng(125), veta = fbm(semilla(r), 4, 3);
  muro(b, r, [92, 62, 38], {
    alto: 8, ancho: 64, corrido: 0.5, junta: 0.6, bisel: 1.4, mella: 0.3, mortero: [26, 16, 10], variacion: 0.3,
    capa: {
      alto: (x, y, v) => { const ly = y % 32; return ly < 10 ? 1.25 + suave(Math.min(ly, 9 - ly) / 2) * 0.15 : v * 0.9; },
      color: (x, y, v, c) => (y % 32 < 10 ? escalar([84, 54, 32], 0.9 + Math.sin(y * 2.1 + veta(x, y) * 10) * 0.08) : escalar(c, 0.8)),
    },
  });
});
registrar('arena_humeda', b => {
  const r = rng(127), onda = fbm(r, 2, 3), mojado = fbm(semilla(r), 4, 2), guijarro = ruidoSuave(semilla(r), 64);
  superficie(b, (x, y) => 0.6 + Math.sin((x * 6 / T + onda(x, y) * 1.4) * Math.PI * 2) * 0.12 + (guijarro(x, y) > 0.99 ? 0.3 : 0),
    (x, y, v) => {
      if (guijarro(x, y) > 0.99) return [150, 140, 128, 0.4];
      const k = suave((mojado(x, y) - 0.45) * 3);
      return [...mezclar([164, 140, 100], [104, 88, 64], k), k * 0.6];
    }, { fuerza: 3, hondo: 0.3 });
});
registrar('techo_roca', b => {
  const r = rng(129), bulto = fbm(semilla(r), 4, 3);
  muro(b, r, [72, 62, 54], { adoquines: 4, junta: 1, bisel: 6, mella: 2.5, mortero: [26, 20, 16], variacion: 0.3, fuerza: 3,
    capa: { alto: (x, y, v) => v + (bulto(x, y) - 0.5) * 0.4 } });
});

// ---------- Templo de la selva ----------

function dibujaSelva(b, r, capa, marcas) {
  const r2 = semilla(r), musgo = fbm(semilla(r), 4, 3);
  const liana = new Uint8Array(T * T);
  for (let n = 0; n < 5; n++) {
    let x = Math.floor(r2() * T);
    const largo = 10 + Math.floor(r2() * 40);
    for (let y = 0; y < largo; y++) {
      liana[y * T + envolver(x)] = 1;
      if (r2() < 0.18) { for (const [dx, dy] of [[1, 0], [2, 0], [1, 1], [2, -1]]) if (y + dy >= 0) liana[(y + dy) * T + envolver(x + dx)] = 2; }
      if (r2() < 0.15) x += r2() < 0.5 ? -1 : 1;
    }
  }
  const verdin = (x, y) => suave((musgo(x, y) - 0.55) * 5);
  muro(b, r, [104, 112, 92], {
    mortero: [44, 50, 38], variacion: 0.22, marcas,
    capa: componer({
      alto: (x, y, v, i) => liana[i] ? 1.3 : v + verdin(x, y) * 0.1,
      color: (x, y, v, c, i) => liana[i] === 1 ? [52, 98, 38] : liana[i] === 2 ? [78, 136, 48] : mezclar(c, [62, 92, 44], verdin(x, y) * 0.8),
    }, capa),
  });
}
registrar('selva', b => dibujaSelva(b, rng(131)));
registrar('selva_grieta', b => dibujaSelva(b, rng(131), null, grietas(rng(17), [[26, 18, 40], [38, 6, 30]])));
registrar('losa_selva', b => {
  const r = rng(133), hierba = ruidoSuave(semilla(r), 64);
  muro(b, r, [98, 102, 84], { adoquines: 3, junta: 1.4, bisel: 3, mella: 1.5, mortero: [40, 60, 30], variacion: 0.2,
    capa: {
      alto: (x, y, v, i, B) => B.a[i] < 0.3 && hierba(x, y) > 0.6 ? 0.55 : v,
      color: (x, y, v, c, i, B) => B.a[i] < 0.3 && hierba(x, y) > 0.6 ? (hierba(x, y) > 0.8 ? [96, 140, 54] : [56, 96, 40]) : c,
    } });
});
registrar('techo_selva', b => {
  const r = rng(135), musgo = fbm(semilla(r), 4, 3), bulto = fbm(semilla(r), 4, 3);
  const verdin = (x, y) => suave((musgo(x, y) - 0.5) * 4);
  muro(b, r, [66, 70, 58], { adoquines: 3, junta: 1.2, bisel: 6, mella: 2.5, mortero: [30, 36, 24], variacion: 0.25, fuerza: 3,
    capa: { alto: (x, y, v) => v + (bulto(x, y) - 0.5) * 0.35, color: (x, y, v, c) => mezclar(c, [50, 76, 38], verdin(x, y) * 0.7) } });
});

registrar('salida', b => {
  const r = rng(51);
  const abierto = (x, y) => y >= 7 && x >= 14 && x < 50 && (y > 24 || Math.hypot(x + 0.5 - 32, y + 0.5 - 25) < 18);
  const marco = (x, y) => !abierto(x, y) && y >= 2 && x >= 9 && x < 55 && (y > 24 || Math.hypot(x + 0.5 - 32, y + 0.5 - 25) < 23);
  dibujaPiedra(b, r, {
    alto: (x, y, v) => {
      if (!marco(x, y)) return v;
      // dovelas: piezas en abanico en el arco y bloques en las jambas
      const ang = Math.atan2(y + 0.5 - 25, x + 0.5 - 32), dd = Math.abs(Math.sin(ang * 6.5));
      const junta = y <= 24 ? dd < 0.12 : (y % 10 === 0);
      return junta ? 0.4 : 1.2;
    },
    color: (x, y, v, c) => marco(x, y) ? escalar(c, 1.18) : c,
    emite: (x, y) => {
      if (!abierto(x, y)) return null;
      // luz del exterior que entra: blanca arriba, dorada abajo, con el suelo que se ve a lo lejos
      const t = (y - 7) / 57 + (TRAMA_T[(y & 3) * 4 + (x & 3)] / 16 - 0.5) * 0.08;
      return t < 0.5 ? mezclar([255, 252, 236], [255, 226, 160], t * 2) : mezclar([255, 226, 160], [214, 170, 100], (t - 0.5) * 2);
    },
  });
});

// ---------- Suelos y techos ----------

registrar('losa', b => {
  const r = rng(61), gasto = fbm(semilla(r), 2, 3);
  muro(b, r, [94, 88, 80], { alto: 32, ancho: 32, junta: 1, bisel: 3, mella: 0.8, mortero: [34, 30, 27], variacion: 0.16,
    marcas: grietas(rng(62), [[40, 36, 12], [12, 6, 9]]), capa: { color: (x, y, v, c) => escalar(c, 0.9 + gasto(x, y) * 0.2) } });
});
registrar('arena', b => {
  const r = rng(71), polvo = fbm(semilla(r), 4, 3);
  const k = (x, y) => suave((polvo(x, y) - 0.5) * 3);
  muro(b, r, [170, 136, 90], { alto: 32, ancho: 32, junta: 1, bisel: 2.5, mortero: [104, 80, 52], variacion: 0.14,
    capa: { alto: (x, y, v) => v * (1 - k(x, y)) + k(x, y) * 0.8, color: (x, y, v, c) => mezclar(c, [196, 164, 112], k(x, y)) } });
});
registrar('techo', b => {
  muro(b, rng(81), [62, 58, 54], { alto: 32, ancho: 64, junta: 1, bisel: 3, mortero: [22, 20, 18], variacion: 0.2 });
});
registrar('techo_arena', b => {
  // losas del techo con estrellas grabadas, como en las tumbas egipcias
  const r = rng(91), estrellas = new Float32Array(T * T);
  for (let n = 0; n < 6; n++) {
    const cx = 4 + Math.floor(r() * 56), cy = 4 + Math.floor(r() * 56);
    for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [2, 0], [-2, 0], [0, -2], [1, 2], [-1, 2]]) estrellas[(cy + dy) * T + cx + dx] = 0.6;
  }
  muro(b, r, [118, 92, 62], { alto: 32, ancho: 32, corrido: 0, junta: 1, bisel: 2.5, mortero: [52, 38, 24], variacion: 0.15, marcas: estrellas });
});

// ---------- Templo maldito ----------

function dibujaVolcanica(b, r, capa, marcas) {
  const brasa = ruidoSuave(semilla(r), 64);
  const vetas = unir(grietas(semilla(r), [[10, 40, 10], [50, 8, 8]]), marcas);
  muro(b, r, [86, 54, 44], {
    mortero: [30, 16, 12], variacion: 0.25, marcas: vetas,
    capa: componer({
      emite: (x, y, i) => vetas[i] >= 1 ? ((x + y) & 1 ? [255, 132, 34] : [222, 82, 22]) : brasa(x, y) > 0.992 ? [255, 160, 60] : null,
    }, capa),
  });
}
registrar('volcanica', b => dibujaVolcanica(b, rng(141)));
registrar('volcanica_grieta', b => dibujaVolcanica(b, rng(141), null, grietas(rng(19), [[31, 2, 40], [20, 30, 26]])));
registrar('tablilla_volcanica', b => dibujaVolcanica(b, rng(141), capaTablilla([150, 112, 84])));
registrar('losa_roja', b => {
  const r = rng(143), hollin = fbm(semilla(r), 4, 3);
  muro(b, r, [112, 70, 56], { alto: 32, ancho: 32, junta: 1, bisel: 3, mella: 0.8, mortero: [36, 20, 16], variacion: 0.18,
    capa: { color: (x, y, v, c) => escalar(c, 0.7 + hollin(x, y) * 0.45) } });
});
registrar('lava', b => {
  // costra oscura partida en placas, con lava viva en las juntas
  const r = rng(145), B = adoquines(r, 4, { junta: 0.6, bisel: 4, mella: 2.5 }), calor = fbm(semilla(r), 4, 2);
  superficie(b, (x, y) => B.a[y * T + x] * (0.8 + calor(x, y) * 0.2),
    (x, y, v, i) => mezclar([110, 40, 22], [58, 36, 30], suave(B.a[i] * 2.5)),
    { fuerza: 3, emite: (x, y, i) => {
      const a = B.a[i];
      if (a > 0.32) return null;
      const t = 1 - a / 0.32 + (TRAMA_T[(y & 3) * 4 + (x & 3)] / 16 - 0.5) * 0.3;
      return t > 0.75 ? [255, 236, 120] : t > 0.4 ? [255, 160, 40] : [226, 84, 20];
    } });
});
registrar('agujeros', b => {
  const hueco = (x, y) => x % 16 >= 5 && x % 16 < 10 && y % 16 >= 5 && y % 16 < 10;
  muro(b, rng(147), [94, 88, 80], { alto: 32, ancho: 32, junta: 1, bisel: 3, mortero: [34, 30, 27], variacion: 0.16,
    capa: { alto: (x, y, v) => hueco(x, y) ? 0 : v, color: (x, y, v, c) => hueco(x, y) ? [14, 10, 8] : c } });
});
registrar('abismo', b => {
  const r = rng(149), niebla = fbm(r, 2, 4);
  superficie(b, (x, y) => niebla(x, y), (x, y, v) => escalar([20, 17, 18], 0.5 + v * 0.9), { hondo: 0, fuerza: 0.6, niveles: 64 });
});
registrar('abismo_puente', b => {
  // el puente se camufla con el fondo: solo lo delatan juntas casi invisibles
  const r = rng(149), niebla = fbm(r, 2, 4);
  superficie(b, (x, y) => niebla(x, y), (x, y, v) => escalar([20, 17, 18], (0.5 + v * 0.9) * (y === 0 || y === 32 ? 1.5 : 1)), { hondo: 0, fuerza: 0.6, niveles: 64 });
});

// ---------- Tumba del cruzado ----------

// Nicho con cuatro calaveras y una hilera de huesos encima.
const capaNicho = {
  alto: (x, y, v) => {
    const px = x + 0.5, py = y + 0.5;
    if (px < 12 || px >= 52 || py < 22 || py >= 42) return v;
    for (let k = 0; k < 4; k++) {
      const cx = 17.5 + k * 9.6;
      const d = Math.hypot((px - cx) / 3.6, (py - 32.5) / 3.8);
      if (d < 1) {
        if (Math.hypot(px - cx + 1.5, py - 32.5) < 1.1 || Math.hypot(px - cx - 1.5, py - 32.5) < 1.1) return 0.45;   // cuencas
        return 0.55 + Math.sqrt(1 - d * d) * 0.6;
      }
      if (Math.abs(px - cx) < 2.6 && py >= 35.5 && py < 38.5) return py > 37.4 && Math.round(px) % 2 ? 0.6 : 0.85;  // mandíbula
    }
    if (py >= 24 && py < 28) { const ly = py - 24; return 0.5 + Math.sqrt(Math.max(0, 1 - ((ly % 2) - 1) ** 2)) * 0.4; }   // huesos apilados
    return 0.18 + suave(Math.min(px - 12, 52 - px, py - 22, 42 - py) / 2) * 0.02;
  },
  color: (x, y, v, c) => {
    if (x < 12 || x >= 52 || y < 22 || y >= 42) return c;
    return v > 0.3 ? [214, 204, 180] : [34, 28, 24];
  },
};
function dibujaCatacumba(b, r, capa, marcas) {
  muro(b, r, [140, 128, 108], { mortero: [70, 62, 52], variacion: 0.2, marcas, capa: componer(capaNicho, capa) });
}
registrar('catacumba', b => dibujaCatacumba(b, rng(151)));
registrar('catacumba_grieta', b => dibujaCatacumba(b, rng(151), null, grietas(rng(23), [[6, 2, 18], [56, 44, 18]])));
registrar('tablilla_catacumba', b => dibujaCatacumba(b, rng(151), capaTablilla([176, 164, 136])));


// ---------- Sprites (fondo transparente) ----------

function sprite(fn, opciones = {}) {
  return b => {
    const c = document.createElement('canvas');
    c.width = c.height = T;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    fn(g);
    const d = g.getImageData(0, 0, T, T).data;
    for (let i = 0; i < d.length; i += 4) { if (d[i + 3] < 128) d[i + 3] = 0; else d[i + 3] = 255; }
    if (opciones.relieve !== false) relieve(d);
    b.d.set(d);
  };
}

// Da volumen a un sprite plano. Con la distancia al borde se arma un relieve en cúpula y se ilumina
// con una luz desde arriba a la izquierda; las zonas hundidas reciben algo de sombra, el borde de
// abajo a la derecha un reflejo tenue, y todo se reduce con trama ordenada para seguir siendo pixel art.
// Al final, un contorno oscuro de 1 píxel para que se lea contra el fondo.
const LUZ = (() => { const v = [-0.55, -0.75, 0.9], l = Math.hypot(...v); return v.map(x => x / l); })();
const TRAMA = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
function relieve(d) {
  const orig = new Uint8ClampedArray(d);
  const op = i => orig[i * 4 + 3] > 0;
  // distancia aproximada al borde (chaflán 3-4), hasta 6 píxeles
  const MAX = 18;
  const dist = new Float32Array(T * T);
  for (let i = 0; i < T * T; i++) dist[i] = op(i) ? MAX : 0;
  const at = (x, y) => (x < 0 || y < 0 || x >= T || y >= T) ? 0 : dist[y * T + x];
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const i = y * T + x; if (!dist[i]) continue;
    dist[i] = Math.min(dist[i], at(x - 1, y) + 3, at(x, y - 1) + 3, at(x - 1, y - 1) + 4, at(x + 1, y - 1) + 4);
  }
  for (let y = T - 1; y >= 0; y--) for (let x = T - 1; x >= 0; x--) {
    const i = y * T + x; if (!dist[i]) continue;
    dist[i] = Math.min(dist[i], at(x + 1, y) + 3, at(x, y + 1) + 3, at(x + 1, y + 1) + 4, at(x - 1, y + 1) + 4);
  }
  const alto = (x, y) => { const v = at(x, y) / MAX; return Math.sqrt(Math.max(0, v * (2 - v))); }; // cúpula
  const paso = 255 / 15;
  const borde = [];
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const i = y * T + x, k = i * 4;
    if (!op(i)) {
      if ((x > 0 && op(i - 1)) || (x < T - 1 && op(i + 1)) || (y > 0 && op(i - T)) || (y < T - 1 && op(i + T))) borde.push(k);
      continue;
    }
    const nx = (alto(x - 1, y) - alto(x + 1, y)) * 1.6, ny = (alto(x, y - 1) - alto(x, y + 1)) * 1.6;
    const nl = Math.hypot(nx, ny, 1);
    const difusa = Math.max(0, (nx * LUZ[0] + ny * LUZ[1] + LUZ[2]) / nl);
    let f = 0.42 + difusa * 0.78;
    f *= 1.04 - (y / T) * 0.16;                                // un poco más oscuro hacia los pies
    // reflejo tenue en el borde de abajo a la derecha
    if (dist[i] <= 3 && (nx > 0.15 || ny > 0.15)) f += 0.1;
    const umbral = (TRAMA[(y % 4) * 4 + (x % 4)] + 0.5) / 16;
    for (let c = 0; c < 3; c++) {
      const v = Math.min(255, orig[k + c] * f) / paso, b = Math.floor(v);
      d[k + c] = Math.min(255, (b + (v - b > umbral ? 1 : 0)) * paso);
    }
  }
  for (const k of borde) { d[k] = 18; d[k + 1] = 12; d[k + 2] = 8; d[k + 3] = 255; }
}

function hexRGB(c) { const n = parseInt(c.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }

// Trama ordenada 4x4 para degradados con píxeles enteros (los sprites no tienen transparencia parcial).
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
function tramado(g, color, intensidad, desfase = 0) {
  g.fillStyle = color;
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const v = intensidad(x, y);
    if (v > 0 && v * 16 > BAYER[((y + desfase) % 4) * 4 + ((x + desfase) % 4)]) g.fillRect(x, y, 1, 1);
  }
}

function r(g, x, y, w, h, c) { g.fillStyle = c; g.fillRect(x, y, w, h); }

// Enemigos. Cada uno tiene su silueta propia para reconocerlo de lejos.
// pose: 0/1 caminar, 2 ataque, 3 dolor, 4 muerto, 5 y 6 cayendo (animación de muerte),
// 7 lanzar (brazos al frente), 8 paso intermedio.
// Los humanoides comparten esqueleto o cuerpo macizo y se distinguen por lo que llevan encima;
// las bestias (escorpión, araña, serpiente) y el coloso de piedra se dibujan enteros.
const ESTILOS = {
  // momia que avanza con los brazos al frente: un ojo tapado por las vendas, el otro encendido
  momia: { cuerpo: 'momia', piel: '#cbbb90', sombra: '#8f7f5b', ojo: '#ff5a1f', brazos: 'adelante' },
  // esqueleto con espada oxidada, escudo roto y ojos verdes
  esqueleto: { cuerpo: 'huesos', piel: '#e4ddc8', sombra: '#a8a08a', ojo: '#8dff6a' },
  // guerrero vikingo congelado: hombreras de piel, casco de cuernos, barba de escarcha y hacha
  draugr: { cuerpo: 'momia', piel: '#8fa6b4', sombra: '#536b7a', ojo: '#7fe8ff', liso: true, hombros: 3 },
  // esqueleto pirata: tricornio, parche, casaca, garfio y alfanje
  pirata: { cuerpo: 'huesos', piel: '#ddd3b8', sombra: '#9e957c', ojo: '#ffb03a' },
  // guerrero jaguar: la cabeza del jaguar por casco, abanico de plumas y macana de obsidiana
  jaguar: { cuerpo: 'momia', piel: '#9a6234', sombra: '#5e3618', ojo: '#ffe14a', liso: true },
  // sectario del templo maldito: túnica hasta el suelo, capucha, máscara de calavera y fuego en la mano
  sectario: { cuerpo: 'momia', piel: '#7a1e14', sombra: '#420c08', ojo: '#ffcc33', liso: true, tunica: true },
  // caballero cruzado: yelmo cerrado con ojos rojos en la mirilla, sobreveste, escudo y espada
  caballero: { cuerpo: 'momia', piel: '#8e949c', sombra: '#545a62', ojo: '#ff3a20', liso: true, malla: true },
};
const BESTIAS_ARTE = { escorpion, arana, serpiente, coloso };
const TIPOS_ENEMIGO = [...Object.keys(ESTILOS), ...Object.keys(BESTIAS_ARTE)];

function postura(pose) {
  return {
    dy: pose === 3 ? 2 : pose === 8 ? -1 : 0,
    vaiven: pose === 0 ? 2 : pose === 1 ? -2 : 0, // los brazos se balancean al caminar
    alza: pose === 2 ? -10 : pose === 7 ? -6 : 0,
    subeI: pose === 1 ? 2 : 0, subeD: pose === 0 ? 2 : 0, // pie que se levanta al caminar
    ataca: pose === 2, dolor: pose === 3, lanza: pose === 7,
  };
}

// Segmento de un miembro: cónico, con los extremos redondeados (hombro-codo, codo-mano...).
function miembro(g, x0, y0, x1, y1, a0, a1, c) {
  g.fillStyle = c;
  const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
  g.beginPath(); g.moveTo(x0 + nx * a0, y0 + ny * a0); g.lineTo(x1 + nx * a1, y1 + ny * a1); g.lineTo(x1 - nx * a1, y1 - ny * a1); g.lineTo(x0 - nx * a0, y0 - ny * a0); g.fill();
  g.beginPath(); g.arc(x0, y0, a0, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(x1, y1, a1, 0, Math.PI * 2); g.fill();
}
function ovalo(g, x, y, rx, ry, c) { g.fillStyle = c; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); g.fill(); }

// Dónde quedan las manos (para empuñar armas).
function manos(e, p) {
  if (e.brazos === 'adelante') return { yI: 27 + p.dy + p.alza * 0.6 + p.vaiven, yD: 27 + p.dy + p.alza * 0.6 - p.vaiven, xI: 22, xD: 42 };
  return { yI: 43 + p.dy + p.alza + p.vaiven, yD: 43 + p.dy + p.alza - p.vaiven, xI: 17, xD: 47 };
}

// Cuerpo con carne, vendas o armadura: hombros redondos, cintura más angosta, miembros que se afinan y manos.
function cuerpoMacizo(g, e, p) {
  const { piel, sombra } = e, { dy, alza, vaiven, subeI, subeD } = p, w = e.hombros || 0;
  if (e.tunica) {
    // túnica hasta el suelo que se mece al caminar, con pliegues y el borde deshilachado
    const m = vaiven / 2;
    g.fillStyle = piel; g.beginPath();
    g.moveTo(23, 36 + dy); g.lineTo(41, 36 + dy); g.lineTo(48 + m, 61);
    for (let x = 48; x >= 16; x -= 4) g.lineTo(x + m - 2, x % 8 ? 58 : 62);
    g.lineTo(16 + m, 61); g.closePath(); g.fill();
    g.fillStyle = sombra; for (const x of [26, 32, 38]) { g.beginPath(); g.moveTo(x, 42 + dy); g.lineTo(x + (x - 32) * 0.35 + m - 1, 60); g.lineTo(x + (x - 32) * 0.35 + m + 1, 60); g.fill(); }
  } else {
    miembro(g, 27, 41 + dy, 26, 58 - subeI, 4.6, 3.4, piel); ovalo(g, 25, 60 - subeI, 4.5, 2.6, sombra);
    miembro(g, 37, 41 + dy, 38, 58 - subeD, 4.6, 3.4, piel); ovalo(g, 39, 60 - subeD, 4.5, 2.6, sombra);
    g.fillStyle = sombra; g.fillRect(31, 42 + dy, 2, 8); // entrepierna
  }
  // torso: hombros anchos que bajan a la cintura, y la pelvis
  g.fillStyle = piel; g.beginPath();
  g.moveTo(20 - w, 23 + dy); g.quadraticCurveTo(32, 18 + dy, 44 + w, 23 + dy); g.lineTo(41, 40 + dy); g.lineTo(23, 40 + dy); g.closePath(); g.fill();
  ovalo(g, 21 - w, 24 + dy, 4 + w / 2, 4 + w / 2, piel); ovalo(g, 43 + w, 24 + dy, 4 + w / 2, 4 + w / 2, piel);
  g.fillStyle = piel; g.beginPath(); g.roundRect(22, 36 + dy, 20, 8, 4); g.fill();
  g.fillStyle = sombra; g.fillRect(25, 30 + dy, 14, 1); g.fillRect(31, 24 + dy, 2, 10); // pecho y esternón
  // cuello y cabeza
  g.fillStyle = sombra; g.fillRect(29, 17 + dy, 6, 5);
  ovalo(g, 32, 12 + dy, 7.5, 8, piel);
  g.fillStyle = sombra; g.fillRect(25, 13 + dy, 14, 1);
  ovalo(g, 29, 12 + dy, 2.4, 1.8, '#1a0e06'); ovalo(g, 35, 12 + dy, 2.4, 1.8, '#1a0e06');
  r(g, 28, 11 + dy, 2, 2, e.ojo); r(g, 34, 11 + dy, 2, 2, e.ojo);
  const mn = manos(e, p);
  if (e.brazos === 'adelante') {
    // brazos estirados hacia ti: se ven cortos, con las manos grandes delante del pecho
    miembro(g, 19, 25 + dy, mn.xI - 1, mn.yI, 3.8, 3.4, piel); ovalo(g, mn.xI, mn.yI, 4, 3.6, sombra);
    miembro(g, 45, 25 + dy, mn.xD + 1, mn.yD, 3.8, 3.4, piel); ovalo(g, mn.xD, mn.yD, 4, 3.6, sombra);
    for (let k = 0; k < 3; k++) { r(g, mn.xI - 3 + k * 2, mn.yI + 2, 1, 3, sombra); r(g, mn.xD - 2 + k * 2, mn.yD + 2, 1, 3, sombra); }
  } else {
    const codoI = 33 + dy + alza / 2 + vaiven, codoD = 33 + dy + alza / 2 - vaiven;
    miembro(g, 19 - w, 25 + dy, 16 - w / 2, codoI, 3.8, 3, piel); miembro(g, 16 - w / 2, codoI, 17, mn.yI - 2, 3, 2.6, piel); ovalo(g, 17, mn.yI, 3, 3.2, sombra);
    miembro(g, 45 + w, 25 + dy, 48 + w / 2, codoD, 3.8, 3, piel); miembro(g, 48 + w / 2, codoD, 47, mn.yD - 2, 3, 2.6, piel); ovalo(g, 47, mn.yD, 3, 3.2, sombra);
  }
  // texturas sobre lo ya pintado: vendas cruzadas o cota de malla
  g.save(); g.globalCompositeOperation = 'source-atop';
  if (e.malla) {
    for (let y = 0; y < 64; y += 2) for (let x = (y / 2) % 2; x < 64; x += 2) r(g, x, y, 1, 1, 'rgba(20,24,30,.35)');
  } else if (!e.liso) {
    for (let y = 4; y < 64; y += 4) {
      g.fillStyle = sombra; g.save(); g.translate(32, y + dy); g.rotate((y % 8 ? 1 : -1) * 0.12); g.fillRect(-30, 0, 60, 1); g.fillStyle = 'rgba(255,250,235,.35)'; g.fillRect(-30, 1, 60, 1); g.restore();
    }
    g.fillStyle = 'rgba(0,0,0,.18)'; for (let i = 0; i < 40; i++) g.fillRect((i * 37) % 64, (i * 23) % 64, 1, 1); // mugre
  }
  g.restore();
}

// Esqueleto: cráneo con mandíbula, columna, costillas curvas, pelvis y huesos con articulaciones.
function esqueletoDe(g, e, p) {
  const hueso = e.piel, osc = e.sombra, { dy, alza, vaiven, subeI, subeD } = p;
  const art = (x, y) => ovalo(g, x, y, 2.3, 2.3, hueso);
  miembro(g, 27, 40 + dy, 26, 50, 1.7, 1.5, hueso); art(26, 50); miembro(g, 26, 50, 26, 59 - subeI, 1.5, 1.4, hueso); ovalo(g, 25, 61 - subeI, 4, 1.8, hueso);
  miembro(g, 37, 40 + dy, 38, 50, 1.7, 1.5, hueso); art(38, 50); miembro(g, 38, 50, 38, 59 - subeD, 1.5, 1.4, hueso); ovalo(g, 39, 61 - subeD, 4, 1.8, hueso);
  g.fillStyle = hueso; g.beginPath(); g.moveTo(24, 36 + dy); g.lineTo(40, 36 + dy); g.lineTo(37, 42 + dy); g.lineTo(32, 40 + dy); g.lineTo(27, 42 + dy); g.closePath(); g.fill();
  ovalo(g, 28, 39 + dy, 1.4, 1.4, osc); ovalo(g, 36, 39 + dy, 1.4, 1.4, osc);
  for (let y = 18; y < 37; y += 3) { r(g, 30, y + dy, 4, 2, hueso); r(g, 31, y + 2 + dy, 2, 1, osc); }
  g.strokeStyle = hueso; g.lineWidth = 2;
  g.beginPath(); g.moveTo(21, 22 + dy); g.quadraticCurveTo(32, 19 + dy, 43, 22 + dy); g.stroke();
  for (let i = 0; i < 4; i++) { g.beginPath(); g.ellipse(32, 23 + i * 4 + dy, 10 - i, 3.2, 0, Math.PI * 0.04, Math.PI * 0.96); g.stroke(); }
  const codoI = 32 + dy + alza / 2 + vaiven, manoI = 40 + dy + alza + vaiven;
  const codoD = 32 + dy + alza / 2 - vaiven, manoD = 40 + dy + alza - vaiven;
  art(20, 23 + dy); miembro(g, 20, 23 + dy, 18, codoI, 1.6, 1.4, hueso); art(18, codoI); miembro(g, 18, codoI, 18, manoI, 1.4, 1.2, hueso);
  for (let k = -1; k <= 1; k++) r(g, 17 + k * 1.5, manoI + 1, 1, 4, hueso);
  art(44, 23 + dy); miembro(g, 44, 23 + dy, 46, codoD, 1.6, 1.4, hueso); art(46, codoD); miembro(g, 46, codoD, 46, manoD, 1.4, 1.2, hueso);
  for (let k = -1; k <= 1; k++) r(g, 46 + k * 1.5, manoD + 1, 1, 4, hueso);
  // cráneo; la mandíbula se descuelga al atacar
  ovalo(g, 32, 11 + dy, 7.2, 7.5, hueso);
  const boca = p.ataca ? 3 : 0;
  g.fillStyle = hueso; g.beginPath(); g.roundRect(27, 15 + dy + boca, 10, 5, 2); g.fill();
  if (boca) r(g, 28, 16 + dy, 8, boca + 1, '#1a0e06');
  ovalo(g, 29, 11 + dy, 2.3, 2.5, '#1a0e06'); ovalo(g, 35, 11 + dy, 2.3, 2.5, '#1a0e06');
  r(g, 29, 11 + dy, 1, 1, e.ojo); r(g, 35, 11 + dy, 1, 1, e.ojo);
  g.fillStyle = '#1a0e06'; g.beginPath(); g.moveTo(32, 13 + dy); g.lineTo(30.5, 16 + dy); g.lineTo(33.5, 16 + dy); g.fill();
  r(g, 28, 18 + dy + boca, 8, 1, '#1a0e06'); for (let x = 29; x < 36; x += 2) r(g, x, 17 + dy + boca, 1, 3, '#1a0e06');
}

// Lo que cada humanoide lleva encima. `detras` se pinta antes del cuerpo.
const ADORNOS = {
  momia: {
    delante(g, e, p) {
      const { dy } = p;
      // vendas sobre el ojo izquierdo; el derecho arde
      g.fillStyle = e.piel; g.save(); g.translate(29, 11 + dy); g.rotate(-0.35); g.fillRect(-5, -2, 10, 4); g.restore();
      r(g, 25, 11 + dy, 8, 1, e.sombra);
      ovalo(g, 35, 12 + dy, 2.8, 2.2, '#1a0e06'); r(g, 34, 11 + dy, 3, 2, e.ojo); r(g, 35, 11 + dy, 1, 1, '#ffd8a0');
      // gemido: la boca se abre más al atacar
      ovalo(g, 32, 17 + dy, p.ataca ? 3 : 2.2, p.ataca ? 2.2 : 1.2, '#1a0e06');
      // vendas sueltas que cuelgan de la cabeza y de las manos
      g.fillStyle = e.piel; g.beginPath(); g.moveTo(38, 8 + dy); g.lineTo(41, 9 + dy); g.lineTo(46 - p.vaiven, 22 + dy); g.lineTo(44 - p.vaiven, 23 + dy); g.fill();
      const mn = manos(e, p);
      g.beginPath(); g.moveTo(mn.xD + 2, mn.yD); g.lineTo(mn.xD + 4, mn.yD); g.lineTo(mn.xD + 6 + p.vaiven, mn.yD + 13); g.lineTo(mn.xD + 4 + p.vaiven, mn.yD + 14); g.fill();
      // huecos en las vendas que dejan ver la carne seca
      ovalo(g, 38, 35 + dy, 2, 1.4, '#3a2a18'); ovalo(g, 26, 50, 1.3, 2, '#3a2a18'); ovalo(g, 25, 31 + dy, 1.4, 1, '#3a2a18');
      // amuleto de escarabajo en el pecho
      ovalo(g, 32, 33 + dy, 3.2, 2.6, '#c8a040'); ovalo(g, 32, 33 + dy, 2.2, 1.8, '#2a62b8'); r(g, 32, 31 + dy, 1, 4, '#163a7a');
    },
  },
  esqueleto: {
    delante(g, e, p) {
      const { dy, alza, vaiven } = p, yD = 40 + dy + alza - vaiven;
      // espada oxidada, mellada
      r(g, 45, yD - 22, 3, 22, '#9a8268'); r(g, 46, yD - 22, 1, 21, '#c8b8a0'); r(g, 45, yD - 14, 1, 2, '#3a2a1a'); r(g, 47, yD - 8, 1, 2, '#3a2a1a');
      r(g, 42, yD - 1, 9, 2, '#6a5030'); r(g, 45, yD + 1, 3, 4, '#4a3420');
      // escudo redondo de madera, partido
      const sy = 33 + dy + vaiven;
      ovalo(g, 15, sy, 8, 8.5, '#5a5a62'); ovalo(g, 15, sy, 6.8, 7.3, '#7a5028');
      r(g, 9, sy - 1, 13, 1, '#4a3018'); r(g, 9, sy + 3, 13, 1, '#4a3018');
      ovalo(g, 15, sy, 2, 2, '#a8a8b0');
      g.strokeStyle = '#1a0e06'; g.lineWidth = 1; g.beginPath(); g.moveTo(12, sy - 7); g.lineTo(14, sy - 3); g.lineTo(11, sy + 1); g.lineTo(13, sy + 6); g.stroke();
    },
  },
  draugr: {
    detras(g, e, p) {
      // capa de piel que asoma tras los hombros
      ovalo(g, 32, 34 + p.dy, 17, 14, '#3a2a1c');
    },
    delante(g, e, p) {
      const { dy } = p, mn = manos(e, p);
      // hacha de dos manos: astil y hoja de media luna escarchada
      r(g, 46, mn.yD - 22, 3, 30, '#5a3a1e'); r(g, 46, mn.yD - 22, 1, 30, '#7a5230');
      g.fillStyle = '#b8c4cc'; g.beginPath(); g.moveTo(49, mn.yD - 20); g.quadraticCurveTo(60, mn.yD - 22, 59, mn.yD - 10); g.quadraticCurveTo(56, mn.yD - 12, 49, mn.yD - 10); g.fill();
      r(g, 57, mn.yD - 20, 2, 9, '#e8f4fa');
      // hombreras de piel
      for (const x of [16, 48]) { ovalo(g, x, 23 + dy, 7, 5, '#4a3422'); for (let k = -2; k <= 2; k++) r(g, x + k * 2.5, 26 + dy, 2, 3, '#2e2014'); }
      // casco de cuernos con nasal
      ovalo(g, 32, 6 + dy, 8.5, 5.5, '#6a6e74'); r(g, 25, 4 + dy, 3, 2, '#9aa0a8');
      r(g, 23, 7 + dy, 18, 3, '#8a8f96'); r(g, 31, 7 + dy, 2, 8, '#8a8f96');
      for (const s of [-1, 1]) {
        g.strokeStyle = '#e8e0c8'; g.lineCap = 'round';
        g.lineWidth = 3.4; g.beginPath(); g.moveTo(32 + s * 8, 7 + dy); g.quadraticCurveTo(32 + s * 15, 6 + dy, 32 + s * 14, -1 + dy); g.stroke();
        r(g, 32 + s * 14 - 1, -1 + dy, 2, 2, '#fff8e8');
      }
      // barba larga de escarcha, trenzada
      g.fillStyle = '#d8e6ee'; g.beginPath(); g.moveTo(25, 15 + dy); g.lineTo(39, 15 + dy); g.lineTo(37, 26 + dy); g.lineTo(33, 34 + dy); g.lineTo(31, 34 + dy); g.lineTo(27, 26 + dy); g.closePath(); g.fill();
      for (let y = 20; y < 33; y += 3) { r(g, 30, y + dy, 1, 2, '#8aa4b4'); r(g, 33, y + dy, 1, 2, '#8aa4b4'); }
      r(g, 29, 17 + dy, 6, 1, '#6a8494');
    },
  },
  pirata: {
    delante(g, e, p) {
      const { dy, alza, vaiven } = p, yI = 40 + dy + alza + vaiven, yD = 40 + dy + alza - vaiven;
      // casaca azul abierta, con botones de latón
      g.fillStyle = '#24305a';
      g.beginPath(); g.moveTo(19, 21 + dy); g.lineTo(27, 22 + dy); g.lineTo(25, 46 + dy); g.lineTo(18, 48 + dy); g.fill();
      g.beginPath(); g.moveTo(45, 21 + dy); g.lineTo(37, 22 + dy); g.lineTo(39, 46 + dy); g.lineTo(46, 48 + dy); g.fill();
      for (let y = 26; y < 44; y += 5) { r(g, 25, y + dy, 1, 1, '#e8c060'); r(g, 38, y + dy, 1, 1, '#e8c060'); }
      // faja roja
      r(g, 24, 35 + dy, 16, 3, '#b02020'); r(g, 36, 38 + dy, 3, 6, '#b02020');
      // parche con su cinta y aro de oro
      g.strokeStyle = '#111'; g.lineWidth = 1; g.beginPath(); g.moveTo(25, 7 + dy); g.lineTo(38, 15 + dy); g.stroke();
      ovalo(g, 29, 11 + dy, 2.8, 2.6, '#111');
      ovalo(g, 25, 15 + dy, 1.4, 1.6, '#e8c060'); r(g, 25, 15 + dy, 1, 1, '#3a2a1a');
      // tricornio con calavera
      g.fillStyle = '#1c1814'; g.beginPath(); g.moveTo(18, 7 + dy); g.lineTo(23, 0 + dy); g.lineTo(32, 2 + dy); g.lineTo(41, 0 + dy); g.lineTo(46, 7 + dy); g.lineTo(32, 5 + dy); g.closePath(); g.fill();
      ovalo(g, 32, 3 + dy, 7, 3.5, '#1c1814');
      r(g, 19, 6 + dy, 12, 1, '#c8a040'); r(g, 33, 6 + dy, 12, 1, '#c8a040');
      r(g, 31, 1 + dy, 3, 2, '#e8e0c8'); r(g, 31, 3 + dy, 1, 1, '#1c1814'); r(g, 33, 3 + dy, 1, 1, '#1c1814');
      // garfio en la izquierda
      r(g, 15, yI, 5, 3, '#5a3a1a');
      g.strokeStyle = '#c8ccd2'; g.lineWidth = 1.6; g.beginPath(); g.arc(16, yI + 6, 3, -Math.PI / 2, Math.PI * 0.9); g.stroke();
      // alfanje curvo en la derecha
      g.strokeStyle = '#d8dde4'; g.lineWidth = 2.6; g.beginPath(); g.moveTo(47, yD); g.quadraticCurveTo(53, yD - 10, 49, yD - 21); g.stroke();
      g.strokeStyle = '#c8a040'; g.lineWidth = 1.4; g.beginPath(); g.arc(47, yD + 1, 3, Math.PI, 0); g.stroke();
    },
  },
  jaguar: {
    detras(g, e, p) {
      // abanico de plumas de quetzal
      const colores = ['#2fa860', '#2f6ad0', '#2fa860', '#d03030', '#2fa860', '#2f6ad0', '#2fa860'];
      colores.forEach((c, i) => {
        const a = -Math.PI / 2 + (i - 3) * 0.42;
        const x = 32 + Math.cos(a) * 12, y = 13 + p.dy + Math.sin(a) * 10;
        g.save(); g.translate(x, y); g.rotate(a + Math.PI / 2); ovalo(g, 0, 0, 2.6, 8, c); ovalo(g, 0, -5, 1.6, 2.4, '#e8c020'); g.restore();
      });
    },
    delante(g, e, p) {
      const { dy } = p, mn = manos(e, p);
      const PIEL = '#d9a441', MOTA = '#3a2008';
      // piel de jaguar sobre los hombros
      for (const x of [19, 45]) { ovalo(g, x, 24 + dy, 6, 5, PIEL); r(g, x - 2, 22 + dy, 2, 2, MOTA); r(g, x + 2, 25 + dy, 2, 1, MOTA); }
      // taparrabos rojo y collar de jade
      g.fillStyle = '#b02a20'; g.beginPath(); g.moveTo(28, 40 + dy); g.lineTo(36, 40 + dy); g.lineTo(35, 51); g.lineTo(29, 51); g.fill();
      for (let x = 25; x < 40; x += 3) ovalo(g, x + 1, 21 + dy + Math.abs(x - 31) * 0.15, 1.5, 1.5, '#2fb46a');
      // pintura de guerra en la cara
      r(g, 25, 14 + dy, 14, 2, '#1a1a1a');
      // la cabeza del jaguar como casco: orejas, ojos de jade y colmillos sobre la frente
      ovalo(g, 32, 5 + dy, 9.5, 6.5, PIEL);
      ovalo(g, 24, 0 + dy, 2.6, 2.6, PIEL); ovalo(g, 40, 0 + dy, 2.6, 2.6, PIEL); r(g, 24, 0 + dy, 1, 1, MOTA); r(g, 40, 0 + dy, 1, 1, MOTA);
      for (const [x, y] of [[28, 2], [35, 1], [32, 4], [26, 6], [38, 6]]) ovalo(g, x, y + dy, 1.3, 1, MOTA);
      r(g, 27, 3 + dy, 3, 2, '#3fd08a'); r(g, 34, 3 + dy, 3, 2, '#3fd08a');
      r(g, 23, 9 + dy, 18, 2, PIEL);
      g.fillStyle = '#f4ecd8';
      for (const x of [26, 36]) { g.beginPath(); g.moveTo(x, 10 + dy); g.lineTo(x + 2, 10 + dy); g.lineTo(x + 1, 14 + dy); g.fill(); }
      // macana: paleta de madera con filos de obsidiana
      r(g, 45, mn.yD - 22, 4, 26, '#7a4a20'); r(g, 45, mn.yD - 22, 1, 26, '#9a6a3a');
      g.fillStyle = '#16121e';
      for (let k = 0; k < 5; k++) { const y = mn.yD - 21 + k * 4; g.beginPath(); g.moveTo(44, y); g.lineTo(42, y + 1.5); g.lineTo(44, y + 3); g.fill(); g.beginPath(); g.moveTo(49, y); g.lineTo(51, y + 1.5); g.lineTo(49, y + 3); g.fill(); }
    },
  },
  sectario: {
    delante(g, e, p) {
      const { dy } = p, mn = manos(e, p);
      // cordón dorado y collar de calaveritas
      r(g, 23, 37 + dy, 18, 2, '#c8a050'); r(g, 34, 39 + dy, 2, 7, '#c8a050');
      for (let x = 26; x <= 38; x += 4) { ovalo(g, x, 27 + dy + Math.abs(x - 32) * 0.2, 1.6, 1.6, '#e8e0c8'); r(g, x - 1, 27 + dy, 1, 1, '#111'); }
      // capucha en punta
      g.fillStyle = '#5a1610'; g.beginPath(); g.moveTo(21, 23 + dy); g.lineTo(23, 7 + dy); g.lineTo(32, -2 + dy); g.lineTo(41, 7 + dy); g.lineTo(43, 23 + dy); g.lineTo(38, 21 + dy); g.lineTo(26, 21 + dy); g.closePath(); g.fill();
      // máscara de calavera con ojos encendidos
      ovalo(g, 32, 13 + dy, 6, 7, '#e8e0c8');
      ovalo(g, 29.5, 12 + dy, 1.8, 2, '#111'); ovalo(g, 34.5, 12 + dy, 1.8, 2, '#111');
      r(g, 29, 12 + dy, 1, 1, e.ojo); r(g, 34, 12 + dy, 1, 1, e.ojo);
      g.fillStyle = '#111'; g.beginPath(); g.moveTo(32, 14 + dy); g.lineTo(31, 16 + dy); g.lineTo(33, 16 + dy); g.fill();
      r(g, 29, 18 + dy, 6, 1, '#111'); for (let x = 30; x < 35; x += 2) r(g, x, 17 + dy, 1, 3, '#111');
      // manos pálidas: daga ondulada en la derecha y una llamita en la izquierda
      ovalo(g, mn.xI, mn.yI, 3, 3.2, '#c8b898'); ovalo(g, mn.xD, mn.yD, 3, 3.2, '#c8b898');
      g.strokeStyle = '#c8ccd2'; g.lineWidth = 2; g.beginPath(); g.moveTo(47, mn.yD - 2);
      for (let k = 1; k <= 4; k++) g.lineTo(47 + (k % 2 ? 1.5 : -1.5), mn.yD - 2 - k * 3.5); g.stroke();
      r(g, 45, mn.yD - 2, 5, 2, '#c8a040');
      if (!p.lanza) { ovalo(g, mn.xI, mn.yI - 6, 2.6, 3.6, '#ff8a1a'); ovalo(g, mn.xI, mn.yI - 5, 1.4, 2, '#ffe14a'); }
    },
  },
  caballero: {
    delante(g, e, p) {
      const { dy, vaiven } = p, mn = manos(e, p);
      // sobreveste blanca con la cruz roja y cinturón
      g.fillStyle = '#eeeae0'; g.beginPath(); g.moveTo(22, 21 + dy); g.lineTo(42, 21 + dy); g.lineTo(43, 50); g.lineTo(38, 52); g.lineTo(32, 50); g.lineTo(26, 52); g.lineTo(21, 50); g.closePath(); g.fill();
      r(g, 30, 24 + dy, 4, 23, '#b02020'); r(g, 25, 29 + dy, 14, 4, '#b02020');
      r(g, 22, 37 + dy, 20, 2, '#5a3a1e'); r(g, 31, 37 + dy, 2, 2, '#c8a040');
      // yelmo cerrado con la mirilla en cruz y los ojos que brillan dentro
      g.fillStyle = '#8a9098'; g.beginPath(); g.roundRect(24, 2 + dy, 16, 18, 2); g.fill();
      r(g, 24, 2 + dy, 16, 2, '#c8ccd2'); r(g, 24, 9 + dy, 16, 1, '#c8a040');
      r(g, 25, 11 + dy, 14, 2, '#111'); r(g, 31, 11 + dy, 2, 7, '#111');
      r(g, 27, 11 + dy, 2, 1, e.ojo); r(g, 35, 11 + dy, 2, 1, e.ojo);
      for (const [x, y] of [[27, 15], [36, 15], [27, 17], [36, 17]]) r(g, x, y + dy, 1, 1, '#2a2e34');
      // escudo de cometa en el brazo izquierdo
      const sy = 27 + dy + vaiven;
      g.fillStyle = '#5a5e66'; g.beginPath(); g.moveTo(8, sy); g.lineTo(25, sy); g.lineTo(25, sy + 12); g.lineTo(16.5, sy + 23); g.lineTo(8, sy + 12); g.closePath(); g.fill();
      g.fillStyle = '#eeeae0'; g.beginPath(); g.moveTo(9.5, sy + 1.5); g.lineTo(23.5, sy + 1.5); g.lineTo(23.5, sy + 11.5); g.lineTo(16.5, sy + 20.5); g.lineTo(9.5, sy + 11.5); g.closePath(); g.fill();
      r(g, 15, sy + 2, 3, 17, '#b02020'); r(g, 10, sy + 6, 13, 3, '#b02020');
      // espada larga
      r(g, 46, mn.yD - 26, 3, 25, '#d8dde4'); r(g, 47, mn.yD - 26, 1, 24, '#ffffff');
      r(g, 42, mn.yD - 2, 11, 2, '#c8a040'); r(g, 46, mn.yD, 3, 4, '#5a3a1e'); ovalo(g, 47.5, mn.yD + 5, 1.6, 1.6, '#c8a040');
    },
  },
};

function humanoide(g, tipo, pose) {
  const e = ESTILOS[tipo], ad = ADORNOS[tipo] || {};
  // muerte: el mismo cuerpo (en pose de dolor) que se arrodilla, se desploma y queda tendido
  if (pose === 4 || pose === 5 || pose === 6) { caida(g, pose, () => humanoide(g, tipo, 3)); return; }
  const p = postura(pose);
  ad.detras?.(g, e, p);
  if (e.cuerpo === 'momia') cuerpoMacizo(g, e, p);
  else esqueletoDe(g, e, p);
  ad.delante?.(g, e, p);
  herida(g, p, 29, 28 + p.dy);
  if (p.lanza) { // conjuro: fuego entre las manos
    r(g, 26, 20, 12, 10, '#ff8a1a'); r(g, 28, 22, 8, 6, '#ffe14a'); r(g, 30, 24, 4, 2, '#fff8d0');
  }
}

// La animación de muerte común: se dobla, se desploma y queda tendido de lado.
function caida(g, pose, dibujar, tendido) {
  g.save();
  if (pose === 5) { g.translate(32, 62); g.rotate(0.12); g.scale(1, 0.78); g.translate(-32, -62); }
  else if (pose === 6) { g.translate(32, 62); g.rotate(0.6); g.scale(0.85, 0.85); g.translate(-32, -62); }
  else if (tendido) { g.restore(); tendido(); return; }
  else { g.translate(32, 54); g.rotate(Math.PI / 2); g.scale(0.9, 0.9); g.translate(-32, -37); }
  dibujar();
  g.restore();
}
function herida(g, p, x, y) {
  if (p.dolor) { ovalo(g, x, y, 3, 2, '#7a1010'); r(g, x, y + 2, 1, 3, '#7a1010'); }
}

// ---------- Bestias ----------

// Escorpión gigante, visto de frente: pinzas abiertas a los lados y la cola curvada por encima,
// con el aguijón apuntándote. Al atacar, la cola se lanza hacia delante.
function escorpion(g, pose) {
  const C = '#b4521f', O = '#5e240c', CL = '#e08a3a', VENENO = '#9aff4a';
  if (pose >= 4 && pose <= 6) {
    caida(g, pose, () => escorpion(g, 3), () => {
      // panza arriba, con las patas encogidas
      for (let i = 0; i < 4; i++) for (const s of [-1, 1]) trazo(g, O, 2.4, 32 + s * 8, 52, 32 + s * (12 + i * 3), 44 - i, 32 + s * (10 + i * 3), 40 - i * 2);
      ovalo(g, 32, 54, 14, 6, C); ovalo(g, 32, 54, 10, 4, '#d8a060');
      for (let x = 24; x <= 40; x += 4) r(g, x, 51, 1, 6, O);
      trazo(g, C, 4, 44, 56, 52, 58, 58, 55); ovalo(g, 59, 54, 3, 2.4, O);
      ovalo(g, 12, 55, 5, 3.4, C);
    });
    return;
  }
  const p = postura(pose), golpe = p.ataca || p.lanza, s = p.vaiven;
  // patas: cuatro por lado, alternando al caminar
  for (let i = 0; i < 4; i++) {
    const alza = ((i + (pose === 1 ? 1 : 0)) % 2 && pose !== 8) ? 2 : 0;
    for (const lado of [-1, 1]) {
      const ax = 32 + lado * 9, ay = 44 + i * 3, kx = 32 + lado * (18 + i * 2), ky = 38 + i * 3 - alza, fx = 32 + lado * (26 - i * 1.5), fy = 60 - (lado > 0 ? alza : 0);
      trazo(g, O, 3, ax, ay, kx, ky, fx, fy);
      r(g, kx - 1, ky - 1, 2, 2, CL);
    }
  }
  // cola: segmentos que suben por detrás y el aguijón al final
  const n = 7;
  for (let k = 0; k <= n; k++) {
    const t = k / n;
    const x = golpe ? 32 + Math.sin(t * Math.PI) * 6 : 32 + s * t * 1.5 + Math.sin(t * Math.PI) * 3;
    const y = golpe ? 42 - Math.sin(t * Math.PI * 0.9) * 28 + t * 4 : 42 - t * 32;
    ovalo(g, x, y, 5.5 - t * 1.8, 4 - t, C); r(g, x - 3 + t * 2, y + 2 - t, 6 - t * 3, 1, O);
  }
  const ax = golpe ? 32 : 32 + s * 1.5, ay = golpe ? 22 : 8, tam = golpe ? 6 : 4.2;
  ovalo(g, ax, ay, tam, tam * 0.9, CL);
  g.fillStyle = '#2a1206'; g.beginPath(); g.moveTo(ax - 1.6, ay + tam * 0.6); g.lineTo(ax + 1.6, ay + tam * 0.6); g.lineTo(ax, ay + tam * (golpe ? 2.4 : 1.9)); g.fill();
  r(g, ax, ay + tam * (golpe ? 2.4 : 1.9), 1, 2, VENENO);
  // pinzas
  const py = golpe ? -6 : p.dy;
  for (const lado of [-1, 1]) {
    const cx = 32 + lado * 21, cy = 27 + py;
    trazo(g, C, 4.5, 32 + lado * 8, 45, 32 + lado * 15, 40 + py / 2, cx, cy + 6);
    ovalo(g, cx, cy, 5.5, 6.5, C); r(g, cx - 2, cy - 2, 2, 4, CL);
    const abre = golpe ? 0.7 : 0.25;
    g.fillStyle = C;
    for (const f of [-1, 1]) {
      g.save(); g.translate(cx + f * 2, cy - 4); g.rotate(f * abre);
      g.beginPath(); g.moveTo(-2, 0); g.lineTo(2, 0); g.lineTo(f * 1, -9); g.fill(); g.restore();
    }
  }
  // cuerpo acorazado y la cabeza con sus ojos
  ovalo(g, 32, 46 + p.dy, 11, 8, C);
  for (let k = 0; k < 3; k++) { g.strokeStyle = O; g.lineWidth = 1; g.beginPath(); g.ellipse(32, 40 + k * 3 + p.dy, 10 - k, 3, 0, 0.1, Math.PI - 0.1); g.stroke(); }
  ovalo(g, 32, 51 + p.dy, 8, 4.5, CL);
  r(g, 28, 48 + p.dy, 2, 2, '#ffe14a'); r(g, 34, 48 + p.dy, 2, 2, '#ffe14a'); r(g, 31, 47 + p.dy, 2, 1, '#ffe14a');
  r(g, 29, 54 + p.dy, 2, 3, O); r(g, 33, 54 + p.dy, 2, 3, O);
  herida(g, p, 36, 44);
}

// Araña gigante: abdomen peludo con una calavera roja marcada, ocho ojos encendidos y quelíceros
// con colmillos que gotean veneno. Al atacar levanta las patas delanteras.
function arana(g, pose) {
  const C = '#2c2034', O = '#160e1c', PATA = '#3a2c48', PELO = '#6a5880', MARCA = '#c0201a', OJO = '#ff3a2a';
  if (pose >= 4 && pose <= 6) {
    caida(g, pose, () => arana(g, 3), () => {
      // patas arriba, encogidas
      for (let i = 0; i < 4; i++) for (const s of [-1, 1]) trazo(g, PATA, 1.8, 32 + s * 6, 52, 32 + s * (12 + i * 5), 46 - i * 3, 32 + s * (9 + i * 6), 38 - i * 4);
      ovalo(g, 32, 54, 15, 7, C); ovalo(g, 32, 54, 5, 3, MARCA); ovalo(g, 18, 57, 6, 4, C);
    });
    return;
  }
  const p = postura(pose), golpe = p.ataca || p.lanza;
  // abdomen con la calavera
  ovalo(g, 32, 27 + p.dy, 13, 12, C);
  for (let a = 0; a < Math.PI * 2; a += 0.35) r(g, 32 + Math.cos(a) * 13.5, 27 + p.dy + Math.sin(a) * 12.5, 1, 2, PELO);
  ovalo(g, 32, 23 + p.dy, 5, 4.6, MARCA); r(g, 29, 26 + p.dy, 6, 3, MARCA);
  ovalo(g, 30, 23 + p.dy, 1.3, 1.5, O); ovalo(g, 34, 23 + p.dy, 1.3, 1.5, O); r(g, 30, 28 + p.dy, 1, 1, O); r(g, 32, 28 + p.dy, 1, 1, O);
  // patas: largas y delante del abdomen, con la rodilla más alta que el cuerpo
  for (let i = 0; i < 4; i++) {
    const alza = ((i + (pose === 1 ? 1 : 0)) % 2 && pose !== 8) ? 3 : 0;
    for (const lado of [-1, 1]) {
      const ax = 32 + lado * 7, ay = 40 + i * 2;
      let kx = 32 + lado * (13 + i * 5), ky = 8 + i * 5 - alza, fx = 32 + lado * (20 + i * 3.8), fy = 62 - (lado > 0 ? 0 : alza / 2);
      if (golpe && i === 0) { kx = 32 + lado * 12; ky = 2; fx = 32 + lado * 7; fy = 16; }
      trazo(g, PATA, 2.8, ax, ay, kx, ky); trazo(g, PATA, 2, kx, ky, fx, fy);
      r(g, kx - 1, ky - 1, 3, 3, PELO);
      for (let k = 1; k <= 2; k++) { const x = ax + (kx - ax) * k / 3, y = ay + (ky - ay) * k / 3; r(g, x, y - 2, 1, 2, PELO); }
    }
  }
  // cabeza, ojos y colmillos
  ovalo(g, 32, 43 + p.dy, 10, 8, C);
  for (const [x, y, t] of [[29, 41, 2.2], [35, 41, 2.2], [26, 39, 1.1], [38, 39, 1.1], [30, 37.5, 1], [34, 37.5, 1], [27, 44, 1], [37, 44, 1]]) { ovalo(g, x, y + p.dy, t, t, OJO); if (t > 2) r(g, x - 1, y - 1 + p.dy, 1, 1, '#ffd0c0'); }
  const ab = golpe ? 2 : 0;
  for (const lado of [-1, 1]) {
    ovalo(g, 32 + lado * (3 + ab), 50 + p.dy, 3, 4, C);
    g.fillStyle = '#e8dcc0'; g.beginPath(); g.moveTo(32 + lado * (2 + ab), 52 + p.dy); g.lineTo(32 + lado * (4.5 + ab), 52 + p.dy); g.lineTo(32 + lado * (1 + ab / 2), 58 + p.dy + ab); g.fill();
  }
  if (golpe) { r(g, 30, 60, 1, 2, '#9aff4a'); r(g, 34, 61, 1, 2, '#9aff4a'); }
  herida(g, p, 36, 30);
}

// Serpiente gigante (cobra): enroscada en el suelo, erguida, con la capucha abierta y la lengua bífida.
// Al atacar se lanza hacia ti con la boca abierta.
function serpiente(g, pose) {
  const C = '#3f8a3a', O = '#1f4f22', VIENTRE = '#d8c060', MOTA = '#163a18';
  if (pose >= 4 && pose <= 6) {
    caida(g, pose, () => serpiente(g, 3), () => {
      // tendida: los anillos aflojados y la cabeza en el suelo
      ovalo(g, 30, 57, 22, 5, C); ovalo(g, 30, 57, 22, 5, C); r(g, 10, 56, 40, 1, O);
      trazo(g, C, 7, 46, 56, 54, 54, 58, 57); ovalo(g, 59, 57, 5, 3.4, C); r(g, 57, 56, 2, 1, '#1a1a1a');
      for (let x = 14; x < 46; x += 6) r(g, x, 53, 3, 2, MOTA);
    });
    return;
  }
  const p = postura(pose), golpe = p.ataca || p.lanza, s = p.vaiven;
  // anillos en el suelo
  ovalo(g, 32, 57, 21, 6, C); for (let x = 14; x < 52; x += 6) r(g, x, 55, 3, 2, MOTA); r(g, 12, 58, 40, 1, O);
  ovalo(g, 34, 51, 15, 5, C); for (let x = 22; x < 46; x += 6) r(g, x + 2, 49, 3, 2, MOTA);
  // cuerpo erguido en curva de S, con el vientre claro anillado
  const hy = golpe ? 19 : 13 + p.dy, hx = 32 + (golpe ? 0 : s);
  const curva = [34, 50, 29 - s, 42, 33 + s, 33, hx, hy + 10];
  trazo(g, C, 10, ...curva);
  trazo(g, VIENTRE, 4.5, ...curva);
  for (let y = 26; y < 50; y += 3) r(g, 28, y, 9, 1, '#a8902a');
  // capucha
  const cw = golpe ? 14 : 12.5;
  ovalo(g, hx, hy + 11, cw, 11, C);
  ovalo(g, hx, hy + 12, 5, 9, VIENTRE);
  for (let y = hy + 5; y < hy + 21; y += 3) r(g, hx - 4, y, 9, 1, '#a8902a');
  for (const lado of [-1, 1]) { ovalo(g, hx + lado * (cw - 4), hy + 9, 2, 3, MOTA); r(g, hx + lado * (cw - 4), hy + 8, 1, 1, VIENTRE); }
  // cabeza
  const hr = golpe ? 1.3 : 1;
  ovalo(g, hx, hy, 6.5 * hr, 5 * hr, C);
  r(g, hx - 4, hy - 4 * hr, 8, 2, O);
  r(g, hx - 4 * hr, hy - 1, 2, 2, '#ffe14a'); r(g, hx + 2 * hr, hy - 1, 2, 2, '#ffe14a');
  r(g, hx - 3 * hr, hy - 1, 1, 2, '#111'); r(g, hx + 3 * hr - 1, hy - 1, 1, 2, '#111');
  if (golpe) {
    ovalo(g, hx, hy + 5, 5, 3.4, '#5a0a10');
    g.fillStyle = '#f4ecd8';
    for (const lado of [-1, 1]) { g.beginPath(); g.moveTo(hx + lado * 4, hy + 2); g.lineTo(hx + lado * 2.5, hy + 2); g.lineTo(hx + lado * 3, hy + 7); g.fill(); }
  } else if (pose !== 1) {
    // lengua bífida
    trazo(g, '#d02020', 1, hx, hy + 4, hx, hy + 8);
    trazo(g, '#d02020', 1, hx, hy + 8, hx - 2, hy + 10); trazo(g, '#d02020', 1, hx, hy + 8, hx + 2, hy + 10);
  }
  herida(g, p, hx + 3, hy + 14);
}

// Coloso de piedra: la sorpresa más dura. Cuerpo de roca con musgo, cabeza hundida entre los hombros,
// puños enormes y runas que brillan. Al atacar junta los puños sobre la cabeza.
function coloso(g, pose) {
  const C = '#7a7468', O = '#4a463e', CL = '#a29a8a', MUSGO = '#4f7a3a', RUNA = '#ffb030';
  if (pose >= 4 && pose <= 6) {
    caida(g, pose, () => coloso(g, 3), () => {
      // un montón de rocas con las runas apagándose
      for (const [x, y, rx, ry] of [[20, 56, 10, 7], [40, 55, 12, 8], [30, 49, 9, 7], [52, 59, 7, 4], [10, 59, 6, 4]]) { ovalo(g, x, y, rx, ry, C); r(g, x - rx / 2, y - 1, rx, 1, O); }
      ovalo(g, 30, 46, 3, 2, MUSGO); r(g, 38, 53, 4, 1, '#a86a20'); r(g, 22, 55, 3, 1, '#a86a20');
    });
    return;
  }
  const p = postura(pose), golpe = p.ataca || p.lanza, { dy, subeI, subeD, vaiven } = p;
  // piernas: bloques macizos
  g.fillStyle = C; g.beginPath(); g.roundRect(18, 42 + dy, 11, 20 - subeI, 3); g.fill(); g.beginPath(); g.roundRect(35, 42 + dy, 11, 20 - subeD, 3); g.fill();
  r(g, 18, 52 - subeI, 11, 1, O); r(g, 35, 52 - subeD, 11, 1, O);
  // torso de roca
  g.fillStyle = C; g.beginPath(); g.roundRect(14, 16 + dy, 36, 30, 7); g.fill();
  r(g, 16, 30 + dy, 10, 1, O); r(g, 38, 24 + dy, 9, 1, O); r(g, 24, 40 + dy, 14, 1, O);
  // runas encendidas en el pecho
  trazo(g, RUNA, 1.5, 28, 22 + dy, 32, 26 + dy, 36, 22 + dy); trazo(g, RUNA, 1.5, 32, 26 + dy, 32, 36 + dy); trazo(g, RUNA, 1.5, 28, 32 + dy, 36, 32 + dy);
  // cabeza pequeña hundida entre los hombros
  g.fillStyle = CL; g.beginPath(); g.roundRect(25, 8 + dy, 14, 12, 3); g.fill();
  r(g, 25, 11 + dy, 14, 2, O);
  r(g, 27, 13 + dy, 3, 2, RUNA); r(g, 34, 13 + dy, 3, 2, RUNA);
  r(g, 29, 17 + dy, 6, 1, O);
  // hombros y brazos enormes
  for (const lado of [-1, 1]) {
    const hx = 32 + lado * 19, hy = 20 + dy;
    ovalo(g, hx, hy, 9, 8, CL);
    ovalo(g, hx - lado * 2, hy - 5, 4, 2.4, MUSGO); r(g, hx - lado * 3, hy - 3, 1, 4, MUSGO); r(g, hx - lado, hy - 3, 1, 3, MUSGO);
    if (golpe) {
      miembro(g, hx, hy, 32 + lado * 10, 2, 5.5, 5, C);
      ovalo(g, 32 + lado * 7, 2, 7, 6, CL); r(g, 32 + lado * 7 - 3, 1, 6, 1, O);
    } else {
      const my = 46 + dy + (lado < 0 ? vaiven : -vaiven);
      miembro(g, hx, hy + 2, hx + lado * 2, my - 6, 5.5, 5, C);
      ovalo(g, hx + lado * 2, my, 7, 6.5, CL);
      for (let k = -1; k <= 1; k++) r(g, hx + lado * 2 + k * 3 - 1, my + 2, 1, 3, O);
    }
  }
  herida(g, p, 26, 28);
}

const tipoArte = tipo => BESTIAS_ARTE[tipo] ? (g, pose) => BESTIAS_ARTE[tipo](g, pose) : (g, pose) => humanoide(g, tipo, pose);
for (const tipo of TIPOS_ENEMIGO) {
  const dibujar = tipoArte(tipo);
  for (let pose = 0; pose < 9; pose++) registrar(`${tipo}_${pose}`, sprite(g => dibujar(g, pose)));
}
// hilo de seda del que cuelga la araña cuando baja del techo
registrar('hilo', sprite(g => r(g, 31, 0, 2, 64, '#d8d4e0'), { relieve: false }));
registrar('icor', sprite(g => mancha(g, ['#7ac63a', '#4a8a1a', '#b8f070'], 11), { relieve: false }));

// Partículas de impacto y proyectiles (sin relieve: son manchas pequeñas de luz o polvo).
function mancha(g, colores, semilla, n = 14) {
  const rnd = rng(semilla);
  for (let i = 0; i < n; i++) {
    const a = rnd() * Math.PI * 2, d = rnd() * 22;
    const t = 4 + Math.floor(rnd() * 8);
    r(g, 32 + Math.cos(a) * d - t / 2, 32 + Math.sin(a) * d - t / 2, t, t, colores[i % colores.length]);
  }
}
registrar('polvo', sprite(g => mancha(g, ['#b8a888', '#8a7c62', '#d8cbb0'], 3), { relieve: false }));
registrar('sangre', sprite(g => mancha(g, ['#9a1010', '#6a0808', '#c02020'], 5), { relieve: false }));
registrar('chispa', sprite(g => mancha(g, ['#ffe14a', '#ffb627', '#fff8d0'], 7, 10), { relieve: false }));
registrar('hueso', sprite(g => mancha(g, ['#e4ddc8', '#a8a08a'], 9, 10), { relieve: false }));
for (let k = 0; k < 2; k++) registrar('fuego_' + k, sprite(g => {
  const rnd = rng(31 + k);
  g.fillStyle = '#c2410c'; g.beginPath(); g.arc(32, 32, 22, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#ff8a1a'; g.beginPath(); g.arc(32, 32, 16, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#ffe14a'; g.beginPath(); g.arc(32, 32, 9, 0, Math.PI * 2); g.fill();
  for (let i = 0; i < 10; i++) { const a = rnd() * Math.PI * 2; r(g, 32 + Math.cos(a) * 22 - 3, 32 + Math.sin(a) * 22 - 3, 6, 6, i % 2 ? '#ff8a1a' : '#c2410c'); }
}, { relieve: false }));

function gradV(g, y0, y1, colores) { const d = g.createLinearGradient(0, y0, 0, y1); colores.forEach((c, i) => d.addColorStop(i / (colores.length - 1), c)); return d; }
registrar('revolver', sprite(g => {
  // revólver de lado: cañón largo, tambor estriado, martillo, guardamonte y cachas de nogal
  g.fillStyle = gradV(g, 36, 43, ['#9aa2b2', '#3a3e48', '#16181e']); g.fillRect(8, 36, 30, 7);
  g.fillStyle = gradV(g, 43, 46, ['#3a3e48', '#16181e']); g.fillRect(10, 43, 20, 3);  // varilla
  r(g, 8, 34, 3, 2, '#5a5e68');                                                       // mira
  g.fillStyle = gradV(g, 34, 50, ['#b0b8c8', '#4a4e5a', '#1a1c22']); g.beginPath(); g.roundRect(34, 34, 14, 16, 3); g.fill();
  for (let i = 0; i < 3; i++) r(g, 36, 37 + i * 4, 10, 1, '#14161c');
  g.fillStyle = gradV(g, 32, 50, ['#7a808c', '#2a2d35']); g.fillRect(46, 33, 6, 17);
  r(g, 48, 29, 4, 5, '#3a3e48'); r(g, 49, 28, 3, 2, '#7a808c');                       // martillo
  g.strokeStyle = '#2a2d35'; g.lineWidth = 2; g.beginPath(); g.arc(44, 52, 4, 0, Math.PI); g.stroke(); // guardamonte
  r(g, 44, 50, 1, 4, '#16181e');                                                      // gatillo
  g.fillStyle = gradV(g, 46, 62, ['#a8683a', '#6a3818', '#3a1a08']);
  g.beginPath(); g.moveTo(47, 47); g.lineTo(53, 47); g.quadraticCurveTo(58, 56, 56, 62); g.lineTo(48, 62); g.quadraticCurveTo(48, 54, 47, 47); g.fill();
  g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 1; for (let k = 0; k < 4; k++) { g.beginPath(); g.moveTo(49 + k * 2, 50); g.lineTo(48 + k * 2, 60); g.stroke(); }
  r(g, 51, 54, 2, 2, '#e8c060');
}));
registrar('balas', sprite(g => {
  // caja de cartón con cartuchos de latón asomando
  for (let i = 0; i < 6; i++) {
    const x = 15 + i * 6;
    g.fillStyle = gradV(g, 26, 40, ['#f0d080', '#c8962e', '#7a5214']); g.fillRect(x, 28, 5, 12);
    g.fillStyle = gradV(g, 22, 29, ['#d8a080', '#9a5a3a', '#5a2a14']); g.beginPath(); g.ellipse(x + 2.5, 28, 2.5, 4, 0, Math.PI, 0); g.fill();
  }
  g.fillStyle = gradV(g, 38, 60, ['#a87a44', '#7a5228', '#4a3014']); g.fillRect(12, 38, 40, 22);
  g.fillStyle = gradV(g, 36, 40, ['#c89a5a', '#8a6230']); g.fillRect(12, 36, 40, 4);
  r(g, 18, 45, 28, 9, '#e8d8a8'); r(g, 20, 47, 24, 1, '#7a1a10'); r(g, 20, 50, 16, 1, '#3a2a1a'); r(g, 20, 52, 20, 1, '#3a2a1a');
}));
registrar('vendas', sprite(g => {
  // rollo de vendas con una tira suelta y una cruz roja en la etiqueta
  g.fillStyle = gradV(g, 32, 58, ['#ffffff', '#e8e0cc', '#a8a08a']); g.beginPath(); g.roundRect(16, 34, 32, 24, 10); g.fill();
  g.strokeStyle = 'rgba(120,110,90,.5)'; g.lineWidth = 1; for (let k = 0; k < 4; k++) { g.beginPath(); g.ellipse(32, 46, 13 - k * 3, 9 - k * 2, 0, 0, Math.PI * 2); g.stroke(); }
  g.fillStyle = '#f4ecd8'; g.beginPath(); g.moveTo(44, 50); g.quadraticCurveTo(56, 56, 52, 62); g.lineTo(46, 62); g.quadraticCurveTo(48, 56, 42, 54); g.fill();
  r(g, 29, 38, 6, 16, '#c02020'); r(g, 24, 43, 16, 6, '#c02020'); r(g, 30, 39, 2, 14, '#e84040');
}));
registrar('pinchos', sprite(g => {
  for (let i = 0; i < 6; i++) {
    const x = 6 + i * 10;
    g.fillStyle = '#c8ccd2'; g.beginPath(); g.moveTo(x, 64); g.lineTo(x + 4, 6 + (i % 2) * 8); g.lineTo(x + 8, 64); g.fill();
    g.fillStyle = '#7a8088'; g.fillRect(x + 4, 20 + (i % 2) * 8, 3, 44);
  }
}));
registrar('vendas', sprite(g => {
  r(g, 20, 40, 24, 20, '#efe8d8'); r(g, 20, 40, 24, 3, '#ffffff');
  r(g, 29, 44, 6, 14, '#b02020'); r(g, 25, 48, 14, 6, '#b02020');
}));

// ---------- Ambiente ----------

// Llama de antorcha de muro (3 cuadros) y brasa que sube.
for (let k = 0; k < 3; k++) registrar('llama_' + k, sprite(g => {
  const rnd = rng(71 + k);
  const capas = [['#b8320a', 1], ['#ff7a1a', 0.78], ['#ffc83a', 0.52], ['#fff4c0', 0.26]];
  for (const [color, e] of capas) {
    g.fillStyle = color;
    for (let y = 4; y < 60; y++) {
      const t = (y - 4) / 56;                      // 0 arriba, 1 abajo
      const ancho = Math.sin(Math.min(1, t * 1.15) * Math.PI * 0.62) * 22 * e;
      const ondula = Math.sin(y * 0.35 + k * 2.1) * (1 - t) * 4;
      if (t < 1 - e * 0.95) continue;
      const w = Math.max(0, ancho + (rnd() - 0.5) * 2);
      g.fillRect(32 + ondula - w / 2, y, w, 1);
    }
  }
}, { relieve: false }));
registrar('brasa', sprite(g => { r(g, 28, 28, 8, 8, '#ff9a2a'); r(g, 30, 30, 4, 4, '#fff0b0'); }, { relieve: false }));
registrar('mota', sprite(g => { r(g, 26, 26, 12, 12, '#d8cbb0'); }, { relieve: false }));

// Halos según rareza y destellos que giran alrededor de los tesoros.
for (const [rareza, color] of [['raro', '#4f90e0'], ['epico', '#b066f0'], ['legendario', '#ffc040']]) {
  for (let k = 0; k < 2; k++) registrar(`halo_${rareza}_${k}`, sprite(g => tramado(g, color, (x, y) => {
    const d = Math.hypot(x - 32, y - 32);
    return d > 30 ? 0 : (1 - d / 30) * (rareza === 'legendario' ? 0.42 : 0.3);
  }, k * 2), { relieve: false }));
}
for (let k = 0; k < 4; k++) registrar('destello_' + k, sprite(g => {
  const l = [4, 10, 16, 10][k];
  r(g, 31, 32 - l, 2, l * 2, '#fff6d8'); r(g, 32 - l, 31, l * 2, 2, '#fff6d8');
  r(g, 29, 29, 6, 6, '#ffe58a'); r(g, 31, 31, 2, 2, '#ffffff');
}, { relieve: false }));

// Decorado del suelo: huesos, cráneo, vasija, escombros, velas (2 cuadros) y telaraña.
registrar('deco_huesos', sprite(g => {
  r(g, 10, 54, 30, 4, '#d8cfb4'); r(g, 8, 52, 5, 8, '#d8cfb4'); r(g, 37, 52, 5, 8, '#d8cfb4');
  g.save(); g.translate(40, 52); g.rotate(-0.5); r(g, -2, -14, 4, 22, '#c8bea2'); r(g, -4, -16, 8, 4, '#c8bea2'); g.restore();
  r(g, 20, 58, 26, 3, '#b0a688');
}));
registrar('deco_craneo', sprite(g => {
  r(g, 20, 40, 24, 16, '#e0d8c0'); r(g, 23, 56, 18, 6, '#e0d8c0');
  r(g, 24, 46, 6, 6, '#1a120a'); r(g, 34, 46, 6, 6, '#1a120a'); r(g, 30, 53, 4, 3, '#1a120a');
  r(g, 25, 59, 2, 3, '#1a120a'); r(g, 31, 59, 2, 3, '#1a120a'); r(g, 37, 59, 2, 3, '#1a120a');
}));
registrar('deco_vasija', sprite(g => {
  r(g, 26, 22, 12, 4, '#7a4a26'); r(g, 28, 26, 8, 4, '#9a6034');
  g.fillStyle = '#a8683a'; g.beginPath(); g.ellipse(32, 44, 15, 17, 0, 0, Math.PI * 2); g.fill();
  r(g, 18, 40, 28, 3, '#5a3418'); r(g, 20, 48, 24, 2, '#5a3418'); r(g, 25, 58, 14, 4, '#7a4a26');
}));
registrar('deco_escombros', sprite(g => {
  const rnd = rng(81);
  for (let i = 0; i < 9; i++) { const w = 6 + rnd() * 10, h = 4 + rnd() * 6; r(g, 6 + rnd() * 46, 62 - h - rnd() * 6, w, h, ['#6e665a', '#8a8070', '#5a5248'][i % 3]); }
}));
for (let k = 0; k < 2; k++) registrar('deco_velas_' + k, sprite(g => {
  for (const [x, h] of [[18, 16], [28, 24], [40, 12], [47, 19]]) {
    r(g, x, 62 - h, 5, h, '#e8dcb8'); r(g, x, 62 - h, 5, 2, '#fff4d8'); r(g, x + 2, 59 - h, 1, 3, '#2a1a10');
    const f = (x + k * 3) % 2;
    r(g, x + 1 - f, 52 - h, 3, 6, '#ff9a2a'); r(g, x + 1, 54 - h + f, 2, 3, '#fff0a0');
  }
  r(g, 14, 60, 40, 3, '#d8c8a0');
}, { relieve: false }));
registrar('deco_telarana', sprite(g => {
  g.strokeStyle = '#cfcfc8'; g.lineWidth = 1;
  for (let i = 0; i <= 6; i++) { const a = i / 6 * Math.PI / 2; g.beginPath(); g.moveTo(2, 2); g.lineTo(2 + Math.cos(a) * 60, 2 + Math.sin(a) * 60); g.stroke(); }
  for (let rr = 12; rr < 60; rr += 11) { g.beginPath(); g.arc(2, 2, rr, 0, Math.PI / 2); g.stroke(); }
}, { relieve: false }));

// ---------- Hitos de las salas (js/hitos.js) ----------
// Murales: láminas con transparencia que van apenas delante de un muro, así sirven sobre cualquier piedra.
// Las pinturas están desconchadas (se ve el muro por los huecos); lo colgado o tallado lleva relieve.

// Pintura vieja: tonos que varían y huecos donde se cayó el pigmento.
function pintura(fn, semillaDesgaste, desgaste = 0.33) {
  return b => {
    sprite(fn, { relieve: false })(b);
    const r = rng(semillaDesgaste), mancha = fbm(r, 4, 3), poro = ruidoSuave(semilla(r), 64);
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
      const i = (y * T + x) * 4;
      if (!b.d[i + 3]) continue;
      const m = mancha(x, y);
      if (m < desgaste || poro(x, y) > 0.94) { b.d[i + 3] = 0; continue; }
      const f = 0.78 + m * 0.36 - (TRAMA_T[(y & 3) * 4 + (x & 3)] / 16) * 0.08;
      b.d[i] *= f; b.d[i + 1] *= f; b.d[i + 2] *= f;
    }
  };
}
// Piedra o madera tallada: el color con motas antes de darle relieve.
function moteado(g, semillaN, fuerza = 0.18) {
  const rnd = rng(semillaN), im = g.getImageData(0, 0, T, T), d = im.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 128) continue;
    const f = 1 - fuerza / 2 + rnd() * fuerza;
    d[i] *= f; d[i + 1] *= f; d[i + 2] *= f;
  }
  g.putImageData(im, 0, 0);
}
function glifo(g, forma, x0, y0, color, k = 2) {
  forma.forEach((fila, j) => [...fila].forEach((ch, i) => { if (ch === '#') r(g, x0 + i * k, y0 + j * k, k, k, color); }));
}
function mano(g, x, y, ang, c, k = 1) {
  g.save(); g.translate(x, y); g.rotate(ang); g.scale(k, k); g.fillStyle = c;
  g.beginPath(); g.ellipse(0, 3, 5, 6, 0, 0, Math.PI * 2); g.fill();
  for (const [dx, l] of [[-4, 6], [-1.5, 8], [1.5, 8], [4, 6]]) g.fillRect(dx - 1, -3 - l, 2.2, l + 2);
  g.save(); g.translate(-5, 3); g.rotate(-0.9); g.fillRect(-1, -7, 2.4, 7); g.restore();
  g.fillRect(-3, 8, 6, 5);
  g.restore();
}

// Jeroglíficos pintados a color, con contorno negro como en las tumbas. n negro, a azul, r rojo,
// v verde, o ocre, w blanco hueso.
const TINTAS = { n: '#1a120a', a: '#2f5fa8', r: '#b8342a', v: '#2f8a5a', o: '#d8a838', w: '#e8dcc0' };
const GLIFOS_COLOR = {
  ave: ['...nn...', '..nvwn..', '..nvvvn.', '.nvvvvvn', 'nvvvvvn.', '..nnnn..', '..n..n..'],
  sol: ['..nnnn..', '.nrrrrn.', 'nrrorrrn', 'nrrrrrrn', '.nrrrrn.', '..nnnn..', '.nnnnnn.'],
  cobra: ['..nn....', '.nron...', '.nrn....', '..nrn...', '...nrnnn', '..nrrrrn', '.nnnnnn.'],
  sentado: ['..nnn...', '..nwn...', '..nnn...', '.nrrrn..', '.nrrrnn.', '..nrrrn.', '.nnnnnn.'],
  agua: ['n.n.n.n.', '.a.a.a.a', '........', 'n.n.n.n.', '.a.a.a.a', '........', 'n.n.n.n.'],
  ojo: ['........', '.nnnnnn.', 'nwwnnwwn', 'nwwnnwwn', '.nnnnnn.', '...n.n..', '..n...n.'],
  anj: ['..nnn...', '.no.on..', '.no.on..', 'nnnonnn.', 'noooooon', '..non...', '..nnn...'],
  junco: ['...nvn..', '..nvvn..', '...nvn..', '...nn...', '...nn...', '...nn...', '..nnnn..'],
  pan: ['........', '........', '...nn...', '..nvvn..', '.nvvvvn.', 'nnnnnnnn', '........'],
  vasija: ['..nnnn..', '...nn...', '..naan..', '.naaaan.', '.naaaan.', '..naan..', '...nn...'],
};
function glifoColor(g, forma, x0, y0, k = 2) {
  forma.forEach((fila, j) => [...fila].forEach((ch, i) => { if (TINTAS[ch]) r(g, x0 + i * k, y0 + j * k, k, k, TINTAS[ch]); }));
}

// Friso de jeroglíficos: columnas de signos a color y un cartucho real en el centro (empalma con el de al lado).
registrar('hito_jeroglificos', pintura(g => {
  const COL = ['#2f5fa8', '#b8342a', '#d8a838', '#2f8a5a'];
  for (let x = 0; x < T; x += 4) { r(g, x, 3, 4, 5, COL[(x / 4) % 4]); r(g, x, 56, 4, 5, COL[(x / 4 + 2) % 4]); }
  r(g, 0, 2, T, 1, '#1a120a'); r(g, 0, 8, T, 1, '#1a120a'); r(g, 0, 55, T, 1, '#1a120a'); r(g, 0, 61, T, 1, '#1a120a');
  for (const x of [0, 63]) r(g, x, 10, 1, 44, '#1a120a');
  const G = GLIFOS_COLOR;
  [G.ave, G.agua, G.sentado].forEach((f, j) => glifoColor(g, f, 3, 12 + j * 14));
  [G.junco, G.pan, G.cobra].forEach((f, j) => glifoColor(g, f, 45, 12 + j * 14));
  // cartucho
  r(g, 22, 10, 20, 44, '#1a120a'); r(g, 23, 11, 18, 42, '#e8dcc0'); r(g, 22, 53, 20, 2, '#1a120a'); r(g, 20, 54, 24, 1, '#1a120a');
  for (const [x, y] of [[22, 10], [41, 10], [22, 52], [41, 52]]) r(g, x, y, 1, 1, 'rgba(0,0,0,0)');
  [G.sol, G.ojo, G.anj].forEach((f, j) => glifoColor(g, f, 24, 13 + j * 13));
}, 201, 0.2));

// Disco solar alado: plumas con contorno en tres hileras y las dos cobras que lo custodian.
registrar('hito_disco_alado', pintura(g => {
  const hileras = [['#2f5fa8', 27, 5], ['#2f8a5a', 23, 4], ['#b8342a', 18, 4]];
  for (const lado of [-1, 1]) hileras.forEach(([c, largo, alto], k) => {
    for (let p = 0; p < largo; p += 3) {
      const x = 32 + lado * (9 + p), y = 16 + k * 5 + Math.round(p * p / 110);
      const x0 = lado < 0 ? x - 3 : x;
      r(g, x0, y, 3, alto + 1, '#1a120a'); r(g, x0 + (lado < 0 ? 1 : 0), y, 2, alto, c);
      r(g, x0 + (lado < 0 ? 1 : 0), y, 2, 1, '#e8dcc0');
    }
  });
  ovalo(g, 32, 19, 9, 9, '#1a120a'); ovalo(g, 32, 19, 8, 8, '#c8301e'); ovalo(g, 30, 17, 3, 2.5, '#e8603a'); ovalo(g, 29, 16, 1, 1, '#f8c080');
  for (const s of [-1, 1]) {
    const x = 32 + s * 10;
    r(g, x - 2, 22, 4, 10, '#1a120a'); r(g, x - 1, 22, 2, 9, '#d8a838');
    ovalo(g, x, 21, 3, 2.5, '#1a120a'); ovalo(g, x, 21, 2, 1.6, '#2f8a5a'); r(g, x, 20, 1, 1, '#e8dcc0');
    r(g, x - 3, 31, 6, 2, '#1a120a');
  }
  for (let x = 4; x < 60; x += 4) { r(g, x, 43, 3, 4, ['#2f5fa8', '#d8a838', '#b8342a', '#2f8a5a'][(x / 4) % 4]); }
  r(g, 2, 42, 60, 1, '#1a120a'); r(g, 2, 47, 60, 1, '#1a120a');
  glifoColor(g, GLIFOS_COLOR.anj, 16, 49, 1); glifoColor(g, GLIFOS_COLOR.ojo, 28, 49, 1); glifoColor(g, GLIFOS_COLOR.anj, 40, 49, 1);
}, 203, 0.2));

// Ojo de Horus: ceja azul, párpado rojo, pupila y las dos marcas de halcón.
registrar('hito_ojo', pintura(g => {
  const N = '#141018';
  g.fillStyle = N; g.beginPath(); g.moveTo(11, 13); g.quadraticCurveTo(32, 4, 53, 11); g.lineTo(53, 15); g.quadraticCurveTo(32, 9, 11, 17); g.fill();
  g.fillStyle = '#2f5fa8'; g.beginPath(); g.moveTo(13, 14); g.quadraticCurveTo(32, 7, 51, 12); g.lineTo(51, 13); g.quadraticCurveTo(32, 9, 13, 15.5); g.fill();
  g.fillStyle = N; g.beginPath(); g.ellipse(32, 27, 19, 10, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#b8342a'; g.beginPath(); g.ellipse(32, 27, 17, 8.5, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#e8dcc0'; g.beginPath(); g.ellipse(32, 28, 15, 6.5, 0, 0, Math.PI * 2); g.fill();
  ovalo(g, 32, 27, 6.5, 6.5, N); ovalo(g, 32, 27, 5, 5, '#2f5fa8'); ovalo(g, 32, 27, 2.6, 2.6, N); r(g, 30, 25, 2, 2, '#e8dcc0');
  r(g, 49, 27, 12, 3, N); r(g, 58, 24, 3, 6, N);                                               // cola del ojo
  g.strokeStyle = N; g.lineWidth = 3; g.lineCap = 'round';
  g.beginPath(); g.moveTo(26, 37); g.lineTo(26, 52); g.lineTo(31, 54); g.stroke();             // lágrima
  g.beginPath(); g.moveTo(38, 37); g.quadraticCurveTo(44, 47, 49, 47); g.stroke();
  g.beginPath(); g.arc(49, 51, 4, -Math.PI / 2, Math.PI * 1.3); g.stroke();                    // espiral del halcón
  for (let x = 4; x < 60; x += 8) { r(g, x, 59, 5, 3, '#b8342a'); r(g, x + 5, 59, 3, 3, '#2f5fa8'); }
}, 205));

// Arte rupestre: una mano en negativo (pigmento soplado alrededor), un ciervo y dos cazadores.
registrar('hito_manos', pintura(g => {
  const rnd = rng(208);
  ovalo(g, 19, 23, 15, 18, '#b03a1e');
  for (let i = 0; i < 700; i++) {
    const a = rnd() * Math.PI * 2, d = 13 + rnd() * 6;
    r(g, 19 + Math.cos(a) * d, 23 + Math.sin(a) * d * 1.2, 1, 1, rnd() < 0.7 ? '#b03a1e' : '#8a2a14');
  }
  g.save(); g.globalCompositeOperation = 'destination-out'; mano(g, 19, 25, -0.2, '#000', 1.35); g.restore();
  mano(g, 47, 20, 0.3, '#c8642a', 0.85);
  const O = '#a8381e';
  // ciervo al trote
  r(g, 34, 42, 14, 5, O); r(g, 47, 38, 3, 6, O); ovalo(g, 50, 37, 3, 2, O); r(g, 52, 37, 2, 1, O);
  trazo(g, O, 1.4, 49, 35, 47, 30, 45, 29); trazo(g, O, 1.4, 48, 32, 51, 29, 53, 30); trazo(g, O, 1.4, 50, 35, 53, 31);
  trazo(g, O, 1.6, 36, 46, 33, 52); trazo(g, O, 1.6, 38, 46, 39, 52); trazo(g, O, 1.6, 45, 46, 43, 52); trazo(g, O, 1.6, 46, 46, 49, 51);
  r(g, 33, 41, 2, 2, O);
  // cazadores con lanzas
  for (const [x, s] of [[12, 0], [22, 2]]) {
    ovalo(g, x, 41 + s, 1.6, 1.6, '#3a1a10'); trazo(g, '#3a1a10', 1.4, x, 43 + s, x, 50 + s);
    trazo(g, '#3a1a10', 1.2, x, 50 + s, x - 3, 55 + s); trazo(g, '#3a1a10', 1.2, x, 50 + s, x + 3, 55 + s);
    trazo(g, '#3a1a10', 1.2, x - 3, 47 + s, x + 6, 43 + s); trazo(g, '#3a1a10', 1, x - 4, 50 + s, x + 10, 40 + s);
  }
  for (const [x, y] of [[6, 60], [10, 58], [56, 58], [60, 56]]) ovalo(g, x, y, 1.4, 1.4, O);
}, 207, 0.12));

// Petroglifos picados en la piedra: espiral, chamán con cuernos, sol y un camino de puntos.
registrar('hito_espiral', pintura(g => {
  const C = '#e0c890', C2 = '#c8a870';
  g.strokeStyle = C; g.lineWidth = 3; g.beginPath();
  for (let a = 0; a < Math.PI * 6; a += 0.1) { const rr = 2 + a * 0.95; const x = 22 + Math.cos(a) * rr, y = 24 + Math.sin(a) * rr; a ? g.lineTo(x, y) : g.moveTo(x, y); }
  g.stroke();
  // chamán
  ovalo(g, 48, 30, 3, 3, C); r(g, 46, 33, 4, 11, C); trazo(g, C, 2, 46, 36, 40, 32, 38, 28); trazo(g, C, 2, 50, 36, 56, 32, 58, 28);
  trazo(g, C, 2, 47, 44, 44, 52); trazo(g, C, 2, 49, 44, 52, 52); trazo(g, C, 1.5, 46, 28, 43, 22, 41, 22); trazo(g, C, 1.5, 50, 28, 53, 22, 55, 22);
  trazo(g, C, 1.2, 44, 24, 42, 20); trazo(g, C, 1.2, 52, 24, 54, 20);
  // sol con rayos
  g.lineWidth = 2; g.strokeStyle = C2; g.beginPath(); g.arc(50, 9, 4, 0, Math.PI * 2); g.stroke();
  for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; trazo(g, C2, 1.5, 50 + Math.cos(a) * 6, 9 + Math.sin(a) * 6, 50 + Math.cos(a) * 8.5, 9 + Math.sin(a) * 8.5); }
  for (let k = 0; k < 9; k++) ovalo(g, 8 + k * 4, 50 + Math.sin(k) * 3, 1.3, 1.3, C2);
  for (const [x, y] of [[6, 6], [10, 4], [6, 40], [60, 46]]) ovalo(g, x, y, 1.6, 1.6, C);
}, 209));

// Friso de runas talladas y pintadas de rojo dentro de una serpiente-cinta (empalma con el de al lado).
const RUNAS = [
  [[1, 0, 1, 14], [1, 0, 6, 5], [1, 5, 6, 10]],                  // ᚠ
  [[1, 0, 1, 14], [6, 0, 6, 14], [1, 0, 6, 6]],                  // ᚢ
  [[1, 0, 1, 14], [1, 2, 6, 7], [6, 7, 1, 12]],                  // ᚦ
  [[1, 0, 6, 7], [6, 7, 1, 14], [6, 0, 1, 7], [1, 7, 6, 14]],    // ᛟ
  [[3, 0, 3, 14], [0, 3, 3, 6], [6, 3, 3, 6]],                   // ᛉ
  [[1, 0, 1, 14], [1, 0, 6, 4], [6, 4, 1, 8]],                   // ᚱ
];
registrar('hito_runas', pintura(g => {
  const cinta = (y0, fase) => {
    for (let x = 0; x < T; x++) {
      const y = y0 + Math.round(Math.sin((x / T + fase) * Math.PI * 4) * 3);
      r(g, x, y - 3, 1, 7, '#1a1010'); r(g, x, y - 2, 1, 5, '#b02a1e'); if (x % 3 === 0) r(g, x, y, 1, 1, '#e0b080');
    }
  };
  cinta(9, 0); cinta(55, 0.25);
  const corte = (x0, y0, n) => {
    for (const [dx, dy, color] of [[1, 1, '#2a1a14'], [0, 0, '#c8301e']]) {
      g.strokeStyle = color; g.lineWidth = 2.6; g.lineCap = 'square';
      for (const [a, b, c, d] of RUNAS[n]) { g.beginPath(); g.moveTo(x0 + a * 1.5 + dx, y0 + b * 1.15 + dy); g.lineTo(x0 + c * 1.5 + dx, y0 + d * 1.15 + dy); g.stroke(); }
    }
  };
  [0, 3, 1, 5, 2, 4].forEach((n, k) => corte(5 + (k % 3) * 21, k < 3 ? 16 : 34, n));
  for (const x of [17, 38, 59]) for (const y of [24, 42]) ovalo(g, x, y, 1.3, 1.3, '#c8301e');
}, 211));

// Escudo redondo colgado: tablas pintadas con un remolino, borde remachado y mellado, umbo de hierro,
// una espada y un hacha cruzadas detrás.
registrar('hito_escudo', sprite(g => {
  g.save(); g.translate(32, 34);
  g.save(); g.rotate(-0.75); r(g, -1.5, -28, 3, 54, '#6a4424');
  g.fillStyle = '#9aa0a6'; g.beginPath(); g.moveTo(1, -28); g.lineTo(12, -31); g.lineTo(10, -15); g.lineTo(1, -20); g.fill(); g.restore();
  g.save(); g.rotate(0.75); r(g, -1.5, -30, 3, 44, '#b8bec6'); r(g, -5, 14, 10, 3, '#8a7a5a'); r(g, -1.5, 17, 3, 9, '#5a3418'); ovalo(g, 0, 27, 2.5, 2.5, '#d8a838'); g.restore();
  g.restore();
  ovalo(g, 32, 34, 22, 22, '#2a1a0e'); ovalo(g, 32, 34, 21, 21, '#7a7e84');
  g.save(); g.beginPath(); g.arc(32, 34, 19, 0, Math.PI * 2); g.clip();
  r(g, 10, 12, 44, 44, '#e2d6b8');
  for (let k = 0; k < 3; k++) {
    g.fillStyle = '#a82a1e'; g.beginPath(); g.moveTo(32, 34);
    for (let t = 0; t <= 1.001; t += 0.05) { const a = k * Math.PI * 2 / 3 + t * 2.2, rr = 6 + t * 15; g.lineTo(32 + Math.cos(a) * rr, 34 + Math.sin(a) * rr); }
    for (let t = 1; t >= 0; t -= 0.05) { const a = k * Math.PI * 2 / 3 + t * 2.2 + 0.7 + t * 0.2, rr = 6 + t * 15; g.lineTo(32 + Math.cos(a) * rr, 34 + Math.sin(a) * rr); }
    g.fill();
  }
  for (let x = 13; x < 52; x += 6) r(g, x, 14, 1, 40, 'rgba(40, 24, 12, 0.55)');
  g.restore();
  for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2; r(g, 32 + Math.cos(a) * 20 - 0.5, 34 + Math.sin(a) * 20 - 0.5, 2, 2, '#c8ccd0'); }
  ovalo(g, 32, 34, 7, 7, '#2a2a2e'); ovalo(g, 32, 34, 6, 6, '#5a5e64'); ovalo(g, 30.5, 32.5, 3, 3, '#9aa0a6'); r(g, 29, 31, 2, 1, '#e0e4e8');
  g.clearRect(46, 17, 4, 3); g.clearRect(48, 20, 2, 2); g.clearRect(13, 46, 3, 3);
  moteado(g, 213, 0.12);
}));

// Bandera pirata pintada: calavera con pañuelo y parche, sables cruzados y la X del tesoro.
registrar('hito_calavera', pintura(g => {
  const H = '#e8e2d0', N = '#1a120a';
  g.save(); g.translate(32, 32);
  for (const s of [-1, 1]) {
    g.save(); g.rotate(s * 0.75);
    g.fillStyle = H; g.beginPath(); g.moveTo(-1.5, -26); g.quadraticCurveTo(s * 5, -6, 1.5, 14); g.lineTo(-1.5, 14); g.closePath(); g.fill();
    r(g, -5, 14, 10, 2, '#d8a838'); r(g, -1.5, 16, 3, 7, '#8a5530'); ovalo(g, 0, 24, 2, 2, '#d8a838');
    g.restore();
  }
  g.restore();
  ovalo(g, 32, 27, 12, 11, H); r(g, 24, 33, 16, 9, H);
  g.fillStyle = '#b8241e'; g.beginPath(); g.ellipse(32, 21, 12.5, 7, 0, Math.PI, 0); g.fill(); r(g, 19, 20, 26, 3, '#b8241e');
  for (const x of [24, 30, 36]) ovalo(g, x, 17, 1.2, 1.2, H);
  poli(g, '#b8241e', 44, 20, 50, 16, 52, 24); poli(g, '#b8241e', 44, 21, 49, 27, 45, 28);    // nudo
  r(g, 21, 26, 22, 1, N); ovalo(g, 27, 29, 4, 3.5, N);                                        // parche
  ovalo(g, 37, 29, 3.2, 3.6, N); r(g, 37, 28, 1, 1, '#c8301e');
  poli(g, N, 32, 33, 30, 37, 34, 37);
  r(g, 25, 39, 14, 1, N); for (const x of [27, 30, 33, 36]) r(g, x, 39, 1, 4, N);
  // la X y la flecha raspadas debajo
  trazo(g, '#d8d0bc', 2, 46, 52, 52, 58); trazo(g, '#d8d0bc', 2, 52, 52, 46, 58);
  trazo(g, '#d8d0bc', 1.5, 8, 56, 14, 54, 20, 57, 26, 55, 32, 57, 38, 55, 42, 56);
}, 215));

// Friso de la serpiente emplumada: cuerpo con contorno, vientre amarillo, escamas y penacho
// de plumas, sobre una greca escalonada (empalma con el de al lado).
registrar('hito_serpiente', pintura(g => {
  const yDe = x => 26 + Math.round(Math.sin(x / T * Math.PI * 2) * 7);
  for (let x = 0; x < T; x++) {
    const y = yDe(x);
    if (x % 6 < 3) { r(g, x, y - 13, 1, 6, ['#2fa8a0', '#c8301e', '#d8a838'][Math.floor(x / 6) % 3]); r(g, x, y - 13, 1, 1, '#1a120a'); }
    r(g, x, y - 7, 1, 14, '#1a120a'); r(g, x, y - 6, 1, 12, '#2f7a4a'); r(g, x, y + 2, 1, 4, '#d8b838');
    if ((x + (y >> 1)) % 4 === 0) { r(g, x, y - 4, 1, 2, '#1f5a34'); r(g, x, y - 1, 1, 1, '#4fb07a'); }
    if (x % 4 === 0) r(g, x, y + 2, 1, 4, '#a88a28');
  }
  for (let x = 0; x < T; x += 16) {
    r(g, x, 47, 16, 2, '#1a120a'); r(g, x, 61, 16, 1, '#1a120a');
    r(g, x, 49, 16, 12, '#d8a838');
    r(g, x + 2, 51, 2, 8, '#b8342a'); r(g, x + 2, 51, 9, 2, '#b8342a'); r(g, x + 9, 51, 2, 5, '#b8342a'); r(g, x + 6, 54, 5, 2, '#b8342a');
    r(g, x + 6, 57, 10, 2, '#b8342a'); r(g, x + 13, 51, 2, 6, '#b8342a');
  }
}, 217));

// Piedra del sol tallada: rostro del sol con la lengua de pedernal, los cuatro movimientos,
// anillo de signos y rayos.
registrar('hito_calendario', sprite(g => {
  const P = '#8a8270', P2 = '#9a927e', L = '#5a5446';
  ovalo(g, 32, 32, 28, 28, P); ovalo(g, 32, 32, 22.5, 22.5, P2);
  g.strokeStyle = L; g.lineWidth = 1.2;
  for (const rr of [27, 22.5, 17, 11]) { g.beginPath(); g.arc(32, 32, rr, 0, Math.PI * 2); g.stroke(); }
  for (let k = 0; k < 24; k++) { const a = k / 24 * Math.PI * 2; r(g, 32 + Math.cos(a) * 24.8 - 1, 32 + Math.sin(a) * 24.8 - 1, 2, 2, L); }
  for (let k = 0; k < 20; k++) { const a = k / 20 * Math.PI * 2 + 0.15; const x = 32 + Math.cos(a) * 19.8, y = 32 + Math.sin(a) * 19.8; r(g, x - 1.5, y - 1.5, 3, 3, L); r(g, x - 0.5, y - 0.5, 1, 1, P2); }
  g.fillStyle = P;
  for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2 + Math.PI / 8; g.beginPath(); g.moveTo(32 + Math.cos(a - 0.22) * 22, 32 + Math.sin(a - 0.22) * 22); g.lineTo(32 + Math.cos(a) * 28, 32 + Math.sin(a) * 28); g.lineTo(32 + Math.cos(a + 0.22) * 22, 32 + Math.sin(a + 0.22) * 22); g.fill(); }
  for (const [x, y] of [[21, 21], [43, 21], [21, 43], [43, 43]]) { r(g, x - 3, y - 3, 6, 6, L); r(g, x - 2, y - 2, 4, 4, '#a89e86'); r(g, x - 1, y - 1, 2, 2, L); }
  ovalo(g, 32, 32, 10, 10, '#b0a68c');
  r(g, 26, 28, 4, 2, '#3a3428'); r(g, 34, 28, 4, 2, '#3a3428'); r(g, 25, 27, 6, 1, L); r(g, 33, 27, 6, 1, L);
  r(g, 31, 30, 2, 4, '#8e8670'); r(g, 28, 35, 8, 1, '#3a3428');
  poli(g, '#a8381e', 30, 36, 34, 36, 32, 42); r(g, 31, 36, 1, 2, '#c85a3a');
  ovalo(g, 22.5, 33, 1.6, 2.2, '#c8a838'); ovalo(g, 41.5, 33, 1.6, 2.2, '#c8a838');   // orejeras
  moteado(g, 219);
}));

// Máscara de mosaico de jade: teselas con juntas, ojos de concha y obsidiana, nariguera y orejeras.
registrar('hito_mascara', sprite(g => {
  g.fillStyle = '#2f8a5a'; g.beginPath(); g.moveTo(18, 13); g.lineTo(46, 13); g.lineTo(49, 34); g.lineTo(41, 53); g.lineTo(23, 53); g.lineTo(15, 34); g.closePath(); g.fill();
  const rnd = rng(222), tonos = ['#2f8a5a', '#3aa06a', '#25784c', '#4fb07a', '#2a7f55'];
  for (let y = 14; y < 53; y += 4) for (let x = 15 + ((y >> 2) % 2) * 2; x < 49; x += 4) r(g, x, y, 3, 3, tonos[Math.floor(rnd() * tonos.length)]);
  g.save(); g.globalCompositeOperation = 'destination-in';
  g.beginPath(); g.moveTo(18, 13); g.lineTo(46, 13); g.lineTo(49, 34); g.lineTo(41, 53); g.lineTo(23, 53); g.lineTo(15, 34); g.closePath(); g.fill(); g.restore();
  r(g, 18, 10, 28, 5, '#d8a838'); for (let x = 19; x < 45; x += 4) r(g, x, 11, 2, 2, '#b8342a');
  r(g, 20, 24, 11, 2, '#1a3a24'); r(g, 33, 24, 11, 2, '#1a3a24');
  r(g, 21, 26, 9, 5, '#f0ead8'); r(g, 34, 26, 9, 5, '#f0ead8'); r(g, 24, 26, 4, 5, '#141018'); r(g, 37, 26, 4, 5, '#141018');
  r(g, 25, 27, 1, 1, '#9a9aa8'); r(g, 38, 27, 1, 1, '#9a9aa8');
  r(g, 30, 28, 4, 10, '#4fb07a'); r(g, 29, 37, 6, 2, '#25784c');
  ovalo(g, 32, 41, 4, 2, '#d8a838'); ovalo(g, 32, 41, 2, 1, '#2a1a0e');                      // nariguera
  r(g, 25, 45, 14, 4, '#1a3a24'); r(g, 27, 46, 10, 2, '#f0ead8'); for (let x = 28; x < 37; x += 2) r(g, x, 46, 1, 2, '#c8c0a8');
  for (const x of [11, 53]) { ovalo(g, x, 32, 5, 5, '#b8342a'); ovalo(g, x, 32, 2.5, 2.5, '#2f8a5a'); ovalo(g, x, 32, 1, 1, '#141018'); r(g, x - 1, 37, 2, 6, '#d8a838'); }
  moteado(g, 221, 0.1);
}));

// Fresco de la abadía: cruz roja en un medallón con alfa y omega, una enredadera y un renglón en latín.
registrar('hito_cruz', pintura(g => {
  ovalo(g, 32, 26, 21, 21, '#c8a838'); ovalo(g, 32, 26, 19, 19, '#8a6a20'); ovalo(g, 32, 26, 18, 18, '#e8dcc0');
  for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2; ovalo(g, 32 + Math.cos(a) * 20, 26 + Math.sin(a) * 20, 1, 1, '#f8ecc0'); }
  g.fillStyle = '#1a120a';
  g.beginPath(); g.moveTo(29, 26); g.lineTo(23, 10); g.lineTo(41, 10); g.lineTo(35, 26); g.lineTo(41, 42); g.lineTo(23, 42); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(32, 23); g.lineTo(16, 17); g.lineTo(16, 35); g.lineTo(32, 29); g.lineTo(48, 35); g.lineTo(48, 17); g.closePath(); g.fill();
  g.fillStyle = '#a82020';
  g.beginPath(); g.moveTo(30, 26); g.lineTo(25, 11); g.lineTo(39, 11); g.lineTo(34, 26); g.lineTo(39, 41); g.lineTo(25, 41); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(32, 24); g.lineTo(17, 19); g.lineTo(17, 33); g.lineTo(32, 28); g.lineTo(47, 33); g.lineTo(47, 19); g.closePath(); g.fill();
  r(g, 31, 12, 1, 28, '#d84a3a'); r(g, 18, 25, 28, 1, '#d84a3a');
  ovalo(g, 32, 26, 2.5, 2.5, '#d8a838');
  glifo(g, ['.#.', '#.#', '###', '#.#'], 19, 38, '#2f5fa8', 1);                                 // A
  glifo(g, ['.#.', '#.#', '#.#', '##.##'.slice(0, 3)], 43, 38, '#2f5fa8', 1);                  // Ω
  for (let x = 6; x < 58; x += 1) { const y = 49 + Math.round(Math.sin(x / 3) * 1.5); r(g, x, y, 1, 1, '#2f6a3a'); if (x % 5 === 0) r(g, x, y - 2, 2, 2, '#4f8a4a'); if (x % 10 === 3) r(g, x, y + 1, 2, 2, '#a82020'); }
  const rnd = rng(225);
  for (const y of [55, 60]) for (let x = 8; x < 56;) { const w = 2 + Math.floor(rnd() * 5); r(g, x, y, Math.min(w, 56 - x), 2, '#3a1a10'); x += w + 2; }
  r(g, 6, 55, 2, 2, '#a82020');
}, 223));

// Estatuas: se ven siempre de frente, como los enemigos.
// Anubis echado sobre su arcón dorado, con las orejas en punta y el collar de oro.
registrar('estatua_chacal', sprite(g => {
  const N = '#26221e';
  r(g, 6, 40, 52, 20, '#c8a838'); r(g, 6, 40, 52, 2, '#e8c860'); r(g, 6, 58, 52, 3, '#8a6a20');
  for (const x of [10, 54]) r(g, x - 2, 42, 3, 16, '#8a6a20');
  r(g, 14, 44, 36, 12, '#2f5fa8'); for (let x = 16; x < 48; x += 4) { r(g, x, 46, 2, 2, '#c8a838'); r(g, x + 2, 50, 2, 2, '#c8a838'); }
  r(g, 14, 44, 36, 1, '#8a6a20'); r(g, 14, 55, 36, 1, '#8a6a20');
  // cuerpo echado de perfil, mirando a la izquierda
  ovalo(g, 38, 34, 15, 6, N); r(g, 22, 33, 18, 7, N);
  r(g, 10, 36, 16, 4, N); r(g, 8, 38, 6, 2, N);                                               // patas delanteras
  ovalo(g, 50, 37, 5, 3, N); trazo(g, N, 2.5, 53, 36, 57, 38, 56, 39);                            // cola
  r(g, 18, 20, 7, 15, N);                                                                        // cuello
  ovalo(g, 20, 17, 6, 5, N); poli(g, N, 16, 15, 7, 19, 7, 21, 16, 21);                            // cabeza y hocico
  poli(g, N, 19, 13, 20, 2, 23, 13); poli(g, N, 23, 13, 26, 3, 27, 14);                           // orejas
  r(g, 21, 6, 1, 6, '#5a4a3a'); r(g, 25, 7, 1, 6, '#5a4a3a');
  r(g, 15, 16, 3, 2, '#e8c040'); r(g, 16, 16, 1, 1, '#ffffff');
  r(g, 17, 24, 9, 3, '#c8a838'); r(g, 17, 27, 9, 2, '#2f5fa8');                                // collar
  r(g, 24, 32, 4, 2, '#c8a838');                                                                  // lazo
  r(g, 7, 20, 3, 1, '#5a4a3a');
}));

// Obelisco de granito rosa con columna de jeroglíficos, piramidión de oro y una grieta.
registrar('estatua_obelisco', sprite(g => {
  r(g, 14, 58, 36, 5, '#5e5850'); r(g, 18, 54, 28, 4, '#6a6458');
  g.fillStyle = '#9a8478'; g.beginPath(); g.moveTo(23, 54); g.lineTo(41, 54); g.lineTo(38, 12); g.lineTo(26, 12); g.closePath(); g.fill();
  g.fillStyle = '#e0b040'; g.beginPath(); g.moveTo(26, 12); g.lineTo(38, 12); g.lineTo(32, 2); g.closePath(); g.fill();
  g.fillStyle = '#b88a20'; g.beginPath(); g.moveTo(32, 2); g.lineTo(38, 12); g.lineTo(33, 12); g.closePath(); g.fill();
  moteado(g, 227, 0.22);
  r(g, 28, 15, 8, 37, '#8a7468');
  [GLIFOS_COLOR.ave, GLIFOS_COLOR.sol, GLIFOS_COLOR.anj, GLIFOS_COLOR.junco, GLIFOS_COLOR.ojo].forEach((f, k) => {
    f.forEach((fila, j) => [...fila].forEach((ch, i) => { if (ch !== '.') r(g, 28 + i, 16 + k * 7 + j, 1, 1, ch === 'n' ? '#4a3a34' : '#6a564c'); }));
  });
  trazo(g, '#4a3a34', 1, 39, 30, 36, 34, 37, 38, 34, 41);
}));

// Guerrero nórdico de piedra con barba trenzada, yelmo con nasal, escudo y lanza; le crece musgo.
registrar('estatua_guerrero', sprite(g => {
  const P = '#8e8a80', P2 = '#7a766c', P3 = '#a6a298';
  r(g, 14, 57, 36, 6, '#5e5a52');
  poli(g, P2, 22, 24, 42, 24, 46, 56, 18, 56);                                                    // capa
  r(g, 26, 42, 5, 15, P); r(g, 33, 42, 5, 15, P); r(g, 25, 54, 7, 3, P2); r(g, 32, 54, 7, 3, P2);
  poli(g, P, 23, 23, 41, 23, 40, 43, 24, 43); r(g, 24, 38, 16, 3, '#6a665c'); r(g, 30, 38, 4, 3, '#b8a878');   // cinturón
  ovalo(g, 32, 15, 6.5, 7, P); ovalo(g, 32, 12, 7, 5, P3); r(g, 25, 12, 14, 2, P2); r(g, 31, 11, 2, 9, P2);  // yelmo y nasal
  r(g, 28, 15, 2, 1, '#3a3630'); r(g, 34, 15, 2, 1, '#3a3630');
  poli(g, P3, 26, 18, 38, 18, 36, 26, 32, 30, 28, 26); for (const x of [29, 32, 35]) r(g, x, 20, 1, 8, P2);   // barba
  r(g, 44, 2, 3, 55, '#6e6a60'); poli(g, '#a6a298', 42.5, 7, 45.5, -3, 48.5, 7); r(g, 41, 23, 6, 5, P);
  r(g, 17, 24, 6, 14, P);
  ovalo(g, 19, 40, 10, 10, '#5e5a52'); ovalo(g, 19, 40, 9, 9, '#76726a');
  for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + 0.4; trazo(g, '#5e5a52', 1.2, 19, 40, 19 + Math.cos(a) * 9, 40 + Math.sin(a) * 9); }
  ovalo(g, 19, 40, 3, 3, '#9a968c');
  moteado(g, 229);
  const rnd = rng(230);
  for (let i = 0; i < 70; i++) { const x = 14 + rnd() * 36, y = 40 + rnd() * 22; if (g.getImageData(x | 0, y | 0, 1, 1).data[3]) r(g, x, y, 1, 1, rnd() < 0.5 ? '#4f6a34' : '#6a8a44'); }
}));

// Cabeza colosal de basalto: casco con orejeras, ceño, nariz ancha y labios gruesos, con musgo.
registrar('estatua_cabeza', sprite(g => {
  r(g, 8, 58, 48, 5, '#4e4a3e');
  g.fillStyle = '#7a7460'; g.beginPath(); g.ellipse(32, 36, 22, 23, 0, 0, Math.PI * 2); g.fill();
  r(g, 9, 13, 46, 11, '#6a6452'); for (let x = 12; x < 54; x += 6) r(g, x, 15, 3, 6, '#5a5444');   // casco
  r(g, 10, 22, 6, 28, '#6a6452'); r(g, 48, 22, 6, 28, '#6a6452'); ovalo(g, 13, 44, 3, 3, '#5a5444'); ovalo(g, 51, 44, 3, 3, '#5a5444');
  r(g, 18, 26, 12, 2, '#4a4636'); r(g, 34, 26, 12, 2, '#4a4636');                                   // ceño
  ovalo(g, 24, 31, 5.5, 3, '#8a846c'); ovalo(g, 40, 31, 5.5, 3, '#8a846c');                          // párpados
  r(g, 21, 31, 7, 2, '#2a2820'); r(g, 37, 31, 7, 2, '#2a2820');
  poli(g, '#8a846c', 29, 32, 35, 32, 39, 43, 25, 43); ovalo(g, 27, 42, 2, 1.5, '#3a3628'); ovalo(g, 37, 42, 2, 1.5, '#3a3628');
  ovalo(g, 32, 50, 10, 4, '#8a846c'); r(g, 22, 49, 20, 2, '#2a2820'); ovalo(g, 32, 52, 6, 1.5, '#6a6452');   // labios
  ovalo(g, 18, 41, 3, 4, '#827c66'); ovalo(g, 46, 41, 3, 4, '#827c66');
  moteado(g, 231, 0.24);
  const rnd = rng(232);
  for (let i = 0; i < 90; i++) { const x = 10 + rnd() * 44, y = 12 + rnd() * 14 + (rnd() < 0.3 ? 30 : 0); if (g.getImageData(x | 0, y | 0, 1, 1).data[3]) r(g, x, y, 1 + (rnd() < 0.3), 1, rnd() < 0.5 ? '#4f6a34' : '#6a8a44'); }
}));

// Tótem de madera: tres caras con su propio humor (enojado, burlón y contento) y alas a los lados.
registrar('estatua_idolo', sprite(g => {
  r(g, 18, 58, 28, 5, '#4e4a3e');
  poli(g, '#2f8a5a', 20, 24, 8, 20, 6, 28, 20, 32); poli(g, '#2f8a5a', 44, 24, 56, 20, 58, 28, 44, 32);
  poli(g, '#c8301e', 20, 26, 10, 24, 10, 27, 20, 29); poli(g, '#c8301e', 44, 26, 54, 24, 54, 27, 44, 29);
  const cara = (y, c, humor) => {
    r(g, 19, y, 26, 17, c); r(g, 19, y + 16, 26, 1, '#3a2414');
    r(g, 22, y + 3, 7, 5, '#e8dcc0'); r(g, 35, y + 3, 7, 5, '#e8dcc0');
    r(g, 24, y + 4, 3, 3, '#141018'); r(g, 37, y + 4, 3, 3, '#141018');
    r(g, 30, y + 6, 4, 4, '#5a3a20');
    if (humor === 0) { r(g, 21, y + 2, 9, 2, '#3a2414'); r(g, 34, y + 2, 9, 2, '#3a2414'); poli(g, '#3a2414', 21, y + 2, 30, y + 4, 30, y + 2); poli(g, '#3a2414', 43, y + 2, 34, y + 4, 34, y + 2);
      r(g, 24, y + 11, 16, 4, '#2a1a10'); for (let x = 25; x < 40; x += 3) { r(g, x, y + 11, 2, 2, '#e8dcc0'); r(g, x + 1, y + 13, 2, 2, '#e8dcc0'); } }
    if (humor === 1) { r(g, 25, y + 11, 14, 3, '#2a1a10'); r(g, 29, y + 12, 6, 5, '#c8301e'); r(g, 31, y + 13, 2, 3, '#e8603a'); r(g, 35, y + 4, 3, 1, c); }
    if (humor === 2) { r(g, 23, y + 11, 18, 2, '#2a1a10'); r(g, 22, y + 9, 2, 2, '#2a1a10'); r(g, 40, y + 9, 2, 2, '#2a1a10'); r(g, 26, y + 13, 12, 2, '#2a1a10'); ovalo(g, 22, y + 10, 1.5, 1, '#c8301e'); ovalo(g, 42, y + 10, 1.5, 1, '#c8301e'); }
  };
  cara(5, '#7a5a3a', 0); cara(23, '#6a4a2e', 1); cara(41, '#7a5a3a', 2);
  r(g, 16, 2, 32, 4, '#c8301e'); for (let x = 18; x < 46; x += 5) r(g, x, 0, 2, 3, '#d8a838');
  moteado(g, 233, 0.2);
}));

// Menhir con espiral y runas pintadas, líquenes y una mancha de musgo al pie.
registrar('estatua_menhir', sprite(g => {
  g.fillStyle = '#7e7a72'; g.beginPath(); g.moveTo(19, 62); g.lineTo(45, 62); g.lineTo(43, 18); g.lineTo(37, 3); g.lineTo(26, 5); g.lineTo(21, 20); g.closePath(); g.fill();
  g.fillStyle = '#6a665e'; g.beginPath(); g.moveTo(37, 3); g.lineTo(43, 18); g.lineTo(45, 62); g.lineTo(40, 62); g.lineTo(39, 20); g.closePath(); g.fill();
  moteado(g, 235);
  const rnd = rng(236);
  for (let i = 0; i < 14; i++) { const x = 22 + rnd() * 20, y = 6 + rnd() * 50; ovalo(g, x, y, 1 + rnd() * 1.5, 1 + rnd(), rnd() < 0.5 ? '#a8a070' : '#c8c090'); }
  for (let i = 0; i < 60; i++) r(g, 19 + rnd() * 26, 54 + rnd() * 8, 1, 1, rnd() < 0.5 ? '#4f6a34' : '#6a8a44');
  g.strokeStyle = '#a82a1e'; g.lineWidth = 2.5; g.beginPath();
  for (let a = 0; a < Math.PI * 4.5; a += 0.15) { const rr = 1 + a * 0.75; const x = 32 + Math.cos(a) * rr, y = 25 + Math.sin(a) * rr; a ? g.lineTo(x, y) : g.moveTo(x, y); }
  g.stroke();
  g.lineWidth = 2;
  for (const [a, b, c, d] of RUNAS[3]) { g.beginPath(); g.moveTo(25 + a * 1.4, 40 + b); g.lineTo(25 + c * 1.4, 40 + d); g.stroke(); }
  for (const [a, b, c, d] of RUNAS[0]) { g.beginPath(); g.moveTo(34 + a * 1.4, 40 + b); g.lineTo(34 + c * 1.4, 40 + d); g.stroke(); }
}));

// ---------- Tesoros ----------
// Cada forma se dibuja con pocos tonos: `c` el material, `o` sus líneas grabadas, `k` lo hondo, más
// gemas y detalles. Después `cincelar` reduce todo a esa paleta y abomba por separado cada zona
// encerrada por líneas, así lo grabado se lee en relieve y el metal brilla de verdad.

function mezcla(a, b, t) {
  const A = hexRGB(a), B = hexRGB(b);
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('');
}
function poli(g, c, ...p) { g.fillStyle = c; g.beginPath(); for (let i = 0; i < p.length; i += 2) g.lineTo(p[i], p[i + 1]); g.closePath(); g.fill(); }
function trazo(g, c, ancho, ...p) {
  g.strokeStyle = c; g.lineWidth = ancho; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath();
  for (let i = 0; i < p.length; i += 2) g.lineTo(p[i], p[i + 1]); g.stroke();
}
function aro(g, x, y, rx, ry, c, borde) { ovalo(g, x, y, rx + 1, ry + 1, borde); ovalo(g, x, y, rx, ry, c); }

const RUBI_G = '#d42a44', ZAFIRO_G = '#3370e6', ESMERALDA_G = '#2fb46a', PERLA = '#f2ecd8';
const NOGAL = '#6b3e1f', NOGAL_O = '#3a200e', CUERO_G = '#6a3a1c', PAPEL = '#e8dcb8', PAPEL_O = '#a8987a';
const LACRE = '#a82020', ESMALTE = '#1f3f8a', MARFIL_G = '#e8dcc0', NEGRO = '#140d08';

function paletaTesoro(t) {
  const [cr, cg, cb] = hexRGB(t.color);
  const rojizo = cr > cg * 1.5 && cr > cb * 1.5, azulado = cb > cr * 1.3;
  return {
    c: t.color, o: t.oscuro, k: mezcla(t.oscuro, '#000000', 0.5), m: mezcla(t.color, t.oscuro, 0.5),
    l: mezcla(t.color, '#ffffff', 0.35), b: mezcla(t.color, '#ffffff', 0.7),
    gema: rojizo ? ZAFIRO_G : RUBI_G, gema2: azulado ? ESMERALDA_G : rojizo ? ESMERALDA_G : ZAFIRO_G,
    t,
  };
}

const FORMAS = {
  // ídolo dorado sentado, cabezón, con tocado y una mueca
  idolo(g, P) {
    r(g, 19, 55, 26, 5, P.c); r(g, 19, 55, 26, 1, P.o); r(g, 21, 52, 22, 3, P.m);
    ovalo(g, 25, 49, 6, 4.5, P.c); ovalo(g, 39, 49, 6, 4.5, P.c); r(g, 31, 45, 2, 8, P.o);
    poli(g, P.c, 23, 34, 41, 34, 43, 48, 21, 48);
    aro(g, 32, 42, 4.5, 4, P.c, P.o); r(g, 32, 42, 1, 1, P.k);                         // barriga
    r(g, 19, 34, 4, 12, P.c); r(g, 41, 34, 4, 12, P.c); r(g, 23, 34, 1, 11, P.o); r(g, 40, 34, 1, 11, P.o);
    ovalo(g, 21, 47, 3, 2.2, P.c); ovalo(g, 43, 47, 3, 2.2, P.c);
    ovalo(g, 20.5, 25, 2.5, 4, P.c); ovalo(g, 43.5, 25, 2.5, 4, P.c);                // orejas
    ovalo(g, 32, 24, 10.5, 10, P.o); ovalo(g, 32, 24, 9.5, 9.2, P.c);
    poli(g, P.c, 19, 18, 45, 18, 41, 8, 32, 5, 23, 8); r(g, 20, 17, 24, 1, P.o);      // tocado
    for (const x of [24, 28, 36, 40]) r(g, x, 9, 1, 8, P.o);
    aro(g, 32, 12, 2.6, 2.6, P.gema, P.o);
    r(g, 25, 21, 6, 1, P.o); r(g, 33, 21, 6, 1, P.o);                                  // cejas
    r(g, 26, 23, 5, 3, P.k); r(g, 33, 23, 5, 3, P.k); r(g, 27, 24, 2, 1, P.gema); r(g, 35, 24, 2, 1, P.gema);
    r(g, 31, 25, 2, 4, P.m); r(g, 30, 28, 4, 1, P.o);                                  // nariz
    r(g, 27, 30, 10, 3, P.k); r(g, 26, 29, 1, 2, P.k); r(g, 37, 29, 1, 2, P.k);       // mueca
    for (let x = 28; x < 37; x += 2) r(g, x, 30, 1, 1, P.l);
  },
  // cáliz con labio, banda de gemas, nudo y pie acampanado
  caliz(g, P) {
    poli(g, P.c, 22, 59, 42, 59, 37, 52, 27, 52); r(g, 23, 56, 18, 1, P.o);
    r(g, 30, 36, 4, 17, P.c); r(g, 29, 36, 1, 17, P.o);
    aro(g, 32, 44, 4, 2.6, P.c, P.o); aro(g, 32, 38, 3, 1.6, P.c, P.o);
    poli(g, P.c, 16, 20, 48, 20, 45, 30, 38, 36, 26, 36, 19, 30);
    ovalo(g, 32, 19, 16, 4, P.c); ovalo(g, 32, 19, 13, 2.4, P.k); r(g, 22, 19, 20, 1, P.m);
    r(g, 18, 25, 28, 1, P.o); r(g, 19, 30, 26, 1, P.o);
    for (let x = 22; x < 44; x += 6) r(g, x, 27, 1, 1, P.o);
    aro(g, 25, 27.5, 1.6, 1.6, P.gema, P.o); aro(g, 32, 27.5, 2, 2, P.gema2, P.o); aro(g, 39, 27.5, 1.6, 1.6, P.gema, P.o);
    r(g, 27, 33, 10, 1, P.o);
  },
  // máscara funeraria con nemes a rayas, cobra, ojos delineados y barba trenzada
  mascara(g, P) {
    poli(g, P.c, 15, 16, 49, 16, 53, 34, 51, 54, 40, 52, 40, 32, 24, 32, 24, 52, 13, 54, 11, 34);
    for (let y = 18; y < 54; y += 4) r(g, 10, y, 44, 2, ESMALTE);
    poli(g, P.c, 18, 14, 46, 14, 40, 8, 24, 8); r(g, 18, 14, 28, 1, P.o);
    aro(g, 32, 32, 9.5, 12, P.c, P.o);
    r(g, 24, 26, 7, 1, P.k); r(g, 33, 26, 7, 1, P.k);
    r(g, 25, 28, 6, 3, PERLA); r(g, 33, 28, 6, 3, PERLA); r(g, 27, 28, 2, 3, NEGRO); r(g, 35, 28, 2, 3, NEGRO);
    r(g, 24, 28, 7, 1, P.k); r(g, 33, 28, 7, 1, P.k); r(g, 22, 29, 3, 1, P.k); r(g, 39, 29, 3, 1, P.k);
    r(g, 31, 30, 2, 6, P.m); r(g, 30, 35, 4, 1, P.o);
    r(g, 29, 38, 6, 1, P.o); r(g, 30, 39, 4, 1, P.m);
    r(g, 29, 44, 6, 12, P.o); r(g, 30, 44, 4, 11, P.c); for (let y = 46; y < 55; y += 2) r(g, 30, y, 4, 1, P.o);
    r(g, 30, 15, 4, 6, P.gema); r(g, 29, 14, 6, 2, P.gema); r(g, 31, 16, 2, 1, NEGRO);   // cobra
  },
  // gema tallada: mesa, corona y pabellón con facetas
  gema(g, P) {
    poli(g, P.c, 18, 32, 25, 24, 39, 24, 46, 32, 32, 58);
    poli(g, P.l, 27, 24, 37, 24, 35, 29, 29, 29);
    poli(g, P.m, 32, 32, 46, 32, 32, 58); poli(g, P.b, 18, 32, 25, 24, 29, 29, 25, 32);
    trazo(g, P.o, 1, 18, 32, 46, 32); trazo(g, P.o, 1, 25, 32, 32, 57, 39, 32);
    trazo(g, P.o, 1, 29, 29, 25, 32); trazo(g, P.o, 1, 35, 29, 39, 32); trazo(g, P.o, 1, 29, 29, 35, 29);
  },
  // corona con terciopelo, puntas rematadas con perlas y gemas engastadas
  corona(g, P) {
    ovalo(g, 32, 38, 14, 10, LACRE); ovalo(g, 32, 33, 6, 5, '#c83040');
    const puntas = [[16, 32], [24, 27], [32, 22], [40, 27], [48, 32]];
    for (const [x, y] of puntas) { poli(g, P.c, x - 5, 44, x + 5, 44, x, y); ovalo(g, x, y - 2, 2.4, 2.4, PERLA); }
    r(g, 15, 42, 34, 11, P.c); r(g, 15, 42, 34, 1, P.o); r(g, 15, 51, 34, 1, P.o);
    r(g, 14, 52, 36, 4, P.c); r(g, 14, 55, 36, 1, P.o);
    aro(g, 21, 47, 2.2, 2.2, P.gema2, P.o); aro(g, 32, 47, 3, 3, P.gema, P.o); aro(g, 43, 47, 2.2, 2.2, P.gema2, P.o);
    for (const x of [26, 37]) { r(g, x, 46, 1, 1, P.o); r(g, x + 1, 47, 1, 1, P.o); r(g, x, 48, 1, 1, P.o); }
    for (let x = 16; x < 50; x += 3) r(g, x, 53, 1, 1, P.o);
  },
  // pilas de monedas y una de canto con un perfil acuñado
  monedas(g, P) {
    const pila = (x, base, n) => {
      for (let i = 0; i < n; i++) { const y = base - i * 3; r(g, x - 6, y, 13, 3, P.c); r(g, x - 6, y + 2, 13, 1, P.o); }
      const y = base - n * 3 + 1; ovalo(g, x + 0.5, y, 6.5, 2.2, P.l); ovalo(g, x + 0.5, y, 3.5, 1, P.m);
    };
    pila(18, 56, 5); pila(29, 57, 8); ovalo(g, 46, 58, 6, 2, P.o); ovalo(g, 46, 57, 6, 2, P.c);
    aro(g, 43, 45, 9, 9, P.c, P.o); ovalo(g, 43, 45, 6.5, 6.5, P.o); ovalo(g, 43, 45, 5.8, 5.8, P.c);
    glifo(g, ['..##.', '.####', '.###.', '..##.', '.###.', '####.'], 40, 41, P.o, 1);
    for (let a = 0; a < 14; a++) { const t = a / 14 * Math.PI * 2; r(g, 43 + Math.cos(t) * 7.8, 45 + Math.sin(t) * 7.8, 1, 1, P.o); }
  },
  // collar de cuentas con un colgante en forma de gota
  amuleto(g, P) {
    for (let a = 0; a <= 16; a++) {
      const t = a / 16 * Math.PI, x = 32 - Math.cos(t) * 15, y = 12 + Math.sin(t) * 18;
      ovalo(g, x, y, 1.6, 1.6, a % 3 ? P.c : P.gema2);
    }
    r(g, 30, 30, 4, 4, P.c); r(g, 30, 32, 4, 1, P.o);
    poli(g, P.o, 32, 32, 42, 44, 40, 52, 32, 56, 24, 52, 22, 44);
    poli(g, P.c, 32, 34, 41, 44, 39, 51, 32, 55, 25, 51, 23, 44);
    aro(g, 32, 46, 4, 5, P.gema, P.o); r(g, 30, 44, 1, 2, '#ffffff');
    for (const x of [26, 32, 38]) { r(g, x, 55, 1, 3, P.o); ovalo(g, x + 0.5, 59, 1.4, 1.6, P.c); }
  },
  // cetro con bandas en espiral, orbe con gema y remate
  cetro(g, P) {
    r(g, 30, 26, 4, 31, P.c); r(g, 29, 26, 1, 31, P.o);
    for (let y = 28; y < 54; y += 4) { r(g, 30, y, 2, 1, P.o); r(g, 32, y + 1, 2, 1, P.o); }
    aro(g, 32, 41, 3.5, 1.8, P.c, P.o); aro(g, 32, 57, 3, 2.4, P.c, P.o);
    poli(g, P.c, 22, 12, 26, 16, 26, 22, 21, 18); poli(g, P.c, 42, 12, 38, 16, 38, 22, 43, 18);   // alas
    aro(g, 32, 19, 7, 7, P.c, P.o); r(g, 25, 19, 14, 1, P.o); r(g, 32, 12, 1, 7, P.o);
    aro(g, 32, 20, 3, 3, P.gema, P.o); r(g, 31, 19, 1, 1, '#ffffff');
    r(g, 31, 8, 2, 4, P.c); ovalo(g, 32, 7, 2, 2, PERLA);
    aro(g, 32, 26, 3, 1.4, P.c, P.o);
  },
  // calavera con pómulos, dientes, una grieta y ojos de gema que brillan
  calavera(g, P) {
    ovalo(g, 32, 29, 13, 13, P.c); poli(g, P.c, 21, 32, 43, 32, 41, 45, 23, 45);
    r(g, 25, 44, 14, 8, P.c); r(g, 25, 44, 14, 1, P.o);
    r(g, 26, 41, 12, 3, P.l); for (let x = 28; x < 38; x += 2) r(g, x, 41, 1, 3, P.o);
    r(g, 26, 47, 12, 2, P.l); for (let x = 27; x < 38; x += 2) r(g, x, 47, 1, 2, P.o);
    poli(g, P.k, 22, 30, 31, 29, 30, 36, 24, 36); poli(g, P.k, 42, 30, 33, 29, 34, 36, 40, 36);
    ovalo(g, 27, 33, 1.6, 1.6, P.gema); ovalo(g, 37, 33, 1.6, 1.6, P.gema);
    poli(g, P.k, 32, 36, 30, 40, 34, 40);
    trazo(g, P.o, 1, 36, 17, 37, 21, 40, 23, 40, 26); trazo(g, P.o, 1, 22, 37, 25, 39);
    r(g, 23, 28, 8, 1, P.o); r(g, 33, 28, 8, 1, P.o);
  },
  // ánfora con asas, cuello, banda pintada con una greca y pie en punta
  anfora(g, P) {
    trazo(g, P.c, 3, 27, 19, 20, 20, 20, 29); trazo(g, P.c, 3, 37, 19, 44, 20, 44, 29);
    r(g, 27, 15, 10, 10, P.c); r(g, 26, 26, 1, 1, P.o);
    ovalo(g, 32, 14, 7, 2.4, P.c); ovalo(g, 32, 14, 4.5, 1.2, P.k);
    ovalo(g, 32, 36, 13, 13, P.c);
    poli(g, P.c, 23, 44, 41, 44, 35, 56, 29, 56); ovalo(g, 32, 57, 3.5, 1.6, P.c);
    g.save(); g.beginPath(); g.ellipse(32, 36, 13, 13, 0, 0, Math.PI * 2); g.clip();
    r(g, 18, 31, 28, 7, P.k); r(g, 18, 29, 28, 1, P.o); r(g, 18, 40, 28, 1, P.o);
    for (let x = 19; x < 46; x += 6) { r(g, x, 33, 4, 1, P.c); r(g, x + 3, 33, 1, 3, P.c); r(g, x, 35, 4, 1, P.c); r(g, x, 34, 1, 1, P.c); }
    g.restore();
    r(g, 28, 24, 8, 1, P.o);
  },
  // daga en diagonal con canal, guarda curva, mango envuelto y pomo con gema
  daga(g, P) {
    g.save(); g.translate(32, 35); g.rotate(-0.62);
    poli(g, P.c, -3.5, 3, 3.5, 3, 2.5, -18, 0, -26, -2.5, -18);
    r(g, -0.5, -18, 1, 19, P.o);
    trazo(g, P.c, 3, -10, 1, -8, 5, 0, 5, 8, 5, 10, 1);
    aro(g, 0, 5, 1.8, 1.8, P.gema, P.o);
    r(g, -2, 8, 4, 10, CUERO_G); for (let y = 9; y < 18; y += 2) r(g, -2, y, 4, 1, NOGAL_O);
    aro(g, 0, 20, 3, 3, P.c, P.o); r(g, -1, 19, 2, 2, P.gema2);
    g.restore();
  },
  // brújula con tapa abierta grabada y rosa de los vientos
  brujula(g, P) {
    aro(g, 32, 17, 13, 6, P.c, P.o); ovalo(g, 32, 17, 10, 4, P.m);
    poli(g, P.o, 32, 14, 33, 17, 32, 20, 31, 17); poli(g, P.o, 28, 17, 32, 16, 36, 17, 32, 18);
    r(g, 29, 22, 6, 4, P.c); r(g, 31, 23, 2, 2, P.o);
    aro(g, 32, 42, 15, 15, P.c, P.o); ovalo(g, 32, 42, 12, 12, P.o); ovalo(g, 32, 42, 11, 11, '#efe6cc');
    for (let a = 0; a < 16; a++) { const t = a / 16 * Math.PI * 2; r(g, 32 + Math.cos(t) * 9.5, 42 + Math.sin(t) * 9.5, 1, 1, a % 4 ? '#b8a880' : NEGRO); }
    poli(g, '#8a7a5a', 23, 42, 32, 40, 41, 42, 32, 44);
    poli(g, LACRE, 32, 32, 34.5, 42, 29.5, 42); poli(g, NEGRO, 32, 52, 34.5, 42, 29.5, 42);
    ovalo(g, 32, 42, 1.5, 1.5, P.c);
  },
  // catalejo de tres tramos, con funda de cuero y lente que brilla
  catalejo(g, P) {
    g.save(); g.translate(32, 38); g.rotate(-0.45);
    r(g, -26, -3, 11, 6, P.c); r(g, -27, -3.5, 2, 7, P.o);
    r(g, -15, -4.5, 12, 9, P.c); r(g, -16, -5, 2, 10, P.o);
    r(g, -3, -6, 15, 12, CUERO_G); for (let x = 0; x < 12; x += 3) r(g, x, -6, 1, 12, NOGAL_O);
    r(g, -4, -6.5, 2, 13, P.o); r(g, 12, -7, 6, 14, P.c); r(g, 12, -7, 1, 14, P.o);
    r(g, 18, -5.5, 2, 11, '#9ad4ff'); r(g, 18, -5, 1, 3, '#ffffff');
    g.restore();
  },
  // cofre abierto que rebosa de monedas, gemas y un collar de perlas
  cofre(g, P) {
    poli(g, '#4a2a12', 14, 36, 50, 36, 47, 18, 17, 18); r(g, 17, 18, 30, 3, P.c);
    r(g, 20, 21, 2, 15, NOGAL_O); r(g, 42, 21, 2, 15, NOGAL_O);
    ovalo(g, 32, 36, 17, 7, P.c);
    for (const [x, y] of [[22, 33], [28, 31], [35, 30], [41, 33], [26, 36], [38, 35], [32, 34]]) ovalo(g, x, y, 2.5, 1.2, P.o);
    aro(g, 24, 31, 2, 2, P.gema, P.o); aro(g, 40, 30, 2.2, 2.2, P.gema2, P.o); aro(g, 32, 29, 1.6, 1.6, ESMERALDA_G, P.o);
    r(g, 13, 37, 38, 21, NOGAL); r(g, 13, 44, 38, 1, NOGAL_O); r(g, 13, 51, 38, 1, NOGAL_O);
    r(g, 13, 37, 38, 3, P.c); r(g, 13, 39, 38, 1, P.o);
    r(g, 17, 40, 4, 18, P.c); r(g, 43, 40, 4, 18, P.c); r(g, 21, 40, 1, 18, P.o); r(g, 47, 40, 1, 18, P.o);
    for (const y of [43, 49, 55]) { r(g, 18, y, 1, 1, P.k); r(g, 44, y, 1, 1, P.k); }
    r(g, 28, 40, 8, 9, P.c); r(g, 28, 48, 8, 1, P.o); r(g, 31, 42, 2, 2, P.k); r(g, 31.5, 44, 1, 3, P.k);
    for (let i = 0; i < 9; i++) ovalo(g, 22 + i * 1.6, 38 + Math.sin(i / 8 * Math.PI) * 5, 1, 1, PERLA);
    ovalo(g, 54, 57, 3, 1.4, P.c); ovalo(g, 9, 58, 2.5, 1.2, P.c);
  },
  // cuerno para beber con boca y punta de metal y bandas grabadas
  cuerno(g, P) {
    const metal = P.t.color === '#c27a3a' ? '#e8b83a' : '#c27a3a';
    const pt = s => { const u = 1 - s; return [u * u * 47 + 2 * u * s * 18 + s * s * 14, u * u * 24 + 2 * u * s * 18 + s * s * 50]; };
    for (let i = 0; i <= 60; i++) { const s = i / 60, [x, y] = pt(s), rr = 7.5 - s * 6; ovalo(g, x, y, rr, rr, i % 12 === 6 && s < 0.8 ? P.o : P.c); }
    for (const [s, ancho] of [[0, 2], [0.4, 1]]) for (let i = 0; i <= ancho * 3; i++) { const [x, y] = pt(s + i * 0.01), rr = 7.7 - (s + i * 0.01) * 6; ovalo(g, x, y, rr, rr, metal); }
    for (let i = 0; i <= 5; i++) { const s = 0.92 + i * 0.016, [x, y] = pt(s); ovalo(g, x, y, 2.4 - i * 0.2, 2.4 - i * 0.2, metal); }
    ovalo(g, 48, 24, 3.2, 7, mezcla(metal, '#000000', 0.5)); ovalo(g, 48.5, 24, 1.8, 5.2, NEGRO);
    trazo(g, CUERO_G, 1.5, 44, 32, 36, 40, 26, 44);
  },
  // hacha barbuda con runas en la hoja y mango envuelto
  hacha(g, P) {
    r(g, 30, 12, 4, 46, NOGAL); r(g, 30, 12, 1, 46, NOGAL_O);
    r(g, 30, 44, 4, 12, CUERO_G); for (let y = 45; y < 56; y += 2) r(g, 30, y, 4, 1, NOGAL_O);
    aro(g, 32, 59, 2.6, 2, P.c, P.o);
    poli(g, P.c, 34, 17, 42, 14, 50, 9, 53, 22, 50, 35, 44, 42, 41, 30, 34, 27);
    poli(g, P.c, 30, 18, 23, 20, 22, 24, 30, 25);
    r(g, 29, 15, 6, 13, P.c); r(g, 29, 18, 6, 1, P.o); r(g, 29, 24, 6, 1, P.o);
    trazo(g, P.o, 1, 51, 11, 54, 22, 51, 35, 45, 41);
    glifo(g, ['#..', '###', '#.#', '#..', '#..'], 41, 18, P.o, 1); glifo(g, ['.#.', '#.#', '.#.', '#.#'], 45, 25, P.o, 1);
  },
  // disco solar con cara sonriente y rayos largos y cortos
  disco(g, P) {
    for (let k = 0; k < 16; k++) {
      const a = k / 16 * Math.PI * 2, l = k % 2 ? 19 : 23, s = 0.16;
      poli(g, P.c, 32 + Math.cos(a - s) * 13, 38 + Math.sin(a - s) * 13, 32 + Math.cos(a) * l, 38 + Math.sin(a) * l, 32 + Math.cos(a + s) * 13, 38 + Math.sin(a + s) * 13);
    }
    aro(g, 32, 38, 14, 14, P.c, P.o); aro(g, 32, 38, 10, 10, P.c, P.o);
    for (let k = 0; k < 20; k++) { const a = k / 20 * Math.PI * 2; r(g, 32 + Math.cos(a) * 12.5, 38 + Math.sin(a) * 12.5, 1, 1, P.o); }
    r(g, 26, 33, 5, 1, P.o); r(g, 33, 33, 5, 1, P.o);
    r(g, 27, 35, 3, 2, P.k); r(g, 34, 35, 3, 2, P.k); r(g, 28, 35, 1, 1, P.b); r(g, 35, 35, 1, 1, P.b);
    r(g, 31, 36, 2, 5, P.m); r(g, 30, 40, 4, 1, P.o);
    r(g, 27, 43, 10, 1, P.k); r(g, 26, 42, 1, 1, P.k); r(g, 37, 42, 1, 1, P.k); r(g, 29, 44, 6, 1, P.k);
    ovalo(g, 25.5, 40, 1.4, 1, P.gema); ovalo(g, 38.5, 40, 1.4, 1, P.gema);
  },
  // piedra en bruto: el ámbar guarda un mosquito; las demás, facetas
  piedra(g, P) {
    poli(g, P.c, 21, 41, 25, 31, 34, 26, 42, 30, 46, 41, 41, 54, 29, 57, 20, 50);
    if (P.t.color === '#f0a830') {
      ovalo(g, 30, 34, 5, 3, P.l);
      ovalo(g, 26, 39, 5, 3, '#ffe0a0'); ovalo(g, 40, 39, 5, 3, '#ffe0a0');                  // alas
      trazo(g, '#4a2a10', 2, 27, 44, 38, 44); ovalo(g, 25.5, 44, 2.2, 2, '#4a2a10');
      trazo(g, '#4a2a10', 1, 24, 44, 19, 47);                                               // aguijón
      for (const x of [29, 33, 37]) { trazo(g, '#4a2a10', 1, x, 45, x - 2, 51); trazo(g, '#4a2a10', 1, x, 44, x + 1, 38); }
    } else {
      poli(g, P.l, 25, 31, 34, 26, 33, 38);
      poli(g, P.m, 46, 41, 41, 54, 33, 38);
      trazo(g, P.o, 1, 25, 31, 33, 38, 42, 30); trazo(g, P.o, 1, 33, 38, 46, 41); trazo(g, P.o, 1, 33, 38, 29, 56); trazo(g, P.o, 1, 21, 41, 33, 38);
    }
  },
  // libro grueso con cantoneras, broche, medallón y cinta
  libro(g, P) {
    r(g, 18, 25, 30, 32, PAPEL); for (let y = 27; y < 56; y += 2) r(g, 45, y, 3, 1, PAPEL_O);
    r(g, 14, 23, 32, 34, P.c); r(g, 14, 23, 5, 34, P.m); r(g, 19, 23, 1, 34, P.o);
    for (const y of [28, 40, 52]) r(g, 14, y, 5, 2, P.o);
    r(g, 22, 27, 21, 1, P.o); r(g, 22, 53, 21, 1, P.o); r(g, 22, 27, 1, 27, P.o); r(g, 42, 27, 1, 27, P.o);
    const oro = '#d8a838';
    for (const [x, y, sx, sy] of [[46, 23, -1, 1], [46, 57, -1, -1]]) poli(g, oro, x, y, x + sx * 7, y, x, y + sy * 7);
    aro(g, 32, 40, 6, 7, oro, '#7a5a10'); aro(g, 32, 40, 2.6, 3.2, P.gema, '#7a5a10');
    r(g, 44, 37, 6, 6, oro); r(g, 49, 38, 1, 4, '#7a5a10');
    poli(g, LACRE, 26, 56, 29, 56, 29, 62, 27.5, 60, 26, 62);
  },
  // escudo con borde remachado; el legendario lleva campo rojo y cruz del metal
  escudo(g, P) {
    const campo = P.t.rareza === 'legendario' ? LACRE : '#e8e2d0', cruz = P.t.rareza === 'legendario' ? P.c : LACRE;
    poli(g, P.c, 15, 17, 49, 17, 48, 38, 32, 59, 16, 38);
    poli(g, P.o, 19, 21, 45, 21, 44, 37, 32, 54, 20, 37);
    poli(g, campo, 20, 22, 44, 22, 43, 37, 32, 53, 21, 37);
    r(g, 29, 22, 6, 30, cruz); r(g, 21, 30, 22, 6, cruz);
    for (const [x, y] of [[18, 19], [32, 19], [46, 19], [17, 30], [47, 30], [19, 41], [45, 41], [25, 49], [39, 49]]) r(g, x, y, 1, 1, P.k);
    g.clearRect(42, 17, 3, 2); g.clearRect(43, 19, 1, 1);
  },
  // anj con aro grabado, brazos y tallo acampanados y una gema en el cruce
  ankh(g, P) {
    trazo(g, P.c, 6, 32, 32, 24, 26, 24, 16, 32, 10, 40, 16, 40, 26, 32, 32);
    trazo(g, P.o, 1, 32, 30, 26, 25, 26, 17, 32, 12, 38, 17, 38, 25, 32, 30);
    poli(g, P.c, 14, 31, 50, 31, 50, 39, 14, 39); poli(g, P.c, 12, 29, 15, 32, 15, 38, 12, 41); poli(g, P.c, 52, 29, 49, 32, 49, 38, 52, 41);
    poli(g, P.c, 28, 38, 36, 38, 39, 58, 25, 58); r(g, 24, 57, 16, 3, P.c);
    r(g, 16, 35, 32, 1, P.o); r(g, 32, 40, 1, 16, P.o);
    for (let y = 43; y < 56; y += 4) { r(g, 30, y, 1, 2, P.o); r(g, 34, y + 1, 1, 2, P.o); }
    aro(g, 32, 35, 3, 3, P.gema, P.o); r(g, 31, 34, 1, 1, '#ffffff');
  },
  // anillo visto en perspectiva con una gema grande en garras
  anillo(g, P) {
    ovalo(g, 32, 46, 17, 11, P.o); ovalo(g, 32, 46, 16, 10, P.c);
    g.save(); g.globalCompositeOperation = 'destination-out'; ovalo(g, 32, 47, 11, 6, '#000'); g.restore();
    ovalo(g, 32, 43, 11, 3, P.k); g.save(); g.globalCompositeOperation = 'destination-out'; ovalo(g, 32, 47.5, 11, 5.5, '#000'); g.restore();
    for (let a = 0; a < 7; a++) { const t = 0.3 + a / 6 * (Math.PI - 0.6); r(g, 32 + Math.cos(t) * 13.5, 46 + Math.sin(t) * 8.5, 1, 1, P.o); }
    poli(g, P.c, 25, 38, 39, 38, 36, 32, 28, 32);
    r(g, 24, 25, 2, 9, P.c); r(g, 38, 25, 2, 9, P.c); r(g, 31, 22, 2, 4, P.c);
    poli(g, P.gema, 25, 28, 29, 24, 35, 24, 39, 28, 32, 35);
    poli(g, mezcla(P.gema, '#ffffff', 0.5), 29, 24, 35, 24, 33, 27, 31, 27);
    trazo(g, mezcla(P.gema, '#000000', 0.45), 1, 25, 28, 39, 28); trazo(g, mezcla(P.gema, '#000000', 0.45), 1, 29, 28, 32, 34, 35, 28);
  },
  // cruz patada con borde grabado y gemas
  cruz(g, P) {
    const brazo = (...p) => poli(g, P.c, ...p);
    brazo(26, 9, 38, 9, 35, 28, 29, 28); brazo(29, 36, 35, 36, 39, 59, 25, 59);
    brazo(13, 26, 13, 38, 29, 35, 29, 29); brazo(51, 26, 51, 38, 35, 35, 35, 29); r(g, 28, 27, 8, 10, P.c);
    trazo(g, P.o, 1, 28, 12, 36, 12, 34, 27); trazo(g, P.o, 1, 28, 12, 30, 27);
    trazo(g, P.o, 1, 30, 38, 27, 56, 37, 56, 34, 38);
    trazo(g, P.o, 1, 16, 28, 16, 36, 28, 34); trazo(g, P.o, 1, 48, 28, 48, 36, 36, 34);
    aro(g, 32, 32, 3, 3, P.gema, P.o); r(g, 31, 31, 1, 1, '#ffffff');
    if (P.t.rareza !== 'comun') for (const [x, y] of [[32, 15], [32, 52], [19, 32], [45, 32]]) aro(g, x, y, 1.6, 1.6, P.gema2, P.o);
  },
  // escarabajo sagrado con alas de esmalte, empujando un sol
  escarabajo(g, P) {
    for (const s of [-1, 1]) {
      poli(g, ESMALTE, 32 + s * 9, 36, 32 + s * 26, 34, 32 + s * 28, 44, 32 + s * 20, 50, 32 + s * 9, 48);
      for (let k = 0; k < 4; k++) trazo(g, '#0f2048', 1, 32 + s * 11, 38 + k * 3, 32 + s * (26 - k * 2), 36 + k * 4);
      r(g, 32 + s * 8 - (s < 0 ? 2 : 0), 51, 2, 6, P.c); trazo(g, P.c, 2, 32 + s * 8, 56, 32 + s * 12, 59);
      trazo(g, P.c, 2, 32 + s * 5, 24, 32 + s * 7, 18, 32 + s * 5, 14);
    }
    aro(g, 32, 10, 5, 5, RUBI_G, P.o);
    poli(g, P.c, 26, 25, 38, 25, 36, 19, 28, 19); for (const x of [28, 31, 34]) r(g, x, 19, 2, 1, P.o);
    aro(g, 32, 29, 9, 4.5, P.c, P.o);
    aro(g, 32, 43, 10, 10, P.c, P.o); r(g, 32, 34, 1, 19, P.o);
    r(g, 26, 38, 1, 1, P.k); r(g, 38, 38, 1, 1, P.k);
  },
};

// Reduce el dibujo a su paleta y abomba cada zona por separado: luz arriba a la izquierda,
// rampa de tonos con trama ordenada y contorno del tono más oscuro. Las `lineas` se quedan planas.
function cincelar(d, paleta, lineas, contorno, rampaDe) {
  const cols = paleta.map(hexRGB), N = T * T, idx = new Int16Array(N).fill(-1);
  for (let i = 0; i < N; i++) {
    if (!d[i * 4 + 3]) continue;
    let mejor = 0, md = 1e9;
    cols.forEach((c, j) => { const e = (c[0] - d[i * 4]) ** 2 + (c[1] - d[i * 4 + 1]) ** 2 + (c[2] - d[i * 4 + 2]) ** 2; if (e < md) { md = e; mejor = j; } });
    idx[i] = mejor;
  }
  const plano = j => lineas.includes(paleta[j]);
  // los píxeles sueltos que dejó el suavizado del lienzo se suman a la zona vecina más grande
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const i = y * T + x, j = idx[i];
    if (j < 0 || plano(j)) continue;
    const vec = [x > 0 ? idx[i - 1] : -1, x < T - 1 ? idx[i + 1] : -1, y > 0 ? idx[i - T] : -1, y < T - 1 ? idx[i + T] : -1];
    if (vec.includes(j)) continue;
    const cuenta = {};
    for (const v of vec) if (v >= 0 && !plano(v)) cuenta[v] = (cuenta[v] || 0) + 1;
    const mas = Object.entries(cuenta).sort((a, b) => b[1] - a[1])[0];
    if (mas) idx[i] = +mas[0];
  }
  const MAX = 15, dist = new Float32Array(N);
  for (let i = 0; i < N; i++) dist[i] = idx[i] >= 0 && !plano(idx[i]) ? MAX : 0;
  const igual = (i, x, y) => x >= 0 && y >= 0 && x < T && y < T && idx[y * T + x] === idx[i];
  const at = (i, x, y) => igual(i, x, y) ? dist[y * T + x] : 0;
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const i = y * T + x; if (!dist[i]) continue;
    dist[i] = Math.min(dist[i], at(i, x - 1, y) + 3, at(i, x, y - 1) + 3, at(i, x - 1, y - 1) + 4, at(i, x + 1, y - 1) + 4);
  }
  for (let y = T - 1; y >= 0; y--) for (let x = T - 1; x >= 0; x--) {
    const i = y * T + x; if (!dist[i]) continue;
    dist[i] = Math.min(dist[i], at(i, x + 1, y) + 3, at(i, x, y + 1) + 3, at(i, x + 1, y + 1) + 4, at(i, x - 1, y + 1) + 4);
  }
  const rampas = paleta.map(rampaDe);
  const luz = new Float32Array(N);
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const i = y * T + x, k = i * 4;
    if (idx[i] < 0) continue;
    let c = cols[idx[i]];
    if (dist[i]) {
      const h = (xx, yy) => { const v = at(i, xx, yy) / MAX; return Math.sqrt(Math.max(0, v * (2 - v))); };
      const nx = (h(x - 1, y) - h(x + 1, y)) * 2, ny = (h(x, y - 1) - h(x, y + 1)) * 2, nl = Math.hypot(nx, ny, 1);
      const lam = (nx * LUZ[0] + ny * LUZ[1] + LUZ[2]) / nl;
      const rampa = rampas[idx[i]], centro = rampa.centro;
      const v = centro + (lam - LUZ[2]) * 5 + (0.4 - y / T) * 0.6 + ((TRAMA[(y % 4) * 4 + (x % 4)] + 0.5) / 16 - 0.5) * 0.45;
      const j = Math.max(0, Math.min(rampa.tonos.length - 1, Math.round(v)));
      c = rampa.tonos[j]; luz[i] = j - centro + (dist[i] >= 6 ? 0.5 : 0);
    }
    d[k] = c[0]; d[k + 1] = c[1]; d[k + 2] = c[2];
  }
  const borde = hexRGB(contorno);
  const fuera = [];
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const i = y * T + x;
    if (idx[i] >= 0) continue;
    if ((x > 0 && idx[i - 1] >= 0) || (x < T - 1 && idx[i + 1] >= 0) || (y > 0 && idx[i - T] >= 0) || (y < T - 1 && idx[i + T] >= 0)) fuera.push(i);
  }
  for (const i of fuera) { d[i * 4] = borde[0]; d[i * 4 + 1] = borde[1]; d[i * 4 + 2] = borde[2]; d[i * 4 + 3] = 255; }
  return luz;
}
function rampaGeneral(c) {
  const t = [mezcla(c, '#000000', 0.55), mezcla(c, '#000000', 0.3), c, mezcla(c, '#ffffff', 0.35), mezcla(c, '#ffffff', 0.7)];
  return { tonos: t.map(hexRGB), centro: 2 };
}

// Destellos: una estrella blanca en el punto más iluminado (dos en los legendarios) y, en épicos y
// legendarios, chispitas del color de la rareza alrededor.
function destellos(d, luz, t, colorRareza) {
  const n = { comun: 0, raro: 1, epico: 1, legendario: 2 }[t.rareza] ?? 0;
  const puntos = [];
  for (let k = 0; k < n; k++) {
    let mejor = -1, mv = -1e9;
    for (let y = 2; y < T - 2; y++) for (let x = 2; x < T - 2; x++) {
      const i = y * T + x; if (luz[i] < 2) continue;
      const lejos = puntos.reduce((m, [px, py]) => Math.min(m, Math.hypot(px - x, py - y)), 99);
      if (lejos < 14) continue;
      const v = luz[i] - (x + y) * 0.01 + (k ? lejos * 0.05 : 0);
      if (v > mv) { mv = v; mejor = i; }
    }
    if (mejor >= 0) puntos.push([mejor % T, Math.floor(mejor / T)]);
  }
  const pon = (x, y, c) => { if (x < 0 || y < 0 || x >= T || y >= T) return; const i = (y * T + x) * 4; d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255; };
  const blanco = [255, 255, 255], suave = [255, 246, 214];
  for (const [x, y] of puntos) {
    pon(x, y, blanco);
    for (let l = 1; l <= 3; l++) { const c = l === 1 ? blanco : suave; pon(x - l, y, c); pon(x + l, y, c); pon(x, y - l, c); pon(x, y + l, c); }
  }
  if (t.rareza === 'epico' || t.rareza === 'legendario') {
    const c = hexRGB(mezcla(colorRareza, '#ffffff', 0.35)), rnd = rng([...t.id].reduce((s, ch) => s * 31 + ch.charCodeAt(0), 7));
    const vacio = (x, y) => x > 1 && y > 1 && x < T - 2 && y < T - 2 && !d[(y * T + x) * 4 + 3];
    let puestos = 0;
    for (let intento = 0; intento < 400 && puestos < (t.rareza === 'legendario' ? 5 : 3); intento++) {
      const x = 6 + Math.floor(rnd() * 52), y = 6 + Math.floor(rnd() * 50);
      let cerca = false;
      for (let dy = -4; dy <= 4 && !cerca; dy++) for (let dx = -4; dx <= 4; dx++) if (!vacio(x + dx, y + dy)) { cerca = true; break; }
      if (cerca) continue;
      let junto = false;
      for (let dy = -8; dy <= 8 && !junto; dy++) for (let dx = -8; dx <= 8; dx++) if (x + dx >= 0 && y + dy >= 0 && x + dx < T && y + dy < T && d[((y + dy) * T + x + dx) * 4 + 3]) { junto = true; break; }
      if (!junto) continue;
      pon(x, y, c); if (puestos % 2 === 0) { pon(x - 1, y, c); pon(x + 1, y, c); pon(x, y - 1, c); pon(x, y + 1, c); }
      puestos++;
    }
  }
}

const COLOR_RAREZA = { raro: '#5fa8ff', epico: '#c77dff', legendario: '#ffb627' };
export function registrarTesoros(catalogo) {
  for (const t of catalogo) {
    if (casillas['tesoro_' + t.id]) continue;
    registrar('tesoro_' + t.id, b => {
      const c = document.createElement('canvas');
      c.width = c.height = T;
      const g = c.getContext('2d');
      const P = paletaTesoro(t);
      FORMAS[t.forma](g, P);
      const d = g.getImageData(0, 0, T, T).data;
      for (let i = 3; i < d.length; i += 4) d[i] = d[i] < 128 ? 0 : 255;
      const paleta = [...new Set([P.c, P.o, P.k, P.m, P.l, P.b, P.gema, P.gema2, RUBI_G, ZAFIRO_G, ESMERALDA_G, PERLA, NOGAL, NOGAL_O,
        CUERO_G, PAPEL, PAPEL_O, LACRE, ESMALTE, NEGRO, '#ffffff', '#efe6cc', '#b8a880', '#8a7a5a', '#4a2a12', '#9ad4ff', '#d8a838', '#7a5a10',
        '#c83040', '#e8e2d0', '#ffe0a0', '#0f2048', '#4a2a10', '#6a4a20', '#e8b83a', '#c27a3a', mezcla('#e8b83a', '#000000', 0.5), mezcla('#c27a3a', '#000000', 0.5),
        mezcla(P.gema, '#ffffff', 0.5), mezcla(P.gema, '#000000', 0.45)])];
      const material = { tonos: [P.k, P.o, P.m, P.c, P.l, P.b].map(hexRGB), centro: 3 };
      const lineas = [P.o, P.k, NEGRO, NOGAL_O, '#4a2a10', '#0f2048', '#7a5a10', PAPEL_O, mezcla(P.gema, '#000000', 0.45), '#ffffff'];
      const luz = cincelar(d, paleta, lineas, mezcla(t.oscuro, '#000000', 0.6), col => col === P.c ? material : rampaGeneral(col));
      destellos(d, luz, t, COLOR_RAREZA[t.rareza] || '#ffffff');
      b.d.set(d);
    });
  }
}

// ---------- Atlas ----------

export const casillasUsadas = () => dibujos.length;

export function crearAtlas() {
  if (dibujos.length > COLS * FILAS) throw new Error(`El atlas no alcanza: ${dibujos.length} dibujos`);
  const c = document.createElement('canvas');
  c.width = COLS * T; c.height = FILAS * T;
  const g = c.getContext('2d');
  dibujos.forEach((dibujar, i) => {
    const b = lienzo();
    dibujar(b);
    g.drawImage(aCanvas(b), (i % COLS) * T, Math.floor(i / COLS) * T);
  });
  return c;
}

// Miniatura de un tesoro para el menú de colección.
export function miniatura(atlas, nombre, escala = 2) {
  const [cx, cy] = casilla(nombre);
  const c = document.createElement('canvas');
  c.width = c.height = T * escala;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.drawImage(atlas, cx * T, cy * T, T, T, 0, 0, T * escala, T * escala);
  return c;
}
