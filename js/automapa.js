// Automapa: plano de lo explorado, como el de Doom. Solo se dibujan las casillas que ya viste.

const COLOR = {
  fondo: 'rgba(10, 7, 4, 0.86)',
  muro: '#e8b83a',
  suelo: '#3a2c1c',
  alto: '#6e5636',   // el suelo más alto se pinta más claro
  lava: '#c2410c',
  abismo: '#05070a',
  puerta: '#c27a3a',
  sello: '#ffd34d',
  tablilla: '#5fa8ff',
  salida: '#4fbf7f',
  tesoro: '#ffd34d',
  jugador: '#ff6a4a',
};

// Marca como vistas las casillas al alcance de la vista del jugador (rayos en todas direcciones).
export function explorar(juego, alcance = 9) {
  const m = juego.mapa, j = juego.j;
  if (!juego.vistas) juego.vistas = new Uint8Array(m.ancho * m.alto);
  const v = juego.vistas;
  const N = 72;
  for (let i = 0; i < N; i++) {
    const a = i / N * Math.PI * 2;
    const dx = Math.cos(a), dz = Math.sin(a);
    for (let d = 0; d <= alcance; d += 0.35) {
      const cx = Math.floor(j.x + dx * d), cz = Math.floor(j.z + dz * d);
      const c = m.celda(cx, cz);
      if (!c) break;
      v[cz * m.ancho + cx] = 1;
      if (m.solida(cx, cz)) break;
    }
  }
}

export function dibujarAutomapa(ctx, w, h, juego) {
  const m = juego.mapa, j = juego.j, v = juego.vistas;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = COLOR.fondo;
  ctx.fillRect(0, 0, w, h);
  if (!v) return;
  const margen = Math.min(w, h) * 0.06;
  const t = Math.floor(Math.min((w - margen * 2) / m.ancho, (h - margen * 2.6) / m.alto));
  const ox = Math.floor((w - t * m.ancho) / 2), oy = Math.floor((h - t * m.alto) / 2 + margen * 0.3);
  const visto = (x, y) => x >= 0 && y >= 0 && x < m.ancho && y < m.alto && v[y * m.ancho + x];
  const abierta = (x, y) => { const c = m.celda(x, y); return c && !m.solida(x, y) || c && c.tipo === 'puerta' || c && c.tipo === 'sello'; };

  // suelos (más claros cuanto más altos)
  let pmin = Infinity, pmax = -Infinity;
  for (const c of m.celdas) if (c.piso > -1) { pmin = Math.min(pmin, c.piso); pmax = Math.max(pmax, c.piso); }
  for (let y = 0; y < m.alto; y++) for (let x = 0; x < m.ancho; x++) {
    if (!visto(x, y) || !abierta(x, y)) continue;
    const c = m.celda(x, y);
    let col = COLOR.suelo;
    if (c.peligro === 'lava') col = COLOR.lava;
    else if (c.peligro === 'abismo') col = COLOR.abismo;
    else if (c.tipo === 'puerta') col = COLOR.puerta;
    else if (c.tipo === 'sello') col = c.abierto >= 1 ? COLOR.suelo : COLOR.sello;
    else if (pmax > pmin) col = mezclar(COLOR.suelo, COLOR.alto, (c.piso - pmin) / (pmax - pmin));
    ctx.fillStyle = col;
    ctx.fillRect(ox + x * t, oy + y * t, t, t);
  }
  // bordes: muros entre casilla abierta y sólida; líneas finas en los desniveles
  ctx.lineCap = 'square';
  for (let y = 0; y < m.alto; y++) for (let x = 0; x < m.ancho; x++) {
    if (!visto(x, y) || !abierta(x, y)) continue;
    const c = m.celda(x, y);
    for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
      const nx = x + dx, ny = y + dy, n = m.celda(nx, ny);
      let estilo = null, grosor = Math.max(1, t / 7);
      if (!n || !abierta(nx, ny)) {
        estilo = COLOR.muro;
        if (n && (n.tipo === 'tablilla' || n.tipo === 'aviso')) { estilo = COLOR.tablilla; grosor *= 2; }
        if (n && n.tipo === 'salida') { estilo = COLOR.salida; grosor *= 2.5; }
      } else if (Math.abs(n.piso - c.piso) > 0.01 && n.piso < c.piso) { estilo = 'rgba(232, 184, 58, 0.45)'; grosor = Math.max(1, t / 12); }
      if (!estilo) continue;
      ctx.strokeStyle = estilo; ctx.lineWidth = grosor;
      const x0 = ox + (dx === 1 ? x + 1 : x) * t, y0 = oy + (dy === 1 ? y + 1 : y) * t;
      ctx.beginPath();
      if (dx === 0) { ctx.moveTo(ox + x * t, y0); ctx.lineTo(ox + (x + 1) * t, y0); }
      else { ctx.moveTo(x0, oy + y * t); ctx.lineTo(x0, oy + (y + 1) * t); }
      ctx.stroke();
    }
  }
  // tesoros y objetos ya vistos
  for (const o of juego.objetos) {
    if (o.cogido || !visto(Math.floor(o.x), Math.floor(o.z))) continue;
    const px = ox + o.x * t, py = oy + o.z * t, r = Math.max(2, t * 0.22);
    ctx.fillStyle = o.tipo === 'tesoro' || o.tipo === 'falso' ? COLOR.tesoro : '#d8dde4';
    ctx.beginPath();
    ctx.moveTo(px, py - r); ctx.lineTo(px + r, py); ctx.lineTo(px, py + r); ctx.lineTo(px - r, py);
    ctx.fill();
  }
  // jugador
  const px = ox + j.x * t, py = oy + j.z * t, r = Math.max(5, t * 0.55);
  ctx.save();
  ctx.translate(px, py); ctx.rotate(j.yaw);
  ctx.fillStyle = COLOR.jugador; ctx.strokeStyle = '#120d08'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(r, 0); ctx.lineTo(-r * 0.6, r * 0.55); ctx.lineTo(-r * 0.3, 0); ctx.lineTo(-r * 0.6, -r * 0.55); ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.restore();
  // título
  ctx.fillStyle = '#f1e4c8';
  ctx.font = `${Math.max(13, Math.round(t * 0.7))}px Georgia, serif`;
  ctx.textAlign = 'center';
  ctx.fillText(juego.def.nombre, w / 2, Math.max(18, oy - t * 0.5));
}

function mezclar(a, b, k) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const c = s => Math.round(((pa >> s) & 255) * (1 - k) + ((pb >> s) & 255) * k);
  return `rgb(${c(16)}, ${c(8)}, ${c(0)})`;
}
