// Ranking en línea de la expedición del día, sobre la API REST de Supabase (datos/ranking.js).
// Sin configurar, `hayRanking` es falso y nada de esto se usa.

import { RANKING } from '../datos/ranking.js';

export const hayRanking = () => !!(RANKING.url && RANKING.clave);

function cabeceras(extra = {}) {
  return { apikey: RANKING.clave, Authorization: `Bearer ${RANKING.clave}`, 'Content-Type': 'application/json', ...extra };
}
const tabla = () => `${RANKING.url.replace(/\/$/, '')}/rest/v1/expediciones`;

// Los mejores del día: más puntos primero y, si empatan, el más rápido.
export async function mejoresDel(fecha, limite = 10) {
  const r = await fetch(`${tabla()}?select=nombre,puntos,segundos,escapo,tesoros&fecha=eq.${fecha}&order=puntos.desc,segundos.asc&limit=${limite}`, { headers: cabeceras() });
  if (!r.ok) throw new Error(`ranking ${r.status}`);
  return r.json();
}

// Sube el resultado oficial del día. Si ya estaba (409: ese jugador ya tiene uno ese día), no pasa nada.
export async function subir(resultado) {
  const r = await fetch(tabla(), {
    method: 'POST',
    headers: cabeceras({ Prefer: 'return=minimal' }),
    body: JSON.stringify(resultado),
  });
  if (!r.ok && r.status !== 409) throw new Error(`ranking ${r.status}`);
}
