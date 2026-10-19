import { crearAtlas, registrarTesoros, miniatura } from './texturas.js';
import { Render } from './render.js';
import { Entrada } from './entrada.js';
import { Juego } from './juego.js';
import { dibujarArma } from './arma.js';
import { dibujarAutomapa } from './automapa.js';
import { iniciarEscena, animarEscena } from './escena.js';
import { activarAudio, sonar, alternarSilencio, alternarMusica, ponerSilencio, ponerMusica, iniciarAmbiente, detenerAmbiente, atenuarAmbiente, actualizarAmbiente } from './audio.js';
import { abrirTablilla, elegirPista } from './acertijos.js';
import { MAZMORRAS, tesorosDe } from '../datos/mazmorras.js';
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
// Contrarreloj: segundos para reunir el botín y escapar (0 = explorar sin reloj).
let limite = progreso.opciones.limite || 0;
const recordDe = (def, seg) => (progreso.records || {})[def.id + ':' + seg] || 0;
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

function pintarModos() {
  for (const b of document.querySelectorAll('[data-limite]')) b.classList.toggle('activo', +b.dataset.limite === limite);
  $('#nota-modo').textContent = limite
    ? `Tienes ${limite / 60} minutos para reunir el botín más valioso y salir. Si se apaga la última antorcha antes de escapar, pierdes la mitad de los puntos.`
    : 'Explora sin apuro: cada tesoro que encuentres va a tu colección.';
}
for (const b of document.querySelectorAll('[data-limite]')) b.onclick = () => {
  limite = +b.dataset.limite; progreso.opciones.limite = limite; guardar(); pintarMazmorras();
};

function pintarMazmorras() {
  pintarModos();
  const lista = $('#lista-mazmorras');
  lista.innerHTML = '';
  for (const m of MAZMORRAS) {
    const ids = tesorosDe(m);
    const tengo = ids.filter(id => progreso.tesoros.includes(id)).length;
    const est = progreso.mazmorras[m.id] || {};
    const b = document.createElement('button');
    b.className = 'mazmorra';
    b.innerHTML = `<em class="numero">${ROMANOS[MAZMORRAS.indexOf(m)]}</em><strong>${m.nombre}</strong><span>${m.descripcion}</span>
      <div class="barra"><i style="width:${Math.round(tengo / ids.length * 100)}%"></i></div>
      <small>Tesoros ${tengo} de ${ids.length}${est.completada ? ' · Completada' : ''}${limite && recordDe(m, limite) ? ` · Récord ${recordDe(m, limite)} puntos` : ''}</small>`;
    b.onclick = () => empezar(m);
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
  }, undefined, { limite });
  $('#hud-reloj').hidden = !limite;
  $('#caja-puntos').hidden = !limite;
  document.body.classList.toggle('contrarreloj', !!limite);
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
  // con tantas tablillas por mazmorra, ninguna repite la pista que ya muestra otra
  const enUso = () => new Set(Object.values(juego.mapa.acertijos).filter(o => o !== a && o.estado).map(o => o.estado.pista.id));
  if (!a.estado) a.estado = { titulo: a.titulo, pista: elegirPista(a.dificultad, resueltas, enUso()), nivel: 0, vistas: new Set() };
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
      a.estado.pista = elegirPista(a.dificultad, resueltas, new Set([...a.estado.vistas, ...enUso()]));
      a.estado.nivel = 0;
    },
  });
}

function terminar(r, exito) {
  pausar();
  $('#panel').hidden = true;
  if (r.limite) return terminarContrarreloj(r, exito);
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
  $('#btn-reintentar').textContent = 'Jugar de nuevo';
  $('#btn-reintentar').onclick = () => empezar(r.mazmorra);
  mostrar('resumen');
  detenerAmbiente();
  document.body.classList.remove('jugando');
}

// Al escapar te llevas todos los puntos y los tesoros van a tu colección; si se acaba el tiempo adentro, la mitad de los puntos y ningún tesoro.
function terminarContrarreloj(r, exito) {
  const puntos = exito ? r.puntos : Math.floor(r.puntos / 2);
  if (exito) for (const id of r.tesoros) if (!progreso.tesoros.includes(id)) progreso.tesoros.push(id);
  const clave = r.mazmorra.id + ':' + r.limite, antes = recordDe(r.mazmorra, r.limite);
  if (puntos > antes) (progreso.records ||= {})[clave] = puntos;
  guardar();
  const min = Math.floor(r.reloj / 60), seg = Math.floor(r.reloj % 60);
  $('#resumen h2').textContent = exito ? `¡Escapaste con ${puntos} puntos!` : r.causa;
  $('#resumen .datos').innerHTML = `
    <li>Puntos: <b>${exito ? puntos : `${r.puntos} → ${puntos}`}</b>${exito ? '' : ' (la mitad, por no escapar)'}</li>
    ${puntos > antes ? '<li>¡Nuevo récord!</li>' : antes ? `<li>Récord: <b>${antes}</b></li>` : ''}
    <li>Tesoros: <b>${r.tesoros.length}/${r.totalTesoros}</b></li>
    <li>Acertijos: <b>${r.acertijos}/${r.totalAcertijos}</b></li>
    <li>Tiempo: <b>${min}:${String(seg).padStart(2, '0')}</b> de ${r.limite / 60}:00</li>`;
  $('#resumen .tesoros').innerHTML = r.tesoros.map(id => `<span style="color:${RAREZAS[TESORO[id].rareza].color}">${TESORO[id].nombre} +${RAREZAS[TESORO[id].rareza].valor}</span>`).join('');
  $('#btn-reintentar').textContent = 'Revancha';
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
  if (juego.limite) {
    const r = Math.ceil(juego.restante()), rel = $('#hud-reloj');
    rel.textContent = `${Math.floor(r / 60)}:${String(r % 60).padStart(2, '0')}`;
    rel.classList.toggle('urgente', r <= 60);
    $('#hud-puntos').textContent = juego.puntos();
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
  const linterna = juego.j.muerto ? 0.3 : 0.92 + Math.sin(t * 0.013) * 0.05 + Math.sin(t * 0.031) * 0.04 + Math.sin(t * 0.071) * 0.025;
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
