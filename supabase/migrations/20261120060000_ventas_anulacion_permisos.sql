-- Las funciones de control de caja solo deben poder invocarse desde sesiones autenticadas.
REVOKE ALL ON FUNCTION public.asignar_caja_venta() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.anular_venta(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.anular_venta(uuid) TO authenticated;
