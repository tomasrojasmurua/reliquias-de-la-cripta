# Reliquias de la Cripta: resumen para otros hilos

Repo `tomasrojasmurua/reliquias-de-la-cripta` (raíz = el juego; en el proyecto la carpeta es `reliquias/`). Detalle completo en `README.md` del repo. Este resumen es solo orientación.

## Concepto
Shooter en primera persona estilo Doom 1, en el navegador (PWA instalable, celular o PC). Un cazador de tesoros explora mazmorras, encuentra su revólver, mata monstruos, abre pasadizos secretos y descifra pistas crípticas (tablillas) para abrir cámaras selladas con tesoros. Sitio estático, sin dependencias ni build; WebGL directo; texturas, sprites y sonido generados por código. Textos en español.

## Modos
- **Explorar**: sin reloj. Al elegir mazmorra se prepara la expedición: modo, tamaño (Pequeña = zona 1, Mediana = 2 zonas, Grande = todas + cámara secreta; solo escapar de la grande marca la mazmorra completada).
- **Contrarreloj**: tiempo según tamaño (pequeña 3/4/6 min, mediana 5/8/11, grande 8/12/16). Puntos por tesoro según rareza (común 1, raro 3, épico 8, legendario 20) más extras por tablillas sin ayudas; bonus si escapas a tiempo.
- **Expedición del día**: misma cripta para todos según la fecha (sin servidor), contrarreloj de 8 min mediano con 2 modificadores (antorcha mojada, munición escasa, la cripta despierta, herido, escritura antigua). Ranking opcional con Supabase.
- **Con amigos (sala)**: hasta 4 cazadores, WebRTC con PeerJS (sin servidor propio; código de sala/enlace por WhatsApp), misma semilla y reloj, relojes más largos (pequeña 4/6/8, mediana 8/12/16, grande 14/20/26). El anfitrión elige tesoros **exclusivos** (cada tesoro es de quien lo toma primero) o **compartidos** (todos pueden recogerlo, gana quien más reúna). Marcador final. El anfitrión simula los enemigos; sellos y pasadizos son individuales, los acertijos son los mismos para todos. Reconexión ~25 s con puesto guardado; si cae el anfitrión, cada uno sigue solo.

## Mazmorras (7, `datos/mazmorras.js`)
1 Cripta del Escarabajo (Egipto) · 2 Templo de las Arenas (Egipto) · 3 Fortaleza del Glaciar (vikingos) · 4 Cueva de Drake (galeón pirata) · 5 Templo del Jaguar (maya, selva) · 6 Templo Maldito (secta, lava, pinchos) · 7 Tumba del Cruzado (catacumbas, 3 pruebas del cáliz; solo un cáliz verdadero, hay `f` falsos).
Cada una: 4 zonas (~2.600-3.000 casillas) con laberinto de túneles generado por partida (salas con hordas, pinchos, callejones con tesoros, cámaras selladas, tesoros tapiados), tinte de muros por zona, hitos/murales para orientarse, un ala con alturas (escalones, fosos, balcones), tablilla que abre la siguiente zona, cámara final con tesoro legendario tras pasadizo secreto. Planos de texto (`#` muro, `.` suelo, `D` puerta, `S` secreto, `X` salida, `^` pinchos, `~` lava, `_` abismo, `:` puente oculto, `T` tablilla, `Z` sello, `1-9` tesoros).

## Enemigos y guardianes
- Propios por mazmorra: momias/esqueletos, draugr, piratas, guerreros jaguar, sectarios, caballeros cruzados; más bestias gigantes al azar (escorpión, araña, serpiente) y a veces un coloso de piedra.
- Arqueros (disparan de lejos, retroceden), brujo desde zona 2 (fuego, se teletransporta), muchos esperan ocultos (arañas del techo, otros del suelo).
- Trampas: dardos en pasillos rectos, roca rodante desde zona 2 (24-32 de daño), pinchos, lava, abismo.
- **Guardianes** (uno por mazmorra, vigila la reliquia más valiosa): Jepri (faraón escarabajo), sacerdote de Anubis, Jarl de hielo, capitán del galeón, Rey Jaguar, sumo sacerdote del culto, Caballero Negro. ~10 balazos, embisten a media distancia, llaman 2 siervos por cada tercio de vida perdido, barra de vida arriba.

## Armas y objetos
- Látigo (cuerpo a cuerpo), revólver (6 balas), escopeta de dos cañones (7 perdigones, fuerte de cerca; cajas de 6, hasta 24), Tommy gun (ráfaga 12/s, cargador 30, reserva 150; una por mazmorra, zona 2, solo en mediana/grande). Cambio con 1-4, Q o rueda.
- Revólver, escopeta y palanca de hierro están en salas ocultas de la primera zona. Cajas de balas, vendas, antorcha en mano izquierda (luz ~7 m).
- **Palanca de hierro** (`barreta`): fuerza un sello una sola vez sin resolver la tablilla (no da puntos ni cuaderno). En sala, solo abre para quien la usó.
- Tesoros: rarezas común/raro/épico/legendario (`datos/tesoros.js`), con halo según rareza.

## Acertijos
- Tablillas con pista críptica del banco (`datos/pistas.js`, generado), dificultad 1-5, ayudas progresivas (tipo, definición, indicador/relleno, primera letra). Los acertijos necesarios para salir son fáciles (1-2); los de tesoros/cámaras pueden ser duros.
- Cadena de tablillas: cada una abre la cámara de la siguiente, más difícil.
- Mecanismo de **palancas**: la mitad de las cámaras selladas; 4 palancas con símbolos y pistas de lógica de orden, se eligen hasta que solo hay una solución.
- **Cuaderno del cazador**: respuestas, mejor tiempo, ayudas usadas. Resolver sin ayudas da puntos = estrellas de dificultad. Rangos por pistas distintas sin ayudas: Aprendiz de escriba, Escriba (3), Erudito (10), Sabio de la cripta (25), Gran hierofante (60).

## HUD y controles
- PC: WASD/flechas, ratón, clic ataca, E/Espacio usa, R recarga, 1-4/Q cambia arma, Tab/M mapa, Esc pausa.
- Celular: joystick izquierdo, arrastrar a la derecha para mirar, un botón de atacar, puntería asistida, mano de "usar" contextual, recarga automática, cambio de arma tocando su recuadro, vibración; opciones de sensibilidad, zurdo, vibración. Opción gráfica "Retro" (baja resolución).
- HUD: vida, munición por arma, casillas de arma/palanca, barra del guardián, reloj en contrarreloj.

## Mapa y museo
- **Automapa** (`Tab/M`): solo lo explorado; en sala, otros cazadores solo donde ya exploraste (pulso 8 s al llevarse un tesoro).
- **Colección/Museo** (`datos/museo.js`, `main.js`): vitrinas por rareza (estantería, caoba, ébano/plata, marco dorado) o por sala de museo (una por mazmorra con lore); ficha de cada pieza con mazmorra donde se halló y lore por forma y rareza.

## Mapa de archivos
- `index.html`, `css/estilo.css`: pantallas, HUD, táctil. `manifest.webmanifest`, `sw.js` (caché offline; sumar archivos nuevos a `ARCHIVOS` y subir `CACHE`, o `npm run cache`).
- `js/main.js`: menús, bucle, progreso (`localStorage`), cuaderno, colección. `js/juego.js`: reglas (movimiento, armas, enemigos, puertas, tesoros). `js/mapa.js`: plano → casillas/objetos/enemigos/dardos/rocas. `js/laberinto.js`: genera túneles, zonas, `variarPlano`. `js/fauna.js`: qué monstruos salen. `js/hitos.js`: murales. `js/escena.js`, `js/render.js`: escena y motor WebGL. `js/texturas.js`: texturas y sprites pixel art. `js/arma.js`: armas en primera persona. `js/entrada.js`: teclado/ratón/táctil. `js/acertijos.js`, `js/palancas.js`, `js/etiquetas.js`: tablillas, palancas, rótulos. `js/audio.js`, `js/musica.js`: efectos y música sintetizada. `js/automapa.js`. `js/diaria.js`, `js/ranking.js`: expedición del día. `js/red.js`: salas WebRTC.
- `datos/`: `mazmorras.js`, `tesoros.js`, `emblemas.js`, `museo.js`, `pistas.js` (generado con `herramientas/generar-pistas.py` desde `fuentes/banco-pistas.json`), `red.js`, `ranking.js`.
- `npm run revisar` = validar (semillas/tamaños) + comprobar caché + prueba en Chromium.
