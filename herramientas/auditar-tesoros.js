// Reparto de reliquias: cuántas veces sale cada una en cada mazmorra y tamaño, con muchas semillas.
// Comprueba que (1) toda reliquia de una mazmorra puede salir incluso en la pequeña, (2) dentro de una rareza
// todas son igual de probables (chi cuadrado), (3) cuanto más rara, menos frecuente es cada reliquia y (4) en los
// cofres nunca hay reliquias comunes.
// Uso: node herramientas/auditar-tesoros.js [semillas]   (por defecto 400)

import { MAZMORRAS, tesorosDeMapa } from '../datos/mazmorras.js';
import { TESORO } from '../datos/tesoros.js';
import { cargarMazmorra } from '../js/mapa.js';
import { recortarZonas } from '../js/laberinto.js';

const SEMILLAS = Number(process.argv[2]) || 400;
const RAREZAS = ['comun', 'raro', 'epico', 'legendario'];
const TAMANOS = [['pequeña', 1], ['mediana', 2], ['grande', Infinity]];
// chi cuadrado: valor crítico al 0,1 % para g grados de libertad (tabla); más allá de esto no es azar
const CRITICO = [0, 10.83, 13.82, 16.27, 18.47, 20.52, 22.46, 24.32, 26.12, 27.88, 29.59, 31.26, 32.91, 34.53, 36.12, 37.7, 39.25];

const fallos = [];
const ver = process.env.VERBOSO;
for (const def of MAZMORRAS) {
  const reserva = tesorosDeMapa(def);
  for (const [nombre, n] of TAMANOS) {
    const variante = recortarZonas(def, n);
    const veces = Object.fromEntries(reserva.map(id => [id, 0]));
    let cofres = 0, cofresComunes = 0, sitios = 0;
    for (let s = 1; s <= SEMILLAS; s++) {
      const m = cargarMazmorra(variante, s * 7919 + 13);
      const tes = m.objetos.filter(o => o.tipo === 'tesoro');
      sitios = tes.length;
      for (const o of tes) {
        if (!(o.tesoro in veces)) fallos.push(`${def.id} (${nombre}): sale «${o.tesoro}», que no es de su mapa`);
        else veces[o.tesoro]++;
        if (o.cofre) { cofres++; if (TESORO[o.tesoro].rareza === 'comun') cofresComunes++; }
      }
    }
    if (cofresComunes) fallos.push(`${def.id} (${nombre}): ${cofresComunes} cofres con reliquias comunes`);
    const resumen = [], frecuencia = [];
    for (const r of RAREZAS) {
      const ids = reserva.filter(id => TESORO[id].rareza === r);
      if (!ids.length) continue;
      const total = ids.reduce((a, id) => a + veces[id], 0);
      const esperado = total / ids.length;
      const chi = esperado ? ids.reduce((a, id) => a + (veces[id] - esperado) ** 2 / esperado, 0) : 0;
      const nunca = ids.filter(id => !veces[id]);
      if (nunca.length) fallos.push(`${def.id} (${nombre}): nunca sale ${nunca.join(', ')} (${r})`);
      if (ids.length > 1 && total && chi > CRITICO[Math.min(ids.length - 1, CRITICO.length - 1)]) fallos.push(`${def.id} (${nombre}): las reliquias ${r}s no son igual de probables (chi² ${chi.toFixed(1)}): ${ids.map(id => `${id} ${veces[id]}`).join(', ')}`);
      frecuencia.push([r, esperado / SEMILLAS]);
      resumen.push(`${r} ${ids.length}: ${(total / SEMILLAS).toFixed(2)}/partida, ${(esperado / SEMILLAS * 100).toFixed(0)} % cada una`);
    }
    // la frecuencia de cada reliquia no sube con la rareza (con un margen por el azar del muestreo)
    for (let k = 1; k < frecuencia.length; k++) {
      if (frecuencia[k][1] > frecuencia[k - 1][1] + 3 / Math.sqrt(SEMILLAS)) fallos.push(`${def.id} (${nombre}): las reliquias ${frecuencia[k][0]}s salen más (${(frecuencia[k][1] * 100).toFixed(0)} %) que las ${frecuencia[k - 1][0]}s (${(frecuencia[k - 1][1] * 100).toFixed(0)} %)`);
    }
    if (ver) console.log(`${def.id.padEnd(18)} ${nombre.padEnd(8)} ${String(sitios).padStart(2)} sitios, ${(cofres / SEMILLAS).toFixed(2)} cofres/partida · ${resumen.join(' · ')}`);
  }
}
if (fallos.length) { for (const f of fallos) console.error('✗ ' + f); process.exit(1); }
console.log(`✓ Reparto de reliquias revisado en ${MAZMORRAS.length} mazmorras y 3 tamaños con ${SEMILLAS} semillas cada uno.`);
