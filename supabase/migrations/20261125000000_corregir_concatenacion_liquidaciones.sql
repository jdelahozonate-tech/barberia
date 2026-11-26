-- En PostgreSQL el texto se concatena con || (no con +). Con + fallaba al pagar liquidaciones, anticipos y abonos.
do $$
declare f record; d text;
begin
  for f in
    select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in ('liquidar_barbero','registrar_abono_liquidacion_barbero','registrar_anticipo_barbero')
  loop
    d := pg_get_functiondef(f.oid);
    d := replace(d, '''Liquidación a ''+v_nombre', '''Liquidación a ''||v_nombre');
    d := replace(d, '''Anticipo a ''+v_nombre+'': ''+trim(p_motivo)', '''Anticipo a ''||v_nombre||'': ''||trim(p_motivo)');
    d := replace(d, '''Abono a liquidación de barbero ''+v_liquidacion.barbero_id::text', '''Abono a liquidación de barbero ''||v_liquidacion.barbero_id::text');
    execute d;
  end loop;
end $$;
