-- ============================================================
-- Correr esto DESPUÉS del script principal (supabase_setup.sql)
-- Le da a la página pública una forma segura de saber qué horarios
-- están ocupados, sin poder leer nombres ni teléfonos de clientes.
-- ============================================================

create or replace function public.get_horarios_ocupados()
returns table (fecha date, hora text)
language sql
security definer
set search_path = public
as $$
  select fecha, hora from turnos where estado <> 'cancelado';
$$;

grant execute on function public.get_horarios_ocupados() to anon, authenticated;
