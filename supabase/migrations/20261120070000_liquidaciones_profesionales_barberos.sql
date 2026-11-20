-- Liquidaciones diarias, anticipos, descuentos y abonos de barberos.
ALTER TABLE public.comisiones
  ADD COLUMN IF NOT EXISTS liquidacion_id uuid;

CREATE TABLE IF NOT EXISTS public.liquidaciones_barbero (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id uuid NOT NULL REFERENCES public.negocios(id) ON DELETE CASCADE,
  barbero_id uuid NOT NULL REFERENCES public.barberos(id) ON DELETE RESTRICT,
  fecha_liquidacion date NOT NULL DEFAULT CURRENT_DATE,
  total_comisiones numeric(14,2) NOT NULL DEFAULT 0 CHECK (total_comisiones >= 0),
  total_descuentos numeric(14,2) NOT NULL DEFAULT 0 CHECK (total_descuentos >= 0),
  total_anticipos numeric(14,2) NOT NULL DEFAULT 0 CHECK (total_anticipos >= 0),
  total_neto numeric(14,2) NOT NULL DEFAULT 0 CHECK (total_neto >= 0),
  total_pagado numeric(14,2) NOT NULL DEFAULT 0 CHECK (total_pagado >= 0),
  saldo_pendiente numeric(14,2) NOT NULL DEFAULT 0 CHECK (saldo_pendiente >= 0),
  estado_liquidacion text NOT NULL DEFAULT 'PENDIENTE'
    CHECK (estado_liquidacion IN ('PENDIENTE','PARCIAL','PAGADA','ANULADA')),
  caja_id uuid REFERENCES public.cajas(id) ON DELETE SET NULL,
  usuario_registro uuid REFERENCES public.perfiles(id) ON DELETE SET NULL,
  observaciones text,
  creado_en timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.comisiones
  ADD CONSTRAINT comisiones_liquidacion_id_fkey
  FOREIGN KEY (liquidacion_id) REFERENCES public.liquidaciones_barbero(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.movimientos_liquidacion_barbero (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id uuid NOT NULL REFERENCES public.negocios(id) ON DELETE CASCADE,
  barbero_id uuid NOT NULL REFERENCES public.barberos(id) ON DELETE RESTRICT,
  liquidacion_id uuid REFERENCES public.liquidaciones_barbero(id) ON DELETE RESTRICT,
  movimiento_origen_id uuid REFERENCES public.movimientos_liquidacion_barbero(id) ON DELETE RESTRICT,
  tipo_movimiento text NOT NULL
    CHECK (tipo_movimiento IN ('ANTICIPO','APLICACION_ANTICIPO','DESCUENTO','ABONO')),
  valor numeric(14,2) NOT NULL CHECK (valor > 0),
  metodo_pago text,
  motivo text NOT NULL,
  gasto_id uuid REFERENCES public.gastos(id) ON DELETE SET NULL,
  caja_id uuid REFERENCES public.cajas(id) ON DELETE SET NULL,
  usuario_registro uuid REFERENCES public.perfiles(id) ON DELETE SET NULL,
  fecha_hora timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS liquidaciones_barbero_negocio_fecha_idx
  ON public.liquidaciones_barbero (negocio_id, fecha_liquidacion DESC, barbero_id);
CREATE INDEX IF NOT EXISTS movimientos_barbero_negocio_barbero_fecha_idx
  ON public.movimientos_liquidacion_barbero (negocio_id, barbero_id, fecha_hora DESC);
CREATE INDEX IF NOT EXISTS movimientos_barbero_origen_idx
  ON public.movimientos_liquidacion_barbero (movimiento_origen_id)
  WHERE movimiento_origen_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS comisiones_liquidacion_idx
  ON public.comisiones (negocio_id, liquidacion_id);
CREATE UNIQUE INDEX IF NOT EXISTS comisiones_detalle_unico_uidx
  ON public.comisiones (negocio_id, detalle_id)
  WHERE detalle_id IS NOT NULL;

ALTER TABLE public.liquidaciones_barbero ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movimientos_liquidacion_barbero ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS liquidaciones_barbero_admin_select ON public.liquidaciones_barbero;
CREATE POLICY liquidaciones_barbero_admin_select
ON public.liquidaciones_barbero FOR SELECT TO authenticated
USING (negocio_id = public.mi_negocio()
  AND public.mi_rol() IN ('ADMINISTRADOR','SUPERVISOR'));

DROP POLICY IF EXISTS liquidaciones_barbero_propias_select ON public.liquidaciones_barbero;
CREATE POLICY liquidaciones_barbero_propias_select
ON public.liquidaciones_barbero FOR SELECT TO authenticated
USING (negocio_id = public.mi_negocio()
  AND barbero_id = (SELECT p.barbero_id FROM public.perfiles p WHERE p.id = auth.uid()));

DROP POLICY IF EXISTS movimientos_barbero_admin_select ON public.movimientos_liquidacion_barbero;
CREATE POLICY movimientos_barbero_admin_select
ON public.movimientos_liquidacion_barbero FOR SELECT TO authenticated
USING (negocio_id = public.mi_negocio()
  AND public.mi_rol() IN ('ADMINISTRADOR','SUPERVISOR'));

DROP POLICY IF EXISTS movimientos_barbero_propios_select ON public.movimientos_liquidacion_barbero;
CREATE POLICY movimientos_barbero_propios_select
ON public.movimientos_liquidacion_barbero FOR SELECT TO authenticated
USING (negocio_id = public.mi_negocio()
  AND barbero_id = (SELECT p.barbero_id FROM public.perfiles p WHERE p.id = auth.uid()));

GRANT SELECT ON public.liquidaciones_barbero, public.movimientos_liquidacion_barbero TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.liquidaciones_barbero, public.movimientos_liquidacion_barbero FROM anon, authenticated;

-- Una comisión solo existe como disponible cuando la venta queda pagada por completo.
CREATE OR REPLACE FUNCTION public.forzar_comision_solo_venta_pagada()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_estado text;
BEGIN
  IF NEW.tipo_item = 'SERVICIO'
     AND NEW.base_comision IS NOT NULL
     AND NEW.porcentaje_comision_aplicado IS NOT NULL THEN
    SELECT v.estado_venta INTO v_estado
    FROM public.ventas v
    WHERE v.id = NEW.venta_id AND v.negocio_id = NEW.negocio_id;

    IF v_estado IS DISTINCT FROM 'PAGADA' THEN
      NEW.comision_generada := 0;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_forzar_comision_solo_venta_pagada ON public.detalle_ventas;
CREATE TRIGGER trg_forzar_comision_solo_venta_pagada
BEFORE INSERT OR UPDATE OF comision_generada ON public.detalle_ventas
FOR EACH ROW
EXECUTE FUNCTION public.forzar_comision_solo_venta_pagada();

CREATE OR REPLACE FUNCTION public.sincronizar_comision_estado_venta()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NEW.estado_venta IS DISTINCT FROM OLD.estado_venta THEN
    UPDATE public.detalle_ventas d
    SET comision_generada = CASE
      WHEN NEW.estado_venta = 'PAGADA'
        AND d.base_comision IS NOT NULL
        AND d.porcentaje_comision_aplicado IS NOT NULL
        THEN ROUND(d.base_comision * d.porcentaje_comision_aplicado / 100, 2)
      WHEN d.base_comision IS NOT NULL
        AND d.porcentaje_comision_aplicado IS NOT NULL
        THEN 0
      ELSE d.comision_generada
    END
    WHERE d.venta_id = NEW.id
      AND d.negocio_id = NEW.negocio_id
      AND d.tipo_item = 'SERVICIO'
      AND (
        d.comision_generada IS DISTINCT FROM CASE
          WHEN NEW.estado_venta = 'PAGADA'
            AND d.base_comision IS NOT NULL
            AND d.porcentaje_comision_aplicado IS NOT NULL
            THEN ROUND(d.base_comision * d.porcentaje_comision_aplicado / 100, 2)
          WHEN d.base_comision IS NOT NULL
            AND d.porcentaje_comision_aplicado IS NOT NULL
            THEN 0
          ELSE d.comision_generada
        END
      );
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_sincronizar_comision_estado_venta ON public.ventas;
CREATE TRIGGER trg_sincronizar_comision_estado_venta
AFTER UPDATE OF estado_venta ON public.ventas
FOR EACH ROW
EXECUTE FUNCTION public.sincronizar_comision_estado_venta();

CREATE OR REPLACE FUNCTION public.registrar_anticipo_barbero(
  p_barbero_id uuid,
  p_valor numeric,
  p_motivo text,
  p_metodo_pago text DEFAULT 'EFECTIVO'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_negocio uuid := public.mi_negocio();
  v_rol text := public.mi_rol();
  v_nombre text;
  v_caja uuid;
  v_gasto uuid;
  v_movimiento uuid;
  v_metodo text := upper(trim(COALESCE(p_metodo_pago, 'EFECTIVO')));
BEGIN
  IF auth.uid() IS NULL OR v_negocio IS NULL THEN RAISE EXCEPTION 'Sesión o negocio no válido.'; END IF;
  IF COALESCE(v_rol,'') NOT IN ('ADMINISTRADOR','SUPERVISOR') THEN RAISE EXCEPTION 'No tienes permisos para registrar anticipos.'; END IF;
  IF p_valor IS NULL OR p_valor <= 0 OR p_valor::text IN ('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'El valor del anticipo debe ser mayor que cero.'; END IF;
  IF length(trim(COALESCE(p_motivo,''))) < 3 THEN RAISE EXCEPTION 'Escribe el motivo del anticipo.'; END IF;
  IF v_metodo NOT IN ('EFECTIVO','TRANSFERENCIA','TARJETA','NEQUI','DAVIPLATA') THEN RAISE EXCEPTION 'Método de pago no válido.'; END IF;

  SELECT b.nombre INTO v_nombre
  FROM public.barberos b
  WHERE b.id=p_barbero_id AND b.negocio_id=v_negocio AND b.estado='ACTIVO';
  IF NOT FOUND THEN RAISE EXCEPTION 'El barbero no pertenece a este negocio o está inactivo.'; END IF;

  SELECT c.id INTO v_caja
  FROM public.cajas c
  WHERE c.negocio_id=v_negocio AND c.estado_caja='ABIERTA'
  ORDER BY c.fecha_apertura DESC LIMIT 1 FOR UPDATE;
  IF v_caja IS NULL THEN RAISE EXCEPTION 'Abre la caja antes de entregar un anticipo.'; END IF;

  INSERT INTO public.gastos(negocio_id,categoria_gasto,descripcion,valor,metodo_pago,usuario_registro,caja_id)
  VALUES(v_negocio,'COMISIONES','Anticipo a '+v_nombre+': '+trim(p_motivo),p_valor,v_metodo,auth.uid(),v_caja)
  RETURNING id INTO v_gasto;

  INSERT INTO public.movimientos_liquidacion_barbero(
    negocio_id,barbero_id,tipo_movimiento,valor,metodo_pago,motivo,gasto_id,caja_id,usuario_registro
  ) VALUES(v_negocio,p_barbero_id,'ANTICIPO',p_valor,v_metodo,trim(p_motivo),v_gasto,v_caja,auth.uid())
  RETURNING id INTO v_movimiento;

  RETURN jsonb_build_object('movimiento_id',v_movimiento,'gasto_id',v_gasto,'barbero',v_nombre,'valor',p_valor);
END;
$function$;

CREATE OR REPLACE FUNCTION public.liquidar_barbero(
  p_barbero_id uuid,
  p_fecha date DEFAULT CURRENT_DATE,
  p_descuentos jsonb DEFAULT '[]'::jsonb,
  p_pago_inicial numeric DEFAULT 0,
  p_metodo_pago text DEFAULT 'EFECTIVO',
  p_observaciones text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_negocio uuid := public.mi_negocio();
  v_rol text := public.mi_rol();
  v_nombre text;
  v_total_comisiones numeric(14,2) := 0;
  v_total_descuentos numeric(14,2) := 0;
  v_total_anticipos numeric(14,2) := 0;
  v_total_neto numeric(14,2) := 0;
  v_pago numeric(14,2) := COALESCE(p_pago_inicial,0);
  v_restante numeric(14,2);
  v_disponible numeric(14,2) := 0;
  v_aplicar numeric(14,2);
  v_caja uuid;
  v_gasto uuid;
  v_liquidacion uuid;
  v_metodo text := upper(trim(COALESCE(p_metodo_pago,'EFECTIVO')));
  v_cantidad integer := 0;
  x record;
  a record;
BEGIN
  IF auth.uid() IS NULL OR v_negocio IS NULL THEN RAISE EXCEPTION 'Sesión o negocio no válido.'; END IF;
  IF COALESCE(v_rol,'') NOT IN ('ADMINISTRADOR','SUPERVISOR') THEN RAISE EXCEPTION 'No tienes permisos para liquidar barberos.'; END IF;
  IF p_fecha IS NULL THEN RAISE EXCEPTION 'Selecciona la fecha de liquidación.'; END IF;
  IF jsonb_typeof(COALESCE(p_descuentos,'[]'::jsonb)) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Los descuentos no tienen un formato válido.'; END IF;
  IF v_pago < 0 OR v_pago::text IN ('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'El pago inicial no puede ser negativo.'; END IF;
  IF v_metodo NOT IN ('EFECTIVO','TRANSFERENCIA','TARJETA','NEQUI','DAVIPLATA') THEN RAISE EXCEPTION 'Método de pago no válido.'; END IF;

  SELECT b.nombre INTO v_nombre
  FROM public.barberos b
  WHERE b.id=p_barbero_id AND b.negocio_id=v_negocio AND b.estado='ACTIVO'
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'El barbero no pertenece a este negocio o está inactivo.'; END IF;

  -- Bloquea los detalles y ventas para impedir dos liquidaciones concurrentes de la misma comisión.
  PERFORM 1
  FROM public.detalle_ventas d
  JOIN public.ventas v ON v.id=d.venta_id AND v.negocio_id=d.negocio_id
  WHERE d.negocio_id=v_negocio
    AND v.barbero_id=p_barbero_id
    AND v.estado_venta='PAGADA'
    AND d.tipo_item='SERVICIO'
    AND d.comision_generada>0
    AND NOT EXISTS (
      SELECT 1 FROM public.comisiones c
      WHERE c.negocio_id=d.negocio_id AND c.detalle_id=d.id
    )
  FOR UPDATE OF d,v;

  SELECT count(*),COALESCE(sum(d.comision_generada),0)
    INTO v_cantidad,v_total_comisiones
  FROM public.detalle_ventas d
  JOIN public.ventas v ON v.id=d.venta_id AND v.negocio_id=d.negocio_id
  WHERE d.negocio_id=v_negocio
    AND v.barbero_id=p_barbero_id
    AND v.estado_venta='PAGADA'
    AND d.tipo_item='SERVICIO'
    AND d.comision_generada>0
    AND NOT EXISTS (
      SELECT 1 FROM public.comisiones c
      WHERE c.negocio_id=d.negocio_id AND c.detalle_id=d.id
    );
  IF v_cantidad=0 THEN RAISE EXCEPTION 'Este barbero no tiene comisiones pendientes de liquidar.'; END IF;

  FOR x IN
    SELECT * FROM jsonb_to_recordset(COALESCE(p_descuentos,'[]'::jsonb))
      AS d(valor numeric,motivo text)
  LOOP
    IF x.valor IS NULL OR x.valor<=0 OR x.valor::text IN ('NaN','Infinity','-Infinity')
       OR length(trim(COALESCE(x.motivo,'')))<3 THEN
      RAISE EXCEPTION 'Cada descuento debe tener un valor positivo y un motivo.';
    END IF;
    v_total_descuentos:=v_total_descuentos+x.valor;
  END LOOP;
  IF v_total_descuentos>v_total_comisiones THEN RAISE EXCEPTION 'Los descuentos no pueden superar las comisiones generadas.'; END IF;

  -- Bloquea los anticipos abiertos y calcula el saldo aún no aplicado.
  PERFORM 1 FROM public.movimientos_liquidacion_barbero m
  WHERE m.negocio_id=v_negocio AND m.barbero_id=p_barbero_id AND m.tipo_movimiento='ANTICIPO'
  FOR UPDATE;

  SELECT COALESCE(sum(m.valor-COALESCE((
    SELECT sum(ap.valor) FROM public.movimientos_liquidacion_barbero ap
    WHERE ap.movimiento_origen_id=m.id AND ap.tipo_movimiento='APLICACION_ANTICIPO'
  ),0)),0)
  INTO v_disponible
  FROM public.movimientos_liquidacion_barbero m
  WHERE m.negocio_id=v_negocio AND m.barbero_id=p_barbero_id AND m.tipo_movimiento='ANTICIPO';

  v_restante:=v_total_comisiones-v_total_descuentos;
  v_total_anticipos:=LEAST(v_restante,v_disponible);
  v_total_neto:=GREATEST(0,v_restante-v_total_anticipos);
  IF v_pago>v_total_neto THEN RAISE EXCEPTION 'El pago inicial no puede superar el neto por liquidar (%).',v_total_neto; END IF;

  IF v_pago>0 THEN
    SELECT c.id INTO v_caja FROM public.cajas c
    WHERE c.negocio_id=v_negocio AND c.estado_caja='ABIERTA'
    ORDER BY c.fecha_apertura DESC LIMIT 1 FOR UPDATE;
    IF v_caja IS NULL THEN RAISE EXCEPTION 'Abre la caja antes de pagar la liquidación.'; END IF;
  END IF;

  INSERT INTO public.liquidaciones_barbero(
    negocio_id,barbero_id,fecha_liquidacion,total_comisiones,total_descuentos,total_anticipos,
    total_neto,total_pagado,saldo_pendiente,estado_liquidacion,caja_id,usuario_registro,observaciones
  ) VALUES(
    v_negocio,p_barbero_id,p_fecha,v_total_comisiones,v_total_descuentos,v_total_anticipos,
    v_total_neto,0,v_total_neto,CASE WHEN v_total_neto=0 THEN 'PAGADA' ELSE 'PENDIENTE' END,
    v_caja,auth.uid(),NULLIF(trim(COALESCE(p_observaciones,'')),'')
  ) RETURNING id INTO v_liquidacion;

  -- Vincula las comisiones generadas por ventas ya pagadas.
  INSERT INTO public.comisiones(
    negocio_id,barbero_id,detalle_id,fecha_generacion,valor_base,porcentaje,
    valor_comision,estado_liquidacion,fecha_pago,liquidacion_id
  )
  SELECT d.negocio_id,p_barbero_id,d.id,
    COALESCE((SELECT max(pg.fecha_hora) FROM public.pagos pg
      WHERE pg.venta_id=v.id AND pg.negocio_id=v_negocio AND pg.estado_pago='REGISTRADO'),v.fecha_hora),
    COALESCE(d.base_comision,d.subtotal,0),d.porcentaje_comision_aplicado,
    d.comision_generada,'LIQUIDADA',now(),v_liquidacion
  FROM public.detalle_ventas d
  JOIN public.ventas v ON v.id=d.venta_id AND v.negocio_id=d.negocio_id
  WHERE d.negocio_id=v_negocio AND v.barbero_id=p_barbero_id
    AND v.estado_venta='PAGADA' AND d.tipo_item='SERVICIO' AND d.comision_generada>0
    AND NOT EXISTS(SELECT 1 FROM public.comisiones c WHERE c.negocio_id=d.negocio_id AND c.detalle_id=d.id);

  -- Aplica anticipos antiguos en orden cronológico, sin volver a descontarlos.
  v_restante:=v_total_anticipos;
  FOR a IN
    SELECT m.id,m.valor,COALESCE((
      SELECT sum(ap.valor) FROM public.movimientos_liquidacion_barbero ap
      WHERE ap.movimiento_origen_id=m.id AND ap.tipo_movimiento='APLICACION_ANTICIPO'
    ),0) AS aplicado
    FROM public.movimientos_liquidacion_barbero m
    WHERE m.negocio_id=v_negocio AND m.barbero_id=p_barbero_id AND m.tipo_movimiento='ANTICIPO'
    ORDER BY m.fecha_hora
    FOR UPDATE OF m
  LOOP
    EXIT WHEN v_restante<=0;
    v_aplicar:=LEAST(v_restante,a.valor-a.aplicado);
    IF v_aplicar>0 THEN
      INSERT INTO public.movimientos_liquidacion_barbero(
        negocio_id,barbero_id,liquidacion_id,movimiento_origen_id,tipo_movimiento,valor,motivo,usuario_registro
      ) VALUES(v_negocio,p_barbero_id,v_liquidacion,a.id,'APLICACION_ANTICIPO',v_aplicar,
        'Aplicación de anticipo a liquidación diaria',auth.uid());
      v_restante:=v_restante-v_aplicar;
    END IF;
  END LOOP;

  FOR x IN
    SELECT * FROM jsonb_to_recordset(COALESCE(p_descuentos,'[]'::jsonb))
      AS d(valor numeric,motivo text)
  LOOP
    INSERT INTO public.movimientos_liquidacion_barbero(
      negocio_id,barbero_id,liquidacion_id,tipo_movimiento,valor,motivo,usuario_registro
    ) VALUES(v_negocio,p_barbero_id,v_liquidacion,'DESCUENTO',x.valor,trim(x.motivo),auth.uid());
  END LOOP;

  IF v_pago>0 THEN
    INSERT INTO public.gastos(negocio_id,categoria_gasto,descripcion,valor,metodo_pago,usuario_registro,caja_id)
    VALUES(v_negocio,'COMISIONES','Liquidación a '+v_nombre,p_pago_inicial,v_metodo,auth.uid(),v_caja)
    RETURNING id INTO v_gasto;

    INSERT INTO public.movimientos_liquidacion_barbero(
      negocio_id,barbero_id,liquidacion_id,tipo_movimiento,valor,metodo_pago,motivo,gasto_id,caja_id,usuario_registro
    ) VALUES(v_negocio,p_barbero_id,v_liquidacion,'ABONO',v_pago,v_metodo,'Pago inicial de liquidación',v_gasto,v_caja,auth.uid());
  END IF;

  UPDATE public.liquidaciones_barbero
  SET total_pagado=v_pago,
      saldo_pendiente=GREATEST(0,v_total_neto-v_pago),
      estado_liquidacion=CASE WHEN v_total_neto<=v_pago THEN 'PAGADA' WHEN v_pago>0 THEN 'PARCIAL' ELSE 'PENDIENTE' END
  WHERE id=v_liquidacion AND negocio_id=v_negocio;

  RETURN jsonb_build_object(
    'liquidacion_id',v_liquidacion,'barbero',v_nombre,'total_comisiones',v_total_comisiones,
    'total_descuentos',v_total_descuentos,'total_anticipos',v_total_anticipos,
    'total_neto',v_total_neto,'total_pagado',v_pago,'saldo_pendiente',GREATEST(0,v_total_neto-v_pago),
    'comisiones',v_cantidad
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.registrar_abono_liquidacion_barbero(
  p_liquidacion_id uuid,
  p_valor numeric,
  p_metodo_pago text DEFAULT 'EFECTIVO',
  p_motivo text DEFAULT 'Abono a liquidación'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_negocio uuid := public.mi_negocio();
  v_rol text := public.mi_rol();
  v_liquidacion public.liquidaciones_barbero%ROWTYPE;
  v_caja uuid;
  v_gasto uuid;
  v_movimiento uuid;
  v_metodo text := upper(trim(COALESCE(p_metodo_pago,'EFECTIVO')));
BEGIN
  IF auth.uid() IS NULL OR v_negocio IS NULL THEN RAISE EXCEPTION 'Sesión o negocio no válido.'; END IF;
  IF COALESCE(v_rol,'') NOT IN ('ADMINISTRADOR','SUPERVISOR') THEN RAISE EXCEPTION 'No tienes permisos para registrar abonos.'; END IF;
  IF p_valor IS NULL OR p_valor<=0 OR p_valor::text IN ('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'El abono debe ser mayor que cero.'; END IF;
  IF v_metodo NOT IN ('EFECTIVO','TRANSFERENCIA','TARJETA','NEQUI','DAVIPLATA') THEN RAISE EXCEPTION 'Método de pago no válido.'; END IF;

  SELECT * INTO v_liquidacion FROM public.liquidaciones_barbero
  WHERE id=p_liquidacion_id AND negocio_id=v_negocio FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'No se encontró la liquidación.'; END IF;
  IF v_liquidacion.estado_liquidacion IN ('PAGADA','ANULADA') OR p_valor>v_liquidacion.saldo_pendiente THEN
    RAISE EXCEPTION 'El abono supera el saldo pendiente o la liquidación ya está cerrada.';
  END IF;

  SELECT c.id INTO v_caja FROM public.cajas c
  WHERE c.negocio_id=v_negocio AND c.estado_caja='ABIERTA'
  ORDER BY c.fecha_apertura DESC LIMIT 1 FOR UPDATE;
  IF v_caja IS NULL THEN RAISE EXCEPTION 'Abre la caja antes de registrar un abono.'; END IF;

  INSERT INTO public.gastos(negocio_id,categoria_gasto,descripcion,valor,metodo_pago,usuario_registro,caja_id)
  VALUES(v_negocio,'COMISIONES','Abono a liquidación de barbero '+v_liquidacion.barbero_id::text,p_valor,v_metodo,auth.uid(),v_caja)
  RETURNING id INTO v_gasto;

  INSERT INTO public.movimientos_liquidacion_barbero(
    negocio_id,barbero_id,liquidacion_id,tipo_movimiento,valor,metodo_pago,motivo,gasto_id,caja_id,usuario_registro
  ) VALUES(v_negocio,v_liquidacion.barbero_id,p_liquidacion_id,'ABONO',p_valor,v_metodo,
    COALESCE(NULLIF(trim(COALESCE(p_motivo,'')),''),'Abono a liquidación'),v_gasto,v_caja,auth.uid())
  RETURNING id INTO v_movimiento;

  UPDATE public.liquidaciones_barbero
  SET total_pagado=total_pagado+p_valor,
      saldo_pendiente=GREATEST(0,saldo_pendiente-p_valor),
      estado_liquidacion=CASE WHEN saldo_pendiente-p_valor<=0 THEN 'PAGADA' ELSE 'PARCIAL' END
  WHERE id=p_liquidacion_id AND negocio_id=v_negocio;

  RETURN jsonb_build_object('liquidacion_id',p_liquidacion_id,'movimiento_id',v_movimiento,
    'total_pagado',v_liquidacion.total_pagado+p_valor,'saldo_pendiente',GREATEST(0,v_liquidacion.saldo_pendiente-p_valor));
END;
$function$;

REVOKE ALL ON FUNCTION public.forzar_comision_solo_venta_pagada() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sincronizar_comision_estado_venta() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.registrar_anticipo_barbero(uuid,numeric,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.liquidar_barbero(uuid,date,jsonb,numeric,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.registrar_abono_liquidacion_barbero(uuid,numeric,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_anticipo_barbero(uuid,numeric,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.liquidar_barbero(uuid,date,jsonb,numeric,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_abono_liquidacion_barbero(uuid,numeric,text,text) TO authenticated;
