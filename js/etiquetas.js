// Rótulos flotantes sobre las tablillas y los sellos: se lee el nombre sin tener que apretar «Usar».
// La tablilla dice cómo se llama su acertijo y la puerta, qué tablilla la abre; las ya resueltas y las
// puertas ya abiertas quedan atenuadas (y la tablilla resuelta, agrietada), para saber qué abriste antes.
// Es una capa de HTML sobre el lienzo: proyecta cada casilla con la misma cámara que render.js.

import { ALTO_MURO } from './render.js';

const ALCANCE = 11;      // más lejos no se rotula
const ALCANCE_FADE = 8;  // desde aquí se va apagando

// Altura (px) de la franja de arriba ocupada por el HUD; una etiqueta cuya base cae por encima se oculta.
const ZONA_HUD = 130;

export class Etiquetas {
  constructor(contenedor, lienzo) {
    this.el = contenedor;
    this.lienzo = lienzo;
    this.items = [];
  }

  // Al empezar una partida: una etiqueta por cada tablilla y por cada sello del mapa.
  construir(mapa) {
    this.el.textContent = '';
    this.items = [];
    mapa.celdas.forEach((c, i) => {
      if (c.tipo !== 'tablilla' && c.tipo !== 'sello') return;
      const a = mapa.acertijos[c.acertijo];
      if (!a) return;
      const el = document.createElement('div');
      el.className = `etiqueta ${c.tipo}`;
      el.hidden = true;
      this.el.append(el);
      this.items.push({ c, a, el, x: (i % mapa.ancho) + 0.5, z: Math.floor(i / mapa.ancho) + 0.5, texto: '' });
    });
  }

  // Cada cuadro: coloca las etiquetas que se ven.
  actualizar(juego, cam) {
    const w = this.lienzo.clientWidth, h = this.lienzo.clientHeight;
    if (!w || !h || !this.items.length) return;
    const aspecto = this.lienzo.width / this.lienzo.height;
    const fovH = 80 * Math.PI / 180;
    let fovV = 2 * Math.atan(Math.tan(fovH / 2) / aspecto);
    fovV = Math.min(Math.max(fovV, 50 * Math.PI / 180), 95 * Math.PI / 180);
    const f = 1 / Math.tan(fovV / 2);
    const cp = Math.cos(cam.pitch);
    const fw = [Math.cos(cam.yaw) * cp, Math.sin(cam.pitch), Math.sin(cam.yaw) * cp];
    const sl = Math.hypot(fw[2], fw[0]);
    const s = [-fw[2] / sl, 0, fw[0] / sl];
    const u = [s[1] * fw[2] - s[2] * fw[1], s[2] * fw[0] - s[0] * fw[2], s[0] * fw[1] - s[1] * fw[0]];

    for (const it of this.items) {
      const { c, a, el } = it;
      const abierta = c.tipo === 'sello' ? c.abierto > 0.02 || c.abriendo : a.resuelto;
      // un sello ya abierto del todo se ve de lejos solo como marca: cuando se alza deja de haber pared
      const dx = it.x - cam.x, dz = it.z - cam.z, dist = Math.hypot(dx, dz);
      const arriba = c.piso + ALTO_MURO + 0.12;
      const rel = [dx, arriba - cam.y, dz];
      const prof = fw[0] * rel[0] + fw[1] * rel[1] + fw[2] * rel[2];
      let visible = dist < ALCANCE && prof > 0.25;
      let px = 0, py = 0;
      if (visible) {
        const xc = s[0] * rel[0] + s[2] * rel[2], yc = u[0] * rel[0] + u[1] * rel[1] + u[2] * rel[2];
        const nx = (f / aspecto) * xc / prof, ny = f * yc / prof;
        visible = Math.abs(nx) < 1.15 && ny > -1.1 && ny < 1.3;
        px = (nx + 1) / 2 * w; py = (1 - ny) / 2 * h;
        if (py < ZONA_HUD) visible = false;   // bajo los botones de arriba no se rotula: quedaría tapado por ellos
      }
      // que no se rotule a través de las paredes: el rayo hacia la casilla debe llegar a ella
      if (visible && dist > 0.8) {
        const r = juego.rayo(cam.x, cam.z, dx / dist, dz / dist, dist);
        visible = r.dist >= dist - 0.6 || (Math.floor(r.cx) === Math.floor(it.x) && Math.floor(r.cz) === Math.floor(it.z));
      }
      if (!visible) { if (!el.hidden) el.hidden = true; continue; }
      const texto = c.tipo === 'sello'
        ? `${abierta ? 'Abierto' : 'Sello'} · ${a.titulo}`
        : a.titulo;
      if (texto !== it.texto) {
        el.textContent = texto; it.texto = texto;
        el.classList.toggle('hecha', abierta);
      }
      el.hidden = false;
      el.style.transform = `translate(${px.toFixed(1)}px, ${py.toFixed(1)}px) translate(-50%, -100%)`;
      el.style.opacity = dist > ALCANCE_FADE ? ((ALCANCE - dist) / (ALCANCE - ALCANCE_FADE)).toFixed(2) : '1';
    }
  }
}
