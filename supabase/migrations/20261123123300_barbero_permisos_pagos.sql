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

