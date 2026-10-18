import { crearAtlas, registrarTesoros, miniatura } from './texturas.js';
import { Render } from './render.js';
import { Entrada } from './entrada.js';
import { Juego } from './juego.js';
import { dibujarArma } from './arma.js';
import { dibujarAutomapa } from './automapa.js';
import { iniciarEscena, animarEscena } from './escena.js';
import { activarAudio, sonar, alternarSilencio, alternarMusica, ponerSilencio, ponerMusica, iniciarAmbiente, detenerAmbiente, atenuarAmbiente, actualizarAmbiente } from './audio.js';
import { abrirTablilla, elegirPista } from './acertijos.js';
import { MAZMORRAS } from '../datos/mazmorras.js';
import { TESOROS, TESORO, RAREZAS } from '../datos/tesoros.js';

const $ = s => document.querySelector(s);

if (matchMedia('(pointer: coarse)').matches) document.body.classList.add('tactil');

// ---------- Progreso guardado ----------

const CLAVE = 'reliquias:v1';
function leerProgreso() {
  try { const p = JSON.parse(localStorage.getItem(CLAVE)); if (p) return p; } catch (e) { /* sin almacenamiento */ }
  return { tesoros: [], pistas: [], mazmorras: {}, opciones: {} };
}
const progreso = leerProgreso();
progreso.opciones ||= {};
function guardar() { try { localStorage.setItem(CLAVE, JSON.stringify(progreso)); } catch (e) { /* sin almacenamiento */ } }

const CALIDADES = { alta: 1, media: 0.75, retro: 0.4 };
let calidad = progreso.opciones.calidad || 'alta';

// ---------- Inicio ----------

registrarTesoros(TESOROS);
const atlas = crearAtlas();
const vista = $('#vista');
let render;
try {
  render = new Render(vista);
  render.ponerAtlas(atlas);
} catch (e) {
  $('#portada .error').textContent = 'No se pudo iniciar el gráfico 3D: ' + e.message;
}

iniciarEscena($('#escena'));
const capaArma = $('#arma');
const ctxArma = capaArma.getContext('2d');
const capaMapa = $('#automapa');
const ctxMapa = capaMapa.getContext('2d');
const botones = new Map();
for (const b of document.querySelectorAll('[data-tactil]')) botones.set(b, b.dataset.tactil);
const entrada = new Entrada(vista, { zona: $('#zona-tactil'), base: $('#joy-base'), palanca: $('#joy-palanca'), botones });

let juego = null;
let pausado = true;
let ultimo = 0;
let msgTimer = 0;

function mostrar(id) {
  for (const p of document.querySelectorAll('.pantalla')) p.hidden = p.id !== id;
  // la escena de la entrada se ve detrás de los menús; al pasar de la portada, la cámara se acerca a la puerta
  animarEscena(id !== 'juego');
  document.body.classList.toggle('adentro', id !== 'portada');
  if (id === 'portada') pintarPortada();
}

function pintarPortada() {
  const total = TESOROS.length, tengo = progreso.tesoros.length;
  $('#pie-portada').textContent = tengo ? `Tesoros reunidos: ${tengo} de ${total}` : `${MAZMORRAS.length} mazmorras · ${total} tesoros por descubrir`;
}

function mensaje(t, seg = 3) {
  const m = $('#mensaje');
  m.textContent = t; m.classList.add('visible');
  clearTimeout(msgTimer);
  msgTimer = setTimeout(() => m.classList.remove('visible'), seg * 1000);
}

function destello(clase) {
  const d = $('#destello');
  d.className = ''; void d.offsetWidth; d.className = clase;
}

// ---------- Menús ----------

const ROMANOS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

function pintarMazmorras() {
  const lista = $('#lista-mazmorras');
  lista.innerHTML = '';
  for (const m of MAZMORRAS) {
    const ids = [...Object.values(m.tesoros), ...(m.laberinto?.tesoros || [])];
    const tengo = ids.filter(id => progreso.tesoros.includes(id)).length;
    const est = progreso.mazmorras[m.id] || {};
    const b = document.createElement('button');
    b.className = 'mazmorra';
    b.innerHTML = `<em class="numero">${ROMANOS[MAZMORRAS.indexOf(m)]}</em><strong>${m.nombre}</strong><span>${m.descripcion}</span>
      <div class="barra"><i style="width:${Math.round(tengo / ids.length * 100)}%"></i></div>
      <small>Tesoros ${tengo} de ${ids.length}${est.completada ? ' · Completada' : ''}</small>`;
    b.onclick = () => empezar(m);
    lista.appendChild(b);
  }
}

function pintarColeccion() {
  const g = $('#rejilla-tesoros');
  g.innerHTML = '';
  const tengo = new Set(progreso.tesoros);
  let valor = 0;
  for (const t of TESOROS) {
    const r = RAREZAS[t.rareza];
    const d = document.createElement('div');
    d.className = 'tesoro' + (tengo.has(t.id) ? '' : ' oculto');
    d.style.setProperty('--rareza', r.color);
    const img = miniatura(atlas, 'tesoro_' + t.id, 1);
    d.appendChild(img);
    const txt = document.createElement('div');
    txt.innerHTML = tengo.has(t.id)
      ? `<strong>${t.nombre}</strong><em>${r.nombre}</em><span>${t.descripcion}</span>`
      : `<strong>???</strong><em>${r.nombre}</em><span>Aún no lo encuentras.</span>`;
    d.appendChild(txt);
    g.appendChild(d);
    if (tengo.has(t.id)) valor += r.valor;
  }
  $('#resumen-coleccion').textContent = `${tengo.size} de ${TESOROS.length} tesoros · valor ${valor}`;
}

function pintarOpciones() {
  for (const b of document.querySelectorAll('[data-calidad]')) b.classList.toggle('activo', b.dataset.calidad === calidad);
}

document.addEventListener('click', e => {
  const b = e.target.closest('[data-ir]');
  if (!b) return;
  activarAudio();
  const ir = b.dataset.ir;
  if (ir === 'mazmorras') pintarMazmorras();
  if (ir === 'coleccion') pintarColeccion();
  if (ir === 'opciones') pintarOpciones();
  if (ir === 'portada') { juego = null; detenerAmbiente(); document.body.classList.remove('jugando'); }
  mostrar(ir);
});

for (const b of document.querySelectorAll('[data-calidad]')) b.onclick = () => {
  calidad = b.dataset.calidad; progreso.opciones.calidad = calidad; guardar(); pintarOpciones();
  document.body.classList.toggle('retro', calidad === 'retro');
};
document.body.classList.toggle('retro', calidad === 'retro');
function pintarSonido() {
  $('#btn-sonido').textContent = progreso.opciones.silencio ? 'Sonido: no' : 'Sonido: sí';
  $('#btn-musica').textContent = progreso.opciones.sinMusica ? 'Música: no' : 'Música: sí';
}
ponerSilencio(!!progreso.opciones.silencio);
ponerMusica(!progreso.opciones.sinMusica);
pintarSonido();
$('#btn-sonido').onclick = () => { progreso.opciones.silencio = alternarSilencio(); guardar(); pintarSonido(); };
$('#btn-musica').onclick = () => { progreso.opciones.sinMusica = alternarMusica(); guardar(); pintarSonido(); };

// ---------- Partida ----------

function empezar(def) {
  if (!render) return;
  activarAudio();
  juego = new Juego(def, {
    mensaje,
    tesoro(t, r) {
      const nuevo = !progreso.tesoros.includes(t.id);
      if (nuevo) { progreso.tesoros.push(t.id); guardar(); }
      mensaje(`${nuevo ? '¡Tesoro!' : 'Ya lo tenías:'} ${t.nombre} (${r.nombre})`, 4);
      destello('oro');
      actualizarHUD();
    },
    daño() { destello('rojo'); },
    abrirTablilla: a => abrirPanelTablilla(a),
    salida: r => terminar(r, true),
    muerte: r => setTimeout(() => terminar(r, false), 1400),
  });
  render.construir(juego.mapa);
  capaMapa.hidden = true;
  iniciarAmbiente(def.ambiente);
  document.body.classList.add('jugando');
  mostrar('juego');
  reanudar();
  mensaje(def.nombre, 3);
}

function reanudar() {
  pausado = false;
  entrada.activa = true;
  $('#pausa').hidden = true;
  atenuarAmbiente(false);
  ultimo = performance.now();
  if (!document.body.classList.contains('tactil')) vista.requestPointerLock?.();
}

function pausar() {
  if (!juego || pausado) return;
  pausado = true;
  entrada.activa = false;
  entrada.soltarTodo();
  atenuarAmbiente(true);
  if (document.pointerLockElement) document.exitPointerLock();
}

function abrirPanelTablilla(a) {
  pausar();
  const resueltas = new Set(progreso.pistas);
  if (!a.estado) a.estado = { titulo: a.titulo, pista: elegirPista(a.dificultad, resueltas), nivel: 0, vistas: new Set() };
  const panel = $('#panel');
  abrirTablilla(panel, a.estado, {
    alResolver(p) {
      if (!progreso.pistas.includes(p.id)) { progreso.pistas.push(p.id); guardar(); }
      panel.hidden = true;
      juego.resolverAcertijo(a);
      reanudar();
    },
    alCerrar() { panel.hidden = true; reanudar(); },
    nuevaPista() {
      a.estado.vistas.add(a.estado.pista.id);
      a.estado.pista = elegirPista(a.dificultad, resueltas, a.estado.vistas);
      a.estado.nivel = 0;
    },
  });
}

function terminar(r, exito) {
  pausar();
  if (exito) {
    const est = progreso.mazmorras[r.mazmorra.id] ||= {};
    est.completada = true;
    est.secretos = Math.max(est.secretos || 0, r.secretos);
    guardar();
  }
  const min = Math.floor(r.tiempo / 60), seg = Math.floor(r.tiempo % 60);
  $('#resumen h2').textContent = exito ? '¡Escapaste con vida!' : (r.causa || 'Has caído en la cripta.');
  $('#resumen .datos').innerHTML = `
    <li>Tesoros: <b>${r.tesoros.length}/${r.totalTesoros}</b></li>
    <li>Acertijos: <b>${r.acertijos}/${r.totalAcertijos}</b></li>
    <li>Pasadizos secretos: <b>${r.secretos}/${r.totalSecretos}</b></li>
    <li>Enemigos: <b>${r.abatidos}/${r.totalEnemigos}</b></li>
    <li>Tiempo: <b>${min}:${String(seg).padStart(2, '0')}</b></li>`;
  $('#resumen .tesoros').innerHTML = r.tesoros.map(id => `<span style="color:${RAREZAS[TESORO[id].rareza].color}">${TESORO[id].nombre}</span>`).join('');
  $('#btn-reintentar').onclick = () => empezar(r.mazmorra);
  mostrar('resumen');
  detenerAmbiente();
  document.body.classList.remove('jugando');
}

document.addEventListener('pointerlockchange', () => {
  if (!document.pointerLockElement && juego && !pausado && !document.body.classList.contains('tactil') && $('#panel').hidden) {
    pausar(); $('#pausa').hidden = false;
  }
});
$('#btn-continuar').onclick = () => reanudar();
$('#btn-menu-pausa').onclick = () => { $('#pausa').hidden = true; juego = null; detenerAmbiente(); document.body.classList.remove('jugando'); pintarMazmorras(); mostrar('mazmorras'); };
$('#btn-pausa').addEventListener('click', () => { pausar(); $('#pausa').hidden = false; });

function actualizarHUD() {
  const j = juego.j;
  $('#hud-vida').textContent = j.vida;
  $('#hud-vida').parentElement.classList.toggle('baja', j.vida <= 25);
  $('#hud-arma').textContent = j.arma === 'revolver' ? 'Revólver' : 'Látigo';
  $('#hud-balas').textContent = j.arma === 'revolver' ? `${j.tambor} | ${j.reserva}` : (j.tieneRevolver ? `${j.tambor} | ${j.reserva}` : '—');
  $('#hud-tesoros').textContent = `${juego.tesoros.length}/${juego.totalTesoros}`;
}

// ---------- Bucle principal ----------

let fpsT = 0, fpsN = 0;
function cuadro(t) {
  requestAnimationFrame(cuadro);
  if (!juego) return;
  const dt = Math.min(0.05, (t - ultimo) / 1000);
  ultimo = t;
  const ent = entrada.leer();
  if (ent.pulsos.has('pausa') && !pausado) { pausar(); $('#pausa').hidden = false; }
  if (ent.pulsos.has('mapa') && !pausado) capaMapa.hidden = !capaMapa.hidden;
  if (!pausado) { juego.actualizar(dt, ent); actualizarAmbiente(dt, juego.tension()); }

  render.ajustarTamano(CALIDADES[calidad]);
  // la antorcha titila
  const linterna = juego.j.muerto ? 0.3 : 0.92 + Math.sin(t * 0.013) * 0.05 + Math.sin(t * 0.031) * 0.04 + Math.sin(t * 0.071) * 0.025;
  render.dibujar(juego.camara(), juego.sprites(), { linterna, fogonazo: juego.fogonazo });

  const dpr = Math.min(devicePixelRatio || 1, 2);
  const w = Math.round(capaArma.clientWidth * dpr), h = Math.round(capaArma.clientHeight * dpr);
  if (capaArma.width !== w || capaArma.height !== h) { capaArma.width = w; capaArma.height = h; }
  dibujarArma(ctxArma, w, h, juego.j);
  if (!capaMapa.hidden) {
    if (capaMapa.width !== w || capaMapa.height !== h) { capaMapa.width = w; capaMapa.height = h; }
    dibujarAutomapa(ctxMapa, w, h, juego);
  }
  actualizarHUD();

  fpsN++; fpsT += dt;
  if (fpsT > 1) { $('#fps').textContent = `${Math.round(fpsN / fpsT)} fps`; fpsN = 0; fpsT = 0; }
}
requestAnimationFrame(cuadro);

// Pausa al salir de la pestaña.
document.addEventListener('visibilitychange', () => { if (document.hidden && juego && !pausado) { pausar(); $('#pausa').hidden = false; } });

// App instalable (sin conexión).
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});

mostrar('portada');
window.__reliquias = { get juego() { return juego; }, empezar, MAZMORRAS };
