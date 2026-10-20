// Acertijos: las tablillas muestran una pista críptica del banco (datos/pistas.js).
// La tablilla se muestra sin nada resaltado. Quien se atasca elige qué ayuda pedir: resaltar los indicadores (azul), las definiciones
// (naranjo), el relleno (verde) o regalar una letra (hasta 2). Cada ayuda cuesta puntos al resolver. Nunca se muestra la solución.
export const MAX_LETRAS = 2;

import { PISTAS } from '../datos/pistas.js';
import { sonar } from './audio.js';

const CLAVE = new TextEncoder().encode('reliquias-de-la-cripta');

export function revelar(b64) {
  const bin = atob(b64);
  const b = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i) ^ CLAVE[i % CLAVE.length];
  return new TextDecoder().decode(b);
}

function hoy() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Extras + pistas del día ya publicadas en Críptico 51 (las futuras se suman solas cuando llega su fecha).
export function pistasDisponibles() {
  const f = hoy();
  return PISTAS.filter(p => p[1] === null || p[1] <= f).map(p => ({
    id: p[0], pista: p[2], longitud: p[3], tipo: p[4], definicion: p[5], indicador: p[6],
    relleno: p[7], dificultad: p[8], _r: p[9], _e: p[10],
  }));
}

export function pistaPorId(id) { return pistasDisponibles().find(p => p.id === id); }

export function normalizar(s) {
  return s.toUpperCase()
    .replace(/Ñ/g, '\u0001')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\u0001/g, 'Ñ')
    .replace(/[^A-ZÑ]/g, '');
}

// `azar`: en una sala, uno con semilla para que todos vean las mismas pistas.
export function elegirPista(dificultad, resueltas, excluir = new Set(), azar = Math.random) {
  const [min, max] = dificultad;
  const todas = pistasDisponibles().filter(p => p.dificultad >= min && p.dificultad <= max && !excluir.has(p.id));
  const nuevas = todas.filter(p => !resueltas.has(p.id));
  const pool = nuevas.length ? nuevas : todas;
  return pool[Math.floor(azar() * pool.length)];
}

const TIPOS = {
  'Anagrama': 'Las letras del relleno se reordenan.',
  'Charada': 'Se suman piezas una detrás de otra: sinónimos cortos, abreviaturas o palabras literales.',
  'Contenedor': 'Una palabra mete a otra dentro.',
  'Sustracción': 'A una palabra se le quita un trozo: otra palabra, una letra o un extremo.',
  'Palabra escondida': 'La respuesta está escrita tal cual dentro de la pista, saltando de una palabra a otra.',
  'Reverso': 'Una palabra se lee al revés.',
  'Selector': 'Se toman letras concretas del relleno: iniciales, finales o centrales.',
  'Selector + charada': 'Una letra elegida se suma a otra pieza.',
  'Doble definición': 'Dos definiciones distintas de la misma palabra, una al lado de la otra.',
  'Onomatopeya': 'La respuesta suena igual que otra palabra (con seseo: C, Z y S suenan igual).',
  'Letras omitidas': 'A cada palabra le falta una letra en el mismo lugar; el patrón dicho en palabras es la respuesta.',
  'Misceláneas': 'Combina dos o más mecanismos.',
};

function escapar(s) { return s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

// Marca en la pista los fragmentos según el nivel de ayuda.
function pistaResaltada(p, ay) {
  const marcas = [];
  const poner = (frag, clase) => {
    if (!frag) return;
    let i = p.pista.indexOf(frag);
    while (i >= 0 && marcas.some(m => i < m.fin && i + frag.length > m.ini)) i = p.pista.indexOf(frag, i + 1);
    if (i >= 0) marcas.push({ ini: i, fin: i + frag.length, clase });
  };
  if (ay.def) p.definicion.forEach(f => poner(f, 'def'));
  if (ay.ind) p.indicador.forEach(f => poner(f, 'ind'));
  if (ay.rel) p.relleno.forEach(f => poner(f, 'rel'));
  marcas.sort((a, b) => a.ini - b.ini);
  let html = '', pos = 0;
  for (const m of marcas) {
    html += escapar(p.pista.slice(pos, m.ini)) + `<mark class="${m.clase}">${escapar(p.pista.slice(m.ini, m.fin))}</mark>`;
    pos = m.fin;
  }
  return html + escapar(p.pista.slice(pos));
}

// Abre el panel de una tablilla. estado: {titulo, pista, nivel, ...}; al acertar llama a alResolver().
export function abrirTablilla(el, estado, { alResolver, alCerrar }) {
  const p = () => estado.pista;
  const respuesta = () => revelar(p()._r);
  const ayudas = () => (estado.pedidas ||= { ind: false, def: false, rel: false, letras: 0 });
  const palabras = () => p().longitud.replace(/[()]/g, '').split(',').map(Number);

  el.innerHTML = `
    <div class="tablilla">
      <h2></h2>
      <div class="estrellas"></div>
      <p class="pista"></p>
      <div class="casillas"></div>
      <form class="responder" autocomplete="off">
        <input type="text" inputmode="text" autocapitalize="characters" spellcheck="false" placeholder="Tu respuesta">
        <button type="submit" class="principal">Probar</button>
      </form>
      <p class="rotulo-ayuda">Pedir una ayuda (cada una resta puntos al resolver)</p>
      <div class="ayudas"></div>
      <div class="acciones">
        <button type="button" data-a="ind">Indicadores</button>
        <button type="button" data-a="def">Definición</button>
        <button type="button" data-a="rel">Relleno</button>
        <button type="button" data-a="letra">Una letra</button>
        <button type="button" data-a="cerrar">Volver</button>
      </div>
    </div>`;
  const $ = s => el.querySelector(s);
  const input = $('input');

  function pintar() {
    $('h2').textContent = estado.titulo;
    $('.estrellas').textContent = '★'.repeat(p().dificultad) + '☆'.repeat(5 - p().dificultad);
    const ay = ayudas();
    $('.pista').innerHTML = `${pistaResaltada(p(), ay)} <span class="long">${p().longitud}</span>`;
    // casillas de letras
    const letras = normalizar(input.value);
    const dadas = normalizar(respuesta()).slice(0, ay.letras);
    let html = '', k = 0;
    palabras().forEach((n, w) => {
      html += '<span class="palabra">';
      for (let i = 0; i < n; i++, k++) {
        const ch = letras[k] || dadas[k] || '';
        html += `<span class="letra${!letras[k] && ch ? ' dada' : ''}">${ch}</span>`;
      }
      html += '</span>';
    });
    $('.casillas').innerHTML = html;
    input.maxLength = palabras().reduce((a, b) => a + b, 0) + palabras().length - 1;

    for (const b of el.querySelectorAll('[data-a="ind"], [data-a="def"], [data-a="rel"]')) {
      const k = b.dataset.a, lista = { ind: p().indicador, def: p().definicion, rel: p().relleno }[k];
      b.hidden = !lista.length;   // sin indicadores (o sin relleno) no hay nada que resaltar
      b.disabled = !!ay[k];
      b.classList.toggle('ya', !!ay[k]);
    }
    const bl = $('[data-a="letra"]');
    bl.disabled = ay.letras >= MAX_LETRAS;
    bl.textContent = `Una letra (${ay.letras}/${MAX_LETRAS})`;
  }

  input.addEventListener('input', pintar);
  $('form').addEventListener('submit', e => {
    e.preventDefault();
    if (normalizar(input.value) === normalizar(respuesta())) {
      sonar('acierto');
      alResolver(p());
    } else {
      sonar('error');
      $('.tablilla').classList.remove('sacudir'); void $('.tablilla').offsetWidth; $('.tablilla').classList.add('sacudir');
    }
  });
  el.querySelector('.acciones').addEventListener('click', e => {
    const a = e.target.dataset.a;
    if (a === 'cerrar') alCerrar();
    if (a === 'ind' || a === 'def' || a === 'rel') {
      const ay = ayudas();
      if (!ay[a]) { ay[a] = true; estado.ayudas = (estado.ayudas || 0) + 1; }
      pintar();
    }
    if (a === 'letra') {
      const ay = ayudas();
      if (ay.letras < MAX_LETRAS) { ay.letras++; estado.ayudas = (estado.ayudas || 0) + 1; }
      pintar();
    }
  });
  pintar();
  el.hidden = false;
  setTimeout(() => { if (!document.body.classList.contains('tactil')) input.focus(); }, 50);
}
