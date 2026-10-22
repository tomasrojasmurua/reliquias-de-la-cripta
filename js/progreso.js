import { MAZMORRAS } from '../datos/mazmorras.js';

// ---------- Progreso guardado ----------

const CLAVE = 'reliquias:v1';
function leerProgreso() {
  try { const p = JSON.parse(localStorage.getItem(CLAVE)); if (p) return p; } catch (e) { /* sin almacenamiento */ }
  return { tesoros: [], pistas: [], mazmorras: {}, opciones: {} };
}
export const progreso = leerProgreso();

// Las 3 mejores expediciones de cada mazmorra y tamaño (solo cuentan las que escapan): más puntos primero y, a igualdad, menos tiempo.
const TOP = 3;
const claveRecord = (id, tamano) => `${id}:${tamano}`;
export const mejores = (id, tamano) => progreso.records?.[claveRecord(id, tamano)] || [];
// Guarda una expedición y devuelve su puesto (1 a TOP) o 0 si no entra.
export function anotarRecord(id, tamano, puntos, tiempo) {
  const lista = (progreso.records ||= {})[claveRecord(id, tamano)] ||= [];
  const nueva = { puntos, tiempo: Math.round(tiempo), fecha: Date.now() };
  lista.push(nueva);
  lista.sort((a, b) => b.puntos - a.puntos || a.tiempo - b.tiempo || a.fecha - b.fecha);
  lista.length = Math.min(lista.length, TOP);
  return lista.indexOf(nueva) + 1;
}
export const reloj = t => `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
progreso.opciones ||= {};
export function guardar() { try { localStorage.setItem(CLAVE, JSON.stringify(progreso)); } catch (e) { /* sin almacenamiento */ } }

export const CALIDADES = { alta: 1, media: 0.75, retro: 0.4 };
// Antes de entrar se elige el modo y el tamaño (cuántas zonas de la mazmorra). El tiempo para salir depende del tamaño.
export const TAMANOS = {
  pequena: { zonas: 1, minutos: 10 },
  mediana: { zonas: 2, minutos: 20 },
  grande: { zonas: Infinity, minutos: 30 },
};
// Salas. Competitivo: tesoros exclusivos, sin reloj hasta que el primero encuentra la salida (entonces los demás tienen esta cuenta atrás,
// constante, para escapar) y los cazadores pueden herirse. Cooperativo: tesoros compartidos, sin daño entre amigos y un reloj fijo según el tamaño.
export const CUENTA_COMPETITIVO = { pequena: 90, mediana: 120, grande: 150 };
export const MINUTOS_COOPERATIVO = { pequena: 10, mediana: 20, grande: 30 };
export const prep = { tamano: progreso.opciones.tamano || 'grande' };
// Lo que el anfitrión elige en el lobby de una sala (se guarda para la próxima).
export const ajustesSala = { mazmorra: progreso.opciones.salaMazmorra || MAZMORRAS[0].id, tamano: progreso.opciones.salaTamano || 'grande', modo: progreso.opciones.salaModo || 'competitivo' };
