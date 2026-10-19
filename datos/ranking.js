// Ranking en línea de la expedición del día (Supabase). Mientras estén vacíos, el ranking no aparece
// y el juego funciona igual. Los pasos para crear el proyecto están en herramientas/ranking.sql.
// La clave pública ("anon") se puede publicar: la base solo deja leer y agregar resultados.
export const RANKING = {
  url: '',      // por ejemplo 'https://abcdefgh.supabase.co'
  clave: '',    // la clave "anon public" del proyecto
};
