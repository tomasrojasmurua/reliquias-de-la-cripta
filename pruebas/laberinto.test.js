// Lógica pura del generador de laberintos: el azar con semilla y las mazmorras reproducibles.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { azarConSemilla } from '../js/laberinto.js';
import { cargarMazmorra } from '../js/mapa.js';
import { MAZMORRAS } from '../datos/mazmorras.js';

test('la misma semilla da la misma secuencia', () => {
  const a = azarConSemilla(42), b = azarConSemilla(42);
  for (let i = 0; i < 100; i++) assert.equal(a(), b());
});

test('semillas distintas dan secuencias distintas', () => {
  const a = azarConSemilla(1), b = azarConSemilla(2);
  assert.notEqual(a(), b());
});

test('el azar queda en [0, 1)', () => {
  const a = azarConSemilla(7);
  for (let i = 0; i < 1000; i++) { const v = a(); assert.ok(v >= 0 && v < 1); }
});

for (const def of MAZMORRAS) {
  test(`${def.nombre}: misma semilla, misma mazmorra`, () => {
    const a = cargarMazmorra(def, 123), b = cargarMazmorra(def, 123);
    assert.equal(a.ancho, b.ancho);
    assert.equal(a.alto, b.alto);
    assert.deepEqual(a.inicio, b.inicio);
    assert.equal(a.enemigos.length, b.enemigos.length);
    assert.equal(a.objetos.length, b.objetos.length);
  });

  test(`${def.nombre}: el inicio queda dentro del mapa y en suelo pisable`, () => {
    for (const semilla of [1, 2, 3]) {
      const m = cargarMazmorra(def, semilla);
      const x = Math.floor(m.inicio.x), y = Math.floor(m.inicio.z);
      assert.ok(x > 0 && y > 0 && x < m.ancho && y < m.alto);
      assert.ok(!m.solida(x, y));
    }
  });
}
