#!/usr/bin/env python3
"""Convierte los PNG de arte-libre/ en datos/sprites-libres.js (paleta + filas de texto), para que el atlas
se arme de forma síncrona, sin cargar imágenes. Recorta cada sprite, lo centra y lo apoya en el suelo (fila 62).
Uso: python3 herramientas/convertir-sprites.py"""
import os
from PIL import Image

RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
# nombre en el juego -> archivo (los de Kiovenn son CC BY 4.0; ver arte-libre/LICENCIAS.txt)
SPRITES = {
    'espectro': 'kiovenn/strangeGhost.png',
    'pez_fantasma': 'kiovenn/fishbone.png',
    'sirena': 'kiovenn/eelWielder.png',
    'calamar': 'kiovenn/shredSquid.png',
    'acechador': 'kiovenn/flatwoods.png',
    'segador': 'kiovenn/plunderReaper.png',
    'manos_infernales': 'kiovenn/hellhands.png',
    'bestia_cadenas': 'kiovenn/chainBeast.png',
    'caballero_hielo': 'kiovenn/armsKnight.png',
    'dracomaquina': 'kiovenn/dracomachina.png',
    'escarabajo': 'isaiah658/monstruo-12.png',
    'murcielago': 'isaiah658/monstruo-14.png',
}
FICHAS = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
T = 64

salida = ['// Generado por herramientas/convertir-sprites.py a partir de arte-libre/ (créditos en arte-libre/LICENCIAS.txt y el README).',
          '// Cada sprite: paleta de colores y 64 filas de 64 fichas (. = transparente, las demás indican el color de la paleta).',
          'export const SPRITES_LIBRES = {']
for nombre, ruta in SPRITES.items():
    im = Image.open(os.path.join(RAIZ, 'arte-libre', ruta)).convert('RGBA')
    caja = im.getbbox()
    im = im.crop(caja)
    w, h = im.size
    lienzo = Image.new('RGBA', (T, T), (0, 0, 0, 0))
    lienzo.paste(im, ((T - w) // 2, T - 2 - h))
    px = lienzo.load()
    paleta = []
    filas = []
    for y in range(T):
        fila = ''
        for x in range(T):
            r, g, b, a = px[x, y]
            if a < 128:
                fila += '.'
                continue
            c = '#%02x%02x%02x' % (r, g, b)
            if c not in paleta:
                paleta.append(c)
            fila += FICHAS[paleta.index(c)]
        filas.append(fila)
    salida.append(f"  {nombre}: {{ paleta: {paleta!r}, filas: [")
    salida += [f"    '{f}'," for f in filas]
    salida.append('  ] },')
salida.append('};')
with open(os.path.join(RAIZ, 'datos', 'sprites-libres.js'), 'w') as f:
    f.write('\n'.join(salida).replace('"', "'") + '\n')
print('listo:', len(SPRITES), 'sprites')
