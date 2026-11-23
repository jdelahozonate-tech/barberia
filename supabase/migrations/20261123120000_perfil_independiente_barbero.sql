-- Acceso de BARBERO: espacio personal sin acceso a administración, inventario ni caja.
-- Se preserva el ciclo existente de cobros y liquidaciones: una venta de servicio
-- queda PENDIENTE y las funciones actuales generan comisión cuando pase a PAGADA.

-- Clientes: BARBERO puede crear y consultar para agendar, pero no editar ni eliminar.
DROP POLICY IF EXISTS escribir ON public.clientes;
DROP POLICY IF EXISTS clientes_insert_equipo ON public.clientes;
DROP POLICY IF EXISTS clientes_update_admin ON public.clientes;
DROP POLICY IF EXISTS clientes_delete_admin ON public.clientes;
CREATE POLICY clientes_insert_equipo ON public.clientes
  FOR INSERT TO authenticated
  WITH CHECK (
    negocio_id = public.mi_negocio()
    AND public.mi_rol() IN ('ADMINISTRADOR','SUPERVISOR','BARBERO')
  );
CREATE POLICY clientes_update_admin ON public.clientes
  FOR UPDATE TO authenticated
  USING (negocio_id = public.mi_negocio() AND public.mi_rol() IN ('ADMINISTRADOR','SUPERVISOR'))
  WITH CHECK (negocio_id = public.mi_negocio() AND public.mi_rol() IN ('ADMINISTRADOR','SUPERVISOR'));
CREATE POLICY clientes_delete_admin ON public.clientes
  FOR DELETE TO authenticated
  USING (negocio_id = public.mi_negocio() AND public.mi_rol() IN ('ADMINISTRADOR','SUPERVISOR'));

-- Barberos: administración ve el equipo; cada barbero solo ve su propia ficha.
DROP POLICY IF EXISTS leer ON public.barberos;
DROP POLICY IF EXISTS barberos_admin_select ON public.barberos;
CREATE POLICY barberos_admin_select ON public.barberos
  FOR SELECT TO authenticated
  USING (negocio_id = public.mi_negocio() AND public.mi_rol() IN ('ADMINISTRADOR','SUPERVISOR'));
-- Se conserva barberos_perfil_propio, que ya limita BARBERO a perfiles.barbero_id.

-- Citas: el barbero consulta y agenda únicamente para sí mismo.
DROP POLICY IF EXISTS escribir ON public.citas;
DROP POLICY IF EXISTS leer ON public.citas;
DROP POLICY IF EXISTS citas_admin_select ON public.citas;
DROP POLICY IF EXISTS citas_barbero_select ON public.citas;
DROP POLICY IF EXISTS citas_admin_insert ON public.citas;
DROP POLICY IF EXISTS citas_barbero_insert ON public.citas;
DROP POLICY IF EXISTS citas_admin_update ON public.citas;
DROP POLICY IF EXISTS citas_barbero_update ON public.citas;
DROP POLICY IF EXISTS citas_admin_delete ON public.citas;
CREATE POLICY citas_admin_select ON public.citas
  FOR SELECT TO authenticated
  USING (negocio_id = public.mi_negocio() AND public.mi_rol() IN ('ADMINISTRADOR','SUPERVISOR'));
CREATE POLICY citas_barbero_select ON public.citas
  FOR SELECT TO authenticated
  USING (
    negocio_id = public.mi_negocio()
    AND public.mi_rol() = 'BARBERO'
    AND barbero_id = (SELECT p.barbero_id FROM public.perfiles p WHERE p.id = auth.uid() AND p.negocio_id = public.mi_negocio())
  );
CREATE POLICY citas_admin_insert ON public.citas
  FOR INSERT TO authenticated
  WITH CHECK (negocio_id = public.mi_negocio() AND public.mi_rol() IN ('ADMINISTRADOR','SUPERVISOR'));
CREATE POLICY citas_barbero_insert ON public.citas
  FOR INSERT TO authenticated
  WITH CHECK (
    negocio_id = public.mi_negocio()
    AND public.mi_rol() = 'BARBERO'
    AND barbero_id = (SELECT p.barbero_id FROM public.perfiles p WHERE p.id = auth.uid() AND p.negocio_id = public.mi_negocio())
    AND creado_por = auth.uid()
  );
CREATE POLICY citas_admin_update ON public.citas
  FOR UPDATE TO authenticated
  USING (negocio_id = public.mi_negocio() AND public.mi_rol() IN ('ADMINISTRADOR','SUPERVISOR'))
  WITH CHECK (negocio_id = public.mi_negocio() AND public.mi_rol() IN ('ADMINISTRADOR','SUPERVISOR'));
CREATE POLICY citas_barbero_update ON public.citas
  FOR UPDATE TO authenticated
  USING (
    negocio_id = public.mi_negocio()
    AND public.mi_rol() = 'BARBERO'
    AND barbero_id = (SELECT p.barbero_id FROM public.perfiles p WHERE p.id = auth.uid() AND p.negocio_id = public.mi_negocio())
  )
  WITH CHECK (
    negocio_id = public.mi_negocio()
    AND public.mi_rol() = 'BARBERO'
    AND barbero_id = (SELECT p.barbero_id FROM public.perfiles p WHERE p.id = auth.uid() AND p.negocio_id = public.mi_negocio())
    AND estado = 'ATENDIDA'
  );
CREATE POLICY citas_admin_delete ON public.citas
  FOR DELETE TO authenticated
  USING (negocio_id = public.mi_negocio() AND public.mi_rol() IN ('ADMINISTRADOR','SUPERVISOR'));

CREATE OR REPLACE FUNCTION public.proteger_cita_barbero()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF public.mi_rol() = 'BARBERO' THEN
    IF OLD.barbero_id IS DISTINCT FROM (
      SELECT p.barbero_id FROM public.perfiles p
      WHERE p.id = auth.uid() AND p.negocio_id = public.mi_negocio()
    ) THEN
      RAISE EXCEPTION 'Solo puedes modificar tus propias citas.';
    END IF;
    IF NEW.negocio_id IS DISTINCT FROM OLD.negocio_id
      OR NEW.cliente_id IS DISTINCT FROM OLD.cliente_id
      OR NEW.barbero_id IS DISTINCT FROM OLD.barbero_id
      OR NEW.servicio_id IS DISTINCT FROM OLD.servicio_id
      OR NEW.inicio IS DISTINCT FROM OLD.inicio
      OR NEW.fin IS DISTINCT FROM OLD.fin
      OR NEW.origen IS DISTINCT FROM OLD.origen
      OR NEW.observaciones IS DISTINCT FROM OLD.observaciones
      OR NEW.creado_por IS DISTINCT FROM OLD.creado_por
      OR NEW.token IS DISTINCT FROM OLD.token
      OR NEW.creado_en IS DISTINCT FROM OLD.creado_en
      OR NEW.estado IS DISTINCT FROM 'ATENDIDA' THEN
      RAISE EXCEPTION 'Como barbero solo puedes marcar tu cita como atendida.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_proteger_cita_barbero ON public.citas;
CREATE TRIGGER trg_proteger_cita_barbero
  BEFORE UPDATE ON public.citas
  FOR EACH ROW EXECUTE FUNCTION public.proteger_cita_barbero();

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

-- Detalle: solo servicios propios para BARBERO; nunca productos.
DROP POLICY IF EXISTS escribir ON public.detalle_ventas;
DROP POLICY IF EXISTS leer ON public.detalle_ventas;
DROP POLICY IF EXISTS detalle_ventas_admin_select ON public.detalle_ventas;
DROP POLICY IF EXISTS detalle_ventas_barbero_select ON public.detalle_ventas;
DROP POLICY IF EXISTS detalle_ventas_admin_insert ON public.detalle_ventas;
DROP POLICY IF EXISTS detalle_ventas_barbero_insert ON public.detalle_ventas;
DROP POLICY IF EXISTS detalle_ventas_admin_update ON public.detalle_ventas;
DROP POLICY IF EXISTS detalle_ventas_admin_delete ON public.detalle_ventas;
CREATE POLICY detalle_ventas_admin_select ON public.detalle_ventas
  FOR SELECT TO authenticated
  USING (negocio_id = public.mi_negocio() AND public.mi_rol() IN ('ADMINISTRADOR','SUPERVISOR'));
CREATE POLICY detalle_ventas_barbero_select ON public.detalle_ventas
  FOR SELECT TO authenticated
  USING (
    negocio_id = public.mi_negocio()
    AND public.mi_rol() = 'BARBERO'
    AND EXISTS (
      SELECT 1 FROM public.ventas v
      WHERE v.id = detalle_ventas.venta_id
        AND v.negocio_id = detalle_ventas.negocio_id
        AND v.barbero_id = (SELECT p.barbero_id FROM public.perfiles p WHERE p.id = auth.uid() AND p.negocio_id = public.mi_negocio())
    )
  );
CREATE POLICY detalle_ventas_admin_insert ON public.detalle_ventas
  FOR INSERT TO authenticated
  WITH CHECK (negocio_id = public.mi_negocio() AND public.mi_rol() IN ('ADMINISTRADOR','SUPERVISOR'));
CREATE POLICY detalle_ventas_barbero_insert ON public.detalle_ventas
  FOR INSERT TO authenticated
  WITH CHECK (
    negocio_id = public.mi_negocio()
    AND public.mi_rol() = 'BARBERO'
    AND tipo_item = 'SERVICIO'
    AND servicio_id IS NOT NULL
    AND producto_id IS NULL
    AND EXISTS (
      SELECT 1 FROM public.ventas v
      WHERE v.id = detalle_ventas.venta_id
        AND v.negocio_id = detalle_ventas.negocio_id
        AND v.barbero_id = (SELECT p.barbero_id FROM public.perfiles p WHERE p.id = auth.uid() AND p.negocio_id = public.mi_negocio())
        AND v.creado_por = auth.uid()
        AND v.estado_venta = 'PENDIENTE'
        AND v.total_pagado = 0
    )
  );
CREATE POLICY detalle_ventas_admin_update ON public.detalle_ventas
  FOR UPDATE TO authenticated
  USING (negocio_id = public.mi_negocio() AND public.mi_rol() IN ('ADMINISTRADOR','SUPERVISOR'))
  WITH CHECK (negocio_id = public.mi_negocio() AND public.mi_rol() IN ('ADMINISTRADOR','SUPERVISOR'));
CREATE POLICY detalle_ventas_admin_delete ON public.detalle_ventas
  FOR DELETE TO authenticated
  USING (negocio_id = public.mi_negocio() AND public.mi_rol() IN ('ADMINISTRADOR','SUPERVISOR'));

-- Pagos: el barbero puede consultar pagos de sus cobros, pero solo caja/administración registra o modifica pagos.
DROP POLICY IF EXISTS escribir ON public.pagos;
DROP POLICY IF EXISTS leer ON public.pagos;
DROP POLICY IF EXISTS pagos_admin_select ON public.pagos;
DROP POLICY IF EXISTS pagos_barbero_select ON public.pagos;
DROP POLICY IF EXISTS pagos_admin_insert ON public.pagos;
DROP POLICY IF EXISTS pagos_admin_update ON public.pagos;
DROP POLICY IF EXISTS pagos_admin_delete ON public.pagos;
CREATE POLICY pagos_admin_select ON public.pagos
  FOR SELECT TO authenticated
  USING (negocio_id = public.mi_negocio() AND public.mi_rol() IN ('ADMINISTRADOR','SUPERVISOR'));
CREATE POLICY pagos_barbero_select ON public.pagos
  FOR SELECT TO authenticated
  USING (
    negocio_id = public.mi_negocio()
    AND public.mi_rol() = 'BARBERO'
    AND EXISTS (
      SELECT 1 FROM public.ventas v
      WHERE v.id = pagos.venta_id
        AND v.negocio_id = pagos.negocio_id
        AND v.barbero_id = (SELECT p.barbero_id FROM public.perfiles p WHERE p.id = auth.uid() AND p.negocio_id = public.mi_negocio())
    )
  );
CREATE POLICY pagos_admin_insert ON public.pagos
  FOR INSERT TO authenticated
  WITH CHECK (negocio_id = public.mi_negocio() AND public.mi_rol() IN ('ADMINISTRADOR','SUPERVISOR'));
CREATE POLICY pagos_admin_update ON public.pagos
  FOR UPDATE TO authenticated
  USING (negocio_id = public.mi_negocio() AND public.mi_rol() IN ('ADMINISTRADOR','SUPERVISOR'))
  WITH CHECK (negocio_id = public.mi_negocio() AND public.mi_rol() IN ('ADMINISTRADOR','SUPERVISOR'));
CREATE POLICY pagos_admin_delete ON public.pagos
  FOR DELETE TO authenticated
  USING (negocio_id = public.mi_negocio() AND public.mi_rol() IN ('ADMINISTRADOR','SUPERVISOR'));

-- Horarios y ausencias: un barbero solo consulta su propia disponibilidad.
DROP POLICY IF EXISTS leer ON public.horarios_barbero;
DROP POLICY IF EXISTS horarios_admin_select ON public.horarios_barbero;
DROP POLICY IF EXISTS horarios_barbero_select ON public.horarios_barbero;
CREATE POLICY horarios_admin_select ON public.horarios_barbero
  FOR SELECT TO authenticated
  USING (negocio_id = public.mi_negocio() AND public.mi_rol() IN ('ADMINISTRADOR','SUPERVISOR'));
CREATE POLICY horarios_barbero_select ON public.horarios_barbero
  FOR SELECT TO authenticated
  USING (
    negocio_id = public.mi_negocio()
    AND public.mi_rol() = 'BARBERO'
    AND barbero_id = (SELECT p.barbero_id FROM public.perfiles p WHERE p.id = auth.uid() AND p.negocio_id = public.mi_negocio())
  );
DROP POLICY IF EXISTS leer ON public.ausencias_barbero;
DROP POLICY IF EXISTS ausencias_admin_select ON public.ausencias_barbero;
DROP POLICY IF EXISTS ausencias_barbero_select ON public.ausencias_barbero;
CREATE POLICY ausencias_admin_select ON public.ausencias_barbero
  FOR SELECT TO authenticated
  USING (negocio_id = public.mi_negocio() AND public.mi_rol() IN ('ADMINISTRADOR','SUPERVISOR'));
CREATE POLICY ausencias_barbero_select ON public.ausencias_barbero
  FOR SELECT TO authenticated
  USING (
    negocio_id = public.mi_negocio()
    AND public.mi_rol() = 'BARBERO'
    AND barbero_id = (SELECT p.barbero_id FROM public.perfiles p WHERE p.id = auth.uid() AND p.negocio_id = public.mi_negocio())
  );

-- Datos de perfil y catálogo: no mostrar fichas de otros empleados ni productos al barbero.
DROP POLICY IF EXISTS ver_perfiles ON public.perfiles;
CREATE POLICY ver_perfiles ON public.perfiles
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR (negocio_id = public.mi_negocio() AND public.mi_rol() IN ('ADMINISTRADOR','SUPERVISOR'))
  );
DROP POLICY IF EXISTS leer ON public.productos;
CREATE POLICY leer ON public.productos
  FOR SELECT TO authenticated
  USING (negocio_id = public.mi_negocio() AND public.mi_rol() IN ('ADMINISTRADOR','SUPERVISOR'));
