// Mazmorras. Cada carácter del plano es una casilla de 1 x 1 metros.
//
// Leyenda base (js/mapa.js), que cada mazmorra puede ampliar o redefinir en `leyenda`:
//   #  muro             .  suelo            P  inicio del jugador
//   D  puerta           S  pasadizo secreto (parece muro; se empuja con «Usar»)
//   X  salida           !  antorcha en el muro
//   R  revólver         b  balas            v  vendas (vida)
//   m  momia            k  esqueleto        g  draugr
//   p  pirata           j  guerrero jaguar  c  sectario        n  caballero cruzado
//   Los enemigos del plano son los propios de la mazmorra y sus sitios, solo un punto de partida: en cada
//   partida algunos quedan vacíos, otros cambian de monstruo y otros aparecen en cualquier parte, muchos
//   escondidos hasta que te acercas (js/fauna.js). `bestias`: cuáles de las bestias gigantes (escorpion,
//   arana, serpiente) pueden soltarse en la mazmorra (por defecto todas); `coloso: false` quita el coloso.
//   ^  pinchos (suben y bajan)   ~  lava (quema)   _  abismo (caída mortal)
//   :  puente oculto (parece abismo, pero se puede pisar)   f  cáliz falso (trampa)
//   0-9 tesoros (según `tesoros`)
//   L / Q: tablilla y sello del ala nueva (como T / Z, U / Y, V / W)
//   Las tablillas y los sellos se definen en `acertijos`: la tablilla muestra una pista
//   críptica y, al resolverla, se abren todos los sellos con el mismo acertijo.
//
// `luces`: rectángulos [x0, y0, x1, y1, luz] con luz entre 0 y 1 (por defecto `luz`).
// `alturas`: plano paralelo con la altura del suelo de cada casilla: '.' a ras de suelo,
//   '1'..'9' suben 0.3 m por número (un escalón se sube caminando; 0.6 m o más ya no),
//   'a'..'e' bajan 0.3 m por letra (fosos y salas hundidas).
// `zonas`: rectángulos [x0, y0, x1, y1, {suelo, techo, muro, cielo, desnivel}] con otras texturas;
//   `cielo` es la altura del techo y `desnivel` la textura de escalones y paredes entre alturas.
// `laberinto`: túneles que se generan de nuevo en cada partida (js/laberinto.js), pegados `abajo` o a la
//   `derecha` del plano; `puerta` es la casilla del borde del plano que se vuelve puerta hacia ellos,
//   y `tesoros` los que se esconden en los callejones más hondos.
// `sectores`: la mazmorra crece en varias zonas generadas que se abren con acertijos (ver js/laberinto.js).
// `derrumbe`: [x, y] la entrada (un muro «%» de escombros) que se viene abajo al empezar.
// `ambiente`: sonido de fondo (cripta, desierto, nieve, mar, selva, lava o catacumba).
// `texTablilla`, `texSello`: texturas de tablillas y sellos. `tinte`: color de la luz [r, g, b].
// `avisos`: { carácter: 'texto' } pone inscripciones en el muro que se leen con «Usar».
// `guardian`: { tipo, nombre } el jefe que vigila la reliquia más valiosa (tipos en GUARDIANES, js/juego.js).

export const MAZMORRAS = [
  {
    id: 'cripta-escarabajo',
    guardian: { tipo: 'faraon', nombre: 'Jepri, el faraón escarabajo' },
    // Cuatro zonas: el plano fijo con los túneles de abajo, las galerías a la derecha, el hipogeo abajo
    // y, tras un pasadizo secreto y un sello, la cámara de Jepri con la reliquia más valiosa.
    sectores: {
      bloques: [
        { x: 0, y: 16, ancho: 43, alto: 17, zona: 0 },
        { x: 43, y: 0, ancho: 41, alto: 33, zona: 1 },
        { x: 0, y: 33, ancho: 63, alto: 29, zona: 2 },
        { x: 63, y: 33, ancho: 21, alto: 29, zona: 3, luz: 0.5, textura: { suelo: 'arena' } },
      ],
      entrada: [9, 16],
      inicio: { salas: 7, enemigos: ['m', 'k', 'g'] },
      pasos: [[0, 1, 42, 25], [1, 2, 52, 32], [2, 3, 62, 47]],
      salida: [1, 2],
      zonas: [
        { nombre: 'La antecámara', tesoros: ['ushebti', 'paleta_escriba'], camaras: 1, acertijo: { dificultad: [1, 2], titulo: 'La estela de las galerías' } },
        { nombre: 'Las galerías del embalsamador', tesoros: ['cuchillo_embalsamador', 'jarra_natron', 'amuleto_tyet', 'escarabajo_corazon'], camaras: 2, acertijo: { dificultad: [2, 3], titulo: 'El papiro del embalsamador' } },
        { nombre: 'El hipogeo del sumo sacerdote', tesoros: ['pesas_deben', 'papiro_muertos', 'cayado_heka', 'diadema_ureo'], camaras: 2, acertijo: { dificultad: [3, 4], titulo: 'La invocación del sumo sacerdote' } },
        { nombre: 'La cámara de Jepri', tesoros: ['escarabajo_jepri'] },
      ],
    },
    ambiente: 'cripta',
    nombre: 'La Cripta del Escarabajo',
    descripcion: 'Una tumba bajo las arenas, más honda de lo que parece. Cuatro zonas y una salida que hay que encontrar.',
    muro: 'piedra', suelo: 'losa', techo: 'techo',
    luz: 0.62,
    angulo: 0,
    tesoros: { 1: 'monedas_cobre', 2: 'caliz_plata', 3: 'idolo_oro' , 4: 'vaso_canopo', 5: 'escarabajo_lapis', 6: 'collar_escarabajo'},
    acertijos: {
      T: { id: 'escriba', tipo: 'pista', dificultad: [1, 2], sello: 'Z', titulo: 'La tablilla del escriba' },
      L: { id: 'galeria', tipo: 'pista', dificultad: [2, 3], sello: 'Q', titulo: 'El friso de la galería' },
    },
    // El plano de la primera zona no es fijo: `sectores.inicio` lo talla en cada partida (js/laberinto.js).
    // Aquí solo queda su tamaño (43 x 17, con la puerta a la zona 2 abajo) y la casilla de inicio de relleno.
    plano: Array.from({ length: 17 }, (_, y) => y === 1 ? '#P' + '#'.repeat(41) : '#'.repeat(43)),
  },
  {
    id: 'templo-arenas',
    guardian: { tipo: 'anubis', nombre: 'El sacerdote de Anubis' },
    ampliacion: [
      { nombre: 'El templo', camaras: 2, acertijo: { dificultad: [2, 3], titulo: 'El obelisco del patio' } },
      { nombre: 'Los almacenes del templo', tesoros: ['daga_bronce', 'anfora_aceite', 'monedas_plata', 'cetro_bronce'], camaras: 2, acertijo: { dificultad: [3, 4], titulo: 'El inventario del escriba real' } },
      { nombre: 'La necrópolis de los sacerdotes', tesoros: ['escarabajo_bronce', 'anfora_jade', 'daga_plata', 'amuleto_oro'], camaras: 2, acertijo: { dificultad: [3, 4], titulo: 'La letanía de los sacerdotes' } },
      { nombre: 'El santuario del primer faraón', tesoros: ['corona_oro'] },
    ],
    laberinto: { lado: 'abajo', puerta: [14, 16], ancho: 43, alto: 17, tesoros: ['espejo_bronce', 'collar_cornalina'] },
    // La primera zona se talla en cada partida (js/laberinto.js, `generarInicio`): aquí su tamaño, sus monstruos y los peligros sueltos.
    inicio: { ancho: 44, alto: 17, enemigos: ['k', 'm'], peligros: {} },
    ambiente: 'desierto',
    nombre: 'El Templo de las Arenas',
    descripcion: 'Dos inscripciones custodian las cámaras del templo. La más difícil guarda algo legendario.',
    muro: 'arenisca', suelo: 'arena', techo: 'techo_arena',
    luz: 0.7,
    angulo: -Math.PI / 2,
    texTablilla: 'tablilla_arenisca',
    leyenda: { S: { tipo: 'secreto', tex: 'arenisca_grieta' } },
    tesoros: { 1: 'gema_zafiro', 2: 'escarabajo_oro', 3: 'mascara_oro' , 4: 'ojo_horus', 6: 'ankh_oro'},
    acertijos: {
      T: { id: 'sacerdote', tipo: 'pista', dificultad: [2, 3], sello: 'Z', titulo: 'La inscripción del sacerdote' },
      U: { id: 'faraon', tipo: 'pista', dificultad: [4, 5], sello: 'Y', titulo: 'La inscripción del faraón' },
      L: { id: 'sala-hipostila', tipo: 'pista', dificultad: [3, 4], sello: 'Q', titulo: 'La columna del arquitecto' },
    },
  },

  {
    id: 'glaciar-jarl',
    guardian: { tipo: 'jarl', nombre: 'El Jarl de hielo' },
    ampliacion: [
      { nombre: 'La fortaleza', camaras: 2, acertijo: { dificultad: [2, 3], titulo: 'La piedra rúnica del puente' } },
      { nombre: 'Las criptas de hielo', tesoros: ['fibula_bronce', 'runas_hueso', 'brazalete_plata', 'cuerno_heimdall'], camaras: 2, acertijo: { dificultad: [3, 4], titulo: 'El conjuro de la völva' } },
      { nombre: 'El túmulo de los guerreros', tesoros: ['plata_corte', 'hacha_barbuda', 'escudo_cuervo', 'yelmo_jarl'], camaras: 2, acertijo: { dificultad: [3, 4], titulo: 'La saga del túmulo' } },
      { nombre: 'La cámara de Thor', tesoros: ['martillo_mjolnir'] },
    ],
    laberinto: { lado: 'abajo', puerta: [7, 18], ancho: 43, alto: 17, tesoros: ['broche_plata', 'cuerno_guerra'] },
    // La primera zona se talla en cada partida (js/laberinto.js, `generarInicio`): aquí su tamaño, sus monstruos y los peligros sueltos.
    inicio: { ancho: 43, alto: 19, enemigos: ['g', 'k'], peligros: {} },
    ambiente: 'nieve',
    nombre: 'La Fortaleza del Glaciar',
    descripcion: 'Un salón vikingo sepultado bajo el hielo del norte. Sus guerreros nunca dejaron de hacer guardia.',
    muro: 'hielo', suelo: 'nieve', techo: 'techo_hielo',
    bestias: ['arana', 'serpiente'],
    texTablilla: 'tablilla_hielo', texSello: 'sello_runa',
    tinte: [0.86, 0.95, 1.1],
    luz: 0.72,
    angulo: 0,
    leyenda: { S: { tipo: 'secreto', tex: 'hielo_grieta' } },
    tesoros: { 1: 'cuerno_hidromiel', 2: 'hacha_runica', 3: 'corazon_glaciar', 4: 'amuleto_martillo' , 5: 'anillo_draupnir', 6: 'diadema_valquiria'},
    acertijos: {
      T: { id: 'runa-escalda', tipo: 'pista', dificultad: [1, 2], sello: 'Z', titulo: 'La runa del escalda' },
      V: { id: 'runa-jarl', tipo: 'pista', dificultad: [3, 3], sello: 'Y', titulo: 'La runa del jarl' },
      U: { id: 'runa-odin', tipo: 'pista', dificultad: [4, 5], sello: 'W', titulo: 'La runa de Odín' },
      L: { id: 'salon-jarl', tipo: 'pista', dificultad: [2, 3], sello: 'Q', titulo: 'El escudo del salón' },
    },
  },
  {
    id: 'cueva-drake',
    guardian: { tipo: 'capitan', nombre: 'El capitán del galeón' },
    ampliacion: [
      { nombre: 'La cueva', camaras: 2, acertijo: { dificultad: [2, 3], titulo: 'El diario del contramaestre' } },
      { nombre: 'La bodega del galeón', tesoros: ['reales_plata', 'sable_abordaje', 'brujula_laton', 'cofrecillo_perlas'], camaras: 2, acertijo: { dificultad: [3, 4], titulo: 'El manifiesto de carga' } },
      { nombre: 'El camarote del capitán', tesoros: ['ron_anejo', 'catalejo_almirante', 'anillo_esmeralda', 'calavera_bandera'], camaras: 2, acertijo: { dificultad: [3, 4], titulo: 'La carta del capitán' } },
      { nombre: 'La santabárbara', tesoros: ['corona_galeon'] },
    ],
    laberinto: { lado: 'abajo', puerta: [4, 18], ancho: 45, alto: 17, tesoros: ['catalejo_grumete', 'collar_perlas'] },
    // La primera zona se talla en cada partida (js/laberinto.js, `generarInicio`): aquí su tamaño, sus monstruos y los peligros sueltos.
    inicio: { ancho: 45, alto: 19, enemigos: ['k', 'p'], peligros: {} },
    ambiente: 'mar',
    nombre: 'La Cueva de Drake',
    descripcion: 'Una cueva marina donde encalló un galeón del corsario Francis Drake. Su tripulación sigue a bordo.',
    muro: 'roca', suelo: 'arena_humeda', techo: 'techo_roca',
    texTablilla: 'tablilla_roca', texSello: 'sello_ancla',
    tinte: [1.0, 0.96, 0.88],
    luz: 0.55,
    angulo: 0,
    leyenda: {
      S: { tipo: 'secreto', tex: 'roca_grieta' },
      '=': { tipo: 'muro', tex: 'madera' },
    },
    tesoros: { 1: 'doblones', 2: 'brujula_drake', 3: 'cofre_drake', 4: 'catalejo_drake' , 5: 'sable_drake', 6: 'perla_negra'},
    acertijos: {
      T: { id: 'bitacora', tipo: 'pista', dificultad: [1, 2], sello: 'Z', titulo: 'La bitácora del grumete' },
      V: { id: 'carta-nautica', tipo: 'pista', dificultad: [3, 3], sello: 'Y', titulo: 'La carta náutica', texTablilla: 'tablilla_madera' },
      U: { id: 'testamento-drake', tipo: 'pista', dificultad: [4, 5], sello: 'W', titulo: 'El testamento de Drake', texTablilla: 'tablilla_madera' },
      L: { id: 'bahia', tipo: 'pista', dificultad: [2, 3], sello: 'Q', titulo: 'El mapa del contrabandista' },
    },
  },
  {
    id: 'templo-jaguar',
    guardian: { tipo: 'rey_jaguar', nombre: 'El Rey Jaguar' },
    ampliacion: [
      { nombre: 'El templo', camaras: 2, acertijo: { dificultad: [2, 3], titulo: 'La estela del juego de pelota' } },
      { nombre: 'El juego de pelota', tesoros: ['amuleto_jade', 'semillas_cacao', 'orejeras_jade', 'vasija_pelota'], camaras: 2, acertijo: { dificultad: [3, 4], titulo: 'El marcador de piedra' } },
      { nombre: 'Los túneles del cenote', tesoros: ['punta_obsidiana', 'espejo_pirita', 'calavera_obsidiana', 'mascara_mosaico'], camaras: 2, acertijo: { dificultad: [3, 4], titulo: 'El glifo del inframundo' } },
      { nombre: 'La tumba del rey jaguar', tesoros: ['calavera_cristal'] },
    ],
    laberinto: { lado: 'derecha', puerta: [26, 29], ancho: 23, alto: 33, tesoros: ['figurilla_maiz', 'cuchillo_obsidiana'] },
    // La primera zona se talla en cada partida (js/laberinto.js, `generarInicio`): aquí su tamaño, sus monstruos y los peligros sueltos.
    inicio: { ancho: 27, alto: 33, enemigos: ['j', 'k'], peligros: {} },
    ambiente: 'selva',
    nombre: 'El Templo del Jaguar',
    descripcion: 'Una pirámide maya tragada por la selva. Sus guerreros jaguar defienden el ídolo del dios.',
    muro: 'selva', suelo: 'losa_selva', techo: 'techo_selva',
    texTablilla: 'tablilla_selva', texSello: 'sello_sol',
    tinte: [0.92, 1.04, 0.86],
    luz: 0.6,
    angulo: -Math.PI / 2,
    leyenda: { S: { tipo: 'secreto', tex: 'selva_grieta' } },
    tesoros: { 1: 'mascara_jade', 2: 'disco_solar', 3: 'idolo_jade', 4: 'corona_plumas' , 5: 'silbato_calavera', 6: 'pectoral_jade'},
    acertijos: {
      T: { id: 'estela-escriba', tipo: 'pista', dificultad: [1, 2], sello: 'Z', titulo: 'La estela del escriba' },
      V: { id: 'codice', tipo: 'pista', dificultad: [3, 3], sello: 'Y', titulo: 'El códice del sacerdote' },
      U: { id: 'calendario', tipo: 'pista', dificultad: [4, 5], sello: 'W', titulo: 'El calendario del rey jaguar' },
      L: { id: 'cenote', tipo: 'pista', dificultad: [2, 3], sello: 'Q', titulo: 'La estela del cenote' },
    },
  },

  {
    id: 'templo-maldito',
    guardian: { tipo: 'gran_sectario', nombre: 'El sumo sacerdote del culto' },
    ampliacion: [
      { nombre: 'El templo', camaras: 2, acertijo: { dificultad: [2, 3], titulo: 'El relieve de la puerta' } },
      { nombre: 'El patio de las campanas', tesoros: ['campana_templo', 'brazalete_marfil', 'katar_guardian', 'gema_rubi'], camaras: 2, acertijo: { dificultad: [3, 4], titulo: 'El canto de las campanas' } },
      { nombre: 'Las galerías de la mina', tesoros: ['rupias_mogolas', 'lampara_bronce', 'collar_naga', 'idolo_ganesha'], camaras: 2, acertijo: { dificultad: [3, 4], titulo: 'La maldición del capataz' } },
      { nombre: 'El santuario de Kali', tesoros: ['ojo_kali'] },
    ],
    laberinto: { lado: 'derecha', puerta: [26, 20], ancho: 23, alto: 33, tesoros: ['cuenta_rudraksha', 'monedas_maharaja'] },
    // La primera zona se talla en cada partida (js/laberinto.js, `generarInicio`): aquí su tamaño, sus monstruos y los peligros sueltos.
    inicio: { ancho: 27, alto: 33, enemigos: ['c'], peligros: { '~': 4, '^': 3 } },
    ambiente: 'lava',
    nombre: 'El Templo Maldito',
    descripcion: 'Bajo un palacio en las montañas, una secta esconde las tres piedras sagradas robadas a una aldea. Cuidado con la lava.',
    muro: 'volcanica', suelo: 'losa_roja', techo: 'techo_roca',
    texTablilla: 'tablilla_volcanica',
    tinte: [1.08, 0.93, 0.85],
    luz: 0.55,
    angulo: 0,
    leyenda: { S: { tipo: 'secreto', tex: 'volcanica_grieta' } },
    tesoros: { 1: 'piedra_ambar', 2: 'piedra_rubi', 3: 'piedra_diamante', 4: 'daga_ritual' , 5: 'idolo_kali', 6: 'brazalete_oro'},
    acertijos: {
      T: { id: 'mural-aldea', tipo: 'pista', dificultad: [1, 2], sello: 'Z', titulo: 'El mural de la aldea' },
      V: { id: 'mantra-secta', tipo: 'pista', dificultad: [3, 3], sello: 'Y', titulo: 'El mantra de la secta' },
      U: { id: 'altar-piedras', tipo: 'pista', dificultad: [4, 5], sello: 'W', titulo: 'El altar de las piedras' },
      L: { id: 'minas', tipo: 'pista', dificultad: [2, 3], sello: 'Q', titulo: 'Las marcas de la mina' },
    },
  },
  {
    id: 'tumba-cruzado',
    guardian: { tipo: 'gran_caballero', nombre: 'El Caballero Negro' },
    ampliacion: [
      { nombre: 'La abadía', camaras: 2, acertijo: { dificultad: [2, 3], titulo: 'La lápida del claustro' } },
      { nombre: 'El claustro de los peregrinos', tesoros: ['cruz_peregrino', 'concha_peregrino', 'sello_templario', 'espuelas_caballero'], camaras: 2, acertijo: { dificultad: [3, 4], titulo: 'El libro de horas' } },
      { nombre: 'La biblioteca secreta', tesoros: ['besantes', 'salterio', 'relicario_plata', 'yelmo_cruzado'], camaras: 2, acertijo: { dificultad: [3, 4], titulo: 'El códice cifrado' } },
      { nombre: 'La capilla del Gran Maestre', tesoros: ['escudo_gran_maestre'] },
    ],
    laberinto: { lado: 'derecha', puerta: [26, 20], ancho: 23, alto: 33, tesoros: ['pagina_diario', 'moneda_templaria'] },
    // La primera zona se talla en cada partida (js/laberinto.js, `generarInicio`): aquí su tamaño, sus monstruos y los peligros sueltos.
    inicio: { ancho: 27, alto: 33, enemigos: ['k', 'n'], peligros: { '_': 3, '^': 4 } },
    ambiente: 'catacumba',
    nombre: 'La Tumba del Cruzado',
    descripcion: 'Bajo una vieja biblioteca, unas catacumbas llevan a las tres pruebas que protegen el cáliz. Elige con sabiduría.',
    muro: 'catacumba', suelo: 'losa', techo: 'techo',
    bestias: ['arana', 'serpiente'],
    texTablilla: 'tablilla_catacumba',
    tinte: [1.0, 0.97, 0.9],
    luz: 0.5,
    angulo: Math.PI / 2,
    leyenda: { S: { tipo: 'secreto', tex: 'catacumba_grieta' } },
    tesoros: { 1: 'diario_profesor', 2: 'escudo_cruzado', 3: 'caliz_carpintero', 4: 'espada_templaria' , 5: 'cruz_coronado', 6: 'tablilla_grial'},
    avisos: {
      K: 'Solo el penitente pasará. Espera con humildad a que las cuchillas duerman.',
      I: 'Solo con un salto de fe se demostrará su valía.',
      J: 'Elige con sabiduría: el cáliz de un carpintero no lleva oro ni joyas.',
    },
    acertijos: {
      T: { id: 'lapida-hermanos', tipo: 'pista', dificultad: [1, 2], sello: 'Z', titulo: 'La lápida de los tres hermanos' },
      V: { id: 'vitral', tipo: 'pista', dificultad: [1, 2], sello: 'Y', titulo: 'El vitral de la biblioteca' },
      U: { id: 'palabra', tipo: 'pista', dificultad: [4, 5], sello: 'W', titulo: 'La palabra del guardián' },
      L: { id: 'osario', tipo: 'pista', dificultad: [3, 4], sello: 'Q', titulo: 'El epitafio del osario' },
    },
  },
];

// Agranda una mazmorra de plano + laberinto a cuatro zonas (como la Cripta): el plano y su laberinto
// son la zona 1; la zona 2 va pegada al laberinto, la 3 a la derecha de todo y la cámara extra debajo de la 3.
// La entrada se derrumba a espaldas del jugador y la vieja salida desaparece: la nueva se esconde en la zona 2 o 3.
function ampliar(m) {
  const L = m.laberinto, I = m.inicio, Wp = I.ancho, Hp = I.alto;
  const [z0, ...resto] = m.ampliacion;
  const bloques = [], pasos = [];
  let entrada, W1, yZona1;
  if (L.lado === 'abajo') {
    let Lw = L.ancho | 1; if (Lw > Wp) Lw -= 2;
    const Hl = L.alto | 1;
    bloques.push({ x: 0, y: Hp, ancho: Lw, alto: Hl, zona: 0 });
    entrada = [L.puerta[0], L.puerta[1] + 1];
    W1 = Math.max(Wp, Lw) | 1; yZona1 = Hp + Hl;
    pasos.push([0, 1, Math.floor(Lw / 2), Hp + Hl - 1]);
  } else {
    const Wl = L.ancho | 1, Hl = L.alto | 1;
    bloques.push({ x: Wp, y: 0, ancho: Wl, alto: Hl, zona: 0 });
    entrada = [Wp, L.puerta[1]];
    W1 = (Wp + Wl) | 1; yZona1 = Math.max(Hp, Hl);
    pasos.push([0, 1, Wp + Math.floor(Wl / 2), Hl - 1]);
  }
  const alto = yZona1 + 25, alto2 = (alto - 16) | 1;
  bloques.push({ x: 0, y: yZona1, ancho: W1, alto: 25, zona: 1 });
  bloques.push({ x: W1, y: 0, ancho: 41, alto: alto2, zona: 2 });
  bloques.push({ x: W1, y: alto2, ancho: 41, alto: 15, zona: 3, luz: 0.5 });
  pasos.push([1, 2, W1 - 1, yZona1 + 3], [2, 3, W1 + 20, alto2 - 1]);
  m.sectores = { bloques, entrada, pasos, salida: [1, 2], zonas: [{ ...z0, tesoros: L.tesoros }, ...resto], inicio: { salas: Math.round(Wp * Hp / 110), enemigos: I.enemigos, peligros: I.peligros, puerta: L.puerta } };
  m.plano = Array.from({ length: Hp }, (_, y) => y === 1 ? '#P' + '#'.repeat(Wp - 2) : '#'.repeat(Wp));   // relleno: la zona 1 la talla js/laberinto.js
  delete m.inicio;
  delete m.laberinto;
  delete m.ampliacion;
}
for (const m of MAZMORRAS) if (m.ampliacion) ampliar(m);

// Todos los tesoros de una mazmorra: los del plano fijo, los del laberinto y los de sus zonas.
export function tesorosDe(m) {
  return [...Object.values(m.tesoros || {}), ...(m.laberinto?.tesoros || []), ...(m.sectores?.zonas.flatMap(z => z.tesoros) || [])];
}
