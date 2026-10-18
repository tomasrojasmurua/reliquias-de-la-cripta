// Texturas y sprites pixel art generados por código (sin archivos de imagen).
// Todo va a un atlas de COLS x FILAS casillas de T x T píxeles.

export const T = 64;
export const COLS = 16;
export const FILAS = 16;

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
    const desfase = fila % 2 ? Math.floor(ancho / 2) : 0;
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

// Sello: losa con un círculo de metal y un glifo. glifo: ojo | runa | ancla | sol
function dibujaSello(b, base, metal, glifo) {
  const r = rng(41);
  b.rect(0, 0, T, T, base); ruido(b, r, 0.2);
  b.rect(0, 0, T, 2, base.map(v => v * 0.55)); b.rect(0, T - 2, T, 2, base.map(v => v * 0.55));
  const oscuro = metal.map(v => v * 0.45);
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const d = Math.hypot(x - 32, y - 32);
    if (d > 19 && d < 23) b.set(x, y, ...metal);
    if (d <= 19) b.tinte(x, y, 0.8);
    if (d >= 19) continue;
    const dx = x - 32, dy = y - 32;
    let dentro = false;
    if (glifo === 'ojo') {
      dentro = Math.abs(dy) < 7 * Math.sqrt(Math.max(0, 1 - (dx / 13) ** 2));
      if (d < 3.5) { b.set(x, y, ...oscuro); continue; }
    } else if (glifo === 'runa') {
      // runa «Algiz»: un tronco con dos brazos
      dentro = (Math.abs(dx) < 2 && dy > -14 && dy < 15) || (dy < 0 && dy > -14 && Math.abs(Math.abs(dx) + dy * 0.9) < 2 && Math.abs(dx) < 12);
    } else if (glifo === 'ancla') {
      dentro = (Math.abs(dx) < 2 && dy > -10 && dy < 12) || (Math.abs(dy + 7) < 2 && Math.abs(dx) < 8) ||
        (Math.abs(Math.hypot(dx, dy - 2) - 11) < 2 && dy > 4) || Math.abs(Math.hypot(dx, dy + 13) - 3) < 1.5;
    } else if (glifo === 'sol') {
      const ang = Math.atan2(dy, dx);
      dentro = d < 7 || (d < 16 && Math.cos(ang * 8) > 0.6);
      if (d < 3) { b.set(x, y, ...oscuro); continue; }
    }
    if (dentro) b.set(x, y, ...metal);
  }
}

registrar('sello', b => dibujaSello(b, [86, 80, 74], [200, 160, 60], 'ojo'));
registrar('sello_runa', b => dibujaSello(b, [120, 150, 170], [210, 235, 250], 'runa'));
registrar('sello_ancla', b => dibujaSello(b, [90, 64, 40], [190, 160, 90], 'ancla'));
registrar('sello_sol', b => dibujaSello(b, [80, 96, 70], [230, 180, 50], 'sol'));

// Tablilla: placa clara con líneas grabadas sobre el muro de cada mazmorra.
function dibujaTablilla(b, fondo, placa) {
  fondo(b);
  const claro = placa.map(v => Math.min(255, v * 1.25)), oscuro = placa.map(v => v * 0.55);
  b.rect(10, 8, 44, 48, placa);
  b.rect(10, 8, 44, 2, claro); b.rect(10, 54, 44, 2, oscuro);
  b.rect(10, 8, 2, 48, claro); b.rect(52, 8, 2, 48, oscuro);
  const r2 = rng(43);
  for (let fila = 0; fila < 6; fila++) {
    let x = 15;
    while (x < 48) {
      const w = 2 + Math.floor(r2() * 6);
      b.rect(x, 14 + fila * 7, Math.min(w, 49 - x), 2, placa.map(v => v * 0.6));
      x += w + 2;
    }
  }
}

registrar('tablilla', b => dibujaTablilla(b, b => dibujaPiedra(b, rng(11)), [150, 138, 112]));
registrar('tablilla_arenisca', b => dibujaTablilla(b, b => dibujaArenisca(b, rng(21)), [196, 170, 120]));
registrar('tablilla_hielo', b => dibujaTablilla(b, b => dibujaHielo(b, rng(101)), [150, 170, 184]));
registrar('tablilla_roca', b => dibujaTablilla(b, b => dibujaRoca(b, rng(111)), [140, 120, 96]));
registrar('tablilla_madera', b => dibujaTablilla(b, b => dibujaMadera(b, rng(121)), [178, 150, 104]));
registrar('tablilla_selva', b => dibujaTablilla(b, b => dibujaSelva(b, rng(131)), [130, 140, 112]));

// ---------- Glaciar ----------

function dibujaHielo(b, r) {
  ladrillos(b, r, [150, 190, 214], { alto: 21, ancho: 32, mortero: [90, 120, 140], variacion: 0.15 });
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    if ((x + y * 2) % 23 === 0 || (x * 3 - y) % 31 === 0) b.tinte(x, y, 1.18); // vetas brillantes
  }
  ruido(b, r, 0.12);
}
registrar('hielo', b => dibujaHielo(b, rng(101)));
registrar('hielo_grieta', b => { dibujaHielo(b, rng(101)); const r = rng(9); grieta(b, r, 28, 3, 30); grieta(b, r, 40, 30, 24); });
registrar('nieve', b => {
  const r = rng(103);
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const v = 214 + Math.sin(x * 0.3 + y * 0.17) * 8 + Math.sin(y * 0.5) * 5;
    b.set(x, y, v * 0.93, v * 0.97, v);
  }
  ruido(b, r, 0.08);
  for (let n = 0; n < 30; n++) b.tinte(Math.floor(r() * T), Math.floor(r() * T), 0.85);
});
registrar('techo_hielo', b => {
  const r = rng(105);
  b.rect(0, 0, T, T, [96, 124, 140]); ruido(b, r, 0.25);
  for (let n = 0; n < 8; n++) { const x = Math.floor(r() * T); for (let y = 0; y < 10 + r() * 20; y++) b.tinte(x, y, 1.25); }
});

// ---------- Cueva pirata ----------

function dibujaRoca(b, r) {
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const v = 0.75 + 0.25 * Math.sin(x * 0.21 + Math.sin(y * 0.13) * 3) * Math.cos(y * 0.17 + x * 0.05);
    b.set(x, y, 98 * v, 86 * v, 74 * v);
  }
  for (let n = 0; n < 6; n++) { const x = Math.floor(r() * T); grieta(b, r, x, Math.floor(r() * 40), 6 + Math.floor(r() * 14)); }
  ruido(b, r, 0.25);
}
function dibujaMadera(b, r) {
  for (let y = 0; y < T; y++) {
    const tabla = Math.floor(y / 8);
    const f = 0.8 + ((tabla * 37) % 5) * 0.05;
    for (let x = 0; x < T; x++) {
      const veta = Math.sin(x * 0.4 + tabla * 5 + Math.sin(y)) * 0.05;
      const c = y % 8 === 0 ? 0.45 : f + veta;
      b.set(x, y, 104 * c, 70 * c, 44 * c);
    }
    if (y % 8 === 4) for (const x of [6 + (Math.floor(y / 8) % 2) * 26, 38 + (Math.floor(y / 8) % 2) * 20]) b.set(x % T, y, 60, 56, 50);
  }
  ruido(b, r, 0.12);
}
registrar('roca', b => dibujaRoca(b, rng(111)));
registrar('roca_grieta', b => { dibujaRoca(b, rng(111)); const r = rng(13); grieta(b, r, 30, 2, 40); grieta(b, r, 31, 2, 40); });
registrar('madera', b => dibujaMadera(b, rng(121)));
registrar('cubierta', b => {
  const r = rng(123);
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const tabla = Math.floor(x / 16);
    const c = x % 16 === 0 ? 0.5 : 0.85 + ((tabla * 3) % 4) * 0.05 + Math.sin(y * 0.3 + tabla) * 0.04;
    b.set(x, y, 120 * c, 86 * c, 52 * c);
  }
  ruido(b, r, 0.1);
});
registrar('techo_madera', b => {
  const r = rng(125);
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const viga = y % 32 < 8;
    const c = viga ? 0.55 : 0.72;
    b.set(x, y, 96 * c, 64 * c, 40 * c);
  }
  ruido(b, r, 0.15);
});
registrar('arena_humeda', b => {
  const r = rng(127);
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const v = 0.85 + Math.sin(x * 0.25 + y * 0.1) * 0.05;
    b.set(x, y, 150 * v, 128 * v, 92 * v);
  }
  ruido(b, r, 0.2);
});
registrar('techo_roca', b => { const r = rng(129); dibujaRoca(b, r); for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) b.tinte(x, y, 0.7); });

// ---------- Templo de la selva ----------

function dibujaSelva(b, r) {
  ladrillos(b, r, [104, 112, 92], { alto: 16, ancho: 32, mortero: [44, 50, 38], variacion: 0.22 });
  ruido(b, r, 0.2);
  // enredaderas que cuelgan
  for (let n = 0; n < 5; n++) {
    let x = Math.floor(r() * T);
    const largo = 10 + Math.floor(r() * 40);
    for (let y = 0; y < largo; y++) {
      b.set(x, y, 40 + r() * 20, 96 + r() * 40, 36);
      if (r() < 0.25) b.set(x + 1, y, 60, 130, 40);
      if (r() < 0.15) x += r() < 0.5 ? -1 : 1;
    }
  }
}
registrar('selva', b => dibujaSelva(b, rng(131)));
registrar('selva_grieta', b => { dibujaSelva(b, rng(131)); const r = rng(17); grieta(b, r, 26, 18, 40); grieta(b, r, 38, 6, 30); });
registrar('losa_selva', b => {
  const r = rng(133);
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const junta = x % 21 === 0 || y % 21 === 0;
    const f = junta ? 0.45 : 1;
    b.set(x, y, 96 * f, 100 * f, 82 * f);
  }
  ruido(b, r, 0.25);
  for (let n = 0; n < 60; n++) b.set(Math.floor(r() * T), Math.floor(r() * T), 50, 100, 40);
});
registrar('techo_selva', b => { const r = rng(135); b.rect(0, 0, T, T, [62, 66, 54]); ruido(b, r, 0.35); });

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

// ---------- Templo maldito ----------

function dibujaVolcanica(b, r) {
  ladrillos(b, r, [92, 58, 48], { alto: 16, ancho: 32, mortero: [36, 20, 16], variacion: 0.25 });
  ruido(b, r, 0.22);
  for (let n = 0; n < 6; n++) { const x = Math.floor(r() * T), y = Math.floor(r() * T); b.set(x, y, 220, 90, 30); b.set(x + 1, y, 180, 60, 20); }
}
registrar('volcanica', b => dibujaVolcanica(b, rng(141)));
registrar('volcanica_grieta', b => { dibujaVolcanica(b, rng(141)); const r = rng(19); grieta(b, r, 31, 2, 40); grieta(b, r, 20, 30, 26); });
registrar('tablilla_volcanica', b => dibujaTablilla(b, b => dibujaVolcanica(b, rng(141)), [150, 112, 84]));
registrar('losa_roja', b => {
  const r = rng(143);
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const junta = x % 32 === 0 || y % 32 === 0;
    const f = junta ? 0.5 : 1;
    b.set(x, y, 110 * f, 70 * f, 56 * f);
  }
  ruido(b, r, 0.25);
});
registrar('lava', b => {
  const r = rng(145);
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const v = Math.sin(x * 0.2 + Math.sin(y * 0.15) * 3) + Math.sin(y * 0.23 + Math.cos(x * 0.1) * 2);
    const t = (v + 2) / 4;
    if (t < 0.35) b.set(x, y, 90, 20, 8);
    else b.set(x, y, 200 + t * 55, 60 + t * 150, 10 + t * 40);
  }
  ruido(b, r, 0.1);
});
registrar('agujeros', b => {
  const r = rng(147);
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) b.set(x, y, 92, 86, 78);
  ruido(b, r, 0.25);
  for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) { b.rect(5 + i * 16, 5 + j * 16, 5, 5, [16, 12, 10]); b.rect(5 + i * 16, 5 + j * 16, 5, 1, [50, 44, 40]); }
});
registrar('abismo', b => {
  const r = rng(149);
  b.rect(0, 0, T, T, [14, 12, 12]); ruido(b, r, 0.6);
});
registrar('abismo_puente', b => {
  const r = rng(149);
  b.rect(0, 0, T, T, [14, 12, 12]); ruido(b, r, 0.6);
  // el puente se camufla con el fondo: solo lo delatan juntas casi invisibles
  for (let x = 0; x < T; x++) { b.tinte(x, 0, 1.6); b.tinte(x, 32, 1.4); }
});

// ---------- Tumba del cruzado ----------

function dibujaCatacumba(b, r) {
  ladrillos(b, r, [140, 128, 108], { alto: 16, ancho: 32, mortero: [70, 62, 52], variacion: 0.2 });
  ruido(b, r, 0.18);
  // nicho con calaveras
  b.rect(12, 22, 40, 20, [30, 24, 20]);
  for (let i = 0; i < 4; i++) {
    const x = 14 + i * 9;
    b.rect(x, 30, 7, 7, [214, 204, 180]); b.rect(x + 1, 37, 5, 3, [214, 204, 180]);
    b.set(x + 1, 32, 30, 24, 20); b.set(x + 2, 32, 30, 24, 20); b.set(x + 4, 32, 30, 24, 20); b.set(x + 5, 32, 30, 24, 20);
  }
  for (let x = 14; x < 50; x += 3) b.rect(x, 25, 2, 3, [190, 180, 156]);
}
registrar('catacumba', b => dibujaCatacumba(b, rng(151)));
registrar('catacumba_grieta', b => { dibujaCatacumba(b, rng(151)); const r = rng(23); grieta(b, r, 6, 2, 18); grieta(b, r, 56, 44, 18); });
registrar('tablilla_catacumba', b => dibujaTablilla(b, b => dibujaCatacumba(b, rng(151)), [176, 164, 136]));

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

// Da volumen a un sprite plano: luz desde arriba a la izquierda, sombra abajo a la derecha,
// un leve degradado hacia los pies y un contorno oscuro de 1 píxel para que se lea contra el fondo.
function relieve(d) {
  const a = (x, y) => x >= 0 && y >= 0 && x < T && y < T && d[(y * T + x) * 4 + 3] > 0;
  const orig = new Uint8ClampedArray(d);
  const borde = [];
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const i = (y * T + x) * 4;
    if (!orig[i + 3]) {
      if (a(x - 1, y) || a(x + 1, y) || a(x, y - 1) || a(x, y + 1)) borde.push(i);
      continue;
    }
    let f = 1.08 - (y / T) * 0.22;
    if (!a(x - 1, y) || !a(x, y - 1)) f *= 1.28;
    else if (!a(x - 2, y) || !a(x, y - 2)) f *= 1.1;
    if (!a(x + 1, y) || !a(x, y + 1)) f *= 0.62;
    else if (!a(x + 2, y) || !a(x, y + 2)) f *= 0.84;
    d[i] = orig[i] * f; d[i + 1] = orig[i + 1] * f; d[i + 2] = orig[i + 2] * f;
  }
  for (const i of borde) { d[i] = 18; d[i + 1] = 12; d[i + 2] = 8; d[i + 3] = 255; }
}

function r(g, x, y, w, h, c) { g.fillStyle = c; g.fillRect(x, y, w, h); }

// Humanoide genérico. estilo: cuerpo 'momia' (vendado, macizo) o 'huesos' (esqueleto),
// colores y un accesorio opcional. pose: 0/1 caminar, 2 ataque, 3 dolor, 4 muerto,
// 5 y 6 cayendo (animación de muerte), 7 lanzar (brazos al frente).
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

function humanoide(g, tipo, pose) {
  const e = ESTILOS[tipo];
  const momia = e.cuerpo === 'momia';
  const piel = e.piel, sombra = e.sombra;
  if (pose === 5 || pose === 6) { caer(g, e, momia, pose); return; }
  if (pose === 4) {
    if (momia) { r(g, 8, 52, 48, 9, sombra); r(g, 10, 52, 44, 6, piel); r(g, 48, 50, 10, 9, piel); }
    else { r(g, 10, 56, 40, 4, piel); r(g, 46, 50, 10, 9, piel); r(g, 20, 54, 4, 4, sombra); r(g, 30, 54, 4, 4, sombra); }
    if (e.accesorio === 'pañuelo') r(g, 46, 48, 10, 3, '#b02020');
    if (e.accesorio === 'mascara') r(g, 46, 50, 9, 8, '#e8e0c8');
    if (e.accesorio === 'yelmo') { r(g, 46, 49, 11, 10, '#8a9098'); r(g, 20, 54, 16, 4, '#eeeae0'); r(g, 26, 53, 3, 6, '#b02020'); }
    if (e.accesorio === 'cuernos') { r(g, 44, 46, 3, 4, '#e8e0c8'); r(g, 57, 46, 3, 4, '#e8e0c8'); }
    if (e.accesorio === 'plumas') { r(g, 44, 44, 4, 6, '#2fa860'); r(g, 50, 43, 4, 7, '#d03030'); }
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
  const alza = pose === 2 ? -10 : pose === 7 ? -6 : 0;
  if (momia) {
    r(g, 13, 22 + dy + alza, 7, 18, sombra); r(g, 44, 22 + dy + alza, 7, 18, sombra);
    r(g, 14, 22 + dy + alza, 5, 17, piel); r(g, 45, 22 + dy + alza, 5, 17, piel);
  } else {
    r(g, 17, 22 + dy + alza, 3, 17, piel); r(g, 44, 22 + dy + alza, 3, 17, piel);
  }
  if (e.accesorio === 'pañuelo') {
    // sable en la mano derecha
    r(g, 47, 6 + dy + alza, 2, 18, '#d8dde4'); r(g, 44, 23 + dy + alza, 8, 2, '#c8a040');
  }
  // cabeza
  r(g, 24, 6 + dy, 16, 15, momia ? sombra : piel);
  r(g, 25, 6 + dy, 14, 14, piel);
  r(g, 27, 11 + dy, 4, 3, e.ojo); r(g, 33, 11 + dy, 4, 3, e.ojo);
  if (!momia) { r(g, 28, 17 + dy, 8, 2, '#2a1a10'); r(g, 29, 17 + dy, 1, 2, piel); r(g, 32, 17 + dy, 1, 2, piel); }
  if (e.manchas) {
    g.fillStyle = '#4a2c0c';
    for (const [x, y] of [[22, 24], [30, 28], [38, 23], [26, 34], [35, 36], [15, 30], [46, 32], [24, 46], [37, 50]]) g.fillRect(x, y + dy, 3, 2);
  } else if (momia && !e.liso) {
    g.fillStyle = sombra;
    for (let y = 8; y < 60; y += 5) g.fillRect(14, y + dy + (y % 2), 36, 1);
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
  if (pose === 3) { r(g, 26, 26, 6, 4, '#7a1010'); }
  if (pose === 7) { // conjuro: fuego entre las manos
    r(g, 26, 12 + alza + 14, 12, 10, '#ff8a1a'); r(g, 28, 14 + alza + 14, 8, 6, '#ffe14a'); r(g, 30, 16 + alza + 14, 4, 2, '#fff8d0');
  }
}

// Fotogramas intermedios de la muerte: 5 de rodillas, 6 desplomándose.
function caer(g, e, momia, pose) {
  const piel = e.piel, sombra = e.sombra;
  const dy = pose === 5 ? 12 : 26;
  const inclina = pose === 5 ? 3 : 10;
  // piernas dobladas
  if (momia) { r(g, 18, 52, 28, 10, sombra); r(g, 19, 52, 26, 8, piel); }
  else { r(g, 20, 56, 24, 3, piel); r(g, 22, 52, 3, 6, piel); r(g, 38, 52, 3, 6, piel); }
  // torso caído hacia delante
  if (momia) { r(g, 20 + inclina, 20 + dy, 24, 52 - (20 + dy) + 2, sombra); r(g, 21 + inclina, 20 + dy, 22, 52 - (20 + dy), piel); }
  else { r(g, 30 + inclina, 20 + dy, 4, 52 - (20 + dy), piel); for (let i = 0; i < 3; i++) r(g, 23 + inclina, 22 + i * 4 + dy, 18, 2, piel); }
  // brazos colgando
  const brazo = momia ? 6 : 3;
  r(g, 14 + inclina, 24 + dy, brazo, Math.max(6, 60 - (24 + dy)), piel);
  r(g, 44 + inclina, 24 + dy, brazo, Math.max(6, 60 - (24 + dy)), piel);
  // cabeza
  r(g, 24 + inclina * 1.5, 6 + dy, 16, 15, momia ? sombra : piel);
  r(g, 25 + inclina * 1.5, 6 + dy, 14, 14, piel);
  const ojo = pose === 6 ? sombra : e.ojo;
  r(g, 27 + inclina * 1.5, 11 + dy, 4, 2, ojo); r(g, 33 + inclina * 1.5, 11 + dy, 4, 2, ojo);
  if (e.accesorio === 'yelmo') r(g, 24 + inclina * 1.5, 4 + dy, 16, 17, '#8a9098');
  if (e.accesorio === 'mascara') r(g, 26 + inclina * 1.5, 9 + dy, 12, 11, '#e8e0c8');
  if (e.accesorio === 'pañuelo') r(g, 24 + inclina * 1.5, 5 + dy, 16, 4, '#b02020');
  if (e.accesorio === 'cuernos') { r(g, 18 + inclina * 1.5, dy, 4, 6, '#e8e0c8'); r(g, 42 + inclina * 1.5, dy, 4, 6, '#e8e0c8'); }
  if (e.accesorio === 'plumas') r(g, 23 + inclina * 1.5, 2 + dy, 18, 5, '#2fa860');
  r(g, 26, 26 + dy, 6, 4, '#7a1010');
}

for (const tipo of Object.keys(ESTILOS)) {
  for (let pose = 0; pose < 8; pose++) registrar(`${tipo}_${pose}`, sprite(g => humanoide(g, tipo, pose)));
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
