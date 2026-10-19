// Texturas y sprites pixel art generados por código (sin archivos de imagen).
// Todo va a un atlas de COLS x FILAS casillas de T x T píxeles.

export const T = 64;
export const COLS = 16;
export const FILAS = 20;

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
    if (opciones.pulir) pulir(d, opciones.pulir);
    else if (opciones.relieve !== false) relieve(d);
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

// Acabado de los tesoros: volumen según la distancia al borde, luz arriba a la izquierda,
// una veta de brillo diagonal (dos en los legendarios) y un contorno del tono oscuro del metal.
function hexRGB(c) { const n = parseInt(c.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
function pulir(d, { oscuro, rareza }) {
  const a = (x, y) => x >= 0 && y >= 0 && x < T && y < T && d[(y * T + x) * 4 + 3] > 0;
  const orig = new Uint8ClampedArray(d);
  const borde = [];
  const vetas = rareza === 'legendario' ? [[50, 53], [62, 63]] : rareza === 'comun' ? [] : [[50, 52]];
  const linea = hexRGB(oscuro).map(v => v * 0.3);
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const i = (y * T + x) * 4;
    if (!orig[i + 3]) {
      if (a(x - 1, y) || a(x + 1, y) || a(x, y - 1) || a(x, y + 1)) borde.push(i);
      continue;
    }
    let k = 1;
    while (k < 4 && a(x - k, y) && a(x + k, y) && a(x, y - k) && a(x, y + k)) k++;
    let f = 0.8 + k * 0.07;
    if (!a(x - 1, y) || !a(x, y - 1)) f *= 1.32;
    if (!a(x + 1, y) || !a(x, y + 1)) f *= 0.58;
    let c = [orig[i] * f, orig[i + 1] * f, orig[i + 2] * f];
    if (k >= 2 && vetas.some(([v0, v1]) => x + y >= v0 && x + y <= v1)) c = c.map(v => v + (255 - v) * 0.6);
    d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2];
  }
  for (const i of borde) { d[i] = linea[0]; d[i + 1] = linea[1]; d[i + 2] = linea[2]; d[i + 3] = 255; }
}

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

// Humanoide genérico. estilo: cuerpo 'momia' (vendado, macizo) o 'huesos' (esqueleto),
// colores y un accesorio opcional. pose: 0/1 caminar, 2 ataque, 3 dolor, 4 muerto,
// 5 y 6 cayendo (animación de muerte), 7 lanzar (brazos al frente), 8 paso intermedio.
const ESTILOS = {
  momia: { cuerpo: 'momia', piel: '#c9b98f', sombra: '#8f7f5b', ojo: '#ff5a1f' },
  esqueleto: { cuerpo: 'huesos', piel: '#e4ddc8', sombra: '#a8a08a', ojo: '#2a1a10' },
  // guerrero vikingo congelado, con casco de cuernos y ojos azules
  draugr: { cuerpo: 'momia', piel: '#9fb6c4', sombra: '#5d7584', ojo: '#7fe8ff', accesorio: 'cuernos' },
  // esqueleto pirata con pañuelo rojo y sable
  pirata: { cuerpo: 'huesos', piel: '#ddd3b8', sombra: '#9e957c', ojo: '#2a1a10', accesorio: 'pañuelo' },
  // guerrero jaguar con piel moteada y tocado de plumas
  jaguar: { cuerpo: 'momia', piel: '#d9a441', sombra: '#8a5e1c', ojo: '#ffe14a', accesorio: 'plumas', manchas: true },
  // sectario del templo maldito: túnica roja y máscara de calavera
  sectario: { cuerpo: 'momia', piel: '#8a2418', sombra: '#4e0f0a', ojo: '#ffcc33', accesorio: 'mascara', liso: true },
  // caballero cruzado guardián: armadura y sobreveste blanca con cruz roja
  caballero: { cuerpo: 'momia', piel: '#a4aab2', sombra: '#5c626a', ojo: '#111111', accesorio: 'yelmo', liso: true },
};

// Segmento de un miembro: cónico, con los extremos redondeados (hombro-codo, codo-mano...).
function miembro(g, x0, y0, x1, y1, a0, a1, c) {
  g.fillStyle = c;
  const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
  g.beginPath(); g.moveTo(x0 + nx * a0, y0 + ny * a0); g.lineTo(x1 + nx * a1, y1 + ny * a1); g.lineTo(x1 - nx * a1, y1 - ny * a1); g.lineTo(x0 - nx * a0, y0 - ny * a0); g.fill();
  g.beginPath(); g.arc(x0, y0, a0, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(x1, y1, a1, 0, Math.PI * 2); g.fill();
}
function ovalo(g, x, y, rx, ry, c) { g.fillStyle = c; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); g.fill(); }

// Cuerpo con carne o vendas (momia, draugr, jaguar, sectario, caballero): hombros redondos,
// cintura más angosta, miembros que se afinan y manos.
function cuerpoMacizo(g, e, dy, alza, vaiven, subeI, subeD) {
  const piel = e.piel, sombra = e.sombra;
  // piernas y pies
  miembro(g, 27, 41 + dy, 26, 58 - subeI, 4.6, 3.4, piel); ovalo(g, 25, 60 - subeI, 4.5, 2.6, sombra);
  miembro(g, 37, 41 + dy, 38, 58 - subeD, 4.6, 3.4, piel); ovalo(g, 39, 60 - subeD, 4.5, 2.6, sombra);
  g.fillStyle = sombra; g.fillRect(31, 42 + dy, 2, 8); // entrepierna
  // torso: hombros anchos que bajan a la cintura, y la pelvis
  g.fillStyle = piel; g.beginPath();
  g.moveTo(20, 23 + dy); g.quadraticCurveTo(32, 18 + dy, 44, 23 + dy); g.lineTo(41, 40 + dy); g.lineTo(23, 40 + dy); g.closePath(); g.fill();
  ovalo(g, 21, 24 + dy, 4, 4, piel); ovalo(g, 43, 24 + dy, 4, 4, piel);
  g.fillStyle = piel; g.beginPath(); g.roundRect(22, 36 + dy, 20, 8, 4); g.fill();
  g.fillStyle = sombra; g.fillRect(25, 30 + dy, 14, 1); g.fillRect(31, 24 + dy, 2, 10); // pecho y esternón
  // cuello y cabeza
  g.fillStyle = sombra; g.fillRect(29, 17 + dy, 6, 5);
  ovalo(g, 32, 12 + dy, 7.5, 8, piel);
  g.fillStyle = sombra; g.fillRect(25, 13 + dy, 14, 1);
  ovalo(g, 29, 12 + dy, 2.4, 1.8, '#1a0e06'); ovalo(g, 35, 12 + dy, 2.4, 1.8, '#1a0e06');
  r(g, 28, 11 + dy, 2, 2, e.ojo); r(g, 34, 11 + dy, 2, 2, e.ojo);
  // brazos: hombro, codo y mano
  const codoI = 33 + dy + alza / 2 + vaiven, manoI = 41 + dy + alza + vaiven;
  const codoD = 33 + dy + alza / 2 - vaiven, manoD = 41 + dy + alza - vaiven;
  miembro(g, 19, 25 + dy, 16, codoI, 3.8, 3, piel); miembro(g, 16, codoI, 17, manoI, 3, 2.6, piel); ovalo(g, 17, manoI + 2, 3, 3.2, sombra);
  miembro(g, 45, 25 + dy, 48, codoD, 3.8, 3, piel); miembro(g, 48, codoD, 47, manoD, 3, 2.6, piel); ovalo(g, 47, manoD + 2, 3, 3.2, sombra);
  // texturas sobre lo ya pintado: vendas cruzadas o manchas de jaguar
  g.save(); g.globalCompositeOperation = 'source-atop';
  if (e.manchas) {
    for (const [x, y] of [[23, 26], [30, 29], [38, 25], [26, 35], [36, 37], [16, 30], [47, 31], [26, 48], [38, 52], [29, 8], [34, 15]]) { ovalo(g, x, y + dy, 2, 1.4, '#4a2c0c'); r(g, x, y + dy, 1, 1, '#2a1806'); }
  } else if (!e.liso) {
    for (let y = 4; y < 64; y += 4) {
      g.fillStyle = sombra; g.save(); g.translate(32, y + dy); g.rotate((y % 8 ? 1 : -1) * 0.12); g.fillRect(-30, 0, 60, 1); g.fillStyle = 'rgba(255,250,235,.35)'; g.fillRect(-30, 1, 60, 1); g.restore();
    }
    g.fillStyle = 'rgba(0,0,0,.18)'; for (let i = 0; i < 40; i++) g.fillRect((i * 37) % 64, (i * 23) % 64, 1, 1); // mugre
  }
  g.restore();
  if (!e.liso && !e.manchas) { g.fillStyle = piel; g.fillRect(15, manoI + 4, 2, 7); g.fillRect(16, manoI + 9, 1, 3); } // tira suelta
}

// Esqueleto: cráneo con mandíbula, columna, costillas curvas, pelvis y huesos con articulaciones.
function esqueletoDe(g, e, dy, alza, vaiven, subeI, subeD) {
  const hueso = e.piel, osc = e.sombra;
  const art = (x, y) => ovalo(g, x, y, 2.3, 2.3, hueso);
  // piernas
  miembro(g, 27, 40 + dy, 26, 50, 1.7, 1.5, hueso); art(26, 50); miembro(g, 26, 50, 26, 59 - subeI, 1.5, 1.4, hueso); ovalo(g, 25, 61 - subeI, 4, 1.8, hueso);
  miembro(g, 37, 40 + dy, 38, 50, 1.7, 1.5, hueso); art(38, 50); miembro(g, 38, 50, 38, 59 - subeD, 1.5, 1.4, hueso); ovalo(g, 39, 61 - subeD, 4, 1.8, hueso);
  // pelvis
  g.fillStyle = hueso; g.beginPath(); g.moveTo(24, 36 + dy); g.lineTo(40, 36 + dy); g.lineTo(37, 42 + dy); g.lineTo(32, 40 + dy); g.lineTo(27, 42 + dy); g.closePath(); g.fill();
  ovalo(g, 28, 39 + dy, 1.4, 1.4, osc); ovalo(g, 36, 39 + dy, 1.4, 1.4, osc);
  // columna
  for (let y = 18; y < 37; y += 3) { r(g, 30, y + dy, 4, 2, hueso); r(g, 31, y + 2 + dy, 2, 1, osc); }
  // clavículas y costillas curvas
  g.strokeStyle = hueso; g.lineWidth = 2;
  g.beginPath(); g.moveTo(21, 22 + dy); g.quadraticCurveTo(32, 19 + dy, 43, 22 + dy); g.stroke();
  for (let i = 0; i < 4; i++) { g.beginPath(); g.ellipse(32, 23 + i * 4 + dy, 10 - i, 3.2, 0, Math.PI * 0.04, Math.PI * 0.96); g.stroke(); }
  // brazos
  const codoI = 32 + dy + alza / 2 + vaiven, manoI = 40 + dy + alza + vaiven;
  const codoD = 32 + dy + alza / 2 - vaiven, manoD = 40 + dy + alza - vaiven;
  art(20, 23 + dy); miembro(g, 20, 23 + dy, 18, codoI, 1.6, 1.4, hueso); art(18, codoI); miembro(g, 18, codoI, 18, manoI, 1.4, 1.2, hueso);
  for (let k = -1; k <= 1; k++) r(g, 17 + k * 1.5, manoI + 1, 1, 4, hueso);
  art(44, 23 + dy); miembro(g, 44, 23 + dy, 46, codoD, 1.6, 1.4, hueso); art(46, codoD); miembro(g, 46, codoD, 46, manoD, 1.4, 1.2, hueso);
  for (let k = -1; k <= 1; k++) r(g, 46 + k * 1.5, manoD + 1, 1, 4, hueso);
  // cráneo
  ovalo(g, 32, 11 + dy, 7.2, 7.5, hueso);
  g.fillStyle = hueso; g.beginPath(); g.roundRect(27, 15 + dy, 10, 5, 2); g.fill();
  ovalo(g, 29, 11 + dy, 2.3, 2.5, '#1a0e06'); ovalo(g, 35, 11 + dy, 2.3, 2.5, '#1a0e06');
  r(g, 29, 11 + dy, 1, 1, e.ojo === '#2a1a10' ? '#5a4a3a' : e.ojo); r(g, 35, 11 + dy, 1, 1, e.ojo === '#2a1a10' ? '#5a4a3a' : e.ojo);
  g.fillStyle = '#1a0e06'; g.beginPath(); g.moveTo(32, 13 + dy); g.lineTo(30.5, 16 + dy); g.lineTo(33.5, 16 + dy); g.fill();
  r(g, 28, 18 + dy, 8, 1, '#1a0e06'); for (let x = 29; x < 36; x += 2) r(g, x, 17 + dy, 1, 3, '#1a0e06');
}

function humanoide(g, tipo, pose) {
  const e = ESTILOS[tipo];
  const momia = e.cuerpo === 'momia';
  const piel = e.piel, sombra = e.sombra;
  // muerte: el mismo cuerpo (en pose de dolor) que se arrodilla, se desploma y queda tendido
  if (pose === 4 || pose === 5 || pose === 6) {
    g.save();
    if (pose === 5) { g.translate(32, 62); g.rotate(0.12); g.scale(1, 0.78); g.translate(-32, -62); }
    else if (pose === 6) { g.translate(32, 62); g.rotate(0.6); g.scale(0.85, 0.85); g.translate(-32, -62); }
    else { g.translate(32, 54); g.rotate(Math.PI / 2); g.scale(0.9, 0.9); g.translate(-32, -37); }
    humanoide(g, tipo, 3);
    g.restore();
    return;
  }
  const paso = pose === 1 ? 1 : 0;
  const dy = pose === 3 ? 2 : pose === 8 ? -1 : 0;
  const vaiven = pose === 0 ? 2 : pose === 1 ? -2 : 0; // los brazos se balancean al caminar
  const alza = pose === 2 ? -10 : pose === 7 ? -6 : 0;
  const subeI = pose === 1 ? 2 : 0, subeD = pose === 0 ? 2 : 0; // pie que se levanta al caminar
  if (momia) cuerpoMacizo(g, e, dy, alza, vaiven, subeI, subeD);
  else esqueletoDe(g, e, dy, alza, vaiven, subeI, subeD);
  if (e.accesorio === 'pañuelo') {
    // sable en la mano derecha
    r(g, 47, 6 + dy + alza, 2, 18, '#d8dde4'); r(g, 48, 6 + dy + alza, 1, 18, '#ffffff'); r(g, 44, 23 + dy + alza, 8, 2, '#c8a040');
  }
  if (e.accesorio === 'cuernos') {
    r(g, 23, 4 + dy, 18, 5, '#6a6e74'); r(g, 23, 4 + dy, 18, 1, '#9aa0a8');
    r(g, 18, 0 + dy, 4, 6, '#e8e0c8'); r(g, 42, 0 + dy, 4, 6, '#e8e0c8');
    r(g, 20, 6 + dy, 4, 3, '#e8e0c8'); r(g, 40, 6 + dy, 4, 3, '#e8e0c8');
    r(g, 26, 18 + dy, 12, 6, '#c8d8e0'); // barba escarchada
  }
  if (e.accesorio === 'pañuelo') { r(g, 24, 5 + dy, 16, 4, '#b02020'); r(g, 38, 7 + dy, 6, 3, '#b02020'); }
  if (e.accesorio === 'plumas') {
    r(g, 23, 3 + dy, 18, 5, '#c08a2a');
    const colores = ['#2fa860', '#d03030', '#2f6ad0', '#2fa860', '#e8c020'];
    colores.forEach((c, i) => r(g, 22 + i * 4, -6 + dy + Math.abs(2 - i) * 2, 3, 10, c));
    r(g, 26, 9 + dy, 12, 2, '#4a2c0c');
  }
  if (e.accesorio === 'mascara') {
    r(g, 22, 4 + dy, 20, 6, '#4e0f0a'); r(g, 22, 4 + dy, 3, 18, '#4e0f0a'); r(g, 39, 4 + dy, 3, 18, '#4e0f0a'); // capucha
    r(g, 26, 9 + dy, 12, 11, '#e8e0c8'); r(g, 27, 12 + dy, 3, 3, '#111'); r(g, 34, 12 + dy, 3, 3, '#111'); r(g, 29, 17 + dy, 6, 2, '#111');
    r(g, 27, 12 + dy, 1, 1, '#ffcc33'); r(g, 34, 12 + dy, 1, 1, '#ffcc33');
    r(g, 26, 24 + dy, 12, 2, '#e8b83a'); // collar
  }
  if (e.accesorio === 'yelmo') {
    r(g, 24, 4 + dy, 16, 17, '#8a9098'); r(g, 25, 4 + dy, 14, 2, '#c8ccd2'); r(g, 26, 12 + dy, 12, 2, '#111'); r(g, 31, 14 + dy, 2, 5, '#111');
    r(g, 22, 22 + dy, 20, 19, '#eeeae0'); r(g, 30, 24 + dy, 4, 14, '#b02020'); r(g, 25, 28 + dy, 14, 4, '#b02020'); // sobreveste
    r(g, 50, 4 + dy + alza, 2, 26, '#d8dde4'); r(g, 46, 28 + dy + alza, 10, 2, '#8a6a2a'); // espada
  }
  if (pose === 3) { ovalo(g, 29, 28 + dy, 3, 2, '#7a1010'); r(g, 29, 30 + dy, 1, 3, '#7a1010'); }
  if (pose === 7) { // conjuro: fuego entre las manos
    r(g, 26, 12 + alza + 14, 12, 10, '#ff8a1a'); r(g, 28, 14 + alza + 14, 8, 6, '#ffe14a'); r(g, 30, 16 + alza + 14, 4, 2, '#fff8d0');
  }
}

for (const tipo of Object.keys(ESTILOS)) {
  for (let pose = 0; pose < 9; pose++) registrar(`${tipo}_${pose}`, sprite(g => humanoide(g, tipo, pose)));
}

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

// Friso de jeroglíficos pintados entre dos franjas de colores (empalma con el de al lado).
registrar('hito_jeroglificos', pintura(g => {
  const COL = ['#2f5fa8', '#b8342a', '#d8a838', '#2f8a5a'];
  for (let x = 0; x < T; x += 8) { r(g, x, 4, 8, 4, COL[(x / 8) % 4]); r(g, x, 56, 8, 4, COL[(x / 8 + 2) % 4]); }
  r(g, 0, 9, T, 1, '#1a120a'); r(g, 0, 55, T, 1, '#1a120a');
  for (const xc of [2, 23, 44]) r(g, xc + 17, 12, 1, 41, '#1a120a');   // líneas entre columnas
  const orden = [[0, 1, 4], [3, 2, 0], [1, 4, 3]];
  orden.forEach((col, k) => col.forEach((n, j) => glifo(g, GLIFOS[n], 4 + k * 21, 13 + j * 14, ['#1a2a4a', '#8a2418', '#1a120a'][(k + j) % 3])));
}, 201));

// Disco solar alado sobre una franja de colores.
registrar('hito_disco_alado', pintura(g => {
  const plumas = ['#2f5fa8', '#2f8a5a', '#b8342a', '#d8a838'];
  for (const lado of [-1, 1]) for (let k = 0; k < 4; k++) {
    const largo = 26 - k * 3;
    for (let p = 0; p < largo; p += 3) {
      const x = 32 + lado * (8 + p), y = 20 + k * 3 + Math.round(p * p / 120);
      r(g, lado < 0 ? x - 2 : x, y, 3, 3, plumas[k]);
    }
  }
  ovalo(g, 32, 20, 8, 8, '#1a120a'); ovalo(g, 32, 20, 7, 7, '#c8301e'); ovalo(g, 30, 18, 2, 2, '#e8603a');
  r(g, 22, 25, 3, 6, '#d8a838'); r(g, 39, 25, 3, 6, '#d8a838');   // las dos cobras
  r(g, 21, 23, 4, 3, '#2f8a5a'); r(g, 39, 23, 4, 3, '#2f8a5a');
  for (let x = 6; x < 58; x += 6) r(g, x, 44, 5, 3, plumas[(x / 6) % 4]);
  glifo(g, GLIFOS[0], 27, 49, '#1a120a', 2);
}, 203));

// Ojo de Horus grande, en negro y azul.
registrar('hito_ojo', pintura(g => {
  g.fillStyle = '#e8dcc0'; g.beginPath(); g.ellipse(32, 26, 18, 9, 0, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#141018'; g.lineWidth = 3; g.beginPath(); g.ellipse(32, 26, 18, 9, 0, 0, Math.PI * 2); g.stroke();
  ovalo(g, 32, 26, 7, 7, '#2f5fa8'); ovalo(g, 32, 26, 4, 4, '#141018');
  r(g, 12, 12, 40, 3, '#141018'); r(g, 48, 15, 10, 3, '#141018');            // ceja y cola
  r(g, 50, 26, 10, 3, '#141018');
  r(g, 26, 35, 3, 16, '#141018'); r(g, 26, 49, 9, 3, '#141018');            // lágrima
  g.strokeStyle = '#141018'; g.lineWidth = 3; g.beginPath(); g.moveTo(38, 35); g.lineTo(42, 46); g.arc(46, 46, 4, Math.PI, Math.PI * 2.4); g.stroke();
  for (let x = 6; x < 60; x += 8) r(g, x, 58, 5, 3, '#b8342a');
}, 205));

// Manos en negativo, de ocre y rojo, y unos puntos.
registrar('hito_manos', pintura(g => {
  mano(g, 19, 30, -0.25, '#b03a1e', 1.5); mano(g, 46, 26, 0.25, '#c8642a', 1.4);
  for (const [x, y] of [[10, 50], [14, 54], [10, 58], [56, 46], [58, 52]]) ovalo(g, x, y, 1.6, 1.6, '#a8381e');
}, 207, 0.25));

// Espiral y círculos picados en la piedra, en ocre claro.
registrar('hito_espiral', pintura(g => {
  g.strokeStyle = '#e0c890'; g.lineWidth = 3; g.beginPath();
  for (let a = 0; a < Math.PI * 7; a += 0.1) { const rr = 2 + a * 1.05; const x = 28 + Math.cos(a) * rr, y = 30 + Math.sin(a) * rr; a ? g.lineTo(x, y) : g.moveTo(x, y); }
  g.stroke();
  g.lineWidth = 2; g.strokeStyle = '#c8a870';
  for (const rr of [3, 7]) { g.beginPath(); g.arc(52, 52, rr, 0, Math.PI * 2); g.stroke(); }
  for (const [x, y] of [[8, 8], [14, 6], [52, 10], [56, 16], [8, 56]]) ovalo(g, x, y, 1.6, 1.6, '#e0c890');
}, 209));

// Friso de runas pintadas de rojo entre dos cintas (empalma con el de al lado).
const RUNAS = [
  [[1, 0, 1, 14], [1, 0, 6, 5], [1, 5, 6, 10]],                  // ᚠ
  [[1, 0, 1, 14], [6, 0, 6, 14], [1, 0, 6, 6]],                  // ᚢ
  [[1, 0, 1, 14], [1, 2, 6, 7], [6, 7, 1, 12]],                  // ᚦ
  [[1, 0, 6, 7], [6, 7, 1, 14], [6, 0, 1, 7], [1, 7, 6, 14]],    // ᛟ
  [[3, 0, 3, 14], [0, 3, 3, 6], [6, 3, 3, 6]],                   // ᛉ
  [[1, 0, 1, 14], [1, 0, 6, 4], [6, 4, 1, 8]],                   // ᚱ
];
registrar('hito_runas', pintura(g => {
  g.strokeStyle = '#b02a1e'; g.lineWidth = 3;
  for (const y of [10, 52]) { g.beginPath(); g.moveTo(0, y); for (let x = 0; x <= T; x += 4) g.lineTo(x, y + Math.sin(x / T * Math.PI * 4) * 3); g.stroke(); }
  g.lineWidth = 2.5;
  [0, 3, 1, 5, 2, 4].forEach((n, k) => {
    const x0 = 3 + (k % 3) * 21, y0 = k < 3 ? 17 : 34;
    for (const [a, b, c, d] of RUNAS[n]) { g.beginPath(); g.moveTo(x0 + a * 1.4 + 4, y0 + b); g.lineTo(x0 + c * 1.4 + 4, y0 + d); g.stroke(); }
  });
}, 211));

// Escudo redondo colgado: tablas pintadas en cuartos y umbo de hierro, con dos hachas detrás.
registrar('hito_escudo', sprite(g => {
  g.save(); g.translate(32, 34);
  for (const a of [-0.75, 0.75]) {
    g.save(); g.rotate(a); r(g, -1.5, -28, 3, 54, '#6a4424');
    g.fillStyle = '#9aa0a6'; g.beginPath(); g.moveTo(1, -28); g.lineTo(11, -30); g.lineTo(11, -16); g.lineTo(1, -20); g.fill(); g.restore();
  }
  g.restore();
  ovalo(g, 32, 34, 21, 21, '#3a2a1a');
  g.save(); g.beginPath(); g.arc(32, 34, 19, 0, Math.PI * 2); g.clip();
  for (let k = 0; k < 4; k++) { g.fillStyle = k % 2 ? '#e2d6b8' : '#a82a1e'; g.beginPath(); g.moveTo(32, 34); g.arc(32, 34, 20, k * Math.PI / 2, (k + 1) * Math.PI / 2); g.fill(); }
  for (let x = 13; x < 52; x += 6) r(g, x, 14, 1, 40, 'rgba(40, 24, 12, 0.5)');
  g.restore();
  ovalo(g, 32, 34, 6, 6, '#5a5e64'); ovalo(g, 31, 33, 3, 3, '#9aa0a6');
  moteado(g, 213, 0.12);
}));

// Calavera con tibias cruzadas, pintada de blanco por los piratas.
registrar('hito_calavera', pintura(g => {
  g.save(); g.translate(32, 36);
  for (const a of [-0.7, 0.7]) { g.save(); g.rotate(a); r(g, -2, -22, 4, 44, '#e8e2d0'); ovalo(g, -2, -22, 3, 3, '#e8e2d0'); ovalo(g, 2, -22, 3, 3, '#e8e2d0'); ovalo(g, -2, 22, 3, 3, '#e8e2d0'); ovalo(g, 2, 22, 3, 3, '#e8e2d0'); g.restore(); }
  g.restore();
  ovalo(g, 32, 28, 12, 11, '#e8e2d0'); r(g, 25, 34, 14, 9, '#e8e2d0');
  ovalo(g, 27, 28, 3.5, 4, '#1a120a'); ovalo(g, 37, 28, 3.5, 4, '#1a120a'); r(g, 31, 34, 2, 3, '#1a120a');
  for (const x of [27, 31, 35]) r(g, x, 40, 1, 3, '#1a120a');
  // una marca de flecha raspada debajo: «por aquí»
  r(g, 14, 57, 30, 2, '#d8d0bc'); r(g, 40, 54, 2, 8, '#d8d0bc'); r(g, 42, 56, 2, 4, '#d8d0bc');
}, 215));

// Friso de la serpiente emplumada sobre una greca escalonada (empalma con el de al lado).
registrar('hito_serpiente', pintura(g => {
  for (let x = 0; x < T; x++) {
    const y = 24 + Math.round(Math.sin(x / T * Math.PI * 2) * 7);
    r(g, x, y - 5, 1, 11, '#2f7a4a');
    if ((x + Math.floor(y / 2)) % 4 === 0) r(g, x, y - 2, 1, 3, '#d8b838');   // escamas
    if (x % 8 === 0) r(g, x, y - 9, 2, 4, ['#2fa8a0', '#c8301e'][(x / 8) % 2]);   // plumas
  }
  // greca escalonada abajo
  for (let x = 0; x < T; x += 16) {
    r(g, x, 50, 16, 2, '#b8342a'); r(g, x, 58, 16, 2, '#b8342a');
    r(g, x + 2, 52, 2, 6, '#b8342a'); r(g, x + 2, 52, 8, 2, '#b8342a'); r(g, x + 8, 52, 2, 4, '#b8342a');
    r(g, x + 10, 56, 6, 2, '#d8a838');
  }
}, 217));

// Piedra del sol tallada: anillos, rayos y un rostro en el centro.
registrar('hito_calendario', sprite(g => {
  ovalo(g, 32, 32, 27, 27, '#8a8270'); ovalo(g, 32, 32, 22, 22, '#9a927e');
  g.strokeStyle = '#5a5446'; g.lineWidth = 1.5;
  for (const rr of [26, 21, 14]) { g.beginPath(); g.arc(32, 32, rr, 0, Math.PI * 2); g.stroke(); }
  for (let k = 0; k < 20; k++) { const a = k / 20 * Math.PI * 2; r(g, 32 + Math.cos(a) * 23.5 - 1, 32 + Math.sin(a) * 23.5 - 1, 2, 2, '#5a5446'); }
  g.fillStyle = '#8a8270';
  for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2 + 0.2; g.beginPath(); g.moveTo(32 + Math.cos(a - 0.2) * 14, 32 + Math.sin(a - 0.2) * 14); g.lineTo(32 + Math.cos(a) * 21, 32 + Math.sin(a) * 21); g.lineTo(32 + Math.cos(a + 0.2) * 14, 32 + Math.sin(a + 0.2) * 14); g.fill(); }
  ovalo(g, 32, 32, 9, 9, '#b0a68c');
  r(g, 28, 29, 3, 2, '#3a3428'); r(g, 34, 29, 3, 2, '#3a3428'); r(g, 30, 35, 5, 2, '#8a2418'); r(g, 31, 37, 3, 3, '#a8381e');
  moteado(g, 219);
}));

// Máscara de jade colgada, con ojos de concha y orejeras rojas.
registrar('hito_mascara', sprite(g => {
  g.fillStyle = '#2f8a5a'; g.beginPath(); g.moveTo(18, 14); g.lineTo(46, 14); g.lineTo(48, 36); g.lineTo(40, 52); g.lineTo(24, 52); g.lineTo(16, 36); g.closePath(); g.fill();
  r(g, 20, 12, 24, 4, '#d8a838');
  r(g, 21, 26, 9, 5, '#e8e2d0'); r(g, 34, 26, 9, 5, '#e8e2d0'); r(g, 24, 27, 4, 3, '#141018'); r(g, 37, 27, 4, 3, '#141018');
  r(g, 30, 28, 4, 12, '#3aa06a');
  r(g, 26, 43, 12, 4, '#1a3a24'); r(g, 28, 44, 8, 2, '#e8e2d0');
  ovalo(g, 12, 32, 4, 4, '#b8342a'); ovalo(g, 52, 32, 4, 4, '#b8342a');
  for (let k = 0; k < 6; k++) r(g, 19 + k * 5, 17 + (k % 2) * 3, 3, 3, '#4fb07a');   // teselas
  moteado(g, 221, 0.22);
}));

// Fresco de la abadía: cruz roja en un medallón claro, con un renglón en latín debajo.
registrar('hito_cruz', pintura(g => {
  ovalo(g, 32, 26, 20, 20, '#c8a838'); ovalo(g, 32, 26, 17, 17, '#e8dcc0');
  g.fillStyle = '#a82020';
  g.beginPath(); g.moveTo(29, 26); g.lineTo(24, 11); g.lineTo(40, 11); g.lineTo(35, 26); g.lineTo(40, 41); g.lineTo(24, 41); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(32, 23); g.lineTo(17, 18); g.lineTo(17, 34); g.lineTo(32, 29); g.lineTo(47, 34); g.lineTo(47, 18); g.closePath(); g.fill();
  const rnd = rng(225);
  for (const y of [50, 56]) for (let x = 10; x < 54;) { const w = 2 + Math.floor(rnd() * 5); r(g, x, y, Math.min(w, 54 - x), 2, '#3a1a10'); x += w + 2; }
}, 223));

// Estatuas: se ven siempre de frente, como los enemigos.
registrar('estatua_chacal', sprite(g => {
  r(g, 14, 50, 36, 12, '#6a6458'); r(g, 12, 48, 40, 3, '#7a7466');   // pedestal
  r(g, 20, 52, 24, 3, '#c8a838');
  g.fillStyle = '#26221e';
  g.beginPath(); g.moveTo(22, 48); g.lineTo(42, 48); g.lineTo(40, 30); g.lineTo(34, 22); g.lineTo(26, 24); g.closePath(); g.fill();   // cuerpo sentado
  r(g, 22, 40, 6, 8, '#26221e'); r(g, 36, 40, 6, 8, '#26221e');
  ovalo(g, 31, 17, 6, 6, '#26221e'); r(g, 22, 15, 6, 4, '#26221e');   // cabeza y hocico
  r(g, 29, 4, 3, 10, '#26221e'); r(g, 34, 5, 3, 9, '#26221e');   // orejas
  r(g, 29, 15, 2, 2, '#e8c040');
  r(g, 26, 24, 12, 3, '#c8a838'); r(g, 27, 27, 10, 2, '#2f5fa8');   // collar
}));
registrar('estatua_obelisco', sprite(g => {
  r(g, 18, 56, 28, 6, '#6a6458');
  g.fillStyle = '#8a8270'; g.beginPath(); g.moveTo(24, 56); g.lineTo(40, 56); g.lineTo(37, 12); g.lineTo(27, 12); g.closePath(); g.fill();
  g.fillStyle = '#d8a838'; g.beginPath(); g.moveTo(27, 12); g.lineTo(37, 12); g.lineTo(32, 3); g.closePath(); g.fill();
  moteado(g, 227);
  [0, 3, 1, 4].forEach((n, k) => glifo(g, GLIFOS[n], 30, 16 + k * 9, '#4a4438', 1));
}));
registrar('estatua_guerrero', sprite(g => {
  r(g, 16, 56, 32, 6, '#5e5a52');
  const piedra = '#8e8a80';
  r(g, 26, 40, 5, 16, piedra); r(g, 33, 40, 5, 16, piedra);   // piernas
  g.fillStyle = piedra; g.beginPath(); g.moveTo(22, 22); g.lineTo(42, 22); g.lineTo(40, 42); g.lineTo(24, 42); g.closePath(); g.fill();
  ovalo(g, 32, 15, 6, 7, piedra); r(g, 25, 9, 14, 4, '#7a766c'); r(g, 31, 10, 2, 9, '#7a766c');   // casco
  r(g, 44, 4, 3, 52, '#7a766c'); g.fillStyle = '#7a766c'; g.beginPath(); g.moveTo(42, 6); g.lineTo(45.5, -2); g.lineTo(49, 6); g.fill();   // lanza
  r(g, 41, 24, 5, 4, piedra);
  r(g, 18, 24, 5, 14, piedra);   // brazo con el escudo
  ovalo(g, 19, 40, 7, 9, '#6e6a60'); ovalo(g, 19, 40, 2, 2, '#a8a498');   // escudo
  moteado(g, 229);
}));
registrar('estatua_cabeza', sprite(g => {
  r(g, 10, 58, 44, 5, '#4e4a3e');
  g.fillStyle = '#7a7460'; g.beginPath(); g.ellipse(32, 36, 22, 23, 0, 0, Math.PI * 2); g.fill();
  r(g, 10, 14, 44, 10, '#6a6452'); r(g, 12, 22, 4, 26, '#6a6452'); r(g, 48, 22, 4, 26, '#6a6452');   // casco
  r(g, 18, 28, 12, 5, '#4a4636'); r(g, 34, 28, 12, 5, '#4a4636'); r(g, 21, 29, 5, 3, '#1e1c14'); r(g, 38, 29, 5, 3, '#1e1c14');   // ojos
  r(g, 27, 34, 10, 9, '#8a846c'); r(g, 25, 42, 14, 3, '#3a3628');   // nariz
  r(g, 22, 47, 20, 6, '#4a4636'); r(g, 24, 49, 16, 2, '#1e1c14');   // labios
  moteado(g, 231, 0.24);
}));
registrar('estatua_idolo', sprite(g => {
  r(g, 20, 58, 24, 5, '#4e4a3e');
  const caras = [['#7a5a3a', 6], ['#6a4a2e', 24], ['#7a5a3a', 42]];
  for (const [c, y] of caras) {
    r(g, 20, y, 24, 16, c);
    r(g, 23, y + 4, 6, 4, '#e8dcc0'); r(g, 35, y + 4, 6, 4, '#e8dcc0'); r(g, 25, y + 5, 2, 2, '#141018'); r(g, 37, y + 5, 2, 2, '#141018');
    r(g, 25, y + 11, 14, 3, '#2a1a10'); for (let x = 26; x < 39; x += 3) r(g, x, y + 11, 1, 3, '#e8dcc0');
  }
  r(g, 16, 4, 32, 3, '#c8301e'); r(g, 14, 26, 6, 4, '#2f8a5a'); r(g, 44, 26, 6, 4, '#2f8a5a');
  moteado(g, 233, 0.2);
}));
registrar('estatua_menhir', sprite(g => {
  g.fillStyle = '#7e7a72'; g.beginPath(); g.moveTo(20, 62); g.lineTo(44, 62); g.lineTo(42, 18); g.lineTo(36, 4); g.lineTo(26, 6); g.lineTo(22, 20); g.closePath(); g.fill();
  moteado(g, 235);
  g.strokeStyle = '#a82a1e'; g.lineWidth = 2.5; g.beginPath();
  for (let a = 0; a < Math.PI * 4.5; a += 0.15) { const rr = 1 + a * 0.75; const x = 32 + Math.cos(a) * rr, y = 26 + Math.sin(a) * rr; a ? g.lineTo(x, y) : g.moveTo(x, y); }
  g.stroke();
  g.lineWidth = 2;
  for (const [a, b, c, d] of RUNAS[3]) { g.beginPath(); g.moveTo(26 + a * 1.4, 42 + b); g.lineTo(26 + c * 1.4, 42 + d); g.stroke(); }
  for (const [a, b, c, d] of RUNAS[0]) { g.beginPath(); g.moveTo(34 + a * 1.4, 42 + b); g.lineTo(34 + c * 1.4, 42 + d); g.stroke(); }
}));

// ---------- Tesoros ----------

function brillo(g, x, y) { r(g, x, y - 3, 1, 7, '#fff'); r(g, x - 3, y, 7, 1, '#fff'); }

const FORMAS = {
  idolo(g, c, o) { r(g, 22, 22, 20, 30, o); r(g, 24, 22, 16, 28, c); r(g, 26, 30, 4, 3, o); r(g, 34, 30, 4, 3, o); r(g, 28, 40, 8, 2, o); r(g, 20, 52, 24, 8, o); },
  caliz(g, c, o) { r(g, 18, 22, 28, 4, o); r(g, 20, 24, 24, 12, c); r(g, 24, 36, 16, 4, c); r(g, 30, 40, 4, 12, c); r(g, 22, 52, 20, 6, o); r(g, 24, 52, 16, 4, c); },
  mascara(g, c, o) { r(g, 18, 18, 28, 36, o); r(g, 20, 18, 24, 34, c); r(g, 24, 28, 6, 3, '#111'); r(g, 34, 28, 6, 3, '#111'); r(g, 30, 34, 4, 8, o); r(g, 26, 46, 12, 2, o); r(g, 14, 22, 4, 20, o); r(g, 46, 22, 4, 20, o); },
  gema(g, c, o) { g.fillStyle = c; g.beginPath(); g.moveTo(32, 26); g.lineTo(46, 38); g.lineTo(32, 58); g.lineTo(18, 38); g.closePath(); g.fill(); g.fillStyle = o; g.beginPath(); g.moveTo(32, 26); g.lineTo(46, 38); g.lineTo(32, 40); g.closePath(); g.fill(); },
  corona(g, c, o) { r(g, 16, 40, 32, 14, c); r(g, 16, 50, 32, 4, o); for (let i = 0; i < 4; i++) r(g, 16 + i * 10, 30, 4, 10, c); r(g, 22, 44, 4, 4, '#c02030'); r(g, 38, 44, 4, 4, '#2040c0'); },
  monedas(g, c, o) { for (let i = 0; i < 6; i++) { r(g, 18 + (i % 3) * 9, 52 - Math.floor(i / 3) * 5, 10, 4, o); r(g, 18 + (i % 3) * 9, 51 - Math.floor(i / 3) * 5, 10, 2, c); } r(g, 26, 38, 12, 4, c); },
  amuleto(g, c, o) { for (let a = 0; a < 30; a++) { const t = a / 30 * Math.PI; r(g, 32 + Math.cos(t) * 12, 20 + Math.sin(t) * 14 - 14, 2, 2, o); } r(g, 24, 32, 16, 18, o); r(g, 26, 34, 12, 14, c); r(g, 30, 38, 4, 6, '#2a8a4a'); },
  cetro(g, c, o) { r(g, 30, 22, 4, 38, o); r(g, 31, 22, 2, 38, c); r(g, 26, 14, 12, 10, c); r(g, 29, 17, 6, 4, '#c02030'); },
  calavera(g, c, o) { r(g, 20, 24, 24, 22, c); r(g, 24, 46, 16, 8, c); r(g, 24, 32, 6, 6, o); r(g, 34, 32, 6, 6, o); r(g, 30, 40, 4, 4, o); r(g, 26, 50, 2, 4, o); r(g, 31, 50, 2, 4, o); r(g, 36, 50, 2, 4, o); },
  anfora(g, c, o) { r(g, 26, 18, 12, 6, o); r(g, 28, 24, 8, 6, c); r(g, 20, 30, 24, 20, c); r(g, 24, 50, 16, 6, c); r(g, 20, 38, 24, 3, o); r(g, 16, 30, 4, 10, o); r(g, 44, 30, 4, 10, o); },
  daga(g, c, o) { r(g, 30, 14, 4, 30, c); r(g, 31, 14, 1, 30, '#fff'); r(g, 24, 44, 16, 4, o); r(g, 30, 48, 4, 10, '#6b3e1f'); r(g, 29, 58, 6, 3, o); },
  brujula(g, c, o) { g.fillStyle = o; g.beginPath(); g.arc(32, 40, 16, 0, Math.PI * 2); g.fill(); g.fillStyle = '#efe6cc'; g.beginPath(); g.arc(32, 40, 12, 0, Math.PI * 2); g.fill(); g.fillStyle = '#c02030'; g.beginPath(); g.moveTo(32, 29); g.lineTo(35, 40); g.lineTo(29, 40); g.fill(); g.fillStyle = '#333'; g.beginPath(); g.moveTo(32, 51); g.lineTo(35, 40); g.lineTo(29, 40); g.fill(); r(g, 29, 21, 6, 4, c); },
  catalejo(g, c, o) { g.save(); g.translate(32, 40); g.rotate(-0.5); r(g, -22, -4, 16, 8, o); r(g, -6, -5, 14, 10, c); r(g, 8, -6, 12, 12, o); r(g, 9, -5, 10, 3, c); g.restore(); },
  cofre(g, c, o) { r(g, 14, 34, 36, 24, '#6b3e1f'); r(g, 14, 28, 36, 8, '#8a5530'); r(g, 14, 34, 36, 3, o); r(g, 14, 46, 36, 3, o); r(g, 29, 36, 6, 8, c); r(g, 16, 22, 32, 6, c); r(g, 20, 18, 8, 4, c); r(g, 34, 19, 6, 3, '#c02030'); },
  cuerno(g, c, o) { g.strokeStyle = o; g.lineWidth = 9; g.beginPath(); g.arc(30, 30, 18, 0.2, 2.6); g.stroke(); g.strokeStyle = c; g.lineWidth = 6; g.beginPath(); g.arc(30, 30, 18, 0.2, 2.6); g.stroke(); r(g, 44, 34, 8, 6, o); },
  hacha(g, c, o) { r(g, 30, 16, 4, 44, '#6b3e1f'); g.fillStyle = c; g.beginPath(); g.moveTo(34, 18); g.lineTo(50, 12); g.lineTo(50, 40); g.lineTo(34, 32); g.fill(); r(g, 34, 22, 6, 6, o); r(g, 29, 56, 6, 4, o); },
  disco(g, c, o) { g.fillStyle = o; g.beginPath(); g.arc(32, 38, 20, 0, Math.PI * 2); g.fill(); g.fillStyle = c; g.beginPath(); g.arc(32, 38, 17, 0, Math.PI * 2); g.fill(); g.fillStyle = o; for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; g.fillRect(32 + Math.cos(a) * 12 - 1, 38 + Math.sin(a) * 12 - 1, 3, 3); } g.beginPath(); g.arc(32, 38, 6, 0, Math.PI * 2); g.fill(); },
  piedra(g, c, o) { g.fillStyle = o; g.beginPath(); g.ellipse(32, 42, 14, 17, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = c; g.beginPath(); g.ellipse(31, 41, 11, 14, 0, 0, Math.PI * 2); g.fill(); r(g, 22, 36, 20, 2, o); r(g, 22, 44, 20, 2, o); r(g, 24, 40, 16, 2, o); },
  libro(g, c, o) { r(g, 16, 26, 32, 30, o); r(g, 18, 26, 28, 28, c); r(g, 46, 28, 3, 26, '#efe6cc'); r(g, 24, 32, 16, 2, o); r(g, 24, 37, 12, 2, o); r(g, 30, 42, 4, 8, '#b02020'); r(g, 27, 45, 10, 2, '#b02020'); },
  escudo(g, c, o) { g.fillStyle = o; g.beginPath(); g.moveTo(16, 20); g.lineTo(48, 20); g.lineTo(46, 42); g.lineTo(32, 58); g.lineTo(18, 42); g.closePath(); g.fill(); g.fillStyle = c; g.beginPath(); g.moveTo(19, 23); g.lineTo(45, 23); g.lineTo(43, 41); g.lineTo(32, 54); g.lineTo(21, 41); g.closePath(); g.fill(); r(g, 30, 25, 4, 26, '#b02020'); r(g, 22, 32, 20, 4, '#b02020'); },
  ankh(g, c, o) { g.strokeStyle = o; g.lineWidth = 7; g.beginPath(); g.ellipse(32, 24, 8, 10, 0, 0, Math.PI * 2); g.stroke(); g.strokeStyle = c; g.lineWidth = 4; g.beginPath(); g.ellipse(32, 24, 8, 10, 0, 0, Math.PI * 2); g.stroke(); r(g, 18, 34, 28, 6, o); r(g, 19, 35, 26, 4, c); r(g, 28, 36, 8, 24, o); r(g, 29, 36, 6, 23, c); },
  anillo(g, c, o) { g.strokeStyle = o; g.lineWidth = 9; g.beginPath(); g.ellipse(32, 42, 15, 11, 0, 0, Math.PI * 2); g.stroke(); g.strokeStyle = c; g.lineWidth = 5; g.beginPath(); g.ellipse(32, 42, 15, 11, 0, 0, Math.PI * 2); g.stroke(); r(g, 27, 26, 10, 7, '#c02030'); r(g, 29, 27, 4, 2, '#ff8a9a'); },
  cruz(g, c, o) { r(g, 28, 12, 10, 46, o); r(g, 29, 12, 8, 45, c); r(g, 16, 24, 34, 9, o); r(g, 17, 25, 32, 7, c); r(g, 30, 26, 6, 5, '#c02030'); },
  escarabajo(g, c, o) { r(g, 22, 28, 20, 26, o); r(g, 24, 30, 16, 22, c); r(g, 31, 30, 2, 22, o); r(g, 26, 22, 12, 7, o); r(g, 18, 34, 4, 2, o); r(g, 42, 34, 4, 2, o); r(g, 18, 44, 4, 2, o); r(g, 42, 44, 4, 2, o); },
};

export function registrarTesoros(catalogo) {
  for (const t of catalogo) {
    if (casillas['tesoro_' + t.id]) continue;
    registrar('tesoro_' + t.id, sprite(g => {
      FORMAS[t.forma](g, t.color, t.oscuro);
      brillo(g, 40, 26);
      if (t.rareza !== 'comun') brillo(g, 24, 46);
    }, { pulir: { oscuro: t.oscuro, rareza: t.rareza } }));
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
