// Automapa: plano de lo explorado, como el de Doom. Solo se dibujan las casillas que ya viste.

const COLOR = {
  fondo: 'rgba(10, 7, 4, 0.86)',
  muro: '#e8b83a',
  suelo: '#3a2c1c',
  completa: '#2a3a24',  // suelo de una zona con todas sus reliquias
  alto: '#6e5636',   // el suelo más alto se pinta más claro
  lava: '#c2410c',
  abismo: '#05070a',
  puerta: '#c27a3a',
  abierta: '#7fe0a0',   // puerta o sello ya abierto
  sello: '#ffd34d',
  tablilla: '#5fa8ff',
  salida: '#4fbf7f',
  tesoro: '#ffd34d',
  jugador: '#ff6a4a',
};
const COLOR_CAZADOR = { rojo: '#d23a2e', azul: '#2f66d8', verde: '#33a852', amarillo: '#e6b91f' };

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
  // un sello abierto deja de avisarse en cuanto lo ves
  if (juego.sellosNuevos) for (const i of juego.sellosNuevos) if (v[i]) juego.sellosNuevos.delete(i);
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

  const completa = i => juego.zonas?.[i] && juego.zonas[i].halladas === juego.zonas[i].total;
  // suelos (más claros cuanto más altos)
  let pmin = Infinity, pmax = -Infinity;
  for (const c of m.celdas) if (c.piso > -1) { pmin = Math.min(pmin, c.piso); pmax = Math.max(pmax, c.piso); }
  for (let y = 0; y < m.alto; y++) for (let x = 0; x < m.ancho; x++) {
    if (!visto(x, y) || !abierta(x, y)) continue;
    const c = m.celda(x, y);
    let col = COLOR.suelo;
    if (c.peligro === 'lava') col = COLOR.lava;
    else if (c.peligro === 'abismo') col = COLOR.abismo;
    else if (c.tipo === 'puerta') col = c.abriendo || c.abierto > 0.02 ? mezclar(COLOR.suelo, COLOR.abierta, 0.35) : COLOR.puerta;
    else if (c.tipo === 'sello') col = c.abierto >= 1 ? mezclar(COLOR.suelo, COLOR.abierta, 0.35) : COLOR.sello;
    else if (pmax > pmin) col = mezclar(c.zona !== undefined && completa(c.zona) ? COLOR.completa : COLOR.suelo, COLOR.alto, (c.piso - pmin) / (pmax - pmin));
    else if (completa(c.zona)) col = COLOR.completa;
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
  // trampas de dardos: su línea de tiro en rojo, en las casillas ya vistas, con una marca en el muro que dispara
  for (const d of juego.dardos || []) {
    ctx.fillStyle = 'rgba(214, 44, 28, .55)';
    for (const [cx, cz] of d.carril) if (visto(cx, cz)) ctx.fillRect(ox + cx * t, oy + cz * t, t, t);
    const bx = Math.floor(d.x), bz = Math.floor(d.z);
    if (!d.carril.some(([cx, cz]) => visto(cx, cz))) continue;
    ctx.fillStyle = '#ff4a30';
    ctx.beginPath();
    ctx.moveTo(ox + (bx + 0.5) * t, oy + bz * t + t * 0.1); ctx.lineTo(ox + (bx + 0.95) * t, oy + (bz + 0.9) * t); ctx.lineTo(ox + (bx + 0.05) * t, oy + (bz + 0.9) * t);
    ctx.closePath(); ctx.fill();
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
  // nombre de cada zona ya pisada, en el centro de lo explorado; con ✓ si está completa
  if (juego.zonas?.length) {
    const suma = juego.zonas.map(() => [0, 0, 0]);
    for (let y = 0; y < m.alto; y++) for (let x = 0; x < m.ancho; x++) {
      if (!visto(x, y) || !abierta(x, y)) continue;
      const s = suma[m.celda(x, y).zona]; s[0] += x; s[1] += y; s[2]++;
    }
    ctx.font = `bold ${Math.max(Math.round(Math.min(w, h) / 32), Math.round(t * 1.3))}px Georgia, serif`;
    ctx.textAlign = 'center';
    juego.zonas.forEach((z, i) => {
      const [sx, sy, n] = suma[i];
      if (n < 12) return;
      const txt = `Zona ${i + 1}${z.halladas === z.total ? ' ✓' : ''}`;
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(10, 7, 4, .9)'; ctx.fillStyle = z.halladas === z.total ? '#7fe0a0' : 'rgba(241, 228, 200, .75)';
      ctx.strokeText(txt, ox + (sx / n + 0.5) * t, oy + (sy / n + 0.5) * t);
      ctx.fillText(txt, ox + (sx / n + 0.5) * t, oy + (sy / n + 0.5) * t);
    });
  }
  // puertas y sellos que ya se abrieron: un marco verde con una muesca, para ver por dónde pasó alguien
  for (let i = 0; i < m.celdas.length; i++) {
    const c = m.celdas[i];
    if ((c.tipo !== 'puerta' && c.tipo !== 'sello') || !(c.abriendo || c.abierto > 0.02) || !v[i]) continue;
    const x = i % m.ancho, y = Math.floor(i / m.ancho), e = Math.max(2, t * 0.14);
    ctx.strokeStyle = COLOR.abierta; ctx.lineWidth = e;
    ctx.strokeRect(ox + x * t + e / 2, oy + y * t + e / 2, t - e, t - e);
    ctx.fillStyle = COLOR.abierta;
    ctx.fillRect(ox + x * t + t * 0.3, oy + y * t + t * 0.3, t * 0.4, t * 0.4);
  }
  // la salida, una vez vista (o revelada con el tiempo en una sala), con su letrero
  if (juego.salidaVista || juego.salidaRevelada) {
    const fase = (performance.now() % 1400) / 1400;
    for (let i = 0; i < m.celdas.length; i++) {
      if (m.celdas[i].tipo !== 'salida' || (!v[i] && !juego.salidaRevelada)) continue;
      if (!v[i]) {
        const sx = ox + (i % m.ancho + 0.5) * t, sy = oy + (Math.floor(i / m.ancho) + 0.5) * t, R = Math.max(8, t * 0.9);
        ctx.strokeStyle = COLOR.salida; ctx.lineWidth = 3;
        ctx.globalAlpha = 1 - fase; ctx.beginPath(); ctx.arc(sx, sy, R + fase * R * 2.5, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = 1; ctx.beginPath(); ctx.arc(sx, sy, R, 0, Math.PI * 2); ctx.stroke();
      }
      const x = i % m.ancho, y = Math.floor(i / m.ancho);
      ctx.fillStyle = COLOR.salida;
      ctx.fillRect(ox + x * t, oy + y * t, t, t);
      ctx.font = `bold ${Math.max(Math.round(Math.min(w, h) / 32), Math.round(t * 1.2))}px Georgia, serif`;
      ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(10, 7, 4, .9)';
      ctx.strokeText('SALIDA', ox + (x + 0.5) * t, oy + y * t - 3);
      ctx.fillText('SALIDA', ox + (x + 0.5) * t, oy + y * t - 3);
    }
  }
  // sellos recién abiertos que aún no viste: solo el marcador, sin revelar el laberinto
  if (juego.sellosNuevos?.size) {
    const fase = (performance.now() % 1400) / 1400, R = Math.max(8, t * 0.9);
    let sx = 0, sy = 0;
    for (const i of juego.sellosNuevos) {
      const x = i % m.ancho, y = Math.floor(i / m.ancho);
      sx += x + 0.5; sy += y + 0.5;
      ctx.fillStyle = COLOR.sello; ctx.fillRect(ox + x * t, oy + y * t, t, t);
    }
    const n = juego.sellosNuevos.size, px = ox + sx / n * t, py = oy + sy / n * t;
    ctx.strokeStyle = COLOR.sello; ctx.lineWidth = 3;
    ctx.globalAlpha = 1 - fase; ctx.beginPath(); ctx.arc(px, py, R + fase * R * 2.5, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 1; ctx.beginPath(); ctx.arc(px, py, R, 0, Math.PI * 2); ctx.stroke();
    ctx.font = `bold ${Math.max(12, Math.round(t * 1.1))}px Georgia, serif`;
    ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(10, 7, 4, .9)'; ctx.fillStyle = COLOR.sello;
    ctx.strokeText('Puerta abierta', px, py - R * 1.5); ctx.fillText('Puerta abierta', px, py - R * 1.5);
  }
  // los otros cazadores de la sala, con el color de su sombrero: solo donde ya exploraste,
  // o unos segundos tras llevarse un tesoro (entonces, en zona desconocida, sobre un círculo de niebla)
  for (const o of juego.otros || []) {
    const conocido = visto(Math.floor(o.x), Math.floor(o.z));
    if (!conocido && !o.aviso) continue;
    const px = ox + o.x * t, py = oy + o.z * t, col = COLOR_CAZADOR[o.color] || '#fff';
    if (o.aviso) {
      const fase = (performance.now() % 1200) / 1200;
      if (!conocido) {
        const g = ctx.createRadialGradient(px, py, 0, px, py, t * 3.2);
        g.addColorStop(0, 'rgba(241, 228, 200, .35)'); g.addColorStop(1, 'rgba(241, 228, 200, 0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(px, py, t * 3.2, 0, Math.PI * 2); ctx.fill();
      }
      ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.globalAlpha = 1 - fase;
      ctx.beginPath(); ctx.arc(px, py, Math.max(6, t * 0.5) + fase * t * 2.5, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = col; ctx.strokeStyle = '#120d08'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(px, py, Math.max(4, t * 0.45), 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    if (o.nombre) etiqueta(ctx, o.nombre, px, py - Math.max(4, t * 0.45) - 4, col, Math.max(11, Math.round(t * 0.9)));
  }
  // jugador: flecha grande con borde claro, un aro que late y el rótulo «TÚ», para encontrarse de un vistazo
  const px = ox + j.x * t, py = oy + j.z * t, r = Math.max(8, t * 0.8), col = juego.colorPropio || COLOR.jugador;
  const latido = (performance.now() % 1100) / 1100;
  ctx.strokeStyle = col; ctx.lineWidth = 3;
  ctx.globalAlpha = 1 - latido; ctx.beginPath(); ctx.arc(px, py, r * (1 + latido * 1.8), 0, Math.PI * 2); ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.fillStyle = 'rgba(10, 7, 4, .55)'; ctx.beginPath(); ctx.arc(px, py, r * 1.15, 0, Math.PI * 2); ctx.fill();
  ctx.save();
  ctx.translate(px, py); ctx.rotate(j.yaw);
  ctx.fillStyle = col; ctx.strokeStyle = '#fff6dc'; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(r * 1.15, 0); ctx.lineTo(-r * 0.7, r * 0.75); ctx.lineTo(-r * 0.35, 0); ctx.lineTo(-r * 0.7, -r * 0.75); ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.restore();
  etiqueta(ctx, 'TÚ', px, py - r * 1.5, col, Math.max(13, Math.round(t * 1.0)));
  // estado y marcador, sobre el propio mapa (los indicadores de la partida se esconden mientras está abierto)
  const f = Math.max(12, Math.round(Math.min(w, h) / 38));
  ctx.font = `bold ${f}px Georgia, serif`; ctx.textAlign = 'center';
  const linea = [`Vida ${Math.round(j.vida)}`, `Tesoros ${juego.tesoros.length}/${juego.totalTesoros}`, juego.limite ? `Puntos ${juego.puntos()}` : null, juego.limite ? `${Math.floor(juego.restante() / 60)}:${String(Math.ceil(juego.restante()) % 60).padStart(2, '0')}` : null].filter(Boolean).join('   ·   ');
  etiqueta(ctx, linea, w / 2, h - Math.max(8, margen * 0.4), '#f1e4c8', f);
  if (juego.marcador?.length) {
    ctx.textAlign = 'left';
    juego.marcador.forEach((q, k) => {
      const yy = Math.max(8, margen * 0.4) + f * (k + 1.3);
      ctx.fillStyle = COLOR_CAZADOR[q.color] || '#fff'; ctx.fillRect(10, yy - f * 0.8, f * 0.9, f * 0.6);
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(10, 7, 4, .9)';
      const txt = `${q.nombre}  ${q.pt}`;
      ctx.strokeText(txt, 10 + f * 1.3, yy); ctx.fillStyle = q.yo ? '#ffd34d' : '#f1e4c8'; ctx.fillText(txt, 10 + f * 1.3, yy);
    });
  }
  // título
  ctx.fillStyle = '#f1e4c8';
  ctx.font = `${Math.max(13, Math.round(t * 0.7))}px Georgia, serif`;
  ctx.textAlign = 'center';
  ctx.fillText(juego.def.nombre, w / 2, Math.max(18, oy - t * 0.5));
}

// Texto con contorno oscuro, legible sobre cualquier fondo.
function etiqueta(ctx, txt, x, y, color, tam) {
  ctx.font = `bold ${tam}px Georgia, serif`; ctx.textAlign = 'center';
  ctx.lineWidth = 3.5; ctx.strokeStyle = 'rgba(10, 7, 4, .95)'; ctx.lineJoin = 'round';
  ctx.strokeText(txt, x, y); ctx.fillStyle = color; ctx.fillText(txt, x, y);
}

function mezclar(a, b, k) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const c = s => Math.round(((pa >> s) & 255) * (1 - k) + ((pb >> s) & 255) * k);
  return `rgb(${c(16)}, ${c(8)}, ${c(0)})`;
}
