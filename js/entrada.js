// Controles: teclado + ratón (con bloqueo de puntero) y pantalla táctil
// (joystick a un lado, arrastrar al otro para mirar y tocar para disparar, botones de acción).

const TECLAS = {
  KeyW: 'adelante', ArrowUp: 'adelante', KeyS: 'atras', ArrowDown: 'atras',
  KeyA: 'izq', KeyD: 'der', ArrowLeft: 'girarIzq', ArrowRight: 'girarDer',
  ShiftLeft: 'correr', ShiftRight: 'correr', ControlLeft: 'disparar', KeyF: 'disparar',
};
const PULSOS = { KeyE: 'usar', Space: 'usar', Enter: 'usar', KeyR: 'recargar', Digit1: 'arma1', Digit2: 'arma2', KeyQ: 'cambiarArma', Escape: 'pausa', KeyP: 'pausa', Tab: 'mapa', KeyM: 'mapa' };

export class Entrada {
  constructor(canvas, tactil) {
    this.canvas = canvas;
    this.tactil = tactil;
    this.teclas = new Set();
    this.pulsos = new Set();
    this.giro = 0; this.cabeceo = 0;
    this.raton = false;
    this.joy = null; this.mirar = null;
    this.mov = { x: 0, y: 0 };
    this.botonDisparo = false;
    this.activa = false;
    this.sensRaton = 0.0024;
    this.sensTactil = 0.006;
    this.zurdo = false;
    this.disparoHasta = 0;   // un toque rápido en la zona de mirar dispara
    this.ráfaga = false;     // tocar y mantener dispara mientras se mira

    addEventListener('keydown', e => {
      if (!this.activa) return;
      if (TECLAS[e.code]) { this.teclas.add(TECLAS[e.code]); e.preventDefault(); }
      if (PULSOS[e.code] && !e.repeat) { this.pulsos.add(PULSOS[e.code]); e.preventDefault(); }
    });
    addEventListener('keyup', e => { if (TECLAS[e.code]) this.teclas.delete(TECLAS[e.code]); });
    addEventListener('blur', () => { this.teclas.clear(); this.raton = false; this.botonDisparo = false; });

    tactil.zona.addEventListener('mousedown', e => {
      if (!this.activa || document.body.classList.contains('tactil')) return;
      if (document.pointerLockElement !== canvas) { canvas.requestPointerLock?.(); return; }
      if (e.button === 0) this.raton = true;
      if (e.button === 2) this.pulsos.add('usar');
    });
    addEventListener('mouseup', e => { if (e.button === 0) this.raton = false; });
    tactil.zona.addEventListener('contextmenu', e => e.preventDefault());
    addEventListener('mousemove', e => {
      if (document.pointerLockElement !== canvas || !this.activa) return;
      this.giro += e.movementX * this.sensRaton;
      this.cabeceo -= e.movementY * this.sensRaton;
    });
    addEventListener('wheel', e => { if (this.activa && document.pointerLockElement === canvas) this.pulsos.add('cambiarArma'); });

    this.iniciarTactil();
  }

  iniciarTactil() {
    const zona = this.tactil.zona;
    const base = this.tactil.base, palanca = this.tactil.palanca;
    const R = 64;
    const TOQUE = 260, QUIETO = 14, DOBLE = 280;
    let ultimoToque = 0;
    const opts = { passive: false };
    zona.addEventListener('touchstart', e => {
      e.preventDefault();
      document.body.classList.add('tactil');
      for (const t of e.changedTouches) {
        const ladoJoy = this.zurdo ? t.clientX > innerWidth * 0.5 : t.clientX < innerWidth * 0.5;
        if (ladoJoy && !this.joy) {
          this.joy = { id: t.identifier, ox: t.clientX, oy: t.clientY };
          base.style.transform = `translate(${t.clientX - R}px, ${t.clientY - R}px)`;
          palanca.style.transform = `translate(${t.clientX - 24}px, ${t.clientY - 24}px)`;
          base.hidden = palanca.hidden = false;
        } else if (!this.mirar) {
          const ahora = performance.now();
          this.mirar = { id: t.identifier, x: t.clientX, y: t.clientY, ox: t.clientX, oy: t.clientY, t0: ahora };
          // segundo toque seguido: se mantiene el disparo mientras el dedo siga apoyado
          if (ahora - ultimoToque < DOBLE) this.ráfaga = true;
        }
      }
    }, opts);
    zona.addEventListener('touchmove', e => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (this.joy && t.identifier === this.joy.id) {
          let dx = t.clientX - this.joy.ox, dy = t.clientY - this.joy.oy;
          const d = Math.hypot(dx, dy);
          if (d > R) { dx *= R / d; dy *= R / d; }
          this.mov.x = dx / R; this.mov.y = -dy / R;
          palanca.classList.toggle('corre', Math.hypot(dx, dy) / R > 0.95);
          palanca.style.transform = `translate(${this.joy.ox + dx - 24}px, ${this.joy.oy + dy - 24}px)`;
        } else if (this.mirar && t.identifier === this.mirar.id) {
          this.giro += (t.clientX - this.mirar.x) * this.sensTactil;
          this.cabeceo -= (t.clientY - this.mirar.y) * this.sensTactil * 0.6;
          this.mirar.x = t.clientX; this.mirar.y = t.clientY;
        }
      }
    }, opts);
    const fin = e => {
      for (const t of e.changedTouches) {
        if (this.joy && t.identifier === this.joy.id) {
          this.joy = null; this.mov.x = this.mov.y = 0;
          base.hidden = palanca.hidden = true; palanca.classList.remove('corre');
        }
        if (this.mirar && t.identifier === this.mirar.id) {
          const m = this.mirar, ahora = performance.now();
          if (ahora - m.t0 < TOQUE && Math.hypot(t.clientX - m.ox, t.clientY - m.oy) < QUIETO && !this.ráfaga) {
            this.disparoHasta = ahora + 120; ultimoToque = ahora;
          }
          this.mirar = null; this.ráfaga = false;
        }
      }
    };
    zona.addEventListener('touchend', fin);
    zona.addEventListener('touchcancel', fin);

    // Botones: disparo se mantiene; el resto son pulsos.
    for (const [boton, accion] of this.tactil.botones) {
      boton.addEventListener('touchstart', e => {
        e.preventDefault(); e.stopPropagation();
        document.body.classList.add('tactil');
        if (accion === 'disparar') this.botonDisparo = true; else this.pulsos.add(accion);
        boton.classList.add('pulsado');
      }, opts);
      const soltar = e => { e.preventDefault(); if (accion === 'disparar') this.botonDisparo = false; boton.classList.remove('pulsado'); };
      boton.addEventListener('touchend', soltar, opts);
      boton.addEventListener('touchcancel', soltar, opts);
      boton.addEventListener('click', () => { if (accion !== 'disparar') this.pulsos.add(accion); });
    }
  }

  // Lee y vacía la entrada acumulada desde el último cuadro.
  leer() {
    const k = this.teclas;
    let adelante = (k.has('adelante') ? 1 : 0) - (k.has('atras') ? 1 : 0) + this.mov.y;
    let lado = (k.has('der') ? 1 : 0) - (k.has('izq') ? 1 : 0) + this.mov.x;
    const giroTeclas = (k.has('girarDer') ? 1 : 0) - (k.has('girarIzq') ? 1 : 0);
    const r = {
      adelante: Math.max(-1, Math.min(1, adelante)),
      lado: Math.max(-1, Math.min(1, lado)),
      giroTeclas,
      giro: this.giro, cabeceo: this.cabeceo,
      correr: k.has('correr') || Math.hypot(this.mov.x, this.mov.y) > 0.95,
      disparar: this.raton || this.botonDisparo || this.ráfaga || k.has('disparar') || performance.now() < this.disparoHasta,
      // en pantalla táctil la vista vuelve sola al horizonte cuando no se está mirando
      nivelar: document.body.classList.contains('tactil') && !this.mirar,
      asistir: document.body.classList.contains('tactil'),
      pulsos: this.pulsos,
    };
    this.giro = 0; this.cabeceo = 0;
    this.pulsos = new Set();
    return r;
  }

  soltarTodo() {
    this.teclas.clear(); this.raton = false; this.botonDisparo = false; this.ráfaga = false; this.disparoHasta = 0;
    this.joy = null; this.mirar = null; this.mov.x = this.mov.y = 0;
    this.tactil.base.hidden = this.tactil.palanca.hidden = true;
  }
}
