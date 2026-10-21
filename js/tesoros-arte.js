// El dibujo propio de cada reliquia (64 x 64, con la paleta de su tesoro). Las reliquias que no están aquí
// usan el dibujo de su forma en js/texturas.js (`FORMAS`); cada forma conserva una, así que ninguna se repite.
// `P`: c material, o líneas grabadas, k hondo, m medio tono, l claro, b brillo, gema y gema2 (más `P.t`, el tesoro).
// Las funciones se arman con las herramientas de dibujo de js/texturas.js, que se le pasan a `crearDisenos`.

export function crearDisenos(H) {
  const { r, ovalo, poli, trazo, aro, mezcla, glifo, moteado, PERLA, NOGAL, NOGAL_O, CUERO_G, PAPEL, PAPEL_O, LACRE, ESMALTE, MARFIL_G, NEGRO, RUBI_G, ZAFIRO_G, ESMERALDA_G } = H;
  const ORO = '#e8b83a', ORO_O = '#9a6e12', HIERRO = '#8a8a92', HIERRO_O = '#3a3a42';
  const D = {};
  // una moneda de frente: borde, cara y un anillo de puntos
  const moneda = (g, x, y, rad, P, cara = P.c) => { aro(g, x, y, rad, rad, cara, P.o); ovalo(g, x, y, rad - 2, rad - 2, P.m); ovalo(g, x, y, rad - 2.6, rad - 2.6, cara); };
  // una moneda de canto, apilada
  const pila = (g, x, base, n, ancho, P, h = 3) => {
    for (let i = 0; i < n; i++) { const y = base - i * h; r(g, x - ancho / 2, y, ancho, h, P.c); r(g, x - ancho / 2, y + h - 1, ancho, 1, P.o); }
    const y = base - n * h + 1; ovalo(g, x, y, ancho / 2, 2.2, P.l); ovalo(g, x, y, ancho / 2 - 3, 1, P.m);
  };

  // ---------- Monedas ----------
  D.monedas_plata = (g, P) => {
    // una moneda grande con el perfil de un faraón de nemes a rayas, y dos pilas de canto a los lados
    pila(g, 9, 60, 5, 14, P); pila(g, 55, 60, 4, 14, P);
    aro(g, 32, 31, 21, 21, P.c, P.o); ovalo(g, 32, 31, 18, 18, P.m); ovalo(g, 32, 31, 17, 17, P.c);
    poli(g, P.o, 23, 44, 24, 28, 27, 20, 33, 15, 40, 17, 43, 24, 41, 31, 43, 34, 40, 36, 41, 44);                // cabeza
    poli(g, P.k, 33, 15, 42, 17, 46, 42, 38, 46, 36, 28); for (let y = 19; y < 44; y += 3) r(g, 38 + (y > 36 ? 1 : 0), y, 6, 1, P.c);
    r(g, 29, 27, 3, 2, P.c); r(g, 30, 34, 4, 1, P.c); poli(g, P.c, 24, 28, 26, 28, 26, 38, 25, 38);
    for (let a = 0; a < 30; a++) { const t = a / 30 * Math.PI * 2; r(g, 32 + Math.cos(t) * 19.5, 31 + Math.sin(t) * 19.5, 1, 1, P.o); }
  };
  D.doblones = (g, P) => {
    const c = [[14, 52], [24, 54], [34, 55], [44, 54], [51, 51], [19, 45], [29, 47], [39, 47], [48, 44], [24, 38], [34, 40], [43, 37], [31, 31], [38, 28]];
    c.forEach(([x, y], i) => { aro(g, x, y, 6.5 - (i > 9 ? 0.5 : 0), 6, P.c, P.o); ovalo(g, x, y, 4.2, 3.8, i % 2 ? P.m : P.c); });
    // la de arriba, con la cruz de Jerusalén y el escudo
    aro(g, 26, 20, 11, 10, P.c, P.o); ovalo(g, 26, 20, 8.5, 7.5, P.m);
    r(g, 25, 12, 2, 16, P.o); r(g, 18, 19, 16, 2, P.o);
    for (const [x, y] of [[21, 15], [30, 15], [21, 24], [30, 24]]) r(g, x, y, 2, 2, P.o);
    for (let a = 0; a < 7; a++) { const t = a / 7 * Math.PI * 2 + 0.3; r(g, 26 + Math.cos(t) * 11.5, 20 + Math.sin(t) * 10.5, 1, 1, P.k); }
  };
  D.pesas_deben = (g, P) => {
    const pesa = (x, ancho, alto, forma) => {
      const y = 58 - alto;
      poli(g, P.c, x - ancho / 2, 58, x + ancho / 2, 58, x + ancho / 2 - 2, y, x - ancho / 2 + 2, y);
      r(g, x - ancho / 2, 57, ancho, 1, P.o); r(g, x - ancho / 2 + 2, y, ancho - 4, 1, P.o);
      aro(g, x, y - 2, 2.2, 2, P.c, P.o);                                    // asa
      if (forma) glifo(g, forma, x - 3, y + 3, P.o, 1);
    };
    pesa(13, 14, 22, ['.#.', '###', '.#.', '###']); pesa(28, 15, 30, ['###', '#.#', '###', '#..', '#..']);
    pesa(44, 14, 19, ['#.#', '.#.', '#.#']); pesa(56, 9, 12, null);
    // una pesa con forma de ternero, tumbada, delante
    ovalo(g, 36, 55, 10, 4, P.c); ovalo(g, 36, 55, 8, 2.6, P.m); r(g, 26, 53, 3, 5, P.c); r(g, 42, 53, 3, 5, P.c); ovalo(g, 46, 51, 3.4, 2.6, P.c);
  };
  D.plata_corte = (g, P) => {
    // un brazalete cortado a hachazos en cuatro arcos y unas monedas partidas
    const arco = (x, y, a0, a1, rr) => { g.strokeStyle = P.o; g.lineWidth = 7; g.lineCap = 'butt'; g.beginPath(); g.arc(x, y, rr, a0, a1); g.stroke(); g.strokeStyle = P.c; g.lineWidth = 5; g.beginPath(); g.arc(x, y, rr, a0, a1); g.stroke(); };
    arco(30, 30, 3.5, 5.2, 14); arco(33, 28, 0.1, 1.5, 14); arco(30, 33, 1.9, 3.2, 14);
    for (let a = 0; a < 6; a++) r(g, 27 + a * 2.5, 15 + Math.sin(a) * 2, 1, 1, P.l);
    poli(g, P.c, 12, 56, 24, 50, 30, 57, 22, 62, 12, 61); poli(g, P.o, 12, 56, 24, 50, 25, 52, 14, 58);
    poli(g, P.c, 34, 56, 48, 48, 55, 55, 46, 61, 36, 61); trazo(g, P.o, 1, 38, 56, 48, 52);
    poli(g, P.l, 50, 43, 56, 40, 58, 46, 52, 48); poli(g, P.c, 40, 44, 46, 42, 46, 47, 41, 48);
    ovalo(g, 8, 48, 2.4, 2, P.c); ovalo(g, 58, 58, 2, 1.6, P.c); ovalo(g, 52, 62, 2.6, 1.6, P.l);
  };
  D.reales_plata = (g, P) => {
    // una moneda de a ocho cortada en gajos, con uno fuera para dar el cambio
    aro(g, 28, 34, 18, 18, P.c, P.o);
    for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2 - 0.4; trazo(g, P.o, 1, 28, 34, 28 + Math.cos(a) * 17, 34 + Math.sin(a) * 17); }
    g.save(); g.globalCompositeOperation = 'destination-out'; poli(g, '#000', 28, 34, 28 + Math.cos(-0.4 - 0.78) * 24, 34 + Math.sin(-0.4 - 0.78) * 24, 28 + Math.cos(-0.4) * 24, 34 + Math.sin(-0.4) * 24); g.restore();
    ovalo(g, 28, 34, 11, 11, P.m); ovalo(g, 28, 34, 10.2, 10.2, P.c);
    r(g, 24, 29, 2, 10, P.o); r(g, 30, 29, 2, 10, P.o); r(g, 23, 28, 10, 1, P.o); r(g, 23, 39, 10, 1, P.o);   // las dos columnas
    poli(g, P.c, 44, 14, 58, 20, 52, 32); poli(g, P.o, 44, 14, 58, 20, 57, 22, 46, 17);
    glifo(g, ['#.#', '###', '#.#'], 51, 20, P.o, 1);
    poli(g, P.c, 46, 44, 60, 50, 56, 58, 44, 56); trazo(g, P.o, 1, 46, 44, 56, 58);
  };
  D.semillas_cacao = (g, P) => {
    // un saquito de cuero atado, con granos y una mazorca
    poli(g, CUERO_G, 14, 56, 18, 34, 28, 26, 40, 26, 46, 34, 50, 56, 40, 61, 24, 61);
    poli(g, NOGAL, 20, 38, 26, 30, 36, 30, 44, 38, 40, 56, 22, 56); for (const x of [22, 30, 38, 45]) trazo(g, NOGAL_O, 1, x, 36, x - 1, 58);
    r(g, 24, 24, 16, 5, CUERO_G); trazo(g, PAPEL, 2, 22, 28, 42, 28); trazo(g, PAPEL, 1.5, 38, 28, 46, 36, 44, 44);
    for (const [x, y] of [[14, 60], [20, 62], [48, 61], [54, 58], [30, 62], [42, 62]]) { ovalo(g, x, y, 2.6, 1.8, NOGAL_O); r(g, x - 1, y - 1, 2, 1, NOGAL); }
    // la mazorca, apoyada en el saco
    ovalo(g, 48, 20, 5, 11, '#c8601e'); for (const x of [45, 47, 49, 51]) trazo(g, '#8a3a10', 0.8, x, 11, x, 30); r(g, 47, 7, 3, 3, NOGAL_O);
  };
  D.rupias_mogolas = (g, P) => {
    // monedas cuadradas con la caligrafía del emperador, apiladas y desparramadas
    const cuadrada = (x, y, l, k) => { r(g, x - 1, y - 1, l + 2, l + 2, P.o); r(g, x, y, l, l, P.c); ovalo(g, x + l / 2, y + l / 2, l / 2 - 2, l / 2 - 2, P.m);
      for (let i = 0; i < 4; i++) { trazo(g, P.o, 1, x + 3 + i * (l - 6) / 3, y + 5 + (i % 2) * 2, x + 4 + i * (l - 6) / 3, y + l - 5 - (k + i) % 2 * 3); } };
    cuadrada(8, 40, 22, 0); cuadrada(30, 34, 22, 1); cuadrada(16, 14, 20, 0); cuadrada(38, 10, 17, 1);
    for (let i = 0; i < 3; i++) { r(g, 12 + i, 62 - i, 40, 1, P.o); }
    ovalo(g, 52, 50, 7, 7, P.o); ovalo(g, 52, 50, 6, 6, P.c); r(g, 50, 46, 1, 8, P.o); r(g, 53, 47, 1, 6, P.o);
  };
  D.besantes = (g, P) => {
    // monedas cóncavas bizantinas con un busto de frente
    const copa = (x, y, rr) => { aro(g, x, y, rr, rr, P.c, P.o); ovalo(g, x, y, rr - 3, rr - 3, P.m); ovalo(g, x + 1, y + 1, rr - 4, rr - 4, P.c); };
    copa(20, 42, 16); copa(44, 44, 15);
    // busto de Cristo con halo cruciforme
    ovalo(g, 20, 32, 6, 6, P.o); ovalo(g, 20, 32, 5, 5, P.l); r(g, 19, 25, 2, 14, P.o); r(g, 14, 31, 12, 2, P.o);
    ovalo(g, 20, 34, 3.4, 4, P.c); r(g, 18, 34, 1, 1, P.k); r(g, 21, 34, 1, 1, P.k); poli(g, P.m, 12, 54, 16, 44, 24, 44, 28, 54);
    r(g, 18, 46, 1, 6, P.o); r(g, 22, 46, 1, 6, P.o);
    // la segunda, con un monograma
    glifo(g, ['###', '#.#', '###', '#..', '#..'], 41, 37, P.o, 1); glifo(g, ['#.#', '###', '#.#'], 40, 45, P.o, 1);
    for (let a = 0; a < 12; a++) { const t = a / 12 * Math.PI * 2; r(g, 44 + Math.cos(t) * 12.5, 44 + Math.sin(t) * 12.5, 1, 1, P.o); }
    ovalo(g, 32, 14, 6, 6, P.c); r(g, 31, 8, 2, 12, P.o); r(g, 26, 13, 12, 2, P.o);
  };
  D.monedas_maharaja = (g, P) => {
    // una bolsa de seda carmesí que derrama monedas de oro con un elefante grabado
    poli(g, '#a82030', 18, 52, 22, 28, 30, 18, 42, 18, 48, 28, 52, 52, 42, 60, 26, 60);
    poli(g, '#c83040', 24, 52, 27, 32, 34, 24, 42, 32, 44, 52); for (const x of [26, 33, 40]) trazo(g, '#7a1020', 1, x, 28, x - 1 + (x - 33) / 6, 58);
    r(g, 24, 16, 22, 5, '#7a1020'); trazo(g, ORO, 2, 22, 20, 48, 20); ovalo(g, 51, 24, 2.4, 3.5, ORO); ovalo(g, 19, 24, 2.4, 3.5, ORO);
    for (const [x, y] of [[8, 58], [58, 56], [48, 62]]) moneda(g, x, y, 5, P);
    moneda(g, 14, 46, 8, P); moneda(g, 52, 42, 9, P);
    // elefante de perfil en la de la derecha
    ovalo(g, 52, 42, 4, 2.8, P.o); r(g, 49, 43, 1, 3, P.o); r(g, 52, 43, 1, 3, P.o); r(g, 55, 43, 1, 3, P.o); poli(g, P.o, 55, 38, 57, 42, 57, 47, 56, 47, 56, 42);
    ovalo(g, 14, 46, 3, 3, P.o); r(g, 13, 43, 2, 6, P.o); r(g, 11, 45, 6, 2, P.o);
  };
  D.moneda_templaria = (g, P) => {
    // una sola moneda grande con dos caballeros sobre un mismo caballo
    aro(g, 32, 34, 25, 25, P.c, P.o); ovalo(g, 32, 34, 21, 21, P.m); ovalo(g, 32, 34, 20, 20, P.c);
    for (let a = 0; a < 36; a++) { const t = a / 36 * Math.PI * 2; r(g, 32 + Math.cos(t) * 23, 34 + Math.sin(t) * 23, 1, 1, P.o); }
    ovalo(g, 31, 38, 11, 5.5, P.o); ovalo(g, 31, 37, 10, 4.5, P.c);                       // lomo
    for (const x of [23, 27, 36, 40]) r(g, x, 40, 2, 10, P.o);                              // patas
    poli(g, P.o, 40, 34, 45, 24, 50, 26, 46, 36); ovalo(g, 49, 25, 3.6, 2.6, P.o);          // cuello y cabeza
    for (const x of [27, 34]) { ovalo(g, x, 26, 3.2, 3.6, P.o); r(g, x - 2, 28, 4, 8, P.o); r(g, x - 1, 25, 2, 1, P.k); }   // los dos jinetes
    trazo(g, P.o, 1.2, 22, 21, 22, 37); poli(g, P.o, 22, 20, 25, 23, 22, 22);
    for (let a = 0; a < 6; a++) r(g, 22 + a * 4, 53, 2, 1, P.o);
  };

  // ---------- Dagas, espadas y cuchillos ----------
  // una hoja recta u oblicua con su guarda y mango; `ang` la inclina, `largo` es el largo de la hoja
  const arma = (g, P, ang, f) => { g.save(); g.translate(32, 36); g.rotate(ang); f(); g.restore(); };
  D.daga_plata = (g, P) => arma(g, P, -0.5, () => {
    // kris de hoja ondulada, de plata, con un mango de marfil tallado
    for (let i = 0; i < 9; i++) { const y = 4 - i * 3.5, w = 4.4 - i * 0.34, x = Math.sin(i * 1.15) * 3.4; poli(g, P.c, x - w, y + 3.6, x + w, y + 3.6, x + w, y, x - w, y); r(g, x - 0.5, y, 1, 3.6, P.o); }
    poli(g, P.c, -1, -27, 5, -25, 1, -33); trazo(g, P.o, 3, -10, 6, -4, 10, 4, 10, 10, 6); aro(g, 0, 8, 2, 2, P.gema, P.o);
    r(g, -2.5, 12, 5, 11, MARFIL_G); for (let y = 13; y < 22; y += 3) r(g, -2.5, y, 5, 1, PAPEL_O);
    aro(g, 0, 25, 3.2, 3.2, P.c, P.o); r(g, -1, 24, 2, 2, P.gema2);
  });
  D.daga_ritual = (g, P) => arma(g, P, 0.3, () => {
    // hoja de obsidiana en forma de hoja de laurel con los bordes tallados y una serpiente por mango
    poli(g, P.c, 0, -29, 6, -14, 4, 2, -4, 2, -6, -14); poli(g, P.l, 0, -27, 2, -14, 1, 0, -1, 0, -2, -14);
    for (let y = -22; y < 0; y += 4) { r(g, 4, y, 2, 1, P.o); r(g, -6, y + 1, 2, 1, P.o); }
    r(g, -7, 2, 14, 3, ORO); r(g, -7, 2, 14, 1, ORO_O); aro(g, 0, 3.5, 2, 2, RUBI_G, ORO_O);
    for (let i = 0; i < 6; i++) { const y = 6 + i * 3, x = Math.sin(i * 1.6) * 2.4; ovalo(g, x, y + 1.5, 3.2, 2, i % 2 ? '#2f8a5a' : '#1f6a42'); }
    ovalo(g, 0, 26, 3.6, 3, '#2f8a5a'); r(g, -1, 25, 1, 1, RUBI_G); r(g, 1, 25, 1, 1, RUBI_G); r(g, 0, 28, 1, 3, '#c83040');
  });
  D.espada_templaria = (g, P) => arma(g, P, 0.0, () => {
    // espada larga recta con cruz, canal profundo, empuñadura de cuero y pomo redondo
    poli(g, P.c, -3.4, 8, 3.4, 8, 3, -26, 0, -32, -3, -26); r(g, -0.5, -26, 1, 33, P.o); r(g, 1.5, -24, 1, 30, P.l);
    r(g, -13, 8, 26, 3.2, P.c); r(g, -13, 8, 26, 1, P.l); r(g, -13, 10, 26, 1, P.o); ovalo(g, -13, 9.6, 2.4, 2.4, P.c); ovalo(g, 13, 9.6, 2.4, 2.4, P.c);
    r(g, -2, 11, 4, 12, CUERO_G); for (let y = 12; y < 22; y += 2) r(g, -2, y, 4, 1, NOGAL_O);
    aro(g, 0, 25, 3.6, 3.6, P.c, P.o); r(g, -1, 24, 2, 2, P.o); r(g, 0, 18, 0, 0, P.o);
    glifo(g, ['.#.', '###', '.#.'], -1, -12, P.m, 1);
  });
  D.sable_drake = (g, P) => arma(g, P, -0.9, () => {
    // alfanje curvo con guardamano de cestería y empuñadura con cordón; el filo recorta la curva
    for (let i = 0; i < 12; i++) { const t = i / 11, y = 4 - t * 33, x = Math.sin(t * 1.3) * 8 * t; poli(g, P.c, x - 3.4 + t, y + 3, x + 3.4 - t, y + 3, x + 3.4 - t * 2, y, x - 3.4 + t * 2, y); r(g, x + 2.4 - t * 1.4, y, 1, 3, P.l); }
    aro(g, 3, 6, 9, 5, P.o, P.o); ovalo(g, 3, 6, 8, 4, P.k);
    for (let a = -6; a <= 6; a += 3) { trazo(g, P.c, 1, 3 + a, 3, 3 + a * 0.7, 10); }
    for (let a = 0; a < 5; a++) r(g, -4 + a * 3.4, 6 + Math.sin(a * 0.9) * 2, 2, 1, P.l);
    r(g, -2, 11, 5, 9, NOGAL); trazo(g, '#d8a838', 1, -2, 12, 3, 14, -2, 16, 3, 18); ovalo(g, 0.5, 22, 3.4, 3, P.c);
  });
  D.cuchillo_embalsamador = (g, P) => arma(g, P, 0.7, () => {
    // pequeño cuchillo de obsidiana, mango forrado de vendas de lino y una cuenta de lapislázuli
    poli(g, P.c, -4, 4, 4, 4, 3, -12, 0, -22, -3, -12); poli(g, P.l, 1, -16, 2, 2, 0, 2); r(g, -4, 3, 8, 1, P.o);
    for (let y = -10; y < 3; y += 4) r(g, -3, y, 2, 1, P.o);
    r(g, -3, 5, 6, 14, '#e8dcc0'); for (let y = 6; y < 19; y += 3) { trazo(g, PAPEL_O, 1, -3, y, 3, y + 1.6); }
    ovalo(g, 0, 21, 3, 3, '#e8dcc0'); ovalo(g, 0, 21, 1.6, 1.6, ZAFIRO_G);
  });
  D.sable_abordaje = (g, P) => arma(g, P, -0.3, () => {
    // cutlass corto y ancho de marinero, con la guarda en concha y el mango de madera sin pulir
    poli(g, P.c, -5, 4, 3, 4, 7, -10, 5, -22, -1, -26, 2, -14); r(g, 3, -10, 1, 12, P.l); trazo(g, P.o, 1, -2, 4, 1, -14, 4, -23);
    poli(g, P.o, -10, 8, -5, 4, 3, 4, 10, 8, 4, 14, -4, 14); poli(g, P.c, -8, 8, -4, 5, 3, 5, 8, 8, 3, 12, -3, 12);
    r(g, -2, 14, 4, 10, NOGAL); for (const y of [16, 20]) r(g, -2, y, 4, 1, NOGAL_O); ovalo(g, 0, 26, 3, 2.4, P.o);
    for (let a = 0; a < 3; a++) r(g, -3 + a * 3, 8, 1, 3, P.o);
  });
  D.punta_obsidiana = (g, P) => arma(g, P, 0.15, () => {
    // punta de lanza tallada a golpes, con un astil de caña y la ataduras de tendón
    poli(g, P.c, 0, -29, 8, -8, 5, 0, 0, 6, -5, 0, -8, -8); poli(g, P.l, 0, -26, 4, -10, 2, 0, 0, 2);
    for (const [x, y] of [[-8, -8], [-6, -2], [8, -8], [6, -2], [-3, -18], [3, -18]]) r(g, x, y, 2, 2, P.o);
    trazo(g, P.o, 1, 0, -26, -1, 4); r(g, -1.5, 6, 3, 24, '#c8a850'); for (let y = 10; y < 28; y += 6) r(g, -1.5, y, 3, 1, NOGAL_O);
    for (let i = 0; i < 4; i++) { trazo(g, '#8a4a28', 1, -4, 4 + i * 2, 4, 6 + i * 2); }
    trazo(g, '#3a7a3a', 2, 4, 18, 8, 24, 5, 28); poli(g, '#c8301e', -2, 28, 2, 28, 4, 34, -4, 34);
  });
  D.katar_guardian = (g, P) => arma(g, P, -0.1, () => {
    // puñal de empuñadura en H: dos barras laterales unidas por un travesaño, hoja ancha al frente
    poli(g, P.c, -5, -2, 5, -2, 4, -24, 0, -32, -4, -24); poli(g, P.l, -1, -26, 3, -22, 3, -2, -1, -2); r(g, -0.5, -26, 1, 24, P.o);
    for (let y = -20; y < -4; y += 5) { r(g, -4, y, 2, 1, P.o); r(g, 2, y, 2, 1, P.o); }
    r(g, -9, -2, 18, 5, P.c); r(g, -9, -2, 18, 1, P.l); r(g, -9, 2, 18, 1, P.o);
    r(g, -9, 3, 3, 24, P.c); r(g, 6, 3, 3, 24, P.c); r(g, -9, 3, 1, 24, P.o); r(g, 8, 3, 1, 24, P.o);
    r(g, -6, 12, 12, 3, CUERO_G); for (let x = -5; x < 6; x += 2) r(g, x, 12, 1, 3, NOGAL_O);
    ovalo(g, -7.5, 29, 2.4, 2, P.c); ovalo(g, 7.5, 29, 2.4, 2, P.c); aro(g, 0, 0.5, 1.8, 1.8, P.gema, P.o);
  });
  D.cuchillo_obsidiana = (g, P) => arma(g, P, 0.55, () => {
    // lasca de obsidiana con filo ondulado, enmangada en madera con tiras de cuero rojo
    poli(g, P.c, -5, 2, 5, 2, 6, -8, 3, -18, -2, -28, -5, -16, -6, -6); poli(g, P.l, -3, -14, 0, -26, 3, -12, 3, 2, -3, 2);
    for (let y = -22; y < 0; y += 3) { r(g, 4 - (y > -10 ? 0 : 1), y, 1, 1, P.o); r(g, -5, y + 1, 1, 1, P.o); }
    r(g, -4, 3, 8, 15, '#b08a50'); for (let y = 4; y < 17; y += 3) { r(g, -4, y, 8, 1.6, '#a82020'); }
    ovalo(g, 0, 19, 4.4, 2.6, '#b08a50');
  });


  // ---------- Ánforas, jarras y lámparas ----------
  D.anfora_jade = (g, P) => {
    // jarrón panzudo de jade pulido, con tapa de loto y asas de serpiente
    trazo(g, P.c, 3, 21, 22, 12, 24, 12, 36, 20, 42); trazo(g, P.c, 3, 43, 22, 52, 24, 52, 36, 44, 42);
    ovalo(g, 32, 38, 15, 17, P.c); ovalo(g, 32, 38, 14, 16, P.m); ovalo(g, 32, 37, 12, 14, P.c);
    r(g, 25, 14, 14, 9, P.c); r(g, 24, 22, 16, 2, P.o);
    for (let k = -2; k <= 2; k++) poli(g, P.l, 32 + k * 4, 14, 32 + k * 4 - 3, 9, 32 + k * 4 + 3, 9);                  // pétalos de loto
    ovalo(g, 32, 8, 2.4, 2.4, P.gema);
    for (let a = 0; a < 5; a++) { const y = 28 + a * 4; trazo(g, P.o, 1, 21, y, 26, y + 2, 32, y, 38, y + 2, 43, y); }   // ondas grabadas
    ovalo(g, 32, 56, 8, 3, P.c); r(g, 24, 55, 16, 1, P.o);
  };
  D.vaso_canopo = (g, P) => {
    // vaso de alabastro recto con tapa de cabeza de chacal y jeroglíficos en columna
    r(g, 20, 28, 24, 30, P.c); r(g, 20, 28, 24, 1, P.o); r(g, 18, 56, 28, 4, P.c); r(g, 18, 59, 28, 1, P.o);
    r(g, 22, 30, 1, 26, P.l); ovalo(g, 32, 28, 12, 3, P.c);
    for (let y = 33; y < 54; y += 7) glifo(g, [['.#.', '###', '.#.'], ['##.', '.##', '##.'], ['#.#', '.#.', '#.#']][(y / 7 | 0) % 3], 29, y, P.o, 1);
    r(g, 26, 31, 12, 1, P.o);
    poli(g, P.c, 22, 22, 28, 8, 30, 14, 34, 14, 36, 8, 42, 22);                                      // orejas
    poli(g, P.c, 24, 28, 24, 18, 40, 18, 40, 28); poli(g, P.c, 28, 20, 36, 20, 38, 26, 32, 30, 26, 26);
    poli(g, P.k, 29, 21, 31, 21, 30, 23); poli(g, P.k, 33, 21, 35, 21, 34, 23); ovalo(g, 32, 29, 2, 1.4, P.k);
    r(g, 22, 40, 20, 1, P.o);
  };
  D.jarra_natron = (g, P) => {
    // jarra baja de boca ancha, llena hasta arriba de sal blanca, con una cuchara de madera
    poli(g, P.c, 14, 22, 50, 22, 52, 52, 46, 60, 18, 60, 12, 52); r(g, 12, 22, 40, 3, P.m); r(g, 12, 22, 40, 1, P.o);
    for (let x = 18; x < 48; x += 8) r(g, x, 28, 1, 28, P.o);
    ovalo(g, 32, 21, 19, 5, '#f4f0e4'); for (let i = 0; i < 24; i++) r(g, 18 + (i * 7) % 28, 17 + (i * 5) % 8, 2, 1, i % 3 ? '#ffffff' : '#cfc8b4');
    r(g, 40, 6, 3, 18, NOGAL); ovalo(g, 41.5, 6, 3.5, 3, NOGAL); r(g, 40, 6, 1, 18, NOGAL_O);
    r(g, 22, 40, 20, 5, P.k); for (const x of [25, 31, 37]) r(g, x, 41, 3, 3, P.c);
  };
  D.ron_anejo = (g, P) => {
    // botella verde y panzuda con lacre, etiqueta de papel y telarañas de cien años
    poli(g, '#2f7a4a', 24, 28, 40, 28, 48, 42, 48, 58, 44, 61, 20, 61, 16, 58, 16, 42); poli(g, '#4aa66a', 20, 44, 24, 36, 26, 56, 22, 58);
    r(g, 28, 12, 8, 17, '#2f7a4a'); r(g, 27, 10, 10, 4, LACRE); r(g, 28, 8, 8, 2, LACRE); ovalo(g, 32, 14, 4, 1.2, '#a82020');
    poli(g, PAPEL, 22, 38, 42, 38, 42, 54, 22, 54); r(g, 22, 38, 20, 1, PAPEL_O); r(g, 22, 53, 20, 1, PAPEL_O);
    glifo(g, ['###', '#.#', '###'], 24, 41, NEGRO, 1); glifo(g, ['#.#', '###', '#.#'], 29, 41, NEGRO, 1); glifo(g, ['###', '.#.', '.#.'], 34, 41, NEGRO, 1);
    r(g, 24, 48, 16, 1, LACRE); r(g, 26, 50, 12, 1, PAPEL_O);
    for (const [a, b] of [[18, 30], [14, 34], [22, 26]]) trazo(g, '#dcd8cc', 0.8, 28, 28, a + 20, b);
  };
  D.vasija_pelota = (g, P) => {
    // vaso cilíndrico pintado con un jugador que golpea la pelota con la cadera
    poli(g, P.c, 16, 14, 48, 14, 50, 56, 46, 60, 18, 60, 14, 56); ovalo(g, 32, 14, 17, 4, P.m); ovalo(g, 32, 14, 14, 2.6, P.k);
    r(g, 14, 22, 36, 2, P.o); r(g, 14, 50, 36, 2, P.o);
    for (let x = 16; x < 48; x += 4) { r(g, x, 17, 2, 2, P.o); r(g, x + 2, 55, 2, 2, P.o); }
    // el jugador: cuerpo, cinturón ancho y brazos hacia atrás, y la pelota de caucho
    ovalo(g, 28, 30, 3, 3, '#e0a070'); poli(g, '#e0a070', 26, 33, 31, 33, 33, 44, 24, 46); r(g, 23, 40, 11, 4, P.o); trazo(g, '#e0a070', 2, 26, 34, 20, 38); trazo(g, '#e0a070', 2, 31, 34, 37, 30);
    trazo(g, '#e0a070', 2, 28, 46, 24, 52); trazo(g, '#e0a070', 2, 31, 46, 38, 49); r(g, 26, 26, 6, 2, P.o);
    ovalo(g, 42, 46, 4, 4, '#c8601e'); trazo(g, '#8a3a10', 0.8, 40, 44, 44, 48);
  };
  D.lampara_bronce = (g, P) => {
    // lámpara de aceite con pico largo, asa arqueada y una llama que apenas se mantiene
    ovalo(g, 30, 44, 17, 8, P.c); ovalo(g, 30, 42, 14, 5, P.m); ovalo(g, 30, 42, 11, 3, P.k);
    poli(g, P.c, 44, 40, 58, 36, 60, 40, 46, 48); ovalo(g, 59, 37.5, 2.4, 2.4, P.c); r(g, 58, 36, 2, 1, P.k);
    trazo(g, P.c, 3, 14, 40, 5, 34, 6, 22, 14, 26); r(g, 12, 52, 36, 3, P.c); r(g, 18, 55, 24, 3, P.o);
    poli(g, '#ff9a2a', 59, 36, 56, 28, 58, 22, 61, 28); poli(g, '#ffe14a', 59, 35, 58, 29, 59, 26, 60, 29);
    for (let a = 0; a < 5; a++) trazo(g, P.o, 1, 16 + a * 6, 40, 14 + a * 6, 46);
  };

  // ---------- Amuletos, collares y colgantes ----------
  D.amuleto_martillo = (g, P) => {
    // martillo del trueno de plata en una cadena, con nudos grabados en la cabeza
    for (let a = 0; a <= 14; a++) { const t = a / 14 * Math.PI, x = 32 - Math.cos(t) * 17, y = 6 + Math.sin(t) * 16; ovalo(g, x, y, 1.5, 1.5, a % 2 ? P.c : P.o); }
    r(g, 29, 20, 6, 4, P.c); r(g, 30, 22, 4, 1, P.o);
    r(g, 29, 24, 6, 28, P.m); r(g, 30, 24, 4, 28, P.c); r(g, 29, 24, 1, 28, P.o);
    r(g, 14, 22, 36, 16, P.c); r(g, 14, 22, 36, 2, P.l); r(g, 14, 36, 36, 2, P.o); r(g, 12, 25, 2, 10, P.c); r(g, 50, 25, 2, 10, P.c);
    for (let x = 18; x < 48; x += 5) { trazo(g, P.o, 1, x, 27, x + 2, 31, x, 34); }
    r(g, 29, 48, 6, 5, CUERO_G); for (const y of [49, 51]) r(g, 29, y, 6, 1, NOGAL_O); ovalo(g, 32, 56, 3, 3, P.c);
  };
  D.collar_escarabajo = (g, P) => {
    // pectoral ancho de oro: dos alas desplegadas de lapislázuli y cornalina que sostienen el sol
    for (const s of [-1, 1]) for (let i = 0; i < 5; i++) {
      const y = 28 + i * 6, l = 24 - i * 2, c = [ESMALTE, '#c83040', ESMERALDA_G, ESMALTE, '#c83040'][i];
      poli(g, c, 32 + s * 6, y, 32 + s * (6 + l), y + 1, 32 + s * (4 + l), y + 6, 32 + s * 6, y + 6); r(g, 32 + s * 6 - (s < 0 ? l : 0), y + 5, l, 1, P.o);
    }
    aro(g, 32, 16, 9, 9, P.c, P.o); ovalo(g, 32, 16, 6, 6, '#c83040'); ovalo(g, 32, 16, 3, 3, ORO);
    aro(g, 32, 34, 7, 8, P.c, P.o); ovalo(g, 32, 34, 5, 6, ESMALTE); r(g, 31, 30, 2, 8, P.l);
    trazo(g, P.c, 2, 23, 14, 12, 9, 6, 16); trazo(g, P.c, 2, 41, 14, 52, 9, 58, 16);
  };
  D.ojo_horus = (g, P) => {
    // el ojo de Horus: contorno de lapislázuli, iris dorado, la ceja y la lágrima espiral
    poli(g, ESMALTE, 8, 32, 20, 22, 36, 20, 52, 28, 46, 34, 34, 28, 20, 30); poli(g, '#fff6d8', 12, 34, 22, 26, 34, 25, 46, 31, 36, 38, 22, 38);
    ovalo(g, 31, 31, 7, 7, ORO); ovalo(g, 31, 31, 4.4, 4.4, NEGRO); r(g, 29, 29, 2, 2, '#ffffff');
    poli(g, ESMALTE, 6, 24, 24, 12, 44, 14, 56, 24, 52, 25, 42, 18, 24, 18, 10, 28); poli(g, ESMALTE, 36, 38, 44, 40, 50, 50, 44, 58, 42, 52, 46, 48, 38, 44);
    trazo(g, ESMALTE, 3, 22, 40, 24, 52, 32, 56, 38, 50); ovalo(g, 36, 52, 4, 4, ESMALTE); ovalo(g, 36, 52, 1.6, 1.6, '#fff6d8');
    r(g, 12, 33, 40, 1, P.o);
  };
  D.pectoral_jade = (g, P) => {
    // placa de jade del rey Pakal, con el rostro del dios sol en bajorrelieve y flecos de cuentas
    poli(g, P.c, 14, 14, 50, 14, 52, 36, 32, 46, 12, 36); poli(g, P.m, 18, 18, 46, 18, 48, 34, 32, 42, 16, 34);
    ovalo(g, 32, 28, 9, 11, P.c); r(g, 25, 23, 5, 3, P.o); r(g, 34, 23, 5, 3, P.o); r(g, 26, 24, 3, 1, NEGRO); r(g, 35, 24, 3, 1, NEGRO);
    r(g, 30, 27, 4, 5, P.o); r(g, 27, 34, 10, 2, P.o); for (const x of [28, 31, 34]) r(g, x, 34, 1, 2, P.l);
    poli(g, P.c, 22, 13, 28, 8, 36, 8, 42, 13); for (const x of [14, 22, 30, 38, 46]) { r(g, x + 1, 42, 1, 6, P.o); ovalo(g, x + 1.5, 50, 2, 3, P.c); ovalo(g, x + 1.5, 57, 1.4, 2.4, P.l); }
    r(g, 14, 14, 36, 1, P.o); r(g, 14, 34, 4, 1, P.o); r(g, 46, 34, 4, 1, P.o);
  };
  D.amuleto_tyet = (g, P) => {
    // el nudo de Isis en jaspe rojo, como un ankh con los brazos caídos, sobre un cordón de lino
    trazo(g, '#e8dcc0', 2, 18, 4, 24, 14, 32, 16, 40, 14, 46, 4);
    trazo(g, P.c, 7, 32, 16, 32, 28); trazo(g, P.c, 7, 32, 24, 20, 30, 18, 42, 16, 52); trazo(g, P.c, 7, 32, 24, 44, 30, 46, 42, 48, 52);
    trazo(g, P.c, 7, 32, 28, 32, 58); ovalo(g, 32, 17, 6, 5, P.c); ovalo(g, 32, 17, 2.4, 2, '#e8dcc0');
    trazo(g, P.o, 1, 32, 20, 32, 56); trazo(g, P.o, 1, 24, 30, 19, 42, 17, 50); trazo(g, P.o, 1, 40, 30, 45, 42, 47, 50); r(g, 29, 31, 6, 2, P.o);
  };
  D.collar_naga = (g, P) => {
    // la serpiente que se muerde la cola, formando un aro con capucha de cobra y ojos de rubí
    trazo(g, P.o, 9, 32, 14, 16, 22, 12, 38, 22, 52, 38, 52, 50, 38, 48, 22, 38, 16); trazo(g, P.c, 7, 32, 14, 16, 22, 12, 38, 22, 52, 38, 52, 50, 38, 48, 22, 38, 16);
    for (let a = 0; a < 9; a++) { const t = a / 9 * Math.PI * 2; r(g, 32 + Math.cos(t) * 17, 36 + Math.sin(t) * 17 * 0.9, 2, 1, P.l); }
    poli(g, P.c, 24, 8, 40, 8, 44, 18, 32, 24, 20, 18); poli(g, P.m, 27, 10, 37, 10, 40, 17, 32, 21, 24, 17);
    ovalo(g, 28, 13, 1.8, 1.4, RUBI_G); ovalo(g, 36, 13, 1.8, 1.4, RUBI_G); r(g, 31, 18, 2, 6, '#c83040'); ovalo(g, 32, 4, 3, 2, P.l);
    for (let k = 0; k < 7; k++) r(g, 24 + k * 2, 22 + (k % 2), 1, 1, P.o);
  };
  D.concha_peregrino = (g, P) => {
    // concha de vieira con costillas, cosida a un trozo de tela con hilo basto
    poli(g, '#4a3a2a', 6, 8, 58, 8, 58, 60, 6, 60); poli(g, '#5e4a36', 8, 10, 56, 10, 56, 58, 8, 58);
    for (let x = 10; x < 56; x += 4) trazo(g, '#3a2a1c', 0.8, x, 10, x, 58);
    const cx = 32, cy = 50;
    for (let k = -5; k <= 5; k++) { const a = -Math.PI / 2 + k * 0.26; poli(g, k % 2 ? P.c : P.l, cx, cy, cx + Math.cos(a - 0.13) * 30, cy + Math.sin(a - 0.13) * 34, cx + Math.cos(a + 0.13) * 30, cy + Math.sin(a + 0.13) * 34); trazo(g, P.o, 0.8, cx, cy, cx + Math.cos(a) * 30, cy + Math.sin(a) * 34); }
    ovalo(g, 32, 52, 12, 5, P.c); poli(g, P.m, 22, 52, 42, 52, 38, 58, 26, 58);
    trazo(g, '#c8a850', 1, 28, 18, 30, 22, 36, 20, 38, 26);
  };
  D.collar_cornalina = (g, P) => {
    // un collar de tres vueltas de cuentas rojas de distintos tamaños con un cierre de oro
    for (let fila = 0; fila < 3; fila++) for (let a = 0; a <= 16 + fila * 2; a++) {
      const t = a / (16 + fila * 2) * Math.PI, x = 32 - Math.cos(t) * (14 + fila * 4), y = 8 + fila * 5 + Math.sin(t) * (22 + fila * 3), rr = 1.5 + ((a + fila) % 3 === 0 ? 0.9 : 0);
      ovalo(g, x, y, rr + 0.6, rr + 0.6, P.o); ovalo(g, x, y, rr, rr, (a + fila) % 4 ? P.c : P.l);
    }
    aro(g, 32, 55, 4.4, 4.4, ORO, ORO_O); ovalo(g, 32, 55, 2, 2, P.c); poli(g, ORO, 32, 63, 29, 59, 35, 59);
  };
  D.broche_plata = (g, P) => {
    // fíbula anular con un animal enroscado, y un alfiler largo que se cruza en el aro
    g.strokeStyle = P.o; g.lineWidth = 11; g.beginPath(); g.arc(30, 32, 17, 0, Math.PI * 2); g.stroke();
    g.strokeStyle = P.c; g.lineWidth = 8; g.beginPath(); g.arc(30, 32, 17, 0, Math.PI * 2); g.stroke();
    for (let a = 0; a < 12; a++) { const t = a / 12 * Math.PI * 2; ovalo(g, 30 + Math.cos(t) * 17, 32 + Math.sin(t) * 17, 1.6, 1.6, a % 2 ? P.l : P.m); }
    for (const [x, y] of [[13, 32], [47, 32], [30, 15]]) { ovalo(g, x, y, 4, 4, P.c); ovalo(g, x, y, 1.6, 1.6, P.gema2); }
    poli(g, P.c, 18, 52, 56, 12, 58, 14, 20, 56); r(g, 54, 10, 4, 6, P.o); poli(g, P.l, 20, 52, 52, 14, 53, 15, 21, 54);
  };
  D.collar_perlas = (g, P) => {
    // doble hilo de perlas del Caribe con un camafeo de concha al centro
    for (let fila = 0; fila < 2; fila++) for (let a = 0; a <= 15; a++) {
      const t = a / 15 * Math.PI, x = 32 - Math.cos(t) * (15 + fila * 5), y = 6 + fila * 4 + Math.sin(t) * (24 + fila * 5), rr = 2.6 - Math.abs(a - 7.5) * 0.04;
      ovalo(g, x, y, rr + 0.4, rr + 0.4, '#8a7a5a'); ovalo(g, x, y, rr, rr, PERLA); r(g, x - 1, y - 1.4, 1, 1, '#ffffff');
    }
    aro(g, 32, 48, 8, 10, ORO, ORO_O); ovalo(g, 32, 48, 6, 8, '#f0d8c8'); ovalo(g, 31, 46, 3, 3.4, '#e8b8a0'); r(g, 29, 52, 7, 2, '#e8b8a0'); r(g, 31, 44, 1, 1, '#7a4a30');
    for (const x of [26, 32, 38]) { trazo(g, '#8a7a5a', 0.8, x, 58, x, 60); ovalo(g, x, 61, 1.6, 1.8, PERLA); }
  };
  D.cuenta_rudraksha = (g, P) => {
    // rosario de 27 semillas rugosas con la cuenta mayor y una borla roja
    for (let a = 0; a <= 26; a++) {
      const t = a / 26 * Math.PI * 1.4 + 0.3, x = 32 + Math.cos(t + Math.PI) * 24 * 0.9, y = 24 + Math.sin(t + Math.PI * 0.1) * 24;
      ovalo(g, x, y, 3.4, 3.4, NOGAL_O); ovalo(g, x, y, 2.8, 2.8, a % 2 ? NOGAL : '#8a5a30'); r(g, x - 1, y - 1, 1, 1, '#c89a60'); r(g, x, y, 1, 1, NOGAL_O);
    }
    ovalo(g, 32, 50, 5, 5, NOGAL_O); ovalo(g, 32, 50, 4.2, 4.2, '#8a5a30'); for (const [a, b] of [[30, 48], [34, 50], [31, 53]]) r(g, a, b, 1, 1, NOGAL_O);
    poli(g, '#c83040', 30, 55, 34, 55, 36, 63, 28, 63); for (const x of [29, 31, 33, 35]) r(g, x, 58, 1, 5, '#7a1020');
  };

  // ---------- Escarabajos ----------
  const bicho = (g, P, cuerpo, ala, patas = P.o) => {
    for (const s of [-1, 1]) for (let k = 0; k < 3; k++) trazo(g, patas, 2.2, 32 + s * 10, 36 + k * 6, 32 + s * (18 + k * 2), 33 + k * 8, 32 + s * (20 + k), 41 + k * 8);
    poli(g, cuerpo, 22, 26, 42, 26, 46, 44, 32, 60, 18, 44); trazo(g, P.o, 1, 32, 28, 32, 58);
    poli(g, ala, 22, 28, 31, 28, 31, 56, 20, 44); poli(g, ala, 33, 28, 42, 28, 44, 44, 33, 56);
    ovalo(g, 32, 22, 8, 6, cuerpo); r(g, 26, 22, 12, 1, P.o);
    for (const x of [26, 30, 34, 38]) r(g, x, 14 + (x % 8 ? 0 : 1), 2, 4, P.o);
  };
  D.escarabajo_oro = (g, P) => {
    // un escarabajo macizo de oro de frente, con élitros listados y cuernos de cabeza
    bicho(g, P, P.c, P.c); for (let y = 30; y < 56; y += 4) { r(g, 22 + (y - 30) * 0.2, y, 20 - (y - 30) * 0.4, 1, P.o); }
    poli(g, P.l, 24, 30, 30, 30, 30, 48, 23, 42); ovalo(g, 32, 21, 4, 3, P.l);
  };
  D.escarabajo_lapis = (g, P) => {
    // de lapislázuli azul profundo con motas de pirita, patas finas de plata
    bicho(g, P, ESMALTE, ZAFIRO_G, '#d8dde4');
    for (const [x, y] of [[26, 34], [37, 38], [29, 47], [38, 48], [33, 41], [25, 42]]) r(g, x, y, 1, 1, ORO);
    poli(g, '#6a98ff', 24, 31, 29, 30, 29, 42, 23, 40); ovalo(g, 32, 22, 6, 4, '#2a5ac8'); r(g, 29, 20, 2, 2, ORO); r(g, 34, 20, 2, 2, ORO);
  };
  D.escarabajo_corazon = (g, P) => {
    // escarabajo de jade con un corazón grabado en el dorso y las alas plegadas
    bicho(g, P, P.c, P.c); poli(g, P.m, 24, 30, 30, 30, 30, 50, 22, 42);
    poli(g, P.o, 32, 52, 24, 42, 25, 35, 30, 34, 32, 38, 34, 34, 39, 35, 40, 42); poli(g, '#c83040', 32, 49, 26, 42, 27, 37, 30, 36, 32, 40, 34, 36, 37, 37, 38, 42);
    r(g, 29, 32, 6, 1, ORO); r(g, 30, 33, 1, 1, ORO); for (const [x, y] of [[26, 28], [38, 28]]) r(g, x, y, 1, 1, P.l);
  };
  D.escarabajo_jepri = (g, P) => {
    // el gran escarabajo de Jepri alado, que empuja el disco del sol; alas de lapislázuli y cornalina
    for (const s of [-1, 1]) for (let i = 0; i < 5; i++) { const y = 36 + i * 4, l = 24 - i * 2.4, c = [ESMALTE, '#c83040', ESMALTE, ESMERALDA_G, ESMALTE][i];
      poli(g, c, 32 + s * 8, y, 32 + s * (8 + l), y - 3, 32 + s * (6 + l), y + 3, 32 + s * 8, y + 4); r(g, 32 + s * 8 - (s < 0 ? l : 0), y + 3, l, 1, P.o); }
    ovalo(g, 32, 12, 9, 9, '#ff9a2a'); ovalo(g, 32, 12, 7, 7, '#ffd24a'); ovalo(g, 32, 12, 3, 3, '#fff6d8');
    for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; poli(g, '#ff9a2a', 32 + Math.cos(a - 0.2) * 9, 12 + Math.sin(a - 0.2) * 9, 32 + Math.cos(a) * 13, 12 + Math.sin(a) * 13, 32 + Math.cos(a + 0.2) * 9, 12 + Math.sin(a + 0.2) * 9); }
    for (const s of [-1, 1]) for (let k = 0; k < 3; k++) trazo(g, P.o, 2.4, 32 + s * 7, 42 + k * 5, 32 + s * (13 + k), 40 + k * 7, 32 + s * (15 + k), 48 + k * 7);
    poli(g, P.c, 22, 28, 42, 28, 44, 46, 32, 62, 20, 46); poli(g, P.m, 32, 30, 42, 30, 43, 45, 32, 60); trazo(g, P.o, 1, 32, 30, 32, 60);
    poli(g, P.l, 24, 31, 30, 31, 30, 50, 23, 44); ovalo(g, 32, 26, 7, 4.4, P.c); r(g, 29, 25, 2, 1, RUBI_G); r(g, 34, 25, 2, 1, RUBI_G);
  };

  // ---------- Amuleto solar, cálices y campana ----------
  D.amuleto_oro = (g, P) => {
    // disco solar con rayos rectos y ondulados alternados y un rostro sereno en el centro
    for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2, l = k % 2 ? 27 : 22; poli(g, P.c, 32 + Math.cos(a - 0.12) * 13, 32 + Math.sin(a - 0.12) * 13, 32 + Math.cos(a) * l, 32 + Math.sin(a) * l, 32 + Math.cos(a + 0.12) * 13, 32 + Math.sin(a + 0.12) * 13); }
    aro(g, 32, 32, 14, 14, P.c, P.o); ovalo(g, 32, 32, 11, 11, P.m); ovalo(g, 32, 32, 10, 10, P.l);
    r(g, 27, 28, 3, 1, P.o); r(g, 34, 28, 3, 1, P.o); r(g, 31, 30, 2, 5, P.o); trazo(g, P.o, 1, 28, 37, 32, 39, 36, 37);
    ovalo(g, 32, 4, 2.6, 2.6, P.gema); r(g, 31, 5, 2, 3, P.o);
  };
  D.caliz_oro = (g, P) => {
    // copa ancha y baja con borde de pedrería, tallo con nudo esférico y una base escalonada
    poli(g, P.c, 10, 14, 54, 14, 50, 30, 38, 38, 26, 38, 14, 30); r(g, 10, 14, 44, 3, P.l); r(g, 10, 17, 44, 1, P.o);
    for (let x = 14; x < 52; x += 6) { ovalo(g, x + 1, 15, 2, 2, x % 12 ? P.gema : P.gema2); }
    poli(g, P.m, 12, 22, 50, 22, 46, 31, 36, 36, 28, 36, 18, 31); for (const x of [20, 32, 44]) r(g, x, 22, 1, 12, P.o);
    r(g, 29, 38, 6, 7, P.c); ovalo(g, 32, 48, 7, 5, P.c); ovalo(g, 32, 47, 5, 3, P.l);
    r(g, 29, 52, 6, 3, P.c); poli(g, P.c, 14, 60, 18, 54, 46, 54, 50, 60); r(g, 14, 59, 36, 1, P.o); r(g, 18, 54, 28, 1, P.l);
  };
  D.caliz_carpintero = (g, P) => {
    // vaso de arcilla sencillo, ancho y sin adornos, con una grieta antigua y un tenue halo de luz
    for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; poli(g, 'rgba(255,240,170,0.55)', 32, 34, 32 + Math.cos(a - 0.1) * 30, 34 + Math.sin(a - 0.1) * 30, 32 + Math.cos(a + 0.1) * 30, 34 + Math.sin(a + 0.1) * 30); }
    poli(g, '#a8814f', 16, 20, 48, 20, 46, 36, 38, 44, 26, 44, 18, 36); ovalo(g, 32, 20, 16, 3.4, '#6a4a28'); ovalo(g, 32, 20, 13, 2, '#2a1a0a');
    poli(g, '#c29a64', 18, 24, 26, 24, 28, 40, 22, 36); trazo(g, '#5a3c1c', 0.8, 40, 22, 38, 30, 41, 37);
    r(g, 29, 44, 6, 8, '#a8814f'); poli(g, '#a8814f', 20, 58, 24, 52, 40, 52, 44, 58); r(g, 20, 57, 24, 1, '#6a4a28'); r(g, 26, 31, 12, 1, '#7a5a30'); r(g, 26, 34, 12, 1, '#7a5a30');
  };
  D.campana_templo = (g, P) => {
    // campanilla de bronce con asa de argolla, borde acampanado y un badajo que asoma
    aro(g, 32, 8, 5, 5, P.c, P.o); ovalo(g, 32, 8, 2, 2, P.k);
    poli(g, P.c, 28, 12, 36, 12, 40, 30, 46, 46, 52, 52, 12, 52, 18, 46, 24, 30); poli(g, P.l, 29, 14, 32, 14, 30, 30, 22, 48, 16, 50, 24, 34);
    r(g, 12, 52, 40, 3, P.m); r(g, 12, 52, 40, 1, P.o); r(g, 12, 55, 40, 1, P.o);
    r(g, 24, 22, 16, 1, P.o); r(g, 21, 38, 22, 1, P.o); for (let x = 22; x < 44; x += 5) glifo(g, ['.#.', '###'], x, 42, P.o, 1);
    ovalo(g, 32, 57, 3.4, 3.4, P.m); ovalo(g, 32, 57, 1.6, 1.6, P.l);
  };

  // ---------- Máscaras y gemas ----------
  D.mascara_oro = (g, P) => {
    // el rey niño: nemes de rayas azules, cejas de lapislázuli, barba postiza y ureo sobre la frente
    poli(g, P.c, 14, 14, 50, 14, 56, 56, 40, 52, 40, 30, 24, 30, 24, 52, 8, 56);
    for (let y = 14; y < 54; y += 4) { r(g, 12 + (y > 40 ? -1 : 0), y, 8, 2, ESMALTE); r(g, 44 + (y > 40 ? 2 : 0), y, 8, 2, ESMALTE); }
    ovalo(g, 32, 30, 12, 15, P.c); ovalo(g, 32, 30, 10, 13, P.l); poli(g, P.c, 20, 12, 44, 12, 40, 20, 24, 20);
    trazo(g, ESMALTE, 2, 24, 26, 29, 25); trazo(g, ESMALTE, 2, 35, 25, 40, 26); r(g, 24, 29, 6, 2, NEGRO); r(g, 35, 29, 6, 2, NEGRO); r(g, 31, 33, 2, 5, P.o); trazo(g, P.o, 1, 28, 41, 32, 42, 36, 41);
    poli(g, ESMALTE, 29, 44, 35, 44, 36, 58, 32, 62, 28, 58); for (const y of [48, 52, 56]) r(g, 29, y, 7, 1, ORO); ovalo(g, 32, 11, 2, 3, '#c83040');
  };
  D.mascara_mosaico = (g, P) => {
    // rostro de teselas de turquesa y concha, con ojos de nácar y dientes de piedra
    ovalo(g, 32, 32, 20, 26, P.c);
    for (let y = 8; y < 58; y += 4) for (let x = 12; x < 52; x += 4) { const dx = (x - 32) / 20, dy = (y - 32) / 26; if (dx * dx + dy * dy < 1) r(g, x, y, 3, 3, (x + y * 3) % 5 === 0 ? ESMALTE : (x * 7 + y) % 3 ? P.c : P.l); }
    ovalo(g, 24, 28, 5, 4, '#fff6d8'); ovalo(g, 40, 28, 5, 4, '#fff6d8'); ovalo(g, 24, 28, 2, 2, NEGRO); ovalo(g, 40, 28, 2, 2, NEGRO); r(g, 20, 24, 8, 1, NEGRO); r(g, 36, 24, 8, 1, NEGRO);
    poli(g, P.o, 30, 32, 34, 32, 36, 42, 28, 42); r(g, 22, 48, 20, 5, '#fff6d8'); for (let x = 22; x < 42; x += 3) r(g, x, 48, 1, 5, P.o); r(g, 12, 18, 40, 1, '#c83040');
  };
  D.gema_rubi = (g, P) => {
    // rubí tallado en brillante, visto desde arriba, con una llama atrapada que parpadea adentro
    poli(g, P.c, 32, 4, 54, 20, 46, 54, 32, 60, 18, 54, 10, 20); poli(g, P.l, 32, 4, 10, 20, 32, 28); poli(g, P.m, 32, 4, 54, 20, 32, 28);
    poli(g, P.k, 10, 20, 32, 28, 18, 54); poli(g, P.l, 54, 20, 32, 28, 46, 54); poli(g, P.c, 32, 28, 18, 54, 32, 60, 46, 54);
    poli(g, '#ffb040', 32, 30, 28, 40, 30, 52, 34, 52, 36, 40); poli(g, '#fff2a0', 32, 38, 31, 46, 33, 46); trazo(g, P.o, 0.8, 10, 20, 54, 20);
  };
  D.corazon_glaciar = (g, P) => {
    // un corazón de hielo azul, partido por una grieta, con cristales que brotan en la punta
    poli(g, P.c, 32, 58, 8, 32, 8, 20, 16, 12, 26, 12, 32, 20, 38, 12, 48, 12, 56, 20, 56, 32); poli(g, P.l, 14, 16, 26, 14, 30, 22, 18, 30, 10, 24);
    poli(g, P.m, 32, 58, 56, 32, 44, 30, 32, 44); trazo(g, '#ffffff', 1.2, 36, 14, 33, 24, 38, 32, 32, 42, 35, 52);
    for (const [x, y, h] of [[8, 38, 12], [56, 36, 14], [20, 50, 10], [46, 52, 10]]) poli(g, P.l, x - 2, y + 6, x, y - h + 6, x + 2, y + 6);
    for (const [x, y] of [[20, 20], [42, 20], [26, 38], [44, 36]]) r(g, x, y, 2, 2, '#ffffff');
  };
  D.perla_negra = (g, P) => {
    // una gran perla negra en una concha abierta, con reflejos violetas y una cinta de agua
    poli(g, '#bba9a0', 6, 44, 20, 32, 32, 30, 44, 32, 58, 44, 50, 58, 32, 62, 14, 58); poli(g, '#e8dcd8', 12, 46, 22, 38, 42, 38, 52, 46, 44, 54, 20, 54);
    for (let k = -4; k <= 4; k++) trazo(g, '#8a7a72', 0.8, 32, 60, 32 + k * 6, 34);
    ovalo(g, 32, 34, 15, 15, '#08060c'); ovalo(g, 32, 34, 14, 14, '#2a2234'); ovalo(g, 32, 34, 11, 11, '#1a1424'); poli(g, '#6a50a0', 22, 28, 28, 22, 30, 24, 24, 32);
    r(g, 24, 26, 3, 3, '#ffffff'); r(g, 38, 42, 3, 2, '#7a60b0'); r(g, 33, 44, 5, 1, '#4a3a70');
  };
  D.ojo_kali = (g, P) => {
    // rubí vertical con forma de ojo, engarzado en plata con tres brazos de llama
    for (const [a, l] of [[-1.15, 26], [-0.6, 20], [0, 28], [0.6, 20], [1.15, 26]]) poli(g, '#c83040', 32, 34, 32 + Math.sin(a - 0.15) * 18, 34 - Math.cos(a - 0.15) * 18, 32 + Math.sin(a) * l, 34 - Math.cos(a) * l, 32 + Math.sin(a + 0.15) * 18, 34 - Math.cos(a + 0.15) * 18);
    poli(g, P.c, 6, 34, 32, 12, 58, 34, 32, 56); poli(g, '#fff6d8', 12, 34, 32, 18, 52, 34, 32, 50); poli(g, P.o, 12, 34, 32, 18, 52, 34, 32, 50, 12, 34);
    ovalo(g, 32, 34, 9, 12, RUBI_G); ovalo(g, 32, 34, 3, 9, NEGRO); r(g, 28, 28, 3, 3, '#ffd0d0');
  };

  // ---------- Coronas y yelmos ----------
  D.corona_oro = (g, P) => {
    // la doble corona: blanca del Alto Egipto dentro de la roja del Bajo, con la espiral delante
    poli(g, '#c83040', 14, 56, 18, 36, 24, 34, 24, 20, 30, 20, 30, 34, 50, 38, 52, 56); poli(g, '#e8505a', 16, 54, 20, 38, 26, 36, 26, 22, 28, 22, 28, 36, 44, 40, 46, 54);
    trazo(g, '#c83040', 2, 28, 22, 28, 6); trazo(g, P.c, 1.4, 28, 8, 30, 4, 33, 7, 31, 11); poli(g, '#f4f0e4', 36, 44, 34, 20, 38, 8, 44, 12, 46, 44); poli(g, '#ffffff', 37, 42, 36, 22, 40, 12, 41, 42);
    ovalo(g, 38, 8, 3.4, 3.4, '#f4f0e4'); r(g, 12, 52, 42, 7, P.c); r(g, 12, 52, 42, 2, P.l); r(g, 12, 58, 42, 1, P.o); for (const x of [18, 28, 38, 48]) ovalo(g, x, 55.5, 2, 2, P.gema);
    poli(g, P.c, 30, 52, 32, 44, 36, 44, 34, 52);
  };
  D.corona_plumas = (g, P) => {
    // abanico de plumas de quetzal, verdes y turquesa, sobre una banda de jade y oro
    for (let k = -6; k <= 6; k++) { const a = k * 0.2, l = 46 - Math.abs(k) * 2.2; poli(g, k % 2 ? ESMERALDA_G : '#2fb7a0', 32 + Math.sin(a - 0.07) * 6, 46 - Math.cos(a) * 4, 32 + Math.sin(a) * l, 46 - Math.cos(a) * l, 32 + Math.sin(a + 0.07) * 6, 46 - Math.cos(a) * 4); trazo(g, '#0a5a3a', 0.6, 32 + Math.sin(a) * 6, 46 - Math.cos(a) * 4, 32 + Math.sin(a) * (l - 3), 46 - Math.cos(a) * (l - 3)); ovalo(g, 32 + Math.sin(a) * (l - 2), 46 - Math.cos(a) * (l - 2), 2, 2.6, '#ffd24a'); }
    r(g, 10, 46, 44, 12, P.c); r(g, 10, 46, 44, 2, P.l); r(g, 10, 57, 44, 1, P.o);
    for (let x = 14; x < 52; x += 8) { poli(g, P.gema, x, 49, x + 3, 52, x, 55, x - 3, 52); }
    ovalo(g, 32, 52, 4, 4, ORO); ovalo(g, 32, 52, 2, 2, NEGRO);
  };
  D.diadema_valquiria = (g, P) => {
    // aro fino de plata con dos alas de águila a los lados y una gema azul en el centro
    for (const s of [-1, 1]) for (let i = 0; i < 6; i++) poli(g, i % 2 ? P.l : P.c, 32 + s * 10, 36 - i * 2, 32 + s * (12 + i * 4), 30 - i * 3, 32 + s * (12 + i * 4 - 3), 38 - i * 2, 32 + s * 10, 40 - i * 2);
    trazo(g, P.c, 3, 8, 44, 20, 50, 32, 52, 44, 50, 56, 44); trazo(g, P.l, 1, 8, 43, 20, 49, 32, 51, 44, 49, 56, 43);
    poli(g, P.gema, 32, 38, 38, 46, 32, 56, 26, 46); poli(g, '#ffffff', 32, 40, 30, 46, 32, 50); for (const x of [14, 50]) ovalo(g, x, 46, 2, 2, P.gema2);
  };
  D.diadema_ureo = (g, P) => {
    // banda de oro estrecha y una cobra erguida con la capucha abierta sobre la frente
    r(g, 8, 46, 48, 8, P.c); r(g, 8, 46, 48, 2, P.l); r(g, 8, 53, 48, 1, P.o); for (let x = 11; x < 54; x += 5) r(g, x, 49, 2, 2, x % 10 ? ESMALTE : '#c83040');
    poli(g, P.c, 20, 46, 24, 28, 28, 14, 36, 14, 40, 28, 44, 46); poli(g, P.l, 24, 44, 27, 28, 30, 16, 31, 44);
    ovalo(g, 32, 12, 5, 5, P.c); poli(g, P.m, 29, 14, 35, 14, 33, 22, 31, 22); r(g, 30, 10, 1, 1, '#c83040'); r(g, 34, 10, 1, 1, '#c83040'); r(g, 28, 16, 8, 1, P.o);
    for (const y of [24, 30, 36]) r(g, 25 + (y - 24) / 6, y, 14 - (y - 24) / 3, 1, P.o); trazo(g, '#c83040', 1, 32, 8, 32, 4);
  };
  D.yelmo_jarl = (g, P) => {
    // yelmo vikingo de hierro con guardacejas, nariguera, cota de malla y cuernos curvos
    for (const s of [-1, 1]) trazo(g, '#e8dcc0', 4, 32 + s * 14, 26, 32 + s * 22, 18, 32 + s * 20, 6);
    poli(g, P.c, 14, 40, 14, 24, 22, 14, 42, 14, 50, 24, 50, 40, 44, 40, 44, 30, 20, 30, 20, 40); r(g, 14, 30, 36, 3, P.m); r(g, 14, 30, 36, 1, P.l);
    poli(g, P.o, 20, 30, 44, 30, 44, 40, 40, 44, 38, 56, 32, 44, 26, 56, 24, 44, 20, 40); poli(g, P.k, 27, 36, 29, 36, 30, 44, 28, 44); poli(g, P.k, 35, 36, 37, 36, 36, 44, 34, 44);
    r(g, 30, 30, 4, 22, P.m); r(g, 30, 30, 1, 22, P.l); poli(g, P.c, 14, 40, 20, 40, 18, 56, 10, 52); poli(g, P.c, 50, 40, 44, 40, 46, 56, 54, 52);
    for (let y = 42; y < 55; y += 3) for (const x of [12, 46]) r(g, x, y, 5, 1, P.o);
  };
  D.corona_galeon = (g, P) => {
    // corona de plata y oro de arcos coronados de perlas, con cruz de esmeraldas sobre el globo
    poli(g, P.c, 10, 58, 12, 34, 20, 40, 24, 22, 32, 36, 40, 22, 44, 40, 52, 34, 54, 58); poli(g, P.l, 14, 56, 15, 40, 20, 46, 24, 30, 30, 42, 30, 56);
    r(g, 10, 52, 44, 8, ORO); r(g, 10, 52, 44, 2, '#f4d868'); r(g, 10, 59, 44, 1, ORO_O); for (let x = 15; x < 54; x += 8) ovalo(g, x, 56, 2.4, 2.4, x % 16 ? ESMERALDA_G : P.gema);
    for (const x of [12, 24, 40, 52]) { ovalo(g, x, x % 24 ? 32 : 20, 2.6, 2.6, PERLA); r(g, x - 1, x % 24 ? 30 : 18, 1, 1, '#ffffff'); }
    ovalo(g, 32, 34, 5, 5, ORO); r(g, 31, 16, 2, 14, ORO); r(g, 27, 20, 10, 2, ORO); for (const [x, y] of [[32, 16], [27, 21], [37, 21]]) ovalo(g, x, y, 1.6, 1.6, ESMERALDA_G);
  };
  D.yelmo_cruzado = (g, P) => {
    // gran yelmo cilíndrico con rendija en cruz, remache al centro y un tabardo que cuelga
    poli(g, '#e8e8f0', 12, 58, 14, 14, 22, 8, 42, 8, 50, 14, 52, 58); poli(g, P.c, 12, 58, 14, 14, 22, 8, 32, 8, 32, 58); r(g, 12, 30, 40, 2, P.o);
    r(g, 14, 33, 36, 7, P.k); r(g, 31, 14, 3, 40, P.k); for (const y of [24, 48]) r(g, 13, y, 38, 1, P.o);
    for (let i = 0; i < 4; i++) for (const s of [-1, 1]) r(g, 32 + s * (5 + i * 3) - 1, 34 + (i % 2) * 2, 2, 2, P.o);
    for (const [x, y] of [[16, 12], [46, 12], [16, 54], [46, 54]]) ovalo(g, x, y, 1.4, 1.4, P.l); poli(g, '#c83040', 28, 8, 36, 8, 34, -2, 30, -2); poli(g, '#c83040', 26, 8, 38, 8, 36, 12, 28, 12);
    poli(g, '#c83040', 18, 58, 46, 58, 44, 64, 20, 64); r(g, 31, 56, 3, 8, '#fff6d8'); r(g, 27, 59, 11, 2, '#fff6d8');
  };
  D.corona_escarcha = (g, P) => {
    // aro de carámbanos y cristales de hielo, de varias alturas, con una gran gema en el centro
    r(g, 8, 44, 48, 8, P.c); r(g, 8, 44, 48, 2, P.l); r(g, 8, 51, 48, 1, P.o);
    for (const [x, h] of [[12, 22], [18, 30], [25, 38], [32, 44], [39, 38], [46, 30], [52, 22]]) { poli(g, P.l, x - 3, 44, x, 44 - h * 0.9, x + 3, 44); poli(g, P.c, x, 44, x, 44 - h * 0.9, x + 3, 44); }
    for (const x of [14, 24, 40, 50]) poli(g, P.c, x - 2, 52, x, 60, x + 2, 52);
    poli(g, P.gema, 32, 40, 38, 48, 32, 56, 26, 48); poli(g, '#ffffff', 32, 42, 29, 48, 32, 52); r(g, 31, 4, 2, 2, '#ffffff');
  };

  // ---------- Cetros, cayados y bastones ----------
  D.cetro_oro = (g, P) => {
    // cetro heqa y mayal de Osiris: dos varas cruzadas, la ganchuda y la de tres tiras
    trazo(g, P.o, 5, 10, 56, 44, 18); trazo(g, P.c, 3.4, 10, 56, 44, 18); trazo(g, P.o, 5, 44, 18, 54, 10, 56, 4, 50, 4); trazo(g, P.c, 3.4, 44, 18, 54, 10, 56, 4, 50, 4);
    for (let i = 0; i < 6; i++) { const t = i / 6; r(g, 12 + t * 30, 54 - t * 36, 3, 3, i % 2 ? ESMALTE : '#c83040'); }
    trazo(g, P.o, 5, 54, 56, 20, 18); trazo(g, P.c, 3.4, 54, 56, 20, 18); for (const [x, y] of [[16, 14], [22, 10], [26, 18]]) { trazo(g, P.c, 1.6, 20, 18, x, y - 4, x - 1, y + 2); ovalo(g, x - 1, y + 3, 2, 2, ESMALTE); }
    ovalo(g, 32, 36, 4, 4, P.gema);
  };
  D.cayado_heka = (g, P) => {
    // el báculo del sacerdote: una larga vara de ébano con cabeza de ibis de oro y un nudo de vendas
    trazo(g, '#2a1a10', 4, 22, 62, 36, 14); trazo(g, '#5a3a22', 2, 21, 62, 35, 14);
    for (let i = 0; i < 6; i++) r(g, 24 + i * 2 - 2, 52 - i * 7, 6, 2, '#e8dcc0');
    poli(g, P.c, 30, 18, 28, 8, 36, 4, 46, 6, 54, 14, 48, 16, 42, 10, 38, 12, 40, 22); poli(g, P.l, 30, 16, 30, 9, 36, 6, 36, 10); poli(g, P.c, 46, 6, 58, 12, 60, 18, 56, 16, 48, 12);
    ovalo(g, 36, 9, 1.6, 1.6, NEGRO); ovalo(g, 34, 24, 3, 3, P.gema); r(g, 32, 20, 8, 2, P.o);
  };
  D.baculo_sectario = (g, P) => {
    // vara negra coronada por tres calaveras apiladas, con cintas rojas y una vela derretida
    trazo(g, '#1a1214', 5, 32, 62, 32, 24); trazo(g, '#4a3a3c', 2, 30, 62, 30, 24);
    const cal = (x, y, e) => { ovalo(g, x, y, 7 * e, 6 * e, '#e8e0cc'); r(g, x - 4 * e, y + 3 * e, 8 * e, 3 * e, '#e8e0cc'); ovalo(g, x - 2.6 * e, y - 0.5, 2 * e, 2 * e, NEGRO); ovalo(g, x + 2.6 * e, y - 0.5, 2 * e, 2 * e, NEGRO); r(g, x - 0.5, y + 2 * e, 1, 2, NEGRO); for (let k = -2; k <= 2; k++) r(g, x + k * 1.6, y + 5 * e, 1, 2, NEGRO); };
    cal(32, 40, 1.1); cal(24, 22, 0.9); cal(40, 22, 0.9); cal(32, 10, 0.8);
    poli(g, '#c83040', 30, 48, 34, 48, 40, 60, 36, 60, 32, 52, 28, 60, 24, 60); poli(g, '#f4f0e4', 46, 12, 50, 12, 50, 24, 46, 24); poli(g, '#ff9a2a', 48, 4, 46, 10, 50, 10);
  };

  // ---------- Calaveras ----------
  D.calavera_cristal = (g, P) => {
    // calavera de cuarzo transparente con facetas, un arcoíris en la mandíbula y luz por dentro
    poli(g, P.c, 14, 36, 12, 22, 20, 10, 32, 6, 44, 10, 52, 22, 50, 36, 44, 42, 44, 52, 20, 52, 20, 42); poli(g, P.l, 16, 24, 22, 12, 30, 10, 26, 26, 18, 36); poli(g, P.m, 34, 8, 46, 12, 50, 28, 36, 20);
    poli(g, 'rgba(255,255,255,0.4)', 22, 14, 30, 12, 24, 22); ovalo(g, 24, 30, 5, 5.5, P.k); ovalo(g, 40, 30, 5, 5.5, P.k); poli(g, P.k, 30, 38, 34, 38, 36, 44, 28, 44);
    for (let x = 22; x < 44; x += 4) { r(g, x, 46, 3, 8, x % 8 ? P.l : P.m); } r(g, 20, 50, 24, 1, ESMALTE); r(g, 20, 52, 24, 1, '#c83040');
    trazo(g, '#ffffff', 0.8, 18, 30, 26, 24); trazo(g, '#ffffff', 0.8, 40, 20, 46, 28);
  };
  D.silbato_calavera = (g, P) => {
    // silbato azteca de barro cocido con forma de calavera, con cordón y orificios de soplo
    ovalo(g, 32, 32, 20, 22, '#c8a878'); ovalo(g, 32, 32, 18, 20, '#d8b888'); poli(g, '#b88858', 14, 40, 18, 56, 30, 58, 28, 46);
    ovalo(g, 24, 28, 5, 6, '#2a1a0a'); ovalo(g, 40, 28, 5, 6, '#2a1a0a'); ovalo(g, 24, 28, 2, 2, '#fff6d8'); ovalo(g, 40, 28, 2, 2, '#fff6d8'); poli(g, '#2a1a0a', 30, 36, 34, 36, 36, 42, 28, 42);
    for (let x = 20; x < 44; x += 4) r(g, x, 46, 3, 5, '#fff6d8'); r(g, 20, 48, 24, 1, '#7a5a30');
    for (const [x, y] of [[32, 14], [26, 16], [38, 16]]) ovalo(g, x, y, 1.4, 1.4, '#7a5a30'); trazo(g, '#c83040', 1.4, 32, 8, 22, 4, 12, 10); ovalo(g, 32, 9, 2.4, 2.4, '#7a5a30');
  };
  D.calavera_bandera = (g, P) => {
    // el emblema pirata: calavera con dos huesos cruzados debajo, sobre un paño negro agitado
    poli(g, '#0e0e14', 4, 8, 22, 4, 40, 10, 60, 6, 60, 56, 40, 60, 22, 54, 4, 58); poli(g, '#1c1c28', 4, 8, 22, 4, 22, 54, 4, 58);
    trazo(g, '#f4f0e4', 3.4, 18, 36, 46, 56); trazo(g, '#f4f0e4', 3.4, 46, 36, 18, 56); for (const [x, y] of [[17, 35], [47, 35], [17, 57], [47, 57]]) { ovalo(g, x - 1.5, y, 2.4, 2.4, '#f4f0e4'); ovalo(g, x + 1.5, y, 2.4, 2.4, '#f4f0e4'); }
    ovalo(g, 32, 24, 11, 11, '#f4f0e4'); r(g, 25, 30, 14, 6, '#f4f0e4'); ovalo(g, 27, 23, 3.4, 3.4, '#0e0e14'); ovalo(g, 37, 23, 3.4, 3.4, '#0e0e14'); poli(g, '#0e0e14', 31, 28, 33, 28, 34, 32, 30, 32);
    for (let x = 27; x < 38; x += 2.6) r(g, x, 33, 1, 3, '#0e0e14');
  };

  // ---------- Ídolos y figurillas ----------
  D.idolo_jade = (g, P) => {
    // dios jaguar sentado, con colmillos y orejeras, en un jade veteado; una pata alzada
    poli(g, P.c, 16, 60, 18, 40, 24, 30, 22, 14, 28, 6, 40, 6, 44, 14, 42, 30, 48, 40, 50, 60); poli(g, P.l, 20, 58, 22, 40, 26, 32, 28, 10, 30, 10, 30, 58); poli(g, P.m, 40, 58, 42, 38, 38, 28, 42, 14, 46, 40, 48, 58);
    ovalo(g, 25, 11, 3, 3, P.o); ovalo(g, 41, 11, 3, 3, P.o); r(g, 28, 14, 3, 2, NEGRO); r(g, 35, 14, 3, 2, NEGRO); poli(g, P.o, 31, 18, 35, 18, 34, 22, 32, 24, 30, 22);
    poli(g, '#f4f0e4', 29, 24, 31, 24, 30, 30); poli(g, '#f4f0e4', 35, 24, 37, 24, 36, 30); for (let y = 36; y < 56; y += 5) trazo(g, P.o, 1, 22, y, 28, y + 2); for (let y = 36; y < 56; y += 5) trazo(g, P.o, 1, 44, y, 38, y + 2);
    r(g, 14, 56, 36, 4, P.k);
  };
  D.idolo_kali = (g, P) => {
    // la diosa negra de cuatro brazos con la lengua fuera y un collar de cabezas
    for (const [x, y, a] of [[10, 22, -1], [10, 36, -1], [54, 22, 1], [54, 36, 1]]) { trazo(g, P.c, 3.4, 32 + a * 6, 30, x, y); ovalo(g, x, y, 2.4, 2.4, P.l); }
    poli(g, P.c, 20, 60, 22, 36, 24, 26, 40, 26, 42, 36, 44, 60); ovalo(g, 32, 16, 8, 9, P.c); ovalo(g, 32, 12, 8, 4, NEGRO); r(g, 26, 14, 4, 2, '#ffffff'); r(g, 34, 14, 4, 2, '#ffffff');
    poli(g, '#c83040', 30, 20, 34, 20, 34, 30, 32, 32, 30, 30); r(g, 30, 18, 4, 1, NEGRO); for (let x = 22; x < 44; x += 4) ovalo(g, x, 30 + Math.abs(x - 32) * -0.2 + 2, 2.2, 2.4, '#f4f0e4');
    for (let y = 40; y < 58; y += 6) r(g, 24, y, 16, 1, P.o); r(g, 16, 58, 32, 4, P.k);
  };
  D.ushebti = (g, P) => {
    // figurilla funeraria momiforme de fayenza azul, brazos cruzados con mayal y azada, jeroglíficos en columna
    poli(g, ESMALTE, 22, 60, 20, 36, 22, 22, 24, 12, 32, 6, 40, 12, 42, 22, 44, 36, 42, 60); poli(g, '#4a78e8', 24, 58, 23, 38, 26, 18, 28, 12, 30, 12, 30, 58);
    poli(g, '#1a2a6a', 22, 14, 42, 14, 44, 24, 20, 24); for (let y = 16; y < 24; y += 3) r(g, 22, y, 20, 1, '#4a78e8'); r(g, 28, 24, 2, 2, NEGRO); r(g, 34, 24, 2, 2, NEGRO); r(g, 31, 28, 2, 2, NEGRO);
    trazo(g, '#1a2a6a', 2, 24, 34, 40, 38); trazo(g, '#1a2a6a', 2, 40, 34, 24, 38); for (let y = 42; y < 58; y += 5) glifo(g, [['.#.', '###'], ['###', '#.#'], ['#.#', '.#.']][(y / 5 | 0) % 3], 29, y, '#1a2a6a', 1);
    r(g, 26, 60, 12, 3, '#1a2a6a');
  };
  D.idolo_ganesha = (g, P) => {
    // dios elefante sentado: orejas grandes, trompa curva, colmillo roto, cuatro brazos y un dulce en la mano
    ovalo(g, 32, 46, 18, 16, P.c); ovalo(g, 32, 48, 14, 11, P.l); ovalo(g, 32, 24, 11, 12, P.c); ovalo(g, 16, 22, 8, 12, P.m); ovalo(g, 48, 22, 8, 12, P.m); ovalo(g, 16, 22, 5, 9, P.c); ovalo(g, 48, 22, 5, 9, P.c);
    trazo(g, P.c, 5, 32, 26, 32, 38, 26, 46, 22, 44); poli(g, '#f4f0e4', 37, 32, 40, 34, 38, 38); ovalo(g, 27, 20, 1.4, 1.4, NEGRO); ovalo(g, 37, 20, 1.4, 1.4, NEGRO);
    poli(g, ORO, 24, 10, 40, 10, 38, 6, 32, 2, 26, 6); r(g, 26, 8, 12, 1, ORO_O); for (const [x, y] of [[10, 40], [54, 40]]) { trazo(g, P.c, 3, 24, 38, x, y); } ovalo(g, 8, 44, 3, 3, '#f0a050');
    ovalo(g, 56, 40, 3, 3, ORO); r(g, 28, 56, 8, 4, P.k);
  };
  D.figurilla_maiz = (g, P) => {
    // el dios del maíz: figura joven con tocado de mazorca y barbas de maíz que le caen como pelo
    poli(g, P.c, 24, 62, 24, 44, 28, 34, 36, 34, 40, 44, 40, 62); ovalo(g, 32, 28, 7, 8, P.c); poli(g, P.l, 28, 24, 30, 24, 29, 34);
    r(g, 29, 28, 2, 1, P.o); r(g, 35, 28, 2, 1, P.o); r(g, 31, 32, 3, 1, P.o);
    poli(g, '#e8c840', 24, 20, 32, 2, 40, 20); for (const [x, y] of [[28, 12], [32, 8], [36, 12], [30, 16], [34, 16]]) ovalo(g, x, y, 1.6, 1.6, '#f8e060'); poli(g, ESMERALDA_G, 22, 26, 26, 8, 28, 24); poli(g, ESMERALDA_G, 42, 26, 38, 8, 36, 24);
    for (let k = 0; k < 6; k++) trazo(g, '#c8a040', 1.2, 26 + k * 2.4, 20, 22 + k * 4.4, 40); trazo(g, P.c, 3, 26, 38, 18, 48); trazo(g, P.c, 3, 38, 38, 46, 48);
    ovalo(g, 17, 50, 3, 4, '#e8c840'); ovalo(g, 47, 50, 3, 4, '#e8c840');
  };

  // ---------- Cuernos, hachas y armas de asta ----------
  D.cuerno_heimdall = (g, P) => {
    // largo cuerno de marfil pálido con bandas de plata, boca de oro y cordón; apunta hacia arriba
    for (let i = 0; i < 22; i++) { const t = i / 21, x = 14 + t * 36 + Math.sin(t * 2) * 2, y = 54 - Math.sin(t * 1.6) * 44, w = 8 - t * 5.6; ovalo(g, x, y, w, w, i % 5 === 0 ? P.c : MARFIL_G); }
    for (const t of [0.2, 0.5, 0.78]) { const x = 14 + t * 36 + Math.sin(t * 2) * 2, y = 54 - Math.sin(t * 1.6) * 44, w = 8 - t * 5.6; ovalo(g, x, y, w + 1, w + 1, P.c); ovalo(g, x, y, w - 0.6, w - 0.6, MARFIL_G); }
    ovalo(g, 50, 11, 3, 3, ORO); ovalo(g, 50, 11, 1.4, 1.4, NEGRO); poli(g, '#c83040', 6, 58, 12, 56, 18, 60, 10, 62);
    for (const [x, y] of [[20, 52], [28, 48], [36, 40]]) r(g, x, y, 4, 1, '#ffffff');
  };
  D.cuerno_guerra = (g, P) => {
    // cuerno de carnero retorcido en espiral, de hueso oscuro, con tiras de cuero y una boquilla de bronce
    for (let i = 0; i < 40; i++) { const t = i / 40 * Math.PI * 2.4, rr = 22 - i * 0.42, x = 30 + Math.cos(t + 2.8) * rr, y = 34 + Math.sin(t + 2.8) * rr * 0.9, w = 7 - i * 0.13; ovalo(g, x, y, w, w, i % 3 ? '#8a7a5a' : '#6a5a3a'); }
    for (let i = 0; i < 40; i += 4) { const t = i / 40 * Math.PI * 2.4, rr = 22 - i * 0.42; r(g, 30 + Math.cos(t + 2.8) * rr - 1, 34 + Math.sin(t + 2.8) * rr * 0.9 - 4, 2, 5, '#4a3a24'); }
    trazo(g, CUERO_G, 2, 8, 40, 20, 52, 40, 54); r(g, 4, 34, 8, 8, P.c); ovalo(g, 8, 38, 3, 3, P.k); r(g, 4, 34, 8, 1, P.l);
  };
  D.hacha_barbuda = (g, P) => {
    // hacha de hoja ancha con "barba" larga que cuelga, mango de fresno y puño de cuero trenzado
    r(g, 29, 8, 5, 54, NOGAL); r(g, 29, 8, 1, 54, '#c89a60'); r(g, 29, 8, 5, 1, NOGAL_O); for (let y = 36; y < 60; y += 3) { r(g, 28, y, 7, 1, CUERO_G); }
    poli(g, HIERRO, 34, 10, 56, 6, 60, 26, 56, 52, 46, 38, 34, 30); poli(g, '#bcbcc8', 38, 12, 54, 9, 56, 24, 38, 26); poli(g, HIERRO_O, 34, 10, 56, 6, 56, 9, 34, 14);
    for (let i = 0; i < 3; i++) trazo(g, HIERRO_O, 1, 40, 26 + i * 6, 52, 34 + i * 8); r(g, 54, 6, 2, 46, '#e8e8f0'); ovalo(g, 31, 5, 3, 3, ORO);
  };
  D.martillo_mjolnir = (g, P) => {
    // el martillo de Thor: cabeza cuadrada de hierro con nudos grabados, mango corto, correa y relámpagos
    poli(g, '#4a4a60', 4, 8, 48, 10, 50, 30, 6, 30); r(g, 6, 10, 42, 3, '#8a8aa8'); r(g, 6, 28, 42, 2, '#2a2a3c');
    for (let x = 10; x < 46; x += 8) trazo(g, '#2a2a3c', 1.2, x, 14, x + 4, 20, x, 26); r(g, 4, 8, 4, 22, '#6a6a88');
    r(g, 24, 30, 6, 28, NOGAL); r(g, 24, 30, 1, 28, '#c89a60'); for (let y = 36; y < 54; y += 3) r(g, 23, y, 8, 1, CUERO_G); ovalo(g, 27, 60, 3, 3, '#4a4a60');     trazo(g, '#fff06a', 1.6, 54, 4, 48, 14, 54, 14, 46, 28); trazo(g, '#fff06a', 1.6, 60, 22, 56, 32, 60, 32, 54, 44); poli(g, '#fff06a', 46, 26, 50, 36, 44, 34);
  };
  D.macana_jaguar = (g, P) => {
    // macuahuitl: tabla de madera con filos de obsidiana a ambos lados y empuñadura con plumas
    r(g, 26, 8, 12, 40, '#7a5028'); r(g, 26, 8, 3, 40, '#a8783c'); r(g, 35, 8, 3, 40, '#4a2e14');
    for (let y = 10; y < 46; y += 5) { poli(g, '#0e0e18', 26, y, 20, y + 2, 26, y + 4); poli(g, '#0e0e18', 38, y, 44, y + 2, 38, y + 4); poli(g, '#3a3a60', 26, y, 22, y + 1, 26, y + 2); }
    poli(g, '#7a5028', 26, 8, 32, 2, 38, 8); r(g, 28, 48, 8, 14, CUERO_G); for (let y = 50; y < 62; y += 3) r(g, 28, y, 8, 1, NOGAL_O);
    for (const [x, c] of [[26, ESMERALDA_G], [30, '#2fb7a0'], [34, '#c83040'], [38, ESMERALDA_G]]) poli(g, c, x, 48, x - 3, 56, x, 62, x + 2, 56);
    for (const [x, y] of [[30, 20], [34, 30], [30, 38]]) ovalo(g, x, y, 1.6, 1.6, '#c8a850');
  };

  // ---------- Catalejos y brújulas ----------
  D.catalejo_almirante = (g, P) => {
    // catalejo de latón y cuero con tres tramos, tapa de lente y el nombre grabado; en diagonal
    const seg = (x0, y0, x1, y1, w, c, c2) => { trazo(g, c2, w + 2, x0, y0, x1, y1); trazo(g, c, w, x0, y0, x1, y1); trazo(g, '#ffffff', 1, x0, y0 - w / 2 + 1, x1, y1 - w / 2 + 1); };
    seg(10, 54, 28, 36, 8, CUERO_G, '#2a1a0a'); seg(28, 36, 42, 22, 6.4, P.c, P.o); seg(42, 22, 54, 10, 5, P.m, P.o);
    for (const [x, y] of [[20, 44], [30, 34], [40, 24]]) { trazo(g, P.o, 1.4, x - 2, y + 2, x + 2, y - 2); } ovalo(g, 56, 8, 4.4, 4.4, P.l); ovalo(g, 56, 8, 3, 3, P.k); ovalo(g, 8, 56, 3, 3, P.k);
    for (let i = 0; i < 6; i++) { const t = i / 5; r(g, 11 + t * 14, 53 - t * 14, 2, 2, '#e8dcc0'); } ovalo(g, 55, 7, 1.4, 1.4, '#9ad8ff');
  };
  D.catalejo_grumete = (g, P) => {
    // catalejo roto: el tubo partido en dos con el cristal rajado, atado con una cuerda para que no se pierda
    trazo(g, '#2a1a0a', 8, 6, 58, 26, 38); trazo(g, '#8a6a3a', 6, 6, 58, 26, 38); trazo(g, '#2a1a0a', 7, 38, 28, 54, 10); trazo(g, '#8a6a3a', 5, 38, 28, 54, 10);
    poli(g, '#8a6a3a', 26, 36, 32, 40, 30, 46, 24, 40); poli(g, '#8a6a3a', 36, 30, 38, 24, 42, 30); for (const [x, y] of [[28, 38], [34, 33], [36, 30]]) r(g, x, y, 2, 2, '#2a1a0a');
    ovalo(g, 56, 8, 4, 4, '#7a8a9a'); ovalo(g, 56, 8, 2.8, 2.8, '#2a3a4a'); trazo(g, '#ffffff', 0.8, 54, 6, 57, 10); trazo(g, '#ffffff', 0.8, 56, 5, 55, 11);
    trazo(g, '#e8dcc0', 1.4, 26, 38, 30, 44, 34, 40, 38, 48, 32, 54); ovalo(g, 7, 57, 3, 3, '#4a3a24');
  };
  D.brujula_laton = (g, P) => {
    // brújula de bolsillo de latón, con tapa abierta, rosa de los vientos y una aguja azul y roja
    aro(g, 28, 34, 22, 22, P.c, P.o); ovalo(g, 28, 34, 19, 19, '#f4f0e0');     for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2; trazo(g, P.o, k % 4 ? 0.6 : 1.4, 28 + Math.cos(a) * 15, 34 + Math.sin(a) * 15, 28 + Math.cos(a) * 18, 34 + Math.sin(a) * 18); }
    poli(g, '#c83040', 28, 34, 24, 30, 36, 18, 32, 28); poli(g, ESMALTE, 28, 34, 32, 38, 20, 50, 24, 40); ovalo(g, 28, 34, 2, 2, P.c); r(g, 27, 12, 2, 4, P.o);
    poli(g, P.c, 48, 24, 62, 20, 62, 48, 48, 44); poli(g, P.l, 50, 26, 60, 24, 60, 30, 50, 32); r(g, 26, 8, 4, 5, P.c); ovalo(g, 28, 7, 3, 2, P.m);
  };

  // ---------- Cofres y relicarios ----------
  D.cofrecillo_perlas = (g, P) => {
    // cofrecillo de concha pulida con tapa abombada, bisagras de plata y perlas sobre la cerradura
    poli(g, '#d8b8a8', 8, 30, 12, 14, 52, 14, 56, 30); poli(g, '#f0d8d0', 12, 28, 16, 17, 34, 16, 32, 28); r(g, 8, 30, 48, 28, '#c8a898'); r(g, 8, 30, 48, 3, P.c); r(g, 8, 30, 48, 1, P.l);
    for (let x = 12; x < 52; x += 6) for (let y = 36; y < 56; y += 6) r(g, x + ((y / 6) % 2) * 3, y, 3, 3, (x + y) % 4 ? '#e8d0c8' : '#b898a8');
    r(g, 8, 52, 48, 6, P.o); r(g, 8, 52, 48, 1, P.c); r(g, 28, 30, 8, 10, P.c); ovalo(g, 32, 38, 3, 3, PERLA);
    for (const [x, y, rr] of [[20, 22, 2.6], [32, 10, 3.2], [44, 22, 2.6], [14, 26, 2]]) { ovalo(g, x, y, rr, rr, PERLA); r(g, x - 1, y - 1, 1, 1, '#ffffff'); }
  };
  D.relicario_plata = (g, P) => {
    // relicario en forma de casa gótica, con tejado a dos aguas, vitral al frente y un hueso dentro
    poli(g, P.c, 8, 28, 32, 6, 56, 28); poli(g, P.l, 12, 28, 32, 10, 32, 28); r(g, 12, 28, 40, 30, P.c); r(g, 8, 28, 48, 3, P.o); r(g, 8, 58, 48, 4, P.o);
    for (let x = 12; x < 54; x += 4) r(g, x, 14 + Math.abs(x - 32) * 0.12, 2, 2, P.l);
    poli(g, '#1a1a2a', 22, 54, 22, 36, 26, 32, 38, 32, 42, 36, 42, 54); poli(g, '#e8dcc0', 26, 40, 38, 40, 36, 50, 28, 50); r(g, 31, 42, 2, 6, '#a89870'); ovalo(g, 32, 40, 2.4, 1.4, '#e8dcc0');
    r(g, 22, 44, 20, 1, P.c); poli(g, '#c83040', 24, 34, 26, 34, 25, 38); poli(g, ESMALTE, 38, 34, 40, 34, 39, 38); r(g, 31, 2, 2, 6, P.c); r(g, 29, 4, 6, 2, P.c);
  };

  // ---------- Discos, espejos y sellos ----------
  D.espejo_pirita = (g, P) => {
    // espejo redondo de pirita dorada con facetas de cristal cúbico y marco de jade con cordón
    ovalo(g, 32, 34, 25, 25, '#5a6a50'); ovalo(g, 32, 34, 22, 22, '#b89a30');
    for (let y = 14; y < 56; y += 6) for (let x = 12; x < 54; x += 6) { const dx = x - 32, dy = y - 34; if (dx * dx + dy * dy < 400) { r(g, x, y, 5, 5, (x + y) % 12 ? '#d8bc50' : '#8a6a1a'); r(g, x, y, 5, 1, '#f4e080'); } }
    ovalo(g, 32, 34, 22, 22, 'rgba(255,240,160,0.15)'); poli(g, 'rgba(255,255,255,0.4)', 18, 22, 24, 16, 30, 22, 22, 30);
    r(g, 29, 6, 6, 5, P.c); ovalo(g, 32, 6, 5, 3, P.l); trazo(g, '#c83040', 1.4, 32, 8, 20, 2, 12, 8);
  };
  D.sello_templario = (g, P) => {
    // lacre de cera roja con la cruz del Temple, dos caballeros en un caballo y cinta arrugada
    poli(g, '#e8dcc0', 18, 0, 26, 0, 30, 20, 22, 22); poli(g, '#d8c8a0', 38, 0, 46, 0, 42, 22, 34, 20); ovalo(g, 32, 38, 24, 22, '#8a1624');
    for (let a = 0; a < 18; a++) { const t = a / 18 * Math.PI * 2, rr = 20 + (a % 3) * 1.4; ovalo(g, 32 + Math.cos(t) * rr, 38 + Math.sin(t) * rr * 0.92, 4, 4, '#8a1624'); }
    ovalo(g, 32, 38, 19, 17, '#c02838'); aro(g, 32, 38, 15, 14, '#a81e30', '#5a0a14');
    poli(g, '#5a0a14', 28, 28, 36, 28, 36, 34, 42, 34, 42, 42, 36, 42, 36, 48, 28, 48, 28, 42, 22, 42, 22, 34, 28, 34); poli(g, '#e04858', 18, 28, 24, 26, 20, 34);
  };
  D.espejo_bronce = (g, P) => {
    // espejo de mano de bronce pulido con mango en forma de mujer, y un reflejo del sol
    ovalo(g, 32, 26, 20, 22, P.o); ovalo(g, 32, 26, 18, 20, P.l); poli(g, 'rgba(255,255,255,0.55)', 20, 20, 28, 12, 34, 14, 24, 26); poli(g, 'rgba(255,255,255,0.3)', 38, 34, 44, 30, 42, 40);
    poli(g, P.c, 24, 46, 40, 46, 36, 52, 28, 52); poli(g, P.c, 28, 52, 36, 52, 34, 62, 30, 62); ovalo(g, 32, 50, 5, 3, P.m); r(g, 29, 54, 6, 1, P.o); r(g, 29, 58, 6, 1, P.o);
    for (let a = 0; a < 40; a++) { const t = a / 40 * Math.PI * 2; r(g, 32 + Math.cos(t) * 20, 26 + Math.sin(t) * 22, 1, 1, P.k); }
  };
  D.disco_jepri = (g, P) => {
    // disco solar del amanecer: semicírculo de oro naciendo del horizonte con rayos terminados en manos
    r(g, 4, 48, 56, 12, '#4a3a24'); r(g, 4, 48, 56, 2, '#7a6030');
    for (let k = -5; k <= 5; k++) { const a = -Math.PI / 2 + k * 0.28; trazo(g, ORO, 1.4, 32 + Math.cos(a) * 14, 48 + Math.sin(a) * 14, 32 + Math.cos(a) * 32, 48 + Math.sin(a) * 32); ovalo(g, 32 + Math.cos(a) * 33, 48 + Math.sin(a) * 33, 1.6, 1.6, ORO); }
    for (let y = 48; y > 28; y -= 1) { const w = Math.sqrt(Math.max(0, 14 * 14 - (48 - y) * (48 - y))); r(g, 32 - w, y, w * 2, 1, y > 40 ? '#ff9a2a' : '#ffd24a'); }
    r(g, 24, 44, 16, 1, '#fff6d8'); ovalo(g, 32, 38, 4, 4, '#fff6d8');
  };

  // ---------- Piedras sagradas y runas ----------
  D.piedra_rubi = (g, P) => {
    // gran rubí pulido ovalado sobre un pedestal de oro, con una cruz de luz atravesándolo
    ovalo(g, 32, 28, 20, 22, RUBI_G); ovalo(g, 32, 28, 17, 19, P.c); ovalo(g, 32, 30, 12, 14, P.l); poli(g, '#ffffff', 22, 16, 30, 10, 30, 20); trazo(g, '#ffe8e8', 1, 32, 8, 32, 48); trazo(g, '#ffe8e8', 1, 12, 28, 52, 28);
    poli(g, ORO, 12, 58, 18, 46, 46, 46, 52, 58); r(g, 12, 56, 40, 4, ORO_O); r(g, 18, 46, 28, 2, '#f4d868'); for (const x of [18, 32, 46]) r(g, x - 1, 50, 2, 4, ORO_O);
    for (const [x, y] of [[14, 16], [50, 14], [52, 44]]) r(g, x, y, 2, 2, '#ffe8e8');
  };
  D.piedra_diamante = (g, P) => {
    // diamante de talla marquesa, casi cegador, con rayos de luz y un anillo blanco girando
    for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2; trazo(g, 'rgba(255,255,255,0.7)', k % 2 ? 0.8 : 1.6, 32 + Math.cos(a) * 20, 32 + Math.sin(a) * 20, 32 + Math.cos(a) * (k % 2 ? 26 : 30), 32 + Math.sin(a) * (k % 2 ? 26 : 30)); }
    poli(g, '#e0f4ff', 32, 6, 50, 24, 32, 58, 14, 24); poli(g, '#ffffff', 32, 6, 14, 24, 32, 28); poli(g, '#b8dcf4', 32, 6, 50, 24, 32, 28); poli(g, '#8ac0e8', 14, 24, 32, 28, 32, 58); poli(g, '#cfe8ff', 50, 24, 32, 28, 32, 58);
    trazo(g, '#6aa0d0', 0.8, 14, 24, 50, 24); trazo(g, '#6aa0d0', 0.8, 23, 15, 32, 28, 41, 15); r(g, 24, 18, 3, 3, '#ffffff');
  };
  D.runas_hueso = (g, P) => {
    // bolsita de cuero abierta y cinco fichas de hueso con runas rojas desparramadas
    poli(g, CUERO_G, 36, 30, 60, 26, 62, 56, 38, 60); trazo(g, '#2a1a0a', 1.4, 38, 31, 58, 28); poli(g, '#4a3220', 36, 30, 44, 24, 54, 24, 60, 26);
    for (const [x, y, a, g2] of [[6, 14, -0.3, ['#.#', '###', '#.#']], [24, 10, 0.2, ['##.', '.#.', '.##']], [10, 36, 0.1, ['#..', '###', '..#']], [26, 38, -0.2, ['.#.', '###', '.#.']], [16, 52, 0.15, ['###', '..#', '###']]]) {
      g.save(); g.translate(x + 8, y + 8); g.rotate(a); r(g, -8, -8, 16, 16, '#e8e0c8'); r(g, -8, 6, 16, 2, '#b8a888'); r(g, -8, -8, 16, 1, '#ffffff'); glifo(g, g2, -4, -5, '#a82020', 2); g.restore();
    }
  };

  // ---------- Libros, papiros y mapas ----------
  D.tablilla_grial = (g, P) => {
    // tablilla de piedra con tres hileras de símbolos: un pan, un cáliz y un paso, grabados a cincel
    poli(g, P.c, 8, 6, 54, 4, 58, 56, 12, 60); poli(g, P.l, 8, 6, 54, 4, 54, 10, 10, 12); poli(g, P.k, 54, 4, 58, 56, 54, 54);
    trazo(g, P.o, 1, 12, 20, 54, 20); trazo(g, P.o, 1, 12, 38, 54, 38);
    ovalo(g, 18, 14, 4, 2.4, P.o); ovalo(g, 18, 14, 2.4, 1.2, P.l); poli(g, P.o, 30, 8, 40, 8, 38, 14, 34, 16, 32, 14); r(g, 34, 16, 2, 3, P.o); poli(g, P.o, 44, 9, 50, 9, 48, 18, 46, 18);
    r(g, 14, 26, 6, 8, P.o); r(g, 22, 28, 6, 6, P.o); r(g, 32, 26, 2, 8, P.o); r(g, 36, 28, 8, 2, P.o); r(g, 36, 32, 8, 2, P.o); r(g, 46, 26, 4, 8, P.o);
    for (let x = 14; x < 52; x += 7) { r(g, x, 44, 2, 10, P.o); r(g, x + 2, 44 + (x % 14 ? 2 : 6), 3, 1, P.o); } trazo(g, P.k, 1, 22, 60, 26, 52);
  };
  D.paleta_escriba = (g, P) => {
    // paleta de escriba de madera con dos pozos de tinta, roja y negra, y cañas de junco
    poli(g, '#a8783c', 6, 22, 56, 18, 58, 42, 8, 46); poli(g, '#c8985c', 6, 22, 56, 18, 56, 22, 6, 26); r(g, 6, 44, 52, 2, '#6a4a1a');
    ovalo(g, 18, 32, 5.4, 4.4, '#2a1a0a'); ovalo(g, 18, 32, 4, 3, '#0a0a0e'); ovalo(g, 34, 32, 5.4, 4.4, '#2a1a0a'); ovalo(g, 34, 32, 4, 3, '#c83040');
    r(g, 44, 28, 2, 10, '#6a4a1a'); r(g, 48, 28, 2, 10, '#6a4a1a'); for (let k = 0; k < 3; k++) trazo(g, '#4a8a3a', 1.6, 10 + k * 4, 14 - k, 44 + k * 4, 54 + k); poli(g, '#8a6a30', 8, 12, 50, 8, 52, 12, 10, 16);
    glifo(g, ['.#.', '###', '#.#'], 12, 38, '#4a2a0a', 1); glifo(g, ['##.', '.##', '##.'], 26, 38, '#4a2a0a', 1);
  };
  D.papiro_muertos = (g, P) => {
    // rollo de papiro desenrollado con el pesaje del corazón: balanza, pluma y un chacal
    poli(g, '#e4d098', 8, 8, 56, 8, 56, 56, 8, 56); for (let y = 8; y < 56; y += 3) r(g, 8, y, 48, 1, 'rgba(160,120,50,0.25)');
    ovalo(g, 8, 32, 4, 24, '#c8a850'); ovalo(g, 56, 32, 4, 24, '#c8a850'); ovalo(g, 8, 32, 2, 21, '#e4d098'); ovalo(g, 56, 32, 2, 21, '#e4d098');
    r(g, 31, 14, 2, 22, '#2a1a0a'); r(g, 20, 14, 24, 2, '#2a1a0a'); trazo(g, '#2a1a0a', 1, 20, 16, 16, 26); trazo(g, '#2a1a0a', 1, 20, 16, 24, 26); trazo(g, '#2a1a0a', 1, 44, 16, 40, 26); trazo(g, '#2a1a0a', 1, 44, 16, 48, 26);
    ovalo(g, 20, 27, 5, 1.6, '#c83040'); poli(g, '#2a6a8a', 40, 26, 48, 26, 44, 24); poli(g, '#2a1a0a', 12, 46, 18, 38, 22, 40, 26, 46, 22, 50); poli(g, '#2a1a0a', 44, 46, 50, 38, 52, 46);
    for (let x = 12; x < 52; x += 5) glifo(g, [['#.#', '.#.'], ['###', '#..']][(x / 5 | 0) % 2], x, 50, '#2a1a0a', 1); r(g, 30, 10, 4, 3, '#2a8a3a');
  };
  D.salterio = (g, P) => {
    // libro de salmos iluminado, abierto: letra capital dorada, márgenes con hojas y notas musicales
    poli(g, '#5a2a1a', 4, 12, 60, 12, 60, 58, 4, 58); poli(g, '#f0e4c0', 6, 10, 31, 12, 31, 56, 6, 54); poli(g, '#f4ead0', 33, 12, 58, 10, 58, 54, 33, 56); r(g, 31, 10, 2, 46, '#a89868');
    r(g, 8, 14, 11, 11, ORO); r(g, 9, 15, 9, 9, '#c83040'); glifo(g, ['###', '#..', '#..', '###'], 10, 17, ORO, 2);
    for (let y = 16; y < 52; y += 4) { r(g, 21, y, 8, 1, '#4a3a2a'); r(g, 9, y + 10 > 24 ? y : 99, 18, 1, '#4a3a2a'); }
    for (let y = 16; y < 50; y += 8) { for (let k = 0; k < 5; k++) r(g, 36, y + k * 1.4, 18, 0.6, '#2a1a0a'); ovalo(g, 40 + (y % 3) * 4, y + 2, 1.4, 1.2, '#2a1a0a'); r(g, 41 + (y % 3) * 4, y - 4, 1, 6, '#2a1a0a'); }
    trazo(g, ESMERALDA_G, 1.4, 6, 54, 14, 50, 28, 54); trazo(g, '#c83040', 1.4, 58, 54, 50, 50, 36, 54); r(g, 50, 6, 3, 8, '#c83040');
  };
  D.pagina_diario = (g, P) => {
    // hoja suelta arrugada con borde quemado, un croquis a tinta, una cruz marcada y una mancha de café
    poli(g, '#d8c8a0', 10, 8, 36, 4, 56, 10, 52, 30, 56, 54, 28, 60, 8, 54, 12, 32); poli(g, '#e8dcb8', 12, 10, 36, 6, 40, 40, 14, 52);
    poli(g, '#5a3a1a', 52, 30, 56, 54, 50, 52, 54, 36); poli(g, '#2a1a0a', 54, 12, 56, 24, 52, 20);
    trazo(g, '#2a2a3a', 1, 14, 16, 30, 14, 40, 16); trazo(g, '#2a2a3a', 1, 14, 22, 36, 22); trazo(g, '#2a2a3a', 1, 14, 28, 28, 28);
    poli(g, '#4a6a4a', 16, 38, 22, 32, 28, 38, 34, 34, 38, 44, 18, 46); trazo(g, '#c83040', 2, 26, 36, 32, 44); trazo(g, '#c83040', 2, 32, 36, 26, 44);
    ovalo(g, 44, 44, 6, 5, 'rgba(120,70,30,0.5)'); ovalo(g, 44, 44, 4, 3, 'rgba(120,70,30,0.35)');
  };
  D.mapa_capitan = (g, P) => {
    // mapa con siete islas, una cruz roja, línea punteada de ruta, rosa de los vientos y un monstruo marino
    poli(g, '#e8d4a0', 4, 6, 60, 4, 62, 58, 2, 60); r(g, 4, 6, 56, 1, '#8a6a30'); r(g, 4, 58, 56, 1, '#8a6a30'); ovalo(g, 8, 6, 3, 3, '#6a4a1a'); ovalo(g, 8, 6, 2, 2, '#b89850');
    for (const [x, y, w, h] of [[10, 14, 8, 6], [26, 10, 7, 5], [44, 14, 9, 6], [14, 32, 7, 6], [32, 28, 6, 5], [48, 36, 8, 6], [24, 48, 8, 5]]) { ovalo(g, x + w / 2, y + h / 2, w, h, '#9a8040'); ovalo(g, x + w / 2, y + h / 2, w - 1.5, h - 1.4, '#7ea068'); }
    for (let t = 0; t < 14; t++) r(g, 16 + t * 2.6, 20 + Math.sin(t * 0.8) * 8 + t * 2, 2, 1, '#7a3a1a');
    trazo(g, '#c83040', 2.4, 49, 38, 55, 44); trazo(g, '#c83040', 2.4, 55, 38, 49, 44);
    poli(g, '#5a3a1a', 52, 48, 54, 56, 52, 62, 50, 56); r(g, 46, 55, 12, 1, '#5a3a1a');
    trazo(g, '#2a6a4a', 1.6, 6, 48, 10, 44, 14, 48, 18, 44); poli(g, '#2a6a4a', 18, 44, 22, 40, 22, 46);
  };

  // ---------- Escudos ----------
  D.escudo_cuervo = (g, P) => {
    // escudo redondo de madera pintado de negro, con un cuervo de alas abiertas y un ombligo metálico
    ovalo(g, 32, 32, 28, 28, P.o); ovalo(g, 32, 32, 26, 26, '#1a1a24'); ovalo(g, 32, 32, 24, 24, '#2a2a38');
    for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2; r(g, 32 + Math.cos(a) * 25 - 1, 32 + Math.sin(a) * 25 - 1, 2, 2, P.c); }
    poli(g, '#08080c', 32, 14, 40, 22, 52, 18, 46, 30, 40, 34, 32, 50, 24, 34, 18, 30, 12, 18, 24, 22); poli(g, '#4a4a68', 20, 20, 30, 24, 28, 34, 18, 30); poli(g, '#08080c', 29, 8, 35, 8, 36, 16, 28, 16);
    poli(g, '#e8b83a', 36, 11, 40, 12, 36, 14); ovalo(g, 33, 12, 1, 1, '#ffffff'); ovalo(g, 32, 32, 6, 6, P.c); ovalo(g, 32, 32, 3, 3, P.l);
  };
  D.escudo_gran_maestre = (g, P) => {
    // escudo heráldico partido en cuatro: cruces rojas y blancas, y la estrella de ocho puntas al centro
    poli(g, P.o, 6, 6, 58, 6, 58, 34, 32, 62, 6, 34); poli(g, '#f4f0e4', 8, 8, 32, 8, 32, 34, 8, 34); poli(g, '#c83040', 32, 8, 56, 8, 56, 34, 32, 34); poli(g, '#c83040', 8, 34, 32, 34, 32, 58, 8, 36);
    poli(g, '#f4f0e4', 32, 34, 56, 34, 32, 58); r(g, 18, 12, 4, 14, '#c83040'); r(g, 13, 17, 14, 4, '#c83040'); r(g, 42, 12, 4, 14, '#f4f0e4'); r(g, 37, 17, 14, 4, '#f4f0e4');
    for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; poli(g, ORO, 32 + Math.cos(a - 0.2) * 5, 34 + Math.sin(a - 0.2) * 5, 32 + Math.cos(a) * 12, 34 + Math.sin(a) * 12, 32 + Math.cos(a + 0.2) * 5, 34 + Math.sin(a + 0.2) * 5); }
    ovalo(g, 32, 34, 4, 4, '#1a1a24'); trazo(g, P.c, 2, 6, 6, 58, 6); trazo(g, P.c, 1, 6, 6, 6, 34, 32, 62, 58, 34, 58, 6);
  };

  // ---------- Brazaletes, anillos y espuelas ----------
  D.brazalete_oro = (g, P) => {
    // brazalete de pepitas de oro en bruto, con un engaste burdo y marcas de pico
    g.strokeStyle = P.o; g.lineWidth = 10; g.beginPath(); g.ellipse(32, 36, 22, 20, 0, 0, Math.PI * 2); g.stroke(); g.strokeStyle = P.c; g.lineWidth = 7; g.beginPath(); g.ellipse(32, 36, 22, 20, 0, 0, Math.PI * 2); g.stroke();
    for (let a = 0; a < 14; a++) { const t = a / 14 * Math.PI * 2; ovalo(g, 32 + Math.cos(t) * 22, 36 + Math.sin(t) * 20, 3 + (a % 3), 2.6 + (a % 2), a % 3 ? P.c : P.l); r(g, 32 + Math.cos(t) * 22 - 2, 36 + Math.sin(t) * 20 - 2, 2, 1, '#fff6c0'); }
    poli(g, '#6a5a50', 26, 6, 38, 6, 40, 14, 24, 14); r(g, 28, 8, 3, 2, '#9a8a80'); trazo(g, P.o, 1, 22, 28, 26, 32); trazo(g, P.o, 1, 40, 30, 44, 36);
  };
  D.fibula_bronce = (g, P) => {
    // fíbula de arco, con resorte en espiral y pie largo, patinada de verdín
    trazo(g, P.o, 5, 8, 42, 20, 14, 38, 10, 52, 22); trazo(g, P.c, 3.4, 8, 42, 20, 14, 38, 10, 52, 22); trazo(g, '#4a9a78', 1.2, 14, 28, 24, 16, 36, 13);
    for (let k = 0; k < 4; k++) { } ovalo(g, 52, 24, 5, 5, P.o); ovalo(g, 52, 24, 3, 3, P.c);
    trazo(g, P.c, 1.6, 52, 28, 14, 56); poli(g, P.c, 6, 46, 14, 44, 14, 58, 6, 56); r(g, 6, 46, 8, 2, '#4a9a78'); for (const x of [18, 28, 38]) { ovalo(g, x + 6 - (x - 18) * 0.2, 14 - (x - 18) * 0.1 + 4, 1.6, 1.6, '#4a9a78'); }
    r(g, 22, 56, 14, 1, P.o);
  };
  D.brazalete_plata = (g, P) => {
    // brazalete de tres hebras de plata trenzadas con remates en cabezas de dragón
    for (const [off, c] of [[-4, P.c], [0, P.l], [4, P.m]]) { g.strokeStyle = c; g.lineWidth = 3.4; g.beginPath(); for (let a = 0; a <= 40; a++) { const t = a / 40 * Math.PI * 1.8 + 0.5, w = Math.sin(a * 0.9 + off) * 3; const x = 32 + Math.cos(t) * (22 + w), y = 34 + Math.sin(t) * (22 + w); a ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); }
    for (const s of [-1, 1]) { const x = 32 + s * 17, y = 54; poli(g, P.c, x - s * 4, y - 5, x + s * 6, y - 2, x + s * 8, y + 4, x, y + 6); ovalo(g, x + s * 3, y - 1, 1.4, 1.4, NEGRO); poli(g, P.l, x + s * 6, y - 2, x + s * 11, y - 2, x + s * 8, y + 2); }
    for (let a = 0; a < 6; a++) { const t = a / 6 * Math.PI * 1.8 + 0.7; r(g, 32 + Math.cos(t) * 22, 34 + Math.sin(t) * 22, 2, 2, '#ffffff'); }
  };
  D.anillo_esmeralda = (g, P) => {
    // anillo de oro visto de frente, con una gran esmeralda tallada en escalera, rodeada de pequeñas perlas
    g.strokeStyle = ORO_O; g.lineWidth = 9; g.beginPath(); g.ellipse(32, 38, 16, 18, 0, 0, Math.PI * 2); g.stroke(); g.strokeStyle = ORO; g.lineWidth = 6; g.beginPath(); g.ellipse(32, 38, 16, 18, 0, 0, Math.PI * 2); g.stroke();
    poli(g, ORO, 18, 22, 46, 22, 50, 12, 14, 12); poli(g, ORO_O, 18, 22, 46, 22, 46, 24, 18, 24); poli(g, ESMERALDA_G, 18, 4, 46, 4, 50, 10, 50, 20, 46, 24, 18, 24, 14, 20, 14, 10); poli(g, '#3ed888', 22, 8, 42, 8, 44, 12, 44, 18, 42, 20, 22, 20, 20, 18, 20, 12); poli(g, '#aaf0c8', 24, 10, 40, 10, 40, 16, 24, 16); r(g, 26, 11, 6, 2, '#ffffff');
    for (const x of [14, 50]) ovalo(g, x, 8, 2, 2, PERLA); for (const x of [14, 50]) ovalo(g, x, 22, 2, 2, PERLA);
  };
  D.orejeras_jade = (g, P) => {
    // par de orejeras de jade: discos con un tubo central, uno visto de frente y otro de lado, con cuentas colgantes
    ovalo(g, 20, 24, 15, 15, P.o); ovalo(g, 20, 24, 13, 13, P.c); ovalo(g, 20, 24, 8, 8, P.l); ovalo(g, 20, 24, 4, 4, P.k);     poli(g, P.c, 36, 10, 62, 10, 62, 38, 36, 38); r(g, 36, 10, 26, 2, P.l); r(g, 36, 36, 26, 2, P.o); r(g, 42, 18, 14, 12, P.m); r(g, 42, 18, 14, 1, P.o); r(g, 42, 29, 14, 1, P.o);
    for (const [x, c] of [[12, 1], [20, 2], [28, 1]]) { trazo(g, P.o, 0.8, x, 40, x, 46); ovalo(g, x, 49, 2.6, 3, c % 2 ? P.c : P.l); ovalo(g, x, 56, 2, 2.6, P.m); }
    for (const x of [42, 50, 58]) { trazo(g, P.o, 0.8, x, 40, x, 44); ovalo(g, x, 47, 2.2, 2.6, P.c); }
  };
  D.brazalete_marfil = (g, P) => {
    // brazalete tallado de un colmillo, con una hilera de elefantes en procesión alrededor
    g.strokeStyle = '#a89868'; g.lineWidth = 12; g.beginPath(); g.ellipse(32, 36, 22, 20, 0, 0, Math.PI * 2); g.stroke(); g.strokeStyle = MARFIL_G; g.lineWidth = 9; g.beginPath(); g.ellipse(32, 36, 22, 20, 0, 0, Math.PI * 2); g.stroke();
    for (let a = 0; a < 5; a++) { const t = a / 5 * Math.PI * 2 - 1.2, x = 32 + Math.cos(t) * 22, y = 36 + Math.sin(t) * 20; ovalo(g, x, y, 3.4, 2.8, '#7a6a48'); ovalo(g, x + 2.4, y - 1.8, 1.6, 1.6, '#7a6a48'); trazo(g, '#7a6a48', 1, x + 3.4, y - 1, x + 4.4, y + 2); r(g, x - 3, y + 2, 1, 2, '#7a6a48'); r(g, x + 1, y + 2, 1, 2, '#7a6a48'); }
    poli(g, '#fff6e0', 20, 14, 30, 8, 34, 10, 24, 18); for (let a = 0; a < 8; a++) { const t = a / 8 * Math.PI * 2; r(g, 32 + Math.cos(t) * 26, 36 + Math.sin(t) * 24, 1, 1, '#a89868'); }
  };
  D.espuelas_caballero = (g, P) => {
    // un par de espuelas de rodaja con correas de cuero, una arriba y otra abajo, y estrellas de hierro
    for (const [oy, rot] of [[0, 1], [30, -1]]) {
      trazo(g, P.o, 5, 8, 14 + oy, 12, 28 + oy - (rot < 0 ? 10 : 0), 36, 30 + oy - (rot < 0 ? 10 : 0), 44, 18 + oy); trazo(g, P.c, 3, 8, 14 + oy, 12, 28 + oy - (rot < 0 ? 10 : 0), 36, 30 + oy - (rot < 0 ? 10 : 0), 44, 18 + oy);
      r(g, 4, 12 + oy, 5, 6, CUERO_G); r(g, 44, 14 + oy, 5, 6, CUERO_G); trazo(g, P.c, 3, 44, 18 + oy, 52, 22 + oy);
      for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; poli(g, P.l, 56 + Math.cos(a - 0.3) * 3, 22 + oy + Math.sin(a - 0.3) * 3, 56 + Math.cos(a) * 8, 22 + oy + Math.sin(a) * 8, 56 + Math.cos(a + 0.3) * 3, 22 + oy + Math.sin(a + 0.3) * 3); }
      ovalo(g, 56, 22 + oy, 3, 3, P.c); ovalo(g, 56, 22 + oy, 1.2, 1.2, P.k);
    }
  };

  // ---------- Cruces ----------
  D.cruz_peregrino = (g, P) => {
    // cruz sencilla de madera tosca atada con cordel, con una concha y un trozo de papel doblado
    poli(g, '#7a5028', 28, 4, 38, 4, 38, 62, 28, 62); poli(g, '#7a5028', 10, 20, 56, 20, 56, 30, 10, 30); r(g, 28, 4, 3, 58, '#a8783c'); r(g, 10, 20, 46, 3, '#a8783c'); r(g, 36, 6, 2, 56, '#4a2e14'); r(g, 10, 28, 46, 2, '#4a2e14');
    for (let k = 0; k < 6; k++) trazo(g, '#e8dcc0', 1.4, 27, 18 + k * 2, 39, 22 + k * 2); for (const [x, y] of [[32, 10], [32, 40], [16, 24]]) ovalo(g, x, y, 0.8, 1.6, '#4a2e14');
    ovalo(g, 32, 44, 7, 6, '#e8dcc0'); for (let k = -3; k <= 3; k++) trazo(g, '#b8a888', 0.8, 32, 50, 32 + k * 2, 40); poli(g, '#f4ead0', 40, 36, 54, 40, 52, 52, 38, 48); trazo(g, '#8a7a5a', 0.8, 42, 42, 50, 44);
  };
  D.cruz_negra = (g, P) => {
    // cruz de hierro ennegrecido de brazos que se ensanchan, con un borde de plata y un corazón rojo
    poli(g, '#08080c', 26, 4, 38, 4, 38, 24, 58, 24, 58, 38, 38, 38, 38, 60, 26, 60, 26, 38, 6, 38, 6, 24, 26, 24); poli(g, '#1c1c28', 28, 6, 36, 6, 36, 26, 56, 26, 56, 36, 36, 36, 36, 58, 28, 58, 28, 36, 8, 36, 8, 26, 28, 26);
    poli(g, '#2a2a3c', 28, 6, 30, 6, 30, 58, 28, 58); poli(g, '#2a2a3c', 8, 26, 56, 26, 56, 28, 8, 28);
    trazo(g, P.c, 1.2, 26, 4, 38, 4, 38, 24, 58, 24, 58, 38, 38, 38, 38, 60, 26, 60, 26, 38, 6, 38, 6, 24, 26, 24, 26, 4);
    ovalo(g, 32, 32, 5, 5, '#8a1020'); ovalo(g, 32, 32, 3, 3, '#c83040'); r(g, 30, 30, 2, 2, '#ffb0b0'); for (const [x, y] of [[32, 10], [32, 54], [12, 32], [52, 32]]) ovalo(g, x, y, 1.6, 1.6, P.c);
  };

  return D;
}
