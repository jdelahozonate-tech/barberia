-- Inventario: presentaciones de compra (paca x12, x24, x30...), productos que se regalan y salidas por obsequio.

-- 1) Producto que se regala a los clientes (su costo cuenta contra la utilidad, no se vende).
alter table public.productos add column if not exists regalable boolean not null default false;

-- 2) Presentaciones de compra por producto.
create table if not exists public.presentaciones_producto (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocios(id) on delete cascade,
  producto_id uuid not null references public.productos(id) on delete cascade,
  nombre text not null check (length(btrim(nombre)) between 1 and 60),
  unidades numeric(12,3) not null check (unidades > 0),
  ultimo_costo numeric(14,2) check (ultimo_costo is null or ultimo_costo >= 0),
  creado_en timestamptz not null default now(),
  unique (producto_id, nombre)
);
create index if not exists idx_presentaciones_producto_producto on public.presentaciones_producto(producto_id);
create index if not exists idx_presentaciones_producto_negocio on public.presentaciones_producto(negocio_id);
alter table public.presentaciones_producto enable row level security;
drop policy if exists presentaciones_leer on public.presentaciones_producto;
drop policy if exists presentaciones_escribir on public.presentaciones_producto;
create policy presentaciones_leer on public.presentaciones_producto for select to authenticated
  using (negocio_id = (select public.mi_negocio()));
create policy presentaciones_escribir on public.presentaciones_producto for all to authenticated
  using (negocio_id = (select public.mi_negocio()) and (select public.mi_rol()) in ('ADMINISTRADOR','SUPERVISOR'))
  with check (negocio_id = (select public.mi_negocio()) and (select public.mi_rol()) in ('ADMINISTRADOR','SUPERVISOR'));

-- 3) Nuevo tipo de movimiento: OBSEQUIO (resta existencias y se valora al costo del producto).
alter table public.movimientos_inventario drop constraint if exists movimientos_inventario_tipo_movimiento_check;
alter table public.movimientos_inventario add constraint movimientos_inventario_tipo_movimiento_check
  check (tipo_movimiento = any (array['ENTRADA','SALIDA','AJUSTE','OBSEQUIO']));

create or replace view public.stock_actual as
 select p.id as producto_id, p.negocio_id, p.nombre, p.stock_minimo,
   coalesce(sum(case m.tipo_movimiento
     when 'ENTRADA' then m.cantidad
     when 'SALIDA' then -m.cantidad
     when 'OBSEQUIO' then -m.cantidad
     else m.cantidad end), 0::numeric) as existencias
 from public.productos p
 left join public.movimientos_inventario m on m.producto_id = p.id
 group by p.id;

-- 4) Registrar un obsequio (salida de inventario valorada al costo actual).
create or replace function public.registrar_obsequio(p_producto_id uuid, p_cantidad numeric, p_motivo text default null)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare
  v_negocio uuid := public.mi_negocio(); v_usuario uuid := auth.uid();
  v_rol text := coalesce(public.mi_rol(),''); v_producto public.productos%rowtype; v_stock numeric;
begin
  if v_usuario is null or v_negocio is null or v_rol not in ('ADMINISTRADOR','SUPERVISOR','BARBERO') then
    raise exception 'No tienes permisos para registrar obsequios.';
  end if;
  if p_cantidad is null or p_cantidad <= 0 or p_cantidad::text in ('NaN','Infinity','-Infinity') then
    raise exception 'La cantidad debe ser mayor que cero.';
  end if;
  select * into v_producto from public.productos where id = p_producto_id and negocio_id = v_negocio for update;
  if not found or v_producto.estado <> 'ACTIVO' or not coalesce(v_producto.control_stock,false) then
    raise exception 'El producto no existe, está inactivo o no controla existencias.';
  end if;
  select coalesce(existencias,0) into v_stock from public.stock_actual where producto_id = p_producto_id and negocio_id = v_negocio;
  v_stock := coalesce(v_stock,0);
  if p_cantidad > v_stock then raise exception 'No hay existencias suficientes. Disponible: %.', v_stock; end if;
  insert into public.movimientos_inventario(negocio_id, producto_id, fecha_hora, tipo_movimiento, cantidad, costo_unitario, motivo, usuario_responsable)
  values (v_negocio, p_producto_id, now(), 'OBSEQUIO', p_cantidad, coalesce(v_producto.costo_unitario,0),
          'Obsequio: ' || coalesce(nullif(btrim(p_motivo),''),'cortesía a cliente'), v_usuario);
  return jsonb_build_object('producto_id',p_producto_id,'cantidad',p_cantidad,'costo_total',round(p_cantidad*coalesce(v_producto.costo_unitario,0),2),'existencias_nuevas',v_stock-p_cantidad);
end $$;
revoke execute on function public.registrar_obsequio(uuid,numeric,text) from public, anon;
grant execute on function public.registrar_obsequio(uuid,numeric,text) to authenticated, service_role;

-- CREATE OR REPLACE VIEW pierde las opciones: se restablece que la vista respete el RLS de quien consulta.
alter view public.stock_actual set (security_invoker = true);
revoke all on public.stock_actual from anon;
