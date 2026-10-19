-- Ranking en línea de la expedición del día.
--
-- 1. Crea un proyecto gratis en https://supabase.com (New project; cualquier nombre y región).
-- 2. En el proyecto, abre SQL Editor, pega todo este archivo y presiona Run.
-- 3. En Project Settings > API copia la "Project URL" y la clave "anon public"
--    y ponlas en datos/ranking.js (url y clave).
--
-- Cada jugador guarda un solo resultado por día (el primer intento). La clave pública solo
-- permite leer el ranking y agregar resultados con valores razonables; no se puede borrar ni cambiar nada.

create table if not exists expediciones (
  id bigint generated always as identity primary key,
  fecha date not null,
  jugador uuid not null,
  nombre text not null check (char_length(nombre) between 1 and 20),
  puntos int not null check (puntos between 0 and 1000),
  segundos int not null check (segundos between 0 and 3600),
  escapo boolean not null,
  tesoros int not null check (tesoros between 0 and 100),
  creado timestamptz not null default now(),
  unique (fecha, jugador)
);

create index if not exists expediciones_fecha_puntos on expediciones (fecha, puntos desc, segundos);

alter table expediciones enable row level security;

drop policy if exists "leer ranking" on expediciones;
create policy "leer ranking" on expediciones for select to anon using (true);

-- solo resultados de hoy o ayer (por las zonas horarias), nunca de días viejos o futuros
drop policy if exists "agregar resultado" on expediciones;
create policy "agregar resultado" on expediciones for insert to anon
  with check (fecha between current_date - 1 and current_date + 1);

-- el identificador de cada jugador no se muestra a nadie
revoke select on expediciones from anon;
grant select (fecha, nombre, puntos, segundos, escapo, tesoros) on expediciones to anon;
grant insert on expediciones to anon;
