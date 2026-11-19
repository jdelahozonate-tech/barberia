-- Exige asociar los pagos de compras en efectivo a una caja abierta.
-- Los pagos por otros medios pueden registrarse sin caja cuando corresponda.
CREATE OR REPLACE FUNCTION public.validar_caja_pago_compra_inventario()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
 IF NEW.metodo_pago = 'EFECTIVO' AND NEW.caja_id IS NULL THEN
  RAISE EXCEPTION 'Para registrar un pago en efectivo debes tener una caja abierta.';
 END IF;

 IF NEW.caja_id IS NOT NULL AND NOT EXISTS (
  SELECT 1
  FROM public.cajas c
  WHERE c.id = NEW.caja_id
    AND c.negocio_id = NEW.negocio_id
    AND c.estado_caja = 'ABIERTA'
 ) THEN
  RAISE EXCEPTION 'La caja asociada al pago no existe, pertenece a otro negocio o está cerrada.';
 END IF;

 RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_caja_pago_compra_inventario
 ON public.pagos_compras_inventario;

CREATE TRIGGER trg_validar_caja_pago_compra_inventario
BEFORE INSERT OR UPDATE OF metodo_pago, caja_id, negocio_id
ON public.pagos_compras_inventario
FOR EACH ROW
EXECUTE FUNCTION public.validar_caja_pago_compra_inventario();

REVOKE ALL ON FUNCTION public.validar_caja_pago_compra_inventario() FROM PUBLIC;
