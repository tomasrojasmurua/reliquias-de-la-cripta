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

Cada mazmorra tiene un **laberinto de túneles que cambia en cada partida** (`js/laberinto.js`): pasillos con bifurcaciones y callejones sin salida, salas con hordas o vacías, pinchos en algunos pasillos y dos tesoros escondidos en los callejones más hondos, dentro de **cámaras selladas** cuya tablilla está en alguna sala del laberinto (`camaras` en `laberinto` o en cada zona; dos por defecto). Los demás tesoros generados van a veces tapiados tras un muro agrietado. Una tablilla nunca muestra la misma pista que otra de la misma partida. El plano fijo de arriba también cambia en cada partida (`variarPlano` en `js/laberinto.js`): se le suman pasos nuevos entre pasillos lejanos, pilares en las salas grandes y **salas escondidas** en la roca (tras un pasadizo secreto, una puerta común o una puerta que abre una tablilla). Una de ellas guarda el **revólver**, que ya no está en un sitio fijo: un pasadizo secreto o un acertijo lo separan de ti. Los pasadizos secretos tienen una grieta bien marcada en el muro y, a pocos pasos y mirando hacia ellos, sale una corriente de aire que mueve el polvo y avisa una vez (desde entonces «Usar» se ilumina frente a esa pared). Cada zona suma además **atajos tras puertas con acertijo** (`ponerAtajos`): un muro entre dos pasillos que por el camino normal quedan lejos; la tablilla está en otra sala de la misma zona. Las tablillas y los sellos llevan su nombre escrito encima (`js/etiquetas.js`): la puerta dice qué tablilla la abre y al descifrar una tablilla se agrieta (como si se rompiera el hechizo que cerraba la puerta) y su rótulo y el de la puerta se atenúan. Los enemigos comunes tienen 1,5 veces más vida y golpean apenas más fuerte y seguido; no todos los golpes los hacen retroceder.

**Todas las mazmorras son por zonas** (`sectores` en `datos/mazmorras.js`; la Cripta del Escarabajo los define a mano y las demás los arman con `ampliacion` a partir de su laberinto): entre 2.600 y 3.000 casillas caminables en cuatro zonas. La primera es el plano fijo con sus túneles; las otras son bloques de laberinto generados, cada uno con sus salas y de 1 a 4 reliquias. La tablilla de cada zona (un acertijo del banco) abre el sello hacia la siguiente; la última, la cámara de Jepri con el tesoro legendario, está tras un pasadizo secreto y un sello que abre la tablilla del hipogeo. La entrada se derrumba al empezar y la salida, sin antorcha propia, se esconde en un ramal hondo de la zona 2 o 3, elegida al azar. El HUD muestra «Zona N: x de y reliquias» y el automapa nombra las zonas, marca las completas y señala la salida al verla.

**Para orientarse sin abrir el mapa** (`js/hitos.js`), cada zona tiñe sutilmente sus muros (la primera queda como está, la segunda más ocre, la tercera más fría y la cámara extra rojiza; el suelo y el techo, a medias) y unas dos de cada tres salas de los laberintos tienen un hito: un mural pintado o tallado en uno de sus muros (frisos de jeroglíficos, runas o la serpiente emplumada que cubren todo un lado, el disco solar alado, el ojo de Horus, manos en negativo, espirales, un escudo con hachas, la calavera pirata, la piedra del sol, una máscara de jade, la cruz de la abadía) o una estatua en el centro que no deja pasar (un chacal, un obelisco, un guerrero, una cabeza colosal, un tótem, un menhir rúnico). El repertorio depende del ambiente de la mazmorra y dentro de una zona no se repite un motivo hasta agotarlos. Los hitos salen de la semilla con su propio azar, así que no cambian la mazmorra y todos ven los mismos. Todo el azar de la generación sale de una semilla (`cargarMazmorra(def, semilla)`), así que la misma semilla da la misma mazmorra.

Cada mazmorra tiene además un **ala nueva con alturas**, con su propia tablilla (`L`) y su sello (`Q`): una galería con foso y estrado en la cripta, una pirámide escalonada en el templo de las arenas, el salón del jarl con balcón y lago helado, una bahía de contrabandistas con muelle y acantilado, un cenote sagrado en la selva, unas minas con pasarelas sobre un río de lava y un osario con entresuelo y sala de lectura hundida.

En las últimas mazmorras, cada tablilla abre la cámara donde está la siguiente, más difícil: dificultad 1–2, luego 3, luego 4–5, con un tesoro legendario al final. Cada mazmorra tiene además un pasadizo secreto con un tesoro escondido.

Una de cada dos cámaras selladas no se abre con una pista críptica sino con un **mecanismo de palancas** (`js/palancas.js`): cuatro palancas con símbolos (el sol, la luna, la serpiente, el escarabajo…) y unas pistas de lógica sobre el orden en que se bajan, como «La del sol va justo antes que la de la luna» o «La palanca de la serpiente no va al final». Las pistas se eligen al azar hasta que solo un orden las cumple. Si te equivocas, las palancas vuelven a subir; «Pedir ayuda» revela la primera, luego la segunda.

## Cuaderno del cazador
Cada inscripción que descifras se anota en el **Cuaderno** de la portada (`progreso.cuaderno`, en `js/main.js`): su respuesta y explicación, tu mejor tiempo y con cuántas ayudas la resolviste. Descifrar una tablilla **sin pedir ninguna ayuda** da puntos extra, tantos como estrellas de dificultad (1 a 5; 2 en el mecanismo de palancas), que suman al botín del contrarreloj, de la expedición del día y de las salas. El número de pistas distintas resueltas sin ayudas da el rango: Aprendiz de escriba, Escriba (3), Erudito (10), Sabio de la cripta (25) y Gran hierofante (60).  La solución nunca se muestra: la ayuda máxima es la primera letra.

**Los acertijos que hay que resolver para salir son fáciles.** Las tablillas que abren el paso hacia la zona de la salida (y cualquier otra sin la que no se pueda llegar a ella) tienen dificultad 1–2; las que esconden tesoros, cámaras o zonas ocultas pueden ser más duras y quedar sin resolver. `npm run validar` lo comprueba en cada mazmorra y semilla.

## La palanca de hierro
Cada cripta esconde una **palanca de hierro** (`barreta` en el código), siempre en una sala oculta tras un pasadizo secreto (`variarPlano` en `js/laberinto.js`; en un plano de salas abiertas, en un nicho emparedado). Con ella en la mano aparece una casilla «Palanca» en el HUD. Frente a un sello, «Usar» pide confirmar con una segunda pulsación y entonces lo **fuerza**: el sello se abre sin descifrar su tablilla y la palanca se rompe, así que sirve una sola vez. Un sello forzado no cuenta como acertijo resuelto (no da puntos de acertijo ni entra al cuaderno) y la tablilla sigue disponible. Nunca hace falta para salir: solo abre sellos que de todos modos se pueden abrir con su tablilla.

En una sala con amigos, forzar un sello lo abre **solo para quien usó la palanca**, igual que los sellos y pasadizos, que son de cada uno. Los demás reciben el aviso «X forzó una puerta» y siguen necesitando el acertijo. (Para que la puerta se abra para todos, bastaría con que `alForzado` en `js/main.js` también abriera los sellos de ese acertijo.)

## Guardianes
Cada mazmorra tiene un guardián que vigila su reliquia más valiosa (la que no está escondida en un nicho): Jepri, el faraón escarabajo; el sacerdote de Anubis; el Jarl de hielo; el capitán del galeón; el Rey Jaguar; el sumo sacerdote del culto y el Caballero Negro. Son más grandes que los demás enemigos, llevan corona o tocado, aguantan unos diez balazos y no se frenan con cada golpe. Cuando te ven a media distancia **embisten** en línea recta (hay que hacerse a un lado), y al perder cada tercio de vida **llaman a dos siervos**. Mientras pelean se ve su barra de vida arriba, y al caer dejan vendas. Se declaran con `guardian: { tipo, nombre }` en `datos/mazmorras.js`; sus valores están en `GUARDIANES` (`js/juego.js`) y su dibujo en `ESTILOS` (`js/texturas.js`).

## Armas
Hay cuatro: el **látigo** (cuerpo a cuerpo), el **revólver** (6 balas, de largo alcance) y la **escopeta** de dos cañones (`escopeta` en `js/juego.js`): siete perdigones que se abren con la distancia, así que de cerca es lo más fuerte del juego, de lejos casi no hace nada, y puede herir a varios enemigos a la vez. Se carga con cartuchos aparte (cajas de 6, hasta 24; dos en el tubo) y se cambia de arma con 1, 2, 3 y 4, con Q o con la rueda. El revólver, la palanca de hierro y la escopeta están cada uno en una sala oculta de la primera zona (`variarPlano` en `js/laberinto.js`), así que incluso la mazmorra pequeña trae esas tres.

La **Tommy gun** (`tommy` en `js/juego.js`) dispara en ráfaga mientras se mantiene el botón (12 balas por segundo, poca fuerza cada una y algo de dispersión). Usa cargadores de tambor de 30 (hasta 150 de reserva) y es una sola por mazmorra: está en un callejón de la segunda zona, con un par de cargadores cerca (`ponerEnCallejones` en `js/laberinto.js`), así que solo la traen la mazmorra mediana y la grande.

## Enemigos

Cada mazmorra tiene sus enemigos propios (momias y esqueletos, draugr, piratas, guerreros jaguar, sectarios, caballeros cruzados), pero ninguna partida es igual: se sueltan una o dos bestias gigantes al azar (escorpión, araña o serpiente) y a veces un **coloso de piedra**, lento pero durísimo. Los **arqueros** (esqueletos con arco, ~14 % de los sitios) disparan flechas rápidas desde lejos, se quedan a tiro y retroceden si te les acercas: hay que cubrirse tras una esquina o acorralarlos. Los pasillos rectos largos esconden a veces una **trampa de dardos**: un muro con cuatro agujeros al fondo que dispara cada pocos segundos a lo largo del pasillo (`dardos` en `js/mapa.js`; el dardo sale del reloj del juego, no de la red). De la segunda zona en adelante hay más arqueros (hasta ~22 %) y aparece el **brujo** (violeta, con sombrero y bastón): lanza fuego como el sectario y, si te le acercas o lo hieres, se desvanece y reaparece a 5–11 m con línea de vista (`teletransportar` en `js/juego.js`; el anfitrión lo simula y los invitados copian su posición). También desde la segunda zona, algunos tramos rectos de pasillo tienen una **roca rodante** que va y viene sin parar y aplasta (24–32 de daño, una vez cada 1,6 s); retumba cuando está cerca, y su posición sale del reloj como los dardos (`rocas` en `js/mapa.js`). Los monstruos no están siempre en el mismo sitio: algunos lugares quedan vacíos, otros cambian de monstruo y aparecen otros en cualquier parte. Muchos esperan escondidos y salen cuando pasas cerca (las arañas bajan del techo colgadas de su hilo; el resto sale del suelo), así que al entrar a una sala nunca sabes qué te espera.

## Contrarreloj
Al elegir una mazmorra se prepara la expedición: el modo, **Explorar** (sin reloj) o **Contrarreloj**; el tamaño, **Pequeña** (solo la primera zona), **Mediana** (las dos primeras) o **Grande** (todas, con la cámara secreta); y en el contrarreloj el tiempo, que depende del tamaño (pequeña 3, 4 o 6 minutos; mediana 5, 8 u 11; grande 8, 12 o 16). La mazmorra se recorta con `recortarZonas` en `js/laberinto.js`; solo escapar de la grande la marca como completada. Cada tesoro da puntos según su rareza (común 1, raro 3, épico 8, legendario 20). Si escapas antes de que se acabe el tiempo te llevas todos los puntos y los tesoros pasan a tu colección; si se apaga la última antorcha estando adentro, pierdes la mitad de los puntos y ningún tesoro va a la colección. En el último minuto las antorchas de los muros se van apagando. Morir no termina la partida: sueltas tu último tesoro donde caíste y reapareces en el inicio. El reloj sigue corriendo mientras lees una tablilla. Se guarda el récord de cada mazmorra, tamaño y duración, y «Revancha» genera un laberinto nuevo. Es la base del futuro modo multijugador.

## Salas con amigos

En «Preparar la expedición» el modo **Con amigos** crea una sala de hasta 4 cazadores. El anfitrión comparte el enlace por WhatsApp (o lo copia); quien lo abre cae en «Unirse a una sala» con el código ya puesto. Cuando están todos, el anfitrión empieza: cuenta atrás y todos entran a la misma cripta (misma semilla), con el mismo reloj, viendo a los demás moverse. Al final hay un marcador.

Los navegadores se conectan entre sí con WebRTC (PeerJS, en `js/vendor/`, MIT) y no hay servidor propio; solo se usa el servidor gratuito de PeerJS para presentarlos con el código. Con `?senal=host:puerto` se usa otro (pruebas locales: `npx peerjs --port 9000`). En las salas los relojes son más largos que en el contrarreloj en solitario (pequeña 4, 6 u 8 minutos; mediana 8, 12 o 16; grande 14, 20 o 26). Al crear la sala el anfitrión elige tesoros **exclusivos** o **compartidos**. Si son compartidos, todos pueden recoger cada tesoro y gana quien más reúna. Si son exclusivos, cada tesoro es de quien lo pide primero al anfitrión; los demás encuentran en su lugar una nota «¡Llegaste tarde!» con el sello del ganador. Si un cazador cae, suelta su último tesoro y vuelve a estar disponible para todos. El anfitrión también elige el **combate entre cazadores** (por defecto sí con tesoros exclusivos y no con compartidos): el látigo, el revólver y la escopeta hieren a los demás con el 60% del daño que hacen a los enemigos (la Tommy gun, el 35%, para que una ráfaga no decida el duelo), quien cae suelta su último tesoro donde cayó (el primero que llegue se lo lleva) y se avisa «X derrotó a Y». Nadie recibe golpes de otros cazadores durante los primeros 10 segundos de la partida ni 4 segundos tras reaparecer. Con combate el automapa no muestra a los demás en vivo, solo un pulso de su color cuando toman un tesoro (con tesoros compartidos, cuando les sube el puntaje). El marcador en vivo (arriba a la izquierda) ordena a los cazadores por puntos. Al terminar se ve quién consiguió cada tesoro y quién resolvió cada acertijo, para comentarlo.

Si a un invitado se le corta la conexión en plena partida, el juego la reintenta solo durante unos 25 segundos y el anfitrión le guarda el puesto (recupera los tesoros que se llevaron mientras no estaba). Si el anfitrión se cae, cada invitado sigue por su cuenta. Hay mensajes rápidos (botones en el celular; Z, X, C y V en el computador) y los otros cazadores aparecen en el automapa solo donde ya exploraste; cuando uno se lleva un tesoro, se le ve unos 8 segundos con un pulso de su color aunque esté en zona desconocida (sobre un círculo de niebla, sin revelar el plano).

Si alguna red no deja conectar, PeerJS usa unos servidores de relevo gratuitos y compartidos que pueden saturarse; para que conecten siempre se puede agregar uno propio en `datos/red.js` (o probar con `?turn=turn:host:3478|usuario|clave`).

Los enemigos los mueve el anfitrión: persiguen al cazador más cercano y los demás ven lo mismo (un invitado le pega al enemigo y el anfitrión le resta la vida; si el anfitrión termina antes, sigue simulándolos para los demás). Los sellos y pasadizos son de cada uno, pero los acertijos son los mismos para todos: quien descifra uno que otro no logra saca ventaja, y eso es parte del juego.

## Expedición del día
Desde la portada, **Expedición del día** lleva a una cripta que es la misma para todos ese día: la mazmorra, los túneles, la salida y las pistas de las tablillas salen de la fecha (`js/diaria.js`), así que no hace falta servidor. Es un contrarreloj de 8 minutos en tamaño mediano, con dos modificadores del día: **Antorcha mojada** (la antorcha alumbra la mitad), **Munición escasa** (3 balas en el revólver y cajas de 6), **La cripta despierta** (los enemigos ven más lejos y corren más), **Herido** (60 de vida) o **Escritura antigua** (pistas un punto más difíciles). Las mazmorras se turnan sin repetirse dos días seguidos. Solo cuenta el primer intento de cada día: queda guardado, suma a la racha de días seguidos y se puede **compartir** como texto (puntos, tiempo y un cuadrito por tesoro según su rareza, sin nombres para no dar pistas). Los intentos siguientes son práctica y no cuentan para los récords del contrarreloj.

**Ranking en línea.** Si `datos/ranking.js` tiene un proyecto de Supabase (gratis), la pantalla de la expedición muestra los 10 mejores del día y un campo para tu nombre. El primer intento de cada día se sube solo; si no hay conexión, se sube la próxima vez que abras la expedición. Para activarlo: crea el proyecto, corre `herramientas/ranking.sql` en su SQL Editor y copia la URL y la clave «anon public» a `datos/ranking.js`. La clave pública solo deja leer el ranking y agregar resultados del día; no deja borrar ni cambiar nada. Sin configurar, el ranking no aparece y el juego funciona igual.

## Controles
- **Computador:** WASD o flechas para moverte, ratón para mirar (clic para capturarlo), clic para atacar, E o Espacio para usar, R para recargar, 1/2 o Q para cambiar de arma, Tab o M para el mapa, Esc para pausar.
- **Celular:** joystick en la mitad izquierda para moverse (con zona muerta); arrastrar en la derecha para mirar, con curva de respuesta y suavizado. Un solo botón de atacar que, mantenido y arrastrado, también apunta. Puntería asistida, la vista vuelve sola al horizonte un momento después de dejar de mirar, la mano aparece solo cuando hay algo que usar enfrente, el revólver se recarga solo y el arma se cambia tocando su recuadro en el HUD, vibración al disparar y al recibir daño (Android). En Opciones: sensibilidad, modo zurdo y vibración.

## Cómo está hecho
El motor usa **WebGL directo** (sin librerías). Cada mazmorra es una rejilla, como en Wolfenstein y Doom, pero se convierte en geometría 3D real: muros, suelos y techos son polígonos, y enemigos y objetos son sprites que siempre miran a la cámara. Así se consigue el aspecto de Doom (texturas pixel art con filtro *nearest*, luz que se apaga con la distancia, bandas de luz) pero dibujado a la resolución nativa de la pantalla, más nítido que el original, y la tarjeta gráfica hace el trabajo, así que corre fluido en celulares. La opción **Retro** dibuja a baja resolución para el aspecto original.

Las mazmorras son oscuras: solo iluminan algunas antorchas en los muros, la lava y la salida. El cazador lleva su propia **antorcha en la mano izquierda**, que da una luz cálida y titilante de unos 7 metros a su alrededor. Los tesoros no se iluminan solos: hay que acercarles la antorcha. Los raros, épicos y legendarios dejan ver un halo tenue de su color y destellos que giran a su alrededor.

Cada casilla tiene su propia altura de suelo y de techo, así que hay escaleras, plataformas, balcones y fosos (como los sectores de Doom): los escalones bajos se suben caminando y los altos solo se pueden bajar. Los enemigos tampoco saltan desniveles.

Las texturas, sprites, el arma en pantalla y los sonidos se generan por código, así que no hay imágenes ni audio que descargar. Los sprites reciben un relieve en cúpula iluminado desde arriba a la izquierda, trama ordenada y contorno al generarse; cada enemigo tiene una silueta propia (la momia avanza con los brazos al frente y un ojo encendido entre las vendas, el esqueleto lleva espada oxidada y escudo partido, el draugr casco de cuernos, barba de escarcha y hacha, el pirata tricornio, parche y garfio, el guerrero jaguar la cabeza del jaguar por casco y una macana de obsidiana, el sectario túnica, capucha y máscara de calavera, el caballero yelmo cerrado, escudo y espada) y las bestias gigantes (escorpión, araña y serpiente) y el coloso de piedra se dibujan enteros; todos se desploman en varios fotogramas. Las manos, el revólver, el látigo y la antorcha se dibujan con degradados (piel, acero pavonado, nogal cuadriculado, cuero trenzado, manga de cuero con puño de camisa) y luego se reducen a pixel art con trama; muros, suelos, techos, puertas, sellos y tablillas se arman con un campo de alturas (bloques con bisel y bordes mellados, piedras irregulares, tablones con vetas, herrajes con remaches) que se ilumina desde arriba a la izquierda, oscurece juntas y grietas y se reduce con trama ordenada; la lava, las vetas del templo maldito y la luz de la salida brillan por sí solas; los enemigos se iluminan al recibir un golpe, salpican polvo, huesos, sangre o chispas y caen en varios fotogramas; caminan con cuatro cuadros y balancean los brazos. Los tesoros tienen volumen, vetas de brillo y contorno del color de su metal. Las antorchas de los muros tienen llamas animadas que sueltan brasas, flota polvo en el aire a la luz de la antorcha y hay huesos, cráneos, vasijas, escombros, velas y telarañas junto a los muros. Cada mazmorra tiene su ambiente sonoro (gotas, viento, olas y crujidos de madera, pájaros e insectos, burbujas de lava) y su propio tema musical procedural: ney y laúd en la cripta, rabel y sonajas en el templo de las arenas, cuernos y coro en el glaciar, violín marinero en 6/8 en la cueva de Drake, marimba y ocarina en la selva, tanpura, bansuri y tabla en el templo maldito, órgano y canto llano en la tumba del cruzado; los menús tienen su tema de aventura y, al preparar una expedición, suena el de esa mazmorra. La música respira (bordón, colchón, ostinato, percusión y frases) y suma tambores solo cuando un enemigo te tiene a la vista. Cada enemigo tiene su voz (alerta, gruñidos, ataque, dolor, muerte, pisadas) que suena con su distancia y su lado, y solo mientras te ve: nada de ruidos del otro lado de un muro. Hay pasos según el suelo, eco y sonidos para los menús, la llegada, la victoria y la derrota. El **automapa** dibuja solo lo que ya viste.

La **colección** muestra los tesoros en vitrinas, una por rareza: estanterías de madera para los comunes, caoba con remaches de bronce y terciopelo azul para los raros, ébano y plata con luz de velas para los épicos, y un marco dorado con terciopelo carmesí, rayos de luz y reflejo en el vidrio para los legendarios. Al tocar una pieza se abre su ficha, con la mazmorra donde se halló (o donde se esconde).

## Archivos
- `index.html`, `css/estilo.css`: pantallas, HUD y controles táctiles.
- `js/main.js`: menús, bucle principal, progreso guardado (`localStorage`).
- `js/render.js`: motor WebGL.
- `js/texturas.js`: texturas y sprites pixel art generados por código.
- `js/mapa.js`: convierte el plano de una mazmorra en casillas, objetos y enemigos.
- `js/juego.js`: reglas: movimiento, colisiones, armas, enemigos, puertas, pasadizos, tesoros.
- `js/fauna.js`: qué monstruos salen en cada partida y dónde: los propios de la mazmorra, una o dos bestias gigantes al azar y a veces un coloso; los sitios del plano cambian y muchos esperan escondidos (bajo el suelo o colgados del techo) hasta que te acercas.
- `js/entrada.js`: teclado, ratón y pantalla táctil.
- `js/arma.js`: revólver, escopeta, Tommy gun y látigo en primera persona.
- `js/acertijos.js`: tablillas con pistas crípticas y ayudas progresivas.
- `js/etiquetas.js`: rótulos flotantes con el nombre de cada tablilla y de la puerta que abre.
- `js/palancas.js`: el acertijo de palancas de las cámaras selladas.
- `js/audio.js`: efectos, voces de los enemigos, ambiente y eco sintetizados.
- `js/musica.js`: los instrumentos, los temas de cada mazmorra y el secuenciador de la música.
- `js/automapa.js`: mapa de lo explorado.
- `js/laberinto.js`: genera los túneles de cada partida.
- `js/hitos.js`: murales y estatuas que hacen reconocible cada sala.
- `js/diaria.js`: la expedición del día (mazmorra, semilla y modificadores según la fecha) y el texto para compartir.
- `js/ranking.js`, `datos/ranking.js`: el ranking en línea de la expedición (Supabase); `herramientas/ranking.sql` crea su tabla.
- `datos/mazmorras.js`: las mazmorras (planos de texto, ver abajo).
- `datos/tesoros.js`: catálogo de tesoros y rarezas.
- `datos/emblemas.js`: el emblema en pixel art de cada mazmorra (16 × 16, una letra por píxel) que se ve al lado de su nombre al elegirla. Una mazmorra nueva necesita el suyo con la misma `id`.
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

Otros campos opcionales: `alturas` (un plano paralelo con la altura del suelo: `.` a ras de suelo, `1`–`9` sube 0.3 m por número, `a`–`e` baja 0.3 m por letra; un escalón de 0.3 m se sube caminando, uno de 0.6 m ya no), `zonas` (rectángulos con otro suelo, techo o muro, la altura del techo `cielo` y la textura `desnivel` de escalones y paredes entre alturas), `laberinto` (`{ lado: 'abajo' | 'derecha', puerta: [x, y], ancho, alto, tesoros: [...] }`: túneles generados en cada partida, unidos por una puerta en la casilla `puerta` del borde del plano), `sectores` (mazmorra por zonas generadas; ver el comentario en `js/laberinto.js`), `derrumbe` (`[x, y]` de la entrada, un muro `%` de escombros que se viene abajo al empezar), `ambiente` (`cripta`, `desierto`, `nieve`, `mar`, `selva`, `lava` o `catacumba`), `avisos` (inscripciones de pista que se leen con «Usar»: `{ K: 'texto' }`), `texTablilla` y `texSello` (texturas de tablillas y sellos), `tinte` (color de la luz) y `leyenda` (caracteres propios, por ejemplo `'=': { tipo: 'muro', tex: 'madera' }`).

Las tablillas y los sellos se declaran en `acertijos`: `T: { id, dificultad: [min, max], sello: 'Z', titulo }` pone una tablilla en cada `T` del plano y un sello en cada `Z`. Al acertar la pista de la tablilla se abren sus sellos. La dificultad (1 a 5) elige al azar una pista del banco de esa dificultad, evitando las que el jugador ya resolvió. La regla es poner tesoros más valiosos tras pistas más difíciles y tras los pasadizos secretos.

## Revisar los cambios
Cada cambio que llega a GitHub pasa por una revisión automática (`.github/workflows/revisar.yml`). Para correrla en tu equipo hace falta Node 22: `npm install` una vez y luego `npm run revisar`, que hace tres cosas:

- `npm run validar` carga cada mazmorra con 25 semillas en los tres tamaños y avisa si falta el inicio, la salida o el guardián, si el borde del plano queda abierto, si un acertijo no tiene tablilla o sello, si un tesoro no existe o está en dos mazmorras, o si no se puede llegar a pie a la salida, a una tablilla o a un tesoro.
- `node herramientas/cache.js --revisar` comprueba que `sw.js` esté al día. Después de cambiar cualquier archivo del juego, `npm run cache` reescribe la lista de archivos y la versión del caché sin conexión.
- `npm run probar` abre el juego en Chromium, entra a cada mazmorra por el menú y falla si aparece un error.

## Pistas crípticas
`datos/pistas.js` se genera desde `fuentes/banco-pistas.json` (copia ese archivo ahí antes de correrlo):

```
python3 herramientas/generar-pistas.py
```

Respuesta y explicación quedan ofuscadas para que no se vean mirando el código. El juego usa las pistas Extras y las pistas del día de Críptico 51 cuya fecha ya pasó; las futuras se suman solas cuando llega su fecha.

Ayudas en cada tablilla, en el orden de la guía: tipo de pista, definición resaltada, indicador y relleno resaltados, primera letra. La solución nunca se muestra al jugador; solo aparece en el cuaderno después de resolverla.

Si agregas un archivo que el juego necesita, súmalo a `ARCHIVOS` en `sw.js` y sube el número de `CACHE`.
