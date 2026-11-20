-- Traslada la gestión de pedidos a proveedores al módulo Pedidos y vincula su recepción con una compra real.
ALTER TABLE public.pedidos_proveedores
  ADD COLUMN IF NOT EXISTS compra_id uuid REFERENCES public.compras_inventario(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS fecha_recepcion date;

ALTER TABLE public.detalle_pedidos_proveedores
  ADD COLUMN IF NOT EXISTS cantidad_recibida numeric,
  ADD COLUMN IF NOT EXISTS costo_unitario_real numeric;

CREATE UNIQUE INDEX IF NOT EXISTS pedidos_proveedores_compra_unica_uidx
  ON public.pedidos_proveedores(compra_id)
  WHERE compra_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.recibir_pedido_proveedor(
  p_pedido_id uuid,
  p_detalles jsonb,
  p_fecha_compra date DEFAULT CURRENT_DATE,
  p_valor_pagado numeric DEFAULT 0,
  p_metodo_pago text DEFAULT 'EFECTIVO',
  p_caja_id uuid DEFAULT NULL,
  p_numero_factura text DEFAULT NULL,
  p_fecha_vencimiento date DEFAULT NULL,
  p_referencia text DEFAULT NULL,
  p_observaciones text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_negocio uuid := public.mi_negocio();
  v_usuario uuid := auth.uid();
  v_rol text := COALESCE(public.mi_rol(),'');
  v_pedido public.pedidos_proveedores%ROWTYPE;
  v_caja uuid;
  v_cantidad_lineas integer;
  v_cantidad_recibida integer;
  v_detalles_compra jsonb;
  v_resultado jsonb;
  v_compra uuid;
BEGIN
  IF v_usuario IS NULL OR v_negocio IS NULL THEN
    RAISE EXCEPTION 'Debes iniciar sesión en un negocio activo.';
  END IF;
  IF v_rol NOT IN ('ADMINISTRADOR','SUPERVISOR') THEN
    RAISE EXCEPTION 'No tienes permisos para recibir pedidos a proveedores.';
  END IF;

  SELECT * INTO v_pedido
  FROM public.pedidos_proveedores
  WHERE id=p_pedido_id AND negocio_id=v_negocio
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'No se encontró el pedido en este negocio.'; END IF;
  IF v_pedido.estado='CANCELADO' THEN RAISE EXCEPTION 'No se puede recibir un pedido cancelado.'; END IF;
  IF v_pedido.compra_id IS NOT NULL THEN RAISE EXCEPTION 'Este pedido ya tiene una compra registrada.'; END IF;

  IF p_fecha_compra IS NULL OR p_fecha_compra>CURRENT_DATE THEN
    RAISE EXCEPTION 'La fecha de recepción no puede estar en el futuro.';
  END IF;
  IF p_detalles IS NULL OR jsonb_typeof(p_detalles)<>'array' THEN
    RAISE EXCEPTION 'Debes confirmar las cantidades y costos recibidos.';
  END IF;

  SELECT count(*) INTO v_cantidad_lineas
  FROM public.detalle_pedidos_proveedores d
  WHERE d.pedido_id=p_pedido_id AND d.negocio_id=v_negocio;

  SELECT count(*) INTO v_cantidad_recibida
  FROM jsonb_to_recordset(p_detalles) AS x(detalle_id uuid,producto_id uuid,cantidad numeric,costo_unitario numeric);

  IF v_cantidad_lineas=0 OR v_cantidad_recibida<>v_cantidad_lineas THEN
    RAISE EXCEPTION 'La recepción debe incluir todas las líneas del pedido.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_detalles) AS x(detalle_id uuid,producto_id uuid,cantidad numeric,costo_unitario numeric)
    LEFT JOIN public.detalle_pedidos_proveedores d
      ON d.id=x.detalle_id AND d.pedido_id=p_pedido_id
     AND d.negocio_id=v_negocio AND d.producto_id=x.producto_id
    WHERE d.id IS NULL OR x.cantidad IS NULL OR x.cantidad<=0
       OR x.cantidad::text IN ('NaN','Infinity','-Infinity')
       OR x.costo_unitario IS NULL OR x.costo_unitario<0
       OR x.costo_unitario::text IN ('NaN','Infinity','-Infinity')
  ) THEN
    RAISE EXCEPTION 'Hay productos, cantidades o costos reales inválidos en la recepción.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.detalle_pedidos_proveedores d
    WHERE d.pedido_id=p_pedido_id AND d.negocio_id=v_negocio
      AND NOT EXISTS (
        SELECT 1 FROM jsonb_to_recordset(p_detalles)
          AS x(detalle_id uuid,producto_id uuid,cantidad numeric,costo_unitario numeric)
        WHERE x.detalle_id=d.id AND x.producto_id=d.producto_id
      )
  ) THEN
    RAISE EXCEPTION 'La recepción no coincide con los productos del pedido original.';
  END IF;

  SELECT c.id INTO v_caja
  FROM public.cajas c
  WHERE c.id=p_caja_id AND c.negocio_id=v_negocio AND c.estado_caja='ABIERTA'
  FOR UPDATE;
  IF v_caja IS NULL THEN
    RAISE EXCEPTION 'Abre la caja del turno actual antes de registrar la recepción.';
  END IF;

  SELECT jsonb_agg(jsonb_build_object(
    'producto_id',x.producto_id,
    'cantidad',x.cantidad,
    'costo_unitario',x.costo_unitario
  ))
  INTO v_detalles_compra
  FROM jsonb_to_recordset(p_detalles) AS x(detalle_id uuid,producto_id uuid,cantidad numeric,costo_unitario numeric);

  -- La compra y el cambio de estado del pedido ocurren dentro de la misma transacción.
  v_resultado := public.registrar_compra_inventario(
    v_pedido.proveedor_id,
    p_fecha_compra,
    v_detalles_compra,
    COALESCE(p_valor_pagado,0),
    COALESCE(p_metodo_pago,'EFECTIVO'),
    COALESCE(p_referencia,'Pedido proveedor '||left(p_pedido_id::text,8)),
    COALESCE(p_observaciones,v_pedido.observaciones),
    v_caja,
    p_numero_factura,
    p_fecha_vencimiento
  );
  v_compra := (v_resultado->>'compra_id')::uuid;

  UPDATE public.detalle_pedidos_proveedores d
  SET cantidad_recibida=x.cantidad,
      costo_unitario_real=x.costo_unitario
  FROM jsonb_to_recordset(p_detalles) AS x(detalle_id uuid,producto_id uuid,cantidad numeric,costo_unitario numeric)
  WHERE d.id=x.detalle_id AND d.pedido_id=p_pedido_id AND d.negocio_id=v_negocio;

  UPDATE public.pedidos_proveedores
  SET estado='RECIBIDO',
      compra_id=v_compra,
      fecha_recepcion=p_fecha_compra,
      actualizado_en=now()
  WHERE id=p_pedido_id AND negocio_id=v_negocio;

  RETURN v_resultado || jsonb_build_object('pedido_id',p_pedido_id,'estado','RECIBIDO');
END;
$function$;

REVOKE ALL ON FUNCTION public.recibir_pedido_proveedor(uuid,jsonb,date,numeric,text,uuid,text,date,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.recibir_pedido_proveedor(uuid,jsonb,date,numeric,text,uuid,text,date,text,text) TO authenticated;
