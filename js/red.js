// Salas para jugar entre amigos: los navegadores se conectan directamente (WebRTC, con PeerJS) y no hay
// servidor propio. El anfitrión es el centro de la sala: los demás le hablan a él y él reparte los mensajes.
// PeerJS solo hace falta para presentar a los navegadores con el código de la sala; después no interviene.

import { SERVIDORES_ICE } from '../datos/red.js';

export const MAX_JUGADORES = 4;
export const COLORES = ['rojo', 'azul', 'verde', 'amarillo'];
export const HZ_POSICION = 12;

const PREFIJO = 'reliquias-';
const LETRAS = 'ABCDEFGHJKMNPQRSTUVWXYZ';   // sin I, L ni O para que el código no se confunda al dictarlo
const ESPERA_CONEXION = 12000;
const SILENCIO = 12000;     // sin saber nada del otro lado durante tanto, se da por perdido (cerrar la pestaña no siempre avisa)
const RECONEXION = 25000;   // lo que se insiste en volver a la sala si se corta la conexión en plena partida

// Los que usa PeerJS si no se le dice otra cosa (STUN de Google y los TURN gratuitos y compartidos de PeerJS).
const ICE_PREDETERMINADOS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: ['turn:eu-0.turn.peerjs.com:3478', 'turn:us-0.turn.peerjs.com:3478'], username: 'peerjs', credential: 'peerjsp' },
];

export const codigoValido = c => /^[A-Z]{4}$/.test(c);
export const normalizarCodigo = c => String(c || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
const limpiarNombre = (n, i) => String(n || '').replace(/[<>&"']/g, '').trim().slice(0, 16) || `Cazador ${i + 1}`;

// El servidor que presenta a los navegadores: el gratuito de PeerJS, o el de `?senal=host:puerto` (pruebas o uno propio).
function opcionesSenal() {
  const q = new URLSearchParams(location.search);
  const o = {};
  const s = q.get('senal');
  if (s) { const [host, puerto] = s.split(':'); Object.assign(o, { host, port: +puerto || 9000, path: '/', secure: false }); }
  // `?turn=turn:host:3478|usuario|clave` agrega un relevo propio (pruebas); `datos/red.js` es el lugar fijo
  const extra = [...SERVIDORES_ICE];
  const [urls, username, credential] = (q.get('turn') || '').split('|');
  if (urls) extra.push({ urls, username, credential });
  if (extra.length) o.config = { iceServers: [...ICE_PREDETERMINADOS, ...extra] };
  return o;
}

let cargando = null;
function cargarPeerJS() {
  if (window.Peer) return Promise.resolve();
  cargando ||= new Promise((ok, mal) => {
    const s = document.createElement('script');
    s.src = new URL('vendor/peerjs.min.js', import.meta.url).href;
    s.onload = ok;
    s.onerror = () => { cargando = null; mal(new Error('No se pudo cargar la conexión. ¿Tienes internet?')); };
    document.head.appendChild(s);
  });
  return cargando;
}

// Una sala, vista desde el anfitrión (`soyAnfitrion`) o desde un invitado. Los avisos llegan por estos ganchos:
//   alCambiar(jugadores)   la lista cambió: [{ id, nombre, color, estado }]; `id` es el puesto (0 = anfitrión)
//   alEmpezar(partida)     el anfitrión empezó: { semilla, mazmorra, tamano, limite, cuenta, tesoros }
//   alPosicion(id, p)      un cazador se movió: { x, y, z, yaw, pt }
//   alTesoro(i, id)        el tesoro `i` se lo llevó el cazador `id` (puede ser yo, o llegué tarde)
//   alSuelto(i, x, z)      el tesoro `i` volvió al suelo en (x, z)
//   alEnlace(enLinea)      (invitado) se cortó la conexión con el anfitrión (false) o volvió (true)
//   alConexion(id, enLinea) otro cazador perdió la conexión o volvió
//   alEmote(id, k)         un cazador mandó el mensaje rápido `k`
//   alEnemigos(s)          (invitado) cómo están los enemigos en el anfitrión
//   alGolpe(i, daño)       (anfitrión) un invitado le pegó al enemigo `i`
//   alDano(n, causa)       (invitado) un enemigo me hirió
//   alForzado(id, a)       el cazador `id` forzó el sello del acertijo `a` con la palanca (solo para avisar: cada uno abre el suyo)
//   alMarcador(lista)      resultados finales: [{ id, nombre, color, puntos, estado, tesoros, resueltos }]
//   alPerderse(motivo)     se cayó la conexión con la sala
export class Sala {
  constructor(peer, soyAnfitrion, codigo) {
    this.peer = peer;
    this.soyAnfitrion = soyAnfitrion;
    this.codigo = codigo;
    this.yo = 0;
    this.jugadores = [];        // el anfitrión es la fuente; los invitados reciben una copia
    this.config = null;         // lo que el anfitrión eligió: { mazmorra, tamano, limite }
    this.conexiones = new Map(); // puesto -> conexión (solo el anfitrión)
    this.enPartida = false;
    this.cerrada = false;
    this.duenos = new Map();     // solo el anfitrión: tesoro -> quién se lo llevó
    this.fichas = new Map();     // solo el anfitrión: puesto -> ficha secreta con la que el invitado puede volver tras un corte
    this.caidos = new Map();     // solo el anfitrión: puesto -> plazo para que vuelva el invitado que perdió la conexión
    this.ficha = Math.random().toString(36).slice(2) + Date.now().toString(36);   // la mía, si soy invitado
    this.visto = new Map();      // anfitrión: puesto -> última vez que se supo de él
    this.vistoHost = Date.now(); // invitado: última vez que se supo del anfitrión
    this.alEnlace = this.alConexion = this.alEmote = () => {};
    this.alCambiar = this.alEmpezar = this.alPosicion = this.alMarcador = this.alPerderse = this.alTesoro = this.alSuelto = this.alEnemigos = this.alGolpe = this.alDano = this.alForzado = () => {};
  }

  // ---------- Crear y unirse ----------

  static async crear(nombre) {
    await cargarPeerJS();
    for (let intento = 0; intento < 6; intento++) {
      const codigo = Array.from({ length: 4 }, () => LETRAS[Math.floor(Math.random() * LETRAS.length)]).join('');
      try {
        const peer = await abrirPeer(PREFIJO + codigo);
        const sala = new Sala(peer, true, codigo);
        sala.jugadores = [{ id: 0, nombre: limpiarNombre(nombre, 0), color: COLORES[0], estado: 'sala', puntos: 0 }];
        peer.on('connection', c => sala.#recibir(c));
        sala.#vigilar();
        peer.on('disconnected', () => { if (!sala.cerrada) peer.reconnect(); });
        return sala;
      } catch (e) {
        if (e.type !== 'unavailable-id') throw errorLegible(e);   // el código ya estaba en uso: se prueba otro
      }
    }
    throw new Error('No se pudo crear la sala. Inténtalo de nuevo.');
  }

  static async unirse(codigo, nombre) {
    await cargarPeerJS();
    const peer = await abrirPeer().catch(e => { throw errorLegible(e); });
    const sala = new Sala(peer, false, codigo);
    sala.nombre = nombre;
    peer.on('disconnected', () => { if (!sala.cerrada && !peer.destroyed) peer.reconnect(); });
    await sala.#conectar().catch(e => { peer.destroy(); throw e; });
    sala.#vigilar();
    return sala;
  }

  // Cada 3 segundos un latido en las dos direcciones, y se da por perdido a quien calla demasiado.
  #vigilar() {
    let n = 0;
    this.vigilante = setInterval(() => {
      const ahora = Date.now();
      if (++n % 3 === 0) {
        if (this.soyAnfitrion) this.#aviso({ t: 'latido' });
        else this.conexion?.open && this.conexion.send({ t: 'latido' });
      }
      if (this.soyAnfitrion) {
        for (const [id, c] of [...this.conexiones]) {
          if (ahora - (this.visto.get(id) || ahora) < SILENCIO) continue;
          this.#salio(id);
          c.close();
        }
      } else if (this.conexion && !this.reintentando && ahora - this.vistoHost > SILENCIO) {
        this.conexion.close();
        this.#perdida();
      }
    }, 1000);
  }

  // Habla con el anfitrión y espera que me admita (sirve para entrar y para volver tras un corte).
  #conectar() {
    return new Promise((ok, mal) => {
      const c = this.peer.connect(PREFIJO + this.codigo, { reliable: true });
      const fallo = (msg, motivo) => { clearTimeout(plazo); mal(Object.assign(new Error(msg), { motivo })); };
      const plazo = setTimeout(() => { c.close(); fallo(`No se encontró la sala ${this.codigo}. Revisa el código o pídele al anfitrión que la vuelva a abrir.`); }, ESPERA_CONEXION);
      let admitido = false;
      c.on('open', () => c.send({ t: 'hola', nombre: this.nombre, ficha: this.ficha }));
      c.on('data', m => {
        if (m.t === 'llena' || m.t === 'iniciada') { fallo(m.t === 'llena' ? 'La sala está llena (hasta 4 cazadores).' : 'La partida de esa sala ya empezó.', m.t); return; }
        if (m.t === 'sala' && !admitido) { admitido = true; clearTimeout(plazo); this.conexion = c; ok(); }
        this.#mensajeDelAnfitrion(m);
      });
      c.on('close', () => { if (!admitido) fallo('No se pudo entrar a la sala.'); else if (this.conexion === c) this.#perdida(); });
      c.on('error', () => { if (!admitido) fallo('No se pudo entrar a la sala.'); });
    });
  }

  // Se cortó la conexión con el anfitrión. En la sala de espera no hay a qué volver; en plena partida se insiste un rato.
  async #perdida() {
    if (this.cerrada || this.reintentando) return;
    if (!this.enPartida) { this.#caida('El anfitrión salió de la sala.'); return; }
    this.reintentando = true;
    this.alEnlace(false);
    const hasta = Date.now() + RECONEXION;
    while (!this.cerrada && Date.now() < hasta) {
      try {
        if (this.peer.disconnected && !this.peer.destroyed) this.peer.reconnect();
        await this.#conectar();
        this.reintentando = false;
        this.alEnlace(true);
        return;
      } catch (e) { if (e.motivo === 'iniciada' || e.motivo === 'llena') break; }
      await new Promise(r => setTimeout(r, 2000));
    }
    this.reintentando = false;
    this.#caida('Se perdió la conexión con la sala.');
  }

  // ---------- Anfitrión ----------

  #recibir(c) {
    let id;   // el puesto, una vez admitido
    c.on('data', m => {
      if (id !== undefined) { this.visto.set(id, Date.now()); this.#mensajeDeInvitado(id, m); return; }
      if (m.t !== 'hola') return;
      // un invitado que perdió la conexión en plena partida vuelve a su puesto con su ficha
      const ficha = String(m.ficha || '').slice(0, 40);
      const previo = ficha && [...this.caidos.keys()].find(i => this.fichas.get(i) === ficha);
      if (previo !== undefined) { id = previo; this.#reconectar(id, c); return; }
      if (this.enPartida || this.jugadores.length >= MAX_JUGADORES) {
        c.send({ t: this.enPartida ? 'iniciada' : 'llena' });
        setTimeout(() => c.close(), 400);
        return;
      }
      // el primer puesto libre (sale uno y entra otro: queda con su color)
      id = [...Array(MAX_JUGADORES).keys()].find(i => !this.jugadores.some(j => j.id === i));
      this.conexiones.set(id, c);
      this.visto.set(id, Date.now());
      this.fichas.set(id, ficha);
      this.jugadores.push({ id, nombre: limpiarNombre(m.nombre, id), color: COLORES[id], estado: 'sala', puntos: 0 });
      this.jugadores.sort((a, b) => a.id - b.id);
      c.send({ t: 'sala', yo: id, config: this.config, jugadores: this.jugadores });
      this.#difundirSala();
    });
    const salio = () => { if (id !== undefined && this.conexiones.get(id) === c) this.#salio(id); };
    c.on('close', salio);
    c.on('error', salio);
  }

  // Se fue un invitado. En plena partida se le guarda el puesto un rato por si fue un corte breve.
  #salio(id) {
    const j = this.jugadores.find(q => q.id === id);
    this.conexiones.delete(id);
    if (j && j.estado === 'jugando' && !j.fin) {
      this.caidos.set(id, setTimeout(() => this.#retirar(id), RECONEXION + 5000));
      this.alPosicion(id, null);
      this.alConexion(id, false);
      this.#aviso({ t: 'conexion', id, ok: false });
      return;
    }
    this.#retirar(id);
  }

  #retirar(id) {
    clearTimeout(this.caidos.get(id));
    this.caidos.delete(id);
    this.fichas.delete(id);
    this.jugadores = this.jugadores.filter(j => j.id !== id);
    this.#difundirSala();
    this.alPosicion(id, null);
    this.#aviso({ t: 'sale', id });
  }

  #reconectar(id, c) {
    clearTimeout(this.caidos.get(id));
    this.caidos.delete(id);
    this.conexiones.set(id, c);
    this.visto.set(id, Date.now());
    c.send({ t: 'sala', yo: id, config: this.config, jugadores: this.jugadores });
    c.send({ t: 'tomados', l: [...this.duenos] });   // los tesoros que ya se llevaron mientras no estaba
    this.alConexion(id, true);
    this.#aviso({ t: 'conexion', id, ok: true }, id);
  }

  #mensajeDeInvitado(id, m) {
    if (m.t === 'emote') {
      const k = Math.min(3, Math.max(0, m.k | 0));
      this.alEmote(id, k);
      this.#aviso({ t: 'emote', id, k }, id);
    } else if (m.t === 'p') {
      const p = { x: +m.x, y: +m.y, z: +m.z, yaw: +m.yaw, pt: m.pt | 0, m: m.m | 0 };
      this.alPosicion(id, p);
      this.#aviso({ t: 'p', id, ...p }, id);
    } else if (m.t === 'estado') {
      const j = this.jugadores.find(q => q.id === id);
      if (j && ['sala', 'jugando'].includes(m.e)) { j.estado = m.e; this.#difundirSala(); }
    } else if (m.t === 'fin') {
      this.#registrarFin(id, m);
    } else if (m.t === 'golpe') {
      this.alGolpe(m.i | 0, Math.min(60, Math.max(0, m.d | 0)));
    } else if (m.t === 'toma') {
      this.#reclamar(m.i | 0, id);
    } else if (m.t === 'suelta') {
      this.#soltado(m.i | 0, +m.x, +m.z, id);
    } else if (m.t === 'forzo') {
      const a = String(m.a).slice(0, 40);
      this.alForzado(id, a);
      this.#aviso({ t: 'forzo', id, a }, id);
    }
  }

  // Quien pide primero se lleva el tesoro; el que llega tarde recibe el nombre del dueño.
  #reclamar(i, id) {
    const dueno = this.duenos.get(i);
    if (dueno === id) return;
    if (dueno !== undefined) {
      if (id === 0) this.alTesoro(i, dueno);
      else this.conexiones.get(id)?.send({ t: 'tomado', i, id: dueno });
      return;
    }
    this.duenos.set(i, id);
    this.#aviso({ t: 'tomado', i, id });
    this.alTesoro(i, id);
  }

  #soltado(i, x, z, desde) {
    this.duenos.delete(i);
    this.#aviso({ t: 'suelto', i, x, z }, desde);
    if (desde !== 0) this.alSuelto(i, x, z);
  }

  // Manda a todos los invitados (menos `salvo`).
  #aviso(m, salvo = -1) {
    for (const [id, c] of this.conexiones) if (id !== salvo && c.open) c.send(m);
  }

  #difundirSala() {
    this.#aviso({ t: 'sala', config: this.config, jugadores: this.jugadores });
    this.alCambiar(this.jugadores);
  }

  ponerConfig(config) {
    this.config = config;
    this.#difundirSala();
  }

  empezar(partida) {
    this.enPartida = true;
    this.duenos.clear();
    for (const j of this.jugadores) { j.estado = 'jugando'; j.puntos = 0; j.fin = null; j.tesoros = j.resueltos = null; }
    this.#aviso({ t: 'empezar', ...partida });
    this.alEmpezar(partida);
  }

  #registrarFin(id, m) {
    const j = this.jugadores.find(q => q.id === id);
    if (!j) return;
    j.puntos = m.puntos | 0;
    j.fin = m.escapo ? 'escapó' : 'atrapado';
    const ids = l => (Array.isArray(l) ? l : []).slice(0, 80).map(x => String(x).slice(0, 40));
    j.tesoros = ids(m.tesoros); j.resueltos = ids(m.resueltos);
    this.#difundirMarcador();
  }

  #difundirMarcador() {
    const lista = this.jugadores.map(({ id, nombre, color, puntos, fin, tesoros, resueltos }) => ({ id, nombre, color, puntos, estado: fin || 'jugando', tesoros, resueltos }));
    this.#aviso({ t: 'marcador', lista });
    this.alMarcador(lista);
  }

  // ---------- Invitado ----------

  #mensajeDelAnfitrion(m) {
    this.vistoHost = Date.now();
    if (m.t === 'sala') {
      if (m.yo !== undefined) this.yo = m.yo;
      this.jugadores = m.jugadores;
      this.config = m.config;
      this.alCambiar(this.jugadores);
    } else if (m.t === 'empezar') {
      this.enPartida = true;
      this.alEmpezar(m);
    } else if (m.t === 'p') {
      this.alPosicion(m.id, m);
    } else if (m.t === 'sale') {
      this.alPosicion(m.id, null);
    } else if (m.t === 'marcador') {
      this.alMarcador(m.lista);
    } else if (m.t === 'emote') {
      this.alEmote(m.id, m.k | 0);
    } else if (m.t === 'conexion') {
      this.alConexion(m.id, !!m.ok);
    } else if (m.t === 'tomados') {
      for (const [i, id] of Array.isArray(m.l) ? m.l : []) this.alTesoro(i | 0, id | 0);
    } else if (m.t === 'en') {
      this.alEnemigos(m);
    } else if (m.t === 'dano') {
      this.alDano(m.n | 0, String(m.c || '').slice(0, 60));
    } else if (m.t === 'tomado') {
      this.alTesoro(m.i, m.id);
    } else if (m.t === 'suelto') {
      this.alSuelto(m.i, m.x, m.z);
    } else if (m.t === 'forzo') {
      this.alForzado(m.id, String(m.a));
    }
  }

  // ---------- Los dos ----------

  // Mi posición, unas veces por segundo.
  enviarPosicion(p) {
    const m = { t: 'p', x: +p.x.toFixed(2), y: +p.y.toFixed(2), z: +p.z.toFixed(2), yaw: +p.yaw.toFixed(2), pt: p.pt, m: p.m ? 1 : 0 };
    if (this.soyAnfitrion) this.#aviso({ ...m, id: 0 });
    else this.conexion?.open && this.conexion.send(m);
  }

  // El anfitrión reparte dónde está cada enemigo (unas 10 veces por segundo).
  enviarEnemigos(s) {
    if (this.soyAnfitrion) this.#aviso({ t: 'en', ...s });
  }

  // Un invitado le pega al enemigo `i`: el anfitrión le resta la vida.
  golpear(i, d) {
    this.conexion?.open && this.conexion.send({ t: 'golpe', i, d });
  }

  // El anfitrión le avisa a un invitado que un enemigo lo hirió.
  danar(id, n, c) {
    this.conexiones.get(id)?.send({ t: 'dano', n, c });
  }

  // Un mensaje rápido (0 a 3) para los demás.
  emote(k) {
    if (this.soyAnfitrion) this.#aviso({ t: 'emote', id: 0, k });
    else this.conexion?.open && this.conexion.send({ t: 'emote', k });
  }

  // Pido el tesoro `i`; la respuesta llega por alTesoro(i, quién se lo llevó).
  tomar(i) {
    if (this.soyAnfitrion) this.#reclamar(i, 0);
    else this.conexion?.open && this.conexion.send({ t: 'toma', i });
  }

  // Solté el tesoro `i` en (x, z): vuelve a estar disponible para todos.
  soltar(i, x, z) {
    if (this.soyAnfitrion) this.#soltado(i, x, z, 0);
    else this.conexion?.open && this.conexion.send({ t: 'suelta', i, x: +x.toFixed(2), z: +z.toFixed(2) });
  }

  // Forcé el sello del acertijo `a` con la palanca: a los demás solo les llega el aviso.
  forzar(a) {
    if (this.soyAnfitrion) this.#aviso({ t: 'forzo', id: 0, a: String(a) });
    else this.conexion?.open && this.conexion.send({ t: 'forzo', a: String(a) });
  }

  // 'sala' (en la sala de espera) o 'jugando'.
  ponerEstado(e) {
    if (this.soyAnfitrion) { this.jugadores[0].estado = e; if (e === 'sala') this.enPartida = false; this.#difundirSala(); }
    else if (e === 'sala') { this.enPartida = false; this.conexion?.open && this.conexion.send({ t: 'estado', e }); }
    else this.conexion?.open && this.conexion.send({ t: 'estado', e });
  }

  // Mi resultado al terminar.
  // `detalle`: los tesoros que reuní y los acertijos que resolví, para el resumen de todos.
  terminar(puntos, escapo, detalle = {}) {
    const m = { puntos, escapo, tesoros: detalle.tesoros, resueltos: detalle.resueltos };
    if (this.soyAnfitrion) this.#registrarFin(0, m);
    else this.conexion?.open && this.conexion.send({ t: 'fin', ...m });
  }

  #caida(motivo) {
    if (this.cerrada) return;
    this.cerrada = true;
    clearInterval(this.vigilante);
    this.alPerderse(motivo);
    this.peer.destroy();
  }

  cerrar() {
    if (this.cerrada) return;
    this.cerrada = true;
    clearInterval(this.vigilante);
    for (const t of this.caidos.values()) clearTimeout(t);
    for (const c of this.conexiones.values()) c.close();
    this.conexion?.close();
    this.peer.destroy();
  }
}

// ---------- Utilidades ----------

function abrirPeer(id) {
  return new Promise((ok, mal) => {
    const peer = new window.Peer(id, opcionesSenal());
    const plazo = setTimeout(() => { peer.destroy(); mal(Object.assign(new Error('timeout'), { type: 'network' })); }, ESPERA_CONEXION);
    const fallo = e => { clearTimeout(plazo); peer.destroy(); mal(e); };
    peer.on('error', fallo);
    peer.on('open', () => {
      clearTimeout(plazo);
      // ya abierto, un error suelto (por ejemplo «no hay nadie con ese código» al reintentar) no debe cerrar el peer
      peer.off('error', fallo);
      peer.on('error', () => {});
      ok(peer);
    });
  });
}

function errorLegible(e) {
  const m = e.type === 'network' || e.type === 'server-error' || e.type === 'socket-error' || e.type === 'socket-closed'
    ? 'No hay conexión con el servidor de salas. Revisa tu internet e inténtalo de nuevo.'
    : e.message || 'No se pudo conectar.';
  return new Error(m);
}

// El enlace que se comparte: abre el juego con el código de la sala ya puesto.
export function enlaceDeSala(codigo) {
  return `${location.origin}${location.pathname}?sala=${codigo}`;
}
export function enlaceWhatsApp(codigo, nombre) {
  const texto = `${nombre} te invita a una carrera de reliquias en la cripta. Entra aquí (sala ${codigo}): ${enlaceDeSala(codigo)}`;
  return `https://wa.me/?text=${encodeURIComponent(texto)}`;
}
