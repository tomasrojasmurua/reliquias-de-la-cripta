// Sonido sintetizado con Web Audio (sin archivos): efectos, ambiente de cada mazmorra,
// música de fondo procedural y eco de la sala.

let ctx = null;
let ruidoBuf = null;
let salida = null;   // efectos → eco y altavoz
let eco = null;      // {entrada, realim}: retardo con realimentación
export let silencio = false;
export let sinMusica = false;

export function activarAudio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    ruidoBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = ruidoBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    // efectos: seco + eco filtrado (como una sala de piedra)
    salida = ctx.createGain();
    salida.connect(ctx.destination);
    const ret = ctx.createDelay(1); ret.delayTime.value = 0.19;
    const realim = ctx.createGain(); realim.gain.value = 0.32;
    const filtro = ctx.createBiquadFilter(); filtro.type = 'lowpass'; filtro.frequency.value = 1800;
    const envio = ctx.createGain(); envio.gain.value = 0.35;
    salida.connect(envio).connect(ret).connect(filtro).connect(realim).connect(ret);
    filtro.connect(ctx.destination);
    eco = { envio, realim, ret };
  }
  if (ctx.state === 'suspended') ctx.resume();
}

export function alternarSilencio() {
  silencio = !silencio;
  if (ctx) for (const g of [salida, amb?.salida]) g?.gain.setTargetAtTime(silencio ? 0 : 1, ctx.currentTime, 0.05);
  return silencio;
}
export function ponerSilencio(v) { if (v !== silencio) alternarSilencio(); }
export function alternarMusica() {
  sinMusica = !sinMusica;
  if (ctx && amb) amb.musica.gain.setTargetAtTime(sinMusica ? 0 : MUSICA_VOL, ctx.currentTime, 0.3);
  return sinMusica;
}
export function ponerMusica(v) { if (v === sinMusica) alternarMusica(); }

function env(g, t, a, d, v) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(v, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
}

function ruido(dur, frec, q, vol, tipo = 'lowpass', retardo = 0, destino = salida) {
  const t = ctx.currentTime + retardo;
  const s = ctx.createBufferSource(); s.buffer = ruidoBuf;
  const f = ctx.createBiquadFilter(); f.type = tipo; f.frequency.value = frec; f.Q.value = q;
  const g = ctx.createGain(); env(g, t, 0.003, dur, vol);
  s.connect(f).connect(g).connect(destino);
  s.start(t); s.stop(t + dur + 0.05);
}

function tono(frec, dur, vol, forma = 'square', retardo = 0, frecFin = null, destino = salida) {
  const t = ctx.currentTime + retardo;
  const o = ctx.createOscillator(); o.type = forma; o.frequency.setValueAtTime(frec, t);
  if (frecFin) o.frequency.exponentialRampToValueAtTime(frecFin, t + dur);
  const g = ctx.createGain(); env(g, t, 0.005, dur, vol);
  o.connect(g).connect(destino);
  o.start(t); o.stop(t + dur + 0.05);
}

const SONIDOS = {
  disparo() { ruido(0.35, 1800, 0.7, 0.6); tono(140, 0.18, 0.5, 'sine', 0, 40); },
  vacio() { tono(1800, 0.03, 0.15, 'square'); },
  recarga() { for (let i = 0; i < 3; i++) tono(900 + i * 80, 0.03, 0.12, 'square', i * 0.12); },
  latigo() { ruido(0.12, 3500, 2, 0.4, 'bandpass', 0.08); tono(600, 0.1, 0.05, 'sawtooth', 0, 2400); },
  golpe() { ruido(0.1, 500, 1, 0.5); },
  recoger() { tono(660, 0.08, 0.2, 'square'); tono(990, 0.12, 0.2, 'square', 0.07); },
  tesoro() { [523, 659, 784, 1047, 1319].forEach((f, i) => tono(f, 0.22, 0.18, 'triangle', i * 0.08)); },
  puerta() { ruido(0.9, 220, 1, 0.4); tono(60, 0.8, 0.2, 'sawtooth', 0, 45); },
  secreto() { ruido(1.4, 150, 1, 0.5); [392, 494, 587, 784].forEach((f, i) => tono(f, 0.3, 0.12, 'triangle', 0.4 + i * 0.12)); },
  sellado() { tono(110, 0.25, 0.25, 'square'); tono(98, 0.3, 0.25, 'square', 0.15); },
  gruñido() { tono(90 + Math.random() * 40, 0.6, 0.25, 'sawtooth', 0, 60); },
  dolorEnemigo() { tono(220, 0.15, 0.2, 'sawtooth', 0, 120); },
  muerteEnemigo() { tono(180, 0.7, 0.25, 'sawtooth', 0, 40); ruido(0.5, 400, 1, 0.3); },
  dolor() { tono(300, 0.2, 0.3, 'sawtooth', 0, 150); },
  ataque() { ruido(0.15, 800, 1, 0.35); },
  error() { tono(160, 0.15, 0.2, 'square'); tono(120, 0.2, 0.2, 'square', 0.12); },
  acierto() { [523, 784, 1047].forEach((f, i) => tono(f, 0.3, 0.2, 'triangle', i * 0.1)); },
  fuego() { ruido(0.6, 700, 0.8, 0.35, 'bandpass'); tono(220, 0.4, 0.08, 'sawtooth', 0, 90); },
  caida() { ruido(0.25, 260, 1, 0.45); },
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

// ---------- Ambiente y música ----------

const MUSICA_VOL = 0.05;

// Cada mazmorra elige su ambiente: base de ruido continuo, sucesos al azar y escala de la música.
const AMBIENTES = {
  cripta:    { base: [260, 0.7, 0.05], eco: 0.4, sucesos: { gota: 0.35, piedra: 0.05 }, raiz: 110, escala: [0, 3, 7, 10] },
  desierto:  { base: [700, 0.5, 0.035], viento: true, eco: 0.3, sucesos: { arena: 0.2, gota: 0.08 }, raiz: 98, escala: [0, 1, 5, 7, 8] },
  nieve:     { base: [900, 0.6, 0.06], viento: true, eco: 0.45, sucesos: { hielo: 0.18 }, raiz: 123, escala: [0, 2, 3, 7, 10] },
  mar:       { base: [400, 0.5, 0.07], olas: true, eco: 0.35, sucesos: { crujido: 0.22, gota: 0.25 }, raiz: 87, escala: [0, 3, 5, 7, 10] },
  selva:     { base: [5200, 3, 0.015], insectos: true, eco: 0.15, sucesos: { pajaro: 0.4, rama: 0.06 }, raiz: 131, escala: [0, 2, 4, 7, 9] },
  lava:      { base: [140, 0.8, 0.09], eco: 0.3, sucesos: { burbuja: 1.1 }, raiz: 82, escala: [0, 1, 5, 6, 10] },
  catacumba: { base: [220, 0.7, 0.05], eco: 0.5, sucesos: { gota: 0.3, susurro: 0.05 }, raiz: 104, escala: [0, 3, 7, 8] },
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
  susurro(d) { ruido(1.2, 1100 + Math.random() * 600, 6, 0.05, 'bandpass', 0, d); },
};

export function iniciarAmbiente(nombre) {
  detenerAmbiente();
  if (!ctx) return;
  const a = AMBIENTES[nombre] || AMBIENTES.cripta;
  const t = ctx.currentTime;
  const s = ctx.createGain(); s.gain.value = silencio ? 0 : 1; s.connect(ctx.destination);
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
  // música: acorde suave que cambia despacio
  const musica = ctx.createGain(); musica.gain.value = 0; musica.connect(s);
  musica.gain.setTargetAtTime(sinMusica ? 0 : MUSICA_VOL, t, 2);
  const filtroM = ctx.createBiquadFilter(); filtroM.type = 'lowpass'; filtroM.frequency.value = 900; filtroM.connect(musica);
  const voces = [0, 1, 2].map(i => {
    const o = ctx.createOscillator(); o.type = i === 0 ? 'triangle' : 'sine';
    o.frequency.value = a.raiz; o.detune.value = (i - 1) * 6;
    const v = ctx.createGain(); v.gain.value = i === 0 ? 0.9 : 0.5;
    o.connect(v).connect(filtroM); o.start(); fuentes.push(o);
    return o;
  });
  eco.envio.gain.setTargetAtTime(a.eco, t, 0.5);
  amb = { a, salida: s, musica, filtroM, voces, fuentes, reloj: 0, acorde: 0, nota: 3, tension: 0, latido: 0 };
}

export function detenerAmbiente() {
  if (!amb) return;
  const t = ctx.currentTime, a = amb;
  a.salida.gain.setTargetAtTime(0, t, 0.2);
  setTimeout(() => { for (const f of a.fuentes) { try { f.stop(); } catch (e) { /* ya parada */ } } a.salida.disconnect(); }, 800);
  amb = null;
}

// Pausa: el ambiente baja mientras se lee una tablilla o el menú de pausa.
export function atenuarAmbiente(si) {
  if (amb) amb.salida.gain.setTargetAtTime(silencio ? 0 : si ? 0.35 : 1, ctx.currentTime, 0.3);
}

// Llamar cada cuadro. tension: 0..1 según los enemigos que te persiguen.
export function actualizarAmbiente(dt, tension = 0) {
  if (!amb || !ctx || silencio) return;
  const a = amb.a, t = ctx.currentTime;
  for (const [nombre, frec] of Object.entries(a.sucesos)) if (Math.random() < frec * dt) SUCESOS[nombre](amb.salida);
  // acordes: raíz, tercera y quinta de la escala del lugar, cada ~7 segundos
  amb.reloj -= dt;
  if (amb.reloj <= 0) {
    amb.reloj = 6 + Math.random() * 3;
    const grados = [0, 3, 4, 0, 5, 3];
    const g = grados[amb.acorde++ % grados.length] % a.escala.length;
    const st = i => a.escala[(g + i * 2) % a.escala.length] + 12 * Math.floor((g + i * 2) / a.escala.length);
    amb.voces.forEach((o, i) => o.frequency.setTargetAtTime(a.raiz * 2 ** (st(i) / 12), t, 1.2));
  }
  // una nota suelta de vez en cuando
  if (!sinMusica && Math.random() < dt * 0.12) {
    amb.nota = Math.max(0, Math.min(a.escala.length * 2 - 1, amb.nota + Math.floor(Math.random() * 5) - 2));
    const st = a.escala[amb.nota % a.escala.length] + 12 * (1 + Math.floor(amb.nota / a.escala.length));
    tono(a.raiz * 2 ** (st / 12), 1.4, 0.05, 'triangle', 0, null, amb.filtroM);
  }
  // tambor de tensión cuando algo te persigue
  amb.tension += (tension - amb.tension) * Math.min(1, dt * 1.5);
  amb.filtroM.frequency.setTargetAtTime(900 + amb.tension * 1400, t, 0.5);
  if (!sinMusica && amb.tension > 0.15) {
    amb.latido -= dt;
    if (amb.latido <= 0) {
      amb.latido = 0.62 - amb.tension * 0.2;
      tono(62, 0.25, 0.22 * amb.tension, 'sine', 0, 38, amb.salida);
      ruido(0.06, 300, 1, 0.05 * amb.tension, 'lowpass', 0, amb.salida);
    }
  }
}
