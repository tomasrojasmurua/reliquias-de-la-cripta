// Convierte la definición de una mazmorra (datos/mazmorras.js) en casillas y objetos.

// tipo: muro | vacio | suelo | puerta | secreto | sello | tablilla | salida
const LEYENDA_BASE = {
  '#': { tipo: 'muro' },
  ' ': { tipo: 'vacio' },
  '.': { tipo: 'suelo' },
  'P': { tipo: 'suelo', inicio: true },
  'D': { tipo: 'puerta', tex: 'puerta' },
  'S': { tipo: 'secreto', tex: 'piedra_grieta' },
  'X': { tipo: 'salida', tex: 'salida' },
  '!': { tipo: 'muro', tex: 'antorcha', antorcha: true },
  'R': { tipo: 'suelo', objeto: 'revolver' },
  'b': { tipo: 'suelo', objeto: 'balas' },
  'v': { tipo: 'suelo', objeto: 'vendas' },
  'm': { tipo: 'suelo', enemigo: 'momia' },
  'k': { tipo: 'suelo', enemigo: 'esqueleto' },
};

const SOLIDOS_FIJOS = new Set(['muro', 'vacio', 'tablilla', 'salida']);
export const MOVILES = new Set(['puerta', 'secreto', 'sello']);

export function cargarMazmorra(def) {
  const alto = def.plano.length;
  const ancho = Math.max(...def.plano.map(f => f.length));
  const leyenda = { ...LEYENDA_BASE, ...(def.leyenda || {}) };
  const celdas = [];
  const objetos = [];
  const enemigos = [];
  let inicio = { x: 1.5, z: 1.5 };
  let totalSecretos = 0;
  const acertijos = {};

  for (const [car, a] of Object.entries(def.acertijos || {})) {
    acertijos[a.id] = { ...a, caracter: car, resuelto: false };
    leyenda[car] = { tipo: 'tablilla', tex: 'tablilla', acertijo: a.id };
    leyenda[a.sello] = { tipo: 'sello', tex: 'sello', acertijo: a.id };
  }

  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      const car = def.plano[y][x] ?? ' ';
      let l = leyenda[car];
      if (!l && /[0-9]/.test(car)) l = { tipo: 'suelo', tesoro: def.tesoros[car] };
      if (!l) throw new Error(`Carácter desconocido «${car}» en ${def.id} (${x}, ${y})`);
      const c = {
        tipo: l.tipo,
        tex: l.tex || (l.tipo === 'suelo' ? null : def.muro),
        suelo: def.suelo, techo: def.techo,
        luz: def.luz,
        abierto: 0, abriendo: false,
        acertijo: l.acertijo || null,
        antorcha: !!l.antorcha,
      };
      if (l.tipo === 'puerta' || l.tipo === 'sello') c.tex = l.tex;
      if (l.tipo === 'secreto') totalSecretos++;
      celdas.push(c);
      const cx = x + 0.5, cz = y + 0.5;
      if (l.inicio) inicio = { x: cx, z: cz };
      if (l.objeto) objetos.push({ tipo: l.objeto, x: cx, z: cz });
      if (l.tesoro) objetos.push({ tipo: 'tesoro', tesoro: l.tesoro, x: cx, z: cz });
      if (l.enemigo) enemigos.push({ tipo: l.enemigo, x: cx, z: cz });
    }
  }

  const mapa = {
    def, ancho, alto, celdas, objetos, enemigos, inicio, acertijos, totalSecretos,
    celda(x, y) {
      if (x < 0 || y < 0 || x >= ancho || y >= alto) return null;
      return celdas[y * ancho + x];
    },
    // ¿Bloquea el paso (y la vista)?
    solida(x, y) {
      const c = this.celda(x, y);
      if (!c) return true;
      if (SOLIDOS_FIJOS.has(c.tipo)) return true;
      if (MOVILES.has(c.tipo)) return c.abierto < 0.9;
      return false;
    },
    // ¿Es parte fija de la geometría (no se mueve nunca)?
    fija(x, y) {
      const c = this.celda(x, y);
      return !c || SOLIDOS_FIJOS.has(c.tipo);
    },
  };

  // Luces por zona y resplandor de antorchas.
  for (const [x0, y0, x1, y1, luz] of def.luces || []) {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const c = mapa.celda(x, y); if (c) c.luz = luz; }
  }
  for (let y = 0; y < alto; y++) for (let x = 0; x < ancho; x++) {
    if (!mapa.celda(x, y).antorcha) continue;
    for (let j = -3; j <= 3; j++) for (let i = -3; i <= 3; i++) {
      const c = mapa.celda(x + i, y + j);
      if (!c) continue;
      const d = Math.hypot(i, j);
      c.luz = Math.min(1, c.luz + Math.max(0, 0.35 * (1 - d / 3.5)));
    }
  }
  return mapa;
}
