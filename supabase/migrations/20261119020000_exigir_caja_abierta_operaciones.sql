-- Impide registrar operaciones sin una caja abierta del mismo negocio.
-- Se valida en base de datos para cubrir llamadas directas y sesiones concurrentes.

CREATE OR REPLACE FUNCTION public.validar_caja_abierta_movimiento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
 IF NEW.negocio_id IS NULL OR NOT EXISTS (
  SELECT 1 FROM public.cajas c
  WHERE c.negocio_id = NEW.negocio_id
    AND c.estado_caja = 'ABIERTA'
 ) THEN
  RAISE EXCEPTION 'No puedes registrar este movimiento porque la caja está cerrada. Abre la caja primero.';
 END IF;
 RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.validar_caja_abierta_gasto()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
 IF NEW.negocio_id IS NULL OR NEW.caja_id IS NULL OR NOT EXISTS (
  SELECT 1 FROM public.cajas c
  WHERE c.id = NEW.caja_id
    AND c.negocio_id = NEW.negocio_id
    AND c.estado_caja = 'ABIERTA'
 ) THEN
  RAISE EXCEPTION 'Para registrar un gasto debes tener una caja abierta en este negocio.';
 END IF;
 RETURN NEW;
END;
$$;

-- Ventas nuevas y pagos posteriores de ventas.
DROP TRIGGER IF EXISTS trg_exigir_caja_venta ON public.ventas;
CREATE TRIGGER trg_exigir_caja_venta
BEFORE INSERT ON public.ventas
FOR EACH ROW EXECUTE FUNCTION public.validar_caja_abierta_movimiento();

DROP TRIGGER IF EXISTS trg_exigir_caja_pago_venta ON public.pagos;
CREATE TRIGGER trg_exigir_caja_pago_venta
BEFORE INSERT ON public.pagos
FOR EACH ROW EXECUTE FUNCTION public.validar_caja_abierta_movimiento();

-- Compras de inventario, incluso cuando se registran a crédito o por transferencia.
DROP TRIGGER IF EXISTS trg_exigir_caja_compra_inventario ON public.compras_inventario;
CREATE TRIGGER trg_exigir_caja_compra_inventario
BEFORE INSERT ON public.compras_inventario
FOR EACH ROW EXECUTE FUNCTION public.validar_caja_abierta_movimiento();

-- Gastos siempre vinculados a la caja abierta que los registra.
DROP TRIGGER IF EXISTS trg_exigir_caja_gasto ON public.gastos;
CREATE TRIGGER trg_exigir_caja_gasto
BEFORE INSERT OR UPDATE OF negocio_id, caja_id ON public.gastos
FOR EACH ROW EXECUTE FUNCTION public.validar_caja_abierta_gasto();

-- Todo abono a proveedor debe quedar vinculado a una caja abierta.
CREATE OR REPLACE FUNCTION public.validar_caja_pago_compra_inventario()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
 IF NEW.caja_id IS NULL OR NOT EXISTS (
  SELECT 1
  FROM public.cajas c
  WHERE c.id = NEW.caja_id
    AND c.negocio_id = NEW.negocio_id
    AND c.estado_caja = 'ABIERTA'
 ) THEN
  RAISE EXCEPTION 'Para registrar un pago a proveedor debes tener una caja abierta en este negocio.';
 END IF;
 RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_caja_pago_compra_inventario
 ON public.pagos_compras_inventario;
CREATE TRIGGER trg_validar_caja_pago_compra_inventario
BEFORE INSERT OR UPDATE OF metodo_pago, caja_id, negocio_id
ON public.pagos_compras_inventario
FOR EACH ROW EXECUTE FUNCTION public.validar_caja_pago_compra_inventario();

REVOKE ALL ON FUNCTION public.validar_caja_abierta_movimiento() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.validar_caja_abierta_gasto() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.validar_caja_pago_compra_inventario() FROM PUBLIC;
