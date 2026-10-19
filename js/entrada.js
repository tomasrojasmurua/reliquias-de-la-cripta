// Controles: teclado + ratón (con bloqueo de puntero) y pantalla táctil
// (joystick a un lado, arrastrar al otro para mirar; el botón de atacar también mira al arrastrarlo).

const TECLAS = {
  KeyW: 'adelante', ArrowUp: 'adelante', KeyS: 'atras', ArrowDown: 'atras',
  KeyA: 'izq', KeyD: 'der', ArrowLeft: 'girarIzq', ArrowRight: 'girarDer',
  ControlLeft: 'disparar', KeyF: 'disparar',
};
const PULSOS = { KeyE: 'usar', Space: 'usar', Enter: 'usar', KeyR: 'recargar', Digit1: 'arma1', Digit2: 'arma2', Digit3: 'arma3', Digit4: 'arma4', KeyQ: 'cambiarArma', Escape: 'pausa', KeyP: 'pausa', Tab: 'mapa', KeyM: 'mapa' };

export class Entrada {
  constructor(canvas, tactil) {
    this.canvas = canvas;
    this.tactil = tactil;
    this.teclas = new Set();
    this.pulsos = new Set();
    this.giro = 0; this.cabeceo = 0;
    this.raton = false;
    this.joy = null; this.mirar = null; this.mirarBoton = null;
    this.mov = { x: 0, y: 0 };
    this.botonDisparo = false;
    this.activa = false;
    this.sensRaton = 0.0024;
    this.sensTactil = 0.006;
    this.zurdo = false;
    this.giroPend = 0; this.cabeceoPend = 0;   // giro táctil aún por aplicar (suavizado)
    this.ultimoMirar = 0;    // la vista se nivela sola un rato después de dejar de mirar
    this.ultimoAtaque = 0;
    this.tLeer = performance.now();

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
    const R = 64, MUERTA = 0.15;
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
          this.mirar = { id: t.identifier, x: t.clientX, y: t.clientY };
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
          // zona muerta: un roce no mueve; fuera de ella la respuesta empieza desde cero
          const m = Math.min(d, R) / R, k = m < MUERTA ? 0 : (m - MUERTA) / (1 - MUERTA) / (m || 1);
          this.mov.x = dx / R * k; this.mov.y = -dy / R * k;
          palanca.style.transform = `translate(${this.joy.ox + dx - 24}px, ${this.joy.oy + dy - 24}px)`;
        } else if (this.mirar && t.identifier === this.mirar.id) {
          this.arrastrar(this.mirar, t);
        }
      }
    }, opts);
    const fin = e => {
      for (const t of e.changedTouches) {
        if (this.joy && t.identifier === this.joy.id) {
          this.joy = null; this.mov.x = this.mov.y = 0;
          base.hidden = palanca.hidden = true;
        }
        if (this.mirar && t.identifier === this.mirar.id) { this.mirar = null; this.ultimoMirar = performance.now(); }
      }
    };
    zona.addEventListener('touchend', fin);
    zona.addEventListener('touchcancel', fin);

    // Botones: disparo se mantiene y, al arrastrarlo, también mueve la vista; el resto son pulsos.
    for (const [boton, accion] of this.tactil.botones) {
      boton.addEventListener('touchstart', e => {
        e.preventDefault(); e.stopPropagation();
        document.body.classList.add('tactil');
        if (accion === 'disparar') {
          this.botonDisparo = true;
          const t = e.changedTouches[0];
          if (!this.mirarBoton) this.mirarBoton = { id: t.identifier, x: t.clientX, y: t.clientY };
        } else this.pulsos.add(accion);
        boton.classList.add('pulsado');
      }, opts);
      if (accion === 'disparar') boton.addEventListener('touchmove', e => {
        e.preventDefault(); e.stopPropagation();
        for (const t of e.changedTouches) if (this.mirarBoton && t.identifier === this.mirarBoton.id) this.arrastrar(this.mirarBoton, t);
      }, opts);
      const soltar = e => {
        e.preventDefault();
        if (accion === 'disparar') { this.botonDisparo = false; this.mirarBoton = null; this.ultimoMirar = performance.now(); }
        boton.classList.remove('pulsado');
      };
      boton.addEventListener('touchend', soltar, opts);
      boton.addEventListener('touchcancel', soltar, opts);
      boton.addEventListener('click', () => { if (accion !== 'disparar') this.pulsos.add(accion); });
    }
  }

  // Arrastre de un dedo que mira: curva de respuesta (lento = preciso, rápido = gira más).
  arrastrar(m, t) {
    const dx = t.clientX - m.x, dy = t.clientY - m.y;
    const curva = d => d * (0.85 + Math.min(Math.abs(d), 40) / 40);
    this.giroPend += curva(dx) * this.sensTactil;
    this.cabeceoPend -= curva(dy) * this.sensTactil * 0.6;
    m.x = t.clientX; m.y = t.clientY;
  }

  // Lee y vacía la entrada acumulada desde el último cuadro.
  leer() {
    const ahora = performance.now(), dt = Math.min(0.1, (ahora - this.tLeer) / 1000);
    this.tLeer = ahora;
    // suavizado: el giro táctil pendiente se aplica en unos 40 ms, sin el temblor del dedo
    const f = 1 - Math.exp(-dt * 25);
    const g = this.giroPend * f, c = this.cabeceoPend * f;
    this.giroPend -= g; this.cabeceoPend -= c;
    this.giro += g; this.cabeceo += c;
    const mirando = this.mirar || this.mirarBoton;
    const k = this.teclas;
    let adelante = (k.has('adelante') ? 1 : 0) - (k.has('atras') ? 1 : 0) + this.mov.y;
    let lado = (k.has('der') ? 1 : 0) - (k.has('izq') ? 1 : 0) + this.mov.x;
    const giroTeclas = (k.has('girarDer') ? 1 : 0) - (k.has('girarIzq') ? 1 : 0);
    const r = {
      adelante: Math.max(-1, Math.min(1, adelante)),
      lado: Math.max(-1, Math.min(1, lado)),
      giroTeclas,
      giro: this.giro, cabeceo: this.cabeceo,
      disparar: this.raton || this.botonDisparo || k.has('disparar'),
      // en pantalla táctil la vista vuelve sola al horizonte un momento después de dejar de mirar
      nivelar: document.body.classList.contains('tactil') && !mirando && ahora - this.ultimoMirar > 900,
      asistir: document.body.classList.contains('tactil'),
      pulsos: this.pulsos,
    };
    if (r.disparar) this.ultimoAtaque = ahora;
    this.giro = 0; this.cabeceo = 0;
    this.pulsos = new Set();
    return r;
  }

  soltarTodo() {
    this.teclas.clear(); this.raton = false; this.botonDisparo = false;
    this.joy = null; this.mirar = null; this.mirarBoton = null; this.mov.x = this.mov.y = 0;
    this.giroPend = this.cabeceoPend = 0;
    this.tactil.base.hidden = this.tactil.palanca.hidden = true;
  }
}
