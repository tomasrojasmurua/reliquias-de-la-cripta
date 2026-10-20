// Museo del cazador: una sala por mazmorra con su historia, y una línea de lore por forma y por rareza
// para contar algo más de cada tesoro en su ficha.

export const SALAS = {
  'cripta-escarabajo': {
    sala: 'Sala del Sol Naciente',
    lore: 'Los sacerdotes de Jepri enterraron a su faraón con el escarabajo que empuja el sol cada mañana. Creían que mientras la cripta siguiera cerrada, el sol volvería a salir. Nadie les avisó que la arena también se mueve.',
  },
  'templo-arenas': {
    sala: 'Galería de las Dunas',
    lore: 'El templo fue tragado por una tormenta que duró cuarenta días. Las caravanas que lo buscaron después solo encontraron dos inscripciones a medio enterrar y el aullido de Anubis entre las columnas.',
  },
  'glaciar-jarl': {
    sala: 'Salón del Jarl',
    lore: 'Un jarl juró no soltar su trono hasta el Ragnarök, y el hielo lo tomó al pie de la letra. Sus huscarles siguen de guardia, con la barba escarchada y las hachas listas, en un salón que ya nadie recuerda.',
  },
  'cueva-drake': {
    sala: 'Bodega del Galeón',
    lore: 'El galeón entró a la cueva huyendo de una armada española y la marea nunca lo dejó salir. El botín de tres océanos quedó repartido entre la bodega, la playa negra y los bolsillos de una tripulación que no sabe que murió.',
  },
  'templo-jaguar': {
    sala: 'Pirámide del Jaguar',
    lore: 'Los guerreros jaguar subían la escalinata de noche para ofrecer jade al dios de las sombras. Cuando la selva cubrió la pirámide, se quedaron adentro, vigilando el ídolo con los ojos amarillos que aún brillan en la oscuridad.',
  },
  'templo-maldito': {
    sala: 'Santuario de las Piedras',
    lore: 'Una aldea de las montañas perdió sus tres piedras sagradas y con ellas la lluvia y la risa de sus niños. La secta que las robó cavó un templo sobre la lava para que nadie se atreviera a ir a buscarlas.',
  },
  'tumba-cruzado': {
    sala: 'Cripta del Último Cruzado',
    lore: 'Tres caballeros juraron proteger el cáliz; dos volvieron a casa y uno se quedó. Bajo la biblioteca dejaron tres pruebas para el penitente, el sabio y el que sabe dónde pisar.',
  },
};

export const LORE_FORMA = {
  monedas: 'Las monedas cuentan quién mandaba: cada rey nuevo fundía las del anterior.',
  daga: 'Una daga así no era para pelear: se usaba para jurar, sellar pactos o acompañar al muerto.',
  anfora: 'En las ánforas viajaban aceite, vino y perfumes; las mejores se enterraban selladas con cera.',
  amuleto: 'Se colgaba al cuello del recién nacido y no se quitaba hasta la tumba.',
  escarabajo: 'El escarabajo empuja su bola como el dios empuja el sol: por eso era símbolo de volver a nacer.',
  caliz: 'Beber del mismo cáliz era jurar lealtad; romperlo, declarar la guerra.',
  mascara: 'La máscara guardaba el rostro del difunto para que su alma lo reconociera al volver.',
  gema: 'Los joyeros antiguos creían que cada gema guardaba un poco de la luz del día en que se halló.',
  corona: 'Una corona pasa de cabeza en cabeza; algunas cargan más traiciones que joyas.',
  cetro: 'Quien sostenía el cetro hablaba por el dios; quien lo perdía, ya no hablaba por nadie.',
  calavera: 'Las calaveras talladas se ponían en los altares para recordar que todo poder termina.',
  idolo: 'Los ídolos se tallaban con los ojos abiertos: un dios nunca duerme.',
  cuerno: 'Un cuerno así llamaba a los guerreros a la batalla o al banquete, que a veces eran lo mismo.',
  hacha: 'Las hachas de jefe se heredaban con el nombre de todos los que la habían blandido.',
  catalejo: 'Con un buen catalejo se veía venir al enemigo, la tormenta y el puerto, casi siempre en ese orden.',
  brujula: 'Una brújula vale lo que el capitán que la lee; esta conoció a varios.',
  cofre: 'Nadie entierra un cofre vacío, pero muchos lo abren y lo encuentran así.',
  disco: 'Los discos de piedra medían el tiempo: cuándo sembrar, cuándo rezar y cuándo esconderse.',
  piedra: 'Las piedras sagradas no se compran ni se venden: se guardan, o se roban.',
  libro: 'Copiar un libro llevaba años; perder uno, una tarde.',
  escudo: 'En el escudo iban los colores de la casa: quien lo dejaba caer, la deshonraba.',
  ankh: 'La cruz con asa es la llave de la vida: los dioses la acercaban a la nariz del faraón para darle aliento.',
  anillo: 'Un anillo de sello firmaba cartas, leyes y sentencias sin decir una palabra.',
  cruz: 'Las cruces de los peregrinos se gastaban en el pecho durante años de camino.',
};

export const LORE_RAREZA = {
  comun: 'Pieza de uso diario: alguien la tuvo en la mano muchas veces.',
  raro: 'Pocos podían pagar algo así; sus dueños se cuidaban de mostrarla.',
  epico: 'Obra de un taller real. Solo unas pocas manos la tocaron en siglos.',
  legendario: 'De esas piezas que cambian la historia de quien las encuentra. Las leyendas la daban por perdida.',
};
