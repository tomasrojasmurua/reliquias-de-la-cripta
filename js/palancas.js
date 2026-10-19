// Palancas: otro tipo de acertijo para las cámaras selladas. Un mecanismo con cuatro palancas, cada una
// con un símbolo, y una inscripción con pistas de lógica sobre el orden en que se bajan. Las pistas se
// generan al azar hasta que solo un orden las cumple, y luego se quitan las que sobran.

import { sonar } from './audio.js';

const SIMBOLOS = [
  ['☀', 'el sol'], ['☾', 'la luna'], ['★', 'la estrella'], ['👁', 'el ojo'],
  ['🐍', 'la serpiente'], ['🪲', 'el escarabajo'], ['💀', 'la calavera'], ['🔥', 'la llama'],
];

const LUGARES = ['primera', 'segunda', 'tercera', 'cuarta'];
// «el sol» → «del sol», «la luna» → «de la luna»
const de = nombre => nombre.startsWith('el ') ? 'del ' + nombre.slice(3) : 'de ' + nombre;

// Cada pista: un texto y una prueba sobre un orden (arreglo de índices de símbolo, del primero al último).
function pistasPosibles(n, nombres) {
  const p = [];
  const pos = (orden, a) => orden.indexOf(a);
  for (let a = 0; a < n; a++) {
    const A = de(nombres[a]);
    p.push({ texto: `La palanca ${A} va primero.`, cumple: o => pos(o, a) === 0 });
    p.push({ texto: `La palanca ${A} va al final.`, cumple: o => pos(o, a) === n - 1 });
    p.push({ texto: `La palanca ${A} no va primero.`, cumple: o => pos(o, a) !== 0 });
    p.push({ texto: `La palanca ${A} no va al final.`, cumple: o => pos(o, a) !== n - 1 });
    for (let k = 1; k < n - 1; k++) p.push({ texto: `La palanca ${A} es la ${LUGARES[k]}.`, cumple: o => pos(o, a) === k });
    for (let b = 0; b < n; b++) {
      if (a === b) continue;
      const B = de(nombres[b]);
      p.push({ texto: `La ${A} va antes que la ${B}.`, cumple: o => pos(o, a) < pos(o, b) });
      p.push({ texto: `La ${A} va justo antes que la ${B}.`, cumple: o => pos(o, b) - pos(o, a) === 1 });
      if (a < b) p.push({ texto: `La ${A} y la ${B} no van seguidas.`, cumple: o => Math.abs(pos(o, a) - pos(o, b)) > 1 });
    }
  }
  return p;
}

function permutaciones(n) {
  if (n === 1) return [[0]];
  return permutaciones(n - 1).flatMap(p => Array.from({ length: n }, (_, i) => [...p.slice(0, i), n - 1, ...p.slice(i)]));
}

// Un acertijo nuevo: { simbolos: [[glifo, nombre]...], orden, pistas: [texto], unica }.
export function crearPalancas(azar = Math.random, n = 4) {
  const elegidos = [...SIMBOLOS].sort(() => azar() - 0.5).slice(0, n);
  const nombres = elegidos.map(s => s[1]);
  const todos = permutaciones(n);
  const orden = todos[Math.floor(azar() * todos.length)];
  // pistas que cumple el orden elegido, menos las que lo dicen todo de una vez (la posición exacta), al final
  const ciertas = pistasPosibles(n, nombres).filter(p => p.cumple(orden)).sort(() => azar() - 0.5);
  const quedan = lista => todos.filter(o => lista.every(p => p.cumple(o))).length;
  const elegidas = [];
  for (const p of ciertas) {
    if (quedan(elegidas) === 1) break;
    if (quedan([...elegidas, p]) < quedan(elegidas)) elegidas.push(p);
  }
  // sin pistas de más: se quita cada una que no haga falta
  for (let i = elegidas.length - 1; i >= 0; i--) {
    const sin = elegidas.filter((_, k) => k !== i);
    if (quedan(sin) === 1) elegidas.splice(i, 1);
  }
  // `unica`: las pistas dejan un solo orden posible (lo revisa herramientas/validar-mazmorras.js)
  return { simbolos: elegidos, orden, pistas: elegidas.map(p => p.texto), unica: quedan(elegidas) === 1 && elegidas.every(p => p.cumple(orden)) };
}

// Abre el panel del mecanismo. estado: { titulo, acertijo: crearPalancas(), ayudas }.
export function abrirPalancas(el, estado, { alResolver, alCerrar }) {
  const a = estado.acertijo, n = a.simbolos.length;
  let bajadas = [];

  el.innerHTML = `
    <div class="tablilla palancas">
      <h2></h2>
      <p class="nota-palancas">Baja las palancas en el orden correcto. Si te equivocas, vuelven a subir.</p>
      <ul class="pistas-palancas"></ul>
      <div class="secuencia"></div>
      <div class="mecanismo"></div>
      <div class="ayuda"></div>
      <div class="acciones">
        <button type="button" data-a="ayuda">Pedir ayuda</button>
        <button type="button" data-a="cerrar">Volver</button>
      </div>
    </div>`;
  const $ = s => el.querySelector(s);
  $('h2').textContent = estado.titulo;
  $('.pistas-palancas').innerHTML = a.pistas.map(p => `<li>${p}</li>`).join('');

  function pintar() {
    $('.secuencia').innerHTML = Array.from({ length: n }, (_, i) => {
      const s = a.simbolos[bajadas[i]];
      return `<span class="hueco${s ? ' lleno' : ''}">${s ? s[0] : i + 1}</span>`;
    }).join('');
    $('.mecanismo').innerHTML = a.simbolos.map(([glifo, nombre], i) =>
      `<button type="button" class="palanca${bajadas.includes(i) ? ' bajada' : ''}" data-i="${i}" ${bajadas.includes(i) ? 'disabled' : ''}><b>${glifo}</b><span>${nombre}</span></button>`).join('');
    const ayuda = estado.ayudas || 0;
    $('.ayuda').innerHTML = ayuda ? `<p><b>Ayuda:</b> el orden empieza con ${a.orden.slice(0, ayuda).map(i => a.simbolos[i][1]).join(', luego ')}.</p>` : '';
    $('[data-a="ayuda"]').disabled = ayuda >= n - 1;
  }

  $('.mecanismo').addEventListener('click', e => {
    const b = e.target.closest('.palanca');
    if (!b || b.disabled) return;
    bajadas.push(Number(b.dataset.i));
    sonar('puerta');
    if (bajadas.length === n) {
      if (bajadas.every((x, i) => x === a.orden[i])) { pintar(); sonar('acierto'); setTimeout(alResolver, 450); return; }
      sonar('error');
      const t = $('.tablilla');
      t.classList.remove('sacudir'); void t.offsetWidth; t.classList.add('sacudir');
      pintar();
      setTimeout(() => { bajadas = []; pintar(); }, 600);
      return;
    }
    pintar();
  });
  el.querySelector('.acciones').addEventListener('click', e => {
    const accion = e.target.dataset.a;
    if (accion === 'cerrar') alCerrar();
    if (accion === 'ayuda') { estado.ayudas = (estado.ayudas || 0) + 1; bajadas = []; pintar(); }
  });
  pintar();
  el.hidden = false;
}
