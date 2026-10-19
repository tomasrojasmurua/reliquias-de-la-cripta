// Estado y reglas de una partida dentro de una mazmorra.

import { cargarMazmorra } from './mapa.js';
import { ALTO_MURO } from './render.js';
import { sonar } from './audio.js';
import { explorar } from './automapa.js';
import { TESORO, RAREZAS } from '../datos/tesoros.js';

const RADIO_JUGADOR = 0.24;
const OJO = 0.64;
const VEL = 3.0, GIRO_TECLAS = 2.4;
const MAX_CABECEO = 0.45;
const PASO = 0.45;            // el escalón más alto que se sube caminando
const CAIDA_ENEMIGO = 0.5;    // los enemigos tampoco bajan desniveles mayores

const ENEMIGOS = {
  momia: { vida: 60, vel: 1.05, daño: [8, 14], alcance: 0.95, espera: 1.2, vista: 11 },
  esqueleto: { vida: 35, vel: 1.8, daño: [5, 9], alcance: 0.9, espera: 0.8, vista: 13 },
  draugr: { vida: 75, vel: 1.25, daño: [9, 15], alcance: 1.0, espera: 1.3, vista: 11 },
  pirata: { vida: 45, vel: 1.7, daño: [7, 12], alcance: 1.05, espera: 0.9, vista: 13 },
  jaguar: { vida: 50, vel: 2.3, daño: [8, 13], alcance: 0.95, espera: 0.9, vista: 14 },
  // los sectarios además lanzan bolas de fuego desde lejos (se pueden esquivar)
  sectario: { vida: 40, vel: 1.9, daño: [8, 13], alcance: 0.95, espera: 0.9, vista: 13, fuego: [9, 14] },
  caballero: { vida: 95, vel: 1.1, daño: [12, 18], alcance: 1.1, espera: 1.3, vista: 12 },
};

// Pinchos: suben durante ARRIBA segundos de cada CICLO, desfasados por columna.
const PINCHOS = { ciclo: 2.4, arriba: 0.9, daño: 15 };
export function pinchosArriba(x, t) {
  return ((t + x * 0.55) % PINCHOS.ciclo) < PINCHOS.arriba;
}

const ARMAS = {
  latigo: { nombre: 'Látigo', espera: 0.55, alcance: 1.9, daño: [14, 22] },
  revolver: { nombre: 'Revólver', espera: 0.42, alcance: 40, daño: [30, 48] },
};

const azar = ([a, b]) => a + Math.random() * (b - a);

// Qué salpica cada enemigo al recibir un golpe.
const SALPICA = { momia: 'polvo', esqueleto: 'hueso', draugr: 'polvo', pirata: 'hueso', jaguar: 'sangre', sectario: 'sangre', caballero: 'chispa' };
const VEL_FUEGO = 5.5;

export class Juego {
  constructor(def, eventos, semilla) {
    this.def = def;
    this.mapa = cargarMazmorra(def, semilla);
    this.ev = eventos; // {mensaje, tesoro, daño, abrirTablilla, salida, muerte}
    const m = this.mapa;
    this.j = {
      x: m.inicio.x, z: m.inicio.z, y: m.piso(Math.floor(m.inicio.x), Math.floor(m.inicio.z)), yaw: def.angulo || 0, cabeceo: 0,
      vida: 100, arma: 'latigo', tieneRevolver: false, tambor: 0, reserva: 0,
      espera: 0, recargando: 0, ataque: 0, paso: 0, muerto: false,
    };
    this.enemigos = m.enemigos.map(e => ({ ...e, y: m.piso(Math.floor(e.x), Math.floor(e.z)), ...ENEMIGOS[e.tipo], vidaMax: ENEMIGOS[e.tipo].vida, estado: 'dormido', t: 0, espera: 0, anim: Math.random() * 2 }));
    this.objetos = m.objetos.map(o => ({ ...o, fase: Math.random() * 6 }));
    this.tesoros = [];
    this.secretos = 0;
    this.abatidos = 0;
    this.ayudas = 0;
    this.tiempo = 0;
    this.fogonazo = 0;
    this.particulas = [];
    this.proyectiles = [];
    this.terminado = false;
    this.totalTesoros = this.objetos.filter(o => o.tipo === 'tesoro').length;
    // zonas: cuántas reliquias tiene cada una (para el HUD y el automapa)
    this.zonas = (m.regiones || []).map((r, i) => ({ nombre: r.nombre, total: this.objetos.filter(o => o.tipo === 'tesoro' && o.zona === i).length, halladas: 0 }));
    this.derrumbe = def.derrumbe ? 1.1 : 0;   // la entrada se viene abajo poco después de entrar
    this.temblor = 0;
    this.salidaVista = false;
    this.prepararAmbiente();
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
      if (c.tipo !== 'suelo' || c.trampa || c.peligro || ocupada.has(x + ',' + z)) continue;
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
    if (j.muerto) return;

    j.yaw += ent.giro + ent.giroTeclas * GIRO_TECLAS * dt;
    j.cabeceo = Math.max(-MAX_CABECEO, Math.min(MAX_CABECEO, j.cabeceo + ent.cabeceo));
    if (ent.nivelar) j.cabeceo *= Math.max(0, 1 - dt * 2.5);
    this.asistir = ent.asistir;
    if (ent.asistir) this.imantar(dt);

    const vel = j.cayendo !== undefined ? 0 : VEL * dt;
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
        const n = Math.min(6 - j.tambor, j.reserva);
        j.tambor += n; j.reserva -= n;
      }
    }

    const p = ent.pulsos;
    if (p.has('arma1')) this.cambiarArma('latigo');
    if (p.has('arma2')) this.cambiarArma('revolver');
    if (p.has('cambiarArma')) this.cambiarArma(j.arma === 'latigo' ? 'revolver' : 'latigo');
    if (p.has('recargar')) this.recargar();
    if (p.has('usar')) this.usar();
    if (ent.disparar) this.atacar();

    this.explorado = (this.explorado || 0) - dt;
    if (this.explorado <= 0) { explorar(this); this.explorado = 0.15; this.buscarSalida(); }
    if (this.derrumbe > 0 && (this.derrumbe -= dt) <= 0) this.derrumbar();
    this.temblor = Math.max(0, this.temblor - dt);
    this.recoger();
    this.peligros(dt);
    this.actualizarEnemigos(dt);
    this.actualizarProyectiles(dt);
    this.actualizarParticulas(dt);
    this.actualizarAmbiente(dt);
  }

  // ---------- Partículas y proyectiles ----------

  // La entrada se derrumba a espaldas del jugador: polvo, piedras, temblor y ya no hay vuelta atrás.
  derrumbar() {
    const [x, z] = this.def.derrumbe;
    const j = this.j, cx = x + 0.5, cz = z + 0.5;
    const dx = j.x - cx, dz = j.z - cz, d = Math.hypot(dx, dz) || 1;
    const px = cx + dx / d * 0.6, pz = cz + dz / d * 0.6;
    for (let k = 0; k < 4; k++) setTimeout(() => this.salpicar(px, 0.4 + k * 0.25, pz, 'polvo', 10, 2.2), k * 120);
    sonar('caida'); setTimeout(() => sonar('golpe'), 180); setTimeout(() => sonar('caida'), 420);
    this.temblor = 1.2;
    this.ev.vibrar?.(220);
    this.ev.mensaje('¡La entrada se derrumba a tus espaldas! Tendrás que encontrar otra salida.', 5);
  }

  // La salida no tiene antorcha: hay que toparse con ella. Al verla queda marcada en el automapa.
  buscarSalida() {
    if (this.salidaVista || !this.def.derrumbe) return;
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

  lanzarFuego(e) {
    const j = this.j;
    const dx = j.x - e.x, dz = j.z - e.z, d = Math.hypot(dx, dz);
    this.proyectiles.push({ x: e.x + dx / d * 0.4, z: e.z + dz / d * 0.4, y: e.y + 0.55, vx: dx / d * VEL_FUEGO, vz: dz / d * VEL_FUEGO, daño: e.fuego, vida: 4 });
    sonar('fuego');
  }

  actualizarProyectiles(dt) {
    const j = this.j, m = this.mapa;
    for (const f of this.proyectiles) {
      f.vida -= dt;
      f.x += f.vx * dt; f.z += f.vz * dt;
      const cx = Math.floor(f.x), cz = Math.floor(f.z);
      if (m.solida(cx, cz) || m.piso(cx, cz) > f.y) {
        f.vida = 0; this.salpicar(f.x - f.vx * 0.02, f.y, f.z - f.vz * 0.02, 'chispa', 8); sonar('golpe');
      } else if (!j.muerto && Math.hypot(f.x - j.x, f.z - j.z) < 0.38 && Math.abs(f.y - (j.y + 0.5)) < 0.7) {
        f.vida = 0; this.salpicar(f.x, f.y, f.z, 'chispa', 8);
        this.dañarJugador(azar(f.daño), 'Te alcanzó una bola de fuego.');
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

  // De 0 a 1: cuántos enemigos te persiguen de cerca (para la música).
  tension() {
    let n = 0;
    for (const e of this.enemigos) if ((e.estado === 'caza' || e.estado === 'ataca' || e.estado === 'lanza') && Math.hypot(e.x - this.j.x, e.z - this.j.z) < 12) n++;
    return Math.min(1, n / 2.5);
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

  cambiarArma(a) {
    const j = this.j;
    if (a === 'revolver' && !j.tieneRevolver) { this.ev.mensaje('Aún no tienes el revólver.'); return; }
    if (j.arma !== a) { j.arma = a; j.espera = 0.3; j.recargando = 0; }
  }

  recargar() {
    const j = this.j;
    if (j.arma !== 'revolver' || j.recargando > 0 || j.tambor === 6) return;
    if (!j.reserva) { this.ev.mensaje('No te quedan balas.'); return; }
    j.recargando = 1.1; sonar('recarga');
  }

  atacar() {
    const j = this.j;
    if (j.espera > 0 || j.recargando > 0) return;
    const arma = ARMAS[j.arma];
    if (j.arma === 'revolver') {
      if (!j.tambor) {
        if (j.reserva) this.recargar(); else { sonar('vacio'); j.espera = 0.3; }
        return;
      }
      j.tambor--;
      sonar('disparo');
      this.fogonazo = 1;
      this.ev.vibrar?.(18);
      // el ruido despierta a los enemigos cercanos
      for (const e of this.enemigos) if (e.estado === 'dormido' && Math.hypot(e.x - j.x, e.z - j.z) < 12) e.estado = 'caza';
    } else {
      sonar('latigo');
    }
    j.espera = arma.espera; j.ataque = arma.espera;

    // Impacto: el enemigo más cercano dentro del cono, antes del primer muro (puntería automática vertical, como en Doom).
    const fx = Math.cos(j.yaw), fz = Math.sin(j.yaw);
    const muro = this.rayo(j.x, j.z, fx, fz, arma.alcance).dist;
    let mejor = null, mejorD = Infinity;
    for (const e of this.enemigos) {
      if (e.estado === 'muerto') continue;
      const ex = e.x - j.x, ez = e.z - j.z;
      const a = ex * fx + ez * fz;
      const lat = Math.abs(ex * fz - ez * fx);
      const cono = (0.32 + a * 0.02) * (this.asistir ? 1.8 : 1);
      if (a > 0 && a < Math.min(muro, arma.alcance) && lat < cono && a < mejorD) { mejor = e; mejorD = a; }
    }
    if (mejor) this.herir(mejor, azar(arma.daño));
    else if (muro < arma.alcance) {
      // impacto en el muro: polvo (y chispas si es una bala)
      const d = muro - 0.05;
      const ix = j.x + fx * d, iz = j.z + fz * d, iy = j.y + OJO + Math.tan(j.cabeceo) * d;
      this.salpicar(ix, iy, iz, 'polvo', 4, 0.8);
      if (j.arma === 'revolver') this.salpicar(ix, iy, iz, 'chispa', 3, 1.2);
      else setTimeout(() => sonar('golpe'), 90);
    }
  }

  // Puntería asistida (táctil): la vista se desliza suavemente hacia el enemigo
  // despierto más cercano que esté casi en la mira.
  imantar(dt) {
    const j = this.j;
    let mejor = null, mejorD = 14;
    for (const e of this.enemigos) {
      if (e.estado === 'muerto' || e.estado === 'dormido') continue;
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
    const h = this.rayo(j.x, j.z, Math.cos(j.yaw), Math.sin(j.yaw), 1.4);
    if (h.dist >= 1.4) return false;
    const c = this.mapa.celda(h.cx, h.cz);
    return !!c && (['tablilla', 'aviso', 'salida', 'sello'].includes(c.tipo) || (c.tipo === 'puerta' && !c.abriendo));
  }

  herir(e, daño) {
    e.vida -= daño;
    e.golpe = 0.12;
    this.salpicar(e.x, e.y + 0.55, e.z, SALPICA[e.tipo] || 'polvo', 7);
    if (e.vida <= 0) {
      e.estado = 'muerto'; e.tMuerte = 0; this.abatidos++; sonar('muerteEnemigo');
    } else {
      e.estado = 'dolor'; e.t = 0.25; sonar('dolorEnemigo');
    }
  }

  usar() {
    const j = this.j, m = this.mapa;
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
      sonar('sellado');
      const a = m.acertijos[c.acertijo];
      this.ev.mensaje(`Un sello antiguo bloquea el paso. Busca «${a.titulo}».`);
    }
    else if (c.tipo === 'tablilla') {
      const a = m.acertijos[c.acertijo];
      if (a.resuelto) this.ev.mensaje('Ya descifraste esta inscripción.');
      else this.ev.abrirTablilla(a);
    }
    else if (c.tipo === 'aviso') this.ev.mensaje(`«${c.texto}»`, 6);
    else if (c.tipo === 'salida') this.salir();
  }

  resolverAcertijo(a) {
    a.resuelto = true;
    for (const c of this.mapa.celdas) if (c.tipo === 'sello' && c.acertijo === a.id) c.abriendo = true;
    sonar('puerta');
    this.ev.mensaje('Se oye un mecanismo antiguo. El sello se abre.');
  }

  salir() {
    this.terminado = true;
    this.ev.salida(this.resumen());
  }

  resumen(causa = null) {
    return {
      causa,
      mazmorra: this.def, tesoros: this.tesoros, totalTesoros: this.totalTesoros,
      secretos: this.secretos, totalSecretos: this.mapa.totalSecretos,
      abatidos: this.abatidos, totalEnemigos: this.enemigos.length, tiempo: this.tiempo,
      acertijos: Object.values(this.mapa.acertijos).filter(a => a.resuelto).length,
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
      if (o.cogido || Math.hypot(o.x - j.x, o.z - j.z) > 0.55) continue;
      if (o.tipo === 'revolver') {
        o.cogido = true; j.tieneRevolver = true; j.tambor = 6; j.arma = 'revolver'; j.espera = 0.4;
        sonar('recoger'); this.ev.mensaje('¡Encontraste tu revólver! Cargado con 6 balas.');
      } else if (o.tipo === 'balas') {
        if (j.reserva >= 60) continue;
        o.cogido = true; j.reserva = Math.min(60, j.reserva + 12);
        sonar('recoger'); this.ev.mensaje('Una caja de balas (+12).');
      } else if (o.tipo === 'vendas') {
        if (j.vida >= 100) continue;
        o.cogido = true; j.vida = Math.min(100, j.vida + 25);
        sonar('recoger'); this.ev.mensaje('Vendas (+25 de vida).');
      } else if (o.tipo === 'falso') {
        o.cogido = true;
        sonar('error');
        this.dañarJugador(45, 'Elegiste mal.');
        if (!j.muerto) this.ev.mensaje('Elegiste mal: ese cáliz era una trampa y se convierte en polvo.', 4);
      } else if (o.tipo === 'tesoro') {
        o.cogido = true;
        const t = TESORO[o.tesoro];
        this.tesoros.push(t.id);
        sonar('tesoro');
        this.ev.tesoro(t, RAREZAS[t.rareza]);
        const z = this.zonas[o.zona];
        if (z && ++z.halladas === z.total) setTimeout(() => this.ev.mensaje(`${z.nombre}: reuniste todas sus reliquias.`, 4), 2200);
      }
    }
  }

  actualizarEnemigos(dt) {
    const j = this.j;
    for (const e of this.enemigos) {
      e.golpe = Math.max(0, (e.golpe || 0) - dt);
      if (e.estado === 'muerto') { e.tMuerte += dt; continue; }
      e.anim += dt;
      e.espera = Math.max(0, e.espera - dt);
      const dx = j.x - e.x, dz = j.z - e.z, d = Math.hypot(dx, dz);
      if (e.estado === 'dormido') {
        if (d < e.vista && this.seVe(e, j)) { e.estado = 'caza'; sonar('gruñido'); }
        continue;
      }
      if (e.estado === 'dolor') { e.t -= dt; if (e.t <= 0) e.estado = 'caza'; continue; }
      if (e.estado === 'lanza') {
        e.t -= dt;
        if (e.t <= 0) { if (this.seVe(e, j)) this.lanzarFuego(e); e.estado = 'caza'; }
        continue;
      }
      if (e.estado === 'ataca') {
        e.t -= dt;
        if (e.t <= 0) {
          if (d < e.alcance + 0.25 && Math.abs(e.y - j.y) < 0.7) this.dañarJugador(azar(e.daño), 'Has caído en la cripta.');
          e.estado = 'caza'; e.espera = e.espera || 0.6;
        }
        continue;
      }
      // caza
      if (d < e.alcance && e.espera <= 0 && Math.abs(e.y - j.y) < 0.7) {
        e.estado = 'ataca'; e.t = 0.45; e.espera = 0.45 + 0.8; sonar('ataque');
        continue;
      }
      const loVe = this.seVe(e, j);
      if (loVe) e.visto = { x: j.x, z: j.z };
      if (e.fuego && loVe && d > 2.2 && d < 11 && e.espera <= 0 && Math.random() < dt * 0.9) {
        e.estado = 'lanza'; e.t = 0.5; e.espera = 2.2 + Math.random() * 1.5;
        continue;
      }
      const meta = e.visto || j;
      const mx = meta.x - e.x, mz = meta.z - e.z, ml = Math.hypot(mx, mz);
      if (ml > 0.6) {
        const v = e.vel * dt;
        this.mover(e, mx / ml * v, mz / ml * v, 0.28, true);
      } else e.visto = null;
      // separación entre enemigos
      for (const o of this.enemigos) {
        if (o === e || o.estado === 'muerto') continue;
        const sx = e.x - o.x, sz = e.z - o.z, sd = Math.hypot(sx, sz);
        if (sd > 0 && sd < 0.6) this.mover(e, sx / sd * (0.6 - sd) * 0.5, sz / sd * (0.6 - sd) * 0.5, 0.28, true);
      }
      this.apoyar(e, 0.28, dt);
      if (Math.random() < dt * 0.08) sonar('gruñido');
    }
  }

  dañarJugador(n, causa = 'Has caído en la cripta.') {
    const j = this.j;
    if (j.muerto) return;
    j.vida = Math.max(0, j.vida - Math.round(n));
    sonar('dolor');
    this.ev.daño();
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
      if (o.cogido) continue;
      const flota = Math.sin(this.tiempo * 2 + o.fase) * 0.03;
      if (o.tipo === 'falso') s.push({ x: o.x, z: o.z, y: pisoEn(o.x, o.z) + 0.08 + flota, ancho: 0.55, alto: 0.55, tex: o.x % 2 < 1 ? 'tesoro_caliz_oro' : 'tesoro_corona_oro', luz: Math.max(0.3, luzEn(o.x, o.z)) });
      else if (o.tipo === 'tesoro') {
        const piso = pisoEn(o.x, o.z), y = piso + 0.08 + flota;
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
    for (let z = 0; z < m.alto; z++) for (let x = 0; x < m.ancho; x++) {
      const c = m.celdas[z * m.ancho + x];
      if (c.trampa === 'pinchos' && pinchosArriba(x, this.tiempo)) s.push({ x: x + 0.5, z: z + 0.5, y: c.piso, ancho: 0.95, alto: 0.45, tex: 'pinchos', luz: c.luz });
    }
    for (const e of this.enemigos) {
      let pose;
      if (e.estado === 'muerto') pose = e.tMuerte < 0.14 ? 5 : e.tMuerte < 0.3 ? 6 : 4;
      else if (e.estado === 'lanza') pose = 7;
      else if (e.estado === 'dolor') pose = 3;
      else if (e.estado === 'ataca') pose = 2;
      else if (e.estado === 'dormido') pose = 0;
      else pose = [0, 8, 1, 8][Math.floor(e.anim * (e.vel * 6)) % 4];
      s.push({ x: e.x, z: e.z, y: e.y, ancho: 1.0, alto: 1.0, tex: `${e.tipo}_${pose}`, luz: e.golpe > 0 ? 1.3 : luzEn(e.x, e.z), espejo: pose < 2 && Math.floor(e.anim * 1.3) % 2 === 1 && false });
    }
    for (const f of this.proyectiles) s.push({ x: f.x, z: f.z, y: f.y - 0.15, ancho: 0.3, alto: 0.3, tex: 'fuego_' + (Math.floor(this.tiempo * 12) % 2), luz: 1.3 });
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
