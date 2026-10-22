// Códigos de sala y enlaces para compartir.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { codigoValido, normalizarCodigo, enlaceDeSala, enlaceWhatsApp } from '../js/red.js';

test('un código válido son cuatro letras mayúsculas', () => {
  assert.ok(codigoValido('ABCD'));
  assert.ok(!codigoValido('abcd'));
  assert.ok(!codigoValido('ABC'));
  assert.ok(!codigoValido('AB1D'));
});

test('normalizarCodigo limpia lo que escribe el jugador', () => {
  assert.equal(normalizarCodigo(' ab-cd '), 'ABCD');
  assert.equal(normalizarCodigo('abcdef'), 'ABCD');
  assert.equal(normalizarCodigo(null), '');
});

test('los enlaces llevan el código de la sala', () => {
  globalThis.location = { origin: 'https://ejemplo.test', pathname: '/juego/' };
  assert.equal(enlaceDeSala('ABCD'), 'https://ejemplo.test/juego/?sala=ABCD');
  const wa = enlaceWhatsApp('ABCD', 'Ana');
  assert.ok(wa.startsWith('https://wa.me/?text='));
  assert.ok(decodeURIComponent(wa).includes('sala ABCD'));
});
