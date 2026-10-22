import { vistaMapa, reiniciarVistaMapa } from './automapa.js';

// Zoom y desplazamiento del mapa: pellizco o rueda para acercar, arrastre para mover, doble toque para volver.
export function activarZoomMapa(capaMapa) {
    const dedos = new Map();
    let distancia = 0, ultimoToque = 0;
    const k = () => capaMapa.width / (capaMapa.clientWidth || 1);
    const acercar = (factor, px, py) => {
      const z = Math.max(1, Math.min(8, vistaMapa.zoom * factor)), f = z / vistaMapa.zoom;
      const cx = capaMapa.width / 2, cy = capaMapa.height / 2;
      vistaMapa.x = px - cx - (px - cx - vistaMapa.x) * f; vistaMapa.y = py - cy - (py - cy - vistaMapa.y) * f;
      vistaMapa.zoom = z;
      if (z === 1) { vistaMapa.x = 0; vistaMapa.y = 0; }
    };
    const medir = () => { const [a, b] = [...dedos.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
    capaMapa.addEventListener('pointerdown', e => {
      capaMapa.setPointerCapture(e.pointerId);
      dedos.set(e.pointerId, { x: e.offsetX * k(), y: e.offsetY * k() });
      if (dedos.size === 2) distancia = medir();
      if (dedos.size === 1) { const ahora = performance.now(); if (ahora - ultimoToque < 300) reiniciarVistaMapa(); ultimoToque = ahora; }
    });
    capaMapa.addEventListener('pointermove', e => {
      const d = dedos.get(e.pointerId); if (!d) return;
      const x = e.offsetX * k(), y = e.offsetY * k();
      if (dedos.size === 1) { vistaMapa.x += x - d.x; vistaMapa.y += y - d.y; }
      d.x = x; d.y = y;
      if (dedos.size === 2) {
        const [a, b] = [...dedos.values()], nueva = medir();
        if (distancia > 0) acercar(nueva / distancia, (a.x + b.x) / 2, (a.y + b.y) / 2);
        distancia = nueva;
      }
    });
    const soltar = e => { dedos.delete(e.pointerId); distancia = 0; };
    capaMapa.addEventListener('pointerup', soltar); capaMapa.addEventListener('pointercancel', soltar);
    capaMapa.addEventListener('wheel', e => { e.preventDefault(); acercar(e.deltaY < 0 ? 1.2 : 1 / 1.2, e.offsetX * k(), e.offsetY * k()); }, { passive: false });
}
