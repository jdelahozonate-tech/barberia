-- Guardar los horarios de un barbero en una sola transacción (antes: delete + insert por separado).
create or replace function public.guardar_horarios_barbero(p_barbero uuid, p_horarios jsonb)
returns integer
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare v_negocio uuid := public.mi_negocio(); n integer := 0;
begin
  if auth.uid() is null or v_negocio is null then raise exception 'Sesión o negocio no válido.'; end if;
  if jsonb_typeof(coalesce(p_horarios,'[]'::jsonb)) is distinct from 'array' then raise exception 'Los horarios no tienen un formato válido.'; end if;
  if not exists (select 1 from public.barberos b where b.id = p_barbero and b.negocio_id = v_negocio) then
    raise exception 'El barbero no pertenece a este negocio.';
  end if;
  delete from public.horarios_barbero where negocio_id = v_negocio and barbero_id = p_barbero;
  insert into public.horarios_barbero(negocio_id, barbero_id, dia_semana, hora_inicio, hora_fin)
  select v_negocio, p_barbero, h.dia_semana, h.hora_inicio, h.hora_fin
  from jsonb_to_recordset(coalesce(p_horarios,'[]'::jsonb)) as h(dia_semana int, hora_inicio time, hora_fin time);
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function public.guardar_horarios_barbero(uuid, jsonb) from public, anon;
grant execute on function public.guardar_horarios_barbero(uuid, jsonb) to authenticated, service_role;
