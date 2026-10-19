// Armas y manos en primera persona, sobre un canvas 2D encima del juego.
// Se dibujan con degradados a una resolución baja y luego se «pixelan»: cada color se reduce a una
// paleta corta con trama ordenada y se les pone un contorno oscuro, para un pixel art con volumen.

const W = 160, H = 120;

function hoja() { const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'); return [c, g]; }

// ---------- Utilidades de dibujo ----------

function lineal(g, x0, y0, x1, y1, paradas) {
  const d = g.createLinearGradient(x0, y0, x1, y1);
  for (const [t, c] of paradas) d.addColorStop(t, c);
  return d;
}
function radial(g, x, y, r0, r1, paradas, dx = 0, dy = 0) {
  const d = g.createRadialGradient(x + dx, y + dy, r0, x, y, r1);
  for (const [t, c] of paradas) d.addColorStop(t, c);
  return d;
}
function forma(g, puntos, relleno) {
  g.fillStyle = relleno; g.beginPath();
  puntos.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y));
  g.closePath(); g.fill();
}
function capsula(g, x, y, w, h, relleno) {
  const rr = Math.min(w, h) / 2;
  g.fillStyle = relleno; g.beginPath(); g.roundRect(x, y, w, h, rr); g.fill();
}
// Cilindro horizontal visto de frente: sombra, color, brillo a un tercio, color, sombra.
function cilindro(g, x, y, w, h, [osc, base, luz], vertical = true) {
  const d = vertical ? lineal(g, x, 0, x + w, 0, [[0, osc], [0.3, base], [0.42, luz], [0.6, base], [1, osc]])
    : lineal(g, 0, y, 0, y + h, [[0, osc], [0.3, base], [0.42, luz], [0.6, base], [1, osc]]);
  g.fillStyle = d; g.fillRect(x, y, w, h);
}

// Reduce el dibujo a pixel art: alfa todo o nada, colores en 16 niveles con trama 4x4 y contorno.
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
function pixelar(c, contorno = [16, 10, 6]) {
  const g = c.getContext('2d');
  const img = g.getImageData(0, 0, c.width, c.height), d = img.data;
  const paso = 255 / 15;
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
    const i = (y * c.width + x) * 4;
    if (d[i + 3] < 110) { d[i + 3] = 0; continue; }
    d[i + 3] = 255;
    const umbral = (BAYER[(y % 4) * 4 + (x % 4)] + 0.5) / 16;
    for (let k = 0; k < 3; k++) {
      const v = d[i + k] / paso, base = Math.floor(v);
      d[i + k] = Math.min(255, (base + (v - base > umbral ? 1 : 0)) * paso);
    }
  }
  const orig = new Uint8ClampedArray(d);
  const a = (x, y) => x >= 0 && y >= 0 && x < c.width && y < c.height && orig[(y * c.width + x) * 4 + 3];
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
    const i = (y * c.width + x) * 4;
    if (orig[i + 3]) continue;
    if (a(x - 1, y) || a(x + 1, y) || a(x, y - 1) || a(x, y + 1)) { d[i] = contorno[0]; d[i + 1] = contorno[1]; d[i + 2] = contorno[2]; d[i + 3] = 255; }
  }
  g.putImageData(img, 0, 0);
  return c;
}

// ---------- Materiales ----------

const PIEL = ['#7a4426', '#b8784a', '#e0a878'];      // sombra, base, luz
const PIEL_PLIEGUE = '#6a3a20';
const CUERO = ['#2a160a', '#5a3218', '#8a5a30'];     // chaqueta de cuero
const CAMISA = ['#6a5a3a', '#a8946a', '#d0c098'];    // puño de la camisa caqui
const ACERO = ['#14161c', '#3a3e4a', '#a8b0c0'];     // acero pavonado
const NOGAL = ['#2e1608', '#6a3818', '#a8683a'];     // cachas de madera
const TRENZA = ['#24140a', '#5a3a1e', '#8a6038'];    // cuero trenzado del látigo
const MADERA = ['#2a1a0c', '#5a3a1e', '#86603a'];

// Manga de cuero con el puño de la camisa asomando, desde el borde inferior.
function manga(g, x, y, w, giro = 0) {
  g.save(); g.translate(x + w / 2, y); g.rotate(giro);
  cilindro(g, -w / 2, 10, w, 60, CUERO);
  // costura y arrugas
  g.fillStyle = 'rgba(0,0,0,.35)';
  for (let i = 0; i < 3; i++) g.fillRect(-w / 2 + 6 + i * (w / 3), 22 + i * 7, w / 4, 2);
  g.fillStyle = 'rgba(255,220,170,.18)'; g.fillRect(-w / 2 + 4, 12, w - 8, 2);
  // puño de camisa
  cilindro(g, -w / 2 + 3, 2, w - 6, 11, CAMISA);
  g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(-w / 2 + 3, 11, w - 6, 2);
  g.restore();
}

// Puño cerrado visto desde atrás y un poco de lado: dorso, cuatro dedos con nudillos y pulgar.
// (x, y) es la esquina del dorso; espejo invierte para la mano izquierda.
function puno(g, x, y, espejo = false) {
  g.save();
  if (espejo) { g.translate(x + 22, 0); g.scale(-1, 1); g.translate(-x - 22, 0); }
  // dorso de la mano
  g.fillStyle = radial(g, x + 22, y + 22, 2, 30, [[0, PIEL[2]], [0.55, PIEL[1]], [1, PIEL[0]]], -8, -8);
  g.beginPath(); g.roundRect(x, y + 4, 44, 36, 12); g.fill();
  // tendones
  g.strokeStyle = 'rgba(255,220,180,.25)'; g.lineWidth = 1.5;
  for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(x + 14 + i * 8, y + 36); g.lineTo(x + 10 + i * 9, y + 14); g.stroke(); }
  // dedos doblados: cuatro falanges en fila con nudillos brillantes y pliegues
  for (let i = 0; i < 4; i++) {
    const fx = x - 4 + i * 2, fy = y + 2 + i * 9;
    g.fillStyle = radial(g, fx + 6, fy + 5, 1, 9, [[0, PIEL[2]], [0.6, PIEL[1]], [1, PIEL[0]]], -2, -2);
    g.beginPath(); g.roundRect(fx - 8, fy, 18, 10, 5); g.fill();
    g.fillStyle = PIEL_PLIEGUE; g.fillRect(fx - 6, fy + 9, 14, 1);
    g.fillStyle = 'rgba(255,235,210,.5)'; g.fillRect(fx + 3, fy + 2, 3, 2); // nudillo
    g.fillStyle = '#e8c0a0'; g.fillRect(fx - 7, fy + 3, 3, 4);           // uña
  }
  // pulgar cruzando por delante
  g.fillStyle = lineal(g, x + 10, y, x + 36, y + 14, [[0, PIEL[0]], [0.4, PIEL[1]], [0.75, PIEL[2]], [1, PIEL[1]]]);
  g.beginPath(); g.moveTo(x + 6, y + 10); g.quadraticCurveTo(x + 22, y - 6, x + 40, y + 4); g.lineTo(x + 38, y + 14); g.quadraticCurveTo(x + 22, y + 8, x + 10, y + 20); g.closePath(); g.fill();
  g.fillStyle = '#e8c0a0'; g.beginPath(); g.ellipse(x + 37, y + 8, 3, 4, 0.4, 0, Math.PI * 2); g.fill();
  g.restore();
}

// ---------- Revólver ----------

function revolver(fuego) {
  const [c, g] = hoja();
  const cx = 82;
  // cañón en perspectiva (se angosta hacia la punta) con la costilla superior iluminada
  forma(g, [[cx - 5, 22], [cx + 5, 22], [cx + 9, 54], [cx - 9, 54]], lineal(g, cx - 9, 0, cx + 9, 0, [[0, ACERO[0]], [0.35, ACERO[1]], [0.48, ACERO[2]], [0.62, ACERO[1]], [1, ACERO[0]]]));
  g.fillStyle = 'rgba(200,210,230,.5)'; g.fillRect(cx - 1, 24, 2, 28);
  capsula(g, cx - 3, 16, 6, 9, lineal(g, cx - 3, 0, cx + 3, 0, [[0, ACERO[0]], [0.5, ACERO[2]], [1, ACERO[0]]])); // mira
  g.fillStyle = '#05060a'; g.beginPath(); g.ellipse(cx, 22, 3, 1.6, 0, 0, Math.PI * 2); g.fill();            // boca
  // armazón y tambor estriado
  cilindro(g, cx - 22, 50, 44, 24, ACERO);
  for (let i = 0; i < 5; i++) { const fx = cx - 18 + i * 9; g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(fx, 53, 3, 19); g.fillStyle = 'rgba(190,200,220,.28)'; g.fillRect(fx + 3, 53, 1, 19); }
  g.fillStyle = 'rgba(220,230,250,.45)'; g.fillRect(cx - 20, 51, 40, 2);
  g.fillStyle = ACERO[0]; g.fillRect(cx - 22, 72, 44, 3);
  // martillo con espuela estriada
  forma(g, [[cx - 5, 44], [cx + 5, 44], [cx + 6, 54], [cx - 6, 54]], lineal(g, cx - 6, 0, cx + 6, 0, [[0, ACERO[0]], [0.5, ACERO[2]], [1, ACERO[0]]]));
  g.fillStyle = 'rgba(0,0,0,.6)'; for (let i = 0; i < 3; i++) g.fillRect(cx - 4, 46 + i * 2, 8, 1);
  // marco trasero
  cilindro(g, cx - 16, 74, 32, 8, ACERO);
  // cachas de nogal con cuadriculado y medallón
  forma(g, [[cx - 15, 80], [cx + 15, 80], [cx + 18, 108], [cx - 18, 108]], lineal(g, cx - 18, 0, cx + 18, 0, [[0, NOGAL[0]], [0.3, NOGAL[1]], [0.45, NOGAL[2]], [0.65, NOGAL[1]], [1, NOGAL[0]]]));
  g.save(); g.beginPath(); g.rect(cx - 18, 82, 36, 26); g.clip();
  g.strokeStyle = 'rgba(0,0,0,.3)'; g.lineWidth = 1;
  for (let k = -40; k < 40; k += 4) { g.beginPath(); g.moveTo(cx + k, 82); g.lineTo(cx + k + 26, 108); g.stroke(); g.beginPath(); g.moveTo(cx + k, 82); g.lineTo(cx + k - 26, 108); g.stroke(); }
  g.restore();
  g.fillStyle = radial(g, cx, 88, 0, 4, [[0, '#ffe6a0'], [1, '#8a6a20']], -1, -1); g.beginPath(); g.arc(cx, 88, 3.5, 0, Math.PI * 2); g.fill();
  // mano derecha empuñando: dorso a la derecha, pulgar sobre el armazón
  puno(g, cx - 6, 78);
  manga(g, cx - 18, 106, 64, -0.15);
  if (fuego) {
    // fogonazo: estrella de puntas largas con núcleo blanco
    g.fillStyle = radial(g, cx, 16, 0, 24, [[0, 'rgba(255,255,230,1)'], [0.25, 'rgba(255,230,120,1)'], [0.6, 'rgba(255,140,30,.95)'], [1, 'rgba(255,90,10,0)']]);
    g.beginPath();
    for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2, rr = i % 2 ? 7 : 20 + (i % 4) * 3; g.lineTo(cx + Math.cos(a) * rr, 16 + Math.sin(a) * rr * 0.62); }
    g.fill();
  }
  return pixelar(c);
}

// ---------- Escopeta de dos cañones ----------

function escopeta(fuego) {
  const [c, g] = hoja();
  const cx = 82;
  // dos cañones lado a lado, en perspectiva, con la costilla entre ellos
  const canon = (puntos, x0, x1) => forma(g, puntos, lineal(g, x0, 0, x1, 0, [[0, ACERO[0]], [0.35, ACERO[1]], [0.5, ACERO[2]], [0.65, ACERO[1]], [1, ACERO[0]]]));
  canon([[cx - 10, 16], [cx - 1, 16], [cx - 1, 64], [cx - 17, 64]], cx - 17, cx - 1);
  canon([[cx + 1, 16], [cx + 10, 16], [cx + 17, 64], [cx + 1, 64]], cx + 1, cx + 17);
  g.fillStyle = ACERO[0]; g.fillRect(cx - 1, 16, 2, 48);
  g.fillStyle = 'rgba(210,220,240,.5)'; g.fillRect(cx - 6, 18, 2, 30); g.fillRect(cx + 5, 18, 2, 30);
  g.fillStyle = '#05060a';
  for (const dx of [-5.5, 5.5]) { g.beginPath(); g.ellipse(cx + dx, 16, 3.6, 1.8, 0, 0, Math.PI * 2); g.fill(); }
  g.fillStyle = '#e8d8a0'; g.fillRect(cx - 1, 13, 2, 3);   // mira de bolita
  // guardamano de nogal
  forma(g, [[cx - 15, 54], [cx + 15, 54], [cx + 19, 80], [cx - 19, 80]], lineal(g, cx - 19, 0, cx + 19, 0, [[0, NOGAL[0]], [0.3, NOGAL[1]], [0.45, NOGAL[2]], [0.65, NOGAL[1]], [1, NOGAL[0]]]));
  g.strokeStyle = 'rgba(0,0,0,.28)'; g.lineWidth = 1;
  for (let k = -14; k <= 14; k += 4) { g.beginPath(); g.moveTo(cx + k * 0.85, 56); g.lineTo(cx + k * 1.1, 78); g.stroke(); }
  // abrazadera, armazón y gatillos
  g.fillStyle = ACERO[1]; g.fillRect(cx - 17, 52, 34, 3);
  cilindro(g, cx - 21, 78, 42, 14, ACERO);
  g.fillStyle = '#cfae52'; g.fillRect(cx - 4, 82, 8, 2);
  for (const dx of [-8, 8]) { g.fillStyle = ACERO[0]; g.fillRect(cx + dx - 2, 72, 4, 7); g.fillStyle = ACERO[2]; g.fillRect(cx + dx - 2, 72, 1, 6); }
  // culata de nogal y mano
  forma(g, [[cx - 15, 90], [cx + 15, 90], [cx + 21, 114], [cx - 21, 114]], lineal(g, cx - 21, 0, cx + 21, 0, [[0, NOGAL[0]], [0.3, NOGAL[1]], [0.45, NOGAL[2]], [0.65, NOGAL[1]], [1, NOGAL[0]]]));
  puno(g, cx - 6, 84);
  manga(g, cx - 18, 110, 64, -0.15);
  if (fuego) {
    // los dos fogonazos, más anchos que el del revólver
    for (const dx of [-5.5, 5.5]) {
      g.fillStyle = radial(g, cx + dx, 12, 0, 22, [[0, 'rgba(255,255,230,1)'], [0.25, 'rgba(255,230,120,1)'], [0.6, 'rgba(255,140,30,.95)'], [1, 'rgba(255,90,10,0)']]);
      g.beginPath();
      for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2, rr = i % 2 ? 7 : 18 + (i % 4) * 3; g.lineTo(cx + dx + Math.cos(a) * rr, 12 + Math.sin(a) * rr * 0.65); }
      g.fill();
    }
  }
  return pixelar(c);
}

// ---------- Látigo ----------

function latigo(golpe) {
  const [c, g] = hoja();
  g.save();
  // en reposo el mango apunta arriba a la izquierda; al golpear se adelanta y se inclina más
  const x = golpe ? 70 : 104, y = golpe ? 48 : 62, giro = golpe ? -0.9 : -0.45;
  // la tralla cuelga del extremo del mango (solo en reposo; al golpear se dibuja aparte)
  if (!golpe) {
    g.strokeStyle = TRENZA[1]; g.lineCap = 'round';
    for (const [ancho, color] of [[7, TRENZA[0]], [5, TRENZA[1]], [2, 'rgba(160,110,60,.7)']]) {
      g.strokeStyle = color; g.lineWidth = ancho;
      g.beginPath(); g.moveTo(x - 30, y - 34); g.bezierCurveTo(x - 60, y - 20, x - 50, y + 40, x - 20, y + 60); g.stroke();
    }
  }
  g.translate(x, y); g.rotate(giro);
  // mango de cuero trenzado con patrón de rombos
  cilindro(g, -7, -58, 14, 74, TRENZA);
  g.fillStyle = 'rgba(0,0,0,.45)';
  for (let k = -58; k < 16; k += 5) { g.save(); g.beginPath(); g.rect(-7, k, 14, 5); g.clip(); g.fillRect(-7, k, 14, 1); g.translate(0, k); g.rotate(0.6); g.fillRect(-10, 0, 20, 1); g.restore(); }
  g.fillStyle = 'rgba(255,210,150,.25)'; for (let k = -56; k < 14; k += 5) g.fillRect(-3, k + 2, 2, 2);
  // pomo
  g.fillStyle = radial(g, 0, 20, 1, 10, [[0, TRENZA[2]], [0.6, TRENZA[1]], [1, TRENZA[0]]], -3, -3); g.beginPath(); g.ellipse(0, 20, 9, 7, 0, 0, Math.PI * 2); g.fill();
  g.restore();
  puno(g, x - 26, y - 12);
  manga(g, x - 22, y + 26, 62, -0.25);
  return pixelar(c);
}

// ---------- Antorcha ----------

// Antorcha en la mano izquierda: palo con corteza, trapos empapados en brea y mano. La llama se dibuja cada cuadro.
const PUNTA_ANTORCHA = [70, 26]; // donde nace la llama, en píxeles de la hoja
function antorcha() {
  const [c, g] = hoja();
  g.save(); g.translate(70, 30); g.rotate(0.12);
  cilindro(g, -6, 0, 12, 90, MADERA);
  g.fillStyle = 'rgba(0,0,0,.35)'; for (let k = 6; k < 90; k += 9) g.fillRect(-6, k, 12, 1);
  g.fillStyle = 'rgba(255,220,170,.15)'; for (let k = 10; k < 90; k += 13) g.fillRect(-2, k, 1, 5);
  // trapos con vendas cruzadas, chamuscados arriba
  cilindro(g, -11, -6, 22, 22, ['#140c06', '#3a2a18', '#6a5236']);
  g.fillStyle = 'rgba(0,0,0,.45)'; for (let k = -4; k < 16; k += 4) { g.save(); g.translate(0, k); g.rotate(-0.35); g.fillRect(-12, 0, 24, 1); g.restore(); }
  g.fillStyle = lineal(g, 0, -8, 0, 2, [[0, '#0a0604'], [1, 'rgba(10,6,4,0)']]); g.fillRect(-11, -8, 22, 10);
  g.fillStyle = 'rgba(255,140,40,.55)'; g.fillRect(-9, -6, 18, 2); // brasa en el borde
  g.restore();
  puno(g, 62, 74, true);
  manga(g, 44, 108, 64, 0.2);
  return pixelar(c);
}

const LW = 34, LH = 44;
const llamaC = document.createElement('canvas'); llamaC.width = LW; llamaC.height = LH;
const llamaG = llamaC.getContext('2d');
// Llama pixel art: capas de color que se ondulan con el tiempo y chispas que suben.
function llama(t) {
  const g = llamaG;
  g.clearRect(0, 0, LW, LH);
  const capas = [['#8a1c06', 15, 1], ['#d8420c', 13, 0.9], ['#ff8a1a', 10, 0.75], ['#ffc84a', 7, 0.55], ['#fff2c0', 3.5, 0.32]];
  for (const [color, ancho, alto] of capas) {
    g.fillStyle = color;
    for (let y = 0; y < LH; y++) {
      const k = y / LH;
      if (k < 1 - alto) continue;
      const onda = Math.sin(t * 9 + y * 0.42) * (1 - k) * 3.5 + Math.sin(t * 5.3 + y * 0.18) * (1 - k) * 2.5;
      const w = Math.max(0, ancho * Math.sin(Math.min(1, (k - (1 - alto)) / alto) * Math.PI * 0.62) * (0.85 + 0.15 * Math.sin(t * 13 + y)));
      if (w <= 0) continue;
      g.fillRect(Math.round(LW / 2 - w / 2 + onda), y, Math.round(w), 1);
    }
  }
  for (let i = 0; i < 4; i++) {
    const f = (t * 1.5 + i * 0.29) % 1;
    g.fillStyle = f < 0.5 ? '#ffe08a' : '#ff8a2a';
    g.fillRect(Math.round(LW / 2 + Math.sin(t * 3 + i * 2) * 7), Math.round(LH * 0.55 - f * LH * 0.55), 1, 1);
  }
  return llamaC;
}

const SPRITES = {};
function cache() {
  if (SPRITES.listo) return;
  SPRITES.rev = [revolver(false), revolver(true)];
  SPRITES.esc = [escopeta(false), escopeta(true)];
  SPRITES.lat = [latigo(false), latigo(true)];
  SPRITES.antorcha = antorcha();
  SPRITES.listo = true;
}

// estado: {arma, ataque (s restantes), espera, recargando, paso}
export function dibujarArma(ctx, w, h, j) {
  cache();
  ctx.clearRect(0, 0, w, h);
  if (j.muerto) return;
  ctx.imageSmoothingEnabled = false;
  const escala = Math.max(2, Math.round(Math.min(h * 0.5 / H, w * 0.42 / W)));
  const bobX = Math.cos(j.paso * 0.5) * 6 * escala / 3;
  const bobY = Math.abs(Math.sin(j.paso * 0.5)) * 5 * escala / 3;
  let dy = 0;
  if (j.recargando > 0) dy = Math.sin(Math.min(1, j.recargando / 1.1) * Math.PI) * H * 0.6;
  const x = w / 2 - (W * escala) / 2 + bobX + (j.arma === 'latigo' ? w * 0.12 : w * 0.08);
  const y = h - H * escala + bobY + dy * escala + escala * 2;

  // antorcha a la izquierda, con su propio vaivén (va a destiempo del arma)
  const t = performance.now() / 1000;
  const ax = w * 0.12 - (W * escala) / 2 - bobX * 0.8, ay = h - H * escala * 0.95 + Math.abs(Math.cos(j.paso * 0.5)) * 4 * escala / 3;
  const [px, py] = PUNTA_ANTORCHA;
  ctx.save();
  const fx = ax + px * escala, fy = ay + (py - 10) * escala;
  const resplandor = ctx.createRadialGradient(fx, fy, 0, fx, fy, 70 * escala);
  resplandor.addColorStop(0, 'rgba(255, 170, 60, 0.22)'); resplandor.addColorStop(1, 'rgba(255, 140, 40, 0)');
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = resplandor; ctx.fillRect(fx - 70 * escala, fy - 70 * escala, 140 * escala, 140 * escala);
  ctx.restore();
  ctx.drawImage(SPRITES.antorcha, ax, ay, W * escala, H * escala);
  ctx.drawImage(llama(t), ax + (px - LW / 2) * escala, ay + (py - LH + 4) * escala, LW * escala, LH * escala);

  if (j.arma === 'revolver') {
    const fuego = j.ataque > 0.32;
    const retroceso = j.ataque > 0.2 ? (j.ataque - 0.2) * 40 * escala : 0;
    ctx.drawImage(SPRITES.rev[fuego ? 1 : 0], x, y + retroceso, W * escala, H * escala);
  } else if (j.arma === 'escopeta') {
    const fuego = j.ataque > 0.68;
    const retroceso = j.ataque > 0.5 ? (j.ataque - 0.5) * 70 * escala : 0;
    ctx.drawImage(SPRITES.esc[fuego ? 1 : 0], x, y + retroceso, W * escala, H * escala);
  } else {
    const golpe = j.ataque > 0.25;
    ctx.drawImage(SPRITES.lat[golpe ? 1 : 0], x, y, W * escala, H * escala);
    if (golpe) {
      // la tralla restalla hacia el centro de la mira, más gruesa cerca de la mano
      const t2 = (0.55 - j.ataque) / 0.3;
      const hx = x + 25 * escala, hy = y + 12 * escala; // punta del mango inclinado
      ctx.lineCap = 'round';
      for (const [ancho, color] of [[1.8, '#1e1006'], [1.1, '#5a3a1e']]) {
        ctx.strokeStyle = color; ctx.lineWidth = Math.max(2, escala * ancho);
        ctx.beginPath(); ctx.moveTo(hx, hy);
        ctx.quadraticCurveTo(w * 0.6, h * (0.32 + 0.2 * (1 - t2)), w / 2, h / 2 + 10);
        ctx.stroke();
      }
    }
  }
}
