import { miniatura } from './texturas.js';
import { $ } from './dom.js';
import { progreso, guardar } from './progreso.js';
import { MAZMORRAS, tesorosDe } from '../datos/mazmorras.js';
import { TESOROS, TESORO, RAREZAS } from '../datos/tesoros.js';
import { SALAS } from '../datos/museo.js';
import { HISTORIAS } from '../datos/historias.js';

let atlas;
export const iniciarColeccion = a => { atlas = a; };

function mazmorraDe(id) {
  return MAZMORRAS.find(m => tesorosDe(m).includes(id));
}
const esNuevo = id => (progreso.nuevos || []).includes(id);
// Una pieza sobre su pedestal: se toca para abrir su ficha. Lleva debajo el color de su rareza y, si es nueva, un rótulo.
function piezaMuseo(t, lo, i) {
  const b = document.createElement('button');
  b.className = 'pieza' + (lo ? '' : ' oculta') + (lo && esNuevo(t.id) ? ' nueva' : '');
  b.style.setProperty('--retraso', (i % 5) * -0.7 + 's');
  b.style.setProperty('--rareza', RAREZAS[t.rareza].color);
  b.setAttribute('aria-label', lo ? t.nombre + (esNuevo(t.id) ? ' (nuevo)' : '') : 'Tesoro sin descubrir');
  b.appendChild(miniatura(atlas, 'tesoro_' + t.id, 1));
  if (b.classList.contains('nueva')) b.insertAdjacentHTML('beforeend', '<i>NUEVO</i>');
  b.onclick = () => { abrirFicha(t, lo); b.classList.remove('nueva'); b.querySelector('i')?.remove(); };
  return b;
}
export const ORDEN_RAREZA = ['legendario', 'epico', 'raro', 'comun'];
let museoIdx = 0;
// Museo: una vitrina por mazmorra (con su historia, del tesoro más raro al más común) que se recorre deslizando hacia el lado.
export function pintarColeccion() {
  const cont = $('#vitrinas'), puntos = $('#puntos-museo');
  cont.innerHTML = ''; puntos.innerHTML = '';
  const tengo = new Set(progreso.tesoros);
  const valor = TESOROS.filter(t => tengo.has(t.id)).reduce((s, t) => s + RAREZAS[t.rareza].valor, 0);
  MAZMORRAS.forEach((m, k) => {
    const lista = tesorosDe(m).map(id => TESORO[id]).filter(Boolean).sort((a, b) => ORDEN_RAREZA.indexOf(a.rareza) - ORDEN_RAREZA.indexOf(b.rareza));
    const hallados = lista.filter(t => tengo.has(t.id)).length, sala = SALAS[m.id] || {}, nuevos = lista.filter(t => tengo.has(t.id) && esNuevo(t.id)).length;
    const v = document.createElement('section');
    v.className = `vitrina tema-${m.id}` + (hallados === lista.length && lista.length ? ' completa' : '');
    v.innerHTML = `<header class="cartel-sala"><h3></h3><small>${hallados} de ${lista.length}${nuevos ? ` · <b class="n-nuevos">${nuevos} nuevo${nuevos === 1 ? '' : 's'}</b>` : ''}</small></header>
      <p class="mazmorra-sala"></p>
      <div class="mueble">
        <div class="remate"><i class="foco"></i></div>
        <div class="caja-vidrio"><div class="fondo-vit"></div><div class="repisa"></div><div class="vidrio"></div></div>
        <div class="base-mueble"><span class="placa"></span></div>
      </div>
      <p class="lore-sala"></p>`;
    v.querySelector('h3').textContent = sala.sala || m.nombre;
    v.querySelector('.mazmorra-sala').textContent = m.nombre + (m.guardian ? ` · custodia: ${m.guardian.nombre}` : '');
    v.querySelector('.placa').textContent = `${m.nombre} · ${hallados}/${lista.length}`;
    v.querySelector('.lore-sala').textContent = sala.lore || m.descripcion || '';
    const repisa = v.querySelector('.repisa');
    lista.forEach((t, i) => repisa.appendChild(piezaMuseo(t, tengo.has(t.id), i)));
    cont.appendChild(v);
    const p = document.createElement('button');
    p.className = 'punto' + (nuevos ? ' con-nuevos' : '');
    p.setAttribute('aria-label', sala.sala || m.nombre);
    p.onclick = () => irAVitrina(k);
    puntos.appendChild(p);
  });
  $('#resumen-coleccion').textContent = `${tengo.size} de ${TESOROS.length} tesoros · valor ${valor}`;
  requestAnimationFrame(() => irAVitrina(museoIdx, false));
}
function irAVitrina(k, suave = true) {
  const cont = $('#vitrinas');
  museoIdx = Math.max(0, Math.min(MAZMORRAS.length - 1, k));
  cont.scrollTo({ left: museoIdx * cont.clientWidth, behavior: suave ? 'smooth' : 'instant' });
  marcarPunto();
}
function marcarPunto() {
  document.querySelectorAll('#puntos-museo .punto').forEach((p, i) => p.classList.toggle('activo', i === museoIdx));
  $('#museo-ant').hidden = museoIdx === 0;
  $('#museo-sig').hidden = museoIdx === MAZMORRAS.length - 1;
}
$('#vitrinas').addEventListener('scroll', () => {
  const cont = $('#vitrinas'), k = Math.round(cont.scrollLeft / Math.max(1, cont.clientWidth));
  if (k !== museoIdx && k >= 0 && k < MAZMORRAS.length) { museoIdx = k; marcarPunto(); }
}, { passive: true });
$('#museo-ant').onclick = () => irAVitrina(museoIdx - 1);
$('#museo-sig').onclick = () => irAVitrina(museoIdx + 1);
addEventListener('keydown', e => {
  if ($('#coleccion').hidden || !$('#ficha').hidden) return;
  if (e.key === 'ArrowLeft') irAVitrina(museoIdx - 1);
  if (e.key === 'ArrowRight') irAVitrina(museoIdx + 1);
});
function abrirFicha(t, lo) {
  if (lo && esNuevo(t.id)) { progreso.nuevos = progreso.nuevos.filter(id => id !== t.id); guardar(); }
  const f = $('#ficha'), r = RAREZAS[t.rareza], m = mazmorraDe(t.id);
  f.className = 'f-' + t.rareza;
  const pieza = f.querySelector('.ficha-pieza');
  pieza.innerHTML = ''; pieza.classList.toggle('oculta', !lo);
  pieza.appendChild(miniatura(atlas, 'tesoro_' + t.id, 3));
  f.querySelector('h3').textContent = lo ? t.nombre : '???';
  f.querySelector('em').textContent = r.nombre;
  f.querySelector('p').textContent = lo ? t.descripcion : 'Aún no lo encuentras.';
  // la historia propia de la pieza y la sala donde se expone (solo una vez hallada)
  f.querySelector('.lore').textContent = lo ? [HISTORIAS[t.id], m && SALAS[m.id] ? `Se expone en la ${SALAS[m.id].sala}${m.guardian ? `, la que vigilaba ${m.guardian.nombre}` : ''}.` : ''].filter(Boolean).join(' ') : '';
  f.querySelector('small').textContent = m ? (lo ? 'Hallado en ' : 'Se esconde en ') + m.nombre : '';
  f.hidden = false;
}
$('#ficha').onclick = e => { if (e.target.id === 'ficha' || e.target.closest('.cerrar')) $('#ficha').hidden = true; };
