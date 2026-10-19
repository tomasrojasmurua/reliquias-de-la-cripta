import { crearAtlas, registrarTesoros, miniatura } from './texturas.js';
import { Render } from './render.js';
import { Entrada } from './entrada.js';
import { Juego } from './juego.js';
import { dibujarArma } from './arma.js';
import { dibujarAutomapa } from './automapa.js';
import { iniciarEscena, animarEscena } from './escena.js';
import { activarAudio, sonar, alternarSilencio, alternarMusica, ponerSilencio, ponerMusica, iniciarAmbiente, detenerAmbiente, atenuarAmbiente, actualizarAmbiente } from './audio.js';
import { abrirTablilla, elegirPista } from './acertijos.js';
import { recortarZonas } from './laberinto.js';
import { MAZMORRAS, tesorosDe } from '../datos/mazmorras.js';
import { TESOROS, TESORO, RAREZAS } from '../datos/tesoros.js';
import { lienzoEmblema } from '../datos/emblemas.js';
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
const prep = { modo: progreso.opciones.modo || 'explorar', tamano: progreso.opciones.tamano || 'grande', ritmo: progreso.opciones.ritmo ?? 1 };
let elegida = null;   // la mazmorra de la pantalla de preparación
let actual = null;    // la partida en curso { def, tamano, limite }, para jugar de nuevo
const recordDe = (def, tamano, seg) => (progreso.records || {})[`${def.id}:${tamano}:${seg}`] || 0;
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

const ROMANOS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

// ---------- Preparar la expedición ----------

// las mazmorras sin zonas tienen un solo tamaño
const tamanoDe = def => def.sectores ? prep.tamano : 'grande';
const limiteDe = def => prep.modo === 'contrarreloj' ? TAMANOS[tamanoDe(def)].minutos[prep.ritmo] * 60 : 0;
const minuscula = t => t[0].toLowerCase() + t.slice(1);

function abrirPreparar(def) {
  elegida = def;
  pintarPreparar();
  mostrar('preparar');
}
function pintarPreparar() {
  const def = elegida, Z = def.sectores, tam = tamanoDe(def), contra = prep.modo === 'contrarreloj';
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
  document.querySelectorAll('[data-ritmo]').forEach((b, i) => {
    b.innerHTML = `${RITMOS[i]}<small>${TAMANOS[tam].minutos[i]} min</small>`;
    b.classList.toggle('activo', i === prep.ritmo);
  });
  const seg = limiteDe(def), rec = recordDe(def, tam, seg);
  $('#nota-modo').textContent = contra
    ? `Tienes ${seg / 60} minutos para reunir el botín más valioso y salir. Si se apaga la última antorcha antes de escapar, pierdes la mitad de los puntos.${rec ? ` Récord: ${rec} puntos.` : ''}`
    : 'Explora sin apuro: cada tesoro que encuentres va a tu colección.';
}
const elegir = (clave, valor) => { prep[clave] = valor; progreso.opciones[clave] = valor; guardar(); pintarPreparar(); };
for (const b of document.querySelectorAll('[data-modo]')) b.onclick = () => elegir('modo', b.dataset.modo);
for (const b of document.querySelectorAll('[data-tamano]')) b.onclick = () => elegir('tamano', b.dataset.tamano);
for (const b of document.querySelectorAll('[data-ritmo]')) b.onclick = () => elegir('ritmo', +b.dataset.ritmo);
$('#btn-entrar').onclick = () => empezar(elegida, tamanoDe(elegida), limiteDe(elegida));

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

document.addEventListener('click', e => {
  const b = e.target.closest('[data-ir]');
  if (!b) return;
  activarAudio();
  const ir = b.dataset.ir;
  if (ir === 'mazmorras') pintarMazmorras();
  if (ir === 'diaria') pintarDiaria();
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
}
$('#btn-diaria').onclick = () => {
  const exp = expedicion(MAZMORRAS);
  empezar(exp.def, TAMANO_DIARIA, MINUTOS_DIARIA * 60, exp);
};

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

// ---------- Partida ----------

// `diaria`: la expedición del día (js/diaria.js), con su semilla y sus modificadores.
function empezar(def, tamano = 'grande', limite = 0, diaria = null) {
  if (!render) return;
  activarAudio();
  actual = { def, tamano, limite, diaria };
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
    vibrar,
    abrirTablilla: a => abrirPanelTablilla(a),
    salida: r => terminar(r, true),
    muerte: r => juego.limite ? juego.caer() : setTimeout(() => terminar(r, false), 1400),
    tiempoAgotado: r => terminar(r, false),
  }, diaria?.semilla, { limite, modificadores: diaria?.modificadores });
  $('#hud-reloj').hidden = !limite;
  $('#caja-puntos').hidden = !limite;
  document.body.classList.toggle('contrarreloj', !!limite);
  render.construir(juego.mapa);
  capaMapa.hidden = true;
  iniciarAmbiente(def.ambiente);
  document.body.classList.add('jugando');
  mostrar('juego');
  reanudar();
  mensaje(diaria ? `Expedición nº ${diaria.numero}: ${def.nombre}` : def.nombre, 3);
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
  // en la expedición del día todos ven las mismas pistas, aunque ya las hayan resuelto antes
  const diaria = actual.diaria;
  const resueltas = diaria ? new Set() : new Set(progreso.pistas);
  const azar = diaria ? diaria.azarPistas : Math.random;
  const dificultad = juego.mods.has('escritura') ? a.dificultad.map(d => Math.min(5, d + 1)) : a.dificultad;
  // con tantas tablillas por mazmorra, ninguna repite la pista que ya muestra otra
  const enUso = () => new Set(Object.values(juego.mapa.acertijos).filter(o => o !== a && o.estado).map(o => o.estado.pista.id));
  if (!a.estado) a.estado = { titulo: a.titulo, pista: elegirPista(dificultad, resueltas, enUso(), azar), nivel: 0, vistas: new Set() };
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
      a.estado.pista = elegirPista(dificultad, resueltas, new Set([...a.estado.vistas, ...enUso()]), azar);
      a.estado.nivel = 0;
    },
  });
}

function terminar(r, exito) {
  pausar();
  $('#panel').hidden = true;
  $('#btn-compartir').hidden = true;
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
  const clave = `${r.mazmorra.id}:${actual.tamano}:${r.limite}`, antes = actual.diaria ? Infinity : recordDe(r.mazmorra, actual.tamano, r.limite);
  if (puntos > antes) (progreso.records ||= {})[clave] = puntos;
  guardar();
  const min = Math.floor(r.reloj / 60), seg = Math.floor(r.reloj % 60);
  $('#resumen h2').textContent = exito ? `¡Escapaste con ${puntos} puntos!` : r.causa;
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
  if (primera) { diarias()[exp.fecha] = resultado; guardar(); }
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
$('#btn-menu-pausa').onclick = () => { $('#pausa').hidden = true; juego = null; detenerAmbiente(); document.body.classList.remove('jugando'); pintarMazmorras(); mostrar('mazmorras'); };
$('#btn-pausa').addEventListener('click', () => { pausar(); $('#pausa').hidden = false; });

function actualizarHUD() {
  const j = juego.j;
  $('#hud-vida').textContent = j.vida;
  $('#hud-vida').parentElement.classList.toggle('baja', j.vida <= 25);
  $('#hud-arma').textContent = j.arma === 'revolver' ? 'Revólver' : 'Látigo';
  $('#hud-balas').textContent = j.arma === 'revolver' ? `${j.tambor} | ${j.reserva}` : (j.tieneRevolver ? `${j.tambor} | ${j.reserva}` : '—');
  $('#hud-tesoros').textContent = `${juego.tesoros.length}/${juego.totalTesoros}`;
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
  if (!pausado) { juego.actualizar(dt, ent); actualizarAmbiente(dt, Math.max(juego.tension(), juego.limite && juego.restante() <= 60 ? 0.7 : 0)); }
  else if (juego.limite && !$('#panel').hidden) juego.avanzarReloj(dt); // el reloj no se detiene mientras lees una tablilla

  render.ajustarTamano(CALIDADES[calidad]);
  // la antorcha titila
  const linterna = (juego.j.muerto ? 0.3 : 0.92 + Math.sin(t * 0.013) * 0.05 + Math.sin(t * 0.031) * 0.04 + Math.sin(t * 0.071) * 0.025)
    * (juego.mods.has('oscuridad') ? 0.5 : 1);
  render.dibujar(juego.camara(), juego.sprites(), { linterna, fogonazo: juego.fogonazo, penumbra: juego.penumbra() });

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
