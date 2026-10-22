// Banco de pistas: normalización de respuestas y elección de pistas.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizar, elegirPista, pistasDisponibles } from '../js/acertijos.js';
import { azarConSemilla } from '../js/laberinto.js';

test('normalizar quita tildes y símbolos pero conserva la Ñ', () => {
  assert.equal(normalizar('Murciélago'), 'MURCIELAGO');
  assert.equal(normalizar('año'), 'AÑO');
  assert.equal(normalizar('  a-b c! '), 'ABC');
});

test('hay pistas disponibles', () => {
  assert.ok(pistasDisponibles().length > 0);
});

test('elegirPista respeta la dificultad y es reproducible con semilla', () => {
  const a = elegirPista([1, 5], new Set(), new Set(), azarConSemilla(9));
  const b = elegirPista([1, 5], new Set(), new Set(), azarConSemilla(9));
  assert.equal(a.id, b.id);
  assert.ok(a.dificultad >= 1 && a.dificultad <= 5);
});

test('elegirPista prefiere las no resueltas y respeta las excluidas', () => {
  const todas = pistasDisponibles().filter(p => p.dificultad >= 1 && p.dificultad <= 5);
  const resueltas = new Set(todas.slice(1).map(p => p.id));
  assert.equal(elegirPista([1, 5], resueltas).id, todas[0].id);
  const p = elegirPista([1, 5], new Set(), new Set([todas[0].id]));
  assert.notEqual(p.id, todas[0].id);
});
