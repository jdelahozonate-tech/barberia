-- Ventas: BARBERO solo registra cobros pendientes de servicios propios.
DROP POLICY IF EXISTS escribir ON public.ventas;
DROP POLICY IF EXISTS leer ON public.ventas;
DROP POLICY IF EXISTS ventas_admin_select ON public.ventas;
DROP POLICY IF EXISTS ventas_barbero_select ON public.ventas;
DROP POLICY IF EXISTS ventas_admin_insert ON public.ventas;
DROP POLICY IF EXISTS ventas_barbero_insert ON public.ventas;
DROP POLICY IF EXISTS ventas_admin_update ON public.ventas;
DROP POLICY IF EXISTS ventas_barbero_recalculo ON public.ventas;
DROP POLICY IF EXISTS ventas_admin_delete ON public.ventas;
DROP POLICY IF EXISTS ventas_barbero_rollback ON public.ventas;
CREATE POLICY ventas_admin_select ON public.ventas
  FOR SELECT TO authenticated
  USING (negocio_id = public.mi_negocio() AND public.mi_rol() IN ('ADMINISTRADOR','SUPERVISOR'));
CREATE POLICY ventas_barbero_select ON public.ventas
  FOR SELECT TO authenticated
  USING (
    negocio_id = public.mi_negocio()
    AND public.mi_rol() = 'BARBERO'
    AND barbero_id = (SELECT p.barbero_id FROM public.perfiles p WHERE p.id = auth.uid() AND p.negocio_id = public.mi_negocio())
  );
CREATE POLICY ventas_admin_insert ON public.ventas
  FOR INSERT TO authenticated
  WITH CHECK (negocio_id = public.mi_negocio() AND public.mi_rol() IN ('ADMINISTRADOR','SUPERVISOR'));
CREATE POLICY ventas_barbero_insert ON public.ventas
  FOR INSERT TO authenticated
  WITH CHECK (
    negocio_id = public.mi_negocio()
    AND public.mi_rol() = 'BARBERO'
    AND barbero_id = (SELECT p.barbero_id FROM public.perfiles p WHERE p.id = auth.uid() AND p.negocio_id = public.mi_negocio())
    AND creado_por = auth.uid()
    AND estado_venta = 'PENDIENTE'
    AND total_pagado = 0
  );
CREATE POLICY ventas_admin_update ON public.ventas
  FOR UPDATE TO authenticated
  USING (negocio_id = public.mi_negocio() AND public.mi_rol() IN ('ADMINISTRADOR','SUPERVISOR'))
  WITH CHECK (negocio_id = public.mi_negocio() AND public.mi_rol() IN ('ADMINISTRADOR','SUPERVISOR'));
-- Este UPDATE es necesario para que el trigger actual recalcule total_bruto al insertar detalle.
CREATE POLICY ventas_barbero_recalculo ON public.ventas
  FOR UPDATE TO authenticated
  USING (
    negocio_id = public.mi_negocio()
    AND public.mi_rol() = 'BARBERO'
    AND barbero_id = (SELECT p.barbero_id FROM public.perfiles p WHERE p.id = auth.uid() AND p.negocio_id = public.mi_negocio())
    AND creado_por = auth.uid()
    AND estado_venta = 'PENDIENTE'
    AND total_pagado = 0
  )
  WITH CHECK (
    negocio_id = public.mi_negocio()
    AND public.mi_rol() = 'BARBERO'
    AND barbero_id = (SELECT p.barbero_id FROM public.perfiles p WHERE p.id = auth.uid() AND p.negocio_id = public.mi_negocio())
    AND creado_por = auth.uid()
    AND estado_venta = 'PENDIENTE'
    AND total_pagado = 0
  );
CREATE POLICY ventas_admin_delete ON public.ventas
  FOR DELETE TO authenticated
  USING (negocio_id = public.mi_negocio() AND public.mi_rol() IN ('ADMINISTRADOR','SUPERVISOR'));
CREATE POLICY ventas_barbero_rollback ON public.ventas
  FOR DELETE TO authenticated
  USING (
    negocio_id = public.mi_negocio()
    AND public.mi_rol() = 'BARBERO'
    AND barbero_id = (SELECT p.barbero_id FROM public.perfiles p WHERE p.id = auth.uid() AND p.negocio_id = public.mi_negocio())
    AND creado_por = auth.uid()
    AND estado_venta = 'PENDIENTE'
    AND total_pagado = 0
    AND NOT EXISTS (SELECT 1 FROM public.detalle_ventas d WHERE d.venta_id = ventas.id AND d.negocio_id = ventas.negocio_id)
    AND NOT EXISTS (SELECT 1 FROM public.pagos pg WHERE pg.venta_id = ventas.id AND pg.negocio_id = ventas.negocio_id)
  );

CREATE OR REPLACE FUNCTION public.proteger_venta_barbero()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF public.mi_rol() = 'BARBERO' THEN
    IF OLD.barbero_id IS DISTINCT FROM (
      SELECT p.barbero_id FROM public.perfiles p
      WHERE p.id = auth.uid() AND p.negocio_id = public.mi_negocio()
    ) OR OLD.creado_por IS DISTINCT FROM auth.uid()
      OR OLD.estado_venta <> 'PENDIENTE'
      OR OLD.total_pagado <> 0 THEN
      RAISE EXCEPTION 'Solo puedes registrar cobros pendientes de tus propios servicios.';
    END IF;
    IF NEW.negocio_id IS DISTINCT FROM OLD.negocio_id
      OR NEW.cliente_id IS DISTINCT FROM OLD.cliente_id
      OR NEW.barbero_id IS DISTINCT FROM OLD.barbero_id
      OR NEW.cita_id IS DISTINCT FROM OLD.cita_id
      OR NEW.fecha_hora IS DISTINCT FROM OLD.fecha_hora
      OR NEW.descuento IS DISTINCT FROM OLD.descuento
      OR (NEW.total_bruto IS DISTINCT FROM OLD.total_bruto AND pg_trigger_depth() <= 1)
      OR NEW.total_pagado IS DISTINCT FROM OLD.total_pagado
      OR NEW.metodo_pago_principal IS DISTINCT FROM OLD.metodo_pago_principal
      OR NEW.estado_venta IS DISTINCT FROM OLD.estado_venta
      OR NEW.creado_por IS DISTINCT FROM OLD.creado_por
      OR NEW.caja_id IS DISTINCT FROM OLD.caja_id THEN
      RAISE EXCEPTION 'El barbero no puede modificar los datos del cobro después de registrarlo.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_proteger_venta_barbero ON public.ventas;
CREATE TRIGGER trg_proteger_venta_barbero
  BEFORE UPDATE ON public.ventas
  FOR EACH ROW EXECUTE FUNCTION public.proteger_venta_barbero();

