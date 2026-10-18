// Laberinto que cambia en cada partida: túneles con bifurcaciones y callejones sin salida,
// salas con hordas o vacías, trampas, y unos pocos tesoros escondidos en los ramales más hondos.
// Se pega a un lado del plano fijo de la mazmorra (ver `laberinto` en datos/mazmorras.js).

const ENEMIGOS = 'mkgpjcn';
const V = [[0, -1], [1, 0], [0, 1], [-1, 0]];

// Devuelve una copia de la definición con el laberinto añadido al plano.
export function conLaberinto(def, azar = Math.random) {
  const L = def.laberinto;
  // impares: las casillas del laberinto van en coordenadas impares
  let W = L.ancho | 1, H = L.alto | 1;
  if (L.lado === 'abajo' && W > def.plano[0].length) W -= 2;
  const g = Array.from({ length: H }, () => Array(W).fill('#'));
  const alt = Array.from({ length: H }, () => Array(W).fill('.'));
  const dentro = (x, y) => x > 0 && y > 0 && x < W - 1 && y < H - 1;
  const elegir = a => a[Math.floor(azar() * a.length)];
  const mezclar = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(azar() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  // Entrada: la casilla del borde del laberinto que toca la puerta del plano fijo.
  const abajo = L.lado === 'abajo';
  const [px, py] = L.puerta;
  let ex = abajo ? px : 0, ey = abajo ? 0 : py;
  const impar = n => Math.min(Math.max(n | 1, 1), (abajo ? W : H) - 2);
  const ix = abajo ? impar(ex) : 1, iy = abajo ? 1 : impar(ey);
  g[ey][ex] = '.';
  // pasillo de la puerta a la primera casilla del laberinto
  for (let x = Math.min(ex, ix); x <= Math.max(ex, ix); x++) g[abajo ? 1 : ey][x] = '.';
  for (let y = Math.min(ey, iy); y <= Math.max(ey, iy); y++) g[y][abajo ? ix : 1] = '.';
  if (!abajo) for (let x = 0; x <= 1; x++) g[ey][x] = '.';

  // 1. Túneles: backtracker recursivo, que deja muchos callejones sin salida.
  const visto = new Set([ix + ',' + iy]);
  const pila = [[ix, iy]];
  g[iy][ix] = '.';
  while (pila.length) {
    const [x, y] = pila[pila.length - 1];
    const opciones = mezclar(V.slice()).filter(([dx, dy]) => dentro(x + dx * 2, y + dy * 2) && !visto.has((x + dx * 2) + ',' + (y + dy * 2)));
    if (!opciones.length) { pila.pop(); continue; }
    const [dx, dy] = opciones[0];
    g[y + dy][x + dx] = '.'; g[y + dy * 2][x + dx * 2] = '.';
    visto.add((x + dx * 2) + ',' + (y + dy * 2));
    pila.push([x + dx * 2, y + dy * 2]);
  }

  // 2. Salas en medio de los túneles (cortan los pasillos que cruzan).
  const salas = [];
  const nSalas = L.salas ?? Math.round(W * H / 110);
  for (let k = 0, intentos = 0; k < nSalas && intentos < 200; intentos++) {
    const w = elegir([3, 3, 5, 5, 7]), h = elegir([3, 3, 5]);
    const x0 = 1 + 2 * Math.floor(azar() * ((W - 1 - w) / 2)), y0 = 1 + 2 * Math.floor(azar() * ((H - 1 - h) / 2));
    if (x0 + w > W - 1 || y0 + h > H - 1) continue;
    if (Math.abs(x0 - ix) + Math.abs(y0 - iy) < 6) continue; // la entrada queda libre
    if (salas.some(s => x0 < s.x1 + 2 && s.x0 < x0 + w + 2 && y0 < s.y1 + 2 && s.y0 < y0 + h + 2)) continue;
    const s = { x0, y0, x1: x0 + w - 1, y1: y0 + h - 1 };
    for (let y = s.y0; y <= s.y1; y++) for (let x = s.x0; x <= s.x1; x++) g[y][x] = '.';
    // algunas salas están un escalón más arriba o más abajo
    const nivel = elegir(['.', '.', 'a', '1']);
    for (let y = s.y0; y <= s.y1; y++) for (let x = s.x0; x <= s.x1; x++) alt[y][x] = nivel;
    salas.push(s); k++;
  }

  // 3. Algunos atajos: se tumba la pared de un tercio de los callejones (quedan muchos).
  const abiertos = (x, y) => V.filter(([dx, dy]) => g[y + dy]?.[x + dx] !== '#' && g[y + dy]?.[x + dx] !== undefined).length;
  const callejones = () => {
    const r = [];
    for (let y = 1; y < H - 1; y += 2) for (let x = 1; x < W - 1; x += 2) if (g[y][x] === '.' && abiertos(x, y) === 1 && !(x === ix && y === iy)) r.push([x, y]);
    return r;
  };
  for (const [x, y] of callejones()) {
    if (azar() > 0.3) continue;
    const muros = V.filter(([dx, dy]) => g[y + dy][x + dx] === '#' && dentro(x + dx * 2, y + dy * 2) && g[y + dy * 2][x + dx * 2] === '.');
    if (muros.length) { const [dx, dy] = elegir(muros); g[y + dy][x + dx] = '.'; }
  }

  // Una sala puede caer sobre casillas macizas y quedar aislada: se le abre un paso.
  for (let vuelta = 0; vuelta < 50; vuelta++) {
    const llega = new Set([ix + ',' + iy]);
    const q = [[ix, iy]];
    while (q.length) {
      const [x, y] = q.pop();
      for (const [dx, dy] of V) { const k = (x + dx) + ',' + (y + dy); if (dentro(x + dx, y + dy) && g[y + dy][x + dx] !== '#' && !llega.has(k)) { llega.add(k); q.push([x + dx, y + dy]); } }
    }
    let unido = true;
    busca: for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      if (g[y][x] === '#' || llega.has(x + ',' + y)) continue;
      unido = false;
      for (const [dx, dy] of V) if (dentro(x + dx * 2, y + dy * 2) && g[y + dy][x + dx] === '#' && llega.has((x + dx * 2) + ',' + (y + dy * 2))) { g[y + dy][x + dx] = '.'; break busca; }
    }
    if (unido) break;
  }

  // Distancia desde la entrada (para esconder los tesoros en lo más hondo).
  const dist = new Map([[ix + ',' + iy, 0]]);
  const cola = [[ix, iy]];
  while (cola.length) {
    const [x, y] = cola.shift();
    for (const [dx, dy] of V) {
      const nx = x + dx, ny = y + dy, k = nx + ',' + ny;
      if (dentro(nx, ny) && g[ny][nx] !== '#' && !dist.has(k)) { dist.set(k, dist.get(x + ',' + y) + 1); cola.push([nx, ny]); }
    }
  }
  const d = (x, y) => dist.get(x + ',' + y) ?? 0;
  const enSala = (x, y) => salas.some(s => x >= s.x0 && x <= s.x1 && y >= s.y0 && y <= s.y1);

  // 4. Contenido de los callejones: tesoros al fondo, alguno tras un muro con grieta; balas, vendas, emboscadas o nada.
  const tipos = [...new Set(def.plano.join('').split('').filter(c => ENEMIGOS.includes(c)))];
  const enemigo = () => elegir(tipos.length ? tipos : ['k']);
  const finales = callejones().filter(([x, y]) => !enSala(x, y)).sort((a, b) => d(...b) - d(...a));
  const tesoros = { ...def.tesoros };
  const libres = '0123456789'.split('').filter(c => !(c in tesoros));
  const hondos = finales.slice(0, Math.max(L.tesoros.length + 1, Math.ceil(finales.length * 0.4)));
  mezclar(hondos);
  for (const id of L.tesoros) {
    const c = libres.shift();
    tesoros[c] = id;
    let pos = hondos.shift() || finales.pop();
    if (!pos) { // casi sin callejones: la casilla de pasillo más lejana
      let mejor = null;
      for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) if (g[y][x] === '.' && !enSala(x, y) && (!mejor || d(x, y) > d(...mejor))) mejor = [x, y];
      pos = mejor;
    }
    if (finales.includes(pos)) finales.splice(finales.indexOf(pos), 1);
    const [x, y] = pos;
    // la mitad de las veces el callejón se tapia con un muro agrietado: un nicho secreto
    g[y][x] = c;
    const [dx, dy] = V.find(([dx, dy]) => g[y + dy][x + dx] === '.') || [0, 0];
    if (azar() < 0.5 && (dx || dy) && !enSala(x + dx, y + dy)) g[y + dy][x + dx] = 'S';
  }
  for (const [x, y] of finales) {
    const r = azar();
    if (r < 0.2) g[y][x] = 'b';
    else if (r < 0.3) g[y][x] = 'v';
    else if (r < 0.5) g[y][x] = enemigo(); // algo espera al fondo del callejón
    // el resto: nada
  }

  // 5. Salas: hordas, alguna con provisiones, otras vacías.
  for (const s of salas) {
    const casillas = [];
    for (let y = s.y0; y <= s.y1; y++) for (let x = s.x0; x <= s.x1; x++) if (g[y][x] === '.') casillas.push([x, y]);
    mezclar(casillas);
    const r = azar();
    const n = r < 0.55 ? 2 + Math.floor(azar() * 3) : r < 0.75 ? 1 : 0;
    for (let i = 0; i < n && casillas.length; i++) { const [x, y] = casillas.pop(); g[y][x] = enemigo(); }
    if (azar() < 0.35 && casillas.length) { const [x, y] = casillas.pop(); g[y][x] = azar() < 0.6 ? 'b' : 'v'; }
    // antorcha en una pared de la sala
    if (azar() < 0.6) {
      const muros = [];
      for (let x = s.x0; x <= s.x1; x++) { muros.push([x, s.y0 - 1]); muros.push([x, s.y1 + 1]); }
      for (let y = s.y0; y <= s.y1; y++) { muros.push([s.x0 - 1, y]); muros.push([s.x1 + 1, y]); }
      const ok = muros.filter(([x, y]) => dentro(x, y) && g[y][x] === '#');
      if (ok.length) { const [x, y] = elegir(ok); g[y][x] = '!'; }
    }
  }

  // 6. Trampas de pinchos en algunos pasillos rectos.
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    if (g[y][x] !== '.' || enSala(x, y) || d(x, y) < 4 || azar() > 0.03) continue;
    const recto = (g[y][x - 1] === '#' && g[y][x + 1] === '#') || (g[y - 1][x] === '#' && g[y + 1][x] === '#');
    if (recto) g[y][x] = '^';
  }

  // 7. Pegar el laberinto al plano fijo.
  const filas = g.map(r => r.join('')), filasAlt = alt.map(r => r.join(''));
  const base = def.plano.map(f => f.split(''));
  base[py][px] = 'D';
  const anchoBase = def.plano[0].length, altoBase = def.plano.length;
  const altBase = def.alturas || def.plano.map(f => '.'.repeat(f.length));
  let plano, alturas, rect;
  if (abajo) {
    plano = [...base.map(f => f.join('')), ...filas.map(f => f.padEnd(anchoBase, '#'))];
    alturas = [...altBase, ...filasAlt.map(f => f.padEnd(anchoBase, '.'))];
    rect = [0, altoBase, W - 1, altoBase + H - 1];
  } else {
    plano = base.map((f, y) => f.join('') + (filas[y] ?? '#'.repeat(W)));
    alturas = altBase.map((f, y) => f + (filasAlt[y] ?? '.'.repeat(W)));
    for (let y = altoBase; y < H; y++) { plano.push('#'.repeat(anchoBase) + filas[y]); alturas.push('.'.repeat(anchoBase) + filasAlt[y]); }
    rect = [anchoBase, 0, anchoBase + W - 1, H - 1];
  }
  const luz = L.luz ?? def.luz * 0.75;
  return {
    ...def, plano, alturas, tesoros,
    luces: [[...rect, luz], ...(def.luces || [])],
    zonas: [...(def.zonas || []), ...(L.zona ? [[...rect, L.zona]] : [])],
    regionLaberinto: rect,
  };
}
