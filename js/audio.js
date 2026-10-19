// Sonido sintetizado con Web Audio (sin archivos): efectos, voces de los enemigos (con distancia y
// lado), ambiente de cada mazmorra, música de cada lugar y de los menús, y eco de la sala.

import { Musica, INSTRUMENTOS, PERCUSION, crearReverb } from './musica.js';

let ctx = null;
let ruidoBuf = null;
let maestro = null;  // todo pasa por aquí (silencio)
let salida = null;   // efectos → eco y altavoz
let eco = null;      // {envio, realim, ret}: retardo con realimentación
let busMusica = null;
let reverb = null;
let musica = null;          // el tema que suena
let temaPedido = null;      // el que debería sonar (aunque el audio aún no esté activo)
let reloj = 0;
export let silencio = false;
export let sinMusica = false;

const MUSICA_VOL = 0.9;

export function activarAudio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    ruidoBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = ruidoBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    maestro = ctx.createGain(); maestro.gain.value = silencio ? 0 : 1;
    // un compresor suave para que nada sature cuando suenan muchas cosas juntas
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4; comp.attack.value = 0.005; comp.release.value = 0.25;
    maestro.connect(comp).connect(ctx.destination);
    // efectos: seco + eco filtrado (como una sala de piedra)
    salida = ctx.createGain();
    salida.connect(maestro);
    const ret = ctx.createDelay(1); ret.delayTime.value = 0.19;
    const realim = ctx.createGain(); realim.gain.value = 0.32;
    const filtro = ctx.createBiquadFilter(); filtro.type = 'lowpass'; filtro.frequency.value = 1800;
    const envio = ctx.createGain(); envio.gain.value = 0.35;
    salida.connect(envio).connect(ret).connect(filtro).connect(realim).connect(ret);
    filtro.connect(maestro);
    eco = { envio, realim, ret };
    // música: su propio volumen y una sala grande
    busMusica = ctx.createGain(); busMusica.gain.value = sinMusica ? 0 : MUSICA_VOL;
    busMusica.connect(maestro);
    reverb = crearReverb(ctx);
    const vuelta = ctx.createGain(); vuelta.gain.value = 0.7;
    reverb.connect(vuelta).connect(busMusica);
    // el secuenciador agenda las notas un poco por delante
    reloj = setInterval(() => {
      if (musica && !sinMusica && !silencio) musica.programar(ctx.currentTime + 0.35);
    }, 90);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) ctx.suspend?.(); else ctx.resume?.();
    });
    if (temaPedido) arrancarTema(temaPedido);
  }
  if (ctx.state === 'suspended' && !document.hidden) ctx.resume();
}

export function alternarSilencio() {
  silencio = !silencio;
  if (ctx) maestro.gain.setTargetAtTime(silencio ? 0 : 1, ctx.currentTime, 0.05);
  return silencio;
}
export function ponerSilencio(v) { if (v !== silencio) alternarSilencio(); }
export function alternarMusica() {
  sinMusica = !sinMusica;
  if (ctx) busMusica.gain.setTargetAtTime(sinMusica ? 0 : MUSICA_VOL, ctx.currentTime, 0.3);
  return sinMusica;
}
export function ponerMusica(v) { if (v === sinMusica) alternarMusica(); }

// ---------- Música ----------

// Cambia de tema con un fundido. 'portada' es el de los menús; las mazmorras usan su ambiente.
export function tocarMusica(nombre) {
  if (nombre === temaPedido) return;
  temaPedido = nombre;
  if (ctx) arrancarTema(nombre);
}
function arrancarTema(nombre) {
  musica?.detener();
  musica = nombre ? new Musica({ ctx, ruido: ruidoBuf }, nombre, busMusica, reverb) : null;
}

// ---------- Efectos ----------

function env(g, t, a, d, v) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(v, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
}

function ruido(dur, frec, q, vol, tipo = 'lowpass', retardo = 0, destino = salida, frecFin = null) {
  const t = ctx.currentTime + retardo;
  const s = ctx.createBufferSource(); s.buffer = ruidoBuf;
  const f = ctx.createBiquadFilter(); f.type = tipo; f.frequency.setValueAtTime(frec, t); f.Q.value = q;
  if (frecFin) f.frequency.exponentialRampToValueAtTime(frecFin, t + dur);
  const g = ctx.createGain(); env(g, t, 0.003, dur, vol);
  s.connect(f).connect(g).connect(destino);
  s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
}

function tono(frec, dur, vol, forma = 'square', retardo = 0, frecFin = null, destino = salida) {
  const t = ctx.currentTime + retardo;
  const o = ctx.createOscillator(); o.type = forma; o.frequency.setValueAtTime(frec, t);
  if (frecFin) o.frequency.exponentialRampToValueAtTime(frecFin, t + dur);
  const g = ctx.createGain(); env(g, t, 0.005, dur, vol);
  o.connect(g).connect(destino);
  o.start(t); o.stop(t + dur + 0.05);
}

const FORMANTES = {
  a: [[730, 1], [1090, 0.5], [2440, 0.2]],
  o: [[500, 1], [850, 0.45], [2600, 0.12]],
  u: [[330, 1], [700, 0.35], [2500, 0.08]],
  e: [[530, 1], [1840, 0.45], [2480, 0.2]],
};

// Una voz: sierra con la altura que se desliza, pasada por los formantes de una vocal.
// aspereza: rugido (modula el volumen a esa frecuencia).
function vocal(f0, f1, dur, vocal, vol, destino, { retardo = 0, aspereza = 0, ataque = 0.04 } = {}) {
  const t = ctx.currentTime + retardo;
  const o = ctx.createOscillator(); o.type = 'sawtooth';
  o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = ctx.createGain(); env(g, t, ataque, dur, vol);
  const mezcla = ctx.createGain(); mezcla.gain.value = 1;
  const fuentes = [o];
  if (aspereza) {
    mezcla.gain.value = 0.55;
    const l = ctx.createOscillator(); l.type = 'square'; l.frequency.value = aspereza;
    const k = ctx.createGain(); k.gain.value = 0.45;
    l.connect(k).connect(mezcla.gain); fuentes.push(l);
  }
  o.connect(mezcla);
  for (const [ff, a] of FORMANTES[vocal]) {
    const fl = ctx.createBiquadFilter(); fl.type = 'bandpass'; fl.frequency.value = ff; fl.Q.value = 5;
    const k = ctx.createGain(); k.gain.value = a * 2.5;
    mezcla.connect(fl).connect(k).connect(g);
  }
  g.connect(destino);
  for (const f of fuentes) { f.start(t); f.stop(t + ataque + dur + 0.05); }
}

// Ruido que gruñe: soplo filtrado con temblor.
function rugido(dur, frec, q, vol, temblor, destino, retardo = 0) {
  const t = ctx.currentTime + retardo;
  const s = ctx.createBufferSource(); s.buffer = ruidoBuf; s.loop = true;
  const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = frec; f.Q.value = q;
  const m = ctx.createGain(); m.gain.value = 0.5;
  const l = ctx.createOscillator(); l.type = 'sine'; l.frequency.value = temblor;
  const k = ctx.createGain(); k.gain.value = 0.5;
  l.connect(k).connect(m.gain);
  const g = ctx.createGain(); env(g, t, 0.08, dur, vol);
  s.connect(f).connect(m).connect(g).connect(destino);
  s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.15); l.start(t); l.stop(t + dur + 0.15);
}

// Metal que resuena (armaduras, espadas).
function metal(frecs, dur, vol, destino, retardo = 0) {
  frecs.forEach((f, i) => tono(f * (0.98 + Math.random() * 0.04), dur / (1 + i * 0.4), vol / (1 + i * 0.6), 'sine', retardo, null, destino));
  ruido(0.04, 4000, 1, vol * 0.6, 'highpass', retardo, destino);
}

// Chasquidos secos (huesos, caparazones, patas).
function clics(n, sep, frec, vol, destino, retardo = 0) {
  for (let i = 0; i < n; i++) {
    const r = retardo + i * sep * (0.6 + Math.random() * 0.8);
    ruido(0.025, frec * (0.7 + Math.random() * 0.6), 3, vol, 'bandpass', r, destino);
    tono(frec * 0.35 * (0.8 + Math.random() * 0.4), 0.03, vol * 0.4, 'triangle', r, null, destino);
  }
}

function silbido(dur, vol, destino, retardo = 0, frec = 5000) { ruido(dur, frec, 0.7, vol, 'highpass', retardo, destino, frec * 1.3); }

const c = () => ({ ctx, ruido: ruidoBuf });

const SONIDOS = {
  disparo() {
    ruido(0.05, 3000, 0.6, 0.7, 'highpass');
    ruido(0.5, 1400, 0.7, 0.55, 'lowpass', 0, salida, 300);
    tono(150, 0.25, 0.55, 'sine', 0, 38);
    ruido(0.9, 500, 0.5, 0.12, 'lowpass', 0.12);
  },
  escopeta() {
    ruido(0.06, 2500, 0.5, 0.85, 'highpass');
    ruido(0.7, 1100, 0.7, 0.75, 'lowpass', 0, salida, 260);
    tono(110, 0.35, 0.7, 'sine', 0, 30);
    ruido(1.2, 400, 0.5, 0.18, 'lowpass', 0.15);
  },
  recargaE() {
    // se abre la escopeta, caen los cartuchos, se cierra
    tono(420, 0.04, 0.14, 'square'); ruido(0.05, 2500, 3, 0.18, 'bandpass');
    tono(1200, 0.03, 0.1, 'square', 0.35); tono(1500, 0.03, 0.1, 'square', 0.5);
    ruido(0.06, 1500, 3, 0.2, 'bandpass', 0.35); ruido(0.06, 1500, 3, 0.2, 'bandpass', 0.5);
    tono(300, 0.06, 0.2, 'square', 0.85, 180); ruido(0.08, 1200, 1, 0.3, 'lowpass', 0.85);
  },
  flecha() { ruido(0.12, 1800, 1, 0.1, 'bandpass', 0, salida, 4500); tono(300, 0.08, 0.1, 'triangle', 0, 120); },
  dardo() { ruido(0.05, 3500, 2, 0.3, 'bandpass'); tono(900, 0.05, 0.08, 'square', 0, 400); },
  vacio() { tono(1700, 0.025, 0.15, 'square'); ruido(0.02, 3000, 3, 0.1, 'bandpass'); },
  recarga() {
    for (let i = 0; i < 3; i++) { tono(950 + i * 70, 0.025, 0.1, 'square', i * 0.13); ruido(0.03, 3500, 4, 0.12, 'bandpass', i * 0.13); }
    tono(500, 0.05, 0.12, 'square', 0.48); ruido(0.05, 1800, 2, 0.15, 'bandpass', 0.48);
  },
  latigo() {
    ruido(0.14, 900, 1, 0.12, 'bandpass', 0, salida, 3500);
    ruido(0.04, 4200, 1.5, 0.6, 'bandpass', 0.11);
    tono(2600, 0.03, 0.12, 'square', 0.11, 900);
  },
  golpe() { ruido(0.1, 500, 1, 0.5); tono(110, 0.08, 0.2, 'sine', 0, 60); },
  palanca() { tono(1250, 0.05, 0.12, 'square'); tono(1870, 0.1, 0.1, 'triangle', 0.04); tono(90, 0.12, 0.2, 'sine', 0, 60); ruido(0.1, 5000, 2, 0.05, 'highpass', 0.02); },
  forzar() {
    tono(200, 0.3, 0.18, 'sawtooth', 0, 80); ruido(0.3, 350, 1, 0.4, 'lowpass');
    tono(1500, 0.04, 0.2, 'square', 0.3); ruido(0.12, 1400, 3, 0.5, 'bandpass', 0.3); tono(70, 0.2, 0.3, 'sine', 0.3, 40);
  },
  recoger() { tono(660, 0.08, 0.15, 'triangle'); tono(990, 0.14, 0.15, 'triangle', 0.07); ruido(0.08, 6000, 1, 0.04, 'highpass'); },
  tesoro() {
    [523, 659, 784, 1047, 1319].forEach((f, i) => tono(f, 0.3, 0.13, 'triangle', i * 0.08));
    INSTRUMENTOS.campana(c(), ctx.currentTime + 0.42, 1047, 2, 0.08, salida);
    for (let i = 0; i < 6; i++) tono(2000 + Math.random() * 2500, 0.15, 0.025, 'sine', 0.35 + i * 0.07);
  },
  puerta() { ruido(1.1, 220, 1, 0.4, 'lowpass', 0, salida, 120); tono(62, 1, 0.2, 'sawtooth', 0, 44); ruido(0.15, 160, 1, 0.4, 'lowpass', 1.0); },
  secreto() {
    ruido(1.6, 160, 1, 0.5, 'lowpass', 0, salida, 90);
    [392, 494, 587, 784].forEach((f, i) => tono(f, 0.4, 0.1, 'triangle', 0.5 + i * 0.13));
    INSTRUMENTOS.campana(c(), ctx.currentTime + 1.05, 784, 2, 0.05, salida);
  },
  // una corriente fría sale de una grieta: un soplo corto que apenas se nota
  corriente() { ruido(1.4, 900, 1.2, 0.14, 'bandpass', 0, salida, 300); },
  sellado() { tono(110, 0.25, 0.25, 'square'); tono(98, 0.3, 0.25, 'square', 0.15); },
  // el jugador
  dolor() { vocal(240, 170, 0.22, 'u', 0.35, salida, { ataque: 0.01 }); ruido(0.08, 500, 1, 0.25); },
  ataque() { ruido(0.15, 800, 1, 0.35); },
  // algo sale de su escondite: un roce de tierra y un chillido que sube
  surgir() { ruido(0.5, 300, 1, 0.45); ruido(0.35, 2600, 1.5, 0.12, 'bandpass', 0.1); tono(70, 0.5, 0.25, 'sawtooth', 0, 160); },
  error() { tono(160, 0.15, 0.2, 'square'); tono(120, 0.2, 0.2, 'square', 0.12); },
  acierto() {
    [523, 784, 1047].forEach((f, i) => tono(f, 0.35, 0.16, 'triangle', i * 0.1));
    INSTRUMENTOS.campana(c(), ctx.currentTime + 0.3, 523, 2, 0.06, salida);
  },
  fuego() { ruido(0.6, 700, 0.8, 0.35, 'bandpass', 0, salida, 2400); tono(220, 0.4, 0.08, 'sawtooth', 0, 90); },
  caida() { ruido(0.25, 260, 1, 0.45); tono(80, 0.18, 0.3, 'sine', 0, 45); },
  // queda un minuto en el contrarreloj: una campana honda
  campanada() { INSTRUMENTOS.campana(c(), ctx.currentTime, 98, 4, 0.35, salida); PERCUSION.timbal(c(), ctx.currentTime, 0.5, salida); },
  // al entrar a una mazmorra: la puerta de piedra que se cierra detrás
  entrada() { ruido(1.3, 180, 1, 0.35, 'lowpass', 0, salida, 90); PERCUSION.bombo(c(), ctx.currentTime + 1.1, 0.7, salida); },
  victoria() {
    const t = ctx.currentTime;
    [[0, 293.7, 0.25], [0.25, 349.2, 0.25], [0.5, 440, 0.25], [0.75, 587.3, 1.6]].forEach(([r, f, d]) => INSTRUMENTOS.cuerno(c(), t + r, f, d, 0.12, salida));
    INSTRUMENTOS.cuerno(c(), t + 0.75, 440, 1.6, 0.07, salida);
    PERCUSION.timbal(c(), t + 0.75, 0.7, salida);
    INSTRUMENTOS.campana(c(), t + 0.75, 1175, 3, 0.05, salida);
  },
  derrota() {
    const t = ctx.currentTime;
    [[0, 220, 0.6], [0.6, 207.7, 0.6], [1.2, 146.8, 2]].forEach(([r, f, d]) => INSTRUMENTOS.cuerno(c(), t + r, f, d, 0.1, salida));
    PERCUSION.timbal(c(), t + 1.2, 0.8, salida);
  },
  // menús
  menu_pasar() { tono(1300, 0.025, 0.025, 'triangle'); },
  menu_elegir() { tono(240, 0.09, 0.14, 'triangle', 0, 180); ruido(0.03, 1600, 2, 0.1, 'bandpass'); },
  menu_atras() { tono(200, 0.1, 0.12, 'triangle', 0, 130); ruido(0.03, 1000, 2, 0.08, 'bandpass'); },
  menu_alternar() { tono(700, 0.03, 0.08, 'triangle'); tono(950, 0.04, 0.08, 'triangle', 0.06); },
  menu_entrar() {
    INSTRUMENTOS.campana(c(), ctx.currentTime, 147, 3, 0.12, salida);
    PERCUSION.timbal(c(), ctx.currentTime, 0.6, salida);
  },
  // pasos según el suelo
  paso_piedra() { ruido(0.05, 900 + Math.random() * 300, 1.5, 0.12, 'bandpass'); },
  paso_arena() { ruido(0.09, 2400, 0.6, 0.07, 'highpass'); },
  paso_nieve() { ruido(0.11, 1600 + Math.random() * 600, 0.9, 0.1, 'bandpass'); ruido(0.05, 4000, 1, 0.04, 'highpass', 0.03); },
  paso_madera() { tono(140 + Math.random() * 30, 0.08, 0.12, 'triangle'); ruido(0.04, 600, 1, 0.06); },
  paso_hierba() { ruido(0.08, 3000, 0.5, 0.05, 'bandpass'); },
};

export function sonar(nombre) {
  if (!ctx || silencio) return;
  try { SONIDOS[nombre]?.(); } catch (e) { /* audio no disponible */ }
}

// ---------- Voces de los enemigos ----------
// Cada tipo de enemigo tiene su voz para cada momento:
//   alerta  te vio      voz    sigue tras de ti (de vez en cuando)
//   ataque  te golpea   dolor  lo heriste        muerte  cae     paso  sus pisadas (si se oyen)
//   surgir  sale de su escondite (bajo el suelo o del techo) cuando pasas cerca
// Los tipos nuevos solo necesitan su entrada aquí; si les falta alguna, usan la de `generico`.
// null = ese momento no suena (el jaguar, por ejemplo, camina sin ruido).

const VOCES = {
  generico: {
    alerta: d => { vocal(110, 80, 0.6, 'a', 0.3, d, { aspereza: 30 }); },
    voz: d => { vocal(95, 80, 0.5, 'o', 0.2, d, { aspereza: 26 }); },
    ataque: d => { ruido(0.15, 800, 1, 0.3, 'bandpass', 0, d); vocal(150, 110, 0.2, 'a', 0.2, d); },
    dolor: d => { vocal(220, 130, 0.18, 'a', 0.25, d); },
    muerte: d => { vocal(170, 45, 0.8, 'o', 0.3, d); ruido(0.5, 400, 1, 0.25, 'lowpass', 0, d); },
    paso: null,
    // un roce de tierra y un chillido que sube
    surgir: d => { ruido(0.5, 300, 1, 0.45, 'lowpass', 0, d); ruido(0.35, 2600, 1.5, 0.12, 'bandpass', 0.1, d); tono(70, 0.5, 0.25, 'sawtooth', 0, 160, d); },
  },
  momia: {
    alerta: d => { vocal(95, 72, 1.4, 'u', 0.35, d, { ataque: 0.25 }); ruido(1.1, 450, 2, 0.12, 'bandpass', 0.1, d, 300); },
    voz: d => { vocal(82, 70, 1.1, 'o', 0.22, d, { ataque: 0.3 }); },
    ataque: d => { ruido(0.3, 700, 1.5, 0.2, 'bandpass', 0, d, 300); vocal(125, 90, 0.35, 'a', 0.25, d); },
    dolor: d => { vocal(140, 95, 0.35, 'o', 0.3, d); },
    muerte: d => { vocal(100, 40, 1.5, 'u', 0.35, d, { ataque: 0.05 }); ruido(0.8, 600, 0.8, 0.2, 'lowpass', 0.4, d, 150); },
    paso: d => { ruido(0.22, 650, 1.2, 0.05, 'bandpass', 0, d, 400); },
  },
  esqueleto: {
    alerta: d => { clics(12, 0.035, 2600, 0.22, d); tono(420, 0.06, 0.2, 'triangle', 0.45, 300, d); tono(420, 0.06, 0.2, 'triangle', 0.55, 300, d); },
    voz: d => { clics(7, 0.04, 2400, 0.16, d); },
    ataque: d => { ruido(0.12, 1200, 1, 0.12, 'bandpass', 0, d, 3000); clics(2, 0.05, 1800, 0.25, d, 0.1); },
    dolor: d => { tono(500, 0.05, 0.25, 'triangle', 0, 350, d); clics(5, 0.03, 2800, 0.18, d, 0.04); },
    muerte: d => { clics(22, 0.03, 2200, 0.2, d); ruido(0.3, 300, 1, 0.25, 'lowpass', 0.55, d); },
    paso: d => { clics(2, 0.05, 2000, 0.06, d); },
  },
  draugr: {
    alerta: d => { vocal(62, 52, 1.3, 'a', 0.38, d, { aspereza: 27, ataque: 0.15 }); silbido(1.0, 0.06, d, 0.1, 3500); },
    voz: d => { vocal(58, 50, 0.9, 'o', 0.25, d, { aspereza: 24, ataque: 0.2 }); silbido(0.7, 0.04, d, 0, 3500); },
    ataque: d => { vocal(75, 55, 0.35, 'a', 0.32, d, { aspereza: 30 }); ruido(0.18, 600, 1, 0.2, 'bandpass', 0.05, d); },
    dolor: d => { vocal(95, 65, 0.35, 'a', 0.3, d, { aspereza: 22 }); },
    muerte: d => { vocal(70, 32, 1.7, 'u', 0.35, d, { aspereza: 20 }); tono(2400, 0.3, 0.05, 'sine', 0.8, 1700, d); ruido(0.2, 5000, 2, 0.05, 'bandpass', 0.85, d); },
    paso: d => { tono(58, 0.15, 0.12, 'sine', 0, 40, d); ruido(0.06, 2500, 1, 0.03, 'highpass', 0, d); },
  },
  pirata: {
    alerta: d => { vocal(165, 120, 0.45, 'a', 0.32, d, { aspereza: 15 }); vocal(130, 105, 0.3, 'o', 0.25, d, { retardo: 0.4, aspereza: 15 }); },
    // una risotada: ja, ja, ja
    voz: d => { for (let i = 0; i < 3; i++) vocal(175 - i * 10, 150 - i * 10, 0.09, 'a', 0.2, d, { retardo: i * 0.16, ataque: 0.01 }); },
    ataque: d => { ruido(0.16, 1200, 1.5, 0.25, 'bandpass', 0, d, 4500); metal([2400, 3550], 0.25, 0.06, d, 0.12); },
    dolor: d => { vocal(210, 150, 0.22, 'o', 0.28, d, { ataque: 0.01 }); },
    muerte: d => { vocal(180, 70, 0.9, 'a', 0.3, d); ruido(0.2, 300, 1, 0.25, 'lowpass', 0.7, d); },
    paso: d => { tono(115, 0.06, 0.06, 'triangle', 0, null, d); ruido(0.04, 700, 1, 0.04, 'lowpass', 0, d); },
  },
  jaguar: {
    alerta: d => { rugido(1.1, 330, 1.4, 0.5, 34, d); vocal(120, 75, 1.0, 'a', 0.25, d, { aspereza: 34, ataque: 0.1 }); },
    voz: d => { rugido(0.7, 260, 1.2, 0.3, 26, d); },
    ataque: d => { rugido(0.3, 900, 1.2, 0.45, 40, d); vocal(230, 140, 0.25, 'a', 0.25, d); },
    dolor: d => { vocal(320, 210, 0.3, 'a', 0.28, d, { aspereza: 30 }); },
    muerte: d => { vocal(190, 55, 1.1, 'o', 0.3, d, { aspereza: 30 }); rugido(0.9, 250, 1, 0.2, 20, d); },
    paso: null,
  },
  sectario: {
    // un grito a dos voces y un susurro que canta
    alerta: d => { vocal(130, 125, 0.65, 'a', 0.28, d, { ataque: 0.08 }); vocal(195, 188, 0.65, 'a', 0.16, d, { ataque: 0.08 }); silbido(0.5, 0.05, d, 0.05, 3000); },
    voz: d => { ruido(0.9, 900, 6, 0.1, 'bandpass', 0, d, 650); vocal(110, 108, 0.9, 'o', 0.12, d, { ataque: 0.2 }); },
    ataque: d => { vocal(185, 150, 0.3, 'a', 0.28, d, { ataque: 0.01 }); ruido(0.15, 800, 1, 0.2, 'bandpass', 0, d); },
    dolor: d => { vocal(230, 160, 0.25, 'e', 0.28, d, { ataque: 0.01 }); },
    muerte: d => { vocal(200, 70, 1.0, 'a', 0.3, d); },
    paso: d => { ruido(0.05, 800, 1, 0.04, 'bandpass', 0, d); },
  },
  caballero: {
    alerta: d => { metal([620, 935, 1480, 2210], 0.6, 0.2, d); vocal(100, 88, 0.8, 'u', 0.3, d, { retardo: 0.15, ataque: 0.1 }); },
    voz: d => { metal([680, 1020], 0.3, 0.08, d); vocal(92, 85, 0.6, 'u', 0.15, d, { retardo: 0.1, ataque: 0.15 }); },
    ataque: d => { ruido(0.25, 900, 1.2, 0.25, 'bandpass', 0, d, 3500); metal([1800, 2650, 3900], 0.5, 0.08, d, 0.2); },
    dolor: d => { metal([560, 840, 1330, 2010], 0.5, 0.25, d); vocal(130, 100, 0.3, 'u', 0.25, d, { retardo: 0.05 }); },
    muerte: d => { metal([500, 760, 1200, 1900], 0.9, 0.3, d); metal([430, 650, 1050], 0.8, 0.22, d, 0.25); tono(70, 0.5, 0.35, 'sine', 0.3, 40, d); vocal(110, 50, 1.0, 'u', 0.2, d); },
    paso: d => { tono(75, 0.12, 0.12, 'sine', 0, 50, d); metal([900, 1350], 0.15, 0.03, d); },
  },
  escorpion: {
    alerta: d => { clics(9, 0.03, 3200, 0.2, d); silbido(0.6, 0.12, d, 0.25, 4000); },
    voz: d => { clics(5, 0.05, 3000, 0.14, d); },
    ataque: d => { ruido(0.08, 2000, 1, 0.25, 'bandpass', 0, d, 5000); clics(1, 0, 2500, 0.3, d, 0.08); },
    dolor: d => { clics(4, 0.025, 3500, 0.22, d); },
    muerte: d => { ruido(0.15, 1500, 1, 0.3, 'bandpass', 0, d); clics(8, 0.05, 2500, 0.18, d, 0.1); },
    paso: d => { clics(3, 0.03, 3500, 0.05, d); },
  },
  arana: {
    alerta: d => { clics(16, 0.02, 4200, 0.14, d); silbido(0.7, 0.1, d, 0.2, 6000); },
    voz: d => { clics(10, 0.02, 4000, 0.1, d); },
    ataque: d => { silbido(0.25, 0.2, d, 0, 5000); clics(2, 0.04, 2600, 0.25, d, 0.12); },
    dolor: d => { tono(1800, 0.15, 0.08, 'sawtooth', 0, 1200, d); },
    muerte: d => { tono(2200, 0.5, 0.08, 'sawtooth', 0, 600, d); clics(10, 0.04, 3500, 0.12, d, 0.2); },
    paso: d => { clics(4, 0.015, 4500, 0.04, d); },
    // baja del techo por su hilo
    surgir: d => { ruido(0.7, 2500, 2, 0.1, 'bandpass', 0, d, 900); clics(12, 0.025, 4200, 0.12, d, 0.6); silbido(0.4, 0.12, d, 0.7, 6000); },
  },
  serpiente: {
    // siseo largo y el cascabel
    alerta: d => { silbido(1.2, 0.2, d, 0, 4200); clics(18, 0.022, 5000, 0.08, d, 0.15); },
    voz: d => { silbido(0.7, 0.12, d, 0, 4200); },
    ataque: d => { silbido(0.3, 0.3, d, 0, 3500); ruido(0.05, 1500, 1, 0.2, 'bandpass', 0.2, d); },
    dolor: d => { silbido(0.2, 0.18, d, 0, 3000); },
    muerte: d => { ruido(1.0, 4500, 0.7, 0.18, 'highpass', 0, d, 1500); },
    paso: null,
  },
  // el coloso de piedra: roca que se arrastra y un retumbar hondo
  coloso: {
    alerta: d => { ruido(1.4, 160, 0.8, 0.45, 'lowpass', 0, d, 90); tono(48, 1.3, 0.35, 'sawtooth', 0.1, 38, d); vocal(55, 45, 1.2, 'u', 0.2, d, { aspereza: 18, ataque: 0.3 }); },
    voz: d => { ruido(0.9, 140, 0.8, 0.3, 'lowpass', 0, d, 80); tono(45, 0.8, 0.2, 'sawtooth', 0, 38, d); },
    ataque: d => { ruido(0.3, 400, 1, 0.3, 'lowpass', 0, d, 150); tono(60, 0.35, 0.45, 'sine', 0.25, 30, d); ruido(0.25, 900, 1, 0.3, 'bandpass', 0.25, d); },
    dolor: d => { ruido(0.15, 1500, 1, 0.3, 'bandpass', 0, d); clics(6, 0.03, 1400, 0.2, d, 0.05); },
    muerte: d => { ruido(1.6, 250, 0.8, 0.5, 'lowpass', 0, d, 60); clics(25, 0.04, 1200, 0.2, d, 0.1); tono(50, 1.2, 0.4, 'sine', 0.6, 28, d); },
    paso: d => { tono(52, 0.25, 0.3, 'sine', 0, 32, d); ruido(0.12, 200, 1, 0.15, 'lowpass', 0, d); },
    surgir: d => { ruido(1.0, 200, 0.8, 0.5, 'lowpass', 0, d, 90); clics(10, 0.05, 1200, 0.15, d, 0.1); tono(45, 0.9, 0.3, 'sawtooth', 0, 70, d); },
  },
  murcielago: {
    alerta: d => { for (let i = 0; i < 3; i++) tono(4200 + i * 300, 0.04, 0.06, 'sine', i * 0.08, 3000, d); },
    voz: d => { tono(4500, 0.04, 0.05, 'sine', 0, 3200, d); },
    paso: null,
  },
  rata: {
    alerta: d => { tono(2600, 0.08, 0.08, 'square', 0, 3200, d); tono(2900, 0.06, 0.06, 'square', 0.12, 2400, d); },
    voz: d => { tono(2700, 0.05, 0.05, 'square', 0, 3000, d); },
    paso: d => { clics(2, 0.03, 4000, 0.03, d); },
  },
};
VOCES['araña'] = VOCES.arana;
VOCES.cobra = VOCES.vibora = VOCES.serpiente;
VOCES['escorpión'] = VOCES.escorpion;
VOCES['murciélago'] = VOCES.murcielago;
// los guardianes hablan como el enemigo de su mazmorra
VOCES.arquero = VOCES.esqueleto;
Object.assign(VOCES, { faraon: VOCES.momia, anubis: VOCES.momia, jarl: VOCES.draugr, capitan: VOCES.pirata, rey_jaguar: VOCES.jaguar, gran_sectario: VOCES.sectario, gran_caballero: VOCES.caballero });

// Donde está la fuente: más lejos, más baja y más opaca; a un lado o al otro.
// lado: -1 izquierda … 1 derecha.
function enElEspacio(dist, lado) {
  const g = ctx.createGain(); g.gain.value = Math.min(1, 1.5 / (1 + dist * 0.3));
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 9000 / (1 + dist * 0.22);
  g.connect(f);
  if (ctx.createStereoPanner) {
    const p = ctx.createStereoPanner(); p.pan.value = Math.max(-0.85, Math.min(0.85, lado * 0.85));
    f.connect(p).connect(salida);
  } else f.connect(salida);
  return g;
}

export function sonarEnemigo(tipo, momento, dist = 0, lado = 0) {
  if (!ctx || silencio) return;
  const v = VOCES[tipo];
  const f = v && momento in v ? v[momento] : VOCES.generico[momento];
  if (!f) return;
  try { f(enElEspacio(dist, lado)); } catch (e) { /* audio no disponible */ }
}

// ---------- Ambiente ----------

// Cada mazmorra elige su ambiente: base de ruido continuo y sucesos al azar.
const AMBIENTES = {
  cripta:    { base: [260, 0.7, 0.05], eco: 0.4, sucesos: { gota: 0.35, piedra: 0.05 } },
  desierto:  { base: [700, 0.5, 0.035], viento: true, eco: 0.3, sucesos: { arena: 0.2, gota: 0.08 } },
  nieve:     { base: [900, 0.6, 0.06], viento: true, eco: 0.45, sucesos: { hielo: 0.18 } },
  mar:       { base: [400, 0.5, 0.07], olas: true, eco: 0.35, sucesos: { crujido: 0.22, gota: 0.25 } },
  selva:     { base: [5200, 3, 0.015], insectos: true, eco: 0.15, sucesos: { pajaro: 0.4, rama: 0.06 } },
  lava:      { base: [140, 0.8, 0.09], eco: 0.3, sucesos: { burbuja: 1.1 } },
  catacumba: { base: [220, 0.7, 0.05], eco: 0.5, sucesos: { gota: 0.3, piedra: 0.04 } },
};

let amb = null;

const SUCESOS = {
  gota(d) { const f = 900 + Math.random() * 900; tono(f, 0.09, 0.07, 'sine', 0, f * 0.45, d); tono(f * 1.5, 0.05, 0.03, 'sine', 0.02, f * 0.6, d); },
  piedra(d) { for (let i = 0; i < 4; i++) ruido(0.05, 500 + Math.random() * 500, 1.2, 0.05, 'bandpass', i * (0.08 + Math.random() * 0.1), d); },
  arena(d) { ruido(1.6, 3000, 0.5, 0.04, 'highpass', 0, d); },
  hielo(d) { tono(2400 + Math.random() * 1200, 0.25, 0.025, 'sine', 0, 1800, d); ruido(0.15, 5000, 2, 0.03, 'bandpass', 0.05, d); },
  crujido(d) { const f = 70 + Math.random() * 40; tono(f, 0.9, 0.05, 'sawtooth', 0, f * 1.35, d); },
  pajaro(d) {
    const f = 1800 + Math.random() * 1600, n = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) tono(f, 0.09, 0.035, 'sine', i * 0.14, f * (1.3 + Math.random() * 0.3), d);
  },
  rama(d) { ruido(0.12, 1200, 1, 0.08, 'bandpass', 0, d); },
  burbuja(d) { const f = 60 + Math.random() * 60; tono(f, 0.15, 0.09, 'sine', 0, f * 2.2, d); },
};

// Entra a una mazmorra: su ambiente y su música.
export function iniciarAmbiente(nombre) {
  detenerAmbiente();
  tocarMusica(nombre);
  if (!ctx) return;
  const a = AMBIENTES[nombre] || AMBIENTES.cripta;
  const t = ctx.currentTime;
  const s = ctx.createGain(); s.gain.value = 1; s.connect(maestro);
  const fuentes = [];
  // base continua: ruido filtrado (con viento, olas o insectos que lo modulan)
  const n = ctx.createBufferSource(); n.buffer = ruidoBuf; n.loop = true;
  const f = ctx.createBiquadFilter(); f.type = a.insectos ? 'bandpass' : 'lowpass'; f.frequency.value = a.base[0]; f.Q.value = a.base[1];
  const g = ctx.createGain(); g.gain.value = 0;
  g.gain.setTargetAtTime(a.base[2], t, 1.5);
  n.connect(f).connect(g).connect(s); n.start();
  fuentes.push(n);
  const lfo = (frec, destino, prof, forma = 'sine') => {
    const o = ctx.createOscillator(); o.type = forma; o.frequency.value = frec;
    const k = ctx.createGain(); k.gain.value = prof;
    o.connect(k).connect(destino); o.start(); fuentes.push(o);
  };
  if (a.viento) { lfo(0.07, f.frequency, a.base[0] * 0.6); lfo(0.13, g.gain, a.base[2] * 0.6); }
  if (a.olas) lfo(0.11, g.gain, a.base[2] * 0.9);
  if (a.insectos) lfo(23, g.gain, a.base[2] * 0.9, 'square');
  eco.envio.gain.setTargetAtTime(a.eco, t, 0.5);
  amb = { a, salida: s, fuentes, tension: 0 };
}

// Sale de la mazmorra: se apaga el ambiente (la música la decide quien llama, con tocarMusica).
export function detenerAmbiente() {
  if (!amb) return;
  const t = ctx.currentTime, a = amb;
  a.salida.gain.setTargetAtTime(0, t, 0.2);
  setTimeout(() => { for (const f of a.fuentes) { try { f.stop(); } catch (e) { /* ya parada */ } } a.salida.disconnect(); }, 800);
  amb = null;
}

// Pausa: el ambiente y la música bajan mientras se lee una tablilla o el menú de pausa.
export function atenuarAmbiente(si) {
  if (!ctx) return;
  amb?.salida.gain.setTargetAtTime(si ? 0.35 : 1, ctx.currentTime, 0.3);
  musica?.salida.gain.setTargetAtTime(si ? 0.45 : 1, ctx.currentTime, 0.3);
}

// Llamar cada cuadro. tension: 0..1 según los enemigos que te tienen a la vista.
export function actualizarAmbiente(dt, tension = 0) {
  if (!amb || !ctx || silencio) return;
  for (const [nombre, frec] of Object.entries(amb.a.sucesos)) if (Math.random() < frec * dt) SUCESOS[nombre](amb.salida);
  amb.tension += (tension - amb.tension) * Math.min(1, dt * (tension > amb.tension ? 2 : 0.6));
  musica?.ponerTension(amb.tension);
}
