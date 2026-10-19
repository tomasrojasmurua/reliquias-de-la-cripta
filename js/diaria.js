// Expedición del día: todos juegan la misma mazmorra, con los mismos túneles, las mismas pistas
// y los mismos modificadores. Todo sale de la fecha, así que no hace falta servidor.

import { azarConSemilla } from './laberinto.js';

// Modificadores que hacen distinta cada expedición. Cada día salen dos.
export const MODIFICADORES = {
  oscuridad: { nombre: 'Antorcha mojada', texto: 'Tu antorcha alumbra la mitad.' },
  escasez: { nombre: 'Munición escasa', texto: 'El revólver viene con 3 balas y cada caja trae 6.' },
  despierta: { nombre: 'La cripta despierta', texto: 'Los enemigos te ven de más lejos y corren más.' },
  herido: { nombre: 'Herido', texto: 'Entras con 60 de vida.' },
  escritura: { nombre: 'Escritura antigua', texto: 'Las tablillas traen pistas un punto más difíciles.' },
};

export const TAMANO_DIARIA = 'mediana';
export const MINUTOS_DIARIA = 8;

const DIA = 86400000;
const INICIO = Date.UTC(2026, 9, 19);   // la expedición nº 1

// La fecha local del jugador como 'AAAA-MM-DD' (la expedición cambia a medianoche de cada uno).
export function fechaDe(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function semillaDe(fecha) {
  let h = 2166136261;
  for (const c of 'reliquias:' + fecha) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  return h;
}

function mezcla(vuelta, n) {
  const orden = [...Array(n).keys()];
  const azar = azarConSemilla(semillaDe('vuelta-' + vuelta));
  for (let i = n - 1; i > 0; i--) { const j = Math.floor(azar() * (i + 1)); [orden[i], orden[j]] = [orden[j], orden[i]]; }
  return orden;
}
// La primera de una vuelta no repite la última de la anterior (el cambio toca solo las dos primeras,
// así que la última de cada vuelta es siempre la de su mezcla).
function ordenDe(vuelta, n) {
  const orden = mezcla(vuelta, n);
  if (n > 1 && orden[0] === mezcla(vuelta - 1, n)[n - 1]) [orden[0], orden[1]] = [orden[1], orden[0]];
  return orden;
}

// La expedición de una fecha: número, mazmorra, semilla de los túneles, modificadores y un azar
// propio para elegir las pistas de las tablillas.
export function expedicion(mazmorras, fecha = fechaDe()) {
  const semilla = semillaDe(fecha);
  const azar = azarConSemilla(semilla);
  const [a, m, d] = fecha.split('-').map(Number);
  const numero = Math.round((Date.UTC(a, m - 1, d) - INICIO) / DIA) + 1;
  // se recorren todas las mazmorras en un orden que cambia cada vuelta
  const n = mazmorras.length, vuelta = Math.floor((numero - 1) / n);
  const def = mazmorras[ordenDe(vuelta, n)[(numero - 1) - vuelta * n]];
  const ids = Object.keys(MODIFICADORES);
  const primero = ids[Math.floor(azar() * ids.length)];
  const resto = ids.filter(i => i !== primero);
  const modificadores = [primero, resto[Math.floor(azar() * resto.length)]];
  return { fecha, numero, def, semilla, modificadores, azarPistas: azarConSemilla(semilla ^ 0x9e3779b9) };
}

// Días seguidos jugados hasta hoy (o hasta ayer, si hoy todavía no juegas).
export function racha(jugadas, hoy = fechaDe()) {
  const d = new Date(hoy + 'T12:00:00');
  if (!jugadas[hoy]) d.setDate(d.getDate() - 1);
  let n = 0;
  while (jugadas[fechaDe(d)]) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

// Resumen para pegar en un chat, al estilo Wordle: sin nombres de tesoros para no dar pistas.
export function textoCompartir(exp, r, rarezaDe, url) {
  const cuadro = { comun: '⬜', raro: '🟦', epico: '🟪', legendario: '🟨' };
  const orden = ['legendario', 'epico', 'raro', 'comun'];
  const botin = r.tesoros.map(rarezaDe).sort((a, b) => orden.indexOf(a) - orden.indexOf(b)).map(x => cuadro[x]).join('');
  const min = Math.floor(r.reloj / 60), seg = Math.floor(r.reloj % 60);
  return [
    `Reliquias de la Cripta · Expedición nº ${exp.numero}`,
    `${exp.def.nombre} · ${exp.modificadores.map(m => MODIFICADORES[m].nombre).join(' + ')}`,
    `${r.escapo ? '🏃 Escapé' : '🕯️ Atrapado'} con ${r.puntosFinales} puntos en ${min}:${String(seg).padStart(2, '0')}`,
    `${botin || '—'}  ${r.tesoros.length}/${r.totalTesoros} tesoros · ${r.acertijos}/${r.totalAcertijos} acertijos`,
    url,
  ].join('\n');
}
