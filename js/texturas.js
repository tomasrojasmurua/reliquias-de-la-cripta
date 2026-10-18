// Texturas y sprites pixel art generados por código (sin archivos de imagen).
// Todo va a un atlas de COLS x FILAS casillas de T x T píxeles.

export const T = 64;
export const COLS = 16;
export const FILAS = 8;

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

function ruido(b, r, cantidad) {
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) b.tinte(x, y, 1 + (r() - 0.5) * cantidad);
}

function ladrillos(b, r, base, { alto = 16, ancho = 32, mortero = [38, 32, 28], variacion = 0.25 } = {}) {
  b.rect(0, 0, T, T, mortero);
  for (let fila = 0; fila < T / alto; fila++) {
    const desfase = fila % 2 ? ancho / 2 : 0;
    for (let k = -1; k < T / ancho + 1; k++) {
      const x0 = k * ancho + desfase, y0 = fila * alto;
      const f = 1 + (r() - 0.5) * variacion;
      const c = base.map(v => v * f);
      for (let y = y0 + 1; y < y0 + alto - 1; y++) for (let x = x0 + 1; x < x0 + ancho - 1; x++) {
        if (x < 0 || x >= T) continue;
        let s = 1;
        if (y === y0 + 1 || x === x0 + 1) s = 1.18;           // borde iluminado
        if (y === y0 + alto - 2 || x === x0 + ancho - 2) s = 0.72; // borde en sombra
        b.set(x, y, c[0] * s, c[1] * s, c[2] * s);
      }
      // desconchones
      for (let n = 0; n < 3; n++) {
        const cx = x0 + 3 + Math.floor(r() * (ancho - 6)), cy = y0 + 3 + Math.floor(r() * (alto - 6));
        b.tinte(cx, cy, 0.6); b.tinte(cx + 1, cy, 0.7);
      }
    }
  }
}

function grieta(b, r, x, y, pasos) {
  for (let i = 0; i < pasos; i++) {
    b.tinte(x, y, 0.35); b.tinte(x + 1, y, 0.75);
    y += 1; x += Math.floor(r() * 3) - 1;
  }
}

function aCanvas(b) {
  const c = document.createElement('canvas');
  c.width = c.height = T;
  c.getContext('2d').putImageData(new ImageData(b.d, T, T), 0, 0);
  return c;
}

// ---------- Muros, suelos y techos ----------

const PIEDRA = [104, 96, 86], ARENISCA = [176, 140, 92];

function dibujaPiedra(b, r) { ladrillos(b, r, PIEDRA); ruido(b, r, 0.22); }
function dibujaArenisca(b, r) {
  ladrillos(b, r, ARENISCA, { alto: 21, ancho: 32, mortero: [92, 70, 44], variacion: 0.18 });
  ruido(b, r, 0.16);
  // jeroglíficos tallados
  for (let n = 0; n < 4; n++) {
    const x = 4 + Math.floor(r() * 52), y = 3 + Math.floor(r() * 50);
    const forma = Math.floor(r() * 3);
    for (let i = 0; i < 6; i++) {
      if (forma === 0) b.tinte(x + i, y + 2, 0.6);
      if (forma === 1) { b.tinte(x + 2, y + i, 0.6); b.tinte(x + (i % 3), y, 0.6); }
      if (forma === 2) b.tinte(x + i, y + Math.abs(3 - i), 0.6);
    }
  }
}

registrar('piedra', b => dibujaPiedra(b, rng(11)));
registrar('piedra_grieta', b => { dibujaPiedra(b, rng(11)); const r = rng(5); grieta(b, r, 30, 6, 26); grieta(b, r, 22, 34, 22); });
registrar('musgo', b => {
  const r = rng(13); dibujaPiedra(b, r);
  for (let n = 0; n < 140; n++) {
    const x = Math.floor(r() * T), y = Math.floor(Math.pow(r(), 1.8) * T);
    b.set(x, T - 1 - y, 52 + r() * 30, 86 + r() * 40, 38, 255);
  }
});
registrar('arenisca', b => dibujaArenisca(b, rng(21)));
registrar('arenisca_grieta', b => { dibujaArenisca(b, rng(21)); const r = rng(7); grieta(b, r, 33, 4, 30); grieta(b, r, 12, 30, 24); });

registrar('antorcha', b => {
  const r = rng(11); dibujaPiedra(b, r);
  b.rect(28, 30, 8, 3, [40, 34, 30]); b.rect(30, 33, 4, 12, [70, 46, 28]);
  for (let y = 12; y < 30; y++) for (let x = 24; x < 40; x++) {
    const dx = (x - 32) / 7, dy = (y - 26) / 14;
    const d = dx * dx + dy * dy * (1 + (30 - y) / 10);
    if (d < 1) {
      const t = 1 - d;
      b.set(x, y, 255, 120 + t * 135, 30 + t * 160);
    }
  }
});

registrar('puerta', b => {
  const r = rng(31);
  for (let x = 0; x < T; x++) {
    const tabla = Math.floor(x / 11);
    const f = 0.85 + (tabla % 3) * 0.08;
    for (let y = 0; y < T; y++) {
      const veta = Math.sin((y + tabla * 7) * 0.35 + x * 0.6) * 0.06;
      const c = (x % 11 === 0) ? 0.55 : f + veta + (r() - 0.5) * 0.1;
      b.set(x, y, 112 * c, 72 * c, 40 * c);
    }
  }
  for (const yb of [9, 50]) {
    b.rect(0, yb, T, 5, [62, 60, 58]);
    b.rect(0, yb, T, 1, [110, 106, 100]);
    for (let x = 4; x < T; x += 12) b.rect(x, yb + 2, 2, 2, [150, 146, 140]);
  }
  // argolla
  for (let a = 0; a < 40; a++) {
    const t = a / 40 * Math.PI * 2;
    b.set(Math.round(48 + Math.cos(t) * 4), Math.round(34 + Math.sin(t) * 5), 150, 140, 120);
  }
});

registrar('sello', b => {
  const r = rng(41);
  b.rect(0, 0, T, T, [86, 80, 74]); ruido(b, r, 0.2);
  b.rect(0, 0, T, 2, [50, 46, 42]); b.rect(0, T - 2, T, 2, [50, 46, 42]);
  // círculo dorado con un ojo
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const d = Math.hypot(x - 32, y - 32);
    if (d > 19 && d < 23) b.set(x, y, 200, 160, 60);
    if (d <= 19) b.tinte(x, y, 0.8);
    const ojo = Math.abs(y - 32) < 7 * Math.sqrt(Math.max(0, 1 - ((x - 32) / 13) ** 2));
    if (ojo && d < 19) b.set(x, y, 210, 175, 70);
    if (Math.hypot(x - 32, y - 32) < 3.5) b.set(x, y, 40, 30, 20);
  }
});

registrar('tablilla', b => {
  const r = rng(11); dibujaPiedra(b, r);
  b.rect(10, 8, 44, 48, [150, 138, 112]);
  b.rect(10, 8, 44, 2, [190, 178, 150]); b.rect(10, 54, 44, 2, [80, 72, 60]);
  b.rect(10, 8, 2, 48, [180, 168, 140]); b.rect(52, 8, 2, 48, [90, 82, 68]);
  const r2 = rng(43);
  for (let fila = 0; fila < 6; fila++) {
    let x = 15;
    while (x < 48) {
      const w = 2 + Math.floor(r2() * 6);
      b.rect(x, 14 + fila * 7, Math.min(w, 49 - x), 2, [92, 80, 60]);
      x += w + 2;
    }
  }
});

registrar('salida', b => {
  const r = rng(51); dibujaPiedra(b, r);
  for (let y = 6; y < T; y++) for (let x = 12; x < 52; x++) {
    const arco = y > 22 || Math.hypot(x - 32, y - 22) < 20;
    if (arco) {
      const t = 1 - (y - 6) / 70;
      b.set(x, y, 255, 236 * t + 20, 170 * t + 40);
    }
  }
});

registrar('losa', b => {
  const r = rng(61);
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const junta = x % 32 === 0 || y % 32 === 0;
    const bloque = (Math.floor(x / 32) + Math.floor(y / 32)) % 2;
    const f = junta ? 0.5 : (bloque ? 0.92 : 1);
    b.set(x, y, 92 * f, 86 * f, 78 * f);
  }
  ruido(b, r, 0.25);
});

registrar('arena', b => {
  const r = rng(71);
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const junta = x % 32 === 0 || (y + (x < 32 ? 0 : 16)) % 32 === 0;
    const f = junta ? 0.6 : 1;
    b.set(x, y, 168 * f, 134 * f, 88 * f);
  }
  ruido(b, r, 0.2);
});

registrar('techo', b => {
  const r = rng(81);
  b.rect(0, 0, T, T, [58, 54, 50]); ruido(b, r, 0.35);
  for (let x = 0; x < T; x++) { b.tinte(x, 0, 0.5); b.tinte(x, 31, 0.6); }
});

registrar('techo_arena', b => {
  const r = rng(91);
  b.rect(0, 0, T, T, [110, 86, 58]); ruido(b, r, 0.3);
  for (let x = 0; x < T; x++) { b.tinte(x, 0, 0.55); b.tinte(0, x, 0.55); }
});

// ---------- Sprites (fondo transparente) ----------

function sprite(fn) {
  return b => {
    const c = document.createElement('canvas');
    c.width = c.height = T;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    fn(g);
    const d = g.getImageData(0, 0, T, T).data;
    for (let i = 0; i < d.length; i += 4) { if (d[i + 3] < 128) d[i + 3] = 0; else d[i + 3] = 255; }
    b.d.set(d);
  };
}

function r(g, x, y, w, h, c) { g.fillStyle = c; g.fillRect(x, y, w, h); }

// Humanoide genérico: momia o esqueleto. pose: 0/1 caminar, 2 ataque, 3 dolor, 4 muerto.
function humanoide(g, tipo, pose) {
  const momia = tipo === 'momia';
  const piel = momia ? '#c9b98f' : '#e4ddc8';
  const sombra = momia ? '#8f7f5b' : '#a8a08a';
  if (pose === 4) {
    if (momia) { r(g, 8, 52, 48, 9, sombra); r(g, 10, 52, 44, 6, piel); r(g, 48, 50, 10, 9, piel); }
    else { r(g, 10, 56, 40, 4, piel); r(g, 46, 50, 10, 9, piel); r(g, 20, 54, 4, 4, sombra); r(g, 30, 54, 4, 4, sombra); }
    return;
  }
  const paso = pose === 1 ? 1 : 0;
  const dy = pose === 3 ? 2 : 0;
  // piernas
  if (momia) {
    r(g, 22, 40 + dy, 8, 22 - dy - paso * 2, sombra); r(g, 34, 40 + dy, 8, 22 - dy - (1 - paso) * 2, sombra);
    r(g, 23, 40 + dy, 6, 20 - dy, piel); r(g, 35, 40 + dy, 6, 20 - dy, piel);
  } else {
    r(g, 25, 40 + dy, 3, 22 - dy - paso * 2, piel); r(g, 36, 40 + dy, 3, 22 - dy - (1 - paso) * 2, piel);
    r(g, 22, 60 - paso * 2, 7, 3, piel); r(g, 34, 60 - (1 - paso) * 2, 7, 3, piel);
  }
  // torso
  if (momia) { r(g, 20, 20 + dy, 24, 22, sombra); r(g, 21, 20 + dy, 22, 21, piel); }
  else {
    r(g, 30, 20 + dy, 4, 22, piel);
    for (let i = 0; i < 4; i++) r(g, 23, 22 + i * 4 + dy, 18, 2, piel);
    r(g, 24, 38 + dy, 16, 4, piel);
  }
  // brazos
  const alza = pose === 2 ? -10 : 0;
  if (momia) {
    r(g, 13, 22 + dy + alza, 7, 18, sombra); r(g, 44, 22 + dy + alza, 7, 18, sombra);
    r(g, 14, 22 + dy + alza, 5, 17, piel); r(g, 45, 22 + dy + alza, 5, 17, piel);
  } else {
    r(g, 17, 22 + dy + alza, 3, 17, piel); r(g, 44, 22 + dy + alza, 3, 17, piel);
  }
  // cabeza
  r(g, 24, 6 + dy, 16, 15, momia ? sombra : piel);
  r(g, 25, 6 + dy, 14, 14, piel);
  // ojos
  const ojo = momia ? '#ff5a1f' : '#2a1a10';
  r(g, 27, 11 + dy, 4, 3, ojo); r(g, 33, 11 + dy, 4, 3, ojo);
  if (!momia) { r(g, 28, 17 + dy, 8, 2, '#2a1a10'); r(g, 29, 17 + dy, 1, 2, piel); r(g, 32, 17 + dy, 1, 2, piel); }
  // vendas
  if (momia) {
    g.fillStyle = sombra;
    for (let y = 8; y < 60; y += 5) g.fillRect(14, y + dy + (y % 2), 36, 1);
    r(g, 40, 30 + dy, 10, 2, '#d8cba5');
  }
  if (pose === 3) { r(g, 26, 26, 6, 4, '#7a1010'); }
}

for (const tipo of ['momia', 'esqueleto']) {
  for (let pose = 0; pose < 5; pose++) registrar(`${tipo}_${pose}`, sprite(g => humanoide(g, tipo, pose)));
}

registrar('revolver', sprite(g => {
  r(g, 12, 38, 34, 6, '#3a3a40'); r(g, 12, 38, 34, 2, '#6a6a74');
  r(g, 30, 34, 12, 14, '#2c2c32'); r(g, 31, 35, 10, 3, '#5a5a62');
  r(g, 38, 44, 10, 16, '#6b3e1f'); r(g, 40, 46, 6, 12, '#8a5530');
  r(g, 34, 48, 6, 5, '#2c2c32'); r(g, 12, 35, 2, 3, '#3a3a40');
}));
registrar('balas', sprite(g => {
  r(g, 16, 40, 32, 20, '#6b4a22'); r(g, 16, 40, 32, 4, '#8a6230');
  for (let i = 0; i < 5; i++) { r(g, 19 + i * 6, 30, 4, 10, '#c89a3a'); r(g, 19 + i * 6, 28, 4, 3, '#9a6a2a'); }
  r(g, 22, 48, 20, 6, '#d8c08a');
}));
registrar('vendas', sprite(g => {
  r(g, 20, 40, 24, 20, '#efe8d8'); r(g, 20, 40, 24, 3, '#ffffff');
  r(g, 29, 44, 6, 14, '#b02020'); r(g, 25, 48, 14, 6, '#b02020');
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
  escarabajo(g, c, o) { r(g, 22, 28, 20, 26, o); r(g, 24, 30, 16, 22, c); r(g, 31, 30, 2, 22, o); r(g, 26, 22, 12, 7, o); r(g, 18, 34, 4, 2, o); r(g, 42, 34, 4, 2, o); r(g, 18, 44, 4, 2, o); r(g, 42, 44, 4, 2, o); },
};

export function registrarTesoros(catalogo) {
  for (const t of catalogo) {
    if (casillas['tesoro_' + t.id]) continue;
    registrar('tesoro_' + t.id, sprite(g => {
      FORMAS[t.forma](g, t.color, t.oscuro);
      brillo(g, 40, 26); brillo(g, 24, 46);
    }));
  }
}

// ---------- Atlas ----------

export function crearAtlas() {
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
