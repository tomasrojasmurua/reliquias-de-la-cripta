// Arma en primera persona, dibujada en pixel art sobre un canvas 2D encima del juego.

const W = 120, H = 90;

function hoja() { const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'); return [c, g]; }
function r(g, x, y, w, h, c) { g.fillStyle = c; g.fillRect(x, y, w, h); }

const PIEL = '#c98a5a', PIEL_OSC = '#94603a', MANGA = '#7a5a32', MANGA_OSC = '#56401f';

function mano(g, x, y) {
  r(g, x - 6, y + 12, 34, 40, MANGA_OSC); r(g, x - 4, y + 12, 30, 40, MANGA);
  r(g, x, y, 24, 18, PIEL_OSC); r(g, x + 1, y, 21, 16, PIEL);
  for (let i = 0; i < 4; i++) r(g, x + 2 + i * 5, y - 2, 4, 6, PIEL);
  r(g, x - 3, y + 3, 6, 9, PIEL);
}

function revolver(fuego) {
  const [c, g] = hoja();
  const cx = 60;
  if (fuego) {
    g.fillStyle = '#fff2a0';
    g.beginPath(); for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2, rr = i % 2 ? 7 : 16; g.lineTo(cx + Math.cos(a) * rr, 12 + Math.sin(a) * rr * 0.8); } g.fill();
    g.fillStyle = '#ff9a20'; g.beginPath(); g.arc(cx, 12, 6, 0, Math.PI * 2); g.fill();
  }
  // cañón en perspectiva
  g.fillStyle = '#2a2a30'; g.beginPath(); g.moveTo(cx - 4, 18); g.lineTo(cx + 4, 18); g.lineTo(cx + 7, 52); g.lineTo(cx - 7, 52); g.fill();
  g.fillStyle = '#5c5c66'; g.beginPath(); g.moveTo(cx - 1, 18); g.lineTo(cx + 1, 18); g.lineTo(cx + 2, 52); g.lineTo(cx - 2, 52); g.fill();
  r(g, cx - 1, 16, 2, 3, '#8a8a94');
  // tambor
  r(g, cx - 12, 46, 24, 16, '#26262c'); r(g, cx - 11, 47, 22, 3, '#6a6a74');
  for (let i = 0; i < 4; i++) r(g, cx - 10 + i * 6, 50, 2, 11, '#3c3c44');
  r(g, cx - 3, 60, 6, 6, '#1c1c20');
  // culata y mano
  r(g, cx - 9, 62, 18, 28, '#6b3e1f'); r(g, cx - 6, 64, 12, 24, '#8a5530');
  mano(g, cx - 12, 70);
  return c;
}

function latigo(golpe) {
  const [c, g] = hoja();
  const x = golpe ? 46 : 74, y = golpe ? 44 : 56;
  r(g, x + 6, y - 22, 8, 30, '#4a2e14'); r(g, x + 8, y - 22, 4, 30, '#6b4420');
  for (let i = 0; i < 5; i++) r(g, x + 6, y - 20 + i * 6, 8, 1, '#2e1c0c');
  mano(g, x - 2, y + 4);
  return c;
}

const SPRITES = {};
function cache() {
  if (SPRITES.listo) return;
  SPRITES.rev = [revolver(false), revolver(true)];
  SPRITES.lat = [latigo(false), latigo(true)];
  SPRITES.listo = true;
}

// estado: {arma, ataque (s restantes), espera, recargando, paso, cambio}
export function dibujarArma(ctx, w, h, j) {
  cache();
  ctx.clearRect(0, 0, w, h);
  if (j.muerto) return;
  ctx.imageSmoothingEnabled = false;
  const escala = Math.max(2, Math.round(Math.min(h * 0.42 / H, w * 0.5 / W)));
  const bobX = Math.cos(j.paso * 0.5) * 6 * escala / 3;
  const bobY = Math.abs(Math.sin(j.paso * 0.5)) * 5 * escala / 3;
  let dy = 0;
  if (j.recargando > 0) dy = Math.sin(Math.min(1, j.recargando / 1.1) * Math.PI) * H * 0.6;
  const x = w / 2 - (W * escala) / 2 + bobX + (j.arma === 'latigo' ? w * 0.08 : w * 0.05);
  const y = h - H * escala + bobY + dy * escala + escala * 4;

  if (j.arma === 'revolver') {
    const fuego = j.ataque > 0.32;
    const retroceso = j.ataque > 0.2 ? (j.ataque - 0.2) * 40 * escala : 0;
    ctx.drawImage(SPRITES.rev[fuego ? 1 : 0], x, y + retroceso, W * escala, H * escala);
  } else {
    const golpe = j.ataque > 0.25;
    ctx.drawImage(SPRITES.lat[golpe ? 1 : 0], x, y, W * escala, H * escala);
    if (golpe) {
      // el látigo restalla hacia el centro de la mira
      const t = (0.55 - j.ataque) / 0.3;
      ctx.strokeStyle = '#3a2410'; ctx.lineWidth = Math.max(2, escala * 1.4); ctx.lineCap = 'round';
      ctx.beginPath();
      const hx = x + 56 * escala, hy = y + 22 * escala;
      ctx.moveTo(hx, hy);
      ctx.quadraticCurveTo(w * 0.62, h * (0.35 + 0.2 * (1 - t)), w / 2, h / 2 + 10);
      ctx.stroke();
    }
  }
}
