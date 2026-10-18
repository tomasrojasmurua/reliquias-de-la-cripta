// Efectos de sonido sintetizados con Web Audio (sin archivos).

let ctx = null;
let ruidoBuf = null;
export let silencio = false;

export function activarAudio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    ruidoBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = ruidoBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') ctx.resume();
}

export function alternarSilencio() { silencio = !silencio; return silencio; }

function env(g, t, a, d, v) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(v, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
}

function ruido(dur, frec, q, vol, tipo = 'lowpass', retardo = 0) {
  const t = ctx.currentTime + retardo;
  const s = ctx.createBufferSource(); s.buffer = ruidoBuf;
  const f = ctx.createBiquadFilter(); f.type = tipo; f.frequency.value = frec; f.Q.value = q;
  const g = ctx.createGain(); env(g, t, 0.003, dur, vol);
  s.connect(f).connect(g).connect(ctx.destination);
  s.start(t); s.stop(t + dur + 0.05);
}

function tono(frec, dur, vol, forma = 'square', retardo = 0, frecFin = null) {
  const t = ctx.currentTime + retardo;
  const o = ctx.createOscillator(); o.type = forma; o.frequency.setValueAtTime(frec, t);
  if (frecFin) o.frequency.exponentialRampToValueAtTime(frecFin, t + dur);
  const g = ctx.createGain(); env(g, t, 0.005, dur, vol);
  o.connect(g).connect(ctx.destination);
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
};

export function sonar(nombre) {
  if (!ctx || silencio) return;
  try { SONIDOS[nombre]?.(); } catch (e) { /* audio no disponible */ }
}
