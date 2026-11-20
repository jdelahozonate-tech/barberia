-- Corrige comisiones históricas que permanecían en ventas anuladas o no pagadas.
UPDATE public.detalle_ventas d
SET comision_generada = 0
FROM public.ventas v
WHERE v.id = d.venta_id
  AND v.negocio_id = d.negocio_id
  AND v.estado_venta <> 'PAGADA'
  AND d.tipo_item = 'SERVICIO'
  AND d.base_comision IS NOT NULL
  AND d.porcentaje_comision_aplicado IS NOT NULL
  AND d.comision_generada > 0;
