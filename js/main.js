import { crearAtlas, registrarTesoros, miniatura, AURAS } from './texturas.js';
import { Render } from './render.js';
import { Etiquetas } from './etiquetas.js';
import { Entrada } from './entrada.js';
import { Juego, pinchosArriba } from './juego.js';
import { dibujarArma } from './arma.js';
import { dibujarAutomapa, dibujarMinimapa, LEYENDA, vistaMapa, reiniciarVistaMapa } from './automapa.js';
import { iniciarEscena, animarEscena } from './escena.js';
import { activarAudio, sonar, alternarSilencio, alternarMusica, ponerSilencio, ponerMusica, iniciarAmbiente, detenerAmbiente, atenuarAmbiente, actualizarAmbiente, tocarMusica, retenerMusica, sonarIntro, detenerIntro, TIEMPO_TITULO } from './audio.js';
import { abrirTablilla, elegirPista } from './acertijos.js';
import { abrirPalancas, crearPalancas } from './palancas.js';
import { recortarZonas, azarConSemilla } from './laberinto.js';
import { Sala, COLORES, HZ_POSICION, codigoValido, normalizarCodigo, enlaceDeSala, enlaceWhatsApp } from './red.js';
import { MAZMORRAS, tesorosDe } from '../datos/mazmorras.js';
import { TESOROS, TESORO, RAREZAS } from '../datos/tesoros.js';
import { SALAS, LORE_FORMA, LORE_RAREZA } from '../datos/museo.js';
import { lienzoEmblema } from '../datos/emblemas.js';

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
// Antes de entrar se elige el modo y el tamaño (cuántas zonas de la mazmorra). El tiempo para salir depende del tamaño.
const TAMANOS = {
  pequena: { zonas: 1, minutos: 10 },
  mediana: { zonas: 2, minutos: 20 },
  grande: { zonas: Infinity, minutos: 30 },
};
// Salas. Competitivo: tesoros exclusivos, sin reloj hasta que el primero encuentra la salida (entonces los demás tienen esta cuenta atrás,
// constante, para escapar) y los cazadores pueden herirse. Cooperativo: tesoros compartidos, sin daño entre amigos y un reloj fijo según el tamaño.
const CUENTA_COMPETITIVO = { pequena: 90, mediana: 120, grande: 150 };
const MINUTOS_COOPERATIVO = { pequena: 10, mediana: 20, grande: 30 };
const prep = { tamano: progreso.opciones.tamano || 'grande' };
// Lo que el anfitrión elige en el lobby de una sala (se guarda para la próxima).
const ajustesSala = { mazmorra: progreso.opciones.salaMazmorra || MAZMORRAS[0].id, tamano: progreso.opciones.salaTamano || 'grande', modo: progreso.opciones.salaModo || 'competitivo' };
let elegida = null;   // la mazmorra de la pantalla de preparación
let actual = null;    // la partida en curso { def, tamano, limite }, para jugar de nuevo
let calidad = progreso.opciones.calidad || 'alta';

// ---------- Inicio ----------

registrarTesoros(TESOROS);
const atlas = crearAtlas();
const vista = $('#vista');
let render;
const etiquetas = new Etiquetas($('#etiquetas'), vista);
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
const ctxMini = $('#minimapa').getContext('2d');
// Leyenda del mapa completo: sus muestras se dibujan con los mismos colores del mapa.
const leyenda = $('#leyenda-mapa');
for (const [nombre, dibujar, solo] of LEYENDA) {
  const li = document.createElement('li'), c = document.createElement('canvas');
  c.width = c.height = 28;
  const g = c.getContext('2d'); g.translate(14, 14); g.scale(1.4, 1.4); dibujar(g);
  li.append(c, nombre);
  if (solo) li.dataset.solo = solo;
  leyenda.appendChild(li);
}
function plegarLeyenda(abrir = false) {
  leyenda.hidden = !abrir;
  $('#btn-leyenda').setAttribute('aria-expanded', String(abrir));
}
$('#btn-leyenda').onclick = () => plegarLeyenda(leyenda.hidden);
function alternarMapa() {
  if (!juego) return;
  plegarLeyenda();
  reiniciarVistaMapa();
  capaMapa.hidden = !capaMapa.hidden;
  if (!capaMapa.hidden) juego.avisoMapa = false;
}
$('#btn-cerrar-mapa').onclick = alternarMapa;
// Zoom y desplazamiento del mapa: pellizco o rueda para acercar, arrastre para mover, doble toque para volver.
{
  const dedos = new Map();
  let distancia = 0, ultimoToque = 0;
  const k = () => capaMapa.width / (capaMapa.clientWidth || 1);
  const acercar = (factor, px, py) => {
    const z = Math.max(1, Math.min(8, vistaMapa.zoom * factor)), f = z / vistaMapa.zoom;
    const cx = capaMapa.width / 2, cy = capaMapa.height / 2;
    vistaMapa.x = px - cx - (px - cx - vistaMapa.x) * f; vistaMapa.y = py - cy - (py - cy - vistaMapa.y) * f;
    vistaMapa.zoom = z;
    if (z === 1) { vistaMapa.x = 0; vistaMapa.y = 0; }
  };
  const medir = () => { const [a, b] = [...dedos.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
  capaMapa.addEventListener('pointerdown', e => {
    capaMapa.setPointerCapture(e.pointerId);
    dedos.set(e.pointerId, { x: e.offsetX * k(), y: e.offsetY * k() });
    if (dedos.size === 2) distancia = medir();
    if (dedos.size === 1) { const ahora = performance.now(); if (ahora - ultimoToque < 300) reiniciarVistaMapa(); ultimoToque = ahora; }
  });
  capaMapa.addEventListener('pointermove', e => {
    const d = dedos.get(e.pointerId); if (!d) return;
    const x = e.offsetX * k(), y = e.offsetY * k();
    if (dedos.size === 1) { vistaMapa.x += x - d.x; vistaMapa.y += y - d.y; }
    d.x = x; d.y = y;
    if (dedos.size === 2) {
      const [a, b] = [...dedos.values()], nueva = medir();
      if (distancia > 0) acercar(nueva / distancia, (a.x + b.x) / 2, (a.y + b.y) / 2);
      distancia = nueva;
    }
  });
  const soltar = e => { dedos.delete(e.pointerId); distancia = 0; };
  capaMapa.addEventListener('pointerup', soltar); capaMapa.addEventListener('pointercancel', soltar);
  capaMapa.addEventListener('wheel', e => { e.preventDefault(); acercar(e.deltaY < 0 ? 1.2 : 1 / 1.2, e.offsetX * k(), e.offsetY * k()); }, { passive: false });
}
$('#hud-arma').closest('.caja').dataset.tactil = 'recargar';   // en táctil, tocar el recuadro del arma recarga
const botones = new Map();
for (const b of document.querySelectorAll('[data-tactil]')) botones.set(b, b.dataset.tactil);
const botonUsar = $('#t-usar');
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
  // la música: el tema de la aventura en los menús; al preparar una expedición, el de esa mazmorra
  if (id === 'preparar') tocarMusica(elegida.ambiente);
  else if (id !== 'juego') tocarMusica('portada');
  // deja una entrada en el historial para que el botón atrás del celular vuelva al menú en vez de cerrar el juego
  if (id !== 'portada' && !history.state?.reliquias) history.pushState({ reliquias: 1 }, '');
}

// Atrás: cierra la ficha abierta, pausa la partida o vuelve al menú anterior. Responde si hizo algo.
function atras() {
  if (!$('#ficha').hidden) { $('#ficha').hidden = true; return true; }
  const visible = document.querySelector('.pantalla:not([hidden])');
  if (visible?.id === 'juego') {
    if ($('#pausa').hidden && $('#panel').hidden) { pausar(); $('#pausa').hidden = false; }
    return true;
  }
  const b = visible?.querySelector('.atras, .atras-texto');
  b?.click();
  return !!b;
}
addEventListener('popstate', () => {
  if (atras()) history.pushState({ reliquias: 1 }, '');
  else history.back();   // en la portada, atrás sale del juego
});
addEventListener('keydown', e => {
  if (e.key === 'Escape' && document.querySelector('.menu:not([hidden])')) atras();
});

function pintarPortada() {
  $('#btn-tesoros').classList.toggle('con-nuevos', !!(progreso.nuevos || []).length);
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

// Aviso de daño por encima del mapa y de las tablillas, donde el destello rojo solo no basta: dice cuánto y quién o qué.
let alertaT = 0;
function avisarDaño(n, causa) {
  const a = $('#alerta-dano');
  const que = !causa || causa === 'Has caído en la cripta.' ? '¡Te están atacando!' : causa.replace(/ te derrotó\.$/, ' te ataca').replace(/\.$/, '');
  a.textContent = `−${Math.round(n)} · ${que}`;
  a.classList.remove('visible'); void a.offsetWidth; a.classList.add('visible');
  clearTimeout(alertaT);
  alertaT = setTimeout(() => a.classList.remove('visible'), 2600);
}

// ---------- Menús ----------

// El navegador deja sonar el audio recién cuando el jugador toca algo.
for (const ev of ['pointerdown', 'pointerup', 'touchend', 'keydown']) addEventListener(ev, activarAudio, { passive: true });

// Sonidos de los menús: al pasar el ratón y al elegir.
const enMenu = b => b?.closest('.menu, #pausa');
const ALTERNAR = '[data-sens], [data-sensr], [data-calidad], [data-tamano], [data-sala-tamano], [data-sala-modo], #btn-zurdo, #btn-vibrar, #btn-sonido, #btn-musica';
document.addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!enMenu(b)) return;
  activarAudio();
  sonar(b.id === 'btn-entrar' ? 'menu_entrar' : b.matches('.atras, .atras-texto, .cerrar') ? 'menu_atras' : b.matches(ALTERNAR) ? 'menu_alternar' : 'menu_elegir');
}, true);
let bajoRaton = null;
document.addEventListener('pointerover', e => {
  const b = e.target.closest('button');
  if (e.pointerType !== 'mouse' || b === bajoRaton) return;
  bajoRaton = b;
  if (enMenu(b) && !b.disabled) sonar('menu_pasar');
});

const ROMANOS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

// ---------- Preparar la expedición ----------

// las mazmorras sin zonas tienen un solo tamaño
const tamanoDe = def => def.sectores ? prep.tamano : 'grande';
const limiteDe = def => TAMANOS[tamanoDe(def)].minutos * 60;
const minuscula = t => t[0].toLowerCase() + t.slice(1);

function abrirPreparar(def) {
  elegida = def;
  pintarPreparar();
  mostrar('preparar');
}
function pintarPreparar() {
  const def = elegida, Z = def.sectores, tam = tamanoDe(def);
  $('#preparar h2').textContent = def.nombre;
  $('#prep-desc').textContent = def.descripcion;
  $('#prep-grupo-tamano').hidden = !Z;
  for (const b of document.querySelectorAll('[data-tamano]')) b.classList.toggle('activo', b.dataset.tamano === tam);
  const n = TAMANOS[tam].zonas, z = Z?.zonas || [];
  $('#nota-tamano').textContent = !Z ? ''
    : n === 1 ? `Solo la primera zona: ${minuscula(z[0].nombre)}. La salida se esconde en ella.`
    : n === 2 ? `Las dos primeras zonas: ${minuscula(z[0].nombre)} y ${minuscula(z[1].nombre)}.`
    : `Las ${z.length} zonas, con ${minuscula(z.at(-1).nombre)} tras un pasadizo secreto.`;
  $('#nota-modo').textContent = `Tienes ${limiteDe(def) / 60} minutos para reunir reliquias y salir. Solo cuentan las que te llevas al escapar: si te atrapan o caes, pierdes todo el botín.`;
}
const elegir = (clave, valor) => { prep[clave] = valor; progreso.opciones[clave] = valor; guardar(); pintarPreparar(); };
for (const b of document.querySelectorAll('[data-tamano]')) b.onclick = () => elegir('tamano', b.dataset.tamano);
$('#btn-entrar').onclick = () => empezar(elegida, tamanoDe(elegida), limiteDe(elegida));

// Para abrir una mazmorra hay que haber reunido esta parte de los tesoros de la anterior (la primera siempre está abierta).
const UMBRAL_DESBLOQUEO = 0.5;
const fraccion = m => { const ids = tesorosDe(m); return ids.filter(id => progreso.tesoros.includes(id)).length / ids.length; };
const previaPendiente = m => { const k = MAZMORRAS.indexOf(m); return k > 0 && fraccion(MAZMORRAS[k - 1]) < UMBRAL_DESBLOQUEO ? MAZMORRAS[k - 1] : null; };
function pintarMazmorras() {
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
const ORDEN_RAREZA = ['legendario', 'epico', 'raro', 'comun'];
let museoIdx = 0;
// Museo: una vitrina por mazmorra (con su historia, del tesoro más raro al más común) que se recorre deslizando hacia el lado.
function pintarColeccion() {
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
  // el lore de la pieza: su forma, su rareza y la mazmorra donde se esconde (solo una vez hallada)
  f.querySelector('.lore').textContent = lo ? [LORE_FORMA[t.forma], LORE_RAREZA[t.rareza], m && SALAS[m.id] ? `Se expone en la ${SALAS[m.id].sala}${m.guardian ? `, la que vigilaba ${m.guardian.nombre}` : ''}.` : ''].filter(Boolean).join(' ') : '';
  f.querySelector('small').textContent = m ? (lo ? 'Hallado en ' : 'Se esconde en ') + m.nombre : '';
  f.hidden = false;
}
$('#ficha').onclick = e => { if (e.target.id === 'ficha' || e.target.closest('.cerrar')) $('#ficha').hidden = true; };

// Muro común y pasadizo secreto lado a lado, con las mismas texturas del juego (los de la Cripta del Escarabajo).
function pintarAyuda() {
  for (const [id, tex] of [['#fig-muro', 'piedra'], ['#fig-secreto', 'piedra_grieta']]) {
    const g = $(id).getContext('2d');
    g.imageSmoothingEnabled = false;
    g.drawImage(miniatura(atlas, tex, 1), 0, 0, 128, 128);
  }
}
function pintarOpciones() {
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
function vibrar(ms) {
  if (progreso.opciones.sinVibrar || !document.body.classList.contains('tactil')) return;
  try { navigator.vibrate?.(ms); } catch (e) { /* sin vibración */ }
}
aplicarControles();

document.addEventListener('click', e => {
  const b = e.target.closest('[data-ir]');
  if (!b) return;
  activarAudio();
  const ir = b.dataset.ir;
  if (ir === 'mazmorras') pintarMazmorras();
  if (ir === 'coleccion') pintarColeccion();
  if (ir === 'opciones') pintarOpciones();
  if (ir === 'ayuda') pintarAyuda();
  if (ir === 'unirse') abrirUnirse();
  if (sala && (ir === 'mazmorras' || ir === 'portada' || ir === 'entrar')) cerrarSala();
  if (ir === 'entrar') { abrirEntrar(); return; }
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

// ---------- Salas con amigos ----------

let sala = null;                 // la conexión con la sala (js/red.js), mientras haya una
const cazadores = new Map();     // los otros cazadores en la cripta: puesto -> { nombre, x, y, z, yaw, pt, rx, rz }
let ultimoMarcador = null;
let cuentaAtras = 0;
let envioT = 0, enemigosT = 0, hudSalaT = 0, hudSalaClave = '';

const nombreElegido = () => (progreso.opciones.nombre || '').trim();
function guardarNombreSala(n) {
  n = n.trim().slice(0, 16);
  if (n && n !== progreso.opciones.nombre) { progreso.opciones.nombre = n; guardar(); }
  return n;
}

function abrirUnirse(codigo = '') {
  $('#sala-nombre').value = nombreElegido();
  $('#sala-codigo').value = codigo;
  $('#unirse-error').textContent = '';
  $('#unirse-sub').textContent = codigo ? `Te invitaron a la sala ${codigo}. Ponte un nombre y entra.` : 'Escribe el código que te mandó tu amigo.';
  if (document.querySelector('.pantalla:not([hidden])')?.id !== 'unirse') mostrar('unirse');
}
$('#sala-codigo').addEventListener('input', e => { e.target.value = normalizarCodigo(e.target.value); });

async function conectar(boton, texto, tarea, alFallar) {
  const antes = boton.innerHTML;   // el botón puede llevar título y subtítulo: se restaura tal cual
  boton.disabled = true; boton.textContent = texto;
  try { return await tarea(); }
  catch (e) { alFallar(e.message); }
  finally { boton.disabled = false; boton.innerHTML = antes; }
}

$('#btn-unirse').onclick = async () => {
  const codigo = normalizarCodigo($('#sala-codigo').value), error = $('#unirse-error');
  if (!codigoValido(codigo)) { error.textContent = 'El código son 4 letras.'; return; }
  error.textContent = '';
  const nombre = guardarNombreSala($('#sala-nombre').value);
  const s = await conectar($('#btn-unirse'), 'Conectando…', () => Sala.unirse(codigo, nombre), m => { error.textContent = m; });
  if (s) { enlazarSala(s); mostrar('sala'); pintarLobby(); }
};

// Nombres de leyenda para quien no se decide: un título y un lugar, o un epíteto.
const NOMBRES_A = ['Sombra', 'Halcón', 'Escarabajo', 'Chacal', 'Cuervo', 'Lobo', 'Ceniza', 'Arena', 'Brasa', 'Eco', 'Ónice', 'Jaguar'];
const NOMBRES_B = ['del Nilo', 'de Jade', 'de la Cripta', 'del Desierto', 'sin Miedo', 'de Oro', 'del Ocaso', 'de Piedra', 'Silente', 'Errante', 'del Norte', 'de Obsidiana'];
$('#btn-sugerir-nombre').onclick = () => {
  const el = $('#entrar-nombre'), pick = l => l[Math.floor(Math.random() * l.length)];
  let n;
  do { n = `${pick(NOMBRES_A)} ${pick(NOMBRES_B)}`; } while (n.length > 16 || n === el.value);
  el.value = n;
  el.focus();
};

// Pantalla «Entrar»: jugar solo, crear una sala (los ajustes se eligen después, en el lobby) o unirse con un código.
function abrirEntrar() {
  $('#entrar-nombre').value = nombreElegido();
  $('#entrar-error').textContent = '';
  mostrar('entrar');
}
$('#btn-solo').onclick = () => { pintarMazmorras(); mostrar('mazmorras'); };
$('#btn-unirme').onclick = () => { guardarNombreSala($('#entrar-nombre').value); abrirUnirse(); };
$('#btn-crear').onclick = async () => {
  const nombre = guardarNombreSala($('#entrar-nombre').value);
  const s = await conectar($('#btn-crear'), 'Creando sala…', () => Sala.crear(nombre), m => { $('#entrar-error').textContent = m; });
  if (!s) return;
  s.ponerConfig(configDeSala());
  enlazarSala(s);
  mostrar('sala');
  pintarLobby();
};

// La configuración que el anfitrión difunde a la sala, según lo que eligió en el lobby.
function configDeSala() {
  const a = ajustesSala, def = MAZMORRAS.find(m => m.id === a.mazmorra) || MAZMORRAS[0];
  const tamano = def.sectores ? a.tamano : 'grande';
  const coop = a.modo === 'cooperativo';
  return { mazmorra: def.id, tamano, modo: a.modo, limite: coop ? MINUTOS_COOPERATIVO[tamano] * 60 : 0, apuro: coop ? 0 : CUENTA_COMPETITIVO[tamano], tesoros: coop ? 'compartidos' : 'exclusivos', combate: !coop };
}
function cambiarAjusteSala(clave, valor, guardada = clave) {
  ajustesSala[clave] = valor;
  progreso.opciones[{ mazmorra: 'salaMazmorra', tamano: 'salaTamano', modo: 'salaModo' }[guardada] || guardada] = valor;
  guardar();
  if (sala?.soyAnfitrion && !sala.enPartida) sala.ponerConfig(configDeSala());
}
for (const b of document.querySelectorAll('[data-sala-tamano]')) b.onclick = () => cambiarAjusteSala('tamano', b.dataset.salaTamano);
for (const b of document.querySelectorAll('[data-sala-modo]')) b.onclick = () => cambiarAjusteSala('modo', b.dataset.salaModo);
$('#sala-mazmorra').innerHTML = MAZMORRAS.map(m => `<option value="${m.id}">${m.nombre}</option>`).join('');
$('#sala-mazmorra').onchange = e => cambiarAjusteSala('mazmorra', e.target.value);

function pintarAjustesSala() {
  const a = ajustesSala, def = MAZMORRAS.find(m => m.id === a.mazmorra) || MAZMORRAS[0], tam = def.sectores ? a.tamano : 'grande';
  $('#sala-mazmorra').value = def.id;
  $('#sala-grupo-tamano').hidden = !def.sectores;
  for (const b of document.querySelectorAll('[data-sala-tamano]')) b.classList.toggle('activo', b.dataset.salaTamano === tam);
  for (const b of document.querySelectorAll('[data-sala-modo]')) b.classList.toggle('activo', b.dataset.salaModo === a.modo);
  const seg = CUENTA_COMPETITIVO[tam], min = MINUTOS_COOPERATIVO[tam];
  $('#nota-modo-sala').textContent = a.modo === 'competitivo'
    ? `Cada tesoro es del primero que lo toma y los cazadores pueden herirse: quien cae suelta su último tesoro. No hay reloj hasta que alguien encuentra la salida: entonces queda marcada en el mapa y los demás tienen ${seg} segundos para escapar. Si no lo logran, pierden el botín.`
    : `Todo el equipo contra la cripta: sin daño entre amigos, los compañeros se ven siempre en el mapa y tienen ${min} minutos. Quien cae puede ser reanimado por un compañero. El botín es de todos y solo cuenta si todos escapan con vida.`;
}

function enlazarSala(s) {
  sala = s;
  ultimoMarcador = null;
  s.alCambiar = () => { pintarLobby(); };
  s.alEmpezar = p => comenzarCuenta(p);
  s.alPosicion = (id, p) => posicionDeCazador(id, p);
  s.alMarcador = lista => {
    ultimoMarcador = lista;
    for (const f of lista) if (f.estado !== 'jugando') cazadores.delete(f.id);   // quien terminó ya no está en la cripta
    pintarMarcador();
    resolverCoop();
  };
  s.alPerderse = motivo => perderSala(motivo);
  s.alTesoro = (i, id) => tesoroDeSala(i, id);
  s.alEnlace = ok => { if (enPartidaDeSala()) mensaje(ok ? 'Volviste a la sala.' : 'Se cortó la conexión con la sala. Reconectando…', ok ? 3 : 6); };
  s.alConexion = (id, ok) => { if (enPartidaDeSala()) mensaje(`${s.jugadores.find(j => j.id === id)?.nombre || 'Un cazador'} ${ok ? 'volvió a la cripta' : 'perdió la conexión'}`, 3); };
  s.alEnemigos = snap => { if (enPartidaDeSala()) juego.recibirEnemigos(snap); };
  s.alGolpe = (i, daño) => { const e = enPartidaDeSala(true) && juego.enemigos[i]; if (e && e.estado !== 'muerto') juego.herir(e, daño); };
  s.alPvp = (de, d) => { if (enPartidaDeSala()) juego.recibirGolpe(d, { id: de, nombre: nombreDe(de) }); };
  s.alBaja = (k, v) => {
    if (!enPartidaDeSala()) return;
    if (v === sala.yo) return;   // mi propia derrota ya la conté
    mensaje(k === sala.yo ? `Derrotaste a ${nombreDe(v)}` : `${nombreDe(k)} derrotó a ${nombreDe(v)}`, 4);
  };
  s.alDano = (n, causa) => { if (enPartidaDeSala()) juego.dañarJugador(n, causa); };
  s.alResuelto = (a, id) => acertijoDeSala(a, id);
  s.alForzado = (id, a) => { if (enPartidaDeSala()) mensaje(`${sala.jugadores.find(q => q.id === id)?.nombre || 'Otro cazador'} forzó una puerta`, 3); };
  s.alMundo = (k, n, id) => {
    if (!enPartidaDeSala()) return;
    if (k === 'cae') {
      avisos.set(id, performance.now() + 20000);   // su marca queda en el mapa hasta que lo reaniman
      mensaje(`${nombreDe(id)} cayó: llega hasta él y pulsa «Usar» para reanimarlo`, 6);
      sonar('error');
      return;
    }
    if (k === 'reanima') {
      if (n === sala.yo) juego.levantar();
      else { avisos.delete(n); mensaje(`${nombreDe(id)} reanimó a ${nombreDe(n)}`, 3); }
      return;
    }
    if (k === 'cofre') { const o = juego.objetos[n]; if (o) juego.abrirCofreObj(o); }
    else if (k === 'antorcha') juego.encender(n, true);
    else if (k === 'objeto') juego.retirar(n);
  };
  s.alCuenta = (seg, id) => {
    if (!enPartidaDeSala() || !juego) return;
    juego.iniciarCuenta(seg);
    $('#hud-reloj').hidden = false;
    document.body.classList.add('contrarreloj');
    mensaje(`${id === sala.yo ? 'Encontraste' : nombreDe(id) + ' encontró'} la salida: está marcada en el mapa. ¡${seg} segundos para escapar!`, 7);
  };
  s.alSuelto = (i, x, z) => { const o = actual?.sala && juego?.objetos[i]; if (o?.tipo === 'tesoro') juego.reponer(o, x, z); else if (o?.tipo === 'llave' || o?.tipo === 'barreta') Object.assign(o, { cogido: false, x, z }); };
}

function cerrarSala() {
  clearInterval(cuentaAtras);
  $('#cuenta').hidden = true;
  const s = sala;
  sala = null;
  cazadores.clear();
  $('#hud-sala').hidden = true;
  s?.cerrar();
}

// Se cayó la conexión (el anfitrión salió): quien está jugando sigue su partida solo.
function perderSala(motivo) {
  sala = null;
  cazadores.clear();
  clearInterval(cuentaAtras);
  $('#cuenta').hidden = true;
  const donde = document.querySelector('.pantalla:not([hidden])')?.id;
  if (donde === 'juego') { mensaje(motivo, 5); $('#hud-sala').hidden = true; if (juego) juego.rol = null; }   // sin anfitrión, cada enemigo lo simula uno mismo
  else if (donde === 'resumen') pintarMarcador();
  else { abrirUnirse(); $('#unirse-error').textContent = motivo; }
}

function pintarLobby() {
  if (!sala) return;
  const anfitrion = sala.soyAnfitrion, lista = sala.jugadores, c = sala.config;
  $('#sala-codigo-vista').textContent = sala.codigo;
  $('#sala-invitar').hidden = !anfitrion;
  $('#sala-ajustes').hidden = !anfitrion;
  if (anfitrion) pintarAjustesSala();
  $('#sala-sub').textContent = anfitrion
    ? (lista.length > 1 ? 'Empieza cuando estén todos.' : 'Comparte el enlace y espera a tus amigos.')
    : 'Esperando a que el anfitrión empiece la partida…';
  const ul = $('#sala-jugadores');
  ul.innerHTML = '';
  for (const j of lista) {
    const li = document.createElement('li'), nombre = document.createElement('b'), est = document.createElement('small');
    li.className = j.id === sala.yo ? 'yo' : '';
    li.insertAdjacentHTML('afterbegin', `<i class="sombrero ${j.color}"></i>`);
    nombre.textContent = j.nombre + (j.id === 0 ? ' (anfitrión)' : '');
    est.textContent = j.estado === 'jugando' ? 'en la cripta' : 'listo';
    li.append(nombre, est);
    ul.appendChild(li);
  }
  const def = c && MAZMORRAS.find(m => m.id === c.mazmorra);
  $('#sala-config').textContent = def ? `${def.nombre}${def.sectores ? ` · ${TAMANOS[c.tamano] ? ['pequeña', 'mediana', 'grande'][Object.keys(TAMANOS).indexOf(c.tamano)] : ''}` : ''} · ${c.modo === 'cooperativo' ? `cooperativo · ${c.limite / 60} minutos` : `competitivo · ${c.apuro} s tras la primera salida`}` : '';
  const boton = $('#btn-empezar-sala');
  boton.hidden = !anfitrion;
  boton.disabled = !lista.every(j => j.estado === 'sala') || !$('#cuenta').hidden;
}

$('#btn-salir-sala').onclick = () => {
  const eraAnfitrion = sala?.soyAnfitrion;
  cerrarSala();
  abrirEntrar();
};

$('#btn-whatsapp').onclick = () => window.open(enlaceWhatsApp(sala.codigo, nombreElegido() || 'Un amigo'), '_blank', 'noopener');
$('#btn-copiar-enlace').onclick = async () => {
  const b = $('#btn-copiar-enlace'), enlace = enlaceDeSala(sala.codigo), antes = b.textContent;
  try { await navigator.clipboard.writeText(enlace); b.textContent = 'Enlace copiado'; setTimeout(() => { b.textContent = antes; }, 2200); }
  catch (e) { prompt('Copia el enlace de la sala:', enlace); }
};

$('#btn-empezar-sala').onclick = () => {
  if (!sala?.soyAnfitrion) return;
  const c = sala.config;
  sala.empezar({ semilla: Math.floor(Math.random() * 2 ** 32), mazmorra: c.mazmorra, tamano: c.tamano, limite: c.limite, modo: c.modo, apuro: c.apuro, tesoros: c.tesoros, combate: !!c.combate, jugadores: sala.jugadores.length, cuenta: 3 });
};

// 3, 2, 1 y todos entran a la vez a la misma cripta (la semilla da el mismo mapa, los mismos enemigos y las mismas reliquias).
function comenzarCuenta(p) {
  const def = MAZMORRAS.find(m => m.id === p.mazmorra);
  if (!def || !sala) return;
  $('#btn-empezar-sala').disabled = true;
  let n = p.cuenta || 3;
  const num = $('#cuenta-num');
  $('#cuenta').hidden = false;
  num.textContent = n; sonar('menu_alternar');
  clearInterval(cuentaAtras);
  cuentaAtras = setInterval(() => {
    if (--n > 0) { num.textContent = n; sonar('menu_alternar'); return; }
    clearInterval(cuentaAtras);
    $('#cuenta').hidden = true;
    empezar(def, p.tamano, p.limite, { semilla: p.semilla, azarPistas: azarConSemilla(p.semilla ^ 0x9e3779b9), tesoros: p.tesoros, combate: !!p.combate, jugadores: p.jugadores || 1, coop: p.modo === 'cooperativo' });
  }, 1000);
}

function iniciarPartidaEnSala() {
  cazadores.clear();
  envioT = 0; hudSalaClave = ''; ultimoMarcador = null;
  $('#hud-sala').hidden = !actual.sala;
  if (actual.sala) sala?.ponerEstado('jugando');
}

// El anfitrión responde quién se llevó cada tesoro: yo (lo tomo) o otro cazador (queda su nota).
function reclamarTesoro(o) {
  if (!sala) { juego.tomar(o); return; }
  sala.tomar(o.n);
  setTimeout(() => { o.pendiente = false; }, 2500);   // por si la respuesta se pierde, se puede volver a pedir
}
// Quien se lleva un tesoro queda a la vista en el automapa unos segundos, aunque esté en una zona que no has explorado.
const AVISO_MS = 8000;
const avisos = new Map();   // puesto -> hasta cuándo se le ve
const nombreDe = id => sala?.jugadores.find(j => j.id === id)?.nombre || 'Otro cazador';
function tesoroDeSala(i, id) {
  const o = actual?.sala && !actual.sala.fin && juego?.objetos[i];
  if (!o || o.tipo !== 'tesoro' || o.cogido) return;
  if (id === sala.yo) { juego.tomar(o); return; }
  const j = sala.jugadores.find(q => q.id === id);
  juego.ceder(o, { nombre: j?.nombre || 'Otro cazador', color: j?.color || 'rojo' });
  avisos.set(id, performance.now() + AVISO_MS);
  mensaje(`${j?.nombre || 'Otro cazador'} se llevó ${TESORO[o.tesoro].nombre}`, 3);
}

// Con tesoros exclusivos cada acertijo se descifra una sola vez: el anfitrión dice quién fue primero.
// El sello se abre para todos.
const acertijosExclusivos = () => !!sala && !!actual?.sala && actual.sala.tesoros !== 'compartidos';
let tablillaAbierta = null;
function enviarAcertijo(a) {
  a.enviado = true;
  sala.resolver(a.id);
  setTimeout(() => { if (a.enviado && !a.resuelto && sala) sala.resolver(a.id); }, 2500);   // por si la respuesta se pierde
}
function acertijoDeSala(id, quien) {
  const a = actual?.sala && !actual.sala.fin && juego?.mapa.acertijos[id];
  if (!a || a.resuelto) return;
  const yoLoEnvie = a.enviado;
  a.enviado = false;
  if (quien === sala.yo) { juego.resolverAcertijo(a); return; }
  const nombre = nombreDe(quien);
  const tarde = tablillaAbierta === a || yoLoEnvie;
  a.ajeno = { nombre };
  if (tablillaAbierta === a) { $('#panel').hidden = true; tablillaAbierta = null; reanudar(); }
  juego.resolverAcertijo(a, nombre, tarde);
}

const HEX_CAZADOR = { rojo: '#ff5a48', azul: '#4f8cff', verde: '#4fd070', amarillo: '#ffd23a' };   // más vivos que los del sombrero, para verse sobre el mapa

// ¿Hay una partida de sala en curso? (`aunqueTermine`: el anfitrión sigue simulando a los enemigos para los demás)
const enPartidaDeSala = (aunqueTermine = false) => !!juego && !!actual?.sala && (aunqueTermine || !actual.sala.fin);

function posicionDeCazador(id, p) {
  if (!sala || id === sala.yo) return;
  if (!p) {
    const c = cazadores.get(id);
    if (c && actual?.sala && !actual.sala.fin) mensaje(`${c.nombre} salió de la sala`, 3);
    cazadores.delete(id);
    return;
  }
  let c = cazadores.get(id);
  if (!c) {
    c = { nombre: sala.jugadores.find(j => j.id === id)?.nombre || 'Un cazador', rx: p.x, rz: p.z, ry: p.y };
    cazadores.set(id, c);
  }
  Object.assign(c, { x: p.x, y: p.y, z: p.z, yaw: p.yaw, pt: p.pt, m: p.m });
}

// Cada cuadro: mando mi posición unas veces por segundo y dibujo a los demás, suavizando sus saltos.
function cuadroDeSala(t, dt, sprites) {
  if (sala && !actual.sala.fin) {
    envioT += dt;
    if (envioT >= 1 / HZ_POSICION) {
      envioT = 0;
      const j = juego.j;
      sala.enviarPosicion({ x: j.x, y: j.y, z: j.z, yaw: j.yaw, pt: juego.puntos(), m: j.muerto });
    }
  }
  // el anfitrión es quien mueve a los enemigos: persiguen al más cercano de todos y reparte cómo están
  if (sala?.soyAnfitrion) {
    juego.blancos = [...cazadores].map(([id, c]) => ({ id, x: c.x, y: c.y, z: c.z, muerto: !!c.m }));
    if (actual.sala.fin && cazadores.size) juego.simularRemotos(dt);   // yo ya terminé, ellos siguen
    enemigosT += dt;
    if (enemigosT >= 0.1) { enemigosT = 0; sala.enviarEnemigos(juego.instantanea()); }
  }
  const k = 1 - Math.exp(-dt * 14), m = juego.mapa;
  juego.otros = [];
  juego.companeros = juego.coop ? [...cazadores].map(([id, c]) => ({ id, x: c.rx, z: c.rz, muerto: !!c.m })) : [];
  if (juego.coop && juego.j.muerto && !juego.terminado && t - hudSalaT > 400 && equipoCaido()) {
    juego.terminado = true;
    terminar(juego.resumen('Todo el equipo cayó: nadie puede reanimar a nadie.'), false);
    return;
  }
  juego.rivales = juego.combate ? [...cazadores].map(([id, c]) => ({ id, x: c.rx, y: c.ry, z: c.rz, muerto: !!c.m })) : [];
  for (const [id, c] of cazadores) {
    const antes = Math.hypot(c.x - c.rx, c.z - c.rz);
    c.rx += (c.x - c.rx) * k; c.rz += (c.z - c.rz) * k; c.ry += (c.y - c.ry) * k;
    const camina = antes / Math.max(dt, 0.001) > 0.8;
    const color = sala?.jugadores.find(j => j.id === id)?.color || COLORES[id % COLORES.length];
    const aviso = (avisos.get(id) || 0) > t;
    if (aviso || !juego.combate) juego.otros.push({ x: c.rx, z: c.rz, color, aviso, nombre: c.nombre });   // con combate, solo se les ve en el mapa tras tomar un tesoro
    sprites.push({ x: c.rx, z: c.rz, y: c.ry, ancho: 0.95, alto: 0.95, tex: `cazador_${color}_${camina ? Math.floor(t / 180) % 2 : 8}`, luz: Math.max(0.6, m.celda(Math.floor(c.rx), Math.floor(c.rz))?.luz ?? 0.5) });
  }
  if (t - hudSalaT > 400) { hudSalaT = t; pintarHudSala(); }
}

// Cooperativo: ¿quedan en la cripta solo cazadores caídos (yo incluido)? Entonces nadie puede reanimar a nadie.
function equipoCaido() {
  const salido = id => { const e = ultimoMarcador?.find(f => f.id === id)?.estado; return !!e && e !== 'jugando'; };
  return sala.jugadores.every(j => j.id === sala.yo || salido(j.id) || cazadores.get(j.id)?.m);
}

function pintarHudSala() {
  const hud = $('#hud-sala');
  if (hud.hidden || !sala) return;
  const filas = sala.jugadores.map(j => ({ j, mio: j.id === sala.yo, aqui: j.id === sala.yo || cazadores.has(j.id) }))
    .map(({ j, mio, aqui }) => ({ ...j, mio, aqui, pt: mio ? juego.puntos() : (cazadores.get(j.id)?.pt ?? ultimoMarcador?.find(f => f.id === j.id)?.puntos ?? 0) }));
  filas.sort((a, b) => b.pt - a.pt || a.id - b.id);   // el que va ganando, arriba
  juego.marcador = filas.map(f => ({ nombre: f.nombre, color: f.color, pt: f.pt, yo: f.mio }));   // el automapa lo repite
  const clave = JSON.stringify(filas.map(f => [f.id, f.nombre, f.pt, f.aqui]));
  if (clave === hudSalaClave) return;
  hudSalaClave = clave;
  hud.innerHTML = '';
  for (const f of filas) {
    const li = document.createElement('li'), n = document.createElement('span'), pt = document.createElement('b');
    li.className = (f.aqui ? '' : 'fuera ') + (f.mio ? 'yo' : '');
    li.insertAdjacentHTML('afterbegin', `<i class="sombrero ${f.color}"></i>`);
    n.textContent = f.nombre; pt.textContent = f.pt;
    li.append(n, pt);
    hud.appendChild(li);
  }
}

// Al terminar: mi resultado va al anfitrión, que reparte el marcador a todos.
function resumenSala(puntos, exito) {
  $('#resumen-sala').hidden = false;
  $('#btn-reintentar').hidden = true;
  const volver = $('#btn-volver-sala');
  volver.hidden = !sala;
  volver.onclick = () => {
    sala.ponerEstado('sala');
    cazadores.clear();
    mostrar('sala');
    pintarLobby();
  };
  const detalle = { tesoros: juego.tesoros, resueltos: Object.values(juego.mapa.acertijos).filter(a => a.resuelto && !a.ajeno).map(a => String(a.id)) };
  if (sala) sala.terminar(puntos, exito, detalle);
  else ultimoMarcador = null;
  pintarMarcador();
}

// Cooperativo: el botín del equipo solo cuenta si todos escapan con vida. Cuando el último termina, cada uno recibe lo que reunió el equipo.
let coopResuelto = false;
function resolverCoop() {
  if (!actual?.sala?.coop || !actual.sala.fin || coopResuelto || !ultimoMarcador?.length) return;
  if (ultimoMarcador.some(f => f.estado === 'jugando')) return;
  coopResuelto = true;
  if (ultimoMarcador.some(f => f.estado !== 'escapó')) {
    $('#resumen h2').textContent = 'La expedición fracasó: no todos escaparon. El botín se pierde.';
    return;
  }
  const botin = [...new Set(ultimoMarcador.flatMap(f => f.tesoros || []))].filter(id => TESORO[id]);
  for (const id of botin) if (!progreso.tesoros.includes(id)) { progreso.tesoros.push(id); (progreso.nuevos ||= []).push(id); }
  guardar();
  $('#resumen h2').textContent = `¡Toda la cuadrilla escapó! Botín del equipo: ${botin.length} tesoro${botin.length === 1 ? '' : 's'}`;
  $('#resumen .tesoros').innerHTML = botin.map(id => `<span style="color:${RAREZAS[TESORO[id].rareza].color}">${TESORO[id].nombre}</span>`).join('');
}

// «Puntos: 14 (tesoros 12, acertijos +8, ayudas −6)»: así se ve qué aportó cada cosa.
const desglosePuntos = r => {
  const bono = r.bonoAcertijos + r.costoAyudas;
  return `tesoros ${r.puntosTesoros}, acertijos ${bono >= 0 ? '+' : ''}${bono}${r.costoAyudas ? `, ayudas −${r.costoAyudas}` : ''}`;
};

const ESTADOS = { 'escapó': 'escapó', atrapado: 'atrapado', jugando: 'aún en la cripta' };
function pintarMarcador() {
  const ol = $('#resumen-marcador');
  if (!ol) return;
  ol.innerHTML = '';
  if (!ultimoMarcador) {
    ol.innerHTML = sala ? '' : '<li><small>No hay marcador: saliste de la sala.</small></li>';
    return;
  }
  for (const f of [...ultimoMarcador].sort((a, b) => b.puntos - a.puntos)) {
    const li = document.createElement('li'), n = document.createElement('span'), pt = document.createElement('b'), est = document.createElement('small');
    li.className = sala && f.id === sala.yo ? 'yo' : '';
    li.insertAdjacentHTML('afterbegin', `<i class="sombrero ${f.color}"></i>`);
    n.textContent = f.nombre; pt.textContent = `${f.puntos} punto${f.puntos === 1 ? '' : 's'}`; est.textContent = ESTADOS[f.estado] || f.estado;
    li.append(n, pt, est);
    ol.appendChild(li);
  }
  pintarDetalleSala();
}

// Quién consiguió cada tesoro y quién resolvió cada acertijo, para comentarlo al terminar.
function pintarDetalleSala() {
  const jugadores = (ultimoMarcador || []).filter(f => f.estado !== 'jugando' && f.tesoros);
  const pinta = (ul, filas, clave) => {
    ul.innerHTML = '';
    for (const [nombre, id] of filas) {
      const li = document.createElement('li'), n = document.createElement('span'), q = document.createElement('span');
      q.className = 'quienes';
      const los = jugadores.filter(f => f[clave].includes(id));
      if (los.length) for (const f of los) q.insertAdjacentHTML('beforeend', `<i class="sombrero ${f.color}" title="${f.nombre}"></i>`);
      else q.textContent = clave === 'tesoros' ? 'nadie lo halló' : 'sin resolver';
      n.textContent = nombre;
      li.append(n, q);
      ul.appendChild(li);
    }
  };
  if (!juego) return;
  pinta($('#resumen-tesoros'), juego.objetos.filter(o => o.tipo === 'tesoro').map(o => [TESORO[o.tesoro].nombre, o.tesoro]), 'tesoros');
  pinta($('#resumen-acertijos'), Object.values(juego.mapa.acertijos).map(a => [a.titulo, String(a.id)]), 'resueltos');
}

// ---------- Partida ----------

// `enSala`: la partida de una sala, con la semilla y las pistas que comparten todos los cazadores.
function empezar(def, tamano = 'grande', limite = 0, enSala = null) {
  if (!render) return;
  activarAudio();
  actual = { def, tamano, limite, sala: enSala };
  juego = new Juego(recortarZonas(def, TAMANOS[tamano].zonas), {
    mensaje,
    tesoro(t, r) {
      // el botín va a la colección solo si escapas con él
      mensaje(`${t.nombre} (${r.nombre}) · en tu mochila`, 4);
      destello('oro');
      actualizarHUD();
    },
    daño(n, causa) { destello('rojo'); avisarDaño(n, causa); },
    reclamar: enSala && enSala.tesoros !== 'compartidos' ? o => reclamarTesoro(o) : undefined,
    golpear: enSala ? (i, d) => sala?.golpear(i, d) : undefined,
    pegarA: enSala?.combate ? (id, d) => sala?.pegarA(id, d) : undefined,
    baja: enSala?.combate ? k => sala?.baja(k) : undefined,
    dañarA: enSala ? (id, n, c) => sala?.danar(id, n, c) : undefined,
    solto: enSala && enSala.tesoros !== 'compartidos' ? o => sala?.soltar(o.n, o.x, o.z) : undefined,
    forzo: enSala ? a => sala?.forzar(a) : undefined,
    cayo: enSala?.coop ? () => sala?.mundo('cae', 0) : undefined,
    reanimar: enSala?.coop ? id => sala?.mundo('reanima', id) : undefined,
    cofreAbierto: enSala ? n => sala?.mundo('cofre', n) : undefined,
    antorchaEncendida: enSala ? i => sala?.mundo('antorcha', i) : undefined,
    recogido: enSala ? n => sala?.mundo('objeto', n) : undefined,
    vibrar,
    abrirTablilla: a => abrirPanelTablilla(a),
    reconstruir: () => render.construir(juego.mapa),
    salida: r => terminar(r, true),
    muerte: r => enSala ? juego.caer() : setTimeout(() => terminar(r, false), 1400),
    tiempoAgotado: r => terminar(r, false),
  }, enSala?.semilla, { limite, real: !!enSala, combate: !!enSala?.combate, rol: enSala ? (sala?.soyAnfitrion ? 'anfitrion' : 'invitado') : null, puesto: enSala ? sala?.yo ?? 0 : 0, jugadores: enSala?.jugadores || 1, coop: !!enSala?.coop });
  juego.colorPropio = enSala && sala ? HEX_CAZADOR[sala.jugadores.find(q => q.id === sala.yo)?.color] || null : null;
  $('#hud-reloj').hidden = !limite;
  $('#caja-puntos').hidden = !enSala;
  document.body.classList.toggle('contrarreloj', !!limite);
  render.construir(juego.mapa);
  etiquetas.construir(juego.mapa);
  capaMapa.hidden = true;
  iniciarPartidaEnSala();
  if (enSala) repartirPistas();
  iniciarAmbiente(def.ambiente);
  sonar('entrada');
  document.body.classList.add('jugando');
  mostrar('juego');
  reanudar();
  mensaje(def.nombre, 3);
  $('#pausa-sala').hidden = !enSala;
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
  plegarLeyenda();
  $('#panel-mapa').hidden = true;
  // en una sala el mundo no se detiene: pausar solo suelta el ratón y muestra el menú
  if (actual?.sala && !actual.sala.fin) { entrada.soltarTodo(); if (document.pointerLockElement) document.exitPointerLock(); pausado = true; entrada.activa = false; return; }
  pausado = true;
  entrada.activa = false;
  entrada.soltarTodo();
  atenuarAmbiente(true);
  if (document.pointerLockElement) document.exitPointerLock();
}

// En una sala todos ven el mismo acertijo en cada tablilla, sin importar en qué orden las abran:
// se reparten de una vez, en orden, con el azar de la semilla.
function repartirPistas() {
  const azar = actual.sala.azarPistas, usadas = new Set();
  const lista = Object.values(juego.mapa.acertijos).sort((x, y) => String(x.id).localeCompare(String(y.id)));
  for (const a of lista) {
    if (a.tipo === 'palancas') a.estadoPalancas = { titulo: a.titulo, acertijo: crearPalancas(azar) };
    else {
      const pista = elegirPista(a.dificultad, new Set(), usadas, azar);
      usadas.add(pista.id);
      a.estado = { titulo: a.titulo, pista, nivel: 0, vistas: new Set() };
    }
  }
}

function abrirPanelTablilla(a) {
  pausar();
  // en una sala todos ven las mismas pistas, aunque ya las hayan resuelto antes
  const resueltas = actual.sala ? new Set() : new Set(progreso.pistas);
  const azar = actual.sala ? actual.sala.azarPistas : Math.random;
  const dificultad = a.dificultad;
  // con tantas tablillas por mazmorra, ninguna repite la pista que ya muestra otra
  const enUso = () => new Set(Object.values(juego.mapa.acertijos).filter(o => o !== a && o.estado).map(o => o.estado.pista.id));
  if (!a.estado && a.tipo !== 'palancas') a.estado = { titulo: a.titulo, pista: elegirPista(dificultad, resueltas, enUso(), azar), nivel: 0, vistas: new Set() };
  const panel = $('#panel');
  tablillaAbierta = a;
  if (a.tipo === 'palancas') {
    a.estadoPalancas ||= { titulo: a.titulo, acertijo: crearPalancas(azar) };
    abrirPalancas(panel, a.estadoPalancas, {
      alResolver() {
        panel.hidden = true; tablillaAbierta = null;
        if (acertijosExclusivos()) enviarAcertijo(a); else juego.resolverAcertijo(a);
        reanudar();
      },
      alCerrar() { panel.hidden = true; tablillaAbierta = null; reanudar(); },
    });
    return;
  }
  a.estado.inicio = Date.now();
  abrirTablilla(panel, a.estado, {
    alResolver(p) {
      if (!progreso.pistas.includes(p.id)) { progreso.pistas.push(p.id); guardar(); }
      panel.hidden = true; tablillaAbierta = null;
      if (acertijosExclusivos()) enviarAcertijo(a); else juego.resolverAcertijo(a);
      reanudar();
    },
    alCerrar() { panel.hidden = true; tablillaAbierta = null; reanudar(); },
  });
}

function terminar(r, exito) {
  if (actual.sala) { actual.sala.fin = true; $('#hud-sala').hidden = true; }
  pausar();
  sonar(exito ? 'victoria' : 'derrota');
  $('#panel').hidden = true;
  $('#resumen-sala').hidden = $('#btn-volver-sala').hidden = true;
  $('#btn-reintentar').hidden = false;
  if (actual.sala) return terminarSala(r, exito);
  // el botín solo cuenta si escapas con él: si te atrapan o caes, se pierde
  const nuevos = exito ? r.tesoros.filter(id => !progreso.tesoros.includes(id)) : [];
  if (exito) {
    progreso.tesoros.push(...nuevos);
    progreso.nuevos = [...new Set([...(progreso.nuevos || []), ...nuevos])];
    if (actual.tamano === 'grande') {
      const est = progreso.mazmorras[r.mazmorra.id] ||= {};
      est.completada = true;
      est.secretos = Math.max(est.secretos || 0, r.secretos);
    }
    guardar();
  }
  const min = Math.floor(r.reloj / 60), seg = Math.floor(r.reloj % 60);
  $('#resumen h2').textContent = exito ? '¡Escapaste con vida!' : `${r.causa || 'Has caído en la cripta.'} Pierdes todo el botín.`;
  $('#resumen .datos').innerHTML = `
    <li>Tesoros ${exito ? 'rescatados' : 'perdidos'}: <b>${r.tesoros.length}/${r.totalTesoros}</b></li>
    <li>Puntos: <b>${r.puntos}</b> <small>(${desglosePuntos(r)})</small></li>
    <li>Acertijos: <b>${r.acertijos}/${r.totalAcertijos}</b></li>
    <li>Pasadizos secretos: <b>${r.secretos}/${r.totalSecretos}</b></li>
    <li>Enemigos: <b>${r.abatidos}/${r.totalEnemigos}</b></li>
    <li>Tiempo: <b>${min}:${String(seg).padStart(2, '0')}</b> de ${r.limite / 60}:00</li>`;
  $('#resumen .tesoros').innerHTML = r.tesoros.map(id => `<span style="color:${RAREZAS[TESORO[id].rareza].color}">${TESORO[id].nombre}${nuevos.includes(id) ? ' · nuevo' : ''}</span>`).join('');
  $('#btn-reintentar').textContent = 'Jugar de nuevo';
  $('#btn-reintentar').onclick = () => empezar(actual.def, actual.tamano, actual.limite);
  mostrar('resumen');
  detenerAmbiente();
  document.body.classList.remove('jugando');
}

// En una sala, al escapar te llevas todos los puntos y los tesoros van a tu colección; si se acaba el tiempo adentro, la mitad de los puntos y ningún tesoro.
function terminarSala(r, exito) {
  const coop = !!actual.sala.coop;
  coopResuelto = false;
  const puntos = exito ? r.puntos : coop ? 0 : Math.floor(r.puntos / 2);
  if (exito && !coop) for (const id of r.tesoros) if (!progreso.tesoros.includes(id)) { progreso.tesoros.push(id); (progreso.nuevos ||= []).push(id); }
  guardar();
  const min = Math.floor(r.reloj / 60), seg = Math.floor(r.reloj % 60);
  $('#resumen h2').textContent = coop ? (exito ? 'Saliste de la cripta. Esperando a tus compañeros…' : `${r.causa} La expedición fracasó y el botín se pierde.`)
    : exito ? `¡Escapaste con ${puntos} punto${puntos === 1 ? '' : 's'}!` : r.causa;
  $('#resumen .datos').innerHTML = `
    <li>Puntos: <b>${exito ? puntos : `${r.puntos} → ${puntos}`}</b>${exito ? '' : coop ? ' (el botín se pierde)' : ' (la mitad, por no escapar)'}</li>
    <li>Tesoros: <b>${r.tesoros.length}/${r.totalTesoros}</b> <small>(${desglosePuntos(r)})</small></li>
    <li>Acertijos: <b>${r.acertijos}/${r.totalAcertijos}</b></li>
    <li>Tiempo: <b>${min}:${String(seg).padStart(2, '0')}</b> de ${r.limite / 60}:00</li>`;
  $('#resumen .tesoros').innerHTML = r.tesoros.map(id => `<span style="color:${RAREZAS[TESORO[id].rareza].color}">${TESORO[id].nombre} +${RAREZAS[TESORO[id].rareza].valor}</span>`).join('');
  resumenSala(puntos, exito);
  if (coop && !exito) coopResuelto = true;
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
$('#btn-menu-pausa').onclick = () => { cerrarSala(); $('#pausa').hidden = true; juego = null; detenerAmbiente(); document.body.classList.remove('jugando'); mostrar('portada'); };
// Ajustes desde la pausa: las mismas opciones del menú, encima de la partida.
const opcionesEl = $('#opciones');
$('#btn-ajustes-pausa').onclick = () => { pintarOpciones(); opcionesEl.classList.add('sobre-juego'); opcionesEl.hidden = false; };
opcionesEl.querySelector('.atras').addEventListener('click', e => {
  if (!opcionesEl.classList.contains('sobre-juego')) return;
  e.stopImmediatePropagation();
  opcionesEl.classList.remove('sobre-juego'); opcionesEl.hidden = true;
}, true);
$('#btn-pausa').addEventListener('click', () => { pausar(); $('#pausa').hidden = false; });

function actualizarHUD() {
  const j = juego.j;
  $('#hud-vida').textContent = j.vida;
  const pv = `${Math.max(0, Math.min(100, j.vida))}%`;
  $('#hud-vida-barra').style.width = pv;
  $('#hud-vida-rastro').style.width = pv;   // se queda atrás un momento (transición con retardo en el CSS)
  const cv = $('#hud-vida').parentElement;
  cv.classList.toggle('baja', j.vida <= 25);
  cv.classList.toggle('media', j.vida > 25 && j.vida <= 50);
  // el arma que llevas: su dibujo, las balas cargadas (una por una en el revólver y la escopeta) y la reserva
  const caja = $('#hud-arma').closest('.caja');
  const datos = { revolver: ['Revólver', j.tambor, j.reserva, 6], escopeta: ['Escopeta', j.tubo, j.reservaE, 2], tommy: ['Tommy gun', j.cargador, j.reservaT, 30] }[j.arma];
  caja.dataset.arma = j.arma;
  caja.classList.toggle('sin-municion', !datos);
  caja.classList.toggle('vacia', !!datos && datos[1] === 0);
  caja.classList.toggle('recargando', j.recargando > 0);
  $('#hud-arma').textContent = datos ? datos[0] : 'Látigo';
  if (datos) {
    const [, carga, reserva, cabe] = datos;
    $('#hud-balas').textContent = carga;
    $('#hud-reserva').textContent = `/ ${reserva}`;
    const pips = $('#hud-pips'), clave = `${j.arma}:${carga}`;
    if (pips.dataset.clave !== clave) {
      pips.dataset.clave = clave;
      pips.innerHTML = cabe > 8 ? `<span class="tira" style="--lleno:${Math.round(carga / cabe * 100)}%"></span>`
        : Array.from({ length: cabe }, (_, k) => `<i class="${k < carga ? '' : 'gastada'}"></i>`).join('');
    }
  }
  $('#hud-tesoros').textContent = `${juego.tesoros.length}/${juego.totalTesoros}`;
  $('#caja-palanca').hidden = !j.barreta;
  $('#caja-llave').hidden = !j.llaves;
  $('#hud-llaves').textContent = j.llaves;
  $('#t-curar').hidden = !j.vendas;
  $('#caja-vendas').hidden = !j.vendas;
  if (juego.limite) {
    const r = Math.ceil(juego.restante()), rel = $('#hud-reloj');
    rel.textContent = `${Math.floor(r / 60)}:${String(r % 60).padStart(2, '0')}`;
    rel.classList.toggle('urgente', r <= 60);
    $('#hud-puntos').textContent = juego.puntos();
  }
  // el guardián, solo mientras pelea: te ve (o te vio hace un momento) y está cerca; si te pierde, la barra se va
  const g = juego.guardian, hj = $('#hud-jefe');
  hj.hidden = !g || !['caza', 'ataca', 'lanza', 'embiste', 'dolor', 'surge'].includes(g.estado)
    || (g.sinVerte ?? 0) >= 3 || Math.hypot(g.x - j.x, g.z - j.z) > 12;
  if (!hj.hidden) {
    hj.querySelector('b').textContent = g.nombre;
    hj.style.setProperty('--aura', AURAS[g.tipo] || '#ffb627');
    hj.querySelector('i').style.width = `${Math.max(0, g.vida / g.vidaMax) * 100}%`;
  }
  // en las mazmorras por zonas: «Zona 2 · Las galerías: 1 de 4 reliquias»
  const z = juego.zonaActual(), hz = $('#hud-zona');
  hz.hidden = !z;
  if (z) {
    const txt = `${z.halladas} de ${z.total} reliquia${z.total === 1 ? '' : 's'}`;
    if (hz.dataset.clave !== z.numero + z.nombre + txt) {
      hz.dataset.clave = z.numero + z.nombre + txt;
      hz.children[0].textContent = `Zona ${z.numero}`;
      hz.children[1].textContent = `· ${z.nombre}:`;
      hz.children[2].textContent = txt;
      hz.classList.toggle('completa', z.halladas === z.total);
    }
  }
}

// ---------- Bucle principal ----------

let fpsT = 0, fpsN = 0;
function cuadro(t) {
  requestAnimationFrame(cuadro);
  if (!juego) return;
  const dt = Math.max(0, Math.min(0.05, (t - ultimo) / 1000));
  ultimo = t;
  const ent = entrada.leer();
  if (ent.pulsos.has('pausa') && !pausado) { pausar(); $('#pausa').hidden = false; }
  if (ent.pulsos.has('mapa') && !pausado) alternarMapa();
  if (!pausado || (actual?.sala && !actual.sala.fin)) { juego.actualizar(dt, ent); actualizarAmbiente(dt, Math.max(juego.tension(), juego.limite && juego.restante() <= 60 ? 0.7 : 0)); }
  else if (juego.limite && !$('#panel').hidden) juego.avanzarReloj(dt); // el reloj no se detiene mientras lees una tablilla

  render.ajustarTamano(CALIDADES[calidad]);
  // la antorcha titila
  const linterna = (juego.j.muerto ? 0.3 : 0.92 + Math.sin(t * 0.013) * 0.05 + Math.sin(t * 0.031) * 0.04 + Math.sin(t * 0.071) * 0.025);
  const sprites = juego.sprites();
  if (actual?.sala) cuadroDeSala(t, dt, sprites);
  const cam = juego.camara();
  render.dibujar(cam, sprites, { linterna, fogonazo: juego.fogonazo, penumbra: juego.penumbra(), pinchosArriba: x => pinchosArriba(x, juego.tiempo) });
  etiquetas.actualizar(juego, cam);

  const dpr = Math.min(devicePixelRatio || 1, 2);
  const w = Math.round(capaArma.clientWidth * dpr), h = Math.round(capaArma.clientHeight * dpr);
  if (capaArma.width !== w || capaArma.height !== h) { capaArma.width = w; capaArma.height = h; }
  dibujarArma(ctxArma, w, h, juego.j);
  if (!capaMapa.hidden) {
    if (capaMapa.width !== w || capaMapa.height !== h) { capaMapa.width = w; capaMapa.height = h; }
    // la leyenda abierta tapa un lado del mapa: el mapa se ajusta al resto
    const rc = capaMapa.getBoundingClientRect(), rl = leyenda.getBoundingClientRect(), e = w / (rc.width || 1);
    vistaMapa.reservaDer = vistaMapa.reservaAbajo = 0;
    if (!leyenda.hidden) { if (rc.width > rc.height) vistaMapa.reservaDer = Math.max(0, (rc.right - rl.left) * e); else vistaMapa.reservaAbajo = Math.max(0, (rc.bottom - rl.top) * e); }
    dibujarAutomapa(ctxMapa, w, h, juego);
  }
  document.body.classList.toggle('mapa-abierto', !capaMapa.hidden);
  $('#panel-mapa').hidden = capaMapa.hidden || pausado;
  leyenda.classList.toggle('en-sala', !!actual?.sala);
  const ad = $('#aviso-dardos');
  ad.hidden = !juego.enTiro || juego.j.muerto;
  ad.classList.toggle('disparo', juego.enTiro === 2);
  actualizarHUD();
  if (capaMapa.hidden && document.body.classList.contains('tactil')) dibujarMinimapa(ctxMini, 192, juego);
  $('#t-mapa').classList.toggle('aviso', !!juego.avisoMapa && capaMapa.hidden);
  botonUsar.classList.toggle('listo', juego.puedeUsar());

  fpsN++; fpsT += dt;
  if (fpsT > 1) { $('#fps').textContent = `${Math.round(fpsN / fpsT)} fps`; fpsN = 0; fpsT = 0; }
}
requestAnimationFrame(cuadro);

// Pausa al salir de la pestaña.
document.addEventListener('visibilitychange', () => { if (document.hidden && juego && !pausado) { pausar(); $('#pausa').hidden = false; } });

// App instalable (sin conexión).
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});

mostrar('portada');

// ---------- Introducción ----------
// El primer toque despierta el audio (los navegadores no dejan sonar antes) y empieza la película:
// oscuridad, versos, antorchas que se encienden y, al final, el título que cae con el tema de la aventura.
const intro = $('#intro');
const invitacion = normalizarCodigo(new URLSearchParams(location.search).get('sala'));
function terminarIntro(saltada) {
  if (!intro || intro.classList.contains('titulo')) return;
  clearTimeout(intro.reloj);
  document.body.classList.remove('en-intro', 'camara');
  $('#portada').classList.add('revela');
  intro.classList.add('titulo');
  if (saltada) detenerIntro();
  retenerMusica(false);
  setTimeout(() => intro.classList.add('fin'), 700);
  setTimeout(() => intro.remove(), 2200);
}
function empezarIntro() {
  if (intro.classList.contains('corre')) return terminarIntro(true);
  activarAudio();
  intro.classList.add('corre');
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { terminarIntro(true); return; }
  document.body.classList.add('camara');
  sonarIntro();
  intro.reloj = setTimeout(() => terminarIntro(false), TIEMPO_TITULO * 1000);
}
if (intro && !invitacion) {
  document.body.classList.add('en-intro');
  retenerMusica(true);
  intro.addEventListener('click', empezarIntro);
  intro.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); empezarIntro(); } });
  intro.focus?.();
} else intro?.remove();

if (invitacion) {
  abrirUnirse(invitacion);
  // el enlace queda limpio: recargar la página no vuelve a abrir la invitación
  const q = new URLSearchParams(location.search); q.delete('sala');
  history.replaceState(history.state, '', location.pathname + (q.size ? `?${q}` : ''));
}
window.__reliquias = { get juego() { return juego; }, get actual() { return actual; }, get sala() { return sala; }, get cazadores() { return cazadores; }, empezar, MAZMORRAS };
