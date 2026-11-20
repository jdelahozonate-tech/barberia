-- Bloquea en la base de datos cualquier nueva cita o reprogramación a una hora pasada.
CREATE OR REPLACE FUNCTION public.validar_cita_futura()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NEW.fin <= NEW.inicio THEN
    RAISE EXCEPTION 'La hora de finalización debe ser posterior al inicio de la cita.';
  END IF;

  IF NEW.estado IN ('PENDIENTE','CONFIRMADA')
     AND NEW.inicio <= clock_timestamp() THEN
    RAISE EXCEPTION 'No puedes agendar ni reprogramar una cita en una fecha u hora que ya pasó. Selecciona un horario futuro.';
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.validar_cita_futura() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_citas_bloquear_horarios_pasados ON public.citas;
CREATE TRIGGER trg_citas_bloquear_horarios_pasados
BEFORE INSERT OR UPDATE OF inicio, fin ON public.citas
FOR EACH ROW
EXECUTE FUNCTION public.validar_cita_futura();
