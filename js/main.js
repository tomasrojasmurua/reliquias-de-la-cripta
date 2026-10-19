import { crearAtlas, registrarTesoros, miniatura } from './texturas.js';
import { Render } from './render.js';
import { Etiquetas } from './etiquetas.js';
import { Entrada } from './entrada.js';
import { Juego, pinchosArriba } from './juego.js';
import { dibujarArma } from './arma.js';
import { dibujarAutomapa } from './automapa.js';
import { iniciarEscena, animarEscena } from './escena.js';
import { activarAudio, sonar, alternarSilencio, alternarMusica, ponerSilencio, ponerMusica, iniciarAmbiente, detenerAmbiente, atenuarAmbiente, actualizarAmbiente, tocarMusica } from './audio.js';
import { abrirTablilla, elegirPista } from './acertijos.js';
import { abrirPalancas, crearPalancas } from './palancas.js';
import { recortarZonas, azarConSemilla } from './laberinto.js';
import { Sala, COLORES, HZ_POSICION, codigoValido, normalizarCodigo, enlaceDeSala, enlaceWhatsApp } from './red.js';
import { MAZMORRAS, tesorosDe } from '../datos/mazmorras.js';
import { TESOROS, TESORO, RAREZAS } from '../datos/tesoros.js';
import { lienzoEmblema } from '../datos/emblemas.js';
import { hayRanking, mejoresDel, subir } from './ranking.js';
import { expedicion, racha, textoCompartir, MODIFICADORES, TAMANO_DIARIA, MINUTOS_DIARIA } from './diaria.js';

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
// Antes de entrar se elige el modo, el tamaño (cuántas zonas de la mazmorra) y, en el contrarreloj,
// el tiempo, que depende del tamaño.
const TAMANOS = {
  pequena: { zonas: 1, minutos: [3, 4, 6] },
  mediana: { zonas: 2, minutos: [5, 8, 11] },
  grande: { zonas: Infinity, minutos: [8, 12, 16] },
};
const RITMOS = ['Corto', 'Normal', 'Largo'];
const prep = { tesoros: progreso.opciones.tesoros || 'exclusivos', modo: progreso.opciones.modo || 'explorar', tamano: progreso.opciones.tamano || 'grande', ritmo: progreso.opciones.ritmo ?? 1 };
let elegida = null;   // la mazmorra de la pantalla de preparación
let actual = null;    // la partida en curso { def, tamano, limite }, para jugar de nuevo
const recordDe = (def, tamano, seg) => (progreso.records || {})[`${def.id}:${tamano}:${seg}`] || 0;
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
$('#hud-arma').parentElement.dataset.tactil = 'cambiarArma';   // en táctil se cambia de arma tocando su recuadro
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

// El navegador deja sonar el audio recién cuando el jugador toca algo.
for (const ev of ['pointerdown', 'pointerup', 'touchend', 'keydown']) addEventListener(ev, activarAudio, { passive: true });

// Sonidos de los menús: al pasar el ratón y al elegir.
const enMenu = b => b?.closest('.menu, #pausa');
const ALTERNAR = '[data-sens], [data-calidad], [data-modo], [data-tamano], [data-ritmo], [data-tesoros], #btn-zurdo, #btn-vibrar, #btn-sonido, #btn-musica';
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
const limiteDe = def => prep.modo === 'contrarreloj' || prep.modo === 'sala' ? TAMANOS[tamanoDe(def)].minutos[prep.ritmo] * 60 : 0;
const minuscula = t => t[0].toLowerCase() + t.slice(1);

function abrirPreparar(def) {
  elegida = def;
  pintarPreparar();
  mostrar('preparar');
}
function pintarPreparar() {
  const def = elegida, Z = def.sectores, tam = tamanoDe(def), contra = prep.modo !== 'explorar', enSala = prep.modo === 'sala';
  $('#preparar h2').textContent = def.nombre;
  $('#prep-desc').textContent = def.descripcion;
  for (const b of document.querySelectorAll('[data-modo]')) b.classList.toggle('activo', b.dataset.modo === prep.modo);
  $('#prep-grupo-tamano').hidden = !Z;
  for (const b of document.querySelectorAll('[data-tamano]')) b.classList.toggle('activo', b.dataset.tamano === tam);
  const n = TAMANOS[tam].zonas, z = Z?.zonas || [];
  $('#nota-tamano').textContent = !Z ? ''
    : n === 1 ? `Solo la primera zona: ${minuscula(z[0].nombre)}. La salida se esconde en ella.`
    : n === 2 ? `Las dos primeras zonas: ${minuscula(z[0].nombre)} y ${minuscula(z[1].nombre)}.`
    : `Las ${z.length} zonas, con ${minuscula(z.at(-1).nombre)} tras un pasadizo secreto.`;
  $('#prep-tiempo').hidden = !contra;
  $('#prep-tesoros').hidden = !enSala;
  for (const b of document.querySelectorAll('[data-tesoros]')) b.classList.toggle('activo', b.dataset.tesoros === prep.tesoros);
  $('#nota-tesoros').textContent = prep.tesoros === 'exclusivos'
    ? 'Cada tesoro es del primero que lo toma; los demás encuentran una nota «¡Llegaste tarde!».'
    : 'Todos pueden recoger cada tesoro. Gana quien más reúna, y al final se ve cómo lo logró cada uno.';
  document.querySelectorAll('[data-ritmo]').forEach((b, i) => {
    b.innerHTML = `${RITMOS[i]}<small>${TAMANOS[tam].minutos[i]} min</small>`;
    b.classList.toggle('activo', i === prep.ritmo);
  });
  const seg = limiteDe(def), rec = enSala ? 0 : recordDe(def, tam, seg);
  $('#btn-entrar').textContent = enSala ? 'Crear sala' : 'Entrar';
  $('#nota-modo').textContent = enSala
    ? `Creas una sala y compartes el enlace por WhatsApp. Todos entran a la misma cripta, con ${seg / 60} minutos para reunir más botín que los demás y salir.`
    : contra
    ? `Tienes ${seg / 60} minutos para reunir el botín más valioso y salir. Si se apaga la última antorcha antes de escapar, pierdes la mitad de los puntos.${rec ? ` Récord: ${rec} puntos.` : ''}`
    : 'Explora sin apuro: cada tesoro que encuentres va a tu colección.';
}
const elegir = (clave, valor) => { prep[clave] = valor; progreso.opciones[clave] = valor; guardar(); pintarPreparar(); };
for (const b of document.querySelectorAll('[data-modo]')) b.onclick = () => elegir('modo', b.dataset.modo);
for (const b of document.querySelectorAll('[data-tamano]')) b.onclick = () => elegir('tamano', b.dataset.tamano);
for (const b of document.querySelectorAll('[data-tesoros]')) b.onclick = () => elegir('tesoros', b.dataset.tesoros);
for (const b of document.querySelectorAll('[data-ritmo]')) b.onclick = () => elegir('ritmo', +b.dataset.ritmo);
$('#btn-entrar').onclick = () => prep.modo === 'sala' ? crearSala() : empezar(elegida, tamanoDe(elegida), limiteDe(elegida));

function pintarMazmorras() {
  const lista = $('#lista-mazmorras');
  lista.innerHTML = '';
  for (const m of MAZMORRAS) {
    const ids = tesorosDe(m);
    const tengo = ids.filter(id => progreso.tesoros.includes(id)).length;
    const est = progreso.mazmorras[m.id] || {};
    const b = document.createElement('button');
    b.className = 'mazmorra';
    b.innerHTML = `<em class="numero">${ROMANOS[MAZMORRAS.indexOf(m)]}</em><div class="titulo-mazmorra"><i class="marco-emblema"></i><strong>${m.nombre}</strong></div><span>${m.descripcion}</span>
      <div class="barra"><i style="width:${Math.round(tengo / ids.length * 100)}%"></i></div>
      <small>Tesoros ${tengo} de ${ids.length}${est.completada ? ' · Completada' : ''}</small>`;
    b.querySelector('.marco-emblema').appendChild(lienzoEmblema(m.id));
    b.onclick = () => abrirPreparar(m);
    lista.appendChild(b);
  }
}

// Colección: una vitrina por rareza, más cuidada y adornada cuanto más raro es lo que guarda.
const VITRINAS = [
  ['legendario', 'Legendarios', 'Tras cristal tallado, sobre terciopelo carmesí.'],
  ['epico', 'Épicos', 'En ébano y plata, a la luz de las velas.'],
  ['raro', 'Raros', 'Caoba pulida con remaches de bronce.'],
  ['comun', 'Comunes', 'Estanterías de madera del campamento.'],
];
function mazmorraDe(id) {
  return MAZMORRAS.find(m => tesorosDe(m).includes(id));
}
function pintarColeccion() {
  const cont = $('#vitrinas');
  cont.innerHTML = '';
  const tengo = new Set(progreso.tesoros);
  let valor = 0;
  for (const [rareza, titulo, lema] of VITRINAS) {
    const lista = TESOROS.filter(t => t.rareza === rareza);
    const hallados = lista.filter(t => tengo.has(t.id)).length;
    const v = document.createElement('section');
    v.className = 'vitrina v-' + rareza;
    v.innerHTML = `<header class="cornisa"><h3>${titulo}</h3><small>${hallados} de ${lista.length}</small></header><p class="lema-vitrina">${lema}</p><div class="cristal"><div class="repisa"></div></div><div class="zocalo"></div>`;
    const repisa = v.querySelector('.repisa');
    lista.forEach((t, i) => {
      const lo = tengo.has(t.id);
      if (lo) valor += RAREZAS[rareza].valor;
      const b = document.createElement('button');
      b.className = 'pieza' + (lo ? '' : ' oculta');
      b.style.setProperty('--retraso', (i % 5) * -0.7 + 's');
      b.setAttribute('aria-label', lo ? t.nombre : 'Tesoro sin descubrir');
      b.appendChild(miniatura(atlas, 'tesoro_' + t.id, 1));
      b.onclick = () => abrirFicha(t, lo);
      repisa.appendChild(b);
    });
    cont.appendChild(v);
  }
  $('#resumen-coleccion').textContent = `${tengo.size} de ${TESOROS.length} tesoros · valor ${valor}`;
}
function abrirFicha(t, lo) {
  const f = $('#ficha'), r = RAREZAS[t.rareza], m = mazmorraDe(t.id);
  f.className = 'f-' + t.rareza;
  const pieza = f.querySelector('.ficha-pieza');
  pieza.innerHTML = ''; pieza.classList.toggle('oculta', !lo);
  pieza.appendChild(miniatura(atlas, 'tesoro_' + t.id, 3));
  f.querySelector('h3').textContent = lo ? t.nombre : '???';
  f.querySelector('em').textContent = r.nombre;
  f.querySelector('p').textContent = lo ? t.descripcion : 'Aún no lo encuentras.';
  f.querySelector('small').textContent = m ? (lo ? 'Hallado en ' : 'Se esconde en ') + m.nombre : '';
  f.hidden = false;
}
$('#ficha').onclick = e => { if (e.target.id === 'ficha' || e.target.closest('.cerrar')) $('#ficha').hidden = true; };

function pintarOpciones() {
  for (const b of document.querySelectorAll('[data-calidad]')) b.classList.toggle('activo', b.dataset.calidad === calidad);
  pintarControles();
}

// Controles táctiles: sensibilidad, modo zurdo y vibración.
const SENSIBILIDAD = { baja: 0.6, media: 1, alta: 1.5 };
function aplicarControles() {
  const o = progreso.opciones;
  entrada.sensTactil = 0.006 * SENSIBILIDAD[o.sens || 'media'];
  entrada.zurdo = !!o.zurdo;
  document.body.classList.toggle('zurdo', !!o.zurdo);
}
function pintarControles() {
  const o = progreso.opciones;
  for (const b of document.querySelectorAll('[data-sens]')) b.classList.toggle('activo', b.dataset.sens === (o.sens || 'media'));
  $('#btn-zurdo').textContent = o.zurdo ? 'Zurdo: sí' : 'Zurdo: no';
  $('#btn-vibrar').textContent = o.sinVibrar ? 'Vibración: no' : 'Vibración: sí';
}
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
// En táctil no hay botón de recargar: el revólver se recarga solo al vaciarse o tras un momento sin atacar.
function recargaAutomatica() {
  const j = juego.j;
  if (!document.body.classList.contains('tactil') || j.muerto || j.arma !== 'revolver' || j.recargando > 0 || j.tambor === 6 || !j.reserva) return;
  if (!j.tambor || performance.now() - entrada.ultimoAtaque > 1500) juego.recargar();
}

document.addEventListener('click', e => {
  const b = e.target.closest('[data-ir]');
  if (!b) return;
  activarAudio();
  const ir = b.dataset.ir;
  if (ir === 'mazmorras') pintarMazmorras();
  if (ir === 'diaria') pintarDiaria();
  if (ir === 'coleccion') pintarColeccion();
  if (ir === 'opciones') pintarOpciones();
  if (ir === 'unirse') abrirUnirse();
  if (sala && (ir === 'mazmorras' || ir === 'portada')) cerrarSala();
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

// ---------- Expedición del día ----------

// Solo el primer intento de cada día cuenta para la racha y para compartir; los demás son práctica.
const diarias = () => progreso.diarias ||= {};
const URL_JUEGO = location.origin + location.pathname;

function pintarDiaria() {
  const exp = expedicion(MAZMORRAS), hecha = diarias()[exp.fecha], n = racha(diarias());
  const [a, m, d] = exp.fecha.split('-');
  $('#diaria-sub').textContent = `Nº ${exp.numero} · ${d}-${m}-${a}. Todos los cazadores enfrentan hoy la misma cripta, con los mismos túneles y las mismas tablillas.`;
  $('#diaria-nombre').textContent = exp.def.nombre;
  $('#diaria-emblema').replaceChildren(lienzoEmblema(exp.def.id));
  $('#diaria-desc').textContent = `Mazmorra mediana, contrarreloj de ${MINUTOS_DIARIA} minutos.`;
  $('#diaria-mods').innerHTML = exp.modificadores.map(id => `<li><b>${MODIFICADORES[id].nombre}</b>${MODIFICADORES[id].texto}</li>`).join('');
  $('#diaria-estado').textContent = hecha
    ? `Hoy ${hecha.escapo ? 'escapaste' : 'quedaste atrapado'} con ${hecha.puntosFinales} puntos. Puedes volver a entrar para practicar; el resultado de hoy ya quedó.${n ? ` Racha: ${n} día${n === 1 ? '' : 's'}.` : ''}`
    : `Solo cuenta tu primer intento.${n ? ` Racha: ${n} día${n === 1 ? '' : 's'}; entra hoy para no perderla.` : ''}`;
  $('#btn-diaria').textContent = hecha ? 'Practicar' : 'Partir';
  const compartir = $('#btn-diaria-compartir');
  compartir.hidden = !hecha;
  compartir.onclick = () => compartirTexto(textoCompartir(exp, hecha, id => TESORO[id].rareza, URL_JUEGO));
  pintarRanking(exp.fecha);
}
$('#btn-diaria').onclick = () => {
  guardarNombre();
  const exp = expedicion(MAZMORRAS);
  empezar(exp.def, TAMANO_DIARIA, MINUTOS_DIARIA * 60, exp);
};

// Ranking en línea (solo si datos/ranking.js tiene un proyecto de Supabase). Cada navegador es un
// jugador con su propio identificador; el nombre se elige en la pantalla de la expedición.
const jugador = () => progreso.jugador ||= (crypto.randomUUID?.() || 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, () => Math.floor(Math.random() * 16).toString(16)));
function guardarNombre() {
  const nombre = $('#diaria-jugador').value.trim().slice(0, 20);
  if (nombre && nombre !== progreso.opciones.nombre) { progreso.opciones.nombre = nombre; guardar(); }
}
$('#diaria-jugador').addEventListener('change', () => { guardarNombre(); enviarPendientes().then(() => pintarRanking()); });

// Sube los resultados oficiales que aún no llegan al ranking (sin conexión o sin nombre al terminar).
async function enviarPendientes() {
  if (!hayRanking() || !progreso.opciones.nombre) return;
  for (const [fecha, r] of Object.entries(diarias())) {
    if (!r.pendiente) continue;
    try {
      await subir({ fecha, jugador: jugador(), nombre: progreso.opciones.nombre, puntos: r.puntosFinales, segundos: Math.round(r.reloj), escapo: r.escapo, tesoros: r.tesoros.length });
      delete r.pendiente;
      guardar();
    } catch (e) { /* sin conexión: se intenta de nuevo la próxima vez */ }
  }
}

async function pintarRanking(fecha = expedicion(MAZMORRAS).fecha) {
  const caja = $('#diaria-ranking');
  caja.hidden = !hayRanking();
  if (caja.hidden) return;
  const entrada = $('#diaria-jugador');
  if (document.activeElement !== entrada) entrada.value = progreso.opciones.nombre || '';
  const nota = $('#diaria-ranking-nota'), tabla = $('#diaria-tabla');
  const mio = diarias()[fecha];
  nota.textContent = !progreso.opciones.nombre ? 'Ponte un nombre para aparecer en el ranking.'
    : mio?.pendiente ? 'Tu resultado se subirá cuando haya conexión.' : '';
  try {
    const filas = await mejoresDel(fecha);
    tabla.innerHTML = filas.length ? '' : '<p class="nota">Nadie ha escapado todavía. ¡Sé el primero!</p>';
    for (const f of filas) {
      const li = document.createElement('li');
      const min = Math.floor(f.segundos / 60), seg = String(f.segundos % 60).padStart(2, '0');
      li.textContent = `${f.nombre} · ${f.puntos} puntos `;
      li.insertAdjacentHTML('beforeend', `<small>${min}:${seg}${f.escapo ? '' : ' · atrapado'}</small>`);
      if (mio && !mio.pendiente && f.nombre === progreso.opciones.nombre && f.puntos === mio.puntosFinales) li.className = 'yo';
      tabla.appendChild(li);
    }
  } catch (e) {
    tabla.innerHTML = '';
    nota.textContent = 'No se pudo cargar el ranking (¿sin conexión?).';
  }
}

async function compartirTexto(texto) {
  try {
    if (navigator.share && document.body.classList.contains('tactil')) { await navigator.share({ text: texto }); return; }
    await navigator.clipboard.writeText(texto);
    mensajeMenu('Copiado. Pégalo en tu chat.');
  } catch (e) {
    if (e.name !== 'AbortError') prompt('Copia tu resultado:', texto);
  }
}
// un aviso breve en los menús (el de la partida no se ve fuera del juego)
function mensajeMenu(t) {
  const b = document.querySelector('.pantalla:not([hidden]) #btn-compartir, .pantalla:not([hidden]) #btn-diaria-compartir');
  if (!b) return;
  const antes = b.textContent;
  b.textContent = t;
  setTimeout(() => { b.textContent = antes; }, 2200);
}

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
  const antes = boton.textContent;
  boton.disabled = true; boton.textContent = texto;
  try { return await tarea(); }
  catch (e) { alFallar(e.message); }
  finally { boton.disabled = false; boton.textContent = antes; }
}

$('#btn-unirse').onclick = async () => {
  const codigo = normalizarCodigo($('#sala-codigo').value), error = $('#unirse-error');
  if (!codigoValido(codigo)) { error.textContent = 'El código son 4 letras.'; return; }
  error.textContent = '';
  const nombre = guardarNombreSala($('#sala-nombre').value);
  const s = await conectar($('#btn-unirse'), 'Conectando…', () => Sala.unirse(codigo, nombre), m => { error.textContent = m; });
  if (s) { enlazarSala(s); mostrar('sala'); pintarLobby(); }
};

async function crearSala() {
  const def = elegida, tamano = tamanoDe(def), limite = limiteDe(def);
  const s = await conectar($('#btn-entrar'), 'Creando sala…', () => Sala.crear(nombreElegido()), m => { $('#nota-modo').textContent = m; });
  if (!s) return;
  s.ponerConfig({ mazmorra: def.id, tamano, limite, tesoros: prep.tesoros });
  enlazarSala(s);
  mostrar('sala');
  pintarLobby();
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
  };
  s.alPerderse = motivo => perderSala(motivo);
  s.alTesoro = (i, id) => tesoroDeSala(i, id);
  s.alEnemigos = snap => { if (enPartidaDeSala()) juego.recibirEnemigos(snap); };
  s.alGolpe = (i, daño) => { const e = enPartidaDeSala(true) && juego.enemigos[i]; if (e && e.estado !== 'muerto') juego.herir(e, daño); };
  s.alDano = (n, causa) => { if (enPartidaDeSala()) juego.dañarJugador(n, causa); };
  s.alForzado = (id, a) => { if (enPartidaDeSala()) mensaje(`${sala.jugadores.find(q => q.id === id)?.nombre || 'Otro cazador'} forzó una puerta`, 3); };
  s.alSuelto = (i, x, z) => { const o = actual?.sala && juego?.objetos[i]; if (o?.tipo === 'tesoro') juego.reponer(o, x, z); };
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
  $('#sala-config').textContent = def ? `${def.nombre}${def.sectores ? ` · ${TAMANOS[c.tamano] ? ['pequeña', 'mediana', 'grande'][Object.keys(TAMANOS).indexOf(c.tamano)] : ''}` : ''} · ${c.limite / 60} minutos · tesoros ${c.tesoros === 'compartidos' ? 'compartidos' : 'exclusivos'}` : '';
  const boton = $('#btn-empezar-sala');
  boton.hidden = !anfitrion;
  boton.disabled = !lista.every(j => j.estado === 'sala') || !$('#cuenta').hidden;
}

$('#btn-salir-sala').onclick = () => {
  const eraAnfitrion = sala?.soyAnfitrion;
  cerrarSala();
  mostrar(eraAnfitrion ? 'preparar' : 'portada');
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
  sala.empezar({ semilla: Math.floor(Math.random() * 2 ** 32), mazmorra: c.mazmorra, tamano: c.tamano, limite: c.limite, tesoros: c.tesoros, cuenta: 3 });
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
    empezar(def, p.tamano, p.limite, null, { semilla: p.semilla, azarPistas: azarConSemilla(p.semilla ^ 0x9e3779b9), tesoros: p.tesoros });
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
function tesoroDeSala(i, id) {
  const o = actual?.sala && !actual.sala.fin && juego?.objetos[i];
  if (!o || o.tipo !== 'tesoro' || o.cogido) return;
  if (id === sala.yo) { juego.tomar(o); return; }
  const j = sala.jugadores.find(q => q.id === id);
  juego.ceder(o, { nombre: j?.nombre || 'Otro cazador', color: j?.color || 'rojo' });
  mensaje(`${j?.nombre || 'Otro cazador'} se llevó ${TESORO[o.tesoro].nombre}`, 3);
}

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
  for (const [id, c] of cazadores) {
    const antes = Math.hypot(c.x - c.rx, c.z - c.rz);
    c.rx += (c.x - c.rx) * k; c.rz += (c.z - c.rz) * k; c.ry += (c.y - c.ry) * k;
    const camina = antes / Math.max(dt, 0.001) > 0.8;
    const color = sala?.jugadores.find(j => j.id === id)?.color || COLORES[id % COLORES.length];
    sprites.push({ x: c.rx, z: c.rz, y: c.ry, ancho: 0.95, alto: 0.95, tex: `cazador_${color}_${camina ? Math.floor(t / 180) % 2 : 8}`, luz: Math.max(0.6, m.celda(Math.floor(c.rx), Math.floor(c.rz))?.luz ?? 0.5) });
  }
  if (t - hudSalaT > 400) { hudSalaT = t; pintarHudSala(); }
}

function pintarHudSala() {
  const hud = $('#hud-sala');
  if (hud.hidden || !sala) return;
  const filas = sala.jugadores.map(j => ({ j, mio: j.id === sala.yo, aqui: j.id === sala.yo || cazadores.has(j.id) }))
    .map(({ j, mio, aqui }) => ({ ...j, mio, aqui, pt: mio ? juego.puntos() : (cazadores.get(j.id)?.pt ?? ultimoMarcador?.find(f => f.id === j.id)?.puntos ?? 0) }));
  filas.sort((a, b) => b.pt - a.pt || a.id - b.id);   // el que va ganando, arriba
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
  const detalle = { tesoros: juego.tesoros, resueltos: Object.values(juego.mapa.acertijos).filter(a => a.resuelto).map(a => String(a.id)) };
  if (sala) sala.terminar(puntos, exito, detalle);
  else ultimoMarcador = null;
  pintarMarcador();
}

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

// `diaria`: la expedición del día (js/diaria.js), con su semilla y sus modificadores.
// `enSala`: la partida de una sala, con la semilla y las pistas que comparten todos los cazadores.
function empezar(def, tamano = 'grande', limite = 0, diaria = null, enSala = null) {
  if (!render) return;
  activarAudio();
  actual = { def, tamano, limite, diaria, sala: enSala };
  juego = new Juego(recortarZonas(def, TAMANOS[tamano].zonas), {
    mensaje,
    tesoro(t, r) {
      // en el contrarreloj el botín va a la colección solo si escapas con él
      if (juego.limite) { mensaje(`${t.nombre} (${r.nombre}): +${r.valor}`, 4); destello('oro'); return; }
      const nuevo = !progreso.tesoros.includes(t.id);
      if (nuevo) { progreso.tesoros.push(t.id); guardar(); }
      mensaje(`${nuevo ? '¡Tesoro!' : 'Ya lo tenías:'} ${t.nombre} (${r.nombre})`, 4);
      destello('oro');
      actualizarHUD();
    },
    daño() { destello('rojo'); },
    reclamar: enSala && enSala.tesoros !== 'compartidos' ? o => reclamarTesoro(o) : undefined,
    golpear: enSala ? (i, d) => sala?.golpear(i, d) : undefined,
    dañarA: enSala ? (id, n, c) => sala?.danar(id, n, c) : undefined,
    solto: enSala && enSala.tesoros !== 'compartidos' ? o => sala?.soltar(o.n, o.x, o.z) : undefined,
    forzo: enSala ? a => sala?.forzar(a) : undefined,
    vibrar,
    abrirTablilla: a => abrirPanelTablilla(a),
    reconstruir: () => render.construir(juego.mapa),
    salida: r => terminar(r, true),
    muerte: r => juego.limite ? juego.caer() : setTimeout(() => terminar(r, false), 1400),
    tiempoAgotado: r => terminar(r, false),
  }, (diaria || enSala)?.semilla, { limite, modificadores: diaria?.modificadores, real: !!enSala, rol: enSala ? (sala?.soyAnfitrion ? 'anfitrion' : 'invitado') : null });
  $('#hud-reloj').hidden = !limite;
  $('#caja-puntos').hidden = !limite;
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
  mensaje(diaria ? `Expedición nº ${diaria.numero}: ${def.nombre}` : def.nombre, 3);
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
  // en la expedición del día todos ven las mismas pistas, aunque ya las hayan resuelto antes
  const diaria = actual.diaria || actual.sala;
  const resueltas = diaria ? new Set() : new Set(progreso.pistas);
  const azar = diaria ? diaria.azarPistas : Math.random;
  const dificultad = juego.mods.has('escritura') ? a.dificultad.map(d => Math.min(5, d + 1)) : a.dificultad;
  // con tantas tablillas por mazmorra, ninguna repite la pista que ya muestra otra
  const enUso = () => new Set(Object.values(juego.mapa.acertijos).filter(o => o !== a && o.estado).map(o => o.estado.pista.id));
  if (!a.estado && a.tipo !== 'palancas') a.estado = { titulo: a.titulo, pista: elegirPista(dificultad, resueltas, enUso(), azar), nivel: 0, vistas: new Set() };
  const panel = $('#panel');
  if (a.tipo === 'palancas') {
    a.estadoPalancas ||= { titulo: a.titulo, acertijo: crearPalancas(azar) };
    abrirPalancas(panel, a.estadoPalancas, {
      alResolver() { panel.hidden = true; juego.resolverAcertijo(a); reanudar(); },
      alCerrar() { panel.hidden = true; reanudar(); },
    });
    return;
  }
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
      a.estado.pista = elegirPista(dificultad, resueltas, new Set([...a.estado.vistas, ...enUso()]), azar);
      a.estado.nivel = 0;
    },
  });
}

function terminar(r, exito) {
  if (actual.sala) { actual.sala.fin = true; $('#hud-sala').hidden = true; }
  pausar();
  sonar(exito ? 'victoria' : 'derrota');
  $('#panel').hidden = true;
  $('#btn-compartir').hidden = true;
  $('#resumen-sala').hidden = $('#btn-volver-sala').hidden = true;
  $('#btn-reintentar').hidden = false;
  if (r.limite) return terminarContrarreloj(r, exito);
  if (exito && actual.tamano === 'grande') {
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
  $('#btn-reintentar').textContent = 'Jugar de nuevo';
  $('#btn-reintentar').onclick = () => empezar(actual.def, actual.tamano, actual.limite);
  mostrar('resumen');
  detenerAmbiente();
  document.body.classList.remove('jugando');
}

// Al escapar te llevas todos los puntos y los tesoros van a tu colección; si se acaba el tiempo adentro, la mitad de los puntos y ningún tesoro.
function terminarContrarreloj(r, exito) {
  const puntos = exito ? r.puntos : Math.floor(r.puntos / 2);
  if (exito) for (const id of r.tesoros) if (!progreso.tesoros.includes(id)) progreso.tesoros.push(id);
  // la expedición del día, con sus modificadores, no cuenta para los récords del contrarreloj
  const clave = `${r.mazmorra.id}:${actual.tamano}:${r.limite}`, antes = actual.diaria || actual.sala ? Infinity : recordDe(r.mazmorra, actual.tamano, r.limite);
  if (puntos > antes) (progreso.records ||= {})[clave] = puntos;
  guardar();
  const min = Math.floor(r.reloj / 60), seg = Math.floor(r.reloj % 60);
  $('#resumen h2').textContent = exito ? `¡Escapaste con ${puntos} punto${puntos === 1 ? '' : 's'}!` : r.causa;
  $('#resumen .datos').innerHTML = `
    <li>Puntos: <b>${exito ? puntos : `${r.puntos} → ${puntos}`}</b>${exito ? '' : ' (la mitad, por no escapar)'}</li>
    ${puntos > antes ? '<li>¡Nuevo récord!</li>' : antes && antes < Infinity ? `<li>Récord: <b>${antes}</b></li>` : ''}
    <li>Tesoros: <b>${r.tesoros.length}/${r.totalTesoros}</b></li>
    <li>Acertijos: <b>${r.acertijos}/${r.totalAcertijos}</b></li>
    <li>Tiempo: <b>${min}:${String(seg).padStart(2, '0')}</b> de ${r.limite / 60}:00</li>`;
  $('#resumen .tesoros').innerHTML = r.tesoros.map(id => `<span style="color:${RAREZAS[TESORO[id].rareza].color}">${TESORO[id].nombre} +${RAREZAS[TESORO[id].rareza].valor}</span>`).join('');
  $('#btn-reintentar').textContent = 'Revancha';
  $('#btn-reintentar').onclick = () => empezar(actual.def, actual.tamano, actual.limite);
  if (actual.diaria) resumenDiaria(r, exito, puntos);
  if (actual.sala) resumenSala(puntos, exito);
  mostrar('resumen');
  detenerAmbiente();
  document.body.classList.remove('jugando');
}

// En la expedición del día el primer intento queda guardado; la revancha es práctica con la misma cripta.
function resumenDiaria(r, exito, puntos) {
  const exp = actual.diaria, primera = !diarias()[exp.fecha];
  const resultado = {
    escapo: exito, puntosFinales: puntos, reloj: r.reloj, tesoros: [...r.tesoros], totalTesoros: r.totalTesoros,
    acertijos: r.acertijos, totalAcertijos: r.totalAcertijos,
  };
  if (primera) { diarias()[exp.fecha] = { ...resultado, pendiente: hayRanking() }; guardar(); enviarPendientes(); }
  const oficial = diarias()[exp.fecha], n = racha(diarias());
  $('#resumen .datos').insertAdjacentHTML('afterbegin', primera
    ? `<li>Expedición nº ${exp.numero} · racha de <b>${n}</b> día${n === 1 ? '' : 's'}</li>`
    : `<li>Práctica · tu resultado de hoy: <b>${oficial.puntosFinales}</b> puntos</li>`);
  const b = $('#btn-compartir');
  b.hidden = false;
  b.onclick = () => compartirTexto(textoCompartir(exp, oficial, id => TESORO[id].rareza, URL_JUEGO));
  $('#btn-reintentar').textContent = 'Practicar';
  $('#btn-reintentar').onclick = () => { const e = expedicion(MAZMORRAS, exp.fecha); empezar(e.def, TAMANO_DIARIA, MINUTOS_DIARIA * 60, e); };
}

document.addEventListener('pointerlockchange', () => {
  if (!document.pointerLockElement && juego && !pausado && !document.body.classList.contains('tactil') && $('#panel').hidden) {
    pausar(); $('#pausa').hidden = false;
  }
});
$('#btn-continuar').onclick = () => reanudar();
$('#btn-menu-pausa').onclick = () => { cerrarSala(); $('#pausa').hidden = true; juego = null; detenerAmbiente(); document.body.classList.remove('jugando'); pintarMazmorras(); mostrar('mazmorras'); };
$('#btn-pausa').addEventListener('click', () => { pausar(); $('#pausa').hidden = false; });

function actualizarHUD() {
  const j = juego.j;
  $('#hud-vida').textContent = j.vida;
  $('#hud-vida').parentElement.classList.toggle('baja', j.vida <= 25);
  $('#hud-arma').textContent = j.arma === 'revolver' ? 'Revólver' : 'Látigo';
  $('#hud-balas').textContent = j.arma === 'revolver' ? `${j.tambor} | ${j.reserva}` : (j.tieneRevolver ? `${j.tambor} | ${j.reserva}` : '—');
  $('#hud-tesoros').textContent = `${juego.tesoros.length}/${juego.totalTesoros}`;
  $('#caja-palanca').hidden = !j.barreta;
  if (juego.limite) {
    const r = Math.ceil(juego.restante()), rel = $('#hud-reloj');
    rel.textContent = `${Math.floor(r / 60)}:${String(r % 60).padStart(2, '0')}`;
    rel.classList.toggle('urgente', r <= 60);
    $('#hud-puntos').textContent = juego.puntos();
  }
  // el guardián, mientras pelea
  const g = juego.guardian, hj = $('#hud-jefe');
  hj.hidden = !g || g.estado === 'dormido' || g.estado === 'muerto';
  if (!hj.hidden) {
    hj.children[0].textContent = g.nombre;
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
  if (ent.pulsos.has('mapa') && !pausado) capaMapa.hidden = !capaMapa.hidden;
  if (!pausado || (actual?.sala && !actual.sala.fin)) { juego.actualizar(dt, ent); actualizarAmbiente(dt, Math.max(juego.tension(), juego.limite && juego.restante() <= 60 ? 0.7 : 0)); }
  else if (juego.limite && !$('#panel').hidden) juego.avanzarReloj(dt); // el reloj no se detiene mientras lees una tablilla

  render.ajustarTamano(CALIDADES[calidad]);
  // la antorcha titila
  const linterna = (juego.j.muerto ? 0.3 : 0.92 + Math.sin(t * 0.013) * 0.05 + Math.sin(t * 0.031) * 0.04 + Math.sin(t * 0.071) * 0.025)
    * (juego.mods.has('oscuridad') ? 0.5 : 1);
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
    dibujarAutomapa(ctxMapa, w, h, juego);
  }
  actualizarHUD();
  botonUsar.classList.toggle('listo', juego.puedeUsar());
  recargaAutomatica();

  fpsN++; fpsT += dt;
  if (fpsT > 1) { $('#fps').textContent = `${Math.round(fpsN / fpsT)} fps`; fpsN = 0; fpsT = 0; }
}
requestAnimationFrame(cuadro);

// Pausa al salir de la pestaña.
document.addEventListener('visibilitychange', () => { if (document.hidden && juego && !pausado) { pausar(); $('#pausa').hidden = false; } });

// App instalable (sin conexión).
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});

mostrar('portada');
const invitacion = normalizarCodigo(new URLSearchParams(location.search).get('sala'));
if (invitacion) {
  abrirUnirse(invitacion);
  // el enlace queda limpio: recargar la página no vuelve a abrir la invitación
  const q = new URLSearchParams(location.search); q.delete('sala');
  history.replaceState(history.state, '', location.pathname + (q.size ? `?${q}` : ''));
}
window.__reliquias = { get juego() { return juego; }, get actual() { return actual; }, get sala() { return sala; }, get cazadores() { return cazadores; }, empezar, MAZMORRAS };
