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

