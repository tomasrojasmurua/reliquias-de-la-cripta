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

// Mano empuñando un mango, vista desde atrás como la ves al sostener algo: el eje del mango pasa por (x, y) y gira `ang`.
// Se ve el dorso de la mano con sus tendones, la fila de nudillos que se curva alrededor del mango (los dedos
// quedan del otro lado, sin yemas ni uñas a la vista) y el pulgar que lo cruza por arriba.
// `espejo` da la mano izquierda. El antebrazo sale hacia abajo y gira con `brazo` respecto del mango.
// Se llama después de dibujar el mango y antes de pixelar.
function empunar(g, x, y, ang, espejo = false, brazo = 0) {
  g.save(); g.translate(x, y); g.rotate(ang);
  if (espejo) g.scale(-1, 1);
  g.save(); g.rotate(brazo); manga(g, -22, 20, 50, 0); g.restore();
  // los dedos doblados asoman apenas por el lado izquierdo del mango, en sombra (los envuelven desde atrás)
  for (let i = 0; i < 4; i++) {
    const fy = -17 + i * 9;
    g.fillStyle = lineal(g, -15, 0, -7, 0, [[0, PIEL[0]], [1, PIEL[1]]]);
    g.beginPath(); g.roundRect(-16, fy, 10, 8.5, 4); g.fill();
    g.fillStyle = PIEL_PLIEGUE; g.fillRect(-15, fy + 8, 8, 1);
  }
  // dorso de la mano: ancho, de cara a ti, con la luz arriba a la izquierda
  g.fillStyle = radial(g, 6, -2, 2, 30, [[0, PIEL[2]], [0.5, PIEL[1]], [1, PIEL[0]]], -6, -8);
  g.beginPath(); g.moveTo(-9, -22); g.quadraticCurveTo(10, -27, 20, -16); g.lineTo(22, 16); g.quadraticCurveTo(8, 26, -8, 22); g.closePath(); g.fill();
  // tendones: líneas suaves de la muñeca a cada nudillo
  g.strokeStyle = 'rgba(255,225,190,.35)'; g.lineWidth = 1.2;
  for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(6 + i * 2, 20); g.quadraticCurveTo(2, 2 - i * 4, -6, -15 + i * 9); g.stroke(); }
  // fila de nudillos en el borde izquierdo del dorso, cada uno con su brillo
  for (let i = 0; i < 4; i++) {
    const ny = -16 + i * 9;
    g.fillStyle = radial(g, -7, ny + 4, 0, 6, [[0, PIEL[2]], [1, PIEL[1]]], -1, -2);
    g.beginPath(); g.ellipse(-7, ny + 4, 4.5, 4.2, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(90,40,15,.5)'; g.fillRect(-10, ny + 8, 7, 1);
  }
  // pulgar: sale del lado del dorso y cruza el mango por arriba, en diagonal
  g.save(); g.translate(14, -18); g.rotate(-2.55);
  g.fillStyle = lineal(g, 0, -5, 0, 5, [[0, PIEL[2]], [0.5, PIEL[1]], [1, PIEL[0]]]);
  g.beginPath(); g.roundRect(0, -5, 28, 10, 5); g.fill();
  g.fillStyle = 'rgba(90,40,15,.5)'; g.fillRect(13, -4, 1, 8);   // pliegue de la articulación
  g.restore();
  g.restore();
}

// ---------- Armas de fuego ----------
// Vistas desde atrás y un poco desde arriba, apuntando hacia adelante: se ve lo que reconoce cada una
// (la cara trasera del tambor con sus casquillos, los dos martillos de la escopeta, el cargador de tambor).

const aceroFrente = (g, x0, x1) => lineal(g, x0, 0, x1, 0, [[0, ACERO[0]], [0.3, ACERO[1]], [0.45, ACERO[2]], [0.62, ACERO[1]], [1, ACERO[0]]]);
const nogalFrente = (g, x0, x1) => lineal(g, x0, 0, x1, 0, [[0, NOGAL[0]], [0.3, NOGAL[1]], [0.45, NOGAL[2]], [0.65, NOGAL[1]], [1, NOGAL[0]]]);
// Cuadriculado recortado a la forma ya trazada en `g` (llamar justo después de trazo()).
function cuadricula(g, x0, y0, x1, y1) {
  g.save(); g.clip();
  g.strokeStyle = 'rgba(0,0,0,.3)'; g.lineWidth = 1;
  for (let k = x0 - 60; k < x1 + 60; k += 4) {
    g.beginPath(); g.moveTo(k, y0); g.lineTo(k + (y1 - y0), y1); g.stroke();
    g.beginPath(); g.moveTo(k, y0); g.lineTo(k - (y1 - y0), y1); g.stroke();
  }
  g.restore();
}
function trazo(g, puntos) { g.beginPath(); puntos.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); }
// Fogonazo en estrella en (x, y), con núcleo blanco; achatado como si saliera hacia el fondo.
function fogonazo(g, x, y, r, puntas = 16) {
  g.fillStyle = radial(g, x, y, 0, r * 1.2, [[0, 'rgba(255,255,230,1)'], [0.25, 'rgba(255,230,120,1)'], [0.6, 'rgba(255,140,30,.95)'], [1, 'rgba(255,90,10,0)']]);
  g.beginPath();
  for (let i = 0; i < puntas; i++) { const a = i / puntas * Math.PI * 2, rr = i % 2 ? r * 0.35 : r * (0.8 + (i % 4) * 0.12); g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.62); }
  g.fill();
}

// ---------- Revólver ----------

function revolver(fuego) {
  const [c, g] = hoja();
  const cx = 82;
  // cañón en perspectiva (se angosta hacia la punta), con la costilla iluminada, la varilla expulsora y la mira
  forma(g, [[cx - 5, 18], [cx + 5, 18], [cx + 8, 48], [cx - 8, 48]], aceroFrente(g, cx - 8, cx + 8));
  g.fillStyle = 'rgba(210,220,240,.55)'; g.fillRect(cx - 1, 20, 2, 27);
  forma(g, [[cx + 5, 26], [cx + 8, 26], [cx + 11, 46], [cx + 7, 46]], aceroFrente(g, cx + 5, cx + 11));
  capsula(g, cx - 2.5, 13, 5, 8, lineal(g, cx - 3, 0, cx + 3, 0, [[0, ACERO[0]], [0.5, ACERO[2]], [1, ACERO[0]]]));
  g.fillStyle = '#05060a'; g.beginPath(); g.ellipse(cx, 18, 3, 1.5, 0, 0, Math.PI * 2); g.fill();
  // el tambor: cuerpo redondo, más ancho que el armazón, con estrías que se curvan con su forma
  g.fillStyle = lineal(g, cx - 24, 0, cx + 24, 0, [[0, ACERO[0]], [0.18, ACERO[1]], [0.36, ACERO[2]], [0.55, ACERO[1]], [1, ACERO[0]]]);
  g.beginPath(); g.ellipse(cx, 50, 24, 7, 0, Math.PI, 0); g.lineTo(cx + 24, 60); g.ellipse(cx, 60, 24, 13, 0, 0, Math.PI); g.closePath(); g.fill();
  for (const k of [-2, -1, 1, 2]) {
    const fx = cx + k * 9.5, ancho = 3.2 - Math.abs(k) * 0.6;
    g.fillStyle = 'rgba(0,0,0,.55)'; g.beginPath(); g.ellipse(fx, 52, ancho, 7, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(200,215,240,.3)'; g.fillRect(fx + ancho - 0.5, 47, 1, 10);
  }
  // cara trasera del tambor, de frente a ti: seis recámaras con el culote de latón de cada bala
  g.fillStyle = radial(g, cx, 60, 2, 25, [[0, ACERO[1]], [0.7, ACERO[1]], [1, ACERO[0]]], -6, -4);
  g.beginPath(); g.ellipse(cx, 60, 23, 12.5, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgba(220,230,250,.4)'; g.beginPath(); g.ellipse(cx, 59, 21, 10.5, 0, Math.PI * 1.08, Math.PI * 1.6); g.lineTo(cx, 59); g.fill();
  for (let k = 0; k < 6; k++) {
    const a = -Math.PI / 2 + k * Math.PI / 3, bx = cx + Math.cos(a) * 13.5, by = 60 + Math.sin(a) * 7.2;
    g.fillStyle = '#0a0a0c'; g.beginPath(); g.ellipse(bx, by, 5.4, 3.3, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = radial(g, bx, by, 0, 5, [[0, '#ffe6a0'], [0.55, '#d8a040'], [1, '#7a5010']], -1.5, -1);
    g.beginPath(); g.ellipse(bx, by, 4.4, 2.6, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#9a7030'; g.beginPath(); g.ellipse(bx, by, 1.5, 0.9, 0, 0, Math.PI * 2); g.fill();   // fulminante
  }
  g.fillStyle = ACERO[0]; g.beginPath(); g.ellipse(cx, 60, 3, 1.8, 0, 0, Math.PI * 2); g.fill();     // eje
  // puente superior que une el cañón con el armazón, con la muesca del alza
  forma(g, [[cx - 4, 44], [cx + 4, 44], [cx + 5, 58], [cx - 5, 58]], aceroFrente(g, cx - 5, cx + 5));
  g.fillStyle = '#05060a'; g.fillRect(cx - 1, 55, 2, 3);
  // escudo trasero del armazón: tapa la mitad de abajo del tambor
  forma(g, [[cx - 23, 64], [cx + 23, 64], [cx + 18, 80], [cx - 18, 80]], aceroFrente(g, cx - 23, cx + 23));
  g.fillStyle = 'rgba(220,230,250,.35)'; g.fillRect(cx - 21, 64, 42, 1.5);
  // martillo amartillado, con la espuela estriada
  forma(g, [[cx - 5, 76], [cx + 5, 76], [cx + 4, 58], [cx + 6, 54], [cx - 6, 54], [cx - 4, 58]], aceroFrente(g, cx - 6, cx + 6));
  g.fillStyle = 'rgba(0,0,0,.6)'; for (let i = 0; i < 4; i++) g.fillRect(cx - 5, 55 + i * 2, 10, 1);
  // cachas de nogal con cuadriculado y medallón
  const cacha = [[cx - 16, 79], [cx + 16, 79], [cx + 19, 110], [cx - 19, 110]];
  forma(g, cacha, nogalFrente(g, cx - 19, cx + 19));
  trazo(g, cacha); cuadricula(g, cx - 20, 80, cx + 20, 110);
  g.fillStyle = radial(g, cx, 88, 0, 4, [[0, '#ffe6a0'], [1, '#8a6a20']], -1, -1); g.beginPath(); g.arc(cx, 88, 3.5, 0, Math.PI * 2); g.fill();
  empunar(g, cx, 106, -0.06, false, -0.1);
  if (fuego) fogonazo(g, cx, 14, 22);
  return pixelar(c);
}

// ---------- Escopeta de dos cañones ----------

function escopeta(fuego) {
  const [c, g] = hoja();
  const cx = 82;
  // dos cañones lado a lado, en perspectiva, con la costilla entre ellos y la mira de bolita
  canonDoble(g, cx);
  // guardamano de nogal con estrías
  const guarda = [[cx - 15, 52], [cx + 15, 52], [cx + 19, 74], [cx - 19, 74]];
  forma(g, guarda, nogalFrente(g, cx - 19, cx + 19));
  trazo(g, guarda); cuadricula(g, cx - 20, 54, cx + 20, 74);
  g.fillStyle = ACERO[1]; g.fillRect(cx - 17, 50, 34, 3);
  // báscula de acero templado (vetas de color), con la palanca de apertura arriba
  g.fillStyle = lineal(g, cx - 22, 0, cx + 22, 0, [[0, '#14161c'], [0.25, '#4a4058'], [0.42, '#9a8aa8'], [0.55, '#5a5068'], [1, '#14161c']]);
  g.beginPath(); g.roundRect(cx - 22, 72, 44, 16, 4); g.fill();
  g.fillStyle = 'rgba(210,180,120,.4)'; for (let i = 0; i < 7; i++) g.fillRect(cx - 15 + i * 5, 76 + (i % 2) * 5, 2, 2);
  forma(g, [[cx - 3, 72], [cx + 3, 72], [cx + 9, 66], [cx + 12, 68], [cx + 4, 76], [cx - 3, 76]], aceroFrente(g, cx - 3, cx + 12));
  // los dos martillos, uno a cada lado, con su espuela echada hacia atrás
  for (const dx of [-1, 1]) {
    const hx = cx + dx * 12;
    forma(g, [[hx - 3, 82], [hx + 3, 82], [hx + 3 + dx * 2, 70], [hx + dx * 5, 66], [hx - 3 + dx * 3, 68]], aceroFrente(g, hx - 4, hx + 6));
    g.fillStyle = 'rgba(0,0,0,.6)'; for (let i = 0; i < 3; i++) g.fillRect(hx - 2 + dx * 2, 68 + i * 2, 5, 1);
  }
  // culata de nogal y mano
  const culata = [[cx - 16, 87], [cx + 16, 87], [cx + 22, 116], [cx - 22, 116]];
  forma(g, culata, nogalFrente(g, cx - 22, cx + 22));
  trazo(g, culata); cuadricula(g, cx - 22, 88, cx + 22, 116);
  empunar(g, cx, 112, -0.06, false, -0.1);
  if (fuego) for (const dx of [-5.5, 5.5]) fogonazo(g, cx + dx, 12, 20, 14);
  return pixelar(c);
}

function canonDoble(g, cx) {
  const canon = (puntos, x0, x1) => forma(g, puntos, aceroFrente(g, x0, x1));
  canon([[cx - 10, 16], [cx - 1, 16], [cx - 1, 54], [cx - 16, 54]], cx - 16, cx - 1);
  canon([[cx + 1, 16], [cx + 10, 16], [cx + 16, 54], [cx + 1, 54]], cx + 1, cx + 16);
  g.fillStyle = ACERO[0]; g.fillRect(cx - 1.5, 16, 3, 38);
  g.fillStyle = ACERO[1]; g.fillRect(cx - 0.5, 16, 1, 38);
  g.fillStyle = 'rgba(210,220,240,.5)'; g.fillRect(cx - 6, 18, 2, 32); g.fillRect(cx + 5, 18, 2, 32);
  g.fillStyle = '#05060a';
  for (const dx of [-5.5, 5.5]) { g.beginPath(); g.ellipse(cx + dx, 16, 3.8, 1.9, 0, 0, Math.PI * 2); g.fill(); }
  g.fillStyle = '#e8d8a0'; g.beginPath(); g.arc(cx, 13.5, 1.6, 0, Math.PI * 2); g.fill();
}

// ---------- Tommy gun ----------

function tommy(fuego) {
  const [c, g] = hoja();
  const cx = 82;
  // cargador de tambor bajo el cajón, visto desde arriba y atrás: un disco ancho que asoma a ambos lados
  g.fillStyle = ACERO[0]; g.beginPath(); g.ellipse(cx, 93, 25, 10, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = radial(g, cx, 89, 2, 26, [[0, ACERO[2]], [0.5, ACERO[1]], [1, ACERO[0]]], -8, -3);
  g.beginPath(); g.ellipse(cx, 89, 25, 10, 0, 0, Math.PI * 2); g.fill();
  g.strokeStyle = 'rgba(0,0,0,.55)'; g.lineWidth = 1.4; g.beginPath(); g.ellipse(cx, 89, 19, 7, 0, 0, Math.PI * 2); g.stroke();
  g.fillStyle = 'rgba(220,230,250,.4)'; g.beginPath(); g.ellipse(cx, 88, 23, 8, 0, Math.PI * 1.1, Math.PI * 1.55); g.lineTo(cx, 88); g.fill();
  g.fillStyle = ACERO[2]; for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2; g.fillRect(cx + Math.cos(a) * 22 - 0.7, 89 + Math.sin(a) * 8.6 - 0.7, 1.4, 1.4); }
  g.fillStyle = '#cfae52'; g.beginPath(); g.ellipse(cx - 17, 90, 3, 1.6, 0, 0, Math.PI * 2); g.fill();   // llave del resorte
  // cañón con aletas de enfriamiento (anillos) y compensador ranurado en la punta
  forma(g, [[cx - 4, 18], [cx + 4, 18], [cx + 7, 56], [cx - 7, 56]], aceroFrente(g, cx - 7, cx + 7));
  for (let y = 24; y < 54; y += 3) {
    const a = 5 + (y - 18) * 0.09;
    g.fillStyle = 'rgba(0,0,0,.5)'; g.beginPath(); g.ellipse(cx, y + 1.2, a + 1.5, 1.1, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(200,215,240,.35)'; g.fillRect(cx - a, y, a * 2, 0.8);
  }
  g.fillStyle = aceroFrente(g, cx - 5, cx + 5); g.beginPath(); g.roundRect(cx - 5, 10, 10, 11, 2); g.fill();
  g.fillStyle = '#06070a'; for (const y of [12, 15, 18]) g.fillRect(cx - 4, y, 8, 1.2);
  g.fillStyle = '#e8d8a0'; g.fillRect(cx - 1, 7, 2, 3);
  // empuñadura delantera de nogal, con muescas para los dedos
  const delantera = [[cx - 9, 56], [cx + 9, 56], [cx + 11, 76], [cx - 11, 76]];
  forma(g, delantera, nogalFrente(g, cx - 11, cx + 11));
  g.fillStyle = 'rgba(0,0,0,.35)'; for (const y of [61, 66, 71]) g.fillRect(cx - 10, y, 20, 1.5);
  // cajón de mecanismos con la manija de carga arriba y el alza de escalera
  g.fillStyle = aceroFrente(g, cx - 15, cx + 15); g.beginPath(); g.roundRect(cx - 15, 74, 30, 16, 3); g.fill();
  g.fillStyle = 'rgba(220,230,250,.35)'; g.fillRect(cx - 13, 75, 26, 1.5);
  g.fillStyle = radial(g, cx, 73, 0, 4, [[0, ACERO[2]], [1, ACERO[0]]], -1, -1); g.beginPath(); g.arc(cx, 73, 3.4, 0, Math.PI * 2); g.fill();
  g.strokeStyle = ACERO[1]; g.lineWidth = 1.5; g.strokeRect(cx - 5, 80, 10, 7);
  g.fillStyle = '#05060a'; g.fillRect(cx - 1, 80, 2, 3);
  // culata y mano
  const culata = [[cx - 12, 89], [cx + 12, 89], [cx + 20, 120], [cx - 20, 120]];
  forma(g, culata, nogalFrente(g, cx - 20, cx + 20));
  trazo(g, culata); cuadricula(g, cx - 20, 90, cx + 20, 120);
  empunar(g, cx, 114, -0.06, false, -0.1);
  if (fuego) fogonazo(g, cx, 8, 17, 12);
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
  const k = giro, ox = -(-12) * Math.sin(k), oy = -12 * Math.cos(k);
  empunar(g, x + ox, y + oy, k, false, -0.25);
  return pixelar(c);
}

// ---------- Antorcha ----------

// Antorcha en la mano izquierda: palo con corteza, trapos empapados en brea y mano. La llama se dibuja cada cuadro.
const PUNTA_ANTORCHA = [70, 10]; // donde nace la llama, en píxeles de la hoja
function antorcha() {
  const [c, g] = hoja();
  g.save(); g.translate(70, 14); g.rotate(0.12);
  cilindro(g, -6, 0, 12, 108, MADERA);
  g.fillStyle = 'rgba(0,0,0,.35)'; for (let k = 6; k < 108; k += 9) g.fillRect(-6, k, 12, 1);
  g.fillStyle = 'rgba(255,220,170,.15)'; for (let k = 10; k < 108; k += 13) g.fillRect(-2, k, 1, 5);
  // trapos con vendas cruzadas, chamuscados arriba
  cilindro(g, -11, -6, 22, 22, ['#140c06', '#3a2a18', '#6a5236']);
  g.fillStyle = 'rgba(0,0,0,.45)'; for (let k = -4; k < 16; k += 4) { g.save(); g.translate(0, k); g.rotate(-0.35); g.fillRect(-12, 0, 24, 1); g.restore(); }
  g.fillStyle = lineal(g, 0, -8, 0, 2, [[0, '#0a0604'], [1, 'rgba(10,6,4,0)']]); g.fillRect(-11, -8, 22, 10);
  g.fillStyle = 'rgba(255,140,40,.55)'; g.fillRect(-9, -6, 18, 2); // brasa en el borde
  g.restore();
  empunar(g, 76, 80, 0.12, true, 0.1);
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
  SPRITES.tom = [tommy(false), tommy(true)];
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
  // recarga: el arma baja, se ladea hacia la izquierda y vuelve a subir; a mitad de camino tiembla al meter las balas
  let dy = 0, giro = 0;
  if (j.recargando > 0) {
    const p = 1 - j.recargando / (j.recargaTotal || 1.5), arco = Math.sin(Math.min(1, p * 1.15) * Math.PI);
    dy = arco * H * 0.42 + (p > 0.35 && p < 0.7 ? Math.sin(p * 60) * 1.5 : 0);
    giro = -arco * 0.55;
  }
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

  if (giro) { ctx.save(); const cx = x + W * escala * 0.5, cy = y + H * escala * 0.85; ctx.translate(cx, cy); ctx.rotate(giro); ctx.translate(-cx, -cy); }
  if (j.arma === 'revolver') {
    const fuego = j.ataque > 0.32;
    const retroceso = j.ataque > 0.2 ? (j.ataque - 0.2) * 40 * escala : 0;
    ctx.drawImage(SPRITES.rev[fuego ? 1 : 0], x, y + retroceso, W * escala, H * escala);
  } else if (j.arma === 'tommy') {
    // en ráfaga el arma vibra: un temblor corto y fogonazos alternados
    const fuego = j.ataque > 0.03 && Math.floor(t * 24) % 2 === 0;
    const sacudida = j.ataque > 0 ? ((Math.floor(t * 40) % 2) * 2 - 1) * 2 * escala : 0;
    ctx.drawImage(SPRITES.tom[fuego ? 1 : 0], x + sacudida, y + (j.ataque > 0 ? 3 * escala : 0), W * escala, H * escala);
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
  if (giro) ctx.restore();
}
