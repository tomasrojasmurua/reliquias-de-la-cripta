# Reliquias de la Cripta

Juego de disparos en primera persona al estilo de Doom 1: un cazador de tesoros explora mazmorras, encuentra su revólver y sus balas, derrota momias y esqueletos, descubre pasadizos secretos y descifra pistas crípticas grabadas en tablillas para abrir las cámaras de los tesoros.

Se juega en el navegador, en celular (como app instalable) o en computador. Sitio estático, sin dependencias ni paso de compilación, listo para GitHub Pages.

## Publicar en GitHub Pages
Settings → Pages → Source: *Deploy from a branch* → rama `main`, carpeta `/ (root)`.

Para probarlo en local: `python3 -m http.server` en esta carpeta y abrir http://localhost:8000 (los módulos de JavaScript no cargan con `file://`).

## Mazmorras
1. **La Cripta del Escarabajo** (Egipto): una tablilla, para empezar.
2. **El Templo de las Arenas** (Egipto): dos tablillas.
3. **La Fortaleza del Glaciar** (vikingos en el hielo): tres tablillas encadenadas.
4. **La Cueva de Drake** (el galeón del corsario Francis Drake): tres tablillas encadenadas.
5. **El Templo del Jaguar** (pirámide maya en la selva): tres tablillas encadenadas.
6. **El Templo Maldito** (una secta, tres piedras sagradas y un río de lava): pinchos y un camino entre la lava hasta el revólver.
7. **La Tumba del Cruzado** (catacumbas y las tres pruebas del cáliz): la senda del penitente (pinchos), la palabra (una tablilla de dificultad 4–5) y el salto de fe (un puente oculto sobre un abismo). Al final hay varios cálices, y solo uno es el verdadero.

Cada mazmorra tiene un **laberinto de túneles que cambia en cada partida** (`js/laberinto.js`): pasillos con bifurcaciones y callejones sin salida, salas con hordas o vacías, pinchos en algunos pasillos y dos tesoros escondidos en los callejones más hondos, a veces tapiados tras un muro agrietado. Las salas principales y los acertijos quedan siempre iguales.

Cada mazmorra tiene además un **ala nueva con alturas**, con su propia tablilla (`L`) y su sello (`Q`): una galería con foso y estrado en la cripta, una pirámide escalonada en el templo de las arenas, el salón del jarl con balcón y lago helado, una bahía de contrabandistas con muelle y acantilado, un cenote sagrado en la selva, unas minas con pasarelas sobre un río de lava y un osario con entresuelo y sala de lectura hundida.

En las últimas mazmorras, cada tablilla abre la cámara donde está la siguiente, más difícil: dificultad 1–2, luego 3, luego 4–5, con un tesoro legendario al final. Cada mazmorra tiene además un pasadizo secreto con un tesoro escondido.

## Controles
- **Computador:** WASD o flechas para moverte, ratón para mirar (clic para capturarlo), clic para atacar, E o Espacio para usar, R para recargar, 1/2 o Q para cambiar de arma, Tab o M para el mapa, Esc para pausar.
- **Celular:** joystick en la mitad izquierda para moverse; arrastrar en la derecha para mirar, tocar para disparar y tocar dos veces y mantener para ráfaga. Puntería asistida, la vista vuelve sola al horizonte, el botón de la mano se ilumina cuando hay algo que usar enfrente, vibración al disparar y al recibir daño (Android). En Opciones: sensibilidad, modo zurdo y vibración.

## Cómo está hecho
El motor usa **WebGL directo** (sin librerías). Cada mazmorra es una rejilla, como en Wolfenstein y Doom, pero se convierte en geometría 3D real: muros, suelos y techos son polígonos, y enemigos y objetos son sprites que siempre miran a la cámara. Así se consigue el aspecto de Doom (texturas pixel art con filtro *nearest*, luz que se apaga con la distancia, bandas de luz) pero dibujado a la resolución nativa de la pantalla, más nítido que el original, y la tarjeta gráfica hace el trabajo, así que corre fluido en celulares. La opción **Retro** dibuja a baja resolución para el aspecto original.

Las mazmorras son oscuras: solo iluminan algunas antorchas en los muros, la lava y la salida. El cazador lleva su propia **antorcha en la mano izquierda**, que da una luz cálida y titilante de unos 7 metros a su alrededor. Los tesoros no se iluminan solos: hay que acercarles la antorcha. Los raros, épicos y legendarios dejan ver un halo tenue de su color y destellos que giran a su alrededor.

Cada casilla tiene su propia altura de suelo y de techo, así que hay escaleras, plataformas, balcones y fosos (como los sectores de Doom): los escalones bajos se suben caminando y los altos solo se pueden bajar. Los enemigos tampoco saltan desniveles.

Las texturas, sprites, el arma en pantalla y los sonidos se generan por código, así que no hay imágenes ni audio que descargar. Los sprites reciben un relieve en cúpula iluminado desde arriba a la izquierda, trama ordenada y contorno al generarse; los enemigos tienen hombros, cintura y miembros que se afinan (o costillas curvas y articulaciones, los esqueletos) y se desploman girando el mismo cuerpo. Las manos, el revólver, el látigo y la antorcha se dibujan con degradados (piel, acero pavonado, nogal cuadriculado, cuero trenzado, manga de cuero con puño de camisa) y luego se reducen a pixel art con trama; muros, suelos, techos, puertas, sellos y tablillas se arman con un campo de alturas (bloques con bisel y bordes mellados, piedras irregulares, tablones con vetas, herrajes con remaches) que se ilumina desde arriba a la izquierda, oscurece juntas y grietas y se reduce con trama ordenada; la lava, las vetas del templo maldito y la luz de la salida brillan por sí solas; los enemigos se iluminan al recibir un golpe, salpican polvo, huesos, sangre o chispas y caen en varios fotogramas; caminan con cuatro cuadros y balancean los brazos. Los tesoros tienen volumen, vetas de brillo y contorno del color de su metal. Las antorchas de los muros tienen llamas animadas que sueltan brasas, flota polvo en el aire a la luz de la antorcha y hay huesos, cráneos, vasijas, escombros, velas y telarañas junto a los muros. Cada mazmorra tiene su ambiente sonoro (gotas, viento, olas y crujidos de madera, pájaros e insectos, burbujas de lava, susurros), una música de fondo procedural que se tensa cuando te persiguen, pasos según el suelo y eco. El **automapa** dibuja solo lo que ya viste.

La **colección** muestra los tesoros en vitrinas, una por rareza: estanterías de madera para los comunes, caoba con remaches de bronce y terciopelo azul para los raros, ébano y plata con luz de velas para los épicos, y un marco dorado con terciopelo carmesí, rayos de luz y reflejo en el vidrio para los legendarios. Al tocar una pieza se abre su ficha, con la mazmorra donde se halló (o donde se esconde).

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
- `js/audio.js`: efectos, ambiente, música y eco sintetizados.
- `js/automapa.js`: mapa de lo explorado.
- `js/laberinto.js`: genera los túneles de cada partida.
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
| `m` `k` `g` `p` `j` `c` `n` | momia, esqueleto, draugr (vikingo congelado), pirata esqueleto, guerrero jaguar, sectario, caballero cruzado |
| `^` | pinchos que suben y bajan (hay que cruzar a tiempo) |
| `~` | lava (quema mientras la pisas) |
| `_` | abismo (caída mortal) |
| `:` | puente oculto: parece abismo, pero se puede pisar |
| `f` | cáliz falso: parece un tesoro y es una trampa |
| `1`–`9` | tesoros, según el campo `tesoros` |

Otros campos opcionales: `alturas` (un plano paralelo con la altura del suelo: `.` a ras de suelo, `1`–`9` sube 0.3 m por número, `a`–`e` baja 0.3 m por letra; un escalón de 0.3 m se sube caminando, uno de 0.6 m ya no), `zonas` (rectángulos con otro suelo, techo o muro, la altura del techo `cielo` y la textura `desnivel` de escalones y paredes entre alturas), `laberinto` (`{ lado: 'abajo' | 'derecha', puerta: [x, y], ancho, alto, tesoros: [...] }`: túneles generados en cada partida, unidos por una puerta en la casilla `puerta` del borde del plano), `ambiente` (`cripta`, `desierto`, `nieve`, `mar`, `selva`, `lava` o `catacumba`), `avisos` (inscripciones de pista que se leen con «Usar»: `{ K: 'texto' }`), `texTablilla` y `texSello` (texturas de tablillas y sellos), `tinte` (color de la luz) y `leyenda` (caracteres propios, por ejemplo `'=': { tipo: 'muro', tex: 'madera' }`).

Las tablillas y los sellos se declaran en `acertijos`: `T: { id, dificultad: [min, max], sello: 'Z', titulo }` pone una tablilla en cada `T` del plano y un sello en cada `Z`. Al acertar la pista de la tablilla se abren sus sellos. La dificultad (1 a 5) elige al azar una pista del banco de esa dificultad, evitando las que el jugador ya resolvió. La regla es poner tesoros más valiosos tras pistas más difíciles y tras los pasadizos secretos.

## Pistas crípticas
`datos/pistas.js` se genera desde `fuentes/banco-pistas.json` (copia ese archivo ahí antes de correrlo):

```
python3 herramientas/generar-pistas.py
```

Respuesta y explicación quedan ofuscadas para que no se vean mirando el código. El juego usa las pistas Extras y las pistas del día de Críptico 51 cuya fecha ya pasó; las futuras se suman solas cuando llega su fecha.

Ayudas en cada tablilla, en el orden de la guía: tipo de pista, definición resaltada, indicador y relleno resaltados, primera letra. Si el jugador pide ver la solución, la tablilla cambia a otra pista y el sello sigue cerrado.

Si agregas un archivo que el juego necesita, súmalo a `ARCHIVOS` en `sw.js` y sube el número de `CACHE`.
