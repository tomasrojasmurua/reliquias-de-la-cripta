// Automapa: plano de lo explorado, como el de Doom. Solo se dibujan las casillas que ya viste.

export const COLOR = {
  fondo: '#e4cf9a',     // pergamino
  muro: '#3a2312',      // tinta
  suelo: '#b59655',
  completa: '#97aa63',  // suelo de una zona con todas sus reliquias
  alto: '#d4b97c',      // el suelo más alto se pinta más claro
  lava: '#d4561c',
  abismo: '#3b3328',
  puerta: '#9a5a22',
  abierta: '#2f8f4e',   // puerta o sello ya abierto
  sello: '#c28a10',
  tablilla: '#2a5ea8',
  salida: '#2f8f4e',
  tesoro: '#f0b020',
  jugador: '#c8321c',
  tinta: '#3a2312',
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
  pergamino(ctx, w, h);
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
      } else if (Math.abs(n.piso - c.piso) > 0.01 && n.piso < c.piso) { estilo = 'rgba(58, 35, 18, 0.35)'; grosor = Math.max(1, t / 12); }
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
    ctx.fillStyle = 'rgba(200, 40, 24, .5)';
    for (const [cx, cz] of d.carril) if (visto(cx, cz)) ctx.fillRect(ox + cx * t, oy + cz * t, t, t);
    const bx = Math.floor(d.x), bz = Math.floor(d.z);
    if (!d.carril.some(([cx, cz]) => visto(cx, cz))) continue;
    ctx.fillStyle = '#ff4a30';
    ctx.beginPath();
    ctx.moveTo(ox + (bx + 0.5) * t, oy + bz * t + t * 0.1); ctx.lineTo(ox + (bx + 0.95) * t, oy + (bz + 0.9) * t); ctx.lineTo(ox + (bx + 0.05) * t, oy + (bz + 0.9) * t);
    ctx.closePath(); ctx.fill();
  }
  // tesoros y objetos ya vistos, cada uno con su dibujo
  const lat = (Math.sin(performance.now() / 380) + 1) / 2;
  for (const o of juego.objetos) {
    if (o.cogido || !visto(Math.floor(o.x), Math.floor(o.z))) continue;
    icono(ctx, o.cerrado ? 'cofre' : o.tipo, ox + o.x * t, oy + o.z * t, Math.max(6, t * 0.55), lat);
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
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(234, 217, 168, .9)'; ctx.fillStyle = z.halladas === z.total ? '#1f6a38' : 'rgba(58, 35, 18, .8)';
      ctx.strokeText(txt, ox + (sx / n + 0.5) * t, oy + (sy / n + 0.5) * t);
      ctx.fillText(txt, ox + (sx / n + 0.5) * t, oy + (sy / n + 0.5) * t);
    });
  }
  // puertas y sellos que ya se abrieron: un marco verde con una muesca; el que acabas de abrir late con un aro
  const ahora = performance.now();
  for (let i = 0; i < m.celdas.length; i++) {
    const c = m.celdas[i];
    if ((c.tipo !== 'puerta' && c.tipo !== 'sello') || !(c.abriendo || c.abierto > 0.02) || !v[i]) continue;
    const x = i % m.ancho, y = Math.floor(i / m.ancho), e = Math.max(2, t * 0.14);
    ctx.strokeStyle = COLOR.abierta; ctx.lineWidth = e;
    ctx.strokeRect(ox + x * t + e / 2, oy + y * t + e / 2, t - e, t - e);
    ctx.fillStyle = COLOR.abierta;
    ctx.fillRect(ox + x * t + t * 0.3, oy + y * t + t * 0.3, t * 0.4, t * 0.4);
    if (c.pulso && ahora - c.pulso < 40000) {
      const f = (ahora % 1000) / 1000, R = Math.max(8, t * 0.9), cx = ox + (x + 0.5) * t, cy = oy + (y + 0.5) * t;
      ctx.strokeStyle = COLOR.abierta; ctx.lineWidth = 3;
      ctx.globalAlpha = 1 - f; ctx.beginPath(); ctx.arc(cx, cy, R * (0.6 + f * 2.2), 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1; ctx.beginPath(); ctx.arc(cx, cy, R * 0.9, 0, Math.PI * 2); ctx.stroke();
    }
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
      ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(234, 217, 168, .95)';
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
    ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(234, 217, 168, .95)'; ctx.fillStyle = COLOR.sello;
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
  ctx.fillStyle = 'rgba(234, 217, 168, .6)'; ctx.beginPath(); ctx.arc(px, py, r * 1.15, 0, Math.PI * 2); ctx.fill();
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
  const linea = [`Vida ${Math.round(j.vida)}`, `Tesoros ${juego.tesoros.length}/${juego.totalTesoros}`, juego.real ? `Puntos ${juego.puntos()}` : null, juego.limite ? `${Math.floor(juego.restante() / 60)}:${String(Math.ceil(juego.restante()) % 60).padStart(2, '0')}` : null].filter(Boolean).join('   ·   ');
  etiqueta(ctx, linea, w / 2, h - Math.max(8, margen * 0.4), COLOR.tinta, f);
  if (juego.marcador?.length) {
    ctx.textAlign = 'left';
    juego.marcador.forEach((q, k) => {
      const yy = Math.max(8, margen * 0.4) + f * (k + 1.3);
      ctx.fillStyle = COLOR_CAZADOR[q.color] || '#fff'; ctx.fillRect(10, yy - f * 0.8, f * 0.9, f * 0.6);
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(234, 217, 168, .95)';
      const txt = `${q.nombre}  ${q.pt}`;
      ctx.strokeText(txt, 10 + f * 1.3, yy); ctx.fillStyle = q.yo ? '#a06a00' : COLOR.tinta; ctx.fillText(txt, 10 + f * 1.3, yy);
    });
  }
  // título
  ctx.fillStyle = COLOR.tinta;
  ctx.font = `italic ${Math.max(13, Math.round(t * 0.7))}px Georgia, serif`;
  ctx.textAlign = 'center';
  ctx.fillText(juego.def.nombre, w / 2, Math.max(18, oy - t * 0.5));
}

// Los que te persiguen o te atacan (los dormidos y los que esperan ocultos no aparecen).
const CAZANDO = new Set(['caza', 'ataca', 'lanza', 'embiste']);

// Minimapa redondo: gira con quien mira (arriba = hacia donde miras) y, alrededor, una rosa de los vientos
// que marca siempre el norte del mapa. Muestra lo ya explorado, las tablillas, los tesoros y los monstruos que te cazan.
export function dibujarMinimapa(ctx, S, juego, radio = 6.5) {
  const m = juego.mapa, j = juego.j, v = juego.vistas;
  const Rm = S / 2 - 18, t = Rm / radio, c0 = S / 2;
  const giro = -j.yaw - Math.PI / 2;   // lleva hacia arriba la dirección en que miras
  ctx.clearRect(0, 0, S, S);
  const ahora = performance.now();
  // aro de la brújula
  ctx.fillStyle = '#2a1f14'; ctx.beginPath(); ctx.arc(c0, c0, S / 2 - 2, 0, Math.PI * 2); ctx.fill();
  ctx.save(); ctx.beginPath(); ctx.arc(c0, c0, Rm, 0, Math.PI * 2); ctx.clip();
  ctx.fillStyle = COLOR.fondo; ctx.fillRect(0, 0, S, S);
  ctx.translate(c0, c0); ctx.rotate(giro); ctx.translate(-c0, -c0);
  const ox = c0 - j.x * t, oy = c0 - j.z * t;
  const visto = (x, y) => v && x >= 0 && y >= 0 && x < m.ancho && y < m.alto && v[y * m.ancho + x];
  const abierta = (x, y) => { const c = m.celda(x, y); return c && (!m.solida(x, y) || c.tipo === 'puerta' || c.tipo === 'sello'); };
  const x0 = Math.max(0, Math.floor(j.x - radio - 1)), x1 = Math.min(m.ancho - 1, Math.ceil(j.x + radio + 1));
  const y0 = Math.max(0, Math.floor(j.z - radio - 1)), y1 = Math.min(m.alto - 1, Math.ceil(j.z + radio + 1));
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    if (!visto(x, y) || !abierta(x, y)) continue;
    const c = m.celda(x, y);
    ctx.fillStyle = c.peligro === 'lava' ? COLOR.lava : c.peligro === 'abismo' ? COLOR.abismo : c.tipo === 'puerta' ? (c.abriendo || c.abierto > 0.02 ? COLOR.abierta : COLOR.puerta) : c.tipo === 'sello' ? (c.abierto >= 1 ? COLOR.abierta : COLOR.sello) : COLOR.suelo;
    ctx.fillRect(ox + x * t, oy + y * t, t + 0.5, t + 0.5);
    if ((c.tipo === 'puerta' || c.tipo === 'sello') && c.pulso && ahora - c.pulso < 40000) {
      const f = (ahora % 1000) / 1000;
      ctx.strokeStyle = COLOR.abierta; ctx.lineWidth = 2; ctx.globalAlpha = 1 - f;
      ctx.beginPath(); ctx.arc(ox + (x + 0.5) * t, oy + (y + 0.5) * t, t * (0.6 + f * 1.6), 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1;
    }
    ctx.lineCap = 'square';
    for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
      if (abierta(x + dx, y + dy)) continue;
      const n = m.celda(x + dx, y + dy);
      // las tablillas por descifrar y las inscripciones se marcan en azul, como en el mapa grande; la salida, en verde
      const tablilla = n && (n.tipo === 'tablilla' || n.tipo === 'aviso'), salida = n && n.tipo === 'salida';
      ctx.strokeStyle = tablilla ? COLOR.tablilla : salida ? COLOR.salida : COLOR.muro;
      ctx.lineWidth = Math.max(1, t / 6) * (tablilla || salida ? 2.2 : 1);
      const ax = ox + (dx === 1 ? x + 1 : x) * t, ay = oy + (dy === 1 ? y + 1 : y) * t;
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(dx === 0 ? ax + t : ax, dx === 0 ? ay : ay + t); ctx.stroke();
      if (tablilla && n.tipo === 'tablilla' && !n.tex.endsWith('_rota')) {
        // una tablilla sin descifrar late con un aro azul
        const f = (ahora % 1300) / 1300, tx = ox + (x + dx / 2 + 0.5) * t, ty = oy + (y + dy / 2 + 0.5) * t;
        ctx.strokeStyle = COLOR.tablilla; ctx.lineWidth = 2; ctx.globalAlpha = 1 - f;
        ctx.beginPath(); ctx.arc(tx, ty, t * (0.5 + f * 1.4), 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1;
      }
    }
  }
  const lat = (Math.sin(ahora / 380) + 1) / 2;
  const girar = (x, y, f) => { ctx.save(); ctx.translate(x, y); ctx.rotate(-giro); f(); ctx.restore(); };   // para que íconos y puntos no giren con el mapa
  for (const o of juego.objetos) {
    if (o.cogido || !visto(Math.floor(o.x), Math.floor(o.z))) continue;
    girar(ox + o.x * t, oy + o.z * t, () => icono(ctx, o.cerrado ? 'cofre' : o.tipo, 0, 0, Math.max(4, t * 0.5), lat));
  }
  // monstruos que te persiguen o te atacan: puntos rojos que laten; los que están fuera del alcance se pegan al borde
  for (const e of juego.enemigos) {
    if (!CAZANDO.has(e.estado) || e.vaga) continue;   // los que te perdieron ya no se marcan
    const dx = e.x - j.x, dz = e.z - j.z, d = Math.hypot(dx, dz);
    if (d > radio * 2.4) continue;
    const k = d > radio - 0.6 ? (radio - 0.6) / d : 1;
    girar(ox + (j.x + dx * k) * t, oy + (j.z + dz * k) * t, () => {
      const f = (ahora % 800) / 800, r = Math.max(3.5, t * 0.42);
      ctx.strokeStyle = '#d62c1c'; ctx.lineWidth = 2; ctx.globalAlpha = (1 - f) * (k < 1 ? 0.6 : 1);
      ctx.beginPath(); ctx.arc(0, 0, r * (1 + f * 1.6), 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = k < 1 ? 0.75 : 1;
      ctx.fillStyle = '#e8321e'; ctx.strokeStyle = '#2a0a06'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.globalAlpha = 1;
    });
  }
  for (const o of juego.otros || []) {
    if (!visto(Math.floor(o.x), Math.floor(o.z))) continue;
    girar(ox + o.x * t, oy + o.z * t, () => {
      ctx.fillStyle = COLOR_CAZADOR[o.color] || '#fff'; ctx.strokeStyle = '#120d08'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(0, 0, Math.max(3.5, t * 0.4), 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    });
  }
  ctx.restore();
  // yo, siempre mirando hacia arriba
  ctx.save(); ctx.translate(c0, c0); ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = juego.colorPropio || COLOR.jugador; ctx.strokeStyle = '#fff6dc'; ctx.lineWidth = 1.5; ctx.lineJoin = 'round';
  const r = Math.max(5, t * 0.75);
  ctx.beginPath(); ctx.moveTo(r, 0); ctx.lineTo(-r * 0.6, r * 0.65); ctx.lineTo(-r * 0.3, 0); ctx.lineTo(-r * 0.6, -r * 0.65); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.restore();
  // rosa de los vientos: N, E, S y O alrededor, girando al revés para que la N apunte siempre al norte del mapa
  ctx.strokeStyle = COLOR.tinta; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(c0, c0, Rm, 0, Math.PI * 2); ctx.stroke();
  const Rl = (Rm + S / 2 - 2) / 2;
  ctx.font = `bold ${Math.round(S * 0.1)}px Georgia, serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const [letra, a, col] of [['N', -Math.PI / 2, '#ff5a40'], ['E', 0, '#e8d8b0'], ['S', Math.PI / 2, '#e8d8b0'], ['O', Math.PI, '#e8d8b0']]) {
    const ang = a + giro, lx = c0 + Math.cos(ang) * Rl, ly = c0 + Math.sin(ang) * Rl;
    ctx.fillStyle = col; ctx.fillText(letra, lx, ly);
    if (letra === 'N') {
      ctx.beginPath(); ctx.moveTo(c0 + Math.cos(ang) * (Rm + 1), c0 + Math.sin(ang) * (Rm + 1));
      ctx.lineTo(c0 + Math.cos(ang + 0.16) * (Rm - 6), c0 + Math.sin(ang + 0.16) * (Rm - 6)); ctx.lineTo(c0 + Math.cos(ang - 0.16) * (Rm - 6), c0 + Math.sin(ang - 0.16) * (Rm - 6)); ctx.closePath();
      ctx.fillStyle = '#ff5a40'; ctx.fill();
    }
  }
  ctx.textBaseline = 'alphabetic';
  ctx.strokeStyle = '#120d08'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(c0, c0, S / 2 - 2, 0, Math.PI * 2); ctx.stroke();
}

// Texto con contorno oscuro, legible sobre cualquier fondo.
function etiqueta(ctx, txt, x, y, color, tam) {
  ctx.font = `bold ${tam}px Georgia, serif`; ctx.textAlign = 'center';
  ctx.lineWidth = 3.5; ctx.strokeStyle = 'rgba(234, 217, 168, .95)'; ctx.lineJoin = 'round';
  ctx.strokeText(txt, x, y); ctx.fillStyle = color; ctx.fillText(txt, x, y);
}

function mezclar(a, b, k) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const c = s => Math.round(((pa >> s) & 255) * (1 - k) + ((pb >> s) & 255) * k);
  return `rgb(${c(16)}, ${c(8)}, ${c(0)})`;
}

// Pergamino: fondo con manchas, viñeta quemada, marco doble y rosa de los vientos (se dibuja una vez por tamaño).
let cache = null;
function pergamino(ctx, w, h) {
  if (!cache || cache.width !== w || cache.height !== h) {
    cache = document.createElement('canvas'); cache.width = w; cache.height = h;
    const c = cache.getContext('2d');
    c.fillStyle = COLOR.fondo; c.fillRect(0, 0, w, h);
    let sem = 7; const az = () => (sem = (sem * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 90; i++) {
      const x = az() * w, y = az() * h, r = 20 + az() * Math.min(w, h) * 0.12;
      const g = c.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(${az() < 0.5 ? '150,100,40' : '255,240,200'}, ${0.05 + az() * 0.07})`); g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2);
    }
    const v = c.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
    v.addColorStop(0, 'rgba(90,50,10,0)'); v.addColorStop(1, 'rgba(90,50,10,.6)');
    c.fillStyle = v; c.fillRect(0, 0, w, h);
    const m = Math.min(w, h) * 0.025;
    c.strokeStyle = COLOR.tinta; c.lineWidth = 3; c.strokeRect(m, m, w - m * 2, h - m * 2);
    c.lineWidth = 1; c.strokeRect(m * 1.8, m * 1.8, w - m * 3.6, h - m * 3.6);
    // rosa de los vientos, abajo a la izquierda
    const R = Math.min(w, h) * 0.07, cx = m * 3 + R * 1.1 + 40, cy = h - m * 3 - R * 1.1;
    c.save(); c.translate(cx, cy); c.globalAlpha = 0.75; c.strokeStyle = COLOR.tinta; c.fillStyle = COLOR.tinta;
    c.beginPath(); c.arc(0, 0, R * 0.75, 0, Math.PI * 2); c.lineWidth = 1.5; c.stroke();
    for (let k = 0; k < 4; k++) {
      c.save(); c.rotate(k * Math.PI / 2);
      c.beginPath(); c.moveTo(0, -R); c.lineTo(R * 0.17, -R * 0.17); c.lineTo(-R * 0.17, -R * 0.17); c.closePath(); c.fillStyle = k === 0 ? '#a82a1a' : COLOR.tinta; c.fill();
      c.restore();
    }
    c.font = `bold ${Math.round(R * 0.5)}px Georgia, serif`; c.textAlign = 'center'; c.fillStyle = COLOR.tinta; c.fillText('N', 0, -R * 1.12);
    c.restore();
  }
  ctx.drawImage(cache, 0, 0);
}

// Icono de un objeto del suelo, en (x, y) con radio r; `lat` (0..1) hace brillar los tesoros.
export function icono(ctx, tipo, x, y, r, lat) {
  ctx.save(); ctx.translate(x, y); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(1.5, r * 0.22); ctx.strokeStyle = COLOR.tinta;
  const tinta = col => { ctx.fillStyle = col; ctx.fill(); ctx.stroke(); };
  if (tipo === 'tesoro' || tipo === 'falso') {
    ctx.fillStyle = `rgba(255, 210, 60, ${0.18 + lat * 0.3})`; ctx.beginPath(); ctx.arc(0, 0, r * (1.5 + lat * 0.4), 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-r * 0.55, -r * 0.8); ctx.lineTo(r * 0.55, -r * 0.8); ctx.lineTo(r, -r * 0.1); ctx.lineTo(0, r); ctx.lineTo(-r, -r * 0.1); ctx.closePath(); tinta(COLOR.tesoro);
    ctx.beginPath(); ctx.moveTo(-r, -r * 0.1); ctx.lineTo(r, -r * 0.1); ctx.moveTo(-r * 0.55, -r * 0.8); ctx.lineTo(-r * 0.25, -r * 0.1); ctx.lineTo(0, r); ctx.moveTo(r * 0.55, -r * 0.8); ctx.lineTo(r * 0.25, -r * 0.1); ctx.lineWidth = Math.max(1, r * 0.1); ctx.stroke();
  } else if (tipo === 'vendas') {
    ctx.beginPath(); ctx.rect(-r * 0.85, -r * 0.85, r * 1.7, r * 1.7); tinta('#f4ead0');
    ctx.fillStyle = '#c8321c'; ctx.fillRect(-r * 0.2, -r * 0.6, r * 0.4, r * 1.2); ctx.fillRect(-r * 0.6, -r * 0.2, r * 1.2, r * 0.4);
  } else if (tipo === 'balas' || tipo === 'cartuchos') {
    const col = tipo === 'balas' ? '#d9a63a' : '#c4452e';
    for (const dx of [-r * 0.5, r * 0.5]) { ctx.beginPath(); ctx.roundRect(dx - r * 0.3, -r * 0.8, r * 0.6, r * 1.6, r * 0.25); tinta(col); }
  } else if (tipo === 'llave') {
    ctx.beginPath(); ctx.arc(-r * 0.35, -r * 0.35, r * 0.5, 0, Math.PI * 2); tinta('#e8c850');
    ctx.strokeStyle = COLOR.tinta; ctx.lineWidth = Math.max(2.5, r * 0.4); ctx.beginPath(); ctx.moveTo(-r * 0.05, -r * 0.05); ctx.lineTo(r * 0.8, r * 0.8); ctx.moveTo(r * 0.45, r * 0.45); ctx.lineTo(r * 0.8, r * 0.1); ctx.stroke();
    ctx.strokeStyle = '#e8c850'; ctx.lineWidth = Math.max(1.2, r * 0.2); ctx.beginPath(); ctx.moveTo(-r * 0.05, -r * 0.05); ctx.lineTo(r * 0.8, r * 0.8); ctx.moveTo(r * 0.45, r * 0.45); ctx.lineTo(r * 0.8, r * 0.1); ctx.stroke();
  } else if (tipo === 'cofre') {
    ctx.beginPath(); ctx.rect(-r * 0.9, -r * 0.55, r * 1.8, r * 1.2); tinta('#9a6a38');
    ctx.fillStyle = '#e8c850'; ctx.fillRect(-r * 0.2, -r * 0.2, r * 0.4, r * 0.5);
  } else if (tipo === 'barreta') {
    ctx.strokeStyle = COLOR.tinta; ctx.lineWidth = Math.max(3, r * 0.5); ctx.beginPath(); ctx.moveTo(-r * 0.8, r * 0.8); ctx.lineTo(r * 0.6, -r * 0.6); ctx.arc(r * 0.2, -r * 1.0, r * 0.5, Math.PI * 0.8, Math.PI * 1.7); ctx.stroke();
    ctx.strokeStyle = '#8fb0cc'; ctx.lineWidth = Math.max(1.5, r * 0.25); ctx.beginPath(); ctx.moveTo(-r * 0.8, r * 0.8); ctx.lineTo(r * 0.6, -r * 0.6); ctx.stroke();
  } else {
    // armas (revólver, escopeta, Tommy): silueta de pistola
    ctx.beginPath(); ctx.moveTo(-r, -r * 0.5); ctx.lineTo(r, -r * 0.5); ctx.lineTo(r, -r * 0.05); ctx.lineTo(-r * 0.1, -r * 0.05); ctx.lineTo(-r * 0.4, r * 0.9); ctx.lineTo(-r * 0.9, r * 0.9); ctx.lineTo(-r * 0.7, -r * 0.05); ctx.lineTo(-r, -r * 0.05); ctx.closePath(); tinta('#8a929e');
  }
  ctx.restore();
}

// La leyenda del mapa completo: cada entrada pinta su muestra con los mismos colores y dibujos del mapa.
export const LEYENDA = [
  ['Tú', ctx => { ctx.fillStyle = COLOR.jugador; ctx.strokeStyle = '#fff6dc'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(9, 0); ctx.lineTo(-6, 6); ctx.lineTo(-3, 0); ctx.lineTo(-6, -6); ctx.closePath(); ctx.fill(); ctx.stroke(); }],
  ['Tablilla o inscripción', ctx => { ctx.fillStyle = COLOR.tablilla; ctx.fillRect(-8, -2, 16, 4); }],
  ['Sello cerrado', ctx => { ctx.fillStyle = COLOR.sello; ctx.fillRect(-7, -7, 14, 14); }],
  ['Puerta cerrada', ctx => { ctx.fillStyle = COLOR.puerta; ctx.fillRect(-7, -7, 14, 14); }],
  ['Puerta o sello abierto', ctx => { ctx.strokeStyle = COLOR.abierta; ctx.lineWidth = 2; ctx.strokeRect(-6, -6, 12, 12); ctx.fillStyle = COLOR.abierta; ctx.fillRect(-2.5, -2.5, 5, 5); }],
  ['Salida', ctx => { ctx.fillStyle = COLOR.salida; ctx.fillRect(-7, -7, 14, 14); }],
  ['Tesoro', ctx => icono(ctx, 'tesoro', 0, 0, 7, 0.5)],
  ['Vendas', ctx => icono(ctx, 'vendas', 0, 0, 7, 0)],
  ['Munición', ctx => icono(ctx, 'balas', 0, 0, 7, 0)],
  ['Arma', ctx => icono(ctx, 'revolver', 0, 0, 7, 0)],
  ['Palanca de hierro', ctx => icono(ctx, 'barreta', 0, 0, 7, 0)],
  ['Llave', ctx => icono(ctx, 'llave', 0, 0, 7, 0)],
  ['Cofre cerrado', ctx => icono(ctx, 'cofre', 0, 0, 7, 0)],
  ['Trampa de dardos', ctx => { ctx.fillStyle = 'rgba(200, 40, 24, .5)'; ctx.fillRect(-8, -4, 16, 8); ctx.fillStyle = '#ff4a30'; ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(6, 6); ctx.lineTo(-6, 6); ctx.closePath(); ctx.fill(); }],
  ['Lava', ctx => { ctx.fillStyle = COLOR.lava; ctx.fillRect(-7, -7, 14, 14); }],
  ['Abismo', ctx => { ctx.fillStyle = COLOR.abismo; ctx.fillRect(-7, -7, 14, 14); }],
  ['Zona con todas sus reliquias', ctx => { ctx.fillStyle = COLOR.completa; ctx.fillRect(-7, -7, 14, 14); }],
  ['Otro cazador', ctx => { ctx.fillStyle = COLOR_CAZADOR.azul; ctx.strokeStyle = '#120d08'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }, 'sala'],
];
