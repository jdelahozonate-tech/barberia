-- Impide que una misma cita tenga más de una venta vigente.
-- Las ventas anuladas no bloquean un nuevo cobro legítimo de la cita.
CREATE UNIQUE INDEX IF NOT EXISTS ventas_negocio_cita_vigente_uidx
  ON public.ventas (negocio_id, cita_id)
  WHERE cita_id IS NOT NULL
    AND estado_venta <> 'ANULADA';

COMMENT ON INDEX public.ventas_negocio_cita_vigente_uidx IS
  'Una sola venta no anulada por cita y negocio; permite volver a cobrar tras anulación.';
