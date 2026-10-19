// Qué monstruos salen en cada partida y dónde.
//
// Cada mazmorra tiene sus enemigos propios (los del plano: momias, piratas, sectarios...). Además, en
// cada partida se sueltan una o dos bestias al azar (escorpión, araña o serpiente gigantes) y a veces
// un coloso de piedra. Los sitios del plano son solo puntos de partida: algunos quedan vacíos, otros
// cambian de monstruo, y aparecen otros en casillas cualquiera. Muchos esperan escondidos (bajo la arena,
// en el techo, entre los escombros) y salen cuando te acercas, así que nunca sabes qué hay en una sala.
//
// Todo el azar sale de `azar`: con la misma semilla salen los mismos monstruos en los mismos sitios.

export const BESTIAS = ['escorpion', 'arana', 'serpiente'];

// Probabilidades de cada sitio del plano.
const VACIO = 0.22;      // queda vacío (y el monstruo aparece en otra parte)
const BESTIA = 0.3;      // sale una de las bestias de la partida en vez del enemigo propio
const COLOSO = 0.07;     // sale el coloso (solo en las partidas que lo tienen, y uno o dos como mucho)
const ESCONDIDO = { propio: 0.25, bestia: 0.6, coloso: 0.8 };
const ARQUERO = 0.14;    // sale un arquero en vez del enemigo propio
const EXTRA = 0.12;      // monstruos de más, en casillas cualquiera, por cada sitio del plano
const LEJOS = 7;         // nada aparece tan cerca del inicio

export function repartirEnemigos(m, azar) {
  const elegir = a => a[Math.floor(azar() * a.length)];
  const mezclar = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(azar() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const propios = [...new Set(m.enemigos.map(e => e.tipo))];
  if (!propios.length) propios.push('esqueleto');
  // las bestias de esta partida: una o dos de las que viven en la mazmorra
  const posibles = mezclar([...(m.def.bestias || BESTIAS)]);
  const bestias = posibles.slice(0, Math.min(posibles.length, azar() < 0.5 ? 1 : 2));
  const conColoso = m.def.coloso !== false && azar() < 0.55;
  let colosos = conColoso ? 1 + (azar() < 0.4 ? 1 : 0) : 0;

  const tipo = () => {
    const r = azar();
    if (colosos && r < COLOSO) { colosos--; return ['coloso', 'coloso']; }
    if (bestias.length && r < COLOSO + BESTIA) return [elegir(bestias), 'bestia'];
    if (azar() < ARQUERO) return ['arquero', 'propio'];
    return [elegir(propios), 'propio'];
  };
  const ocupadas = new Set(m.objetos.map(o => `${Math.floor(o.x)},${Math.floor(o.z)}`));
  const lejos = (x, z) => Math.hypot(x - m.inicio.x, z - m.inicio.z) >= LEJOS;
  const libres = [];
  for (let y = 0; y < m.alto; y++) for (let x = 0; x < m.ancho; x++) {
    const c = m.celda(x, y);
    if (c.tipo === 'suelo' && !c.peligro && !c.trampa && !c.estatua && !ocupadas.has(`${x},${y}`) && lejos(x + 0.5, y + 0.5)) libres.push([x, y]);
  }
  mezclar(libres);

  const nuevos = [];
  const poner = (x, z) => {
    const [t, clase] = tipo();
    nuevos.push({ tipo: t, x, z, escondido: azar() < ESCONDIDO[clase] });
  };
  let sobran = 0;
  for (const e of m.enemigos) {
    if (azar() < VACIO || !lejos(e.x, e.z)) { sobran++; continue; }
    poner(e.x, e.z);
  }
  sobran += Math.round(m.enemigos.length * EXTRA);
  const usadas = new Set(nuevos.map(e => `${Math.floor(e.x)},${Math.floor(e.z)}`));
  for (const [x, y] of libres) {
    if (sobran <= 0) break;
    if (usadas.has(`${x},${y}`)) continue;
    usadas.add(`${x},${y}`);
    poner(x + 0.5, y + 0.5);
    sobran--;
  }
  m.enemigos = nuevos;
  m.fauna = { propios, bestias, coloso: conColoso };
}
