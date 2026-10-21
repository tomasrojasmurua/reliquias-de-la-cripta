// Estado y reglas de una partida dentro de una mazmorra.

import { cargarMazmorra } from './mapa.js';
import { ALTO_MURO } from './render.js';
import { sonar, sonarEnemigo } from './audio.js';
import { explorar } from './automapa.js';
import { TESORO, RAREZAS } from '../datos/tesoros.js';

const RADIO_JUGADOR = 0.24;
const OJO = 0.64;
const VEL = 3.0, GIRO_TECLAS = 2.4;
const MAX_CABECEO = 0.45;
const PASO = 0.45;            // el escalón más alto que se sube caminando
const CAIDA_ENEMIGO = 0.5;    // los enemigos tampoco bajan desniveles mayores

// cómo se nombran los estados de un enemigo al mandarlos por la red
const ESTADOS_RED = ['dormido', 'oculto', 'surge', 'caza', 'dolor', 'embiste', 'lanza', 'ataca', 'muerto'];

const ENEMIGOS = {
  momia: { vida: 60, vel: 1.05, daño: [8, 14], alcance: 0.95, espera: 1.2, vista: 11 },
  esqueleto: { vida: 35, vel: 1.8, daño: [5, 9], alcance: 0.9, espera: 0.8, vista: 13 },
  // el arquero dispara flechas desde lejos y retrocede si te le acercas (hay que cubrirse o acorralarlo)
  arquero: { vida: 32, vel: 1.5, daño: [4, 7], alcance: 0.9, espera: 0.9, vista: 15, flechas: [9, 14] },
  draugr: { vida: 75, vel: 1.25, daño: [9, 15], alcance: 1.0, espera: 1.3, vista: 11 },
  pirata: { vida: 45, vel: 1.7, daño: [7, 12], alcance: 1.05, espera: 0.9, vista: 13 },
  jaguar: { vida: 50, vel: 2.3, daño: [8, 13], alcance: 0.95, espera: 0.9, vista: 14 },
  // los sectarios además lanzan bolas de fuego desde lejos (se pueden esquivar)
  sectario: { vida: 40, vel: 1.9, daño: [8, 13], alcance: 0.95, espera: 0.9, vista: 13, fuego: [9, 14] },
  // el brujo lanza fuego como el sectario y, si te le acercas o lo hieren, se desvanece y reaparece a distancia
  brujo: { vida: 38, vel: 1.5, daño: [7, 11], alcance: 0.95, espera: 1.0, vista: 13, fuego: [10, 15], teletransporta: true },
  caballero: { vida: 95, vel: 1.1, daño: [12, 18], alcance: 1.1, espera: 1.3, vista: 12 },
  // bestias que se sueltan al azar en cada partida (ver js/fauna.js); `tam`: tamaño del sprite
  escorpion: { vida: 70, vel: 1.5, daño: [10, 16], alcance: 1.15, espera: 1.1, vista: 12, tam: 1.2 },
  arana: { vida: 42, vel: 2.6, daño: [6, 11], alcance: 1.0, espera: 0.7, vista: 14, tam: 1.25 },
  serpiente: { vida: 45, vel: 1.4, daño: [9, 15], alcance: 1.6, espera: 1.0, vista: 12, tam: 1.1 },
  // la sorpresa dura: lento, pero aguanta mucho y pega fuerte
  coloso: { vida: 190, vel: 0.85, daño: [16, 25], alcance: 1.25, espera: 1.6, vista: 11, tam: 1.3 },
};
// Monstruos con algo menos de vida (el daño y el ritmo de golpes no cambian). Los guardianes se definen después y no cambian.
const ESCALA_VIDA = 1.15, ESCALA_DAÑO = 1.05, ESCALA_ESPERA = 0.96;
for (const e of Object.values(ENEMIGOS)) {
  e.vida = Math.round(e.vida * ESCALA_VIDA);
  e.daño = e.daño.map(n => Math.round(n * ESCALA_DAÑO));
  if (e.fuego) e.fuego = e.fuego.map(n => Math.round(n * ESCALA_DAÑO));
  if (e.flechas) e.flechas = e.flechas.map(n => Math.round(n * ESCALA_DAÑO));
  e.espera = +(e.espera * ESCALA_ESPERA).toFixed(2);
}
// Los escondidos salen cuando te acercas a esta distancia; tardan SURGE segundos en salir.
const ACECHO = 3.6, SURGE = 0.8;

// Guardianes: uno por mazmorra (`guardian` en datos/mazmorras.js), junto a su reliquia más valiosa.
// Son más grandes (lo que deja el techo), aguantan mucho, embisten desde lejos y al perder un tercio de vida llaman a sus siervos.
const GUARDIAN = { vida: 380, vel: 1.15, daño: [14, 22], alcance: 1.35, espera: 1.1, vista: 8, jefe: true, tam: 1.2, radio: 0.4 };
const GUARDIANES = {
  faraon: { invoca: 'momia' }, anubis: { invoca: 'momia' }, jarl: { invoca: 'draugr' }, capitan: { invoca: 'pirata' },
  rey_jaguar: { invoca: 'jaguar', vel: 1.5 }, gran_sectario: { invoca: 'sectario', fuego: [12, 18] }, gran_caballero: { invoca: 'caballero', vida: 460 },
};
for (const [tipo, g] of Object.entries(GUARDIANES)) ENEMIGOS[tipo] = { ...GUARDIAN, ...g };
const EMBESTIDA = { vel: 4.6, duracion: 0.9, daño: [18, 26] };

// Pinchos: suben durante ARRIBA segundos de cada CICLO, desfasados por columna.
const PINCHOS = { ciclo: 2.4, arriba: 0.9, daño: 15 };
export function pinchosArriba(x, t) {
  return ((t + x * 0.55) % PINCHOS.ciclo) < PINCHOS.arriba;
}

const ARMAS = {
  latigo: { nombre: 'Látigo', espera: 0.55, alcance: 1.9, daño: [14, 22] },
  revolver: { nombre: 'Revólver', espera: 0.45, alcance: 40, daño: [30, 48] },
  // la escopeta: siete perdigones que se abren con la distancia; de cerca es lo más fuerte que hay
  escopeta: { nombre: 'Escopeta', espera: 0.8, alcance: 16, daño: [9, 12], perdigones: 7 },
  // la Tommy gun: ráfaga mientras se mantiene el disparo; cada bala pega poco y se dispersa un poco
  tommy: { nombre: 'Tommy gun', espera: 0.08, alcance: 28, daño: [4, 7], dispersion: 0.045 },
};
const ORDEN_ARMAS = ['latigo', 'revolver', 'escopeta', 'tommy'];
const TUBO = 2, MAX_CARTUCHOS = 24;
const CARGADOR = 30, MAX_TAMBOR = 150;

// Rocas rodantes (ver `rocas` en js/mapa.js): ruedan de un extremo a otro de un pasillo largo sin parar. Salen solo del reloj.
const ROCAS = { vel: 3.4, daño: [24, 32], radio: 0.55, tam: 1.05 };

// Trampas de dardos (ver `dardos` en js/mapa.js): un muro al fondo de un pasillo recto que dispara a lo largo de él.
const DARDOS = { ciclo: 3.4, vel: 8, daño: [8, 12], radio: 0.32 };

const azar = ([a, b]) => a + Math.random() * (b - a);

// Qué salpica cada enemigo al recibir un golpe.
const SALPICA = {
  momia: 'polvo', esqueleto: 'hueso', draugr: 'polvo', pirata: 'hueso', jaguar: 'sangre', sectario: 'sangre', caballero: 'chispa',
  faraon: 'polvo', anubis: 'polvo', jarl: 'polvo', capitan: 'hueso', rey_jaguar: 'sangre', gran_sectario: 'sangre', gran_caballero: 'chispa',
  escorpion: 'icor', arana: 'icor', serpiente: 'sangre', coloso: 'polvo', arquero: 'hueso', brujo: 'sangre',
};
const PUNTOS_ESTRELLA = 2, PUNTOS_AYUDA = 2;   // por cada estrella de un acertijo descifrado / por cada ayuda pedida
const SALIDA_REVELADA = 0.7;   // fracción del tiempo tras la cual se marca la salida en el automapa (en solitario y en las salas)

// Combate entre cazadores: el daño de las armas contra otro cazador, y los segundos sin recibir golpes de ellos
// al empezar la partida y al reaparecer, para que nadie espere a otro en la entrada.
// (la Tommy gun, que dispara una ráfaga, pega menos aún para que una sola ráfaga no decida el duelo)
const DAÑO_CAZADOR = 0.6, DAÑO_CAZADOR_TOMMY = 0.45, TREGUA_INICIAL = 10, TREGUA_REAPARECER = 4;
const VEL_FUEGO = 5.5, VEL_FLECHA = 9;

export class Juego {
  // `opciones.limite`: segundos que dura la expedición (0 = sin reloj).
  // `opciones.real`: el reloj sigue la hora real, como en una sala, donde nadie puede detener el tiempo.
  constructor(def, eventos, semilla, opciones = {}) {
    this.def = def;
    this.limite = opciones.limite || 0;
    this.vidaInicial = 100;
    this.reloj = 0;
    this.real = !!opciones.real;
    this.rol = opciones.rol || null;   // en una sala: 'anfitrion' (simula a los enemigos) o 'invitado' (los copia del anfitrión)
    this.blancos = [];                 // el anfitrión: los otros cazadores, que los enemigos también persiguen
    this.soloRemotos = false;
    this.coop = !!opciones.coop;        // sala cooperativa: sin daño entre cazadores, y al caer te reaniman en vez de reaparecer
    this.companeros = [];               // los otros cazadores de la sala: { id, x, z, muerto }
    this.combate = !!opciones.combate;  // en una sala: los cazadores pueden herirse entre sí
    this.rivales = [];                  // los otros cazadores a tiro: { id, x, y, z, muerto }
    this.proteccion = this.combate ? TREGUA_INICIAL : 0;   // segundos sin recibir daño de otros cazadores
    this.inicioReal = Date.now();
    this.mapa = cargarMazmorra(def, semilla, opciones.jugadores || 1);
    this.ev = eventos; // {mensaje, tesoro, daño, abrirTablilla, salida, muerte, tiempoAgotado}
    const m = this.mapa;
    this.inicioJ = (opciones.jugadores > 1 && m.puestos?.[opciones.puesto || 0]) || (opciones.puesto > 0 && m.puestos?.[opciones.puesto]) || { x: m.inicio.x, z: m.inicio.z, yaw: def.angulo || 0 };   // en una sala cada cazador parte de un puesto distinto
    this.j = {
      x: this.inicioJ.x, z: this.inicioJ.z, y: m.piso(Math.floor(this.inicioJ.x), Math.floor(this.inicioJ.z)), yaw: this.inicioJ.yaw, cabeceo: 0,
      vida: this.vidaInicial, arma: 'latigo', tieneRevolver: false, tieneEscopeta: false, tieneTommy: false, vendas: 0, cargador: 0, reservaT: 0, barreta: 0, llaves: 0, tambor: 0, reserva: 0, tubo: 0, reservaE: 0, recargaArma: null,
      espera: 0, recargando: 0, ataque: 0, paso: 0, muerto: false,
    };
    this.enemigos = m.enemigos.map(e => ({ ...e, y: m.piso(Math.floor(e.x), Math.floor(e.z)), ...ENEMIGOS[e.tipo], vidaMax: ENEMIGOS[e.tipo].vida, estado: e.escondido ? 'oculto' : 'dormido', t: 0, espera: 0, anim: Math.random() * 2, sinVerte: Infinity, alerta: false, tVoz: 3 + Math.random() * 4 }));
    this.objetos = m.objetos.map((o, n) => ({ ...o, n, fase: Math.random() * 6 }));   // `n`: el puesto fijo del objeto, igual para todos en una sala
    this.guardian = this.colocarGuardian();
    this.enemigosIniciales = this.enemigos.length;   // los que se suman después (siervos del guardián) viajan con su tipo
    this.tesoros = [];
    this.secretos = 0;
    this.abatidos = 0;
    this.ayudas = 0;
    this.bonoAcertijos = 0;   // puntos por descifrar tablillas, menos lo que costaron las ayudas
    this.costoAyudas = 0;
    this.tiempo = 0;
    this.fogonazo = 0;
    this.particulas = [];
    this.proyectiles = [];
    this.dardos = (m.dardos || []).map(d => ({ ...d, prev: 0, golpe: -1 }));
    this.rocas = (m.rocas || []).map(r => ({ ...r, golpe: 0 }));
    this.terminado = false;
    this.totalTesoros = this.objetos.filter(o => o.tipo === 'tesoro').length;
    // zonas: cuántas reliquias tiene cada una (para el HUD y el automapa)
    this.zonas = (m.regiones || []).map((r, i) => ({ nombre: r.nombre, total: this.objetos.filter(o => o.tipo === 'tesoro' && o.zona === i).length, halladas: 0 }));
    this.derrumbe = m.def.derrumbe && !(opciones.jugadores > 1) ? 1.1 : 0;   // la entrada se viene abajo poco después de entrar
    this.temblor = 0;
    this.salidaVista = false;
    this.salidaRevelada = false;
    this.prepararAmbiente();
  }

  // El guardián espera a dos pasos de la reliquia más valiosa de la mazmorra (en la última zona, si empatan).
  // Si esa reliquia está en un nicho sin espacio (como la de tras el pasadizo secreto), cuida la siguiente.
  colocarGuardian() {
    const g = this.def.guardian, m = this.mapa;
    if (!g) return null;
    const valor = o => RAREZAS[TESORO[o.tesoro].rareza].valor * 100 + (o.zona || 0);
    const ocupada = new Set([...this.objetos, ...this.enemigos].map(o => Math.floor(o.x) + ',' + Math.floor(o.z)));
    const libre = (x, z) => {
      const c = m.celda(x, z);
      return c && c.tipo === 'suelo' && !c.peligro && !c.trampa && !c.estatua && !ocupada.has(x + ',' + z);
    };
    // la casilla libre más cercana a dos pasos o más, a la que se llega desde la reliquia sin cruzar muros ni puertas
    const junto = (mx, mz, minimo = 2, alcance = 5, pasoCerrado = false) => {
      const dist = new Map([[mx + ',' + mz, 0]]), cola = [[mx, mz]];
      while (cola.length) {
        const [x, z] = cola.shift(), d = dist.get(x + ',' + z);
        if (d >= minimo && libre(x, z)) return [x, z];
        if (d >= alcance) continue;
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const k = (x + dx) + ',' + (z + dz);
          if (dist.has(k) || (m.solida(x + dx, z + dz) && !(pasoCerrado && ['secreto', 'sello'].includes(m.celda(x + dx, z + dz)?.tipo)))) continue;
          dist.set(k, d + 1); cola.push([x + dx, z + dz]);
        }
      }
      return null;
    };
    const metas = this.objetos.filter(o => o.tipo === 'tesoro').sort((a, b) => valor(b) - valor(a));
    // si ninguna reliquia tiene sitio cerca (todas en nichos), cuida desde más lejos
    // (y si todas están tras pasadizos o sellos, el guardián espera al otro lado)
    for (const [meta, cerrado] of [false, true].flatMap(c => metas.map(m => [m, c]))) {
      const sitio = junto(Math.floor(meta.x), Math.floor(meta.z), 2, 5, cerrado);
      if (!sitio) continue;
      const [x, z] = sitio, base = ENEMIGOS[g.tipo];
      const e = { tipo: g.tipo, nombre: g.nombre, x: x + 0.5, z: z + 0.5, y: m.piso(x, z), ...base, vidaMax: base.vida, estado: 'dormido', t: 0, espera: 0, anim: 0, invocaciones: 0, sinVerte: Infinity, alerta: false, tVoz: 3 + Math.random() * 4 };
      this.enemigos.push(e);
      return e;
    }
    return null;
  }

  // Siervos que el guardián llama al perder vida: aparecen en casillas libres a su alrededor.
  invocar(g) {
    const m = this.mapa;
    let n = 0;
    for (const [dx, dz] of [[2, 0], [-2, 0], [0, 2], [0, -2], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
      if (n === 2) break;
      const x = Math.floor(g.x) + dx, z = Math.floor(g.z) + dz, c = m.celda(x, z);
      if (!c || m.solida(x, z) || c.peligro || !this.seVe(g, { x: x + 0.5, z: z + 0.5, y: c.piso })) continue;
      const base = ENEMIGOS[g.invoca];
      this.enemigos.push({ tipo: g.invoca, x: x + 0.5, z: z + 0.5, y: c.piso, ...base, vidaMax: base.vida, estado: 'caza', t: 0, espera: 0.8, anim: Math.random() * 2, sinVerte: 0, visto: { x: this.j.x, z: this.j.z }, alerta: true, tVoz: 3 + Math.random() * 4 });
      this.salpicar(x + 0.5, c.piso + 0.3, z + 0.5, 'polvo', 10);
      n++;
    }
    if (n) { this.voz(g, 'alerta'); this.ev.mensaje(`¡${g.nombre} llama a sus siervos!`, 3); }
  }

  // ---------- Ambiente: llamas de las antorchas, decorado, polvo en el aire ----------

  prepararAmbiente() {
    const m = this.mapa;
    let s = 0;
    for (const ch of this.def.id) s = (s * 31 + ch.charCodeAt(0)) >>> 0;
    const azarFijo = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    const DIRS = [[0, -1], [0, 1], [-1, 0], [1, 0]];
    const abierta = (x, z) => { const c = m.celda(x, z); return c && !m.solida(x, z); };
    // una llama delante de cada cara visible de las antorchas de muro
    this.llamas = [];
    for (let z = 0; z < m.alto; z++) for (let x = 0; x < m.ancho; x++) {
      if (!m.celda(x, z).antorcha) continue;
      for (const [dx, dz] of DIRS) {
        if (!abierta(x + dx, z + dz)) continue;
        this.llamas.push({ x: x + 0.5 + dx * 0.58, z: z + 0.5 + dz * 0.58, dx, dz, y: m.piso(x + dx, z + dz) + 0.62, fase: azarFijo() * 10 });
      }
    }
    // decorado junto a los muros y telarañas en las esquinas
    const ocupada = new Set(this.objetos.map(o => Math.floor(o.x) + ',' + Math.floor(o.z)));
    ocupada.add(Math.floor(m.inicio.x) + ',' + Math.floor(m.inicio.z));
    const TIPOS = ['deco_huesos', 'deco_craneo', 'deco_vasija', 'deco_escombros', 'deco_velas'];
    this.decorado = [];
    for (let z = 0; z < m.alto; z++) for (let x = 0; x < m.ancho; x++) {
      const c = m.celda(x, z);
      if (c.tipo !== 'suelo' || c.trampa || c.peligro || c.estatua || ocupada.has(x + ',' + z)) continue;
      const muros = DIRS.filter(([dx, dz]) => m.solida(x + dx, z + dz));
      if (!muros.length) continue;
      const [dx, dz] = muros[Math.floor(azarFijo() * muros.length)];
      if (azarFijo() < 0.07) {
        const tex = TIPOS[Math.floor(azarFijo() * TIPOS.length)];
        const lado = (azarFijo() - 0.5) * 0.5;
        this.decorado.push({ tex, x: x + 0.5 + dx * 0.3 + dz * lado, z: z + 0.5 + dz * 0.3 + dx * lado, y: c.piso, tam: tex === 'deco_vasija' ? 0.42 : 0.34, fase: azarFijo() * 4 });
      }
      if (muros.length >= 2 && azarFijo() < 0.18) {
        const [ex, ez] = muros.find(([a, b]) => a !== dx || b !== dz);
        this.decorado.push({ tex: 'deco_telarana', x: x + 0.5 + (dx + ex) * 0.4, z: z + 0.5 + (dz + ez) * 0.4, y: c.techoY - 0.62, tam: 0.6 });
      }
    }
    // motas de polvo que flotan alrededor del jugador y brasas que suben de las antorchas
    this.motas = [];
    this.brasas = [];
  }

  actualizarAmbiente(dt) {
    const j = this.j, m = this.mapa;
    while (this.motas.length < 28) {
      const a = Math.random() * Math.PI * 2, d = 0.6 + Math.random() * 3.5;
      this.motas.push({ x: j.x + Math.cos(a) * d, z: j.z + Math.sin(a) * d, y: j.y + 0.2 + Math.random() * 1.4, fase: Math.random() * 6 });
    }
    for (const q of this.motas) {
      q.fase += dt;
      q.x += Math.sin(q.fase * 0.7) * dt * 0.05; q.z += Math.cos(q.fase * 0.5) * dt * 0.05; q.y += Math.sin(q.fase * 0.9) * dt * 0.03;
      const lejos = Math.hypot(q.x - j.x, q.z - j.z) > 4.5;
      if (lejos || m.solida(Math.floor(q.x), Math.floor(q.z))) q.x = NaN;
    }
    this.motas = this.motas.filter(q => !Number.isNaN(q.x));
    for (const l of this.llamas) {
      if (Math.random() < dt * 1.5 && Math.hypot(l.x - j.x, l.z - j.z) < 9) {
        this.brasas.push({ x: l.x + (Math.random() - 0.5) * 0.1, z: l.z + (Math.random() - 0.5) * 0.1, y: l.y + 0.3, vida: 0.8 + Math.random() * 0.8, deriva: Math.random() * 6 });
      }
    }
    for (const b of this.brasas) { b.vida -= dt; b.y += dt * 0.55; b.x += Math.sin(b.deriva + b.vida * 5) * dt * 0.08; }
    this.brasas = this.brasas.filter(b => b.vida > 0);
  }

  // Pistas justas de los pasadizos secretos: a pocos pasos de uno (y mirando hacia él) sale una corriente de
  // aire que mueve el polvo y avisa una vez; desde entonces el botón «Usar» se ilumina frente a esa pared.
  sentirCorrientes(dt) {
    const j = this.j, m = this.mapa;
    this.secretosCerca ??= m.celdas.map((c, i) => c.tipo === 'secreto' ? { i, x: i % m.ancho, z: Math.floor(i / m.ancho) } : null).filter(Boolean);
    this.corriente = Math.max(0, (this.corriente || 0) - dt);
    for (const s of this.secretosCerca) {
      const c = m.celdas[s.i];
      if (c.abriendo) continue;
      const dx = s.x + 0.5 - j.x, dz = s.z + 0.5 - j.z, d = Math.hypot(dx, dz);
      if (d > 3.2 || d < 0.3) continue;
      // el polvo se arremolina junto a la grieta
      if (Math.random() < dt * 6) this.motas.push({ x: s.x + 0.5 - dx / d * 0.7 + (Math.random() - 0.5) * 0.6, z: s.z + 0.5 - dz / d * 0.7 + (Math.random() - 0.5) * 0.6, y: j.y + 0.3 + Math.random() * 0.9, fase: Math.random() * 6 });
      if (!c.notado && d < 2.4 && (dx * Math.cos(j.yaw) + dz * Math.sin(j.yaw)) / d > 0.4 && this.seVe(j, { x: s.x + 0.5, z: s.z + 0.5 })) {
        c.notado = true; this.corriente = 1.2;
        sonar('corriente');
        this.ev.mensaje('Una corriente de aire frío sale de una grieta del muro…', 4);
      }
    }
  }

  // ---------- Física de rejilla ----------

  // ¿Choca un cuerpo de radio r con los pies a la altura y? Los escalones altos también frenan.
  choca(x, z, r, enemigo = false, y = 0) {
    const m = this.mapa;
    for (let cz = Math.floor(z - r); cz <= Math.floor(z + r); cz++)
      for (let cx = Math.floor(x - r); cx <= Math.floor(x + r); cx++) {
        if (enemigo ? m.bloqueaEnemigo(cx, cz) : m.solida(cx, cz)) return true;
        const p = m.piso(cx, cz);
        if (p > y + PASO) return true;
        if (enemigo && p < y - CAIDA_ENEMIGO) return true;
      }
    return false;
  }

  // Suelo más alto bajo el cuerpo (como en Doom: te apoyas en el borde del escalón).
  sueloBajo(x, z, r) {
    const m = this.mapa;
    let p = -Infinity;
    for (let cz = Math.floor(z - r); cz <= Math.floor(z + r); cz++)
      for (let cx = Math.floor(x - r); cx <= Math.floor(x + r); cx++)
        if (!m.solida(cx, cz)) p = Math.max(p, m.piso(cx, cz));
    return p === -Infinity ? m.piso(Math.floor(x), Math.floor(z)) : p;
  }

  mover(e, dx, dz, r, enemigo = false) {
    const y = e.y ?? 0;
    if (!this.choca(e.x + dx, e.z, r, enemigo, y)) e.x += dx;
    if (!this.choca(e.x, e.z + dz, r, enemigo, y)) e.z += dz;
  }

  // Los pies siguen al suelo: suben el escalón enseguida y bajan con gravedad.
  apoyar(e, r, dt) {
    const meta = this.sueloBajo(e.x, e.z, r);
    if (meta >= e.y) { e.y = Math.min(meta, e.y + dt * 6); e.vy = 0; }
    else {
      e.vy = (e.vy || 0) + dt * 18;
      e.y = Math.max(meta, e.y - e.vy * dt);
      if (e.y === meta) { if (e.vy > 6 && e === this.j) sonar('caida'); e.vy = 0; }
    }
  }

  // DDA: primera casilla sólida en la dirección (dx, dz). Devuelve {dist, cx, cz}.
  rayo(x, z, dx, dz, max = 50) {
    let cx = Math.floor(x), cz = Math.floor(z);
    const px = Math.abs(1 / dx), pz = Math.abs(1 / dz);
    const sx = dx < 0 ? -1 : 1, sz = dz < 0 ? -1 : 1;
    let tx = dx < 0 ? (x - cx) * px : (cx + 1 - x) * px;
    let tz = dz < 0 ? (z - cz) * pz : (cz + 1 - z) * pz;
    let dist = 0;
    while (dist < max) {
      if (tx < tz) { cx += sx; dist = tx; tx += px; } else { cz += sz; dist = tz; tz += pz; }
      if (this.mapa.solida(cx, cz)) return { dist, cx, cz };
    }
    return { dist: max, cx, cz };
  }

  seVe(a, b) {
    const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz);
    return this.rayo(a.x, a.z, dx / d, dz / d, d).dist >= d - 0.01;
  }

  // ---------- Bucle ----------

  actualizar(dt, ent) {
    if (this.terminado) return;
    this.tiempo += dt;
    const j = this.j;
    this.fogonazo = Math.max(0, this.fogonazo - dt * 6);
    this.animarPuertas(dt);
    this.avanzarReloj(dt);
    if (this.proteccion > 0) this.proteccion = Math.max(0, this.proteccion - dt);
    if (j.muerto) {
      if (this.reaparecer > 0 && (this.reaparecer -= dt) <= 0) this.revivir();
      this.enemigosAunque(dt);   // en una sala el mundo sigue aunque yo haya caído
      return;
    }

    j.yaw += ent.giro + ent.giroTeclas * GIRO_TECLAS * dt;
    j.cabeceo = Math.max(-MAX_CABECEO, Math.min(MAX_CABECEO, j.cabeceo + ent.cabeceo));
    if (ent.nivelar) j.cabeceo *= Math.max(0, 1 - dt * 2.5);
    this.asistir = ent.asistir;
    if (ent.asistir) this.imantar(dt);

    // al recargar caminas más lento: es el momento vulnerable
    const vel = j.cayendo !== undefined ? 0 : VEL * dt * (j.recargando > 0 ? 0.55 : 1);
    const fx = Math.cos(j.yaw), fz = Math.sin(j.yaw);
    const rx = -fz, rz = fx;
    let mx = fx * ent.adelante + rx * ent.lado, mz = fz * ent.adelante + rz * ent.lado;
    const ml = Math.hypot(mx, mz);
    if (ml > 1) { mx /= ml; mz /= ml; }
    this.mover(j, mx * vel, mz * vel, RADIO_JUGADOR);
    if (j.cayendo === undefined) this.apoyar(j, RADIO_JUGADOR, dt);
    const antes = Math.floor(j.paso / Math.PI);
    j.paso += Math.min(ml, 1) * vel * 3.2;
    if (Math.floor(j.paso / Math.PI) !== antes && j.cayendo === undefined) sonar('paso_' + this.superficie());

    j.espera = Math.max(0, j.espera - dt);
    j.ataque = Math.max(0, j.ataque - dt);
    if (j.recargando > 0) {
      j.recargando -= dt;
      if (j.recargando <= 0) {
        if (j.recargaArma === 'tommy') {
          const n = Math.min(CARGADOR - j.cargador, j.reservaT);
          j.cargador += n; j.reservaT -= n;
        } else if (j.recargaArma === 'escopeta') {
          const n = Math.min(TUBO - j.tubo, j.reservaE);
          j.tubo += n; j.reservaE -= n;
        } else {
          const n = Math.min(6 - j.tambor, j.reserva);
          j.tambor += n; j.reserva -= n;
        }
      }
    }

    const p = ent.pulsos;
    if (p.has('arma1')) this.cambiarArma('latigo');
    if (p.has('arma2')) this.cambiarArma('revolver');
    if (p.has('arma3')) this.cambiarArma('escopeta');
    if (p.has('arma4')) this.cambiarArma('tommy');
    if (p.has('cambiarArma')) this.cambiarArma(this.siguienteArma());
    if (p.has('recargar')) this.recargar();
    if (p.has('curar') && j.vendas && j.vida < 100 && !j.muerto) { j.vendas = 0; j.vida = Math.min(100, j.vida + 25); sonar('recoger'); this.ev.mensaje('Usaste las vendas (+25 de vida).'); }
    if (p.has('usar')) this.usar();
    if (ent.disparar) this.atacar();

    this.explorado = (this.explorado || 0) - dt;
    if (this.explorado <= 0) { explorar(this); this.explorado = 0.15; this.buscarSalida(); }
    if (this.derrumbe > 0 && (this.derrumbe -= dt) <= 0) this.derrumbar();
    this.temblor = Math.max(0, this.temblor - dt);
    this.recoger();
    this.encenderCercanas(dt);
    this.peligros(dt);
    this.actualizarDardos();
    this.actualizarRocas(dt);
    this.enemigosAunque(dt);
    this.actualizarParticulas(dt);
    this.actualizarAmbiente(dt);
    this.sentirCorrientes(dt);
  }

  // ---------- Partículas y proyectiles ----------

  // La entrada se derrumba a espaldas del jugador: polvo, piedras, temblor y ya no hay vuelta atrás.
  derrumbar() {
    const [x, z] = this.mapa.def.derrumbe;
    const j = this.j, cx = x + 0.5, cz = z + 0.5;
    const dx = j.x - cx, dz = j.z - cz, d = Math.hypot(dx, dz) || 1;
    const px = cx + dx / d * 0.6, pz = cz + dz / d * 0.6;
    for (let k = 0; k < 4; k++) setTimeout(() => this.salpicar(px, 0.4 + k * 0.25, pz, 'polvo', 10, 2.2), k * 120);
    sonar('caida'); setTimeout(() => sonar('golpe'), 180); setTimeout(() => sonar('caida'), 420);
    this.temblor = 1.2;
    this.ev.vibrar?.(220);
    this.ev.mensaje('¡La entrada se derrumba a tus espaldas! Tendrás que encontrar otra salida.', 5);
  }

  // Las antorchas apagadas de los muros se encienden solas cuando les acercas la tuya (mira el resplandor: delata dónde estuviste).
  encenderCercanas(dt) {
    this.tAntorchas = (this.tAntorchas || 0) - dt;
    if (this.tAntorchas > 0) return;
    this.tAntorchas = 0.2;
    const m = this.mapa, j = this.j;
    const x0 = Math.floor(j.x), z0 = Math.floor(j.z);
    for (let z = z0 - 2; z <= z0 + 2; z++) for (let x = x0 - 2; x <= x0 + 2; x++) {
      if (!m.celda(x, z)?.apagada) continue;
      // la antorcha tiene que estar a un paso y a la vista (no al otro lado de una esquina)
      const dx = x + 0.5 - j.x, dz = z + 0.5 - j.z, d = Math.hypot(dx, dz);
      if (d > 1.9) continue;
      const h = this.rayo(j.x, j.z, dx / d, dz / d, d + 0.5);
      if (h.cx !== x || h.cz !== z) continue;
      this.encender(z * m.ancho + x);
    }
  }

  // Enciende la antorcha de muro `i`. `desdeRed`: la encendió otro cazador (no se vuelve a avisar).
  encender(i, desdeRed = false) {
    const m = this.mapa, c = m.celdas[i];
    if (!c?.apagada) return;
    c.apagada = false; c.antorcha = true; c.tex = 'antorcha';
    const x = i % m.ancho, z = Math.floor(i / m.ancho);
    m.iluminar(x, z);
    for (const [dx, dz] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
      const v = m.celda(x + dx, z + dz);
      if (v && !m.solida(x + dx, z + dz)) this.llamas.push({ x: x + 0.5 + dx * 0.58, z: z + 0.5 + dz * 0.58, dx, dz, y: m.piso(x + dx, z + dz) + 0.62, fase: Math.random() * 10 });
    }
    this.ev.reconstruir?.();
    sonar('recoger');
    if (!desdeRed) {
      this.ev.antorchaEncendida?.(i);
      if (!this.avisoAntorcha) { this.avisoAntorcha = true; this.ev.mensaje('La antorcha del muro se enciende al acercarle la tuya.'); }
    }
  }

  // La salida no tiene antorcha: hay que toparse con ella. Al verla queda marcada en el automapa.
  buscarSalida() {
    if (this.salidaVista || !this.mapa.def.derrumbe) return;
    const m = this.mapa;
    for (let i = 0; i < m.celdas.length; i++) {
      if (m.celdas[i].tipo !== 'salida' || !this.vistas[i]) continue;
      const x = i % m.ancho, z = Math.floor(i / m.ancho);
      if (Math.hypot(x + 0.5 - this.j.x, z + 0.5 - this.j.z) > 4.5) continue;
      this.salidaVista = true;
      sonar('acierto');
      this.ev.mensaje('Encontraste la salida. Ya sabes por dónde salir: puedes seguir buscando reliquias.', 5);
      return;
    }
  }

  // Zona en la que está el jugador, con sus reliquias halladas (null si la mazmorra no tiene zonas).
  zonaActual() {
    if (!this.zonas.length) return null;
    const c = this.mapa.celda(Math.floor(this.j.x), Math.floor(this.j.z));
    const i = c ? c.zona : 0;
    return { numero: i + 1, ...this.zonas[i] };
  }

  salpicar(x, y, z, tex, n = 6, fuerza = 1.6) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      this.particulas.push({
        x, y, z, tex,
        vx: Math.cos(a) * fuerza * Math.random(), vz: Math.sin(a) * fuerza * Math.random(),
        vy: 0.8 + Math.random() * 1.6, vida: 0.4 + Math.random() * 0.35,
        tam: tex === 'chispa' ? 0.06 : 0.1,
      });
    }
  }

  actualizarParticulas(dt) {
    const m = this.mapa;
    for (const q of this.particulas) {
      q.vida -= dt;
      q.vy -= 7 * dt;
      q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt;
      const suelo = m.piso(Math.floor(q.x), Math.floor(q.z));
      if (q.y < suelo) { q.y = suelo; q.vy *= -0.3; q.vx *= 0.5; q.vz *= 0.5; }
    }
    this.particulas = this.particulas.filter(q => q.vida > 0);
  }

  // Bola de fuego (sectarios) o flecha (arqueros): la flecha va más rápido y es más difícil de esquivar.
  lanzarFuego(e, j = this.j) {
    const dx = j.x - e.x, dz = j.z - e.z, d = Math.hypot(dx, dz);
    const flecha = !!e.flechas, vel = flecha ? VEL_FLECHA : VEL_FUEGO;
    this.proyectiles.push({ x: e.x + dx / d * 0.4, z: e.z + dz / d * 0.4, y: e.y + 0.55, vx: dx / d * vel, vz: dz / d * vel, daño: flecha ? e.flechas : e.fuego, vida: 4, flecha });
    sonar(flecha ? 'flecha' : 'fuego');
  }

  // El brujo se desvanece y reaparece a 4.5–11 m de ti, con línea de vista y sobre suelo firme. false si no halló dónde.
  teletransportar(e, j) {
    const m = this.mapa, sitios = [];
    for (let cz = Math.floor(j.z) - 11; cz <= Math.floor(j.z) + 11; cz++) for (let cx = Math.floor(j.x) - 11; cx <= Math.floor(j.x) + 11; cx++) {
      const d = Math.hypot(cx + 0.5 - j.x, cz + 0.5 - j.z);
      if (d < 4.5 || d > 11) continue;
      const c = m.celda(cx, cz);
      if (!c || c.tipo !== 'suelo' || c.peligro || c.trampa || m.solida(cx, cz) || Math.abs(m.piso(cx, cz) - j.y) > 0.4) continue;
      sitios.push([cx + 0.5, cz + 0.5]);
    }
    for (let k = 0; k < 30 && sitios.length; k++) {
      const [x, z] = sitios.splice(Math.floor(Math.random() * sitios.length), 1)[0], cx = Math.floor(x), cz = Math.floor(z);
      if (!this.seVe({ x, z }, j)) continue;
      this.salpicar(e.x, e.y + 0.6, e.z, 'polvo', 8, 0.9); this.salpicar(e.x, e.y + 0.6, e.z, 'chispa', 5, 1.2);
      e.x = x; e.z = z; e.y = m.piso(cx, cz); e.visto = null; e.espera = Math.max(e.espera, 0.9);
      this.salpicar(x, e.y + 0.6, z, 'chispa', 6, 1.2);
      if (!this.soloRemotos) sonar('teleport');
      return true;
    }
    return false;
  }

  // Dónde está la roca de una trampa ahora: va y viene por su pasillo a velocidad constante.
  rocaEn(r) {
    const largo = r.largo, ciclo = 2 * largo / ROCAS.vel, u = ((this.tiempo + r.fase) % ciclo) * ROCAS.vel;
    const s = u < largo ? u : 2 * largo - u;
    return { x: r.x0 + r.dx * s, z: r.z0 + r.dz * s, y: r.y, avanza: u < largo };
  }

  actualizarRocas(dt) {
    const j = this.j;
    for (const r of this.rocas) {
      r.golpe = Math.max(0, r.golpe - dt);
      const a = this.rocaEn(r);
      const cerca = Math.hypot(a.x - j.x, a.z - j.z);
      if (cerca < 9 && !j.muerto) {
        r.retumbo = (r.retumbo || 0) - dt;
        if (r.retumbo <= 0) { r.retumbo = 0.55; sonar('roca'); }
      }
      if (j.muerto || r.golpe > 0 || cerca > ROCAS.radio + RADIO_JUGADOR || Math.abs(a.y - j.y) > 0.7) continue;
      r.golpe = 1.6;
      this.temblor = Math.max(this.temblor, 0.4);
      this.salpicar(a.x, a.y + 0.5, a.z, 'polvo', 8, 1);
      this.dañarJugador(azar(ROCAS.daño), 'Te aplastó una roca rodante.');
    }
  }

  actualizarProyectiles(dt) {
    const j = this.j, m = this.mapa;
    for (const f of this.proyectiles) {
      f.vida -= dt;
      f.x += f.vx * dt; f.z += f.vz * dt;
      const cx = Math.floor(f.x), cz = Math.floor(f.z);
      if (m.solida(cx, cz) || m.piso(cx, cz) > f.y) {
        f.vida = 0; this.salpicar(f.x - f.vx * 0.02, f.y, f.z - f.vz * 0.02, 'chispa', 8); sonar('golpe');
      } else {
        const blanco = [this.soloRemotos ? null : j, ...this.blancos].find(b => b && !b.muerto && Math.hypot(f.x - b.x, f.z - b.z) < 0.38 && Math.abs(f.y - (b.y + 0.5)) < 0.7);
        if (blanco) {
          f.vida = 0; this.salpicar(f.x, f.y, f.z, 'chispa', 8);
          this.dañar(blanco, azar(f.daño), f.flecha ? 'Te alcanzó una flecha.' : 'Te alcanzó una bola de fuego.');
        }
      }
    }
    this.proyectiles = this.proyectiles.filter(f => f.vida > 0);
  }

  // Material del suelo bajo los pies (para el sonido de los pasos).
  superficie() {
    const c = this.mapa.celda(Math.floor(this.j.x), Math.floor(this.j.z));
    const s = c?.suelo || '';
    if (/nieve|hielo/.test(s)) return 'nieve';
    if (/arena/.test(s)) return 'arena';
    if (/madera|cubierta|puente/.test(s)) return 'madera';
    if (/selva/.test(s) && !/losa/.test(s)) return 'hierba';
    return 'piedra';
  }

  // De 0 a 1: cuántos enemigos te persiguen de cerca y te vieron hace poco (para la música).
  // Uno que te busca del otro lado de un muro no cuenta: no hay tambores por algo que no está.
  tension() {
    let n = 0;
    for (const e of this.enemigos) if ((e.estado === 'caza' || e.estado === 'ataca' || e.estado === 'lanza' || e.estado === 'embiste') && e.sinVerte < 3 && Math.hypot(e.x - this.j.x, e.z - this.j.z) < 12) n++;
    return Math.min(1, n / 2.5);
  }

  // Dónde está el dardo de una trampa ahora (null si no hay uno en el aire). Sale solo del reloj, así que no hay que mandarlo por la red.
  dardoEn(d) {
    const u = this.tiempo + d.fase, t = u % DARDOS.ciclo;
    if (t * DARDOS.vel > d.largo) return null;
    const r = 0.6 + t * DARDOS.vel;
    return { x: d.x + d.dx * r, z: d.z + d.dz * r, y: d.y + 0.5, ciclo: Math.floor(u / DARDOS.ciclo), t };
  }

  actualizarDardos() {
    const j = this.j;
    // ¿estoy en la línea de tiro de alguna trampa? (1 = sí; 2 = y hay un dardo en el aire hacia mí)
    const cx = Math.floor(j.x), cz = Math.floor(j.z);
    this.enTiro = 0;
    for (const d of this.dardos) {
      if (!d.carril.some(([x, z]) => x === cx && z === cz)) continue;
      this.enTiro = Math.max(this.enTiro, this.dardoEn(d) ? 2 : 1);
    }
    for (const d of this.dardos) {
      const t = (this.tiempo + d.fase) % DARDOS.ciclo;
      if (t < d.prev && Math.hypot(d.x - j.x, d.z - j.z) < 14) sonar('dardo');   // acaba de dispararse
      d.prev = t;
      const a = this.dardoEn(d);
      if (!a || j.muerto || d.golpe === a.ciclo) continue;
      if (Math.hypot(a.x - j.x, a.z - j.z) < DARDOS.radio && Math.abs(a.y - (j.y + 0.5)) < 0.7) {
        d.golpe = a.ciclo;
        this.salpicar(a.x, a.y, a.z, 'chispa', 5);
        this.dañarJugador(azar(DARDOS.daño), 'Te atravesó un dardo.');
      }
    }
  }

  // Trampas y peligros bajo los pies del jugador.
  peligros(dt) {
    const j = this.j;
    if (j.cayendo !== undefined) {
      j.cayendo += dt;
      if (j.cayendo > 0.9 && !j.muerto) { j.vida = 0; j.muerto = true; this.ev.muerte(this.resumen('Caíste al abismo.')); }
      return;
    }
    const cx = Math.floor(j.x), cz = Math.floor(j.z);
    const c = this.mapa.celda(cx, cz);
    if (!c) return;
    if (c.peligro === 'abismo') {
      j.cayendo = 0; sonar('dolor'); this.ev.mensaje('¡Aaaah!');
      return;
    }
    if (c.peligro === 'lava') {
      j.quemadura = (j.quemadura || 0) + dt * 28;
      if (j.quemadura >= 1) { const n = Math.floor(j.quemadura); j.quemadura -= n; this.dañarJugador(n, 'La lava no perdona.'); }
    }
    if (c.trampa === 'pinchos' && pinchosArriba(cx, this.tiempo)) {
      const ciclo = Math.floor((this.tiempo + cx * 0.55) / PINCHOS.ciclo);
      if (j.ultimoPincho !== cx + ':' + cz + ':' + ciclo) {
        j.ultimoPincho = cx + ':' + cz + ':' + ciclo;
        this.dañarJugador(PINCHOS.daño, 'Te atravesaron los pinchos.');
      }
    }
  }

  // La siguiente arma que tienes, en el orden látigo, revólver, escopeta.
  siguienteArma() {
    const j = this.j, tengo = ORDEN_ARMAS.filter(a => a === 'latigo' || (a === 'revolver' && j.tieneRevolver) || (a === 'escopeta' && j.tieneEscopeta) || (a === 'tommy' && j.tieneTommy));
    return tengo[(tengo.indexOf(j.arma) + 1) % tengo.length];
  }

  cambiarArma(a) {
    const j = this.j;
    if (a === 'revolver' && !j.tieneRevolver) { this.ev.mensaje('Aún no tienes el revólver.'); return; }
    if (a === 'escopeta' && !j.tieneEscopeta) { this.ev.mensaje('Aún no tienes la escopeta.'); return; }
    if (a === 'tommy' && !j.tieneTommy) { this.ev.mensaje('Aún no tienes la Tommy gun.'); return; }
    if (j.arma !== a) { j.arma = a; j.espera = 0.3; j.recargando = 0; }
  }

  recargar() {
    const j = this.j;
    if (j.recargando > 0) return;
    if (j.arma === 'tommy') {
      if (j.cargador === CARGADOR) return;
      if (!j.reservaT) { this.ev.mensaje('No te quedan balas de Tommy.'); return; }
      j.recargando = j.recargaTotal = 1.9; j.recargaArma = 'tommy'; sonar('recargaT');
      return;
    }
    if (j.arma === 'escopeta') {
      if (j.tubo === TUBO) return;
      if (!j.reservaE) { this.ev.mensaje('No te quedan cartuchos.'); return; }
      j.recargando = j.recargaTotal = 1.5; j.recargaArma = 'escopeta'; sonar('recargaE');
      return;
    }
    if (j.arma !== 'revolver' || j.tambor === 6) return;
    if (!j.reserva) { this.ev.mensaje('No te quedan balas.'); return; }
    j.recargando = j.recargaTotal = 1.5; j.recargaArma = 'revolver'; sonar('recarga');
  }

  atacar() {
    const j = this.j;
    if (j.espera > 0 || j.recargando > 0) return;
    const arma = ARMAS[j.arma];
    if (j.arma === 'escopeta') return this.dispararEscopeta(arma);
    const desv = j.arma === 'tommy' ? (Math.random() - 0.5) * 2 * arma.dispersion : 0;
    if (j.arma === 'tommy') {
      if (!j.cargador) {
        if (j.reservaT) this.recargar(); else { sonar('vacio'); j.espera = 0.3; }
        return;
      }
      j.cargador--;
      sonar('tommy');
      this.fogonazo = 0.8;
      this.temblor = Math.max(this.temblor, 0.05);
      this.ev.vibrar?.(10);
      for (const e of this.enemigos) if (e.estado === 'dormido' && Math.hypot(e.x - j.x, e.z - j.z) < 14) this.despertar(e);
    } else if (j.arma === 'revolver') {
      if (!j.tambor) {
        if (j.reserva) this.recargar(); else { sonar('vacio'); j.espera = 0.3; }
        return;
      }
      j.tambor--;
      sonar('disparo');
      this.fogonazo = 1;
      this.ev.vibrar?.(18);
      // el ruido despierta a los enemigos cercanos
      for (const e of this.enemigos) if (e.estado === 'dormido' && Math.hypot(e.x - j.x, e.z - j.z) < 12) this.despertar(e);
    } else {
      sonar('latigo');
    }
    j.espera = arma.espera; j.ataque = arma.espera;

    // Impacto: el enemigo más cercano dentro del cono, antes del primer muro (puntería automática vertical, como en Doom).
    const fx = Math.cos(j.yaw + desv), fz = Math.sin(j.yaw + desv);
    const muro = this.rayo(j.x, j.z, fx, fz, arma.alcance).dist;
    let mejor = null, mejorD = Infinity;
    for (const e of this.enemigos) {
      if (e.estado === 'muerto' || e.estado === 'oculto') continue;
      const ex = e.x - j.x, ez = e.z - j.z;
      const a = ex * fx + ez * fz;
      const lat = Math.abs(ex * fz - ez * fx);
      const cono = (0.32 + a * 0.02) * (this.asistir ? 1.8 : 1);
      if (a > 0 && a < Math.min(muro, arma.alcance) && lat < cono && a < mejorD) { mejor = e; mejorD = a; }
    }
    const rival = this.rivalEnMira(fx, fz, Math.min(muro, arma.alcance), 0.32, 0.02, mejorD);
    if (rival) this.herirCazador(rival, azar(arma.daño), j.arma === 'tommy' ? DAÑO_CAZADOR_TOMMY : DAÑO_CAZADOR);
    else if (mejor) this.herir(mejor, azar(arma.daño));
    else if (muro < arma.alcance) {
      // impacto en el muro: polvo (y chispas si es una bala)
      const d = muro - 0.05;
      const ix = j.x + fx * d, iz = j.z + fz * d, iy = j.y + OJO + Math.tan(j.cabeceo) * d;
      this.salpicar(ix, iy, iz, 'polvo', 4, 0.8);
      if (j.arma === 'revolver' || j.arma === 'tommy') { this.salpicar(ix, iy, iz, 'chispa', 3, 1.2); setTimeout(() => sonar('rebote'), 60); }
      else setTimeout(() => sonar('golpe'), 90);
    }
  }

  // ¿Está el cazador `r` en la línea de tiro? Devuelve su distancia, o null.
  enMira(r, fx, fz, alcance, base, abre, asistido = 1.8) {
    const j = this.j;
    if (!this.combate || r.muerto || Math.abs(r.y - j.y) > 1.2) return null;
    const ex = r.x - j.x, ez = r.z - j.z, a = ex * fx + ez * fz, lat = Math.abs(ex * fz - ez * fx);
    return a > 0 && a < alcance && lat < (base + a * abre) * (this.asistir ? asistido : 1) ? a : null;
  }

  // El cazador más cercano en la mira, si está más cerca que el enemigo `masLejos`.
  rivalEnMira(fx, fz, alcance, base, abre, masLejos) {
    let mejor = null, md = masLejos;
    for (const r of this.rivales) {
      const a = this.enMira(r, fx, fz, alcance, base, abre);
      if (a !== null && a < md) { mejor = r; md = a; }
    }
    return mejor;
  }

  // Le pego a otro cazador: él mismo se resta la vida (si no está protegido) y yo veo el golpe.
  herirCazador(r, daño, factor = DAÑO_CAZADOR) {
    this.ev.pegarA?.(r.id, Math.max(1, Math.round(daño * factor)));
    this.salpicar(r.x, r.y + 0.5, r.z, 'sangre', 5, 1.2);
    sonar('golpe');
  }

  // Me pega otro cazador. Si me derriba, lo aviso para que se sepa quién fue.
  recibirGolpe(n, de) {
    const j = this.j;
    if (!this.combate || j.muerto || this.proteccion > 0) return;
    this.dañarJugador(n, `${de.nombre} te derrotó.`, `${de.nombre} te ataca`);
    if (j.muerto) this.ev.baja?.(de.id);
  }

  // Siete perdigones en abanico: de cerca casi todos pegan; de lejos se dispersan y llegan pocos. Pueden herir a varios.
  dispararEscopeta(arma) {
    const j = this.j;
    if (!j.tubo) {
      if (j.reservaE) this.recargar(); else { sonar('vacio'); j.espera = 0.3; }
      return;
    }
    j.tubo--;
    sonar('escopeta');
    this.fogonazo = 1;
    this.temblor = Math.max(this.temblor, 0.12);
    this.ev.vibrar?.(40);
    j.espera = j.ataque = arma.espera;
    for (const e of this.enemigos) if (e.estado === 'dormido' && Math.hypot(e.x - j.x, e.z - j.z) < 14) this.despertar(e);
    const fx = Math.cos(j.yaw), fz = Math.sin(j.yaw);
    const muro = this.rayo(j.x, j.z, fx, fz, arma.alcance).dist;
    const blancos = [];
    for (const e of this.enemigos) {
      if (e.estado === 'muerto' || e.estado === 'oculto') continue;
      const ex = e.x - j.x, ez = e.z - j.z;
      const a = ex * fx + ez * fz;
      const lat = Math.abs(ex * fz - ez * fx);
      const cono = (0.5 + a * 0.075) * (this.asistir ? 1.4 : 1);
      if (a > 0 && a < Math.min(muro, arma.alcance) && lat < cono) blancos.push([a, e]);
    }
    for (const r of this.rivales) {
      const a = this.enMira(r, fx, fz, Math.min(muro, arma.alcance), 0.5, 0.075, 1.4);
      if (a !== null) blancos.push([a, r]);
    }
    blancos.sort((x, y) => x[0] - y[0]);
    for (const [a, e] of blancos.slice(0, 3)) {
      const pegan = Math.max(1, Math.round(arma.perdigones * Math.min(1, Math.max(0.15, 1.2 - a / 9))));
      if (e.id !== undefined) this.herirCazador(e, pegan * azar(arma.daño));
      else {
        this.herir(e, pegan * azar(arma.daño));
        this.empujar(e, fx, fz, pegan / arma.perdigones);
      }
    }
    if (!blancos.length && muro < arma.alcance) {
      const d = muro - 0.05;
      const ix = j.x + fx * d, iz = j.z + fz * d, iy = j.y + OJO + Math.tan(j.cabeceo) * d;
      this.salpicar(ix, iy, iz, 'polvo', 6, 0.9);
      this.salpicar(ix, iy, iz, 'chispa', 4, 1.2);
    }
  }

  // El golpe de la escopeta echa atrás al monstruo (hasta unos 2 m de cerca, nada de lejos; los jefes ceden menos)
  // y le corta lo que estaba haciendo. El invitado no lo mueve: el anfitrión es quien simula a los enemigos.
  empujar(e, fx, fz, fuerza) {
    if (this.rol === 'invitado' || e.estado === 'muerto') return;
    const total = (e.jefe ? 0.5 : 2.2) * fuerza * fuerza, pasos = 6;
    for (let k = 0; k < pasos; k++) this.mover(e, fx * total / pasos, fz * total / pasos, e.radio || 0.28, true);
    if (!e.jefe && e.estado !== 'dolor') { e.estado = 'dolor'; e.t = 0.3 + 0.3 * fuerza; }
    e.espera = Math.max(e.espera, 0.5);
  }

  // Puntería asistida (táctil): la vista se desliza suavemente hacia el enemigo
  // despierto más cercano que esté casi en la mira.
  imantar(dt) {
    const j = this.j;
    let mejor = null, mejorD = 14;
    for (const e of this.enemigos) {
      if (e.estado === 'muerto' || e.estado === 'dormido' || e.estado === 'oculto') continue;
      const d = Math.hypot(e.x - j.x, e.z - j.z);
      if (d >= mejorD) continue;
      let dif = Math.atan2(e.z - j.z, e.x - j.x) - j.yaw;
      dif = Math.atan2(Math.sin(dif), Math.cos(dif));
      if (Math.abs(dif) > 0.16 || !this.seVe(j, e)) continue;
      mejor = dif; mejorD = d;
    }
    if (mejor !== null) j.yaw += Math.max(-dt * 0.9, Math.min(dt * 0.9, mejor * dt * 4));
  }

  // ¿Hay algo que usar justo enfrente? (ilumina el botón «Usar»; los pasadizos secretos no se delatan)
  puedeUsar() {
    const j = this.j;
    if (this.cofreEnMira()) return true;
    const h = this.rayo(j.x, j.z, Math.cos(j.yaw), Math.sin(j.yaw), 1.4);
    if (h.dist >= 1.4) return false;
    const c = this.mapa.celda(h.cx, h.cz);
    return !!c && (['tablilla', 'aviso', 'salida', 'sello'].includes(c.tipo) || (c.tipo === 'puerta' && !c.abriendo) || (c.tipo === 'secreto' && c.notado && !c.abriendo));
  }

  herir(e, daño) {
    // el invitado solo avisa al anfitrión, que es quien resta la vida; aquí se ve el golpe
    if (this.rol === 'invitado') {
      this.ev.golpear(this.enemigos.indexOf(e), daño);
      e.golpe = 0.12;
      this.salpicar(e.x, e.y + 0.55, e.z, SALPICA[e.tipo] || 'polvo', 7);
      sonar('impacto');
      return;
    }
    e.vida -= daño;
    e.golpe = 0.12;
    sonar('impacto');
    e.sinVerte = 0; e.visto = { x: this.j.x, z: this.j.z };   // sabe de dónde le pegaron
    if (e.teletransporta && e.vida > 0 && Math.random() < 0.3) e.tTele = Math.min(e.tTele ?? 0, 0.2);   // herido, se escabulle
    this.salpicar(e.x, e.y + 0.55, e.z, SALPICA[e.tipo] || 'polvo', 7);
    if (e.vida <= 0) {
      e.estado = 'muerto'; e.tMuerte = 0; this.abatidos++; this.voz(e, 'muerte');
      if (e.jefe) {
        this.ev.mensaje(`¡Derrotaste a ${e.nombre}!`, 4);
        this.temblor = 0.6;
        this.objetos.push({ tipo: 'vendas', x: e.x, z: e.z, fase: 0 });
      }
    } else if (e.jefe) {
      // los guardianes no se detienen a cada golpe, y al perder cada tercio de vida piden ayuda
      if (e.estado === 'dormido') e.estado = 'caza';
      if (Math.random() < 0.25 && e.estado !== 'embiste') { e.estado = 'dolor'; e.t = 0.2; }
      this.voz(e, 'dolor');
      const tercio = Math.floor((1 - e.vida / e.vidaMax) * 3);
      if (tercio > e.invocaciones) { e.invocaciones = tercio; this.invocar(e); }
    } else {
      // no todos los golpes los frenan: así no se les gana solo a latigazos seguidos; y tras frenarse aguantan un rato
      // sin frenarse otra vez, para que una ráfaga no los deje paralizados mientras la vida se les acaba
      if ((Math.random() < 0.6 && !(e.sinFreno > 0)) || e.estado === 'dormido' || e.estado === 'oculto') { e.estado = 'dolor'; e.t = 0.25; e.sinFreno = 0.6; }
      else if (e.estado !== 'caza' && e.estado !== 'dolor') e.estado = 'caza';
      this.voz(e, 'dolor');
    }
  }

  // El cofre cerrado que tienes enfrente, a menos de 1,7 m.
  cofreEnMira() {
    const j = this.j, fx = Math.cos(j.yaw), fz = Math.sin(j.yaw);
    let mejor = null, md = 1.7;
    for (const o of this.objetos) {
      if (!o.cerrado || o.cogido) continue;
      const dx = o.x - j.x, dz = o.z - j.z, d = Math.hypot(dx, dz);
      if (d >= md || (d > 0.4 && (dx * fx + dz * fz) / d < 0.75) || !this.seVe(j, o)) continue;
      mejor = o; md = d;
    }
    return mejor;
  }

  // Abre un cofre con una llave (se gasta) o, si no hay, con la palanca de hierro (también se gasta; pide confirmar).
  abrirCofre(o) {
    const j = this.j;
    if (!j.llaves && !j.barreta) {
      sonar('sellado');
      this.ev.mensaje('El cofre está cerrado con llave. Busca una llave tirada por las salas, o una palanca de hierro.', 4);
      return;
    }
    if (!j.llaves) {
      if (this.forzando !== 'cofre' + o.n || this.tiempo - this.forzandoT >= 4) {
        this.forzando = 'cofre' + o.n; this.forzandoT = this.tiempo;
        sonar('sellado');
        this.ev.mensaje('Pulsa «Usar» otra vez para reventar el cofre con la palanca (se gasta), o busca una llave.', 4);
        return;
      }
      j.barreta = 0; this.barretaObj = null;
      sonar('forzar');
    } else {
      j.llaves--; this.llavesObj?.pop();
      sonar('palanca');
    }
    this.abrirCofreObj(o);
    this.ev.cofreAbierto?.(o.n);
  }

  // Otro cazador recogió el objeto `n`: ya no está.
  retirar(n) { const o = this.objetos[n]; if (o && o.tipo !== 'tesoro') o.cogido = true; }

  // El cofre se abre (también cuando lo abre otro cazador en una sala).
  abrirCofreObj(o) {
    if (!o.cerrado) return;
    o.cerrado = false;
    setTimeout(() => sonar('puerta'), 200);
    this.ev.mensaje('¡El cofre se abre!', 3);
  }

  usar() {
    const j = this.j, m = this.mapa;
    const cofre = this.cofreEnMira();
    if (cofre) { this.abrirCofre(cofre); return; }
    const caido = this.caidoCerca();
    if (caido) { this.ev.reanimar?.(caido.id); sonar('palanca'); this.ev.mensaje('Reanimas a tu compañero.', 3); return; }
    const fx = Math.cos(j.yaw), fz = Math.sin(j.yaw);
    const h = this.rayo(j.x, j.z, fx, fz, 1.4);
    if (h.dist >= 1.4) return;
    const c = m.celda(h.cx, h.cz);
    if (!c) return;
    if (c.tipo === 'puerta' && !c.abriendo) { c.abriendo = true; sonar('puerta'); }
    else if (c.tipo === 'secreto' && !c.abriendo) {
      c.abriendo = true; this.secretos++; sonar('secreto');
      this.ev.mensaje('¡Un pasadizo secreto!');
    }
    else if (c.tipo === 'sello' && !c.abriendo) {
      const a = m.acertijos[c.acertijo];
      if (j.barreta) {
        // forzar gasta la palanca: se pide confirmar para no desperdiciarla en un sello que pensabas descifrar
        if (this.forzando === a.id && this.tiempo - this.forzandoT < 4) { this.forzarSello(a); return; }
        this.forzando = a.id; this.forzandoT = this.tiempo;
        sonar('sellado');
        this.ev.mensaje(`Un sello antiguo bloquea el paso. Pulsa «Usar» otra vez para forzarlo con la palanca (se gasta), o busca «${a.titulo}».`, 4);
        return;
      }
      sonar('sellado');
      this.ev.mensaje(`Un sello antiguo bloquea el paso. Busca «${a.titulo}».`);
    }
    else if (c.tipo === 'tablilla') {
      const a = m.acertijos[c.acertijo];
      if (a.resuelto) this.ev.mensaje(a.ajeno ? `${a.ajeno.nombre} ya descifró esta inscripción.` : 'Ya descifraste esta inscripción.');
      else if (a.enviado) this.ev.mensaje('Esperando que la cripta confirme tu respuesta…', 2);
      else this.ev.abrirTablilla(a);
    }
    else if (c.tipo === 'aviso') this.ev.mensaje(`«${c.texto}»`, 6);
    else if (c.tipo === 'salida') this.salir();
  }

  // Abre los sellos de un acertijo y los anota como «aviso»: el botón del mapa pulsa y el automapa los marca
  // aunque esa zona no esté explorada, hasta que los veas.
  abrirSellos(a) {
    const m = this.mapa;
    this.sellosNuevos ||= new Set();
    m.celdas.forEach((c, i) => { if (c.tipo === 'sello' && c.acertijo === a.id) { c.abriendo = true; c.pulso = performance.now(); this.sellosNuevos.add(i); } });
    this.avisoMapa = true;
  }

  // `por`: en una sala, el cazador que se adelantó a descifrarla (el sello se abre igual, pero sin puntos para mí).
  resolverAcertijo(a, por = null, tarde = false) {
    a.resuelto = true;
    if (!por) {
      // descifrarlo por tu cuenta suma (2 por estrella; las palancas valen 3 estrellas); cada ayuda pedida resta 2: usarlas no sale a cuenta
      const e = a.estado || a.estadoPalancas, estrellas = a.estado?.pista?.dificultad ?? 3, pedidas = e?.ayudas || 0;
      this.bonoAcertijos += PUNTOS_ESTRELLA * estrellas - PUNTOS_AYUDA * pedidas;
      this.costoAyudas += PUNTOS_AYUDA * pedidas;
      this.ayudas += pedidas;
    }
    this.abrirSellos(a);
    // la tablilla se agrieta: el hechizo que mantenía cerrada la puerta se disipa
    for (const c of this.mapa.celdas) if (c.tipo === 'tablilla' && c.acertijo === a.id && !c.tex.endsWith('_rota')) c.tex += '_rota';
    this.ev.reconstruir?.();
    sonar('puerta');
    if (por) { this.ev.mensaje(tarde ? `¡Llegaste tarde! ${por} descifró «${a.titulo}» antes. El sello se abre.` : `${por} descifró «${a.titulo}». El sello se abre.`, 4); return; }
    this.ev.mensaje('Se oye un mecanismo antiguo. El sello se abre.');
  }

  // Abre el sello con la palanca de hierro. No cuenta como acertijo resuelto: la tablilla sigue sin descifrar.
  forzarSello(a) {
    this.j.barreta = 0;
    a.forzado = true;
    this.abrirSellos(a);
    sonar('forzar');
    setTimeout(() => sonar('puerta'), 450);
    this.ev.mensaje('Metes la palanca en la juntura y el sello cede. La palanca se parte.', 4);
    this.ev.forzo?.(a.id);
  }

  salir() {
    this.terminado = true;
    this.ev.salida(this.resumen());
  }

  // ---------- Reloj ----------

  // Corre aparte de `actualizar` para que no se detenga mientras lees una tablilla.
  avanzarReloj(dt) {
    if (!this.limite || this.terminado) return;
    const antes = this.restante();
    this.reloj = this.real ? (Date.now() - this.inicioReal) / 1000 : this.reloj + dt;
    const r = this.restante();
    if (antes > 60 && r <= 60) { sonar('campanada'); this.ev.mensaje('¡Queda un minuto! Las antorchas empiezan a apagarse.', 4); }
    // la salida se marca en el automapa pasado el 70 % del tiempo: nadie se queda dando vueltas sin encontrarla
    if (!this.salidaRevelada && this.reloj >= this.limite * SALIDA_REVELADA) {
      this.salidaRevelada = true;
      this.avisoMapa = true;
      sonar('campanada');
      this.ev.mensaje('La salida quedó marcada en el automapa.', 5);
    }
    if (r <= 0) { this.terminado = true; this.ev.tiempoAgotado(this.resumen('Se apagó la última antorcha.')); }
  }

  restante() { return Math.max(0, this.limite - this.reloj); }

  // Competitivo: alguien encontró la salida. Empieza la cuenta atrás para los demás y la salida queda marcada.
  iniciarCuenta(seg) {
    if (this.limite || this.terminado) return;
    this.limite = seg; this.reloj = 0; this.inicioReal = Date.now();
    this.salidaRevelada = true; this.avisoMapa = true;
    sonar('campanada');
  }

  // En el último minuto las antorchas de los muros se apagan poco a poco (1 = luz normal).
  penumbra() { return this.limite ? 0.35 + 0.65 * Math.min(1, this.restante() / 60) : 1; }

  // Puntos según la rareza de cada tesoro (común 1, raro 3, épico 8, legendario 20): el marcador de las salas.
  // A eso se suman los acertijos descifrados y se restan las ayudas pedidas: el esfuerzo de resolver pesa más que el tesoro que se alcanzó con ayuda.
  puntosTesoros() { return this.tesoros.reduce((n, id) => n + RAREZAS[TESORO[id].rareza].valor, 0); }
  puntos() { return Math.max(0, this.puntosTesoros() + this.bonoAcertijos); }

  // En una sala morir no termina la partida: sueltas tu último tesoro y reapareces en tu puesto.
  caer() {
    const j = this.j, id = this.tesoros.pop();
    const o = id && this.objetos.find(q => q.tipo === 'tesoro' && q.tesoro === id);
    if (o) {
      // queda donde caíste; si ahí no se puede recoger (lava, abismo, pinchos), en la casilla firme más cercana, no en su puesto de origen
      const m = this.mapa, firme = (x, z) => { const c = m.celda(x, z); return c?.tipo === 'suelo' && !c.peligro && !c.trampa && !c.estatua; };
      const cx = Math.floor(j.x), cz = Math.floor(j.z);
      if (j.cayendo === undefined && firme(cx, cz)) { o.x = j.x; o.z = j.z; }
      else {
        let mejor = null, md = Infinity;
        for (let dz = -5; dz <= 5; dz++) for (let dx = -5; dx <= 5; dx++) {
          const d = Math.hypot(dx, dz);
          if (d < md && firme(cx + dx, cz + dz)) { md = d; mejor = [cx + dx + 0.5, cz + dz + 0.5]; }
        }
        if (mejor) [o.x, o.z] = mejor;
      }
      o.cogido = false;
      const z = this.zonas[o.zona];
      if (z) z.halladas--;
      this.ev.solto?.(o);
    }
    // también se sueltan las llaves y la palanca (el arma y la munición no), cerca de donde caíste
    const sitio = o ? [o.x, o.z] : [j.x, j.z];
    const soltados = [...(this.llavesObj || []).splice(0), ...(this.barretaObj ? [this.barretaObj] : [])];
    soltados.forEach((q, k) => {
      const a = (k + 1) * 2.1;
      Object.assign(q, { cogido: false, x: sitio[0] + Math.cos(a) * 0.5, z: sitio[1] + Math.sin(a) * 0.5 });
      if (this.mapa.solida(Math.floor(q.x), Math.floor(q.z))) { q.x = sitio[0]; q.z = sitio[1]; }
      this.ev.solto?.(q);
    });
    j.llaves = 0; j.barreta = 0; this.barretaObj = null;
    this.reaparecer = this.coop ? 0 : 4;   // en cooperativo te levanta un compañero
    if (this.coop) { this.ev.cayo?.(); this.ev.mensaje('Estás caído. Un compañero puede reanimarte: no salgas sin él.', 8); return; }
    const extra = soltados.length ? ` y ${soltados.length === 1 ? 'un objeto' : 'tus objetos'}` : '';
    this.ev.mensaje(o ? `Soltaste ${TESORO[id].nombre}${extra}. Reapareces en el inicio…` : soltados.length ? `Soltaste ${extra.slice(3)}. Reapareces en el inicio…` : 'Reapareces en el inicio…', 4);
  }

  // Un compañero me reanima: me levanto donde caí.
  levantar() {
    const j = this.j;
    if (!j.muerto || this.terminado) return;
    Object.assign(j, { vida: 50, muerto: false, quemadura: 0 });
    delete j.cayendo;
    this.reaparecer = 0;
    sonar('recoger');
    this.ev.mensaje('Un compañero te reanimó.', 4);
  }

  // El compañero caído más cercano a mi alcance.
  caidoCerca() {
    const j = this.j;
    if (!this.coop || j.muerto) return null;
    return this.companeros.find(c => c.muerto && Math.hypot(c.x - j.x, c.z - j.z) < 1.8) || null;
  }

  revivir() {
    const j = this.j, m = this.mapa;
    const p = this.inicioJ;
    Object.assign(j, { x: p.x, z: p.z, y: m.piso(Math.floor(p.x), Math.floor(p.z)), yaw: p.yaw, cabeceo: 0, vida: this.vidaInicial, muerto: false, quemadura: 0 });
    delete j.cayendo;
    if (this.combate) { this.proteccion = TREGUA_REAPARECER; this.ev.mensaje('Estás protegido unos segundos.', 3); }
  }

  resumen(causa = null) {
    return {
      causa, puntos: this.puntos(), puntosTesoros: this.puntosTesoros(), bonoAcertijos: this.bonoAcertijos, costoAyudas: this.costoAyudas, limite: this.limite, reloj: Math.min(this.reloj, this.limite),
      mazmorra: this.def, tesoros: this.tesoros, totalTesoros: this.totalTesoros,
      secretos: this.secretos, totalSecretos: this.mapa.totalSecretos,
      abatidos: this.abatidos, totalEnemigos: this.enemigos.length, tiempo: this.tiempo,
      acertijos: Object.values(this.mapa.acertijos).filter(a => a.resuelto && !a.ajeno).length,
      totalAcertijos: Object.keys(this.mapa.acertijos).length,
    };
  }

  animarPuertas(dt) {
    for (const c of this.mapa.celdas) {
      if (c.abriendo && c.abierto < 1) c.abierto = Math.min(1, c.abierto + dt * (c.tipo === 'secreto' ? 0.6 : 1.2));
    }
  }

  recoger() {
    const j = this.j;
    for (const o of this.objetos) {
      // la nota que deja otro cazador donde se llevó el tesoro
      if (o.nota && !o.notaVista && Math.hypot(o.x - j.x, o.z - j.z) < 1.4) {
        o.notaVista = true;
        sonar('error');
        this.ev.mensaje(`¡Llegaste tarde! ${o.nota.nombre} se llevó ${TESORO[o.tesoro].nombre}.`, 4);
      }
      if (o.cogido || o.cerrado || Math.hypot(o.x - j.x, o.z - j.z) > 0.55) continue;
      if (o.tipo === 'revolver') {
        const n = 6;
        o.cogido = true; j.tieneRevolver = true; j.tambor = n; j.arma = 'revolver'; j.espera = 0.4;
        sonar('recoger'); this.ev.mensaje(`¡Encontraste tu revólver! Cargado con ${n} balas.`);
      } else if (o.tipo === 'escopeta') {
        const n = TUBO;
        o.cogido = true; j.tieneEscopeta = true; j.tubo = n; j.arma = 'escopeta'; j.espera = 0.4;
        sonar('recoger'); this.ev.mensaje(`¡Una escopeta! Dos cañones, de cerca es devastadora. Cargada con ${n} cartucho${n === 1 ? '' : 's'}.`, 5);
      } else if (o.tipo === 'tommy') {
        const n = CARGADOR, r = 30;
        o.cogido = true; j.tieneTommy = true; j.cargador = n; j.reservaT = Math.min(MAX_TAMBOR, j.reservaT + r); j.arma = 'tommy'; j.espera = 0.4;
        sonar('recoger'); this.ev.mensaje(`¡Una Tommy gun! Mantén el disparo para la ráfaga. Cargador con ${n} balas.`, 5);
      } else if (o.tipo === 'municionT') {
        if (j.reservaT >= MAX_TAMBOR) continue;
        const n = 30;
        o.cogido = true; j.reservaT = Math.min(MAX_TAMBOR, j.reservaT + n);
        sonar('recoger'); this.ev.mensaje(`Un cargador de tambor (+${n}).`);
      } else if (o.tipo === 'cartuchos') {
        if (j.reservaE >= MAX_CARTUCHOS) continue;
        const n = 6;
        o.cogido = true; j.reservaE = Math.min(MAX_CARTUCHOS, j.reservaE + n);
        sonar('recoger'); this.ev.mensaje(`Una caja de cartuchos (+${n}).`);
      } else if (o.tipo === 'llave') {
        o.cogido = true; j.llaves++; (this.llavesObj ||= []).push(o);
        sonar('recoger'); this.ev.mensaje(j.llaves > 1 ? `Otra llave (llevas ${j.llaves}). Cada una abre un cofre y se gasta.` : '¡Una llave antigua! Abre un cofre cerrado y se gasta.', 4);
      } else if (o.tipo === 'barreta') {
        o.cogido = true; j.barreta = 1; this.barretaObj = o;
        sonar('palanca'); this.ev.mensaje('¡Una palanca de hierro! Sirve para forzar un sello sin descifrar su tablilla, o abrir un cofre sin llave, pero solo una vez.', 5);
      } else if (o.tipo === 'balas') {
        if (j.reserva >= 60) continue;
        const n = 12;
        o.cogido = true; j.reserva = Math.min(60, j.reserva + n);
        sonar('recoger'); this.ev.mensaje(`Una caja de balas (+${n}).`);
      } else if (o.tipo === 'vendas') {
        if (j.vida >= 100) {
          if (j.vendas >= 1) continue;   // solo llevas 1 de repuesto
          o.cogido = true; j.vendas = 1;
          sonar('recoger'); this.ev.mensaje('Guardaste unas vendas: úsalas cuando te hieran (H o el botón de vendas).');
        } else {
          o.cogido = true; j.vida = Math.min(100, j.vida + 25);
          sonar('recoger'); this.ev.mensaje('Vendas (+25 de vida).');
        }
      } else if (o.tipo === 'falso') {
        o.cogido = true;
        sonar('error');
        this.dañarJugador(45, 'Elegiste mal.');
        if (!j.muerto) this.ev.mensaje('Elegiste mal: ese cáliz era una trampa y se convierte en polvo.', 4);
      } else if (o.tipo === 'tesoro') {
        // en una sala el anfitrión decide quién llegó primero: se pide y se espera su respuesta
        if (this.ev.reclamar) { if (!o.pendiente) { o.pendiente = true; this.ev.reclamar(o); } continue; }
        this.tomar(o);
      }
      if (o.cogido && o.tipo !== 'tesoro' && o.tipo !== 'falso' && o.n != null) this.ev.recogido?.(o.n);
    }
  }

  tomar(o) {
    o.cogido = true; o.pendiente = false;
    const t = TESORO[o.tesoro];
    this.tesoros.push(t.id);
    sonar('tesoro');
    this.ev.tesoro(t, RAREZAS[t.rareza]);
    const z = this.zonas[o.zona];
    if (z && ++z.halladas === z.total) setTimeout(() => this.ev.mensaje(`${z.nombre}: reuniste todas sus reliquias.`, 4), 2200);
  }

  // Otro cazador se llevó este tesoro: queda su nota en el lugar.
  ceder(o, por) { o.cogido = true; o.pendiente = false; o.nota = por; o.notaVista = false; }

  // El tesoro volvió al suelo (su dueño cayó y lo soltó).
  reponer(o, x, z) { Object.assign(o, { cogido: false, pendiente: false, nota: null, notaVista: false, x, z }); }

  // Enemigos y bolas de fuego: los simula quien juega solo o el anfitrión; los invitados copian lo que él manda.
  enemigosAunque(dt) {
    if (this.rol === 'invitado') this.actualizarCopias(dt);
    else { this.actualizarEnemigos(dt); this.actualizarProyectiles(dt); }
  }

  // El anfitrión ya terminó pero los demás siguen: los enemigos solo persiguen a los que quedan.
  simularRemotos(dt) {
    this.soloRemotos = true;
    this.tiempo += dt;
    this.actualizarEnemigos(dt);
    this.actualizarProyectiles(dt);
  }

  // A quién persigue un enemigo: al cazador más cercano que siga en pie.
  blancoDe(e) {
    const j = this.j;
    let mejor = this.soloRemotos || j.muerto ? null : j, md = mejor ? Math.hypot(e.x - j.x, e.z - j.z) : Infinity;
    for (const b of this.blancos) {
      if (b.muerto) continue;
      const d = Math.hypot(e.x - b.x, e.z - b.z);
      if (d < md) { mejor = b; md = d; }
    }
    return mejor;
  }

  // Daño a un cazador: al mío directo, a los demás por la red.
  dañar(b, n, causa) {
    if (b === this.j) this.dañarJugador(n, causa);
    else this.ev.dañarA?.(b.id, Math.round(n), causa);
  }

  // Lo que ven los invitados: dónde está cada enemigo y qué hace, y las bolas de fuego en el aire.
  instantanea() {
    const r = v => Math.round(v * 100) / 100;
    return {
      e: this.enemigos.map((e, i) => [r(e.x), r(e.z), r(e.y), ESTADOS_RED.indexOf(e.estado), Math.max(0, Math.round(e.vida)), i >= this.enemigosIniciales ? e.tipo : 0]),
      f: this.proyectiles.map(f => [r(f.x), r(f.z), r(f.y), r(f.vx), r(f.vz), f.flecha ? 1 : 0]),
    };
  }

  recibirEnemigos(s) {
    s.e.forEach((d, i) => {
      let e = this.enemigos[i];
      if (!e) {
        const base = ENEMIGOS[d[5]];
        if (!base || i !== this.enemigos.length) return;
        e = this.enemigos[i] = { tipo: d[5], x: d[0], z: d[1], y: d[2], ...base, vidaMax: base.vida, estado: 'caza', t: 0, espera: 0, anim: Math.random() * 2, sinVerte: 0, alerta: true, tVoz: 5 };
        this.salpicar(d[0], d[2] + 0.3, d[1], 'polvo', 10);
      }
      Object.assign(e, { tx: d[0], tz: d[1], ty: d[2], vida: d[4] });
      const estado = ESTADOS_RED[d[3]];
      if (estado && estado !== e.estado) this.cambioRemoto(e, estado);
    });
    this.proyectiles = s.f.map(([x, z, y, vx, vz, fl]) => ({ x, z, y, vx, vz, vida: 1, flecha: !!fl }));
  }

  // Un enemigo cambió de estado en el anfitrión: aquí se oye y se ve lo mismo.
  cambioRemoto(e, nuevo) {
    const antes = e.estado;
    e.estado = nuevo;
    if (nuevo === 'muerto') {
      e.tMuerte = 0; this.abatidos++; this.voz(e, 'muerte');
      if (e.jefe) {
        this.ev.mensaje(`¡Cayó ${e.nombre}!`, 4);
        this.temblor = 0.6;
        this.objetos.push({ tipo: 'vendas', x: e.x, z: e.z, fase: 0 });
      }
    } else if (nuevo === 'dolor') { e.golpe = 0.12; this.voz(e, 'dolor'); }
    else if (nuevo === 'surge') this.voz(e, 'surgir');
    else if (nuevo === 'caza' && (antes === 'dormido' || antes === 'oculto' || antes === 'surge')) { e.alerta = true; this.voz(e, 'alerta'); }
    else if (nuevo === 'ataca' || nuevo === 'embiste' || nuevo === 'lanza') this.voz(e, 'ataque');
  }

  actualizarCopias(dt) {
    const k = 1 - Math.exp(-dt * 12);
    for (const e of this.enemigos) {
      e.golpe = Math.max(0, (e.golpe || 0) - dt);
      if (e.estado === 'muerto') e.tMuerte += dt; else e.anim += dt;
      if (e.tx !== undefined) { e.x += (e.tx - e.x) * k; e.z += (e.tz - e.z) * k; e.y += (e.ty - e.y) * k; }
    }
    for (const f of this.proyectiles) { f.x += f.vx * dt; f.z += f.vz * dt; }
  }

  // Un monstruo que te despertó con el ruido va hacia donde sonó.
  despertar(e) {
    e.estado = 'caza'; e.sinVerte = 0; e.visto = { x: this.j.x, z: this.j.z };
  }

  // Un monstruo que te perdió camina sin rumbo fijo, despacio, cambiando de dirección al topar con un muro.
  vagar(e, dt) {
    e.tRumbo = (e.tRumbo ?? 0) - dt;
    if (e.rumbo === undefined || e.tRumbo <= 0) { e.rumbo = Math.random() * Math.PI * 2; e.tRumbo = 1.5 + Math.random() * 3; }
    const v = e.vel * 0.45 * dt, antes = { x: e.x, z: e.z };
    this.mover(e, Math.cos(e.rumbo) * v, Math.sin(e.rumbo) * v, e.radio || 0.28, true);
    if (Math.hypot(e.x - antes.x, e.z - antes.z) < v * 0.3) e.tRumbo = 0;
  }

  actualizarEnemigos(dt) {
    for (const e of this.enemigos) {
      e.golpe = Math.max(0, (e.golpe || 0) - dt);
      e.sinFreno = Math.max(0, (e.sinFreno || 0) - dt);
      if (e.estado === 'muerto') { e.tMuerte += dt; continue; }
      e.anim += dt;
      e.espera = Math.max(0, e.espera - dt);
      const j = this.blancoDe(e);
      if (!j) continue;
      const dx = j.x - e.x, dz = j.z - e.z, d = Math.hypot(dx, dz);
      e.sinVerte += dt;
      if (e.estado === 'dormido') {
        if (d < e.vista && this.seVe(e, j)) { e.estado = 'caza'; e.sinVerte = 0; e.alerta = true; this.voz(e, 'alerta'); }
        continue;
      }
      // escondido bajo el suelo o en el techo: sale cuando pasas cerca
      if (e.estado === 'oculto') {
        if (d < ACECHO && Math.abs(e.y - j.y) < 1 && this.seVe(e, j)) { e.estado = 'surge'; e.t = SURGE; this.voz(e, 'surgir'); }
        continue;
      }
      if (e.estado === 'surge') {
        e.t -= dt;
        if (e.tipo !== 'arana' && Math.random() < dt * 14) this.salpicar(e.x + (Math.random() - 0.5) * 0.6, e.y + 0.05, e.z + (Math.random() - 0.5) * 0.6, 'polvo', 1, 0.6);
        if (e.t <= 0) { e.estado = 'caza'; e.espera = 0.3; e.alerta = true; e.sinVerte = 0; this.voz(e, 'alerta'); }
        continue;
      }
      if (e.estado === 'dolor') { e.t -= dt; if (e.t <= 0) e.estado = 'caza'; continue; }
      if (e.estado === 'embiste') {
        // carga en línea recta hacia donde estabas; golpea una sola vez
        e.t -= dt;
        const antes = { x: e.x, z: e.z };
        this.mover(e, e.carga.x * EMBESTIDA.vel * dt, e.carga.z * EMBESTIDA.vel * dt, e.radio, true);
        this.apoyar(e, e.radio, dt);
        if (!e.golpeo && d < e.alcance && Math.abs(e.y - j.y) < 0.7) { e.golpeo = true; this.dañar(j, azar(EMBESTIDA.daño), `${e.nombre} te arrolló.`); if (j === this.j) this.temblor = 0.35; }
        const atascado = Math.hypot(e.x - antes.x, e.z - antes.z) < EMBESTIDA.vel * dt * 0.3;
        if (e.t <= 0 || atascado) { e.estado = 'caza'; e.espera = 1.4; if (atascado) { this.temblor = 0.2; sonar('golpe'); } }
        continue;
      }
      if (e.estado === 'lanza') {
        e.t -= dt;
        if (e.t <= 0) { if (this.seVe(e, j)) this.lanzarFuego(e, j); e.estado = 'caza'; }
        continue;
      }
      if (e.estado === 'ataca') {
        e.t -= dt;
        if (e.t <= 0) {
          if (d < e.alcance + 0.25 && Math.abs(e.y - j.y) < 0.7) this.dañar(j, azar(e.daño), 'Has caído en la cripta.');
          e.estado = 'caza'; e.espera = e.espera || 0.6;
        }
        continue;
      }
      // caza
      if (d < e.alcance && e.espera <= 0 && Math.abs(e.y - j.y) < 0.7) {
        e.estado = 'ataca'; e.t = 0.45; e.espera = 0.45 + 0.8; this.voz(e, 'ataque');
        continue;
      }
      const loVe = this.seVe(e, j);
      if (loVe) e.visto = { x: j.x, z: j.z };
      const teVe = loVe && d < e.vista * 1.5;
      if (teVe) {
        // el que despertó por un disparo avisa recién cuando te encuentra; si te perdió un rato, vuelve a avisar
        if (!e.alerta || e.sinVerte > 6) { e.alerta = true; e.tVoz = 3 + Math.random() * 4; this.voz(e, 'alerta'); }
        e.sinVerte = 0;
      }
      if (e.jefe && loVe && d > 2.5 && d < 8 && e.espera <= 0 && Math.random() < dt * 0.7) {
        e.estado = 'embiste'; e.t = EMBESTIDA.duracion; e.golpeo = false; e.carga = { x: dx / d, z: dz / d };
        this.voz(e, 'ataque'); this.ev.mensaje(`¡${e.nombre} embiste!`, 1.5);
        continue;
      }
      if (e.teletransporta) {
        e.tTele = (e.tTele ?? 2) - dt;
        if (loVe && e.tTele <= 0 && d < 5.5) e.tTele = this.teletransportar(e, j) ? 4 + Math.random() * 2 : 1;
      }
      if (e.fuego && loVe && d > 2.2 && d < 11 && e.espera <= 0 && Math.random() < dt * 0.9) {
        e.estado = 'lanza'; e.t = 0.5; e.espera = 2.2 + Math.random() * 1.5;
        continue;
      }
      if (e.flechas && loVe) {
        if (d > 2.5 && d < 14 && e.espera <= 0 && Math.random() < dt * 1.3) {
          e.estado = 'lanza'; e.t = 0.6; e.espera = 1.5 + Math.random() * 1.2;
          continue;
        }
        // se queda a tiro y, si te le acercas, retrocede (mientras tenga por dónde)
        if (d < 9) {
          if (d < 4.2) {
            const v = e.vel * 0.9 * dt, antes = { x: e.x, z: e.z };
            this.mover(e, -dx / d * v, -dz / d * v, e.radio || 0.28, true);
            if (Math.hypot(e.x - antes.x, e.z - antes.z) < v * 0.3 && d < e.alcance + 0.8 && e.espera <= 0) { e.estado = 'ataca'; e.t = 0.45; e.espera = 1.2; this.voz(e, 'ataque'); }
          }
          this.apoyar(e, e.radio || 0.28, dt);
          continue;
        }
      }
      // va hacia donde te vio por última vez; si ahí no estás, te pierde y se pone a vagar hasta que te vuelva a ver u oír
      if (!e.visto) { e.vaga = true; this.vagar(e, dt); }
      else {
        e.vaga = false;
        const mx = e.visto.x - e.x, mz = e.visto.z - e.z, ml = Math.hypot(mx, mz);
        if (ml > 0.6) {
          const v = e.vel * dt, antes = { x: e.x, z: e.z };
          this.mover(e, mx / ml * v, mz / ml * v, e.radio || 0.28, true);
          // topó con un muro rumbo a donde cree que estás: se rinde y vaga, en vez de empujar contra la pared
          if (Math.hypot(e.x - antes.x, e.z - antes.z) < v * 0.3 && !this.seVe(e, e.visto)) e.visto = null;
        } else e.visto = null;
      }
      // separación entre enemigos
      for (const o of this.enemigos) {
        if (o === e || o.estado === 'muerto' || o.estado === 'oculto') continue;
        const sx = e.x - o.x, sz = e.z - o.z, sd = Math.hypot(sx, sz);
        if (sd > 0 && sd < 0.6) this.mover(e, sx / sd * (0.6 - sd) * 0.5, sz / sd * (0.6 - sd) * 0.5, e.radio || 0.28, true);
      }
      this.apoyar(e, e.radio || 0.28, dt);
      // solo se oye mientras te tiene a la vista: nada de gruñidos del otro lado de un muro
      if (teVe) {
        e.tVoz -= dt;
        if (e.tVoz <= 0) { e.tVoz = 4 + Math.random() * 6; this.voz(e, 'voz'); }
        const paso = Math.floor(e.anim * e.vel * 1.6);
        if (paso !== e.paso && d < 7) this.voz(e, 'paso');
        e.paso = paso;
      }
    }
  }

  // La voz de un enemigo, con su distancia y de qué lado está.
  voz(e, momento) {
    if (this.soloRemotos) return;
    const j = this.j, dx = e.x - j.x, dz = e.z - j.z;
    const d = Math.hypot(dx, dz);
    sonarEnemigo(e.tipo, momento, d, d > 0.01 ? (dx * -Math.sin(j.yaw) + dz * Math.cos(j.yaw)) / d : 0);
  }

  dañarJugador(n, causa = 'Has caído en la cripta.', aviso = causa) {
    const j = this.j;
    if (j.muerto) return;
    j.vida = Math.max(0, j.vida - Math.round(n));
    sonar('dolor');
    this.ev.daño(n, aviso);
    this.ev.vibrar?.(60);
    if (j.vida <= 0) { j.muerto = true; this.ev.muerte(this.resumen(causa)); }
  }

  // ---------- Vista ----------

  camara() {
    const j = this.j;
    const bob = Math.sin(j.paso) * 0.025;
    const caida = j.cayendo !== undefined ? -j.cayendo * j.cayendo * 6 : 0;
    const tiembla = this.temblor > 0 ? this.temblor * 0.03 : 0;
    return {
      x: j.x, y: j.y + (j.muerto && caida === 0 ? 0.2 : OJO) + bob + caida + Math.sin(this.tiempo * 61) * tiembla, z: j.z,
      yaw: j.yaw + Math.sin(this.tiempo * 47) * tiembla * 0.5, pitch: j.cayendo !== undefined ? 0.5 : j.cabeceo,
    };
  }

  sprites() {
    const s = [], m = this.mapa, j = this.j;
    const luzEn = (x, z) => m.celda(Math.floor(x), Math.floor(z))?.luz ?? 0.5;
    const pisoEn = (x, z) => m.piso(Math.floor(x), Math.floor(z));
    for (const o of this.objetos) {
      if (o.cogido) {
        if (o.nota) s.push({ x: o.x, z: o.z, y: pisoEn(o.x, o.z) + 0.02, ancho: 0.5, alto: 0.5, tex: 'nota_' + o.nota.color, luz: Math.max(0.5, luzEn(o.x, o.z)) });
        continue;
      }
      const flota = Math.sin(this.tiempo * 2 + o.fase) * 0.03;
      if (o.tipo === 'falso') s.push({ x: o.x, z: o.z, y: pisoEn(o.x, o.z) + 0.08 + flota, ancho: 0.55, alto: 0.55, tex: o.x % 2 < 1 ? 'tesoro_caliz_oro' : 'tesoro_corona_oro', luz: Math.max(0.3, luzEn(o.x, o.z)) });
      else if (o.tipo === 'tesoro') {
        if (o.cofre) s.push({ x: o.x, z: o.z, y: pisoEn(o.x, o.z), ancho: 0.8, alto: 0.8, tex: o.cerrado ? 'cofre' : 'cofre_abierto', luz: Math.max(0.4, luzEn(o.x, o.z)) });
        if (o.cerrado) continue;
        const piso = pisoEn(o.x, o.z), y = piso + 0.08 + flota + (o.cofre ? 0.22 : 0);
        const rareza = TESORO[o.tesoro]?.rareza || 'comun';
        // pequeños desplazamientos hacia el jugador (o lejos de él) para que nada parpadee al cruzarse
        const dx = j.x - o.x, dz = j.z - o.z, dl = Math.hypot(dx, dz) || 1;
        const hacia = k => [o.x + dx / dl * k, o.z + dz / dl * k];
        if (rareza !== 'comun') {
          const [hx, hz] = hacia(-0.05);
          s.push({ x: hx, z: hz, y: y - 0.06, ancho: 0.66, alto: 0.66, tex: `halo_${rareza}_${Math.floor(this.tiempo * 3 + o.fase) % 2}`, luz: 1.2 });
        }
        s.push({ x: o.x, z: o.z, y, ancho: 0.55, alto: 0.55, tex: 'tesoro_' + o.tesoro, luz: Math.max(0.3, luzEn(o.x, o.z)) });
        const n = { comun: 1, raro: 1, epico: 2, legendario: 3 }[rareza];
        for (let i = 0; i < n; i++) {
          const t = this.tiempo * 1.6 + o.fase + i * 2.1;
          const ciclo = t % 3;
          if (ciclo > 1) continue; // cada destello vive un tercio del ciclo
          const [px, pz] = hacia(0.06);
          const ang = Math.floor(t / 3) * 2.4 + i;
          s.push({ x: px + Math.cos(ang) * 0.16 * (dz / dl), z: pz - Math.cos(ang) * 0.16 * (dx / dl), y: y + 0.15 + Math.sin(ang) * 0.16, ancho: 0.16, alto: 0.16, tex: 'destello_' + Math.min(3, Math.floor(ciclo * 4)), luz: 1.3 });
        }
      }
      else s.push({ x: o.x, z: o.z, y: pisoEn(o.x, o.z), ancho: 0.5, alto: 0.5, tex: o.tipo, luz: Math.max(0.5, luzEn(o.x, o.z)) });
    }
    for (const e of this.enemigos) {
      if (e.estado === 'oculto') continue;
      const tam = e.tam || 1;
      let pose, y = e.y;
      if (e.estado === 'surge') {
        const falta = Math.max(0, e.t / SURGE);
        if (e.tipo === 'arana') {
          // baja del techo colgada de su hilo
          const techo = m.celda(Math.floor(e.x), Math.floor(e.z))?.techoY ?? e.y + 1.25;
          y = e.y + (techo - e.y - tam * 0.5) * falta * falta;
          const largo = techo - (y + tam * 0.8);
          if (largo > 0.02) s.push({ x: e.x, z: e.z, y: y + tam * 0.8, ancho: 0.06, alto: largo, tex: 'hilo', luz: luzEn(e.x, e.z) });
        } else y = e.y - tam * 0.95 * falta;   // sale del suelo
      }
      if (e.estado === 'surge') pose = 2;
      else if (e.estado === 'muerto') pose = e.tMuerte < 0.14 ? 5 : e.tMuerte < 0.3 ? 6 : 4;
      else if (e.estado === 'lanza') pose = 7;
      else if (e.estado === 'dolor') pose = 3;
      else if (e.estado === 'ataca' || e.estado === 'embiste') pose = 2;
      else if (e.estado === 'dormido') pose = 0;
      else pose = [0, 8, 1, 8][Math.floor(e.anim * (e.vel * 6)) % 4];
      s.push({ x: e.x, z: e.z, y, ancho: tam, alto: tam, tex: `${e.tipo}_${pose}`, luz: e.golpe > 0 ? 1.3 : luzEn(e.x, e.z), espejo: pose < 2 && Math.floor(e.anim * 1.3) % 2 === 1 && false });
    }
    // flechas y dardos se dibujan apuntando arriba a la derecha: si cruzan la vista hacia la izquierda, se voltean
    const yaw = this.j.yaw, haciaIzq = (vx, vz) => vx * -Math.sin(yaw) + vz * Math.cos(yaw) < 0;
    for (const f of this.proyectiles) s.push(f.flecha
      ? { x: f.x, z: f.z, y: f.y - 0.1, ancho: 0.22, alto: 0.22, tex: 'flecha', luz: luzEn(f.x, f.z), espejo: haciaIzq(f.vx, f.vz) }
      : { x: f.x, z: f.z, y: f.y - 0.15, ancho: 0.3, alto: 0.3, tex: 'fuego_' + (Math.floor(this.tiempo * 12) % 2), luz: 1.3 });
    for (const d of this.dardos) {
      const a = this.dardoEn(d);
      if (a) s.push({ x: a.x, z: a.z, y: a.y - 0.08, ancho: 0.16, alto: 0.16, tex: 'dardo', luz: luzEn(a.x, a.z), espejo: haciaIzq(d.dx, d.dz) });
    }
    for (const r of this.rocas) {
      const a = this.rocaEn(r);
      s.push({ x: a.x, z: a.z, y: a.y, ancho: ROCAS.tam, alto: ROCAS.tam, tex: 'roca_' + (Math.floor(this.tiempo * 6 * (a.avanza ? 1 : -1)) & 3), luz: luzEn(a.x, a.z) });
    }
    const parpadeo = this.tiempo * 9;
    for (const l of this.llamas) {
      if (Math.abs(l.x - j.x) > 14 || Math.abs(l.z - j.z) > 14) continue;
      const k = Math.floor(parpadeo + l.fase) % 3;
      const crece = 1 + Math.sin(this.tiempo * 13 + l.fase) * 0.06;
      s.push({ x: l.x, z: l.z, y: l.y, ancho: 0.24 * crece, alto: 0.34 * crece, tex: 'llama_' + k, luz: 1.3 });
    }
    for (const b of this.brasas) s.push({ x: b.x, z: b.z, y: b.y, ancho: 0.035, alto: 0.035, tex: 'brasa', luz: 1.3 });
    for (const q of this.motas) s.push({ x: q.x, z: q.z, y: q.y, ancho: 0.025, alto: 0.025, tex: 'mota', luz: luzEn(q.x, q.z) });
    for (const d of this.decorado) {
      if (Math.abs(d.x - j.x) > 16 || Math.abs(d.z - j.z) > 16) continue;
      const tex = d.tex === 'deco_velas' ? 'deco_velas_' + (Math.floor(this.tiempo * 5 + d.fase) % 2) : d.tex;
      s.push({ x: d.x, z: d.z, y: d.y, ancho: d.tam, alto: d.tam, tex, luz: d.tex === 'deco_velas' ? 1.2 : luzEn(d.x, d.z) });
    }
    for (const q of this.particulas) s.push({ x: q.x, z: q.z, y: q.y - q.tam / 2, ancho: q.tam, alto: q.tam, tex: q.tex, luz: q.tex === 'chispa' ? 1.3 : luzEn(q.x, q.z) });
    return s;
  }
}

export { ARMAS, ALTO_MURO };
