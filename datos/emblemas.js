// Emblemas en pixel art de cada mazmorra, para la pantalla de selección.
// Cada dibujo es de 16×16: una letra por píxel según su paleta y '.' es transparente.
// Las filas de 8 letras son la mitad izquierda de un dibujo simétrico y se reflejan.

const K = '#1a1208';

export const EMBLEMAS = {
  // un escarabajo de oro y lapislázuli
  'cripta-escarabajo': {
    paleta: { k: K, g: '#e8b83a', d: '#9a6e12', y: '#ffe58a', b: '#3a6ee8', B: '#142f7a', c: '#8fb4ff' },
    filas: [
      '........', '......kk', '.....kyg', '.....kgg', '....kkdd', '...kgyyg', '...kdggg', 'kk.kkkkk',
      '..kbcbbk', 'kkkbcbbk', '..kbbbbk', '..kbbbbk', 'kkkbbBbk', '..kBbbbk', '...kBbbk', '....kkkk',
    ],
  },
  // una pirámide y el sol sobre las dunas
  'templo-arenas': {
    paleta: { k: K, p: '#e0b070', P: '#a8743a', g: '#ffe58a', s: '#ffe070', S: '#ff9a2a', a: '#d8a050', A: '#b07830' },
    filas: [
      '................', '...........SSS..', '..........SsssS.', '..........SsssS.',
      '.......gg..SSS..', '......kpPk......', '.....kppPPk.....', '....kpppPPPk....',
      '...kppppPPPPk...', '..kpppppPPPPPk..', '.kpppppkPPPPPPk.', 'kppppppkPPPPPPPk',
      'aaaaaaaaaaaaaaaa', 'aAaaaaAAaaaaaAaa', 'aaaAAaaaaaAaaaaa', 'AAaaaaaaAAaaaaAA',
    ],
  },
  // un yelmo vikingo sobre el hielo
  'glaciar-jarl': {
    paleta: { k: K, h: '#efe4c8', H: '#9a8a62', w: '#f4fbff', m: '#b8c2ce', M: '#6e7884', g: '#e8b83a', i: '#bfe8ff', I: '#4f8fb8' },
    filas: [
      '........', 'k.......', 'kh......', 'khk.....', 'khHk....', '.khHk.kk', '.khHkkwm', '..khHkwm',
      '...kHkmm', '....kmmm', '...kMMMM', '...kMgMM', '...kkkkM', '......kM', 'iiiiiikk', 'IIiiIIii',
    ],
  },
  // la calavera del corsario
  'cueva-drake': {
    paleta: { k: K, w: '#efe4c8', r: '#c8283a' },
    filas: [
      'kk......', 'kwk..kkk', '.kwkkrrr', '..kkrrrr', '..krrrrr', '..kwwwww', '.kwwwwww', '.kwkkkww',
      '.kwkkkww', '.kwwwwww', '..kwwwwk', '...kwwww', '...kwkwk', '..kwkkkk', 'kwwk....', 'kk......',
    ],
  },
  // la cabeza del jaguar con ojos de jade
  'templo-jaguar': {
    paleta: { k: K, y: '#f0a830', Y: '#8a5010', w: '#efe4c8', j: '#4fbf7f', n: '#4a2a12' },
    filas: [
      '........', '.kk.....', 'kyYk....', 'kYyykkkk', '.kyyyyyy', '.kyYyyYy', 'kyyyyyyy', 'kyykjjky',
      'kyYyyyyy', 'kyyyywww', 'kYyywwwn', '.kyywwwk', '.kyywkww', '..kyywww', '...kkyww', '.....kkk',
    ],
  },
  // una piedra sagrada que brilla sobre la lava
  'templo-maldito': {
    paleta: { k: K, s: '#b8b0a0', S: '#6e675a', l: '#ffd34d', o: '#ff7a1a', O: '#c0300a', r: '#6a1008' },
    filas: [
      '........', '..l..kkk', '....ksss', '...kssss', '...kslll', '..ksssss', '..kSllll', '..kSssss',
      '...kSlll', '...kSSss', '....kSSS', '.o...kkk', 'o..o...o', 'oOooOooo', 'OooOOoOo', 'rOOrrOOr',
    ],
  },
  // el cáliz del cruzado
  'tumba-cruzado': {
    paleta: { k: K, g: '#e8b83a', d: '#9a6e12', y: '#ffe58a', r: '#c8283a' },
    filas: [
      '........', '.kkkkkkk', '.kyggggg', '.kyggggr', '..kyggrr', '..kdgggr', '...kdggg', '....kddg',
      '.....kdg', '......kr', '......kd', '.....kdg', '....kddg', '...kdggg', '...kkkkk', '........',
    ],
  },
};

// Dibuja el emblema en un lienzo de 16×16; el CSS lo agranda sin suavizar.
export function lienzoEmblema(id) {
  const e = EMBLEMAS[id];
  const c = document.createElement('canvas');
  c.width = c.height = 16;
  c.className = 'emblema';
  if (!e) return c;
  const g = c.getContext('2d');
  e.filas.forEach((f, y) => {
    const fila = f.length === 8 ? f + [...f].reverse().join('') : f;
    [...fila].forEach((p, x) => {
      if (p === '.') return;
      g.fillStyle = e.paleta[p];
      g.fillRect(x, y, 1, 1);
    });
  });
  return c;
}
