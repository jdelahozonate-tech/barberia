-- Las citas nacen confirmadas (reserva por link, agenda interna y cualquier otro origen).
alter table public.citas alter column estado set default 'CONFIRMADA';
-- Citas futuras que habían quedado pendientes pasan a confirmadas (no se borra nada; las pasadas no se tocan).
update public.citas set estado = 'CONFIRMADA' where estado = 'PENDIENTE' and inicio >= now();
