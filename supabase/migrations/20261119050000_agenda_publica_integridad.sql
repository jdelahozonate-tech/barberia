-- Corrige la disponibilidad y serializa las operaciones del enlace privado de Agenda.
-- No elimina ni modifica las restricciones de exclusión de citas.

CREATE OR REPLACE FUNCTION public.horas_libres_publicas(
  p_slug text, p_dia date, p_barbero uuid, p_servicio uuid
)
RETURNS TABLE(inicio timestamptz)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  n uuid;
  z text;
  dur int;
  h record;
  t timestamptz;
  bi timestamptz;
  bf timestamptz;
  d interval;
BEGIN
  SELECT id, zona_horaria INTO n, z
  FROM public.negocios
  WHERE slug = lower(p_slug)
    AND estado = 'ACTIVO'
    AND reserva_publica;

  IF n IS NULL OR p_dia IS NULL OR p_barbero IS NULL OR p_servicio IS NULL THEN
    RETURN;
  END IF;

  SELECT duracion_minutos INTO dur
  FROM public.servicios
  WHERE id = p_servicio
    AND negocio_id = n
    AND estado = 'ACTIVO'
    AND categoria IS DISTINCT FROM 'CITA';

  IF dur IS NULL OR dur <= 0 THEN RETURN; END IF;

  PERFORM 1
  FROM public.barberos
  WHERE id = p_barbero
    AND negocio_id = n
    AND estado = 'ACTIVO'
    AND acepta_citas;

  IF NOT FOUND THEN RETURN; END IF;

  d := make_interval(mins => dur);

  FOR h IN
    SELECT hora_inicio, hora_fin
    FROM public.horarios_barbero
    WHERE negocio_id = n
      AND barbero_id = p_barbero
      AND dia_semana = extract(dow FROM p_dia)::int
    ORDER BY hora_inicio
  LOOP
    bi := (p_dia + h.hora_inicio) AT TIME ZONE z;
    bf := (p_dia + h.hora_fin) AT TIME ZONE z;

    FOR t IN
      SELECT DISTINCT x.candidato
      FROM (
        SELECT generate_series(bi, bf - d, d) AS candidato
        UNION
        SELECT ci.fin AS candidato
        FROM public.citas ci
        WHERE ci.negocio_id = n
          AND ci.barbero_id = p_barbero
          AND ci.estado IN ('PENDIENTE', 'CONFIRMADA')
          AND ci.fin >= bi
          AND ci.fin + d <= bf
      ) x
      WHERE x.candidato + d <= bf
      ORDER BY x.candidato
    LOOP
      IF t > now()
        AND NOT EXISTS (
          SELECT 1
          FROM public.citas ci
          WHERE ci.negocio_id = n
            AND ci.barbero_id = p_barbero
            AND ci.estado IN ('PENDIENTE', 'CONFIRMADA')
            AND tstzrange(ci.inicio, ci.fin) && tstzrange(t, t + d)
        )
        AND NOT EXISTS (
          SELECT 1
          FROM public.ausencias_barbero a
          WHERE a.negocio_id = n
            AND a.barbero_id = p_barbero
            AND a.desde < t + d
            AND a.hasta > t
        )
      THEN
        inicio := t;
        RETURN NEXT;
      END IF;
    END LOOP;
  END LOOP;
END;
$function$;

CREATE OR REPLACE FUNCTION public.reprogramar_cita_publica(
  p_token uuid, p_inicio timestamptz
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  c public.citas%rowtype;
  z text;
  dur int;
  l timestamp;
  lf timestamp;
BEGIN
  -- Bloquea la cita para impedir carreras con confirmar/cancelar/reprogramar.
  SELECT * INTO c
  FROM public.citas
  WHERE token = p_token
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Cita no encontrada'; END IF;
  IF c.estado NOT IN ('PENDIENTE', 'CONFIRMADA') THEN
    RAISE EXCEPTION 'Esta cita ya no se puede modificar';
  END IF;
  IF c.inicio < now() THEN RAISE EXCEPTION 'La hora de esta cita ya pasó'; END IF;
  IF p_inicio IS NULL OR p_inicio < now() THEN
    RAISE EXCEPTION 'La nueva hora no es válida o ya pasó';
  END IF;

  SELECT zona_horaria INTO z
  FROM public.negocios
  WHERE id = c.negocio_id;

  IF NOT FOUND OR z IS NULL OR z = '' THEN
    RAISE EXCEPTION 'No se pudo determinar la zona horaria del negocio';
  END IF;

  SELECT duracion_minutos INTO dur
  FROM public.servicios
  WHERE id = c.servicio_id
    AND negocio_id = c.negocio_id
    AND estado = 'ACTIVO'
    AND categoria IS DISTINCT FROM 'CITA';

  IF dur IS NULL OR dur <= 0 THEN
    RAISE EXCEPTION 'El servicio ya no está disponible para reservas';
  END IF;

  PERFORM 1
  FROM public.barberos
  WHERE id = c.barbero_id
    AND negocio_id = c.negocio_id
    AND estado = 'ACTIVO'
    AND acepta_citas;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El barbero ya no está disponible para reservas';
  END IF;

  l := p_inicio AT TIME ZONE z;
  lf := (p_inicio + make_interval(mins => dur)) AT TIME ZONE z;

  IF l::date <> lf::date THEN
    RAISE EXCEPTION 'La cita debe terminar dentro del mismo día de atención';
  END IF;

  PERFORM 1
  FROM public.horarios_barbero h
  WHERE h.negocio_id = c.negocio_id
    AND h.barbero_id = c.barbero_id
    AND h.dia_semana = extract(dow FROM l)::int
    AND h.hora_inicio <= l::time
    AND h.hora_fin >= lf::time;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El barbero no atiende a esa hora';
  END IF;

  PERFORM 1
  FROM public.ausencias_barbero a
  WHERE a.negocio_id = c.negocio_id
    AND a.barbero_id = c.barbero_id
    AND a.desde < p_inicio + make_interval(mins => dur)
    AND a.hasta > p_inicio;

  IF FOUND THEN RAISE EXCEPTION 'El barbero no está disponible'; END IF;

  -- No se asigna estado: PENDIENTE sigue PENDIENTE y CONFIRMADA sigue CONFIRMADA.
  UPDATE public.citas
  SET inicio = p_inicio,
      fin = p_inicio + make_interval(mins => dur)
  WHERE id = c.id
    AND negocio_id = c.negocio_id;
EXCEPTION
  WHEN exclusion_violation THEN
    RAISE EXCEPTION 'Ese horario ya fue tomado, elige otro';
END;
$function$;

CREATE OR REPLACE FUNCTION public.responder_cita_publica(
  p_token uuid, p_accion text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  c public.citas%rowtype;
BEGIN
  IF p_accion NOT IN ('confirmar', 'cancelar') OR p_accion IS NULL THEN
    RAISE EXCEPTION 'Acción inválida';
  END IF;

  -- El mismo bloqueo serializa esta operación frente a reprogramaciones.
  SELECT * INTO c
  FROM public.citas
  WHERE token = p_token
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Cita no encontrada'; END IF;
  IF c.estado NOT IN ('PENDIENTE', 'CONFIRMADA') THEN
    RAISE EXCEPTION 'Esta cita ya no se puede modificar';
  END IF;
  IF c.inicio < now() THEN RAISE EXCEPTION 'La hora de esta cita ya pasó'; END IF;

  IF p_accion = 'confirmar' THEN
    UPDATE public.citas
    SET estado = 'CONFIRMADA'
    WHERE id = c.id AND negocio_id = c.negocio_id;
  ELSE
    UPDATE public.citas
    SET estado = 'CANCELADA'
    WHERE id = c.id AND negocio_id = c.negocio_id;
  END IF;

  RETURN p_accion;
END;
$function$;
