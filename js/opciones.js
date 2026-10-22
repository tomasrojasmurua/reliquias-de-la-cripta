import { $ } from './dom.js';
import { progreso, guardar } from './progreso.js';
import { alternarSilencio, alternarMusica, ponerSilencio, ponerMusica } from './audio.js';

// Calidad gráfica, controles y sonido: las opciones que se guardan en el progreso.
let calidad = progreso.opciones.calidad || 'alta';
export const calidadActual = () => calidad;

let entrada;
export function iniciarOpciones(e) {
  entrada = e;
  aplicarControles();
  document.body.classList.toggle('retro', calidad === 'retro');
  ponerSilencio(!!progreso.opciones.silencio);
  ponerMusica(!progreso.opciones.sinMusica);
  pintarSonido();
}

export function pintarOpciones() {
  for (const b of document.querySelectorAll('[data-calidad]')) b.classList.toggle('activo', b.dataset.calidad === calidad);
  pintarControles();
}

// Controles táctiles: sensibilidad, modo zurdo y vibración.
const SENSIBILIDAD = { baja: 0.6, media: 1, alta: 1.5 };
const SENS_RATON = { baja: 0.0015, media: 0.0024, alta: 0.0038 };
function aplicarControles() {
  const o = progreso.opciones;
  entrada.sensTactil = 0.006 * SENSIBILIDAD[o.sens || 'media'];
  entrada.sensRaton = SENS_RATON[o.sensr || 'media'];
  entrada.zurdo = !!o.zurdo;
  document.body.classList.toggle('zurdo', !!o.zurdo);
}
function pintarControles() {
  const o = progreso.opciones;
  for (const b of document.querySelectorAll('[data-sens]')) b.classList.toggle('activo', b.dataset.sens === (o.sens || 'media'));
  for (const b of document.querySelectorAll('[data-sensr]')) b.classList.toggle('activo', b.dataset.sensr === (o.sensr || 'media'));
  $('#btn-zurdo').textContent = o.zurdo ? 'Zurdo: sí' : 'Zurdo: no';
  $('#btn-vibrar').textContent = o.sinVibrar ? 'Vibración: no' : 'Vibración: sí';
}
for (const b of document.querySelectorAll('[data-sensr]')) b.onclick = () => { progreso.opciones.sensr = b.dataset.sensr; guardar(); aplicarControles(); pintarControles(); };
for (const b of document.querySelectorAll('[data-sens]')) b.onclick = () => { progreso.opciones.sens = b.dataset.sens; guardar(); aplicarControles(); pintarControles(); };
$('#btn-zurdo').onclick = () => { progreso.opciones.zurdo = !progreso.opciones.zurdo; guardar(); aplicarControles(); pintarControles(); };
$('#btn-vibrar').onclick = () => {
  progreso.opciones.sinVibrar = !progreso.opciones.sinVibrar; guardar(); pintarControles();
  if (!progreso.opciones.sinVibrar) vibrar(40);
};
export function vibrar(ms) {
  if (progreso.opciones.sinVibrar || !document.body.classList.contains('tactil')) return;
  try { navigator.vibrate?.(ms); } catch (e) { /* sin vibración */ }
}

for (const b of document.querySelectorAll('[data-calidad]')) b.onclick = () => {
  calidad = b.dataset.calidad; progreso.opciones.calidad = calidad; guardar(); pintarOpciones();
  document.body.classList.toggle('retro', calidad === 'retro');
};
function pintarSonido() {
  $('#btn-sonido').textContent = progreso.opciones.silencio ? 'Sonido: no' : 'Sonido: sí';
  $('#btn-musica').textContent = progreso.opciones.sinMusica ? 'Música: no' : 'Música: sí';
}
$('#btn-sonido').onclick = () => { progreso.opciones.silencio = alternarSilencio(); guardar(); pintarSonido(); };
$('#btn-musica').onclick = () => { progreso.opciones.sinMusica = alternarMusica(); guardar(); pintarSonido(); };
