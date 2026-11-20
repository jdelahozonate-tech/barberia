-- Asocia cada venta al turno de caja en el que fue creada y limita su anulación a ese turno abierto.
ALTER TABLE public.ventas
  ADD COLUMN IF NOT EXISTS caja_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ventas_caja_id_fkey'
      AND conrelid = 'public.ventas'::regclass
  ) THEN
    ALTER TABLE public.ventas
      ADD CONSTRAINT ventas_caja_id_fkey
      FOREIGN KEY (caja_id) REFERENCES public.cajas(id) ON DELETE RESTRICT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS ventas_negocio_caja_fecha_idx
  ON public.ventas (negocio_id, caja_id, fecha_hora);

-- Solo se asignan ventas históricas cuando su fecha pertenece a una única caja.
WITH coincidencias AS (
  SELECT v.id, (array_agg(c.id))[1] AS caja_id, count(*) AS cantidad
  FROM public.ventas v
  JOIN public.cajas c
    ON c.negocio_id = v.negocio_id
   AND v.fecha_hora >= c.fecha_apertura
   AND v.fecha_hora <= COALESCE(c.fecha_cierre, now())
  WHERE v.caja_id IS NULL
  GROUP BY v.id
  HAVING count(*) = 1
)
UPDATE public.ventas v
SET caja_id = x.caja_id
FROM coincidencias x
WHERE v.id = x.id;

CREATE OR REPLACE FUNCTION public.asignar_caja_venta()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_caja uuid;
  v_inicio timestamptz;
BEGIN
  IF auth.uid() IS NULL OR NEW.negocio_id IS DISTINCT FROM public.mi_negocio() THEN
    RAISE EXCEPTION 'Sesión o negocio no válido para registrar la venta.';
  END IF;

  SELECT c.id, c.fecha_apertura INTO v_caja, v_inicio
  FROM public.cajas c
  WHERE c.negocio_id = NEW.negocio_id
    AND c.estado_caja = 'ABIERTA'
  ORDER BY c.fecha_apertura DESC
  LIMIT 1
  FOR UPDATE;

  IF v_caja IS NULL THEN
    RAISE EXCEPTION 'Para registrar una venta debes tener una caja abierta.';
  END IF;

  IF NEW.fecha_hora < v_inicio OR NEW.fecha_hora > now() THEN
    RAISE EXCEPTION 'La fecha de la venta debe estar dentro del turno de caja abierto.';
  END IF;

  NEW.caja_id := v_caja;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.asignar_caja_venta() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_asignar_caja_venta ON public.ventas;
CREATE TRIGGER trg_asignar_caja_venta
BEFORE INSERT ON public.ventas
FOR EACH ROW
EXECUTE FUNCTION public.asignar_caja_venta();

CREATE OR REPLACE FUNCTION public.anular_venta(p_venta_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_negocio uuid := public.mi_negocio();
  v_rol text := public.mi_rol();
  v_estado text;
  v_caja_venta uuid;
  v_fecha_venta timestamptz;
  v_caja_actual uuid;
  v_inicio_caja timestamptz;
  v_fin_caja timestamptz;
BEGIN
  IF auth.uid() IS NULL OR v_negocio IS NULL THEN
    RAISE EXCEPTION 'Sesión o negocio no válido.';
  END IF;
  IF COALESCE(v_rol, '') NOT IN ('ADMINISTRADOR', 'SUPERVISOR') THEN
    RAISE EXCEPTION 'No tienes permisos para anular ventas.';
  END IF;

  -- Bloquea primero la caja abierta para serializar anulaciones con el cierre del turno.
  SELECT c.id, c.fecha_apertura, c.fecha_cierre
    INTO v_caja_actual, v_inicio_caja, v_fin_caja
  FROM public.cajas c
  WHERE c.negocio_id = v_negocio
    AND c.estado_caja = 'ABIERTA'
  ORDER BY c.fecha_apertura DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No puedes anular ventas sin una caja abierta.';
  END IF;

  SELECT v.estado_venta, v.caja_id, v.fecha_hora
    INTO v_estado, v_caja_venta, v_fecha_venta
  FROM public.ventas v
  WHERE v.id = p_venta_id
    AND v.negocio_id = v_negocio
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No se encontró la venta en este negocio.';
  END IF;
  IF v_estado = 'ANULADA' THEN
    RAISE EXCEPTION 'La venta ya está anulada.';
  END IF;

  IF v_caja_venta IS NULL THEN
    RAISE EXCEPTION 'No se puede anular: esta venta histórica no tiene una caja asociada verificable.';
  END IF;

  IF v_caja_venta <> v_caja_actual
     OR v_fecha_venta < v_inicio_caja
     OR (v_fin_caja IS NOT NULL AND v_fecha_venta > v_fin_caja) THEN
    RAISE EXCEPTION 'No se puede anular: la venta pertenece a una caja cerrada o a otro turno.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.detalle_ventas d
    JOIN public.comisiones c
      ON c.detalle_id = d.id
     AND c.negocio_id = v_negocio
    WHERE d.venta_id = p_venta_id
      AND d.negocio_id = v_negocio
  ) THEN
    RAISE EXCEPTION 'No se puede anular: esta venta tiene comisiones liquidadas vinculadas a sus detalles.';
  END IF;

  UPDATE public.ventas
  SET estado_venta = 'ANULADA'
  WHERE id = p_venta_id
    AND negocio_id = v_negocio;
  -- El trigger trg_devolver_inventario conserva la devolución de existencias.
END;
$function$;
