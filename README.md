# Reliquias de la Cripta

Juego de disparos en primera persona al estilo de Doom 1: un cazador de tesoros explora mazmorras, encuentra su revólver y sus balas, derrota momias y esqueletos, descubre pasadizos secretos y descifra pistas crípticas grabadas en tablillas para abrir las cámaras de los tesoros.

Se juega en el navegador, en celular (como app instalable) o en computador. Sitio estático, sin dependencias ni paso de compilación, listo para GitHub Pages.

## Publicar en GitHub Pages
Settings → Pages → Source: *Deploy from a branch* → rama `main`, carpeta `/ (root)`.

Para probarlo en local: `python3 -m http.server` en esta carpeta y abrir http://localhost:8000 (los módulos de JavaScript no cargan con `file://`).

## Controles
- **Computador:** WASD o flechas para moverte, ratón para mirar (clic para capturarlo), clic para atacar, E o Espacio para usar, R para recargar, 1/2 o Q para cambiar de arma, Shift para correr, Esc para pausar.
- **Celular:** arrastra en la mitad izquierda para moverte y en la derecha para mirar; botones para atacar, usar, recargar y cambiar de arma.

## Cómo está hecho
El motor usa **WebGL directo** (sin librerías). Cada mazmorra es una rejilla, como en Wolfenstein y Doom, pero se convierte en geometría 3D real: muros, suelos y techos son polígonos, y enemigos y objetos son sprites que siempre miran a la cámara. Así se consigue el aspecto de Doom (texturas pixel art con filtro *nearest*, luz que se apaga con la distancia, bandas de luz) pero dibujado a la resolución nativa de la pantalla, más nítido que el original, y la tarjeta gráfica hace el trabajo, así que corre fluido en celulares. La opción **Retro** dibuja a baja resolución para el aspecto original.

Las texturas, sprites, el arma en pantalla y los sonidos se generan por código, así que no hay imágenes ni audio que descargar.

## Archivos
- `index.html`, `css/estilo.css`: pantallas, HUD y controles táctiles.
- `js/main.js`: menús, bucle principal, progreso guardado (`localStorage`).
- `js/render.js`: motor WebGL.
- `js/texturas.js`: texturas y sprites pixel art generados por código.
- `js/mapa.js`: convierte el plano de una mazmorra en casillas, objetos y enemigos.
- `js/juego.js`: reglas: movimiento, colisiones, armas, enemigos, puertas, pasadizos, tesoros.
- `js/entrada.js`: teclado, ratón y pantalla táctil.
- `js/arma.js`: revólver y látigo en primera persona.
- `js/acertijos.js`: tablillas con pistas crípticas y ayudas progresivas.
- `js/audio.js`: efectos de sonido sintetizados.
- `datos/mazmorras.js`: las mazmorras (planos de texto, ver abajo).
- `datos/tesoros.js`: catálogo de tesoros y rarezas.
- `datos/pistas.js`: banco de pistas crípticas, generado (no editar a mano).
- `fuentes/`: la guía para descifrar las pistas. El banco original (`banco-pistas.json`) no se sube al repositorio porque trae las respuestas y las pistas del día futuras de Críptico 51 a la vista; está en la carpeta `reliquias/fuentes` del proyecto.
- `manifest.webmanifest`, `sw.js`, `iconos/`: app instalable que funciona sin conexión.

## Crear una mazmorra
Cada mazmorra en `datos/mazmorras.js` es un plano de texto donde cada carácter es una casilla de 1 × 1 m:

| Carácter | Qué es |
|---|---|
| `#` | muro (textura `muro` de la mazmorra) |
| `.` | suelo |
| `P` | inicio del jugador |
| `D` | puerta (se abre con «Usar») |
| `S` | pasadizo secreto: parece un muro con una grieta y se hunde al empujarlo |
| `X` | salida |
| `!` | antorcha (ilumina alrededor) |
| `R` `b` `v` | revólver, caja de balas, vendas |
| `m` `k` | momia, esqueleto |
| `1`–`9` | tesoros, según el campo `tesoros` |

Las tablillas y los sellos se declaran en `acertijos`: `T: { id, dificultad: [min, max], sello: 'Z', titulo }` pone una tablilla en cada `T` del plano y un sello en cada `Z`. Al acertar la pista de la tablilla se abren sus sellos. La dificultad (1 a 5) elige al azar una pista del banco de esa dificultad, evitando las que el jugador ya resolvió. La regla es poner tesoros más valiosos tras pistas más difíciles y tras los pasadizos secretos.

## Pistas crípticas
`datos/pistas.js` se genera desde `fuentes/banco-pistas.json` (copia ese archivo ahí antes de correrlo):

```
python3 herramientas/generar-pistas.py
```

Respuesta y explicación quedan ofuscadas para que no se vean mirando el código. El juego usa las pistas Extras y las pistas del día de Críptico 51 cuya fecha ya pasó; las futuras se suman solas cuando llega su fecha.

Ayudas en cada tablilla, en el orden de la guía: tipo de pista, definición resaltada, indicador y relleno resaltados, primera letra. Si el jugador pide ver la solución, la tablilla cambia a otra pista y el sello sigue cerrado.

Si agregas un archivo que el juego necesita, súmalo a `ARCHIVOS` en `sw.js` y sube el número de `CACHE`.
