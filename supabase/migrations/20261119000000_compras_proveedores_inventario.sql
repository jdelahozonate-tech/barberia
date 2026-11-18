-- Gestión de proveedores, compras, cuentas por pagar y movimientos trazables.
-- No modifica registros existentes ni cambia los triggers actuales de ventas.
CREATE TABLE IF NOT EXISTS public.proveedores_inventario (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 negocio_id uuid NOT NULL,
 nombre text NOT NULL CHECK (length(btrim(nombre)) > 0),
 documento text,
 contacto text,
 telefono text,
 correo text,
 direccion text,
 observaciones text,
 estado text NOT NULL DEFAULT 'ACTIVO' CHECK (estado IN ('ACTIVO','INACTIVO')),
 creado_por uuid,
 creado_en timestamptz NOT NULL DEFAULT now(),
 actualizado_en timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_proveedores_inventario_negocio
 ON public.proveedores_inventario(negocio_id, estado, nombre);

CREATE TABLE IF NOT EXISTS public.compras_inventario (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 negocio_id uuid NOT NULL,
 proveedor_id uuid NOT NULL REFERENCES public.proveedores_inventario(id) ON DELETE RESTRICT,
 fecha_compra date NOT NULL DEFAULT CURRENT_DATE,
 fecha_vencimiento date,
 numero_factura text,
 total_compra numeric(14,2) NOT NULL CHECK (total_compra >= 0),
 total_pagado numeric(14,2) NOT NULL DEFAULT 0 CHECK (total_pagado >= 0),
 saldo_pendiente numeric(14,2) NOT NULL DEFAULT 0 CHECK (saldo_pendiente >= 0),
 estado_compra text NOT NULL DEFAULT 'PENDIENTE' CHECK (estado_compra IN ('PENDIENTE','PAGADA','ANULADA')),
 referencia text,
 observaciones text,
 creado_por uuid,
 creado_en timestamptz NOT NULL DEFAULT now(),
 actualizado_en timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT compras_inventario_pago_valido CHECK (total_pagado <= total_compra)
);

ALTER TABLE public.compras_inventario ADD COLUMN IF NOT EXISTS fecha_vencimiento date;
ALTER TABLE public.compras_inventario ADD COLUMN IF NOT EXISTS numero_factura text;

CREATE INDEX IF NOT EXISTS idx_compras_inventario_negocio_fecha
 ON public.compras_inventario(negocio_id, fecha_compra DESC);
CREATE INDEX IF NOT EXISTS idx_compras_inventario_proveedor
 ON public.compras_inventario(negocio_id, proveedor_id);

CREATE TABLE IF NOT EXISTS public.detalle_compras_inventario (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 negocio_id uuid NOT NULL,
 compra_id uuid NOT NULL REFERENCES public.compras_inventario(id) ON DELETE RESTRICT,
 producto_id uuid NOT NULL REFERENCES public.productos(id) ON DELETE RESTRICT,
 cantidad numeric(14,3) NOT NULL CHECK (cantidad > 0),
 costo_unitario numeric(14,2) NOT NULL CHECK (costo_unitario >= 0),
 subtotal numeric(14,2) GENERATED ALWAYS AS (round(cantidad * costo_unitario, 2)) STORED,
 creado_en timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_detalle_compras_compra
 ON public.detalle_compras_inventario(negocio_id, compra_id);
CREATE INDEX IF NOT EXISTS idx_detalle_compras_producto
 ON public.detalle_compras_inventario(negocio_id, producto_id);

CREATE TABLE IF NOT EXISTS public.pagos_compras_inventario (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 negocio_id uuid NOT NULL,
 compra_id uuid NOT NULL REFERENCES public.compras_inventario(id) ON DELETE RESTRICT,
 fecha_pago timestamptz NOT NULL DEFAULT now(),
 valor_pago numeric(14,2) NOT NULL CHECK (valor_pago > 0),
 metodo_pago text NOT NULL CHECK (metodo_pago IN ('EFECTIVO','TRANSFERENCIA','TARJETA','NEQUI','DAVIPLATA')),
 referencia text,
 observaciones text,
 recibido_por uuid,
 caja_id uuid REFERENCES public.cajas(id) ON DELETE SET NULL,
 creado_en timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pagos_compras_inventario ADD COLUMN IF NOT EXISTS caja_id uuid REFERENCES public.cajas(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_pagos_compras_compra
 ON public.pagos_compras_inventario(negocio_id, compra_id, fecha_pago);
CREATE INDEX IF NOT EXISTS idx_pagos_compras_caja
 ON public.pagos_compras_inventario(negocio_id, caja_id, fecha_pago) WHERE caja_id IS NOT NULL;

-- Enlaza el movimiento de inventario con la compra que lo originó.
ALTER TABLE public.movimientos_inventario
 ADD COLUMN IF NOT EXISTS compra_id uuid
 REFERENCES public.compras_inventario(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_movimientos_compra
 ON public.movimientos_inventario(negocio_id, compra_id)
 WHERE compra_id IS NOT NULL;

ALTER TABLE public.proveedores_inventario ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compras_inventario ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.detalle_compras_inventario ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagos_compras_inventario ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS proveedores_inventario_admin ON public.proveedores_inventario;
CREATE POLICY proveedores_inventario_admin ON public.proveedores_inventario
 FOR ALL TO authenticated
 USING (negocio_id = public.mi_negocio() AND COALESCE(public.mi_rol(),'') IN ('ADMINISTRADOR','SUPERVISOR'))
 WITH CHECK (negocio_id = public.mi_negocio() AND COALESCE(public.mi_rol(),'') IN ('ADMINISTRADOR','SUPERVISOR'));

DROP POLICY IF EXISTS compras_inventario_lectura ON public.compras_inventario;
CREATE POLICY compras_inventario_lectura ON public.compras_inventario
 FOR SELECT TO authenticated
 USING (negocio_id = public.mi_negocio() AND COALESCE(public.mi_rol(),'') IN ('ADMINISTRADOR','SUPERVISOR'));

DROP POLICY IF EXISTS detalle_compras_inventario_lectura ON public.detalle_compras_inventario;
CREATE POLICY detalle_compras_inventario_lectura ON public.detalle_compras_inventario
 FOR SELECT TO authenticated
 USING (negocio_id = public.mi_negocio() AND COALESCE(public.mi_rol(),'') IN ('ADMINISTRADOR','SUPERVISOR'));

DROP POLICY IF EXISTS pagos_compras_inventario_lectura ON public.pagos_compras_inventario;
CREATE POLICY pagos_compras_inventario_lectura ON public.pagos_compras_inventario
 FOR SELECT TO authenticated
 USING (negocio_id = public.mi_negocio() AND COALESCE(public.mi_rol(),'') IN ('ADMINISTRADOR','SUPERVISOR'));

GRANT SELECT, INSERT, UPDATE ON public.proveedores_inventario TO authenticated;
GRANT SELECT ON public.compras_inventario, public.detalle_compras_inventario, public.pagos_compras_inventario TO authenticated;

CREATE OR REPLACE FUNCTION public.registrar_compra_inventario(
 p_proveedor_id uuid,
 p_fecha_compra date,
 p_detalles jsonb,
 p_valor_pagado numeric,
 p_metodo_pago text,
 p_referencia text DEFAULT NULL,
 p_observaciones text DEFAULT NULL,
 p_caja_id uuid DEFAULT NULL,
 p_numero_factura text DEFAULT NULL,
 p_fecha_vencimiento date DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
 v_negocio uuid := public.mi_negocio();
 v_usuario uuid := auth.uid();
 v_rol text := COALESCE(public.mi_rol(),'');
 v_compra uuid;
 v_total numeric(14,2);
 v_pagado numeric(14,2);
 v_saldo numeric(14,2);
BEGIN
 IF v_usuario IS NULL OR v_negocio IS NULL THEN
  RAISE EXCEPTION 'Debes iniciar sesión en un negocio activo.';
 END IF;
 IF v_rol NOT IN ('ADMINISTRADOR','SUPERVISOR') THEN
  RAISE EXCEPTION 'No tienes permisos para registrar compras.';
 END IF;
 IF p_detalles IS NULL OR jsonb_typeof(p_detalles) <> 'array' OR jsonb_array_length(p_detalles) = 0 THEN
  RAISE EXCEPTION 'La compra debe incluir al menos un producto.';
 END IF;
 IF p_fecha_compra IS NULL OR p_fecha_compra > CURRENT_DATE THEN
  RAISE EXCEPTION 'La fecha de compra no es válida.';
 END IF;
 IF p_fecha_vencimiento IS NOT NULL AND p_fecha_vencimiento < p_fecha_compra THEN
  RAISE EXCEPTION 'La fecha de vencimiento no puede ser anterior a la compra.';
 END IF;
 IF p_valor_pagado IS NULL OR p_valor_pagado < 0 OR p_valor_pagado::text IN ('NaN','Infinity','-Infinity') THEN
  RAISE EXCEPTION 'El valor pagado no es válido.';
 END IF;
 IF p_metodo_pago NOT IN ('EFECTIVO','TRANSFERENCIA','TARJETA','NEQUI','DAVIPLATA') THEN
  RAISE EXCEPTION 'El método de pago no es válido.';
 END IF;
 IF p_caja_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.cajas WHERE id = p_caja_id AND negocio_id = v_negocio AND estado_caja = 'ABIERTA') THEN
  RAISE EXCEPTION 'La caja indicada no existe o no está abierta en este negocio.';
 END IF;
 IF NOT EXISTS (
  SELECT 1 FROM public.proveedores_inventario
  WHERE id = p_proveedor_id AND negocio_id = v_negocio AND estado = 'ACTIVO'
 ) THEN
  RAISE EXCEPTION 'El proveedor no existe, está inactivo o pertenece a otro negocio.';
 END IF;
 IF EXISTS (
  SELECT 1
  FROM jsonb_to_recordset(p_detalles) AS x(producto_id uuid, cantidad numeric, costo_unitario numeric)
  WHERE x.producto_id IS NULL OR x.cantidad IS NULL OR x.cantidad <= 0
     OR x.cantidad::text IN ('NaN','Infinity','-Infinity')
     OR x.costo_unitario IS NULL OR x.costo_unitario < 0
     OR x.costo_unitario::text IN ('NaN','Infinity','-Infinity')
 ) THEN
  RAISE EXCEPTION 'Hay productos, cantidades o costos inválidos.';
 END IF;
 IF EXISTS (
  SELECT 1
  FROM jsonb_to_recordset(p_detalles) AS x(producto_id uuid, cantidad numeric, costo_unitario numeric)
  LEFT JOIN public.productos p ON p.id = x.producto_id AND p.negocio_id = v_negocio
  WHERE p.id IS NULL OR p.estado <> 'ACTIVO'
 ) THEN
  RAISE EXCEPTION 'Uno o más productos no existen, están inactivos o pertenecen a otro negocio.';
 END IF;

 -- Serializa compras concurrentes para un mismo producto.
 PERFORM 1
 FROM public.productos p
 JOIN (SELECT DISTINCT producto_id FROM jsonb_to_recordset(p_detalles) AS x(producto_id uuid)) x
   ON x.producto_id = p.id
 WHERE p.negocio_id = v_negocio
 FOR UPDATE OF p;

 SELECT round(COALESCE(sum(round(x.cantidad * x.costo_unitario,2)),0),2)
 INTO v_total
 FROM jsonb_to_recordset(p_detalles) AS x(producto_id uuid, cantidad numeric, costo_unitario numeric);

 IF p_valor_pagado > v_total THEN
  RAISE EXCEPTION 'El abono inicial no puede superar el total de la compra.';
 END IF;

 INSERT INTO public.compras_inventario(
  negocio_id, proveedor_id, fecha_compra, fecha_vencimiento, numero_factura, total_compra, total_pagado,
  saldo_pendiente, estado_compra, referencia, observaciones, creado_por
 ) VALUES (
  v_negocio, p_proveedor_id, p_fecha_compra, p_fecha_vencimiento, NULLIF(btrim(p_numero_factura),''), v_total, 0,
  v_total, CASE WHEN v_total = 0 THEN 'PAGADA' ELSE 'PENDIENTE' END,
  NULLIF(btrim(p_referencia),''), NULLIF(btrim(p_observaciones),''), v_usuario
 ) RETURNING id INTO v_compra;

 INSERT INTO public.detalle_compras_inventario(
  negocio_id, compra_id, producto_id, cantidad, costo_unitario
 )
 SELECT v_negocio, v_compra, x.producto_id, x.cantidad, x.costo_unitario
 FROM jsonb_to_recordset(p_detalles) AS x(producto_id uuid, cantidad numeric, costo_unitario numeric);

 -- Actualiza el costo de referencia con promedio ponderado para productos inventariables.
 WITH nuevas AS (
  SELECT x.producto_id, sum(x.cantidad) AS cantidad,
         sum(x.cantidad * x.costo_unitario) AS costo_total,
         sum(x.cantidad * x.costo_unitario) / NULLIF(sum(x.cantidad),0) AS costo_promedio
  FROM jsonb_to_recordset(p_detalles) AS x(producto_id uuid, cantidad numeric, costo_unitario numeric)
  GROUP BY x.producto_id
 )
 UPDATE public.productos p
 SET costo_unitario = CASE
   WHEN COALESCE(p.control_stock,false) AND COALESCE(st.existencias,0) + n.cantidad > 0
    THEN round((COALESCE(st.existencias,0) * COALESCE(p.costo_unitario,0) + n.costo_total)
               / (COALESCE(st.existencias,0) + n.cantidad),2)
   ELSE round(n.costo_promedio,2)
  END
 FROM nuevas n
 LEFT JOIN public.stock_actual st
   ON st.producto_id = n.producto_id AND st.negocio_id = v_negocio
 WHERE p.id = n.producto_id AND p.negocio_id = v_negocio;

 INSERT INTO public.movimientos_inventario(
  negocio_id, producto_id, fecha_hora, tipo_movimiento, cantidad,
  costo_unitario, motivo, compra_id, usuario_responsable
 )
 SELECT v_negocio, d.producto_id, now(), 'ENTRADA', d.cantidad,
        d.costo_unitario, 'Compra ' || left(v_compra::text,8), v_compra, v_usuario
 FROM public.detalle_compras_inventario d
 JOIN public.productos p ON p.id = d.producto_id AND p.negocio_id = v_negocio
 WHERE d.compra_id = v_compra AND COALESCE(p.control_stock,false);

 IF p_valor_pagado > 0 THEN
  INSERT INTO public.pagos_compras_inventario(
   negocio_id, compra_id, valor_pago, metodo_pago, referencia, observaciones, recibido_por, caja_id
  ) VALUES (
   v_negocio, v_compra, p_valor_pagado, p_metodo_pago,
   NULLIF(btrim(p_referencia),''), NULLIF(btrim(p_observaciones),''), v_usuario, p_caja_id
  );
 END IF;

 v_pagado := p_valor_pagado;
 v_saldo := v_total - v_pagado;
 UPDATE public.compras_inventario
 SET total_pagado = v_pagado, saldo_pendiente = v_saldo,
     estado_compra = CASE WHEN v_saldo <= 0 THEN 'PAGADA' ELSE 'PENDIENTE' END,
     actualizado_en = now()
 WHERE id = v_compra AND negocio_id = v_negocio;

 RETURN jsonb_build_object('compra_id',v_compra,'total_compra',v_total,
  'total_pagado',v_pagado,'saldo_pendiente',v_saldo);
END;
$$;

CREATE OR REPLACE FUNCTION public.registrar_pago_compra_inventario(
 p_compra_id uuid,
 p_valor_pago numeric,
 p_metodo_pago text,
 p_referencia text DEFAULT NULL,
 p_observaciones text DEFAULT NULL,
 p_caja_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
 v_negocio uuid := public.mi_negocio();
 v_usuario uuid := auth.uid();
 v_rol text := COALESCE(public.mi_rol(),'');
 v_compra public.compras_inventario%ROWTYPE;
 v_nuevo_pagado numeric(14,2);
 v_saldo numeric(14,2);
BEGIN
 IF v_usuario IS NULL OR v_negocio IS NULL OR v_rol NOT IN ('ADMINISTRADOR','SUPERVISOR') THEN
  RAISE EXCEPTION 'No tienes permisos para registrar pagos a proveedores.';
 END IF;
 IF p_valor_pago IS NULL OR p_valor_pago <= 0 OR p_valor_pago::text IN ('NaN','Infinity','-Infinity') THEN
  RAISE EXCEPTION 'El abono debe ser mayor que cero.';
 END IF;
 IF p_metodo_pago NOT IN ('EFECTIVO','TRANSFERENCIA','TARJETA','NEQUI','DAVIPLATA') THEN
  RAISE EXCEPTION 'El método de pago no es válido.';
 END IF;
 IF p_caja_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.cajas WHERE id = p_caja_id AND negocio_id = v_negocio AND estado_caja = 'ABIERTA') THEN
  RAISE EXCEPTION 'La caja indicada no existe o no está abierta en este negocio.';
 END IF;
 SELECT * INTO v_compra FROM public.compras_inventario
 WHERE id = p_compra_id AND negocio_id = v_negocio FOR UPDATE;
 IF NOT FOUND OR v_compra.estado_compra = 'ANULADA' THEN
  RAISE EXCEPTION 'La compra no existe o está anulada.';
 END IF;
 IF p_valor_pago > v_compra.saldo_pendiente THEN
  RAISE EXCEPTION 'El abono supera el saldo pendiente.';
 END IF;
 INSERT INTO public.pagos_compras_inventario(
  negocio_id, compra_id, valor_pago, metodo_pago, referencia, observaciones, recibido_por, caja_id
 ) VALUES (
  v_negocio, p_compra_id, p_valor_pago, p_metodo_pago,
  NULLIF(btrim(p_referencia),''), NULLIF(btrim(p_observaciones),''), v_usuario, p_caja_id
 );
 v_nuevo_pagado := v_compra.total_pagado + p_valor_pago;
 v_saldo := v_compra.total_compra - v_nuevo_pagado;
 UPDATE public.compras_inventario
 SET total_pagado = v_nuevo_pagado, saldo_pendiente = v_saldo,
     estado_compra = CASE WHEN v_saldo <= 0 THEN 'PAGADA' ELSE 'PENDIENTE' END,
     actualizado_en = now()
 WHERE id = p_compra_id AND negocio_id = v_negocio;
 RETURN jsonb_build_object('compra_id',p_compra_id,'total_pagado',v_nuevo_pagado,'saldo_pendiente',v_saldo);
END;
$$;

CREATE OR REPLACE FUNCTION public.anular_compra_inventario(p_compra_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
 v_negocio uuid := public.mi_negocio();
 v_usuario uuid := auth.uid();
 v_rol text := COALESCE(public.mi_rol(),'');
 v_compra public.compras_inventario%ROWTYPE;
BEGIN
 IF v_usuario IS NULL OR v_negocio IS NULL OR v_rol NOT IN ('ADMINISTRADOR','SUPERVISOR') THEN
  RAISE EXCEPTION 'No tienes permisos para anular compras.';
 END IF;
 SELECT * INTO v_compra FROM public.compras_inventario
 WHERE id = p_compra_id AND negocio_id = v_negocio FOR UPDATE;
 IF NOT FOUND OR v_compra.estado_compra = 'ANULADA' THEN
  RAISE EXCEPTION 'La compra no existe o ya está anulada.';
 END IF;
 IF v_compra.total_pagado > 0 OR EXISTS (
  SELECT 1 FROM public.pagos_compras_inventario
  WHERE compra_id = p_compra_id AND negocio_id = v_negocio
 ) THEN
  RAISE EXCEPTION 'No se puede anular una compra con pagos registrados. Primero concilia la devolución del proveedor.';
 END IF;

 PERFORM 1
 FROM public.productos p
 JOIN public.detalle_compras_inventario d ON d.producto_id = p.id
 WHERE d.compra_id = p_compra_id AND d.negocio_id = v_negocio
 FOR UPDATE OF p;

 -- Recalcula el costo de referencia descontando el costo de la compra revertida.
 WITH revertir AS (
  SELECT d.producto_id, sum(d.cantidad) AS cantidad,
         sum(d.cantidad * d.costo_unitario) AS costo_total
  FROM public.detalle_compras_inventario d
  WHERE d.compra_id = p_compra_id AND d.negocio_id = v_negocio
  GROUP BY d.producto_id
 )
 UPDATE public.productos p
 SET costo_unitario = CASE
  WHEN COALESCE(st.existencias,0) > r.cantidad
       AND COALESCE(st.existencias,0) * COALESCE(p.costo_unitario,0) > r.costo_total
   THEN round((COALESCE(st.existencias,0) * COALESCE(p.costo_unitario,0) - r.costo_total)
              / NULLIF(COALESCE(st.existencias,0) - r.cantidad,0),2)
  ELSE p.costo_unitario
 END
 FROM revertir r
 LEFT JOIN public.stock_actual st
  ON st.producto_id = r.producto_id AND st.negocio_id = v_negocio
 WHERE p.id = r.producto_id AND p.negocio_id = v_negocio
  AND COALESCE(p.control_stock,false);

 IF EXISTS (
  SELECT 1
  FROM (
   SELECT d.producto_id, sum(d.cantidad) cantidad
   FROM public.detalle_compras_inventario d
   JOIN public.productos p ON p.id = d.producto_id AND p.negocio_id = v_negocio
   WHERE d.compra_id = p_compra_id AND d.negocio_id = v_negocio
     AND COALESCE(p.control_stock,false)
   GROUP BY d.producto_id
  ) x
  LEFT JOIN public.stock_actual st ON st.producto_id = x.producto_id AND st.negocio_id = v_negocio
  WHERE COALESCE(st.existencias,0) < x.cantidad
 ) THEN
  RAISE EXCEPTION 'No hay existencias suficientes para revertir esta compra. Parte del inventario pudo haberse vendido.';
 END IF;

 INSERT INTO public.movimientos_inventario(
  negocio_id, producto_id, fecha_hora, tipo_movimiento, cantidad,
  costo_unitario, motivo, compra_id, usuario_responsable
 )
 SELECT v_negocio, d.producto_id, now(), 'SALIDA', d.cantidad,
        d.costo_unitario, 'Anulación de compra ' || left(p_compra_id::text,8),
        p_compra_id, v_usuario
 FROM public.detalle_compras_inventario d
 JOIN public.productos p ON p.id = d.producto_id AND p.negocio_id = v_negocio
 WHERE d.compra_id = p_compra_id AND d.negocio_id = v_negocio
   AND COALESCE(p.control_stock,false);

 UPDATE public.compras_inventario
 SET estado_compra = 'ANULADA', saldo_pendiente = 0, actualizado_en = now()
 WHERE id = p_compra_id AND negocio_id = v_negocio;
END;
$$;


CREATE OR REPLACE FUNCTION public.ajustar_inventario_producto(
 p_producto_id uuid,
 p_tipo text,
 p_cantidad numeric,
 p_motivo text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $
DECLARE
 v_negocio uuid := public.mi_negocio();
 v_usuario uuid := auth.uid();
 v_rol text := COALESCE(public.mi_rol(),'');
 v_producto public.productos%ROWTYPE;
 v_stock numeric;
BEGIN
 IF v_usuario IS NULL OR v_negocio IS NULL OR v_rol NOT IN ('ADMINISTRADOR','SUPERVISOR') THEN
  RAISE EXCEPTION 'No tienes permisos para ajustar inventario.';
 END IF;
 IF p_tipo NOT IN ('ENTRADA','SALIDA') THEN
  RAISE EXCEPTION 'El tipo de ajuste no es válido.';
 END IF;
 IF p_cantidad IS NULL OR p_cantidad <= 0 OR p_cantidad::text IN ('NaN','Infinity','-Infinity') THEN
  RAISE EXCEPTION 'La cantidad debe ser mayor que cero.';
 END IF;
 IF p_motivo IS NULL OR length(btrim(p_motivo)) < 3 THEN
  RAISE EXCEPTION 'Escribe el motivo del ajuste.';
 END IF;
 SELECT * INTO v_producto FROM public.productos
 WHERE id = p_producto_id AND negocio_id = v_negocio FOR UPDATE;
 IF NOT FOUND OR v_producto.estado <> 'ACTIVO' OR NOT COALESCE(v_producto.control_stock,false) THEN
  RAISE EXCEPTION 'El producto no existe, está inactivo o no controla existencias.';
 END IF;
 SELECT COALESCE(existencias,0) INTO v_stock
 FROM public.stock_actual
 WHERE producto_id = p_producto_id AND negocio_id = v_negocio;
 v_stock := COALESCE(v_stock,0);
 IF p_tipo = 'SALIDA' AND p_cantidad > v_stock THEN
  RAISE EXCEPTION 'El ajuste dejaría el inventario en negativo. Existencias actuales: %.', v_stock;
 END IF;
 INSERT INTO public.movimientos_inventario(
  negocio_id, producto_id, fecha_hora, tipo_movimiento, cantidad,
  costo_unitario, motivo, usuario_responsable
 ) VALUES (
  v_negocio, p_producto_id, now(), p_tipo, p_cantidad,
  COALESCE(v_producto.costo_unitario,0), 'Ajuste: ' || btrim(p_motivo), v_usuario
 );
 RETURN jsonb_build_object('producto_id',p_producto_id,'tipo',p_tipo,
  'cantidad',p_cantidad,'existencias_anteriores',v_stock,
  'existencias_nuevas',CASE WHEN p_tipo='ENTRADA' THEN v_stock+p_cantidad ELSE v_stock-p_cantidad END);
END;
$$;

REVOKE ALL ON FUNCTION public.ajustar_inventario_producto(uuid,text,numeric,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ajustar_inventario_producto(uuid,text,numeric,text) TO authenticated;

REVOKE ALL ON FUNCTION public.registrar_compra_inventario(uuid,date,jsonb,numeric,text,text,text,uuid,text,date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.registrar_pago_compra_inventario(uuid,numeric,text,text,text,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.anular_compra_inventario(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.registrar_compra_inventario(uuid,date,jsonb,numeric,text,text,text,uuid,text,date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_pago_compra_inventario(uuid,numeric,text,text,text,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.anular_compra_inventario(uuid) TO authenticated;
