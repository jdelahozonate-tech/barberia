-- Operaciones transaccionales para ventas, horarios y ajustes del negocio.
-- Las funciones validan sesión, negocio y permisos antes de escribir.
-- SECURITY DEFINER se acompaña de validaciones explícitas de sesión, negocio y rol; EXECUTE se limita a authenticated.

CREATE OR REPLACE FUNCTION public.registrar_venta_transaccional(
  p_cliente_id uuid,
  p_barbero_id uuid,
  p_descuento numeric,
  p_cita_id uuid,
  p_detalles jsonb,
  p_pagos jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_negocio uuid := public.mi_negocio();
  v_rol text := public.mi_rol();
  v_usuario uuid := auth.uid();
  v_barbero public.barberos%ROWTYPE;
  v_cita record;
  v_producto public.productos%ROWTYPE;
  v_servicio public.servicios%ROWTYPE;
  v_item record;
  v_stock numeric;
  v_total_bruto numeric(14,2) := 0;
  v_total_venta numeric(14,2) := 0;
  v_total_pagado numeric(14,2) := 0;
  v_base numeric(14,2);
  v_porcentaje numeric(5,2) := 0;
  v_comision numeric(14,2);
  v_linea numeric(14,2);
  v_venta uuid;
  v_metodo text := 'EFECTIVO';
  v_metodo_pago text;
  v_pago numeric(14,2);
  v_cuenta uuid;
  v_metodo_principal text;
BEGIN
  IF v_usuario IS NULL OR v_negocio IS NULL THEN
    RAISE EXCEPTION 'Sesión o negocio no válido.';
  END IF;
  IF COALESCE(v_rol,'') NOT IN ('ADMINISTRADOR','SUPERVISOR','BARBERO') THEN
    RAISE EXCEPTION 'No tienes permisos para registrar ventas.';
  END IF;
  IF p_descuento IS NULL OR p_descuento < 0
     OR p_descuento::text IN ('NaN','Infinity','-Infinity') THEN
    RAISE EXCEPTION 'El descuento debe ser un valor válido y no negativo.';
  END IF;
  IF jsonb_typeof(p_detalles) IS DISTINCT FROM 'array'
     OR jsonb_array_length(p_detalles) NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'La venta debe tener entre 1 y 100 ítems.';
  END IF;
  IF p_pagos IS NULL OR jsonb_typeof(p_pagos) IS DISTINCT FROM 'array'
     OR jsonb_array_length(p_pagos) > 10 THEN
    RAISE EXCEPTION 'Los pagos no tienen un formato válido.';
  END IF;

  IF p_cliente_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.clientes c
    WHERE c.id=p_cliente_id AND c.negocio_id=v_negocio AND c.estado='ACTIVO'
  ) THEN
    RAISE EXCEPTION 'El cliente seleccionado no pertenece a este negocio o está inactivo.';
  END IF;

  IF p_barbero_id IS NOT NULL THEN
    SELECT * INTO v_barbero
    FROM public.barberos b
    WHERE b.id=p_barbero_id AND b.negocio_id=v_negocio AND b.estado='ACTIVO'
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'El barbero seleccionado no pertenece a este negocio o está inactivo.';
    END IF;
  END IF;
  IF v_rol='BARBERO' AND (
    p_barbero_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.perfiles pf
      WHERE pf.id=v_usuario AND pf.negocio_id=v_negocio
        AND pf.barbero_id=p_barbero_id AND pf.estado='ACTIVO'
    )
  ) THEN
    RAISE EXCEPTION 'Solo puedes registrar ventas a tu nombre.';
  END IF;

  IF p_cita_id IS NOT NULL THEN
    SELECT c.cliente_id,c.barbero_id,c.servicio_id,c.estado
      INTO v_cita
    FROM public.citas c
    WHERE c.id=p_cita_id AND c.negocio_id=v_negocio
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'No se encontró la cita en este negocio.';
    END IF;
    IF v_cita.estado NOT IN ('PENDIENTE','CONFIRMADA','ATENDIDA') THEN
      RAISE EXCEPTION 'La cita ya no está disponible para cobro.';
    END IF;
    IF v_cita.cliente_id IS DISTINCT FROM p_cliente_id
       OR v_cita.barbero_id IS DISTINCT FROM p_barbero_id
       OR NOT EXISTS (
         SELECT 1 FROM jsonb_to_recordset(p_detalles) AS d(
           tipo_item text,servicio_id uuid,producto_id uuid,cantidad numeric
         )
         WHERE d.tipo_item='SERVICIO' AND d.servicio_id=v_cita.servicio_id
       ) THEN
      RAISE EXCEPTION 'Los datos de la venta no coinciden con la cita seleccionada.';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.ventas v
      WHERE v.negocio_id=v_negocio AND v.cita_id=p_cita_id
        AND v.estado_venta<>'ANULADA'
    ) THEN
      RAISE EXCEPTION 'Esta cita ya tiene una venta asociada.';
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_detalles) AS d(
      tipo_item text,servicio_id uuid,producto_id uuid,cantidad numeric
    )
    WHERE d.tipo_item NOT IN ('SERVICIO','PRODUCTO')
       OR d.cantidad IS NULL OR d.cantidad<=0
       OR d.cantidad::text IN ('NaN','Infinity','-Infinity')
       OR d.tipo_item IS NULL
       OR (d.tipo_item='SERVICIO' AND (d.servicio_id IS NULL OR d.producto_id IS NOT NULL))
       OR (d.tipo_item='PRODUCTO' AND (d.producto_id IS NULL OR d.servicio_id IS NOT NULL))
  ) THEN
    RAISE EXCEPTION 'Hay ítems o cantidades inválidas.';
  END IF;

  -- Bloquea cada producto mientras valida existencias; evita que dos ventas
  -- concurrentes consuman simultáneamente las mismas unidades.
  FOR v_item IN
    SELECT d.producto_id,SUM(d.cantidad) AS cantidad
    FROM jsonb_to_recordset(p_detalles) AS d(
      tipo_item text,servicio_id uuid,producto_id uuid,cantidad numeric
    )
    WHERE d.tipo_item='PRODUCTO'
    GROUP BY d.producto_id
    ORDER BY d.producto_id
  LOOP
    SELECT * INTO v_producto
    FROM public.productos p
    WHERE p.id=v_item.producto_id AND p.negocio_id=v_negocio
      AND p.estado='ACTIVO' AND p.vendible IS TRUE
      AND p.tipo_inventario='PRODUCTO_VENTA'
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Uno de los productos no está disponible para la venta.';
    END IF;
    IF v_producto.control_stock IS TRUE THEN
      SELECT COALESCE(SUM(
        CASE m.tipo_movimiento
          WHEN 'ENTRADA' THEN m.cantidad
          WHEN 'SALIDA' THEN -m.cantidad
          ELSE m.cantidad
        END
      ),0) INTO v_stock
      FROM public.movimientos_inventario m
      WHERE m.negocio_id=v_negocio AND m.producto_id=v_item.producto_id;
      IF v_stock < v_item.cantidad THEN
        RAISE EXCEPTION 'No hay existencias suficientes de % (disponibles: %).',
          v_producto.nombre,v_stock;
      END IF;
    END IF;
  END LOOP;

  -- Valida los servicios antes de crear la cabecera.
  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_detalles) AS d(
      tipo_item text,servicio_id uuid,producto_id uuid,cantidad numeric
    )
    WHERE d.tipo_item='SERVICIO'
      AND NOT EXISTS (
        SELECT 1 FROM public.servicios s
        WHERE s.id=d.servicio_id AND s.negocio_id=v_negocio AND s.estado='ACTIVO'
      )
  ) THEN
    RAISE EXCEPTION 'Uno de los servicios ya no está activo.';
  END IF;

  -- Valida pagos y cuentas asociadas antes de iniciar las escrituras.
  FOR v_item IN
    SELECT * FROM jsonb_to_recordset(p_pagos) AS p(
      metodo_pago text,valor_pago numeric,cuenta_id uuid
    )
  LOOP
    v_metodo_pago := upper(trim(COALESCE(v_item.metodo_pago,'')));
    v_pago := v_item.valor_pago;
    v_cuenta := v_item.cuenta_id;
    IF v_metodo_pago NOT IN ('EFECTIVO','TRANSFERENCIA','TARJETA','NEQUI','DAVIPLATA')
       OR v_pago IS NULL OR v_pago<=0
       OR v_pago::text IN ('NaN','Infinity','-Infinity') THEN
      RAISE EXCEPTION 'Hay un método o valor de pago inválido.';
    END IF;
    IF v_cuenta IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.cuentas c
      WHERE c.id=v_cuenta AND c.negocio_id=v_negocio AND c.estado='ACTIVO'
    ) THEN
      RAISE EXCEPTION 'La cuenta de recaudo seleccionada no pertenece a este negocio o está inactiva.';
    END IF;
    v_total_pagado := v_total_pagado + v_pago;
  END LOOP;

  -- Calcula el subtotal con precios vigentes del catálogo, no con precios enviados por el navegador.
  FOR v_item IN
    SELECT * FROM jsonb_to_recordset(p_detalles) AS d(
      tipo_item text,servicio_id uuid,producto_id uuid,cantidad numeric
    )
  LOOP
    IF v_item.tipo_item='SERVICIO' THEN
      SELECT * INTO v_servicio FROM public.servicios s
      WHERE s.id=v_item.servicio_id AND s.negocio_id=v_negocio AND s.estado='ACTIVO';
      v_total_bruto := v_total_bruto + ROUND(v_item.cantidad*v_servicio.precio,2);
    ELSE
      SELECT * INTO v_producto FROM public.productos p
      WHERE p.id=v_item.producto_id AND p.negocio_id=v_negocio AND p.estado='ACTIVO';
      v_total_bruto := v_total_bruto + ROUND(v_item.cantidad*v_producto.precio_venta,2);
    END IF;
  END LOOP;

  v_total_bruto := ROUND(v_total_bruto,2);
  IF p_descuento > v_total_bruto THEN
    RAISE EXCEPTION 'El descuento no puede superar el subtotal.';
  END IF;
  v_total_venta := v_total_bruto-p_descuento;
  IF v_total_pagado > v_total_venta THEN
    RAISE EXCEPTION 'El pago no puede superar el total de la venta.';
  END IF;
  IF v_total_pagado < v_total_venta AND (
    p_cliente_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.negocios n
      WHERE n.id=v_negocio AND n.permitir_saldos IS TRUE
    )
  ) THEN
    RAISE EXCEPTION 'Para dejar saldo pendiente se requiere un cliente y que el negocio permita fiados.';
  END IF;

  SELECT p.metodo_pago
    INTO v_metodo_principal
  FROM jsonb_to_recordset(p_pagos) AS p(
    metodo_pago text,valor_pago numeric,cuenta_id uuid
  )
  ORDER BY p.valor_pago DESC
  LIMIT 1;
  v_metodo := COALESCE(v_metodo_principal,'EFECTIVO');

  INSERT INTO public.ventas(
    negocio_id,cliente_id,barbero_id,cita_id,descuento,
    metodo_pago_principal,creado_por
  ) VALUES(
    v_negocio,p_cliente_id,p_barbero_id,p_cita_id,p_descuento,
    v_metodo,v_usuario
  ) RETURNING id INTO v_venta;

  -- Crea los detalles con precio y comisión calculados en la base de datos.
  FOR v_item IN
    SELECT * FROM jsonb_to_recordset(p_detalles) AS d(
      tipo_item text,servicio_id uuid,producto_id uuid,cantidad numeric
    )
  LOOP
    IF v_item.tipo_item='SERVICIO' THEN
      SELECT * INTO v_servicio FROM public.servicios s
      WHERE s.id=v_item.servicio_id AND s.negocio_id=v_negocio AND s.estado='ACTIVO';
      v_linea := ROUND(v_item.cantidad*v_servicio.precio,2);
      IF p_barbero_id IS NOT NULL AND v_barbero.modelo_pago<>'ALQUILER' THEN
        v_porcentaje := COALESCE(v_barbero.porcentaje_comision,0);
        v_base := GREATEST(0,ROUND(v_linea-
          CASE WHEN v_total_bruto>0 THEN p_descuento*v_linea/v_total_bruto ELSE 0 END,2));
        v_comision := ROUND(v_base*v_porcentaje/100,2);
      ELSE
        v_porcentaje := CASE WHEN p_barbero_id IS NULL THEN NULL ELSE 0 END;
        v_base := 0;
        v_comision := 0;
      END IF;
      INSERT INTO public.detalle_ventas(
        negocio_id,venta_id,tipo_item,servicio_id,descripcion,cantidad,
        precio_unitario,costo_unitario,comision_generada,
        porcentaje_comision_aplicado,base_comision
      ) VALUES(
        v_negocio,v_venta,'SERVICIO',v_servicio.id,v_servicio.nombre,v_item.cantidad,
        v_servicio.precio,0,v_comision,v_porcentaje,v_base
      );
    ELSE
      SELECT * INTO v_producto FROM public.productos p
      WHERE p.id=v_item.producto_id AND p.negocio_id=v_negocio AND p.estado='ACTIVO'
        AND p.vendible IS TRUE AND p.tipo_inventario='PRODUCTO_VENTA';
      INSERT INTO public.detalle_ventas(
        negocio_id,venta_id,tipo_item,producto_id,descripcion,cantidad,
        precio_unitario,costo_unitario,comision_generada
      ) VALUES(
        v_negocio,v_venta,'PRODUCTO',v_producto.id,v_producto.nombre,v_item.cantidad,
        v_producto.precio_venta,v_producto.costo_unitario,0
      );
    END IF;
  END LOOP;

  -- La suma de subtotales la mantiene el trigger; total_venta y saldo no eran
  -- calculados por ese trigger y se fijan aquí antes de insertar pagos.
  SELECT COALESCE(SUM(d.subtotal),0) INTO v_total_bruto
  FROM public.detalle_ventas d
  WHERE d.negocio_id=v_negocio AND d.venta_id=v_venta;
  v_total_venta := ROUND(v_total_bruto-p_descuento,2);
  UPDATE public.ventas
  SET total_bruto=v_total_bruto,total_venta=v_total_venta,
      total_pagado=0,saldo_pendiente=v_total_venta
  WHERE id=v_venta AND negocio_id=v_negocio;

  INSERT INTO public.pagos(
    negocio_id,venta_id,valor_pago,metodo_pago,cuenta_id,recibido_por
  )
  SELECT v_negocio,v_venta,p.valor_pago,upper(trim(p.metodo_pago)),
         p.cuenta_id,v_usuario
  FROM jsonb_to_recordset(p_pagos) AS p(
    metodo_pago text,valor_pago numeric,cuenta_id uuid
  );

  SELECT COALESCE(SUM(pg.valor_pago),0) INTO v_total_pagado
  FROM public.pagos pg
  WHERE pg.negocio_id=v_negocio AND pg.venta_id=v_venta
    AND pg.estado_pago='REGISTRADO';
  UPDATE public.ventas
  SET total_pagado=v_total_pagado,
      saldo_pendiente=GREATEST(0,total_venta-v_total_pagado),
      estado_venta=CASE WHEN total_venta>0 AND v_total_pagado>=total_venta
        THEN 'PAGADA' ELSE 'PENDIENTE' END
  WHERE id=v_venta AND negocio_id=v_negocio;

  IF p_cita_id IS NOT NULL THEN
    UPDATE public.citas SET estado='ATENDIDA'
    WHERE id=p_cita_id AND negocio_id=v_negocio
      AND estado IN ('PENDIENTE','CONFIRMADA','ATENDIDA');
    IF NOT FOUND THEN
      RAISE EXCEPTION 'No se pudo actualizar el estado de la cita cobrada.';
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'venta_id',v_venta,'total_bruto',v_total_bruto,
    'descuento',p_descuento,'total_venta',v_total_venta,
    'total_pagado',v_total_pagado,
    'saldo_pendiente',GREATEST(0,v_total_venta-v_total_pagado)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_venta_transaccional(uuid,uuid,numeric,uuid,jsonb,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_venta_transaccional(uuid,uuid,numeric,uuid,jsonb,jsonb) TO authenticated;


CREATE OR REPLACE FUNCTION public.registrar_abono_venta_transaccional(
  p_venta_id uuid,
  p_valor numeric,
  p_metodo_pago text,
  p_cuenta_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $
DECLARE
  v_negocio uuid := public.mi_negocio();
  v_rol text := public.mi_rol();
  v_estado text;
  v_total numeric(14,2);
  v_pagado numeric(14,2);
  v_saldo numeric(14,2);
  v_metodo text := upper(trim(COALESCE(p_metodo_pago,'')));
  v_caja uuid;
BEGIN
  IF auth.uid() IS NULL OR v_negocio IS NULL THEN
    RAISE EXCEPTION 'Sesión o negocio no válido.';
  END IF;
  IF COALESCE(v_rol,'') NOT IN ('ADMINISTRADOR','SUPERVISOR') THEN
    RAISE EXCEPTION 'No tienes permisos para registrar abonos de ventas.';
  END IF;
  IF p_valor IS NULL OR p_valor<=0
     OR p_valor::text IN ('NaN','Infinity','-Infinity') THEN
    RAISE EXCEPTION 'El abono debe ser un valor positivo y válido.';
  END IF;
  IF v_metodo NOT IN ('EFECTIVO','TRANSFERENCIA','TARJETA','NEQUI','DAVIPLATA') THEN
    RAISE EXCEPTION 'Método de pago no válido.';
  END IF;

  SELECT v.estado_venta,v.total_venta,v.total_pagado
    INTO v_estado,v_total,v_pagado
  FROM public.ventas v
  WHERE v.id=p_venta_id AND v.negocio_id=v_negocio
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No se encontró la venta en este negocio.';
  END IF;
  IF v_estado='ANULADA' THEN
    RAISE EXCEPTION 'No se pueden registrar abonos a una venta anulada.';
  END IF;
  v_saldo:=GREATEST(0,COALESCE(v_total,0)-COALESCE(v_pagado,0));
  IF v_saldo<=0 THEN
    RAISE EXCEPTION 'Esta venta ya está completamente pagada.';
  END IF;
  IF p_valor>v_saldo THEN
    RAISE EXCEPTION 'El abono no puede superar el saldo pendiente (%).',v_saldo;
  END IF;

  SELECT c.id INTO v_caja
  FROM public.cajas c
  WHERE c.negocio_id=v_negocio AND c.estado_caja='ABIERTA'
  ORDER BY c.fecha_apertura DESC
  LIMIT 1
  FOR UPDATE;
  IF v_caja IS NULL THEN
    RAISE EXCEPTION 'Abre Caja antes de registrar un abono.';
  END IF;

  IF p_cuenta_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.cuentas c
    WHERE c.id=p_cuenta_id AND c.negocio_id=v_negocio AND c.estado='ACTIVO'
  ) THEN
    RAISE EXCEPTION 'La cuenta de recaudo no pertenece a este negocio o está inactiva.';
  END IF;

  INSERT INTO public.pagos(
    negocio_id,venta_id,valor_pago,metodo_pago,cuenta_id,recibido_por
  ) VALUES(
    v_negocio,p_venta_id,p_valor,v_metodo,p_cuenta_id,auth.uid()
  );

  SELECT COALESCE(SUM(pg.valor_pago),0) INTO v_pagado
  FROM public.pagos pg
  WHERE pg.negocio_id=v_negocio AND pg.venta_id=p_venta_id
    AND pg.estado_pago='REGISTRADO';

  UPDATE public.ventas
  SET total_pagado=v_pagado,
      saldo_pendiente=GREATEST(0,COALESCE(total_venta,0)-v_pagado),
      estado_venta=CASE WHEN COALESCE(total_venta,0)>0 AND v_pagado>=total_venta
        THEN 'PAGADA' ELSE 'PENDIENTE' END
  WHERE id=p_venta_id AND negocio_id=v_negocio;

  RETURN jsonb_build_object(
    'venta_id',p_venta_id,'total_pagado',v_pagado,
    'saldo_pendiente',GREATEST(0,COALESCE(v_total,0)-v_pagado)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_abono_venta_transaccional(uuid,numeric,text,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_abono_venta_transaccional(uuid,numeric,text,uuid) TO authenticated;


CREATE OR REPLACE FUNCTION public.guardar_horarios_barbero(
  p_barbero_id uuid,
  p_horarios jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_negocio uuid := public.mi_negocio();
  v_rol text := public.mi_rol();
  v_barbero uuid;
  v_filas integer := 0;
  x record;
BEGIN
  IF auth.uid() IS NULL OR v_negocio IS NULL THEN
    RAISE EXCEPTION 'Sesión o negocio no válido.';
  END IF;
  IF COALESCE(v_rol,'') NOT IN ('ADMINISTRADOR','SUPERVISOR') THEN
    RAISE EXCEPTION 'Solo administración puede modificar horarios.';
  END IF;
  IF jsonb_typeof(p_horarios) IS DISTINCT FROM 'array'
     OR jsonb_array_length(p_horarios)>14 THEN
    RAISE EXCEPTION 'Los horarios no tienen un formato válido.';
  END IF;

  SELECT b.id INTO v_barbero
  FROM public.barberos b
  WHERE b.id=p_barbero_id AND b.negocio_id=v_negocio
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'El barbero no pertenece a este negocio.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_horarios) AS h(
      dia_semana smallint,hora_inicio time,hora_fin time
    )
    WHERE h.dia_semana IS NULL OR h.dia_semana NOT BETWEEN 0 AND 6
       OR h.hora_inicio IS NULL OR h.hora_fin IS NULL
       OR h.hora_inicio>=h.hora_fin
  ) THEN
    RAISE EXCEPTION 'Cada tramo debe tener día y horas válidas; la salida debe ser posterior a la entrada.';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_horarios) AS h(
      dia_semana smallint,hora_inicio time,hora_fin time
    )
    GROUP BY h.dia_semana,h.hora_inicio,h.hora_fin
    HAVING COUNT(*)>1
  ) OR EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_horarios) AS a(
      dia_semana smallint,hora_inicio time,hora_fin time
    )
    JOIN jsonb_to_recordset(p_horarios) AS b(
      dia_semana smallint,hora_inicio time,hora_fin time
    ) ON a.dia_semana=b.dia_semana
       AND a.hora_inicio<=b.hora_inicio
       AND (a.hora_inicio,a.hora_fin) IS DISTINCT FROM (b.hora_inicio,b.hora_fin)
       AND a.hora_fin>b.hora_inicio
  ) THEN
    RAISE EXCEPTION 'Los tramos de un mismo día no pueden cruzarse ni repetirse.';
  END IF;

  DELETE FROM public.horarios_barbero
  WHERE negocio_id=v_negocio AND barbero_id=v_barbero;

  INSERT INTO public.horarios_barbero(
    negocio_id,barbero_id,dia_semana,hora_inicio,hora_fin
  )
  SELECT v_negocio,v_barbero,h.dia_semana,h.hora_inicio,h.hora_fin
  FROM jsonb_to_recordset(p_horarios) AS h(
    dia_semana smallint,hora_inicio time,hora_fin time
  );
  GET DIAGNOSTICS v_filas=ROW_COUNT;

  RETURN jsonb_build_object('barbero_id',v_barbero,'tramos_guardados',v_filas);
END;
$$;

REVOKE ALL ON FUNCTION public.guardar_horarios_barbero(uuid,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.guardar_horarios_barbero(uuid,jsonb) TO authenticated;


CREATE OR REPLACE FUNCTION public.guardar_ajustes_negocio(
  p_nombre text,
  p_telefono text,
  p_direccion text,
  p_correo text,
  p_reserva_publica boolean,
  p_permitir_saldos boolean,
  p_valor_cita numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_negocio uuid := public.mi_negocio();
  v_rol text := public.mi_rol();
  v_servicio uuid;
BEGIN
  IF auth.uid() IS NULL OR v_negocio IS NULL THEN
    RAISE EXCEPTION 'Sesión o negocio no válido.';
  END IF;
  IF COALESCE(v_rol,'') NOT IN ('ADMINISTRADOR','SUPERVISOR') THEN
    RAISE EXCEPTION 'Solo administración puede modificar los ajustes.';
  END IF;
  IF length(trim(COALESCE(p_nombre,'')))<2 THEN
    RAISE EXCEPTION 'El nombre de la barbería debe tener al menos dos caracteres.';
  END IF;
  IF p_reserva_publica IS NULL OR p_permitir_saldos IS NULL
     OR p_valor_cita IS NULL OR p_valor_cita<0
     OR p_valor_cita::text IN ('NaN','Infinity','-Infinity') THEN
    RAISE EXCEPTION 'Revisa el valor de la reserva y las opciones del negocio.';
  END IF;

  UPDATE public.negocios
  SET nombre=trim(p_nombre),
      telefono=NULLIF(trim(COALESCE(p_telefono,'')),''),
      direccion=NULLIF(trim(COALESCE(p_direccion,'')),''),
      correo=NULLIF(trim(COALESCE(p_correo,'')),''),
      reserva_publica=p_reserva_publica,
      permitir_saldos=p_permitir_saldos,
      valor_cita=p_valor_cita
  WHERE id=v_negocio;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No se encontró la barbería de la sesión.';
  END IF;

  SELECT s.id INTO v_servicio
  FROM public.servicios s
  WHERE s.negocio_id=v_negocio AND s.categoria='CITA'
  ORDER BY s.nombre
  LIMIT 1
  FOR UPDATE;

  IF v_servicio IS NOT NULL THEN
    UPDATE public.servicios
    SET precio=p_valor_cita,
        estado=CASE WHEN p_valor_cita>0 THEN 'ACTIVO' ELSE 'INACTIVO' END
    WHERE id=v_servicio AND negocio_id=v_negocio;
  ELSIF p_valor_cita>0 THEN
    INSERT INTO public.servicios(
      negocio_id,nombre,categoria,precio,duracion_minutos
    ) VALUES(v_negocio,'Cita (reserva)','CITA',p_valor_cita,1);
  END IF;

  RETURN jsonb_build_object(
    'negocio_id',v_negocio,'nombre',trim(p_nombre),
    'valor_cita',p_valor_cita,'reserva_publica',p_reserva_publica,
    'permitir_saldos',p_permitir_saldos
  );
END;
$$;

REVOKE ALL ON FUNCTION public.guardar_ajustes_negocio(text,text,text,text,boolean,boolean,numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.guardar_ajustes_negocio(text,text,text,text,boolean,boolean,numeric) TO authenticated;
