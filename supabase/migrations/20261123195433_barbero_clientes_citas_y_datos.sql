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
