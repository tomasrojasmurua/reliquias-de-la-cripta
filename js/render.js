// Motor de render WebGL: la mazmorra es una rejilla convertida en geometría 3D real
// (muros, suelo y techo), con sprites que miran siempre a la cámara, como en Doom.
// Texturas pixel art con filtro «nearest» a resolución nativa: el aspecto de Doom, más nítido.

import { casilla, COLS, FILAS } from './texturas.js';
import { MOVILES } from './mapa.js';

export const ALTO_MURO = 1.25;
const FLOTANTES = 8; // x y z, u v, col fila, luz

const VS = `
attribute vec3 aPos; attribute vec2 aUV; attribute vec2 aTile; attribute float aLuz;
uniform mat4 uMVP;
varying vec2 vUV; varying vec2 vTile; varying float vLuz; varying vec3 vPos;
void main() {
  vUV = aUV; vTile = aTile; vLuz = aLuz; vPos = aPos;
  gl_Position = uMVP * vec4(aPos, 1.0);
}`;

const FS = `
precision mediump float;
uniform sampler2D uTex; uniform vec2 uCasilla; uniform vec3 uOjo;
uniform float uLinterna; uniform float uFogonazo; uniform float uBandas; uniform vec3 uTinte;
varying vec2 vUV; varying vec2 vTile; varying float vLuz; varying vec3 vPos;
void main() {
  vec2 uv = clamp(vUV, 0.5 / 64.0, 1.0 - 0.5 / 64.0);
  vec4 c = texture2D(uTex, (vTile + uv) * uCasilla);
  if (c.a < 0.5) discard;
  float d = distance(vPos, uOjo);
  float emisivo = step(1.01, vLuz);
  float sector = min(vLuz, 1.0) * (1.0 - clamp(d / 16.0, 0.0, 0.8));
  float lin = uLinterna * clamp(1.0 - d / 6.0, 0.0, 1.0);
  float luz = sector + lin * lin * 0.75 + uFogonazo * clamp(1.0 - d / 9.0, 0.0, 1.0);
  luz = mix(luz, 1.15, emisivo);
  if (uBandas > 0.5) luz = floor(luz * 20.0 + 0.5) / 20.0;
  gl_FragColor = vec4(c.rgb * clamp(luz, 0.04, 1.4) * mix(uTinte, vec3(1.0), emisivo), 1.0);
}`;

function compilar(gl, tipo, src) {
  const s = gl.createShader(tipo);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
  return s;
}

// Añade un rectángulo vertical o tumbado: p0 abajo-izq, p1 abajo-der, p2 arriba-der, p3 arriba-izq.
function quad(arr, p0, p1, p2, p3, tile, luz, v0 = 1, v1 = 0) {
  const vs = [[p0, 0, v0], [p1, 1, v0], [p2, 1, v1], [p0, 0, v0], [p2, 1, v1], [p3, 0, v1]];
  for (const [p, u, v] of vs) arr.push(p[0], p[1], p[2], u, v, tile[0], tile[1], luz);
}

// Caras de un bloque (x, y) hacia las casillas abiertas vecinas. y0/y1: altura del bloque.
function carasBloque(arr, mapa, x, y, tile, y0, y1, esVecinoAbierto) {
  const vecinos = [
    [0, -1, [x + 1, y], [x, y]],         // norte
    [0, 1, [x, y + 1], [x + 1, y + 1]],  // sur
    [-1, 0, [x, y], [x, y + 1]],         // oeste
    [1, 0, [x + 1, y + 1], [x + 1, y]],  // este
  ];
  for (const [dx, dy, a, b] of vecinos) {
    if (!esVecinoAbierto(x + dx, y + dy)) continue;
    const v = mapa.celda(x + dx, y + dy);
    const luz = Math.min(1, v.luz * (dx !== 0 ? 1.08 : 0.94)); // contraste falso como en Doom
    const vTop = (y1 - y0) / ALTO_MURO;
    quad(arr, [a[0], y0, a[1]], [b[0], y0, b[1]], [b[0], y1, b[1]], [a[0], y1, a[1]], tile, luz, vTop, 0);
  }
}

const VECINOS = [[0, -1], [0, 1], [-1, 0], [1, 0]];

// Cara de la casilla (x, y) que mira a su vecina (x + dx, y + dy), entre las alturas y0 e y1.
function cara(arr, x, y, dx, dy, tile, y0, y1, luz) {
  let a, b;
  if (dy === -1) { a = [x + 1, y]; b = [x, y]; }
  else if (dy === 1) { a = [x, y + 1]; b = [x + 1, y + 1]; }
  else if (dx === -1) { a = [x, y]; b = [x, y + 1]; }
  else { a = [x + 1, y + 1]; b = [x + 1, y]; }
  const vTop = (y1 - y0) / ALTO_MURO;
  quad(arr, [a[0], y0, a[1]], [b[0], y0, b[1]], [b[0], y1, b[1]], [a[0], y1, a[1]], tile, luz, vTop, 0);
}

function luzCara(v, dx) { return Math.min(1, v.luz * (dx !== 0 ? 1.08 : 0.94)); } // contraste falso como en Doom

// Divide [y0, y1] en tramos de ALTO_MURO (desde abajo, o desde arriba si desdeArriba).
function tramos(y0, y1, fn, desdeArriba = false) {
  const n = Math.max(1, Math.ceil((y1 - y0) / ALTO_MURO - 1e-6));
  for (let k = 0; k < n; k++) {
    if (desdeArriba) fn(Math.max(y0, y1 - (k + 1) * ALTO_MURO), y1 - k * ALTO_MURO, k, n);
    else fn(y0 + k * ALTO_MURO, Math.min(y1, y0 + (k + 1) * ALTO_MURO), k, n);
  }
}

export class Render {
  constructor(canvas) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'high-performance' });
    if (!gl) throw new Error('Tu navegador no tiene WebGL.');
    this.gl = gl;
    const p = gl.createProgram();
    gl.attachShader(p, compilar(gl, gl.VERTEX_SHADER, VS));
    gl.attachShader(p, compilar(gl, gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    this.prog = p;
    gl.useProgram(p);
    this.loc = {
      aPos: gl.getAttribLocation(p, 'aPos'), aUV: gl.getAttribLocation(p, 'aUV'),
      aTile: gl.getAttribLocation(p, 'aTile'), aLuz: gl.getAttribLocation(p, 'aLuz'),
      uMVP: gl.getUniformLocation(p, 'uMVP'), uTex: gl.getUniformLocation(p, 'uTex'),
      uCasilla: gl.getUniformLocation(p, 'uCasilla'), uOjo: gl.getUniformLocation(p, 'uOjo'),
      uLinterna: gl.getUniformLocation(p, 'uLinterna'), uFogonazo: gl.getUniformLocation(p, 'uFogonazo'),
      uBandas: gl.getUniformLocation(p, 'uBandas'), uTinte: gl.getUniformLocation(p, 'uTinte'),
    };
    this.bufFijo = gl.createBuffer();
    this.bufDin = gl.createBuffer();
    this.nFijo = 0;
    gl.enable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.clearColor(0, 0, 0, 1);
    this.bandas = true;
  }

  ponerAtlas(atlas) {
    const gl = this.gl;
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.uniform1i(this.loc.uTex, 0);
    gl.uniform2f(this.loc.uCasilla, 1 / COLS, 1 / FILAS);
  }

  // Geometría que no cambia: muros, suelos, techos y desniveles.
  // Cada casilla abierta tiene su piso (c.piso) y su techo (c.techoY); los muros cubren
  // desde el piso hasta el techo de la casilla que los mira, en tramos de ALTO_MURO.
  construir(mapa) {
    const arr = [];
    const abierta = (x, y) => !mapa.fija(x, y);
    const muroBase = casilla(mapa.def.muro);
    for (let y = 0; y < mapa.alto; y++) for (let x = 0; x < mapa.ancho; x++) {
      const c = mapa.celda(x, y);
      if (c.tipo === 'vacio') continue;
      if (mapa.fija(x, y)) {
        // la textura especial (tablilla, salida, antorcha...) solo va en el primer tramo
        const especial = c.tipo !== 'muro' || c.antorcha;
        const texArriba = especial ? muroBase : casilla(c.tex);
        for (const [dx, dy] of VECINOS) {
          const v = mapa.celda(x + dx, y + dy);
          if (!v || !abierta(x + dx, y + dy)) continue;
          tramos(v.piso, v.techoY, (y0, y1, k) => {
            const antes = arr.length;
            cara(arr, x, y, dx, dy, k === 0 ? casilla(c.tex) : texArriba, y0, y1, luzCara(v, dx));
            if (c.tipo === 'salida' && k === 0) for (let i = antes; i < arr.length; i += FLOTANTES) arr[i + 7] = 1.2;
          });
        }
        continue;
      }
      // casilla abierta o móvil: suelo, techo y desniveles con sus vecinas
      const ts = casilla(c.suelo), tt = casilla(c.techo);
      const ys = c.piso, yt = c.techoY;
      const hondo = c.piso < -1;
      quad(arr, [x, ys, y + 1], [x + 1, ys, y + 1], [x + 1, ys, y], [x, ys, y], ts, hondo ? 0.25 : c.luz);
      quad(arr, [x, yt, y], [x + 1, yt, y], [x + 1, yt, y + 1], [x, yt, y + 1], tt, Math.min(c.luz, 1) * 0.85);
      const texDesnivel = casilla(c.muroDesnivel || mapa.def.muro);
      for (const [dx, dy] of VECINOS) {
        const v = mapa.celda(x + dx, y + dy);
        if (!v || !abierta(x + dx, y + dy)) continue;
        // escalón o pared de foso hacia la vecina más baja (los puentes ocultos no muestran su borde)
        if (v.piso < c.piso && c.suelo !== 'abismo_puente') {
          tramos(v.piso, c.piso, (y0, y1, k, n) => {
            const luz = v.piso < -1 ? 0.3 / (n - k) : luzCara(v, dx) * 0.85;
            cara(arr, x, y, dx, dy, texDesnivel, y0, y1, luz);
          }, true);
        }
        // pared superior hacia la vecina con techo más alto
        if (v.techoY > c.techoY) tramos(c.techoY, v.techoY, (y0, y1) => cara(arr, x, y, dx, dy, texDesnivel, y0, y1, luzCara(v, dx) * 0.8));
      }
    }
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.bufFijo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(arr), gl.STATIC_DRAW);
    this.nFijo = arr.length / FLOTANTES;
    this.mapa = mapa;
    this.tinte = mapa.def.tinte || [1, 1, 1];
  }

  ajustarTamano(escala) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(this.canvas.clientWidth * dpr * escala));
    const h = Math.max(1, Math.round(this.canvas.clientHeight * dpr * escala));
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
  }

  atributos() {
    const gl = this.gl, L = this.loc, s = FLOTANTES * 4;
    gl.enableVertexAttribArray(L.aPos); gl.vertexAttribPointer(L.aPos, 3, gl.FLOAT, false, s, 0);
    gl.enableVertexAttribArray(L.aUV); gl.vertexAttribPointer(L.aUV, 2, gl.FLOAT, false, s, 12);
    gl.enableVertexAttribArray(L.aTile); gl.vertexAttribPointer(L.aTile, 2, gl.FLOAT, false, s, 20);
    gl.enableVertexAttribArray(L.aLuz); gl.vertexAttribPointer(L.aLuz, 1, gl.FLOAT, false, s, 28);
  }

  // cam: {x, y, z, yaw, pitch}; sprites: [{x, z, ancho, alto, tex, espejo, luz}]
  dibujar(cam, sprites, efectos) {
    const gl = this.gl, mapa = this.mapa;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    const aspecto = this.canvas.width / this.canvas.height;
    const fovH = 80 * Math.PI / 180;
    let fovV = 2 * Math.atan(Math.tan(fovH / 2) / aspecto);
    fovV = Math.min(Math.max(fovV, 50 * Math.PI / 180), 95 * Math.PI / 180);
    const mvp = multiplicar(perspectiva(fovV, aspecto, 0.05, 80), vista(cam));
    gl.uniformMatrix4fv(this.loc.uMVP, false, mvp);
    gl.uniform3f(this.loc.uOjo, cam.x, cam.y, cam.z);
    gl.uniform1f(this.loc.uLinterna, efectos.linterna);
    gl.uniform1f(this.loc.uFogonazo, efectos.fogonazo);
    gl.uniform1f(this.loc.uBandas, this.bandas ? 1 : 0);
    gl.uniform3fv(this.loc.uTinte, this.tinte);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.bufFijo);
    this.atributos();
    gl.drawArrays(gl.TRIANGLES, 0, this.nFijo);

    // Puertas, sellos y pasadizos (se mueven) + sprites.
    const arr = [];
    const abierto = (x, y) => !mapa.fija(x, y) && !(MOVILES.has(mapa.celda(x, y).tipo) && mapa.celda(x, y).abierto < 0.02);
    for (let y = 0; y < mapa.alto; y++) for (let x = 0; x < mapa.ancho; x++) {
      const c = mapa.celda(x, y);
      if (!MOVILES.has(c.tipo) || c.abierto >= 1) continue;
      // puertas y sellos suben; los pasadizos secretos se hunden en el suelo
      const d = c.piso + (c.tipo === 'secreto' ? -c.abierto * ALTO_MURO : c.abierto * ALTO_MURO);
      carasBloque(arr, mapa, x, y, casilla(c.tex), d, d + ALTO_MURO, abierto);
    }
    const rx = -Math.sin(cam.yaw), rz = Math.cos(cam.yaw);
    for (const s of sprites) {
      const t = casilla(s.tex);
      const hx = rx * s.ancho / 2, hz = rz * s.ancho / 2;
      const y0 = s.y || 0;
      const p0 = [s.x - hx, y0, s.z - hz], p1 = [s.x + hx, y0, s.z + hz];
      const p2 = [s.x + hx, y0 + s.alto, s.z + hz], p3 = [s.x - hx, y0 + s.alto, s.z - hz];
      if (s.espejo) quad(arr, p1, p0, p3, p2, t, s.luz);
      else quad(arr, p0, p1, p2, p3, t, s.luz);
    }
    if (arr.length) {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.bufDin);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(arr), gl.DYNAMIC_DRAW);
      this.atributos();
      gl.drawArrays(gl.TRIANGLES, 0, arr.length / FLOTANTES);
    }
  }
}

// ---------- Matrices (column-major, como espera WebGL) ----------

function perspectiva(fovy, aspecto, cerca, lejos) {
  const f = 1 / Math.tan(fovy / 2), nf = 1 / (cerca - lejos);
  return new Float32Array([f / aspecto, 0, 0, 0, 0, f, 0, 0, 0, 0, (lejos + cerca) * nf, -1, 0, 0, 2 * lejos * cerca * nf, 0]);
}

function vista(c) {
  const cp = Math.cos(c.pitch);
  const f = [Math.cos(c.yaw) * cp, Math.sin(c.pitch), Math.sin(c.yaw) * cp];
  let s = [f[1] * 0 - f[2] * 1, f[2] * 0 - f[0] * 0, f[0] * 1 - f[1] * 0]; // f x arriba
  const ls = Math.hypot(...s); s = s.map(v => v / ls);
  const u = [s[1] * f[2] - s[2] * f[1], s[2] * f[0] - s[0] * f[2], s[0] * f[1] - s[1] * f[0]];
  const e = [c.x, c.y, c.z];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  return new Float32Array([
    s[0], u[0], -f[0], 0,
    s[1], u[1], -f[1], 0,
    s[2], u[2], -f[2], 0,
    -dot(s, e), -dot(u, e), dot(f, e), 1,
  ]);
}

function multiplicar(a, b) {
  const o = new Float32Array(16);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
    let s = 0;
    for (let k = 0; k < 4; k++) s += a[k * 4 + j] * b[i * 4 + k];
    o[i * 4 + j] = s;
  }
  return o;
}
