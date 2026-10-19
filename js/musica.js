// Música procedural: cada mazmorra tiene su tema, con escala, tempo, instrumentos y motivos propios.
// Todo se sintetiza con Web Audio; nada de archivos. El tema respira: empieza con un bordón y un
// colchón suave, suma un ostinato, después percusión y frases de melodía, y vuelve a calmarse.
// La tensión (enemigos que te persiguen) suma tambores y abre el filtro.

// ---------- Instrumentos ----------
// Cada uno: (c, t, frec, dur, vol, destino). c = { ctx, ruido }.

function osc(ctx, tipo, f, t) {
  const o = ctx.createOscillator(); o.type = tipo; o.frequency.setValueAtTime(f, t);
  return o;
}

// sube en `a`, se sostiene hasta `a + sost` y se apaga en `r`. Devuelve cuándo termina.
function envolvente(g, t, a, sost, r, v) {
  g.gain.value = 0.0001;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(v, t + a);
  if (sost > 0) g.gain.setValueAtTime(v, t + a + sost);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + sost + r);
  return t + a + sost + r;
}

function vibrato(ctx, o, t, frec, prof, retardo = 0.2) {
  const l = osc(ctx, 'sine', frec, t), k = ctx.createGain();
  k.gain.setValueAtTime(0, t);
  k.gain.linearRampToValueAtTime(prof, t + retardo + 0.3);
  l.connect(k).connect(o.frequency);
  return l;
}

function soplo(c, t, frec, q, dur, vol, destino, tipo = 'bandpass') {
  const s = c.ctx.createBufferSource(); s.buffer = c.ruido; s.loop = true;
  const f = c.ctx.createBiquadFilter(); f.type = tipo; f.frequency.value = frec; f.Q.value = q;
  const g = c.ctx.createGain();
  const fin = envolvente(g, t, Math.min(0.08, dur / 3), Math.max(0, dur - 0.1), 0.15, vol);
  s.connect(f).connect(g).connect(destino);
  s.start(t, Math.random() * 0.5); s.stop(fin + 0.05);
}

function arrancar(t, fin, ...nodos) { for (const n of nodos) { n.start(t); n.stop(fin + 0.05); } }

const VOCALES = { a: [[730, 1], [1090, 0.5], [2440, 0.25]], o: [[500, 1], [850, 0.45], [2600, 0.15]], u: [[350, 1], [700, 0.35], [2500, 0.1]] };

export const INSTRUMENTOS = {
  // cuerda pulsada (laúd, oud, pizzicato): brillo que se apaga rápido
  pluck(c, t, f, dur, v, d) {
    const { ctx } = c;
    const o = osc(ctx, 'sawtooth', f, t), o2 = osc(ctx, 'triangle', f * 2.003, t);
    const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.Q.value = 3;
    fl.frequency.setValueAtTime(Math.min(8000, f * 9), t);
    fl.frequency.exponentialRampToValueAtTime(Math.max(120, f * 1.2), t + 0.35);
    const k = ctx.createGain(); k.gain.value = 0.3;
    const g = ctx.createGain();
    const fin = envolvente(g, t, 0.004, 0, Math.min(1.4, 0.25 + dur), v);
    o.connect(fl); o2.connect(k).connect(fl); fl.connect(g).connect(d);
    arrancar(t, fin, o, o2);
  },
  // arpa o lira: más dulce que el laúd
  lira(c, t, f, dur, v, d) {
    const { ctx } = c;
    const o = osc(ctx, 'triangle', f, t), o2 = osc(ctx, 'sine', f * 2, t);
    const g = ctx.createGain(), g2 = ctx.createGain();
    const fin = envolvente(g, t, 0.006, 0, 1.6, v);
    envolvente(g2, t, 0.004, 0, 0.4, v * 0.4);
    o.connect(g).connect(d); o2.connect(g2).connect(d);
    arrancar(t, fin, o, o2);
  },
  // marimba de madera
  marimba(c, t, f, dur, v, d) {
    const { ctx } = c;
    const o = osc(ctx, 'sine', f, t), o2 = osc(ctx, 'sine', f * 3.93, t);
    const g = ctx.createGain(), g2 = ctx.createGain();
    const fin = envolvente(g, t, 0.003, 0, 0.55, v);
    envolvente(g2, t, 0.002, 0, 0.07, v * 0.5);
    o.connect(g).connect(d); o2.connect(g2).connect(d);
    arrancar(t, fin, o, o2);
  },
  // flauta de caña (ney, bansuri, ocarina): seno con aire y vibrato tardío
  flauta(c, t, f, dur, v, d) {
    const { ctx } = c;
    const o = osc(ctx, 'sine', f * 0.97, t);
    o.frequency.exponentialRampToValueAtTime(f, t + 0.07);
    const o2 = osc(ctx, 'triangle', f, t);
    const k = ctx.createGain(); k.gain.value = 0.25;
    const lfo = vibrato(ctx, o, t, 5, f * 0.008, Math.min(0.4, dur * 0.4));
    const g = ctx.createGain();
    const fin = envolvente(g, t, 0.09, Math.max(0, dur - 0.12), 0.3, v);
    o.connect(g); o2.connect(k).connect(g); g.connect(d);
    soplo(c, t, f * 2, 1.2, dur, v * 0.12, d);
    arrancar(t, fin, o, o2, lfo);
  },
  // cuerno o metal grave: diente de sierra que se abre
  cuerno(c, t, f, dur, v, d) {
    const { ctx } = c;
    const o = osc(ctx, 'sawtooth', f * 0.985, t), o2 = osc(ctx, 'sawtooth', f * 1.004, t);
    o.frequency.exponentialRampToValueAtTime(f, t + 0.08);
    const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.Q.value = 0.8;
    fl.frequency.setValueAtTime(f * 1.2, t);
    fl.frequency.linearRampToValueAtTime(Math.min(3500, f * 4.5), t + 0.18);
    fl.frequency.linearRampToValueAtTime(Math.min(2500, f * 3), t + Math.max(0.3, dur));
    const lfo = vibrato(ctx, o, t, 4.5, f * 0.004, 0.4);
    const g = ctx.createGain();
    const fin = envolvente(g, t, 0.12, Math.max(0, dur - 0.15), 0.45, v);
    o.connect(fl); o2.connect(fl); fl.connect(g).connect(d);
    arrancar(t, fin, o, o2, lfo);
  },
  // violín o rabel: dos sierras desafinadas con vibrato
  violin(c, t, f, dur, v, d) {
    const { ctx } = c;
    const o = osc(ctx, 'sawtooth', f, t), o2 = osc(ctx, 'sawtooth', f, t);
    o2.detune.value = 7;
    const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = Math.min(3800, f * 6); fl.Q.value = 1;
    const cu = ctx.createBiquadFilter(); cu.type = 'peaking'; cu.frequency.value = 900; cu.gain.value = 6; cu.Q.value = 1.5;
    const l1 = vibrato(ctx, o, t, 5.6, f * 0.007, 0.15), l2 = vibrato(ctx, o2, t, 5.6, f * 0.007, 0.15);
    const g = ctx.createGain();
    const fin = envolvente(g, t, 0.1, Math.max(0, dur - 0.12), 0.3, v);
    o.connect(fl); o2.connect(fl); fl.connect(cu).connect(g).connect(d);
    arrancar(t, fin, o, o2, l1, l2);
  },
  // coro de voces graves: sierras pasadas por los formantes de una vocal
  coro(c, t, f, dur, v, d, vocal = 'o') {
    const { ctx } = c;
    const voces = [-9, 0, 8].map(cents => { const o = osc(ctx, 'sawtooth', f, t); o.detune.value = cents; return o; });
    const mezcla = ctx.createGain(); mezcla.gain.value = 0.5;
    const g = ctx.createGain();
    for (const o of voces) o.connect(mezcla);
    for (const [ff, a] of VOCALES[vocal] || VOCALES.o) {
      const fl = ctx.createBiquadFilter(); fl.type = 'bandpass'; fl.frequency.value = ff; fl.Q.value = 6;
      const k = ctx.createGain(); k.gain.value = a * 2.2;
      mezcla.connect(fl).connect(k).connect(g);
    }
    const lfo = vibrato(ctx, voces[1], t, 4.2, f * 0.006, 0.5);
    const fin = envolvente(g, t, 0.45, Math.max(0, dur - 0.4), 0.9, v);
    g.connect(d);
    arrancar(t, fin, ...voces, lfo);
  },
  coroA(c, t, f, dur, v, d) { INSTRUMENTOS.coro(c, t, f, dur, v, d, 'a'); },
  // órgano de capilla
  organo(c, t, f, dur, v, d) {
    const { ctx } = c;
    const g = ctx.createGain();
    const fin = envolvente(g, t, 0.08, Math.max(0, dur - 0.1), 0.5, v);
    const os = [[1, 1], [2, 0.45], [3, 0.2], [4, 0.1]].map(([m, a]) => {
      const o = osc(ctx, 'sine', f * m, t), k = ctx.createGain(); k.gain.value = a;
      o.connect(k).connect(g); return o;
    });
    g.connect(d);
    arrancar(t, fin, ...os);
  },
  // campana: parciales inarmónicos que se apagan a distinto ritmo
  campana(c, t, f, dur, v, d) {
    const { ctx } = c;
    let fin = t;
    for (const [m, a, r] of [[0.5, 0.6, 4], [1, 1, 3.2], [1.19, 0.45, 2.2], [1.5, 0.35, 1.8], [2.0, 0.3, 1.5], [2.74, 0.2, 1]]) {
      const o = osc(ctx, 'sine', f * m, t), g = ctx.createGain();
      fin = Math.max(fin, envolvente(g, t, 0.003, 0, r, v * a));
      o.connect(g).connect(d); o.start(t); o.stop(t + r + 0.1);
    }
  },
  // colchón de cuerdas lejanas
  cuerdas(c, t, f, dur, v, d) {
    const { ctx } = c;
    const o = osc(ctx, 'sawtooth', f, t), o2 = osc(ctx, 'sawtooth', f, t);
    o.detune.value = -8; o2.detune.value = 8;
    const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 650; fl.Q.value = 0.5;
    const g = ctx.createGain();
    const fin = envolvente(g, t, Math.min(1.2, dur * 0.4), Math.max(0, dur * 0.6 - 0.2), 1.4, v);
    o.connect(fl); o2.connect(fl); fl.connect(g).connect(d);
    arrancar(t, fin, o, o2);
  },
};

// ---------- Percusión ----------

function golpeTono(c, t, f0, f1, caida, v, d, tipo = 'sine') {
  const o = osc(c.ctx, tipo, f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + caida * 0.6);
  const g = c.ctx.createGain();
  const fin = envolvente(g, t, 0.003, 0, caida, v);
  o.connect(g).connect(d); arrancar(t, fin, o);
}
function golpeRuido(c, t, frec, q, caida, v, d, tipo = 'bandpass') {
  const s = c.ctx.createBufferSource(); s.buffer = c.ruido;
  const f = c.ctx.createBiquadFilter(); f.type = tipo; f.frequency.value = frec; f.Q.value = q;
  const g = c.ctx.createGain();
  const fin = envolvente(g, t, 0.002, 0, caida, v);
  s.connect(f).connect(g).connect(d);
  s.start(t, Math.random() * 0.5); s.stop(fin + 0.05);
}

export const PERCUSION = {
  bombo(c, t, v, d) { golpeTono(c, t, 85, 36, 0.7, v, d); golpeRuido(c, t, 180, 1, 0.08, v * 0.5, d, 'lowpass'); },
  tambor(c, t, v, d) { golpeTono(c, t, 125, 78, 0.3, v * 0.8, d); golpeRuido(c, t, 220, 1.2, 0.09, v * 0.4, d); },
  tek(c, t, v, d) { golpeRuido(c, t, 3200, 1.5, 0.05, v * 0.5, d); },
  sonaja(c, t, v, d) { golpeRuido(c, t, 7000, 0.8, 0.07, v * 0.35, d, 'highpass'); },
  palo(c, t, v, d) { golpeTono(c, t, 1600, 1500, 0.04, v * 0.3, d); golpeRuido(c, t, 2500, 4, 0.03, v * 0.3, d); },
  tom(c, t, v, d) { golpeTono(c, t, 190, 115, 0.35, v * 0.7, d); golpeRuido(c, t, 400, 1, 0.06, v * 0.3, d); },
  timbal(c, t, v, d) { golpeTono(c, t, 72, 66, 1.3, v * 0.8, d); golpeTono(c, t, 108, 100, 0.8, v * 0.3, d); golpeRuido(c, t, 140, 1, 0.12, v * 0.3, d, 'lowpass'); },
  tablaGe(c, t, v, d) { golpeTono(c, t, 80, 125, 0.45, v * 0.8, d); },
  tablaNa(c, t, v, d) { golpeTono(c, t, 560, 545, 0.18, v * 0.3, d); golpeTono(c, t, 1120, 1100, 0.08, v * 0.15, d); },
};

// ---------- Temas ----------
// grados: índices de la escala (0 = tónica, 7 = una octava arriba en escalas de 7 notas).
// motivos: [grado, pasos] (null = silencio). acordes: grado de cada compás.
// perc: un carácter por paso. X fuerte, x medio, . suave (solo con tensión), - nada.

const ESC = {
  menor: [0, 2, 3, 5, 7, 8, 10],
  dorica: [0, 2, 3, 5, 7, 9, 10],
  hijaz: [0, 1, 4, 5, 7, 8, 10],
  dobleArm: [0, 1, 4, 5, 7, 8, 11],
  penta: [0, 3, 5, 7, 10],
};

export const TEMAS = {
  // menú: el tema de la aventura, en re menor, con cuernos y timbales
  portada: {
    tempo: 76, compas: 4, sub: 2, raiz: 73.42, escala: ESC.menor,
    acordes: [0, 5, 3, 4, 0, 5, 6, 4],
    dron: { forma: 'sawtooth', filtro: 260, vol: 0.05 },
    colchon: { inst: 'cuerdas', vol: 0.05, oct: 1 },
    ostinato: { inst: 'pluck', oct: 1, vol: 0.07, patron: [0, null, 4, 0, 7, null, 4, 2] },
    melodia: {
      inst: 'cuerno', oct: 2, vol: 0.075,
      motivos: [
        [[4, 1.5], [5, 0.5], [7, 4], [null, 2], [3, 1.5], [4, 0.5], [5, 6]],
        [[4, 1.5], [5, 0.5], [7, 2], [8, 2], [9, 3], [8, 1], [7, 2], [6, 2], [4, 6]],
        [[7, 2], [6, 1], [5, 1], [4, 2], [2, 2], [3, 2], [1, 2], [0, 4]],
      ],
    },
    perc: { timbal: 'X-------', tom: '------x-' },
    tension: { tom: 'x-x-x-xx', timbal: 'x---x---' },
  },
  // la cripta del escarabajo: ney sobre un laúd, escala hijaz, tambor de marco
  cripta: {
    tempo: 66, compas: 4, sub: 2, raiz: 73.42, escala: ESC.hijaz,
    acordes: [0, 0, 1, 1, 0, 0, 6, 0],
    dron: { forma: 'sawtooth', filtro: 300, vol: 0.06, quinta: true },
    colchon: { inst: 'coro', vol: 0.035, oct: 1 },
    ostinato: { inst: 'pluck', oct: 1, vol: 0.075, patron: [0, null, 0, 1, 0, null, 2, 1] },
    melodia: {
      inst: 'flauta', oct: 2, vol: 0.07,
      motivos: [
        [[4, 2], [3, 1], [2, 1], [1, 2], [2, 2], [1, 1], [0, 7]],
        [[0, 1], [1, 1], [2, 2], [3, 1], [4, 3], [5, 1], [4, 1], [3, 2], [2, 4]],
        [[7, 3], [6, 1], [5, 2], [4, 2], [3, 1], [2, 1], [1, 2], [0, 4]],
      ],
    },
    perc: { tambor: 'X--x-x--', tek: '--x---x.' },
    tension: { tambor: 'X-xX-xX-', tek: '.x.x.x.x', bombo: 'X---X---' },
  },
  // el templo de las arenas: un rabel que canta sobre arena y sonajas
  desierto: {
    tempo: 80, compas: 4, sub: 2, raiz: 82.41, escala: ESC.dobleArm,
    acordes: [0, 0, 1, 0, 3, 3, 1, 0],
    dron: { forma: 'sawtooth', filtro: 380, vol: 0.05, quinta: true },
    colchon: { inst: 'cuerdas', vol: 0.04, oct: 1 },
    ostinato: { inst: 'pluck', oct: 1, vol: 0.065, patron: [0, 0, 1, 0, 4, 3, 1, 0] },
    melodia: {
      inst: 'violin', oct: 2, vol: 0.05,
      motivos: [
        [[0, 2], [1, 1], [2, 1], [3, 4], [2, 1], [1, 1], [2, 2], [0, 4]],
        [[4, 3], [5, 1], [4, 1], [3, 1], [2, 1], [1, 1], [2, 4], [null, 4]],
        [[7, 4], [6, 2], [5, 1], [4, 1], [5, 2], [4, 2], [1, 4]],
      ],
    },
    perc: { tambor: 'X-.x-x.-', sonaja: 'x.x.x.x.' },
    tension: { tambor: 'X-xX-xXx', bombo: 'X---X-X-' },
  },
  // el glaciar del jarl: cuernos lentos, coro de hombres, lira y tambor de guerra
  nieve: {
    tempo: 56, compas: 4, sub: 2, raiz: 55, escala: ESC.dorica,
    acordes: [0, 0, 6, 6, 3, 3, 4, 4],
    dron: { forma: 'sawtooth', filtro: 220, vol: 0.07, quinta: true },
    colchon: { inst: 'coroA', vol: 0.04, oct: 2 },
    ostinato: { inst: 'lira', oct: 2, vol: 0.06, patron: [0, null, 2, null, 4, null, 7, null] },
    melodia: {
      inst: 'cuerno', oct: 2, vol: 0.07,
      motivos: [
        [[0, 4], [2, 2], [4, 2], [3, 6], [2, 2]],
        [[4, 4], [5, 2], [4, 2], [2, 4], [0, 4]],
        [[7, 3], [6, 1], [4, 4], [3, 2], [2, 2], [0, 4]],
      ],
    },
    perc: { bombo: 'X-------' },
    tension: { bombo: 'X---X---', tom: '--x---x-' },
  },
  // la cueva de Drake: violín marinero en 6/8 sobre pizzicato
  mar: {
    tempo: 58, compas: 2, sub: 3, raiz: 73.42, escala: ESC.dorica,
    acordes: [0, 0, 6, 6, 3, 3, 4, 4],
    dron: { forma: 'sawtooth', filtro: 240, vol: 0.05 },
    colchon: { inst: 'cuerdas', vol: 0.045, oct: 1 },
    ostinato: { inst: 'pluck', oct: 0, vol: 0.09, patron: [0, null, 4, 7, null, 4] },
    melodia: {
      inst: 'violin', oct: 2, vol: 0.05,
      motivos: [
        [[0, 2], [1, 1], [2, 2], [4, 1], [3, 3], [2, 3]],
        [[4, 2], [5, 1], [4, 2], [2, 1], [3, 2], [1, 1], [0, 3]],
        [[7, 3], [6, 2], [5, 1], [4, 3], [null, 3]],
      ],
    },
    perc: { tambor: 'X--x--', palo: '---x-.' },
    tension: { tambor: 'X-xX-x', tom: '--x--x' },
  },
  // el templo del jaguar: marimba, ocarina y tambores de la selva
  selva: {
    tempo: 92, compas: 4, sub: 2, raiz: 98, escala: ESC.penta,
    acordes: [0, 0, 3, 3, 2, 2, 4, 4],
    dron: { forma: 'triangle', filtro: 300, vol: 0.06 },
    colchon: null,
    ostinato: { inst: 'marimba', oct: 1, vol: 0.09, patron: [0, 2, 1, 2, 0, 3, 2, 1] },
    melodia: {
      inst: 'flauta', oct: 3, vol: 0.05,
      motivos: [
        [[4, 2], [3, 1], [2, 1], [3, 2], [1, 2], [0, 4], [null, 4]],
        [[0, 1], [1, 1], [2, 2], [4, 2], [5, 4], [4, 2], [2, 4]],
        [[5, 3], [4, 1], [2, 2], [3, 2], [1, 4], [0, 4]],
      ],
    },
    perc: { tom: 'X-x-.xx-', sonaja: 'x.x.x.x.', palo: '--x--x-x' },
    tension: { bombo: 'X--X--X-', tom: 'xxx.xx.x' },
  },
  // el templo maldito: tanpura, bansuri, cánticos y tabla
  lava: {
    tempo: 70, compas: 4, sub: 2, raiz: 69.3, escala: ESC.dobleArm,
    acordes: [0, 0, 1, 1, 0, 0, 3, 0],
    dron: { forma: 'sawtooth', filtro: 500, vol: 0.09, quinta: true, barrido: true },
    colchon: { inst: 'coroA', vol: 0.045, oct: 1 },
    ostinato: null,
    melodia: {
      inst: 'flauta', oct: 2, vol: 0.065,
      motivos: [
        [[0, 2], [1, 2], [2, 3], [1, 1], [0, 8]],
        [[4, 2], [5, 1], [4, 1], [2, 2], [1, 2], [2, 4], [null, 4]],
        [[7, 2], [5, 2], [4, 2], [3, 1], [2, 1], [1, 4], [0, 4]],
      ],
    },
    perc: { tablaGe: 'X--x-X--', tablaNa: '-x-x--xx' },
    tension: { bombo: 'X---X---', tablaNa: 'xxxx.xxx', tablaGe: 'X-xX-Xx-' },
  },
  // la tumba del cruzado: órgano, canto llano y una campana a lo lejos
  catacumba: {
    tempo: 50, compas: 4, sub: 2, raiz: 65.41, escala: ESC.menor,
    acordes: [0, 0, 5, 5, 3, 3, 4, 4],
    dron: { forma: 'sine', filtro: 400, vol: 0.06, quinta: true },
    colchon: { inst: 'organo', vol: 0.03, oct: 1 },
    ostinato: null,
    melodia: {
      inst: 'coro', oct: 2, vol: 0.06,
      motivos: [
        [[0, 2], [2, 2], [3, 2], [4, 4], [3, 2], [2, 4]],
        [[4, 2], [5, 2], [4, 2], [3, 2], [2, 2], [1, 2], [0, 4]],
        [[2, 2], [3, 2], [4, 2], [4, 2], [5, 2], [4, 2], [3, 4]],
      ],
    },
    campana: 4,
    perc: {},
    tension: { timbal: 'X---x---', bombo: '----X---' },
  },
};

// ---------- Eco de sala grande para la música ----------

export function crearReverb(ctx, seg = 3.2) {
  const n = Math.floor(ctx.sampleRate * seg);
  const ir = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let canal = 0; canal < 2; canal++) {
    const d = ir.getChannelData(canal);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n) ** 3;
  }
  const conv = ctx.createConvolver(); conv.buffer = ir;
  return conv;
}

// ---------- Secuenciador ----------

const azar = n => Math.floor(Math.random() * n);

export class Musica {
  // destino: dónde suena; eco: el envío a la reverb (opcional).
  constructor(c, nombre, destino, eco = null) {
    this.c = c;
    this.tema = TEMAS[nombre] || TEMAS.cripta;
    const ctx = c.ctx, T = this.tema, t = ctx.currentTime;
    this.salida = ctx.createGain(); this.salida.gain.value = 0;
    this.salida.gain.setTargetAtTime(1, t, 1.2);
    this.salida.connect(destino);
    // el filtro se abre con la tensión
    this.filtro = ctx.createBiquadFilter(); this.filtro.type = 'lowpass'; this.filtro.frequency.value = 2400;
    this.filtro.connect(this.salida);
    if (eco) { this.envio = ctx.createGain(); this.envio.gain.value = 0.55; this.filtro.connect(this.envio).connect(eco); }
    this.fuentes = [];
    this.dron(T.dron);
    this.dtPaso = 60 / T.tempo / T.sub;
    this.pasosCompas = T.compas * T.sub;
    this.siguiente = t + 0.1;
    this.paso = 0;
    this.compas = 0;
    this.tension = 0;
    this.ultimoMotivo = -1;
  }

  dron(D) {
    if (!D) return;
    const { ctx } = this.c, T = this.tema;
    const fl = ctx.createBiquadFilter(); fl.type = D.barrido ? 'bandpass' : 'lowpass'; fl.frequency.value = D.filtro; fl.Q.value = D.barrido ? 3 : 0.7;
    const g = ctx.createGain(); g.gain.value = 0;
    g.gain.setTargetAtTime(D.vol, ctx.currentTime, 2.5);
    fl.connect(g).connect(this.filtro);
    for (const [st, a, det] of [[0, 1, -4], [0, 0.7, 5], ...(D.quinta ? [[7, 0.55, 0]] : []), [12, 0.25, 2]]) {
      const o = ctx.createOscillator(); o.type = D.forma; o.frequency.value = T.raiz * 2 ** (st / 12); o.detune.value = det;
      const k = ctx.createGain(); k.gain.value = a;
      o.connect(k).connect(fl); o.start(); this.fuentes.push(o);
    }
    // respira despacio
    const lfo = ctx.createOscillator(); lfo.frequency.value = D.barrido ? 0.23 : 0.06;
    const prof = ctx.createGain(); prof.gain.value = D.filtro * (D.barrido ? 0.8 : 0.35);
    lfo.connect(prof).connect(fl.frequency); lfo.start(); this.fuentes.push(lfo);
  }

  frec(grado, oct = 0) {
    const e = this.tema.escala, n = e.length;
    const o = Math.floor(grado / n);
    return this.tema.raiz * 2 ** ((e[((grado % n) + n) % n] + 12 * (o + oct)) / 12);
  }

  // Agenda las notas hasta el instante `hasta`.
  programar(hasta) {
    // si la pestaña estuvo dormida, no recupera las notas perdidas de golpe
    if (this.siguiente < this.c.ctx.currentTime - 0.25) this.siguiente = this.c.ctx.currentTime + 0.05;
    while (this.siguiente < hasta) {
      this.tocarPaso(this.siguiente);
      this.siguiente += this.dtPaso;
      if (++this.paso === this.pasosCompas) { this.paso = 0; this.compas++; }
    }
  }

  tocarPaso(t) {
    const T = this.tema, c = this.c, d = this.filtro, s = this.paso, k = this.compas;
    const tension = this.tension;
    // forma de 16 compases: bordón y colchón → + ostinato → + percusión y melodía → respuesta
    const seccion = Math.floor((k % 16) / 4);
    const conOstinato = seccion >= 1 || tension > 0.3;
    const conPerc = seccion >= 2 || tension > 0.15;
    const acorde = T.acordes[k % T.acordes.length];
    if (s === 0) {
      // el colchón dura lo que dura el acorde (si se repite en el compás siguiente, sigue sonando)
      const anterior = T.acordes[(k - 1 + T.acordes.length) % T.acordes.length];
      if (T.colchon && (acorde !== anterior || k === 0)) {
        let n = 1;
        while (n < T.acordes.length && T.acordes[(k + n) % T.acordes.length] === acorde) n++;
        const dur = this.dtPaso * this.pasosCompas * n;
        for (const [i, g] of [0, 2, 4].entries()) {
          INSTRUMENTOS[T.colchon.inst](c, t, this.frec(acorde + g, T.colchon.oct), dur, T.colchon.vol * (i ? 0.7 : 1), d);
        }
      }
      if (T.campana && k % T.campana === 0) INSTRUMENTOS.campana(c, t, this.frec(0, 2), 3, 0.05, d);
      // una frase cada dos compases en las secciones con melodía, a veces se calla
      if (T.melodia && seccion >= 2 && k % 2 === 0 && Math.random() < 0.8) this.frase(t);
    }
    if (conOstinato && T.ostinato) {
      const g = T.ostinato.patron[s % T.ostinato.patron.length];
      if (g !== null && g !== undefined) {
        const acento = s === 0 ? 1 : 0.7 + Math.random() * 0.2;
        INSTRUMENTOS[T.ostinato.inst](c, t, this.frec(acorde + g, T.ostinato.oct), this.dtPaso, T.ostinato.vol * acento, d);
      }
    }
    const tocar = (patrones, vol) => {
      for (const [inst, p] of Object.entries(patrones || {})) {
        const ch = p[s % p.length];
        const v = ch === 'X' ? 1 : ch === 'x' ? 0.65 : ch === '.' && tension > 0.2 ? 0.35 : 0;
        if (v) PERCUSION[inst](c, t, v * vol, d);
      }
    };
    if (conPerc) tocar(T.perc, 0.22);
    if (tension > 0.05) tocar(T.tension, 0.28 * tension);
  }

  frase(t) {
    const M = this.tema.melodia;
    let i = azar(M.motivos.length);
    if (i === this.ultimoMotivo) i = (i + 1) % M.motivos.length;
    this.ultimoMotivo = i;
    let u = t;
    for (const [g0, pasos] of M.motivos[i]) {
      const dur = pasos * this.dtPaso;
      if (g0 !== null) {
        // pequeñas variaciones: a veces una nota vecina
        const g = Math.random() < 0.12 ? g0 + (Math.random() < 0.5 ? 1 : -1) : g0;
        INSTRUMENTOS[M.inst](this.c, u, this.frec(g, M.oct), dur * 0.95, M.vol, this.filtro);
      }
      u += dur;
    }
  }

  ponerTension(v) {
    this.tension = v;
    const ctx = this.c.ctx;
    this.filtro.frequency.setTargetAtTime(2400 + v * 3000, ctx.currentTime, 0.6);
  }

  detener(caida = 1.2) {
    const ctx = this.c.ctx, t = ctx.currentTime;
    this.salida.gain.cancelScheduledValues(t);
    this.salida.gain.setTargetAtTime(0, t, caida / 3);
    this.siguiente = Infinity;
    const fuentes = this.fuentes, salida = this.salida;
    setTimeout(() => {
      for (const f of fuentes) { try { f.stop(); } catch (e) { /* ya parada */ } }
      salida.disconnect();
    }, caida * 1000 + 2500);
  }
}
