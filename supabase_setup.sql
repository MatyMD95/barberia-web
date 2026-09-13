-- ============================================================
-- SISTEMA DE TURNOS — Setup de Supabase (Barbería del Barrio)
-- Pegar y correr TODO este script en: Supabase > SQL Editor > New query > Run
-- ============================================================

-- ---------- Extensión necesaria para generar IDs ----------
create extension if not exists "pgcrypto";

-- ---------- Tabla: servicios ----------
create table servicios (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  descripcion text,
  precio numeric not null default 0,
  duracion int not null,
  activo boolean not null default true,
  imagen text,
  created_at timestamptz not null default now()
);

-- ---------- Tabla: turnos ----------
create table turnos (
  id uuid primary key default gen_random_uuid(),
  cliente text not null,
  telefono text,
  servicio_id uuid references servicios(id) on delete set null,
  fecha date not null,
  hora text not null, -- formato "HH:MM", como texto simple (evita los líos de autoformato que tuvimos en Sheets)
  estado text not null default 'pendiente'
    check (estado in ('pendiente','confirmado','cancelado','finalizado','bloqueado')),
  created_at timestamptz not null default now()
);

-- ---------- Tabla: config (una sola fila, id fijo = 1) ----------
create table config (
  id int primary key default 1,
  dias_atencion int[] not null default '{1,2,3,4,5,6}',
  hora_apertura text not null default '09:00',
  hora_cierre text not null default '20:00',
  duracion_slot int not null default 30,
  descansos jsonb not null default '[{"desde":"13:00","hasta":"16:00"}]',
  constraint solo_una_fila check (id = 1)
);

-- ============================================================
-- SEGURIDAD (Row Level Security)
-- Público (cualquiera que visite la página) puede: leer servicios y
-- config, y crear turnos (reservar). Todo lo demás (editar, borrar,
-- ver la lista de turnos) requiere estar logueado como dueño del panel.
-- ============================================================

alter table servicios enable row level security;
alter table turnos    enable row level security;
alter table config    enable row level security;

-- Servicios: lectura pública, escritura solo logueado
create policy "servicios_select_public" on servicios for select using (true);
create policy "servicios_insert_auth"   on servicios for insert to authenticated with check (true);
create policy "servicios_update_auth"   on servicios for update to authenticated using (true);
create policy "servicios_delete_auth"   on servicios for delete to authenticated using (true);

-- Turnos: cualquiera puede crear uno (reservar), pero solo el dueño ve/edita/borra la lista
create policy "turnos_insert_public" on turnos for insert to anon, authenticated with check (true);
create policy "turnos_select_auth"   on turnos for select to authenticated using (true);
create policy "turnos_update_auth"   on turnos for update to authenticated using (true);
create policy "turnos_delete_auth"   on turnos for delete to authenticated using (true);

-- Config: lectura pública, solo el dueño la edita
create policy "config_select_public" on config for select using (true);
create policy "config_update_auth"   on config for update to authenticated using (true);
create policy "config_insert_auth"   on config for insert to authenticated with check (true);

-- ============================================================
-- DATOS INICIALES (los mismos que ya tenías en Google Sheets)
-- ============================================================

insert into config (id, dias_atencion, hora_apertura, hora_cierre, duracion_slot, descansos)
values (1, '{1,2,3,4,5,6}', '09:00', '20:00', 30, '[{"desde":"13:00","hasta":"16:00"}]');

insert into servicios (nombre, descripcion, precio, duracion, activo) values
  ('Corte de cabello', 'Corte a tijera y máquina, incluye lavado.', 12000, 30, true),
  ('Corte + barba', 'Combo completo, prolijidad de contornos.', 0, 45, true), -- TODO: falta precio real
  ('Barba', 'Perfilado y arreglo con navaja.', 0, 20, true); -- TODO: falta precio real
