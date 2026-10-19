// Salas para jugar entre amigos: los navegadores se conectan directamente (WebRTC, con PeerJS) y no hay
// servidor propio. El anfitrión es el centro de la sala: los demás le hablan a él y él reparte los mensajes.
// PeerJS solo hace falta para presentar a los navegadores con el código de la sala; después no interviene.

export const MAX_JUGADORES = 4;
export const COLORES = ['rojo', 'azul', 'verde', 'amarillo'];
export const HZ_POSICION = 12;

const PREFIJO = 'reliquias-';
const LETRAS = 'ABCDEFGHJKMNPQRSTUVWXYZ';   // sin I, L ni O para que el código no se confunda al dictarlo
const ESPERA_CONEXION = 12000;

export const codigoValido = c => /^[A-Z]{4}$/.test(c);
export const normalizarCodigo = c => String(c || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
const limpiarNombre = (n, i) => String(n || '').replace(/[<>&"']/g, '').trim().slice(0, 16) || `Cazador ${i + 1}`;

// El servidor que presenta a los navegadores: el gratuito de PeerJS, o el de `?senal=host:puerto` (pruebas o uno propio).
function opcionesSenal() {
  const s = new URLSearchParams(location.search).get('senal');
  if (!s) return {};
  const [host, puerto] = s.split(':');
  return { host, port: +puerto || 9000, path: '/', secure: false };
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
//   alEmpezar(partida)     el anfitrión empezó: { semilla, mazmorra, tamano, limite, cuenta }
//   alPosicion(id, p)      un cazador se movió: { x, y, z, yaw, pt }
//   alTesoro(i, id)        el tesoro `i` se lo llevó el cazador `id` (puede ser yo, o llegué tarde)
//   alSuelto(i, x, z)      el tesoro `i` volvió al suelo en (x, z)
//   alMarcador(lista)      resultados finales: [{ id, nombre, color, puntos, estado }]
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
    this.alCambiar = this.alEmpezar = this.alPosicion = this.alMarcador = this.alPerderse = this.alTesoro = this.alSuelto = () => {};
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
    await new Promise((ok, mal) => {
      const c = peer.connect(PREFIJO + codigo, { reliable: true });
      const plazo = setTimeout(() => { c.close(); mal(new Error(`No se encontró la sala ${codigo}. Revisa el código o pídele al anfitrión que la vuelva a abrir.`)); }, ESPERA_CONEXION);
      let admitido = false;
      c.on('open', () => c.send({ t: 'hola', nombre }));
      c.on('data', m => {
        if (m.t === 'llena' || m.t === 'iniciada') { clearTimeout(plazo); mal(new Error(m.t === 'llena' ? 'La sala está llena (hasta 4 cazadores).' : 'La partida de esa sala ya empezó.')); return; }
        if (m.t === 'sala' && !admitido) { admitido = true; clearTimeout(plazo); sala.conexion = c; ok(); }
        sala.#mensajeDelAnfitrion(m);
      });
      c.on('close', () => { if (!admitido) { clearTimeout(plazo); mal(new Error('No se pudo entrar a la sala.')); } else sala.#caida('El anfitrión salió de la sala.'); });
      c.on('error', () => { if (!admitido) { clearTimeout(plazo); mal(new Error('No se pudo entrar a la sala.')); } });
    }).catch(e => { peer.destroy(); throw e; });
    return sala;
  }

  // ---------- Anfitrión ----------

  #recibir(c) {
    if (this.enPartida || this.jugadores.length >= MAX_JUGADORES) {
      const t = this.enPartida ? 'iniciada' : 'llena';
      c.on('open', () => { c.send({ t }); setTimeout(() => c.close(), 400); });
      return;
    }
    // el primer puesto libre (sale uno y entra otro: queda con su color)
    const id = [...Array(MAX_JUGADORES).keys()].find(i => !this.jugadores.some(j => j.id === i));
    this.conexiones.set(id, c);
    c.on('data', m => this.#mensajeDeInvitado(id, m));
    const salio = () => { if (this.conexiones.get(id) !== c) return; this.conexiones.delete(id); this.jugadores = this.jugadores.filter(j => j.id !== id); this.#difundirSala(); this.alPosicion(id, null); this.#aviso({ t: 'sale', id }); };
    c.on('close', salio);
    c.on('error', salio);
  }

  #mensajeDeInvitado(id, m) {
    if (m.t === 'hola') {
      if (this.jugadores.some(j => j.id === id)) return;
      this.jugadores.push({ id, nombre: limpiarNombre(m.nombre, id), color: COLORES[id], estado: 'sala', puntos: 0 });
      this.jugadores.sort((a, b) => a.id - b.id);
      this.conexiones.get(id).send({ t: 'sala', yo: id, config: this.config, jugadores: this.jugadores });
      this.#difundirSala();
    } else if (m.t === 'p') {
      const p = { x: +m.x, y: +m.y, z: +m.z, yaw: +m.yaw, pt: m.pt | 0 };
      this.alPosicion(id, p);
      this.#aviso({ t: 'p', id, ...p }, id);
    } else if (m.t === 'estado') {
      const j = this.jugadores.find(q => q.id === id);
      if (j && ['sala', 'jugando'].includes(m.e)) { j.estado = m.e; this.#difundirSala(); }
    } else if (m.t === 'fin') {
      this.#registrarFin(id, m);
    } else if (m.t === 'toma') {
      this.#reclamar(m.i | 0, id);
    } else if (m.t === 'suelta') {
      this.#soltado(m.i | 0, +m.x, +m.z, id);
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
    for (const j of this.jugadores) { j.estado = 'jugando'; j.puntos = 0; j.fin = null; }
    this.#aviso({ t: 'empezar', ...partida });
    this.alEmpezar(partida);
  }

  #registrarFin(id, m) {
    const j = this.jugadores.find(q => q.id === id);
    if (!j) return;
    j.puntos = m.puntos | 0;
    j.fin = m.escapo ? 'escapó' : 'atrapado';
    this.#difundirMarcador();
  }

  #difundirMarcador() {
    const lista = this.jugadores.map(({ id, nombre, color, puntos, fin }) => ({ id, nombre, color, puntos, estado: fin || 'jugando' }));
    this.#aviso({ t: 'marcador', lista });
    this.alMarcador(lista);
  }

  // ---------- Invitado ----------

  #mensajeDelAnfitrion(m) {
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
    } else if (m.t === 'tomado') {
      this.alTesoro(m.i, m.id);
    } else if (m.t === 'suelto') {
      this.alSuelto(m.i, m.x, m.z);
    }
  }

  // ---------- Los dos ----------

  // Mi posición, unas veces por segundo.
  enviarPosicion(p) {
    const m = { t: 'p', x: +p.x.toFixed(2), y: +p.y.toFixed(2), z: +p.z.toFixed(2), yaw: +p.yaw.toFixed(2), pt: p.pt };
    if (this.soyAnfitrion) this.#aviso({ ...m, id: 0 });
    else this.conexion?.open && this.conexion.send(m);
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

  // 'sala' (en la sala de espera) o 'jugando'.
  ponerEstado(e) {
    if (this.soyAnfitrion) { this.jugadores[0].estado = e; if (e === 'sala') this.enPartida = false; this.#difundirSala(); }
    else this.conexion?.open && this.conexion.send({ t: 'estado', e });
  }

  // Mi resultado al terminar.
  terminar(puntos, escapo) {
    if (this.soyAnfitrion) this.#registrarFin(0, { puntos, escapo });
    else this.conexion?.open && this.conexion.send({ t: 'fin', puntos, escapo });
  }

  #caida(motivo) {
    if (this.cerrada) return;
    this.cerrada = true;
    this.alPerderse(motivo);
    this.peer.destroy();
  }

  cerrar() {
    if (this.cerrada) return;
    this.cerrada = true;
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
    peer.on('open', () => { clearTimeout(plazo); ok(peer); });
    peer.on('error', e => { clearTimeout(plazo); peer.destroy(); mal(e); });
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
