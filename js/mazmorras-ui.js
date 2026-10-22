import { $ } from './dom.js';
import { progreso } from './progreso.js';
import { lienzoEmblema } from '../datos/emblemas.js';
import { MAZMORRAS, tesorosDe } from '../datos/mazmorras.js';

const ROMANOS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

// Para abrir una mazmorra hay que haber reunido esta parte de los tesoros de la anterior (la primera siempre está abierta).
const UMBRAL_DESBLOQUEO = 0.5;
const fraccion = m => { const ids = tesorosDe(m); return ids.filter(id => progreso.tesoros.includes(id)).length / ids.length; };
const previaPendiente = m => { const k = MAZMORRAS.indexOf(m); return k > 0 && fraccion(MAZMORRAS[k - 1]) < UMBRAL_DESBLOQUEO ? MAZMORRAS[k - 1] : null; };
export function pintarMazmorras(abrirPreparar) {
  const lista = $('#lista-mazmorras');
  lista.innerHTML = '';
  for (const m of MAZMORRAS) {
    const ids = tesorosDe(m);
    const tengo = ids.filter(id => progreso.tesoros.includes(id)).length;
    const est = progreso.mazmorras[m.id] || {};
    const previa = previaPendiente(m);
    const b = document.createElement('button');
    b.className = 'mazmorra' + (previa ? ' bloqueada' : '');
    b.innerHTML = `<em class="numero">${ROMANOS[MAZMORRAS.indexOf(m)]}</em><div class="titulo-mazmorra"><i class="marco-emblema"></i><strong>${m.nombre}</strong></div><span>${m.descripcion}</span>
      <div class="barra"><i style="width:${Math.round(tengo / ids.length * 100)}%"></i></div>
      <small>${previa ? `🔒 Reúne el ${Math.round(UMBRAL_DESBLOQUEO * 100)} % de los tesoros de ${previa.nombre} (${Math.round(fraccion(previa) * 100)} %)` : `Tesoros ${tengo} de ${ids.length}${est.completada ? ' · Completada' : ''}`}</small>`;
    b.querySelector('.marco-emblema').appendChild(lienzoEmblema(m.id));
    b.onclick = previa ? () => { b.classList.remove('sacude'); void b.offsetWidth; b.classList.add('sacude'); } : () => abrirPreparar(m);
    lista.appendChild(b);
  }
}
