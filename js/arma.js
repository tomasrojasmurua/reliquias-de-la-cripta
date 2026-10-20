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

// Mano empuñando un mango: el eje del mango pasa por (x, y) y gira `ang`; los cuatro dedos cruzan por delante
// del mango y el pulgar lo abraza desde arriba, así mano y objeto se leen como una sola pieza.
// `espejo` da la mano izquierda. El antebrazo sale hacia abajo y gira con `brazo` respecto del mango.
// Se llama después de dibujar el mango y antes de pixelar.
function empunar(g, x, y, ang, espejo = false, brazo = 0) {
  g.save(); g.translate(x, y); g.rotate(ang);
  if (espejo) g.scale(-1, 1);
  g.save(); g.rotate(brazo); manga(g, -24, 20, 52, 0); g.restore();
  // dorso de la mano, detrás de los dedos
  g.fillStyle = radial(g, 12, 0, 2, 30, [[0, PIEL[2]], [0.55, PIEL[1]], [1, PIEL[0]]], -6, -6);
  g.beginPath(); g.roundRect(0, -20, 30, 42, 11); g.fill();
  // el mango asoma entre los dedos: sombra de contacto bajo cada nudillo
  g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(-12, -19, 6, 40);
  // cuatro dedos en fila cruzando el mango, cada uno un cilindro con su nudillo
  for (let i = 0; i < 4; i++) {
    const fy = -19 + i * 9.5, fx = -11 + (i % 2) * 1.5, largo = 36 - i * 1.5;
    g.fillStyle = lineal(g, 0, fy, 0, fy + 9.5, [[0, PIEL[2]], [0.4, PIEL[1]], [1, PIEL[0]]]);
    g.beginPath(); g.roundRect(fx, fy, largo, 9.5, 4.7); g.fill();
    g.fillStyle = 'rgba(60,25,8,.55)'; g.fillRect(fx + 6, fy + 1, 1, 8);      // pliegue de la falange
    g.fillStyle = PIEL_PLIEGUE; g.fillRect(fx + 3, fy + 9, largo - 7, 1);     // hueco entre dedos
    g.fillStyle = 'rgba(255,235,210,.5)'; g.fillRect(fx + largo - 11, fy + 2, 3, 2); // nudillo
  }
  // pulgar por encima del índice, apuntando hacia la yema de los dedos
  g.fillStyle = lineal(g, 0, -29, 0, -17, [[0, PIEL[2]], [0.5, PIEL[1]], [1, PIEL[0]]]);
  g.beginPath(); g.roundRect(-10, -29, 30, 11, 5.5); g.fill();
  g.fillStyle = '#e8c0a0'; g.fillRect(-8, -27, 5, 4);
  g.restore();
}

// ---------- Armas de fuego ----------
// Se dibujan de perfil, con la boca hacia la izquierda, y se giran para que apunten arriba hacia la mira:
// así se lee la silueta de cada una (el tambor redondo del revólver, los dos cañones, el cargador de tambor).

const E = 1.25;   // el perfil se dibuja a esta escala dentro de la hoja
// Gira un punto del dibujo de perfil (alrededor de `px`, `py`) a coordenadas de la hoja.
function girar(px, py, ang, x, y) {
  const co = Math.cos(ang), si = Math.sin(ang);
  x *= E; y *= E;
  return [px + x * co - y * si, py + x * si + y * co];
}
// Acero visto de lado: brillo arriba, sombra abajo.
const aceroLado = (g, y0, y1) => lineal(g, 0, y0, 0, y1, [[0, ACERO[1]], [0.18, ACERO[2]], [0.4, ACERO[1]], [1, ACERO[0]]]);
const maderaLado = (g, x0, y0, x1, y1) => lineal(g, x0, y0, x1, y1, [[0, NOGAL[2]], [0.35, NOGAL[1]], [1, NOGAL[0]]]);
// Cuadriculado de las cachas, recortado a la forma ya trazada en `g` (llamar justo después de forma()).
function cuadricula(g, x0, y0, x1, y1) {
  g.save(); g.clip();
  g.strokeStyle = 'rgba(0,0,0,.3)'; g.lineWidth = 0.8;
  for (let k = x0 - 60; k < x1 + 60; k += 3.5) {
    g.beginPath(); g.moveTo(k, y0); g.lineTo(k + (y1 - y0), y1); g.stroke();
    g.beginPath(); g.moveTo(k, y0); g.lineTo(k - (y1 - y0), y1); g.stroke();
  }
  g.restore();
}
// forma() sin rellenar: deja el trazo listo para recortar.
function trazo(g, puntos) { g.beginPath(); puntos.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); }
// Fogonazo en estrella en (x, y), con núcleo blanco.
function fogonazo(g, x, y, r, puntas = 14) {
  g.fillStyle = radial(g, x, y, 0, r * 1.2, [[0, 'rgba(255,255,230,1)'], [0.25, 'rgba(255,230,120,1)'], [0.6, 'rgba(255,140,30,.95)'], [1, 'rgba(255,90,10,0)']]);
  g.beginPath();
  for (let i = 0; i < puntas; i++) { const a = i / puntas * Math.PI * 2, rr = i % 2 ? r * 0.35 : r * (0.8 + (i % 4) * 0.12); g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  g.fill();
}

// ---------- Revólver ----------

function revolver(fuego) {
  const [c, g] = hoja();
  const PX = 120, PY = 64, ANG = 0.62;
  g.save(); g.translate(PX, PY); g.rotate(ANG); g.scale(E, E);
  // empuñadura de nogal, curva hacia atrás, con cuadriculado y medallón de latón
  const cacha = [[13, 12], [24, 11], [31, 24], [38, 42], [37, 50], [23, 52], [18, 36], [13, 22]];
  forma(g, cacha, maderaLado(g, 14, 12, 38, 46));
  trazo(g, cacha); cuadricula(g, 10, 14, 40, 52);
  g.fillStyle = 'rgba(255,210,150,.35)'; g.fillRect(16, 16, 2, 20);
  g.fillStyle = radial(g, 27, 33, 0, 3.4, [[0, '#ffe6a0'], [1, '#8a6a20']], -1, -1); g.beginPath(); g.arc(27, 33, 3, 0, Math.PI * 2); g.fill();
  // guardamonte y gatillo
  g.strokeStyle = lineal(g, 0, 14, 0, 30, [[0, ACERO[2]], [1, ACERO[0]]]); g.lineWidth = 3;
  g.beginPath(); g.moveTo(-4, 13); g.quadraticCurveTo(-5, 28, 7, 28); g.quadraticCurveTo(15, 28, 15, 15); g.stroke();
  forma(g, [[3, 13], [7, 13], [6, 21], [2, 24]], ACERO[1]);
  // cara delantera del tambor (vista de tres cuartos) con dos recámaras cargadas asomando bajo el cañón
  g.fillStyle = lineal(g, -16, 0, -8, 0, [[0, ACERO[0]], [1, ACERO[1]]]);
  g.beginPath(); g.ellipse(-12, 2, 4, 12, 0, 0, Math.PI * 2); g.fill();
  for (const ry of [6, 11]) {
    g.fillStyle = '#06070a'; g.beginPath(); g.ellipse(-13, ry, 1.8, 2.6, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = radial(g, -13, ry, 0, 2, [[0, '#f0b070'], [1, '#8a4a1a']], -0.6, -0.8); g.beginPath(); g.ellipse(-13, ry, 1.1, 1.7, 0, 0, Math.PI * 2); g.fill();
  }
  // tambor de lado: redondeado, con tres estrías a lo largo
  g.fillStyle = lineal(g, 0, -10, 0, 14, [[0, ACERO[0]], [0.15, ACERO[1]], [0.3, ACERO[2]], [0.5, ACERO[1]], [1, ACERO[0]]]);
  g.beginPath(); g.roundRect(-12, -10, 26, 24, 6); g.fill();
  for (const fy of [-4, 2, 8]) {
    g.fillStyle = 'rgba(0,0,0,.6)'; g.beginPath(); g.roundRect(-8, fy - 1.3, 18, 2.6, 1.3); g.fill();
    g.fillStyle = 'rgba(200,215,240,.35)'; g.fillRect(-7, fy + 1.4, 16, 1);
  }
  g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(-12, -8, 2, 20); g.fillRect(12, -8, 2, 20);
  // armazón: puente sobre el tambor y escudo trasero
  g.fillStyle = aceroLado(g, -14, -9); g.fillRect(-14, -14, 32, 5);
  forma(g, [[12, -14], [22, -14], [25, -4], [23, 14], [12, 14]], aceroLado(g, -14, 14));
  g.fillStyle = ACERO[0]; g.fillRect(15, -16, 3, 2);   // alza
  // martillo con espuela estriada
  forma(g, [[17, -13], [22, -13], [31, -22], [33, -19], [25, -9]], aceroLado(g, -22, -9));
  g.fillStyle = 'rgba(0,0,0,.6)'; for (let i = 0; i < 3; i++) g.fillRect(27 + i * 1.6, -20 + i * 1.4, 1, 3);
  // cañón largo con su costilla, varilla expulsora debajo y punto de mira
  g.fillStyle = aceroLado(g, -9, 0); g.fillRect(-60, -9, 50, 9);
  g.fillStyle = 'rgba(225,235,255,.55)'; g.fillRect(-60, -9, 50, 1.5);
  g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(-60, -2, 50, 2);
  cilindro(g, -46, 0, 34, 5, ACERO, false);
  g.fillStyle = ACERO[2]; g.fillRect(-48, 0, 3, 5);
  forma(g, [[-58, -9], [-53, -9], [-54, -14], [-57, -14]], aceroLado(g, -14, -9));
  g.fillStyle = ACERO[0]; g.fillRect(-61, -9, 2, 9);   // corona de la boca
  g.restore();
  // mano derecha en la empuñadura
  const [hx, hy] = girar(PX, PY, ANG, 26, 32);
  empunar(g, hx, hy, ANG - 0.42, false, -0.25);
  if (fuego) { const [fx, fy] = girar(PX, PY, ANG, -64, -5); fogonazo(g, fx, fy, 24, 16); }
  return pixelar(c);
}

// ---------- Escopeta de dos cañones ----------

function escopeta(fuego) {
  const [c, g] = hoja();
  const PX = 124, PY = 66, ANG = 0.62;
  g.save(); g.translate(PX, PY); g.rotate(ANG); g.scale(E, E);
  // culata de nogal con la garganta donde va la mano
  const culata = [[10, -9], [22, -6], [34, 10], [46, 32], [42, 44], [27, 42], [16, 18], [8, 8]];
  forma(g, culata, maderaLado(g, 10, -8, 44, 40));
  trazo(g, [[16, 2], [26, 0], [32, 14], [22, 20]]); cuadricula(g, 14, 0, 34, 22);
  g.fillStyle = 'rgba(255,210,150,.3)'; g.fillRect(12, -6, 12, 2);
  // guardamonte y dos gatillos
  g.strokeStyle = lineal(g, 0, 8, 0, 22, [[0, ACERO[2]], [1, ACERO[0]]]); g.lineWidth = 2.6;
  g.beginPath(); g.moveTo(-2, 7); g.quadraticCurveTo(-3, 20, 7, 20); g.quadraticCurveTo(13, 20, 13, 8); g.stroke();
  forma(g, [[2, 7], [5, 7], [4, 15], [1, 16]], ACERO[1]); forma(g, [[7, 7], [10, 7], [9, 15], [6, 16]], ACERO[0]);
  // báscula de acero templado (con vetas de color) y perno de la bisagra
  g.fillStyle = lineal(g, 0, -12, 0, 8, [[0, '#8a90a0'], [0.3, '#5a5068'], [0.6, '#3a3e4a'], [1, '#14161c']]);
  g.beginPath(); g.roundRect(-8, -12, 22, 20, 3); g.fill();
  g.fillStyle = 'rgba(200,170,110,.35)'; for (let i = 0; i < 6; i++) g.fillRect(-4 + i * 3, -6 + (i % 2) * 4, 1.5, 1.5);
  g.fillStyle = radial(g, -5, 4, 0, 3, [[0, ACERO[2]], [1, ACERO[0]]]); g.beginPath(); g.arc(-5, 4, 2.4, 0, Math.PI * 2); g.fill();
  // dos martillos, uno detrás del otro
  forma(g, [[8, -11], [12, -11], [19, -19], [20, -16], [14, -8]], ACERO[0]);
  forma(g, [[5, -11], [9, -11], [16, -20], [18, -17], [11, -8]], aceroLado(g, -20, -8));
  // guardamano de nogal bajo los cañones
  forma(g, [[-42, 2], [-8, 2], [-8, 10], [-38, 10], [-43, 7]], maderaLado(g, 0, 2, 0, 10));
  g.strokeStyle = 'rgba(0,0,0,.3)'; g.lineWidth = 0.8; for (let k = -36; k < -12; k += 3) { g.beginPath(); g.moveTo(k, 3); g.lineTo(k + 2, 9); g.stroke(); }
  // los dos cañones (de lado se ven uno sobre otro), con la costilla y la mira de bolita
  g.fillStyle = aceroLado(g, -12, -4); g.fillRect(-68, -12, 62, 8);
  g.fillStyle = aceroLado(g, -4, 3); g.fillRect(-68, -4, 62, 7);
  g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(-68, -4.6, 62, 1.4);
  g.fillStyle = 'rgba(225,235,255,.5)'; g.fillRect(-68, -12, 62, 1.4);
  g.fillStyle = ACERO[1]; g.fillRect(-68, -14, 62, 2);
  g.fillStyle = '#e8d8a0'; g.beginPath(); g.arc(-65, -15, 1.6, 0, Math.PI * 2); g.fill();
  g.fillStyle = ACERO[0]; g.fillRect(-70, -12, 2, 15);
  g.restore();
  const [hx, hy] = girar(PX, PY, ANG, 24, 12);
  empunar(g, hx, hy, ANG - 0.55, false, -0.05);
  if (fuego) for (const dy of [-8, 0]) { const [fx, fy] = girar(PX, PY, ANG, -72, dy); fogonazo(g, fx, fy, 22, 14); }
  return pixelar(c);
}

// ---------- Tommy gun ----------

function tommy(fuego) {
  const [c, g] = hoja();
  const PX = 126, PY = 66, ANG = 0.62;
  g.save(); g.translate(PX, PY); g.rotate(ANG); g.scale(E, E);
  // culata (sale de la hoja) y empuñadura de pistola
  forma(g, [[14, -9], [44, -4], [52, 8], [16, 4]], maderaLado(g, 0, -9, 0, 8));
  const puno = [[6, 3], [16, 3], [23, 26], [20, 30], [12, 30]];
  forma(g, puno, maderaLado(g, 6, 4, 22, 28));
  trazo(g, puno); cuadricula(g, 6, 4, 24, 30);
  // guardamonte
  g.strokeStyle = ACERO[1]; g.lineWidth = 2.4;
  g.beginPath(); g.moveTo(-6, 4); g.quadraticCurveTo(-7, 14, 0, 14); g.quadraticCurveTo(6, 14, 6, 5); g.stroke();
  forma(g, [[-3, 3], [0, 3], [-1, 10], [-4, 11]], ACERO[0]);
  // cajón de mecanismos, con la manija de carga y el alza
  g.fillStyle = aceroLado(g, -11, 4); g.beginPath(); g.roundRect(-30, -11, 46, 15, 2); g.fill();
  g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(-22, -6, 26, 1.5);
  g.fillStyle = radial(g, -8, -13, 0, 3.5, [[0, ACERO[2]], [1, ACERO[0]]], -1, -1); g.beginPath(); g.arc(-8, -13, 3, 0, Math.PI * 2); g.fill();
  g.fillStyle = ACERO[1]; g.fillRect(10, -15, 4, 4);
  // cargador de tambor redondo, con su aro, la llave del resorte y remaches
  g.fillStyle = radial(g, -10, 17, 2, 16, [[0, ACERO[2]], [0.5, ACERO[1]], [1, ACERO[0]]], -5, -6);
  g.beginPath(); g.arc(-10, 17, 15, 0, Math.PI * 2); g.fill();
  g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = 1.5; g.beginPath(); g.arc(-10, 17, 12, 0, Math.PI * 2); g.stroke();
  g.strokeStyle = 'rgba(210,220,240,.35)'; g.lineWidth = 1; g.beginPath(); g.arc(-10, 17, 13.5, Math.PI * 1.1, Math.PI * 1.6); g.stroke();
  g.fillStyle = ACERO[0]; g.beginPath(); g.arc(-10, 17, 4, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#cfae52'; g.fillRect(-12, 16, 4, 2);
  g.fillStyle = ACERO[2]; for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2 + 0.3; g.fillRect(-10 + Math.cos(a) * 9 - 0.7, 17 + Math.sin(a) * 9 - 0.7, 1.4, 1.4); }
  // empuñadura delantera de nogal con muescas para los dedos
  const delantera = [[-40, 0], [-30, 0], [-29, 20], [-32, 24], [-39, 24], [-41, 18]];
  forma(g, delantera, maderaLado(g, -42, 0, -29, 0));
  g.fillStyle = 'rgba(0,0,0,.35)'; for (const y of [7, 12, 17]) g.fillRect(-41, y, 4, 1.5);
  // cañón con aletas de enfriamiento y compensador ranurado
  g.fillStyle = aceroLado(g, -8, -1); g.fillRect(-62, -8, 32, 7);
  for (let x = -60; x < -32; x += 3) { g.fillStyle = aceroLado(g, -10, 1); g.fillRect(x, -10, 1.8, 11); g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(x + 1.8, -9, 1.2, 9); }
  g.fillStyle = aceroLado(g, -9, 0); g.beginPath(); g.roundRect(-74, -9, 12, 9, 1.5); g.fill();
  g.fillStyle = '#06070a'; for (const x of [-71, -68, -65]) g.fillRect(x, -9, 1.4, 3);
  g.fillStyle = '#e8d8a0'; g.fillRect(-72, -12, 2, 3);
  g.restore();
  const [hx, hy] = girar(PX, PY, ANG, 15, 16);
  empunar(g, hx, hy, ANG - 0.3, false, -0.1);
  if (fuego) { const [fx, fy] = girar(PX, PY, ANG, -78, -4); fogonazo(g, fx, fy, 18, 12); }
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
}
