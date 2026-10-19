// Hitos: pinturas, relieves y estatuas que hacen reconocible cada sala de los laberintos,
// para que el jugador sepa si ya pasó por ahí sin abrir el mapa.
//
// Cada mazmorra tiene su repertorio según su ambiente. En cada zona los motivos se reparten sin
// repetirse hasta agotar el repertorio, y no todas las salas tienen uno (las que no, también se recuerdan).
// Sale de la semilla de la partida, así que todos los jugadores ven los mismos hitos.

// Murales: van pintados o tallados sobre un muro de la sala. `friso`: cubren todo ese lado de la sala.
// Estatuas: se alzan en el centro de la sala y no dejan pasar.
const MURALES = {
  jeroglificos: { tex: 'hito_jeroglificos', friso: true },
  disco_alado: { tex: 'hito_disco_alado' },
  ojo: { tex: 'hito_ojo' },
  manos: { tex: 'hito_manos' },
  espiral: { tex: 'hito_espiral' },
  runas: { tex: 'hito_runas', friso: true },
  escudo: { tex: 'hito_escudo' },
  calavera: { tex: 'hito_calavera' },
  serpiente: { tex: 'hito_serpiente', friso: true },
  calendario: { tex: 'hito_calendario' },
  mascara: { tex: 'hito_mascara' },
  cruz: { tex: 'hito_cruz' },
};
const ESTATUAS = ['chacal', 'obelisco', 'guerrero', 'cabeza', 'idolo', 'menhir'];

const REPERTORIO = {
  cripta: ['jeroglificos', 'disco_alado', 'ojo', 'manos', 'chacal', 'obelisco'],
  desierto: ['jeroglificos', 'disco_alado', 'ojo', 'espiral', 'chacal', 'obelisco'],
  nieve: ['runas', 'escudo', 'manos', 'espiral', 'guerrero', 'menhir'],
  mar: ['calavera', 'escudo', 'manos', 'espiral', 'idolo', 'guerrero'],
  selva: ['serpiente', 'calendario', 'mascara', 'manos', 'cabeza', 'idolo'],
  lava: ['serpiente', 'calendario', 'mascara', 'ojo', 'cabeza', 'idolo'],
  catacumba: ['cruz', 'escudo', 'calavera', 'runas', 'guerrero', 'obelisco'],
};

const PROBABILIDAD = 0.65;   // salas con hito
const V = [[0, -1], [1, 0], [0, 1], [-1, 0]];

// Devuelve [{ tipo: 'mural', x, y, dx, dy, tex }] (casilla de muro y dirección hacia la sala)
// y [{ tipo: 'estatua', x, y, tex }] (casilla del suelo que ocupa). Las casillas con estatua quedan
// marcadas con `estatua` (sólidas, ver js/mapa.js).
export function colocarHitos(mapa, salas, azar) {
  const def = mapa.def;
  const repertorio = REPERTORIO[def.ambiente] || REPERTORIO.cripta;
  const mezclar = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(azar() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const hitos = [];
  const bolsas = {};   // zona -> motivos que aún no salieron
  const sacar = zona => {
    if (!bolsas[zona]?.length) bolsas[zona] = mezclar(repertorio.slice());
    return bolsas[zona].pop();
  };
  // un muro liso (sin antorcha, tablilla, pasadizo...) que da a una casilla de la sala
  const muroLiso = (x, y) => {
    const c = mapa.celda(x, y);
    return c && c.tipo === 'muro' && !c.antorcha && def.plano[y][x] === '#';
  };
  const libre = (x, y) => {
    const c = mapa.celda(x, y);
    return c && c.tipo === 'suelo' && !c.trampa && !c.peligro && def.plano[y][x] === '.';
  };

  for (const s of salas) {
    if (azar() > PROBABILIDAD) continue;
    const cx = (s.x0 + s.x1) >> 1, cy = (s.y0 + s.y1) >> 1;
    const zona = mapa.celda(cx, cy)?.zona ?? 0;
    let motivo = sacar(zona);

    if (ESTATUAS.includes(motivo)) {
      // de pie en el centro, con las cuatro casillas vecinas libres para rodearla
      const inicio = Math.floor(mapa.inicio.x) === cx && Math.floor(mapa.inicio.z) === cy;
      if (!inicio && libre(cx, cy) && V.every(([dx, dy]) => !mapa.solida(cx + dx, cy + dy))) {
        mapa.celda(cx, cy).estatua = 'estatua_' + motivo;
        hitos.push({ tipo: 'estatua', x: cx, y: cy, tex: 'estatua_' + motivo });
        continue;
      }
      motivo = repertorio.find(m => MURALES[m]);
    }

    // el lado de la sala con más muro liso
    const lados = [
      { dx: 0, dy: 1, celdas: rango(s.x0, s.x1).map(x => [x, s.y0 - 1]) },
      { dx: 0, dy: -1, celdas: rango(s.x0, s.x1).map(x => [x, s.y1 + 1]) },
      { dx: 1, dy: 0, celdas: rango(s.y0, s.y1).map(y => [s.x0 - 1, y]) },
      { dx: -1, dy: 0, celdas: rango(s.y0, s.y1).map(y => [s.x1 + 1, y]) },
    ];
    for (const l of lados) l.lisas = l.celdas.filter(([x, y]) => muroLiso(x, y));
    const lado = mezclar(lados).sort((a, b) => b.lisas.length - a.lisas.length)[0];
    if (!lado.lisas.length) continue;
    const m = MURALES[motivo];
    // un mural suelto va en la casilla lisa más cercana al centro de ese lado
    const medio = lado.celdas[lado.celdas.length >> 1];
    const donde = m.friso ? lado.lisas : [lado.lisas.slice().sort((a, b) => dist(a, medio) - dist(b, medio))[0]];
    for (const [x, y] of donde) hitos.push({ tipo: 'mural', x, y, dx: lado.dx, dy: lado.dy, tex: m.tex });
  }
  return hitos;
}

const rango = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const dist = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
