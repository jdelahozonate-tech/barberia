-- Refuerza la regla para servicios históricos que no tenían desglose de base y porcentaje.
CREATE OR REPLACE FUNCTION public.forzar_comision_solo_venta_pagada()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_estado text;
BEGIN
  IF NEW.tipo_item = 'SERVICIO' THEN
    SELECT v.estado_venta INTO v_estado
    FROM public.ventas v
    WHERE v.id = NEW.venta_id AND v.negocio_id = NEW.negocio_id;

    IF v_estado IS DISTINCT FROM 'PAGADA' THEN
      NEW.comision_generada := 0;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sincronizar_comision_estado_venta()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NEW.estado_venta IS DISTINCT FROM OLD.estado_venta THEN
    UPDATE public.detalle_ventas d
    SET comision_generada = CASE
      WHEN NEW.estado_venta = 'PAGADA'
        AND d.base_comision IS NOT NULL
        AND d.porcentaje_comision_aplicado IS NOT NULL
        THEN ROUND(d.base_comision * d.porcentaje_comision_aplicado / 100, 2)
      WHEN NEW.estado_venta <> 'PAGADA'
        THEN 0
      ELSE d.comision_generada
    END
    WHERE d.venta_id = NEW.id
      AND d.negocio_id = NEW.negocio_id
      AND d.tipo_item = 'SERVICIO'
      AND (
        (NEW.estado_venta <> 'PAGADA' AND d.comision_generada > 0)
        OR (NEW.estado_venta = 'PAGADA'
          AND d.base_comision IS NOT NULL
          AND d.porcentaje_comision_aplicado IS NOT NULL
          AND d.comision_generada IS DISTINCT FROM ROUND(d.base_comision * d.porcentaje_comision_aplicado / 100, 2))
      );
  END IF;
  RETURN NEW;
END;
$function$;

-- Limpia también comisiones de servicios antiguos que no tenían los nuevos campos base/porcentaje.
UPDATE public.detalle_ventas d
SET comision_generada = 0
FROM public.ventas v
WHERE v.id = d.venta_id
  AND v.negocio_id = d.negocio_id
  AND v.estado_venta <> 'PAGADA'
  AND d.tipo_item = 'SERVICIO'
  AND d.comision_generada > 0;

REVOKE ALL ON FUNCTION public.forzar_comision_solo_venta_pagada() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sincronizar_comision_estado_venta() FROM PUBLIC, anon, authenticated;
