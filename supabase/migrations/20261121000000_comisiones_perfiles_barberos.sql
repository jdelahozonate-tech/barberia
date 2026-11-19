-- Comisiones por servicio con fotografía de perfil para cada barbero.
-- Las columnas nuevas quedan NULL en el histórico: no se inventan porcentajes retroactivos.
ALTER TABLE public.detalle_ventas
  ADD COLUMN IF NOT EXISTS porcentaje_comision_aplicado numeric(5,2),
  ADD COLUMN IF NOT EXISTS base_comision numeric(14,2);

ALTER TABLE public.barberos
  ADD COLUMN IF NOT EXISTS foto_url text;

COMMENT ON COLUMN public.detalle_ventas.porcentaje_comision_aplicado IS
  'Porcentaje de comisión congelado al registrar la venta; NULL identifica registros históricos anteriores a esta mejora.';
COMMENT ON COLUMN public.detalle_ventas.base_comision IS
  'Base del servicio después de distribuir proporcionalmente el descuento de la factura.';

-- Fotografías de perfil: lectura pública para que se vean al iniciar sesión;
-- escritura limitada a administración y a carpetas del negocio autenticado.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('barberos', 'barberos', true, 5242880, ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp'];

DROP POLICY IF EXISTS barberos_fotos_lectura ON storage.objects;
CREATE POLICY barberos_fotos_lectura ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'barberos');

DROP POLICY IF EXISTS barberos_fotos_insertar ON storage.objects;
CREATE POLICY barberos_fotos_insertar ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'barberos'
    AND (storage.foldername(name))[1] = public.mi_negocio()::text
    AND COALESCE(public.mi_rol(), '') IN ('ADMINISTRADOR','SUPERVISOR')
  );

DROP POLICY IF EXISTS barberos_fotos_actualizar ON storage.objects;
CREATE POLICY barberos_fotos_actualizar ON storage.objects
  FOR UPDATE TO authenticated USING (
    bucket_id = 'barberos'
    AND (storage.foldername(name))[1] = public.mi_negocio()::text
    AND COALESCE(public.mi_rol(), '') IN ('ADMINISTRADOR','SUPERVISOR')
  ) WITH CHECK (
    bucket_id = 'barberos'
    AND (storage.foldername(name))[1] = public.mi_negocio()::text
    AND COALESCE(public.mi_rol(), '') IN ('ADMINISTRADOR','SUPERVISOR')
  );

DROP POLICY IF EXISTS barberos_fotos_eliminar ON storage.objects;
CREATE POLICY barberos_fotos_eliminar ON storage.objects
  FOR DELETE TO authenticated USING (
    bucket_id = 'barberos'
    AND (storage.foldername(name))[1] = public.mi_negocio()::text
    AND COALESCE(public.mi_rol(), '') IN ('ADMINISTRADOR','SUPERVISOR')
  );

-- Al editar una factura nueva se conserva el porcentaje congelado originalmente.
-- Las facturas antiguas sin snapshot no se recalculan con la configuración actual.
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
  v_porcentaje_anterior numeric;
  v_total_bruto numeric := 0;
  v_total_nuevo numeric := 0;
  v_pagado numeric := 0;
  v_barbero_anterior uuid;
BEGIN
  IF auth.uid() IS NULL OR v_negocio IS NULL THEN
    RAISE EXCEPTION 'Sesión o negocio no válido.';
  END IF;
  IF COALESCE(v_rol, '') NOT IN ('ADMINISTRADOR', 'SUPERVISOR') THEN
    RAISE EXCEPTION 'No tienes permisos para editar ventas.';
  END IF;
  IF p_descuento IS NULL OR p_descuento < 0 OR p_descuento::text = 'NaN' THEN
    RAISE EXCEPTION 'El descuento debe ser un valor válido y no negativo.';
  END IF;
  IF jsonb_typeof(p_detalles) IS DISTINCT FROM 'array' OR jsonb_array_length(p_detalles) = 0 THEN
    RAISE EXCEPTION 'La venta debe conservar al menos un servicio o producto.';
  END IF;

  SELECT estado_venta, barbero_id INTO v_estado, v_barbero_anterior
    FROM public.ventas
   WHERE id = p_venta_id AND negocio_id = v_negocio
   FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'No se encontró la venta en este negocio.'; END IF;
  IF v_estado = 'ANULADA' THEN RAISE EXCEPTION 'No se puede editar una venta anulada.'; END IF;

  IF p_cliente_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.clientes WHERE id = p_cliente_id AND negocio_id = v_negocio
  ) THEN RAISE EXCEPTION 'El cliente seleccionado no pertenece a este negocio.'; END IF;

  IF p_barbero_id IS NOT NULL THEN
    SELECT modelo_pago, COALESCE(porcentaje_comision, 0)
      INTO v_modelo_pago, v_porcentaje
      FROM public.barberos WHERE id = p_barbero_id AND negocio_id = v_negocio;
    IF NOT FOUND THEN RAISE EXCEPTION 'El barbero seleccionado no pertenece a este negocio.'; END IF;
  END IF;

  -- Si la factura ya tenía snapshot, ese porcentaje prevalece aunque el catálogo cambie.
  SELECT MAX(porcentaje_comision_aplicado)
    INTO v_porcentaje_anterior
    FROM public.detalle_ventas
   WHERE venta_id = p_venta_id AND negocio_id = v_negocio
     AND tipo_item = 'SERVICIO' AND porcentaje_comision_aplicado IS NOT NULL;

  IF EXISTS (
    SELECT 1 FROM public.detalle_ventas
     WHERE venta_id = p_venta_id AND negocio_id = v_negocio AND tipo_item = 'SERVICIO'
       AND porcentaje_comision_aplicado IS NULL
  ) THEN
    RAISE EXCEPTION 'Esta factura es anterior al historial de porcentajes. No se puede editar para evitar cambiar retroactivamente su comisión.';
  END IF;
  IF v_porcentaje_anterior IS NOT NULL THEN
    v_porcentaje := v_porcentaje_anterior;
  END IF;

  IF EXISTS (
    SELECT 1 FROM jsonb_to_recordset(p_detalles) AS x(
      tipo_item text, servicio_id uuid, producto_id uuid, cantidad numeric, precio_unitario numeric
    )
    WHERE x.cantidad IS NULL OR x.cantidad <= 0 OR x.cantidad::text IN ('NaN','Infinity','-Infinity')
       OR x.precio_unitario IS NULL OR x.precio_unitario < 0
       OR x.precio_unitario::text IN ('NaN','Infinity','-Infinity')
       OR NOT (
        (x.tipo_item = 'SERVICIO' AND x.servicio_id IS NOT NULL AND x.producto_id IS NULL
          AND EXISTS (SELECT 1 FROM public.servicios s WHERE s.id=x.servicio_id AND s.negocio_id=v_negocio))
        OR
        (x.tipo_item = 'PRODUCTO' AND x.producto_id IS NOT NULL AND x.servicio_id IS NULL
          AND EXISTS (SELECT 1 FROM public.productos p WHERE p.id=x.producto_id AND p.negocio_id=v_negocio))
       )
  ) THEN RAISE EXCEPTION 'Hay servicios, productos, cantidades o precios inválidos.'; END IF;

  SELECT COALESCE(SUM(x.cantidad*x.precio_unitario),0)
    INTO v_total_bruto
    FROM jsonb_to_recordset(p_detalles) AS x(
      tipo_item text, servicio_id uuid, producto_id uuid, cantidad numeric, precio_unitario numeric
    );
  IF p_descuento > v_total_bruto THEN RAISE EXCEPTION 'El descuento no puede superar el subtotal.'; END IF;
  v_total_nuevo := v_total_bruto-p_descuento;

  SELECT COALESCE(SUM(valor_pago),0) INTO v_pagado
    FROM public.pagos
   WHERE venta_id=p_venta_id AND negocio_id=v_negocio AND estado_pago='REGISTRADO';
  IF v_pagado > v_total_nuevo THEN
    RAISE EXCEPTION 'El nuevo total no puede ser inferior a los pagos ya recibidos (%).',v_pagado;
  END IF;

  IF EXISTS (
    SELECT 1
      FROM (SELECT x.producto_id,SUM(x.cantidad) cantidad_nueva
              FROM jsonb_to_recordset(p_detalles) AS x(
                tipo_item text, servicio_id uuid, producto_id uuid, cantidad numeric, precio_unitario numeric
              )
             WHERE x.tipo_item='PRODUCTO' GROUP BY x.producto_id) n
      JOIN public.productos p ON p.id=n.producto_id AND p.negocio_id=v_negocio
      LEFT JOIN public.stock_actual st ON st.producto_id=n.producto_id AND st.negocio_id=v_negocio
     WHERE p.control_stock
       AND COALESCE(st.existencias,0)+COALESCE((
         SELECT SUM(CASE WHEN m.tipo_movimiento='SALIDA' THEN m.cantidad
                         WHEN m.tipo_movimiento='ENTRADA' THEN -m.cantidad ELSE 0 END)
           FROM public.movimientos_inventario m
          WHERE m.negocio_id=v_negocio AND m.venta_id=p_venta_id AND m.producto_id=n.producto_id
       ),0)<n.cantidad_nueva
  ) THEN RAISE EXCEPTION 'No hay existencias suficientes para uno o más productos de la venta.'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.detalle_ventas d
    JOIN public.comisiones c ON c.detalle_id=d.id AND c.negocio_id=v_negocio
    WHERE d.venta_id=p_venta_id AND d.negocio_id=v_negocio
  ) THEN RAISE EXCEPTION 'No se puede editar: esta venta tiene comisiones liquidadas vinculadas a sus detalles.'; END IF;

  INSERT INTO public.movimientos_inventario (
    negocio_id,producto_id,tipo_movimiento,cantidad,costo_unitario,motivo,venta_id,usuario_responsable
  )
  SELECT v_negocio,m.producto_id,
    CASE WHEN SUM(CASE WHEN m.tipo_movimiento='SALIDA' THEN m.cantidad
                       WHEN m.tipo_movimiento='ENTRADA' THEN -m.cantidad ELSE 0 END)>0 THEN 'ENTRADA' ELSE 'SALIDA' END,
    ABS(SUM(CASE WHEN m.tipo_movimiento='SALIDA' THEN m.cantidad
                 WHEN m.tipo_movimiento='ENTRADA' THEN -m.cantidad ELSE 0 END)),
    MAX(m.costo_unitario),'Ajuste por edición de venta',p_venta_id,auth.uid()
  FROM public.movimientos_inventario m
  WHERE m.negocio_id=v_negocio AND m.venta_id=p_venta_id
    AND m.tipo_movimiento IN ('SALIDA','ENTRADA')
  GROUP BY m.producto_id
  HAVING SUM(CASE WHEN m.tipo_movimiento='SALIDA' THEN m.cantidad
                  WHEN m.tipo_movimiento='ENTRADA' THEN -m.cantidad ELSE 0 END)<>0;

  UPDATE public.ventas
     SET cliente_id=p_cliente_id,barbero_id=p_barbero_id,descuento=p_descuento,total_pagado=v_pagado
   WHERE id=p_venta_id AND negocio_id=v_negocio;

  DELETE FROM public.detalle_ventas WHERE venta_id=p_venta_id AND negocio_id=v_negocio;

  INSERT INTO public.detalle_ventas (
    negocio_id,venta_id,tipo_item,servicio_id,producto_id,descripcion,cantidad,
    precio_unitario,costo_unitario,comision_generada,porcentaje_comision_aplicado,base_comision
  )
  SELECT v_negocio,p_venta_id,x.tipo_item,x.servicio_id,x.producto_id,
    CASE WHEN x.tipo_item='SERVICIO' THEN s.nombre ELSE p.nombre END,
    x.cantidad,x.precio_unitario,
    CASE WHEN x.tipo_item='PRODUCTO' THEN COALESCE(p.costo_unitario,0) ELSE 0 END,
    CASE WHEN x.tipo_item='SERVICIO' AND p_barbero_id IS NOT NULL
              AND COALESCE(v_modelo_pago,'')<>'ALQUILER'
         THEN ROUND(ROUND(x.cantidad*x.precio_unitario
             - CASE WHEN v_total_bruto>0 THEN p_descuento*(x.cantidad*x.precio_unitario)/v_total_bruto ELSE 0 END,2)
             * v_porcentaje/100,2)
         ELSE 0 END,
    CASE WHEN x.tipo_item='SERVICIO' AND p_barbero_id IS NOT NULL
              AND COALESCE(v_modelo_pago,'')<>'ALQUILER' THEN v_porcentaje ELSE 0 END,
    CASE WHEN x.tipo_item='SERVICIO' AND p_barbero_id IS NOT NULL
              AND COALESCE(v_modelo_pago,'')<>'ALQUILER'
         THEN ROUND(x.cantidad*x.precio_unitario
             - CASE WHEN v_total_bruto>0 THEN p_descuento*(x.cantidad*x.precio_unitario)/v_total_bruto ELSE 0 END,2)
         ELSE 0 END
  FROM jsonb_to_recordset(p_detalles) AS x(
    tipo_item text,servicio_id uuid,producto_id uuid,cantidad numeric,precio_unitario numeric
  )
  LEFT JOIN public.servicios s ON x.tipo_item='SERVICIO' AND s.id=x.servicio_id AND s.negocio_id=v_negocio
  LEFT JOIN public.productos p ON x.tipo_item='PRODUCTO' AND p.id=x.producto_id AND p.negocio_id=v_negocio;

  UPDATE public.ventas SET estado_venta=CASE
    WHEN total_venta>0 AND total_pagado>=total_venta THEN 'PAGADA' ELSE 'PENDIENTE' END
   WHERE id=p_venta_id AND negocio_id=v_negocio;

  RETURN jsonb_build_object('venta_id',p_venta_id,'total_bruto',v_total_bruto,
    'descuento',p_descuento,'total_venta',v_total_nuevo,'total_pagado',v_pagado,
    'porcentaje_comision_aplicado',CASE WHEN p_barbero_id IS NOT NULL AND COALESCE(v_modelo_pago,'')<>'ALQUILER'
      THEN v_porcentaje ELSE 0 END);
END;
$$;

REVOKE ALL ON FUNCTION public.editar_venta(uuid, uuid, uuid, numeric, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.editar_venta(uuid, uuid, uuid, numeric, jsonb) TO authenticated;

-- El barbero autenticado puede leer exclusivamente su propia ficha para mostrar su perfil.
DROP POLICY IF EXISTS barberos_perfil_propio ON public.barberos;
CREATE POLICY barberos_perfil_propio ON public.barberos
  FOR SELECT TO authenticated
  USING (
    negocio_id = public.mi_negocio()
    AND id = (
      SELECT p.barbero_id FROM public.perfiles p
       WHERE p.id = auth.uid() AND p.negocio_id = public.mi_negocio()
    )
    AND public.mi_rol() = 'BARBERO'
  );

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='detalle_ventas_porcentaje_comision_rango') THEN
    ALTER TABLE public.detalle_ventas
      ADD CONSTRAINT detalle_ventas_porcentaje_comision_rango
      CHECK (porcentaje_comision_aplicado IS NULL OR porcentaje_comision_aplicado BETWEEN 0 AND 100);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='detalle_ventas_base_comision_no_negativa') THEN
    ALTER TABLE public.detalle_ventas
      ADD CONSTRAINT detalle_ventas_base_comision_no_negativa
      CHECK (base_comision IS NULL OR base_comision >= 0);
  END IF;
END $$;
