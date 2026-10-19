// Ranking en línea de la expedición del día (Supabase). Mientras estén vacíos, el ranking no aparece
// y el juego funciona igual. Los pasos para crear el proyecto están en herramientas/ranking.sql.
// La clave pública ("anon") se puede publicar: la base solo deja leer y agregar resultados.
export const RANKING = {
  url: 'https://ughyztfkrwjwkayatdhq.supabase.co',
  clave: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVnaHl6dGZrcndqd2theWF0ZGhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI0MjQ3MzQsImV4cCI6MjEwODAwMDczNH0.QK58EyBvCyA1tqMzF_lPemzXbcaOFdXDA4BEFjNE7Zk',   // la clave "anon public"
};
