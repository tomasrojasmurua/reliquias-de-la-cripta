// Escena del menú: la entrada de un templo en ruinas de noche, con antorchas que titilan,
// brasas que suben y niebla saliendo de la puerta. Pixel art a baja resolución, como el juego.

const ALTO = 240; // resolución interna (alto); el ancho sigue la proporción de la pantalla

let lienzo, ctx, fondo, ancho = 0, cx = 0, raf = 0, activa = false;
let brasas = [];

function rng(semilla) {
  let s = semilla >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

function r(g, x, y, w, h, c) { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }

// Sillares de piedra en un rectángulo, con variación de tono y junta oscura.
function sillares(g, x0, y0, w, h, azar, base = [92, 78, 60], alto = 10) {
  for (let y = y0, fila = 0; y < y0 + h; y += alto, fila++) {
    let x = x0 - (fila % 2) * 11;
    while (x < x0 + w) {
      const bw = 16 + Math.floor(azar() * 14);
      const v = 0.82 + azar() * 0.3;
      const c = base.map(n => Math.round(n * v));
      const xa = Math.max(x, x0), xb = Math.min(x + bw, x0 + w), hb = Math.min(alto, y0 + h - y);
      if (xb > xa) {
        r(g, xa, y, xb - xa, hb, `rgb(${c})`);
        r(g, xa, y, xb - xa, 1, `rgba(255,235,200,0.10)`);
        r(g, xa, y + hb - 1, xb - xa, 1, 'rgba(0,0,0,0.35)');
        r(g, xb - 1, y, 1, hb, 'rgba(0,0,0,0.4)');
        if (azar() < 0.18) r(g, xa + 2 + azar() * (xb - xa - 6), y + 2 + azar() * 5, 2, 1, 'rgba(0,0,0,0.35)');
      }
      x += bw;
    }
  }
}

// Capa fija: cielo, montañas, el templo, la puerta y las escaleras.
function pintarFondo() {
  fondo = document.createElement('canvas');
  fondo.width = ancho; fondo.height = ALTO;
  const g = fondo.getContext('2d');
  const azar = rng(7);

  // cielo nocturno
  const cielo = g.createLinearGradient(0, 0, 0, ALTO * 0.7);
  cielo.addColorStop(0, '#05060f'); cielo.addColorStop(0.55, '#141026'); cielo.addColorStop(1, '#3a2230');
  g.fillStyle = cielo; g.fillRect(0, 0, ancho, ALTO);
  for (let i = 0; i < ancho * 0.5; i++) {
    const b = azar();
    r(g, azar() * ancho, azar() * ALTO * 0.5, 1, 1, `rgba(255,245,220,${0.25 + b * 0.6})`);
  }
  // luna (en pantallas angostas quedaría detrás del título)
  if (ancho >= 180) {
  const lx = cx + Math.min(ancho * 0.36, 150), ly = 34;
  const halo = g.createRadialGradient(lx, ly, 2, lx, ly, 46);
  halo.addColorStop(0, 'rgba(255,240,210,0.35)'); halo.addColorStop(1, 'rgba(255,240,210,0)');
  g.fillStyle = halo; g.fillRect(lx - 50, ly - 50, 100, 100);
  g.fillStyle = '#efe4c6'; g.beginPath(); g.arc(lx, ly, 11, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#d8caa4'; r(g, lx - 4, ly - 3, 3, 3, '#d8caa4'); r(g, lx + 3, ly + 3, 2, 2, '#d8caa4');
  }

  // montañas y selva lejana
  for (const [base, alt, color, sem] of [[150, 40, '#1a1424', 3], [168, 26, '#120f18', 9]]) {
    const a = rng(sem);
    g.fillStyle = color; g.beginPath(); g.moveTo(0, ALTO);
    for (let x = 0; x <= ancho; x += 6) g.lineTo(x, base - Math.abs(Math.sin(x * 0.021 + sem)) * alt - a() * 6);
    g.lineTo(ancho, ALTO); g.fill();
  }

  // templo escalonado
  const suelo = 196;
  const gradas = [[cx - 150, 120, 300, suelo - 120], [cx - 120, 92, 240, 28], [cx - 92, 70, 184, 22], [cx - 60, 52, 120, 18]];
  for (const [x, y, w, h] of gradas) {
    sillares(g, x, y, w, h, azar);
    r(g, x, y, w, 2, 'rgba(255,230,190,0.12)');
    r(g, x - 2, y, 2, h, 'rgba(0,0,0,0.45)'); r(g, x + w, y, 2, h, 'rgba(0,0,0,0.45)');
  }
  // remate con un ojo tallado
  r(g, cx - 14, 56, 28, 12, '#3e3226'); r(g, cx - 10, 59, 20, 6, '#2a2018'); r(g, cx - 3, 60, 6, 4, '#c79a3a');

  // pilastras laterales donde van las antorchas
  for (const sx of [-1, 1]) {
    const px = cx + sx * 78 - 9;
    sillares(g, px, 100, 18, suelo - 100, azar, [104, 88, 68], 8);
    r(g, px - 2, 96, 22, 5, '#6e5c46'); r(g, px - 2, 96, 22, 1, '#9a8466');
  }

  // la puerta: hueco oscuro con escalones que bajan a la cripta
  const pw = 90, ph = 96, px = cx - pw / 2, py = suelo - ph;
  const hueco = g.createLinearGradient(0, py, 0, suelo);
  hueco.addColorStop(0, '#000'); hueco.addColorStop(1, '#0b0705');
  g.fillStyle = hueco; g.fillRect(px, py, pw, ph);
  for (let i = 0; i < 6; i++) {
    const y = suelo - 6 - i * 9, inset = 6 + i * 5;
    r(g, px + inset, y, pw - inset * 2, 2, `rgba(120,90,60,${0.32 - i * 0.05})`);
  }
  // jambas y dintel con glifos
  for (const sx of [px - 12, px + pw]) {
    sillares(g, sx, py, 12, ph, azar, [118, 100, 76], 12);
    for (let y = py + 8; y < suelo - 8; y += 16) { r(g, sx + 3, y, 6, 1, '#2e241a'); r(g, sx + 5, y + 3, 2, 4, '#2e241a'); }
  }
  r(g, px - 18, py - 18, pw + 36, 18, '#7a6650');
  r(g, px - 18, py - 18, pw + 36, 2, '#a48c6c'); r(g, px - 18, py - 2, pw + 36, 2, '#3a2e22');
  for (let i = 0; i < 9; i++) {
    const gx = px - 8 + i * ((pw + 16) / 9);
    r(g, gx + 2, py - 13, 5, 7, '#4a3c2c');
    if (i % 2) r(g, gx + 3, py - 11, 3, 3, '#c79a3a'); else r(g, gx + 3, py - 12, 3, 5, '#5e4e3a');
  }

  // escalinata
  for (let i = 0; i < 4; i++) {
    const w = pw + 40 + i * 30, y = suelo + i * 7;
    r(g, cx - w / 2, y, w, 7, ['#6a5844', '#5e4e3c', '#534434', '#483b2e'][i]);
    r(g, cx - w / 2, y, w, 1, 'rgba(255,230,190,0.15)');
  }
  // suelo
  const tierra = g.createLinearGradient(0, suelo, 0, ALTO);
  tierra.addColorStop(0, '#2a2018'); tierra.addColorStop(1, '#0e0a07');
  g.fillStyle = tierra;
  g.fillRect(0, suelo, cx - (pw + 40) / 2 - 45, ALTO - suelo); g.fillRect(cx + (pw + 40) / 2 + 45, suelo, ancho, ALTO - suelo);
  g.fillRect(0, suelo + 28, ancho, ALTO);
  // piedras caídas y un cráneo junto a la escalinata
  r(g, cx - 120, suelo + 6, 14, 8, '#4e4032'); r(g, cx - 120, suelo + 6, 14, 1, '#7a6650');
  r(g, cx + 104, suelo + 10, 10, 6, '#4e4032');
  r(g, cx + 70, suelo + 30, 6, 5, '#d8cfb4'); r(g, cx + 71, suelo + 31, 1, 1, '#222'); r(g, cx + 73, suelo + 31, 1, 1, '#222');

  // enredaderas que cuelgan
  for (let i = 0; i < 16; i++) {
    const vx = cx - 148 + azar() * 296, vy = [120, 92, 70, 52][Math.floor(azar() * 4)];
    const largo = 10 + azar() * 45;
    for (let y = 0; y < largo; y++) {
      const x = vx + Math.sin(y * 0.3 + i) * 1.5;
      r(g, x, vy + y, 1, 1, '#1f3a1c');
      if (y % 5 === 0) r(g, x + (y % 10 ? 1 : -2), vy + y, 2, 2, '#2e5228');
    }
  }
  // viñeta
  const v = g.createRadialGradient(cx, ALTO * 0.55, ALTO * 0.3, cx, ALTO * 0.55, ALTO * 1.1);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.75)');
  g.fillStyle = v; g.fillRect(0, 0, ancho, ALTO);
}

// Llama de antorcha de unos 10 x 18 píxeles.
function llama(g, x, y, t, sem) {
  const capas = [['#b8360c', 5, 16], ['#ff8a1a', 4, 12], ['#ffd34d', 2.5, 8], ['#fff3c8', 1.2, 4]];
  for (const [color, w0, h0] of capas) {
    g.fillStyle = color;
    for (let k = 0; k < h0; k++) {
      const f = k / h0; // 0 base, 1 punta
      const w = w0 * (1 - f * f) * (0.85 + 0.15 * Math.sin(t * 17 + k + sem));
      const ox = Math.sin(t * 8 + k * 0.6 + sem) * f * 2.2;
      g.fillRect(Math.round(x - w + ox), Math.round(y - k), Math.max(1, Math.round(w * 2)), 1);
    }
  }
}

function cuadro(ms) {
  if (!activa) return;
  raf = requestAnimationFrame(cuadro);
  const t = ms / 1000;
  ctx.drawImage(fondo, 0, 0);

  // niebla que sale de la puerta
  ctx.save();
  ctx.globalAlpha = 0.16;
  for (let i = 0; i < 5; i++) {
    const x = cx - 40 + ((t * (6 + i * 2) + i * 37) % 90), y = 172 + Math.sin(t * 0.7 + i) * 6 + i * 4;
    const n = ctx.createRadialGradient(x, y, 0, x, y, 22);
    n.addColorStop(0, 'rgba(190,180,170,1)'); n.addColorStop(1, 'rgba(190,180,170,0)');
    ctx.fillStyle = n; ctx.fillRect(x - 22, y - 22, 44, 44);
  }
  ctx.restore();

  // antorchas: soporte, llama y resplandor que titila
  for (const [i, sx] of [[0, -1], [1, 1]]) {
    const x = cx + sx * 78, y = 112;
    const tit = 0.85 + Math.sin(t * 11 + i * 3) * 0.08 + Math.sin(t * 23 + i) * 0.05 + Math.random() * 0.04;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const luz = ctx.createRadialGradient(x, y - 6, 0, x, y - 6, 70 * tit);
    luz.addColorStop(0, `rgba(255,150,50,${0.42 * tit})`); luz.addColorStop(0.4, `rgba(200,90,30,${0.16 * tit})`); luz.addColorStop(1, 'rgba(120,40,10,0)');
    ctx.fillStyle = luz; ctx.fillRect(x - 80, y - 86, 160, 170);
    ctx.restore();
    r(ctx, x - 1, y, 3, 12, '#3a2614'); r(ctx, x - 4, y + 9, 9, 2, '#2a1c10');
    r(ctx, x - 3, y - 3, 7, 5, '#24180e');
    llama(ctx, x + 0.5, y - 3, t, i * 2.1);
    if (Math.random() < 0.12) brasas.push({ x: x + (Math.random() - 0.5) * 4, y: y - 12, vx: (Math.random() - 0.5) * 6, vy: -12 - Math.random() * 14, vida: 1.2 + Math.random() });
  }
  // brasas
  const dt = 1 / 60;
  for (const b of brasas) {
    b.vida -= dt; b.x += (b.vx + Math.sin(t * 3 + b.y) * 4) * dt; b.y += b.vy * dt;
    ctx.fillStyle = b.vida > 0.6 ? '#ffd34d' : '#ff7a1a';
    ctx.globalAlpha = Math.max(0, Math.min(1, b.vida));
    ctx.fillRect(Math.round(b.x), Math.round(b.y), 1, 1);
  }
  ctx.globalAlpha = 1;
  brasas = brasas.filter(b => b.vida > 0);
}

function ajustar() {
  const w = Math.max(120, Math.round(ALTO * innerWidth / innerHeight));
  if (w === ancho) return;
  ancho = w; cx = Math.round(ancho / 2);
  lienzo.width = ancho; lienzo.height = ALTO;
  pintarFondo();
}

export function iniciarEscena(canvas) {
  lienzo = canvas; ctx = canvas.getContext('2d');
  ajustar();
  addEventListener('resize', () => { ajustar(); });
}

export function animarEscena(si) {
  if (si === activa) return;
  activa = si;
  if (si) raf = requestAnimationFrame(cuadro);
  else cancelAnimationFrame(raf);
}
