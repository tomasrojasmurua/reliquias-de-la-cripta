// Servidores de relevo (TURN) propios para las salas con amigos. Es opcional.
//
// Normalmente los navegadores se conectan directo entre sí; cuando una red lo impide (algunas redes móviles o de
// oficina), PeerJS usa unos servidores de relevo gratuitos y compartidos que pueden fallar o saturarse. Para que
// las salas conecten siempre, se puede agregar aquí un servidor TURN propio (o de un servicio de pago), por ejemplo:
//
//   { urls: 'turn:turn.mi-dominio.com:3478', username: 'usuario', credential: 'clave' }
//
// Las claves quedarían visibles en la página: usa credenciales de uso limitado.
export const SERVIDORES_ICE = [];
