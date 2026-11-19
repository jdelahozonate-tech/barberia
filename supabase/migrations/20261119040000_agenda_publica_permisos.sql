-- Endurece únicamente los permisos de ejecución de las funciones públicas de Agenda.
-- Conserva el acceso explícito que ya requieren los clientes públicos y autenticados.
REVOKE ALL ON FUNCTION public.cita_publica(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.horas_libres_publicas(text, date, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reprogramar_cita_publica(uuid, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reservar_cita_publica(text, text, text, uuid, uuid, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.responder_cita_publica(uuid, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.cita_publica(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.horas_libres_publicas(text, date, uuid, uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reprogramar_cita_publica(uuid, timestamptz) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reservar_cita_publica(text, text, text, uuid, uuid, timestamptz) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.responder_cita_publica(uuid, text) TO anon, authenticated, service_role;
