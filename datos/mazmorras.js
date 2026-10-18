// Mazmorras. Cada carácter del plano es una casilla de 1 x 1 metros.
//
// Leyenda base (js/mapa.js), que cada mazmorra puede ampliar o redefinir en `leyenda`:
//   #  muro             .  suelo            P  inicio del jugador
//   D  puerta           S  pasadizo secreto (parece muro; se empuja con «Usar»)
//   X  salida           !  antorcha en el muro
//   R  revólver         b  balas            v  vendas (vida)
//   m  momia            k  esqueleto
//   0-9 tesoros (según `tesoros`)
//   Las tablillas y los sellos se definen en `acertijos`: la tablilla muestra una pista
//   críptica y, al resolverla, se abren todos los sellos con el mismo acertijo.
//
// `luces`: rectángulos [x0, y0, x1, y1, luz] con luz entre 0 y 1 (por defecto `luz`).

export const MAZMORRAS = [
  {
    id: 'cripta-escarabajo',
    nombre: 'La Cripta del Escarabajo',
    descripcion: 'Una tumba menor bajo las arenas. Buen lugar para empezar.',
    muro: 'piedra', suelo: 'losa', techo: 'techo',
    luz: 0.62,
    angulo: 0,
    tesoros: { 1: 'monedas_cobre', 2: 'caliz_plata', 3: 'idolo_oro' },
    acertijos: {
      T: { id: 'escriba', tipo: 'pista', dificultad: [1, 2], sello: 'Z', titulo: 'La tablilla del escriba' },
    },
    plano: [
      '###########T#############',
      '#.....#.........#.......#',
      '#..P..#....1....#..k.R..#',
      '!.....D.........D....b..#',
      '#.....#.........#.......#',
      '###S###...m.....#########',
      '#.....#.........#########',
      '#.3.k.#.........#########',
      '#...b.#....v....#########',
      '###########D#############',
      '#######...k.....#.......#',
      '#######.........#..2....#',
      '######X.....m...Z.......#',
      '#######.......b.#....b..#',
      '#######.........#.......#',
      '#########################',
    ],
    luces: [[1, 6, 5, 8, 0.35], [17, 10, 23, 14, 0.85], [7, 10, 15, 14, 0.5]],
  },
  {
    id: 'templo-arenas',
    nombre: 'El Templo de las Arenas',
    descripcion: 'Dos inscripciones custodian las cámaras del templo. La más difícil guarda algo legendario.',
    muro: 'arenisca', suelo: 'arena', techo: 'techo_arena',
    luz: 0.7,
    angulo: -Math.PI / 2,
    leyenda: { S: { tipo: 'secreto', tex: 'arenisca_grieta' } },
    tesoros: { 1: 'gema_zafiro', 2: 'escarabajo_oro', 3: 'mascara_oro' },
    acertijos: {
      T: { id: 'sacerdote', tipo: 'pista', dificultad: [2, 3], sello: 'Z', titulo: 'La inscripción del sacerdote' },
      U: { id: 'faraon', tipo: 'pista', dificultad: [4, 5], sello: 'Y', titulo: 'La inscripción del faraón' },
    },
    plano: [
      '#########################',
      '#########.......#####...#',
      '#########...1...#####.3.#',
      '#########.......#####...#',
      '############Z###T#####Y##',
      '#...#...............#...#',
      '#.R.#...#.......#...#.m.#',
      '#...D.....k....k....D...#',
      '#.b.#......m........#...U',
      '#...#...#.......#...#.b.#',
      '#.v.#...............#...#',
      '############D############',
      '#.......#.......#########',
      '#..2..k.S...P...#########',
      '#...b...#.......#########',
      '#.......#.......#########',
      '############X############',
    ],
    luces: [[1, 12, 7, 15, 0.3], [21, 1, 23, 3, 0.9], [9, 1, 15, 3, 0.85]],
  },
];
