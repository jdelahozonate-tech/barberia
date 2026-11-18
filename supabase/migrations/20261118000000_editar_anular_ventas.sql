-- Edición y anulación transaccional de ventas.
-- Solo administración puede ejecutar estas operaciones; las políticas RLS
-- siguen protegiendo el acceso directo a las tablas.

CREATE OR REPLACE FUNCTION public.editar_venta(
  p_venta_id uuid,
  p_cliente_id uuid,
  p_barbero_id uuid,
  p_descuento numeric,
  p_detalles jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_negocio uuid := public.mi_negocio();
  v_rol text := public.mi_rol();
  v_estado text;
  v_modelo_pago text;
  v_porcentaje numeric := 0;
  v_total_bruto numeric := 0;
  v_total_nuevo numeric := 0;
  v_pagado numeric := 0;
BEGIN
  IF auth.uid() IS NULL OR v_negocio IS NULL THEN
    RAISE EXCEPTION 'Sesión o negocio no válido.';
  END IF;
  IF COALESCE(v_rol, '') NOT IN ('ADMINISTRADOR', 'SUPERVISOR') THEN
    RAISE EXCEPTION 'No tienes permisos para editar ventas.';
  END IF;
  IF p_descuento IS NULL OR p_descuento < 0 THEN
    RAISE EXCEPTION 'El descuento debe ser un valor válido y no negativo.';
  END IF;
  IF jsonb_typeof(p_detalles) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Los detalles de la venta no son válidos.';
  END IF;
  IF jsonb_array_length(p_detalles) = 0 THEN
    RAISE EXCEPTION 'La venta debe conservar al menos un servicio o producto.';
  END IF;

  SELECT estado_venta
    INTO v_estado
    FROM public.ventas
   WHERE id = p_venta_id
     AND negocio_id = v_negocio
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No se encontró la venta en este negocio.';
  END IF;
  IF v_estado = 'ANULADA' THEN
    RAISE EXCEPTION 'No se puede editar una venta anulada.';
  END IF;

  IF p_cliente_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.clientes
     WHERE id = p_cliente_id AND negocio_id = v_negocio
  ) THEN
    RAISE EXCEPTION 'El cliente seleccionado no pertenece a este negocio.';
  END IF;
  IF p_barbero_id IS NOT NULL THEN
    SELECT modelo_pago, COALESCE(porcentaje_comision, 0)
      INTO v_modelo_pago, v_porcentaje
      FROM public.barberos
     WHERE id = p_barbero_id AND negocio_id = v_negocio;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'El barbero seleccionado no pertenece a este negocio.';
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1
      FROM jsonb_to_recordset(p_detalles) AS x(
        tipo_item text,
        servicio_id uuid,
        producto_id uuid,
        cantidad numeric,
        precio_unitario numeric
      )
     WHERE x.cantidad IS NULL OR x.cantidad <= 0 OR x.cantidad::text = 'NaN'
        OR x.precio_unitario IS NULL OR x.precio_unitario < 0
        OR x.precio_unitario::text = 'NaN'
        OR NOT (
          (x.tipo_item = 'SERVICIO' AND x.servicio_id IS NOT NULL AND x.producto_id IS NULL
            AND EXISTS (SELECT 1 FROM public.servicios s
                         WHERE s.id = x.servicio_id AND s.negocio_id = v_negocio))
          OR
          (x.tipo_item = 'PRODUCTO' AND x.producto_id IS NOT NULL AND x.servicio_id IS NULL
            AND EXISTS (SELECT 1 FROM public.productos p
                         WHERE p.id = x.producto_id AND p.negocio_id = v_negocio))
        )
  ) THEN
    RAISE EXCEPTION 'Hay servicios, productos, cantidades o precios inválidos.';
  END IF;

  SELECT COALESCE(SUM(x.cantidad * x.precio_unitario), 0)
    INTO v_total_bruto
    FROM jsonb_to_recordset(p_detalles) AS x(
      tipo_item text,
      servicio_id uuid,
      producto_id uuid,
      cantidad numeric,
      precio_unitario numeric
    );
  IF p_descuento > v_total_bruto THEN
    RAISE EXCEPTION 'El descuento no puede superar el subtotal.';
  END IF;
  v_total_nuevo := v_total_bruto - p_descuento;

  SELECT COALESCE(SUM(valor_pago), 0)
    INTO v_pagado
    FROM public.pagos
   WHERE venta_id = p_venta_id
     AND negocio_id = v_negocio
     AND estado_pago = 'REGISTRADO';
  IF v_pagado > v_total_nuevo THEN
    RAISE EXCEPTION 'El nuevo total no puede ser inferior a los pagos ya recibidos (%).', v_pagado;
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.detalle_ventas d
      JOIN public.comisiones c
        ON c.detalle_id = d.id
       AND c.negocio_id = v_negocio
     WHERE d.venta_id = p_venta_id
       AND d.negocio_id = v_negocio
  ) THEN
    RAISE EXCEPTION 'No se puede editar: esta venta tiene comisiones liquidadas vinculadas a sus detalles.';
  END IF;

  -- Compensa el efecto neto de los movimientos de esta venta. Se calcula
  -- el neto para que una segunda edición también revierta los ajustes previos.
  INSERT INTO public.movimientos_inventario (
    negocio_id, producto_id, tipo_movimiento, cantidad,
    costo_unitario, motivo, venta_id, usuario_responsable
  )
  SELECT
    v_negocio,
    m.producto_id,
    CASE WHEN SUM(CASE WHEN m.tipo_movimiento = 'SALIDA' THEN m.cantidad
                       WHEN m.tipo_movimiento = 'ENTRADA' THEN -m.cantidad
                       ELSE 0 END) > 0 THEN 'ENTRADA' ELSE 'SALIDA' END,
    ABS(SUM(CASE WHEN m.tipo_movimiento = 'SALIDA' THEN m.cantidad
                 WHEN m.tipo_movimiento = 'ENTRADA' THEN -m.cantidad
                 ELSE 0 END)),
    MAX(m.costo_unitario),
    'Ajuste por edición de venta',
    p_venta_id,
    auth.uid()
  FROM public.movimientos_inventario m
  WHERE m.negocio_id = v_negocio
    AND m.venta_id = p_venta_id
    AND m.tipo_movimiento IN ('SALIDA', 'ENTRADA')
  GROUP BY m.producto_id
  HAVING SUM(CASE WHEN m.tipo_movimiento = 'SALIDA' THEN m.cantidad
                  WHEN m.tipo_movimiento = 'ENTRADA' THEN -m.cantidad
                  ELSE 0 END) <> 0;

  UPDATE public.ventas
     SET cliente_id = p_cliente_id,
         barbero_id = p_barbero_id,
         descuento = p_descuento,
         total_pagado = v_pagado
   WHERE id = p_venta_id
     AND negocio_id = v_negocio;

  DELETE FROM public.detalle_ventas
   WHERE venta_id = p_venta_id
     AND negocio_id = v_negocio;

  INSERT INTO public.detalle_ventas (
    negocio_id, venta_id, tipo_item, servicio_id, producto_id,
    descripcion, cantidad, precio_unitario, costo_unitario, comision_generada
  )
  SELECT
    v_negocio,
    p_venta_id,
    x.tipo_item,
    x.servicio_id,
    x.producto_id,
    CASE WHEN x.tipo_item = 'SERVICIO' THEN s.nombre ELSE p.nombre END,
    x.cantidad,
    x.precio_unitario,
    CASE WHEN x.tipo_item = 'PRODUCTO' THEN COALESCE(p.costo_unitario, 0) ELSE 0 END,
    CASE WHEN x.tipo_item = 'SERVICIO' AND p_barbero_id IS NOT NULL
                   AND COALESCE(v_modelo_pago, '') <> 'ALQUILER'
         THEN x.cantidad * x.precio_unitario * v_porcentaje / 100
         ELSE 0 END
  FROM jsonb_to_recordset(p_detalles) AS x(
    tipo_item text,
    servicio_id uuid,
    producto_id uuid,
    cantidad numeric,
    precio_unitario numeric
  )
  LEFT JOIN public.servicios s
    ON x.tipo_item = 'SERVICIO' AND s.id = x.servicio_id AND s.negocio_id = v_negocio
  LEFT JOIN public.productos p
    ON x.tipo_item = 'PRODUCTO' AND p.id = x.producto_id AND p.negocio_id = v_negocio;

  UPDATE public.ventas
     SET estado_venta = CASE
       WHEN total_venta > 0 AND total_pagado >= total_venta THEN 'PAGADA'
       ELSE 'PENDIENTE'
     END
   WHERE id = p_venta_id
     AND negocio_id = v_negocio;

  RETURN jsonb_build_object(
    'venta_id', p_venta_id,
    'total_bruto', v_total_bruto,
    'descuento', p_descuento,
    'total_venta', v_total_nuevo,
    'total_pagado', v_pagado
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.anular_venta(p_venta_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_negocio uuid := public.mi_negocio();
  v_rol text := public.mi_rol();
  v_estado text;
BEGIN
  IF auth.uid() IS NULL OR v_negocio IS NULL THEN
    RAISE EXCEPTION 'Sesión o negocio no válido.';
  END IF;
  IF v_rol NOT IN ('ADMINISTRADOR', 'SUPERVISOR') THEN
    RAISE EXCEPTION 'No tienes permisos para anular ventas.';
  END IF;

  SELECT estado_venta
    INTO v_estado
    FROM public.ventas
   WHERE id = p_venta_id
     AND negocio_id = v_negocio
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No se encontró la venta en este negocio.';
  END IF;
  IF v_estado = 'ANULADA' THEN
    RAISE EXCEPTION 'La venta ya está anulada.';
  END IF;

  UPDATE public.ventas
     SET estado_venta = 'ANULADA'
   WHERE id = p_venta_id
     AND negocio_id = v_negocio;
  -- El trigger trg_devolver_inventario conserva la devolución de existencias.
END;
$$;

REVOKE ALL ON FUNCTION public.editar_venta(uuid, uuid, uuid, numeric, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.anular_venta(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.editar_venta(uuid, uuid, uuid, numeric, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.anular_venta(uuid) TO authenticated;
