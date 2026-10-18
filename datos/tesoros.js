// Catálogo de tesoros. forma: dibujo en texturas.js; color y oscuro: tonos del dibujo.
// rareza: comun < raro < epico < legendario. Los más valiosos van tras acertijos difíciles o pasadizos secretos.

export const RAREZAS = {
  comun: { nombre: 'Común', color: '#c9c2b0', valor: 1 },
  raro: { nombre: 'Raro', color: '#5fa8ff', valor: 3 },
  epico: { nombre: 'Épico', color: '#c77dff', valor: 8 },
  legendario: { nombre: 'Legendario', color: '#ffb627', valor: 20 },
};

const ORO = ['#e8b83a', '#9a6e12'];
const PLATA = ['#d8dde4', '#7e8794'];
const JADE = ['#4fbf7f', '#1f6a42'];
const BRONCE = ['#c27a3a', '#6e3e14'];
const RUBI = ['#e0304a', '#7a1020'];
const ZAFIRO = ['#3a6ee8', '#142f7a'];
const CRISTAL = ['#cfefff', '#6aa6c4'];
const OBSIDIANA = ['#4a4458', '#16131e'];
const HIELO = ['#bfe8ff', '#4f8fb8'];
const MARFIL = ['#efe4c8', '#9a8a62'];

function t(id, nombre, forma, [color, oscuro], rareza, descripcion) {
  return { id, nombre, forma, color, oscuro, rareza, descripcion };
}

export const TESOROS = [
  t('monedas_cobre', 'Monedas de bronce del mercader', 'monedas', BRONCE, 'comun', 'Un puñado de monedas gastadas por mil manos.'),
  t('daga_bronce', 'Daga ceremonial de bronce', 'daga', BRONCE, 'comun', 'Su filo ya no corta, pero su empuñadura cuenta historias.'),
  t('anfora_aceite', 'Ánfora de aceite sagrado', 'anfora', BRONCE, 'comun', 'Todavía huele a mirra.'),
  t('amuleto_jade', 'Amuleto de jade', 'amuleto', JADE, 'comun', 'Protegía a los escribas de los malos sueños.'),
  t('escarabajo_bronce', 'Escarabajo de bronce', 'escarabajo', BRONCE, 'comun', 'Símbolo del sol que renace cada mañana.'),
  t('monedas_plata', 'Monedas de plata del faraón', 'monedas', PLATA, 'raro', 'Acuñadas con un rostro que nadie recuerda.'),
  t('caliz_plata', 'Cáliz de plata labrada', 'caliz', PLATA, 'raro', 'Bebían de él los sacerdotes antes del rito.'),
  t('mascara_jade', 'Máscara funeraria de jade', 'mascara', JADE, 'raro', 'Mil piezas de jade unidas con hilo de oro.'),
  t('gema_zafiro', 'Zafiro del pozo azul', 'gema', ZAFIRO, 'raro', 'Dicen que dentro se ve el fondo del mar.'),
  t('daga_plata', 'Daga de plata del guardián', 'daga', PLATA, 'raro', 'La llevaba el último guardián de la cripta.'),
  t('escarabajo_oro', 'Escarabajo de oro', 'escarabajo', ORO, 'raro', 'Pesa más de lo que parece.'),
  t('anfora_jade', 'Ánfora de jade', 'anfora', JADE, 'raro', 'Guardaba los perfumes de una reina.'),
  t('caliz_oro', 'Cáliz de oro del sumo sacerdote', 'caliz', ORO, 'epico', 'Brilla incluso en la oscuridad total.'),
  t('gema_rubi', 'Rubí del corazón del volcán', 'gema', RUBI, 'epico', 'Está tibio al tacto.'),
  t('corona_plata', 'Corona de plata de la reina olvidada', 'corona', PLATA, 'epico', 'Nadie sabe el nombre de quien la llevó.'),
  t('cetro_bronce', 'Cetro del visir', 'cetro', BRONCE, 'epico', 'Con él se dictaban sentencias.'),
  t('amuleto_oro', 'Amuleto solar', 'amuleto', ORO, 'epico', 'Se calienta cuando hay peligro cerca.'),
  t('calavera_obsidiana', 'Calavera de obsidiana', 'calavera', OBSIDIANA, 'epico', 'Sus cuencas parecen seguirte.'),
  t('idolo_oro', 'Ídolo de oro de la fertilidad', 'idolo', ORO, 'legendario', 'El tesoro que todos buscan. Cuidado con la roca.'),
  t('mascara_oro', 'Máscara de oro del rey niño', 'mascara', ORO, 'legendario', 'El rostro de un rey que reinó solo nueve años.'),
  t('corona_oro', 'Corona del primer faraón', 'corona', ORO, 'legendario', 'Unió las dos tierras bajo un solo trono.'),
  t('calavera_cristal', 'Calavera de cristal', 'calavera', CRISTAL, 'legendario', 'La luz se dobla de formas imposibles dentro de ella.'),
  t('cetro_oro', 'Cetro de Osiris', 'cetro', ORO, 'legendario', 'Quien lo empuña juzga a los muertos.'),
  t('idolo_jade', 'Ídolo de jade del dios jaguar', 'idolo', JADE, 'legendario', 'Viene de una selva al otro lado del mundo.'),
  // Glaciar vikingo
  t('cuerno_hidromiel', 'Cuerno de hidromiel', 'cuerno', MARFIL, 'raro', 'Aún huele a miel fermentada y a banquete.'),
  t('hacha_runica', 'Hacha rúnica del jarl', 'hacha', PLATA, 'epico', 'Las runas del filo brillan con el frío.'),
  t('amuleto_martillo', 'Amuleto del martillo del trueno', 'amuleto', PLATA, 'epico', 'Los guerreros lo llevaban para volver a casa.'),
  t('corazon_glaciar', 'Corazón del Glaciar', 'gema', HIELO, 'legendario', 'Una gema que nunca se derrite, ni en la mano.'),
  // Cueva de Drake
  t('doblones', 'Doblones de a ocho', 'monedas', ORO, 'raro', 'Monedas españolas que nunca llegaron a Sevilla.'),
  t('catalejo_drake', 'Catalejo de Francis Drake', 'catalejo', BRONCE, 'epico', 'Con él divisó la costa de California.'),
  t('brujula_drake', 'Brújula de la Golden Hind', 'brujula', ORO, 'epico', 'No apunta al norte: apunta al tesoro.'),
  t('cofre_drake', 'El cofre de Drake', 'cofre', ORO, 'legendario', 'El botín que el corsario escondió y nunca volvió a buscar.'),
  // Templo de la selva
  t('disco_solar', 'Disco solar de Kinich Ahau', 'disco', ORO, 'epico', 'El calendario del sol, tallado en oro.'),
  t('corona_plumas', 'Corona de plumas del rey jaguar', 'corona', JADE, 'epico', 'Las plumas de quetzal siguen intactas.'),
];

export const TESORO = Object.fromEntries(TESOROS.map(x => [x.id, x]));
