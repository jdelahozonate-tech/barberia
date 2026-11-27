-- Entrada de mercancía simple (sin proveedor, caja ni pagos): suma existencias y recalcula el costo promedio ponderado.
create or replace function public.registrar_entrada_inventario(p_items jsonb, p_nota text default null)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare
  v_negocio uuid := public.mi_negocio(); v_usuario uuid := auth.uid();
  v_rol text := coalesce(public.mi_rol(),''); it record; v_prod public.productos%rowtype;
  v_stock numeric; v_nuevo_costo numeric; n integer := 0; v_motivo text;
begin
  if v_usuario is null or v_negocio is null or v_rol not in ('ADMINISTRADOR','SUPERVISOR') then
    raise exception 'No tienes permisos para registrar entradas de inventario.';
  end if;
  if jsonb_typeof(coalesce(p_items,'[]'::jsonb)) is distinct from 'array' or jsonb_array_length(coalesce(p_items,'[]'::jsonb)) = 0 then
    raise exception 'Agrega al menos un producto.';
  end if;
  v_motivo := 'Entrada de mercancía' || coalesce(': ' || nullif(btrim(p_nota),''), '');
  for it in select * from jsonb_to_recordset(p_items) as x(producto_id uuid, cantidad numeric, costo_unitario numeric) loop
    if it.producto_id is null or it.cantidad is null or it.cantidad <= 0 or it.cantidad::text in ('NaN','Infinity','-Infinity')
       or it.costo_unitario is null or it.costo_unitario < 0 or it.costo_unitario::text in ('NaN','Infinity','-Infinity') then
      raise exception 'Revisa las cantidades y los costos.';
    end if;
    select * into v_prod from public.productos where id = it.producto_id and negocio_id = v_negocio for update;
    if not found or v_prod.estado <> 'ACTIVO' then raise exception 'Un producto no existe o está inactivo.'; end if;
    select coalesce(existencias,0) into v_stock from public.stock_actual where producto_id = it.producto_id and negocio_id = v_negocio;
    v_stock := greatest(coalesce(v_stock,0),0);
    -- costo promedio ponderado entre lo que había y lo que entra
    v_nuevo_costo := round((v_stock * coalesce(v_prod.costo_unitario,0) + it.cantidad * it.costo_unitario) / (v_stock + it.cantidad), 4);
    insert into public.movimientos_inventario(negocio_id, producto_id, fecha_hora, tipo_movimiento, cantidad, costo_unitario, motivo, usuario_responsable)
    values (v_negocio, it.producto_id, now(), 'ENTRADA', it.cantidad, it.costo_unitario, v_motivo, v_usuario);
    update public.productos set costo_unitario = v_nuevo_costo where id = it.producto_id and negocio_id = v_negocio;
    n := n + 1;
  end loop;
  return jsonb_build_object('productos', n);
end $$;
revoke all on function public.registrar_entrada_inventario(jsonb,text) from public, anon;
grant execute on function public.registrar_entrada_inventario(jsonb,text) to authenticated, service_role;
