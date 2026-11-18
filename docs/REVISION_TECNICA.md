# Revisión técnica y pendientes de validación

**Estado:** revisión estática de código. Los puntos funcionales marcados abajo requieren validación manual en navegador y Supabase; no equivalen a fallos reproducidos.

## Correcciones de esta revisión

- Las páginas públicas muestran los errores devueltos por las RPC de catálogo y consulta de cita, en lugar de confundirlos con enlaces inválidos.
- La reserva pública descarta respuestas de disponibilidad obsoletas cuando el usuario cambia fecha, barbero o servicio rápidamente, y evita un segundo envío mientras la reserva está en curso.
- La gestión pública de citas evita solicitudes simultáneas de confirmación, cancelación o reprogramación y comprueba los errores de las RPC.
- El módulo de equipo informa errores de lectura de perfiles, horarios y barberos disponibles antes de mostrar formularios incompletos.
- Inicio e informes comprueban los errores de todas sus consultas antes de calcular indicadores. No se muestran totales parciales como si fueran completos.
- El cobro de una cita valida la lectura para evitar duplicados y limita la búsqueda del servicio de cargo de cita al negocio activo.

## Riesgos y límites pendientes

1. **Liquidación de comisiones y gasto asociado:** el flujo inserta primero las liquidaciones y después el gasto. Si la segunda escritura falla, la comisión puede quedar liquidada sin el gasto correspondiente. Se informa el resultado parcial, pero la atomicidad requiere una transacción o RPC backend; no se modifica desde el frontend.
2. **Guardado de horarios:** se eliminan los horarios actuales y luego se insertan los nuevos en dos operaciones. Un fallo de inserción puede dejar el horario vacío. Requiere solución transaccional backend antes de cambiar el flujo.
3. **Guardado de ajustes:** negocio y servicio de reserva se guardan en operaciones separadas. El frontend ya informa el estado parcial; la atomicidad queda pendiente de una operación backend.
4. **Límites de lectura:** informes, comisiones y vistas de mis comisiones usan límites fijos (hasta 5.000, 1.000/5.000 y 500/2.000 filas respectivamente). En negocios con más registros podrían quedar resultados incompletos. Evaluar paginación o agregación backend con datos representativos.
5. **Reglas de disponibilidad, permisos y unicidad:** dependen de RLS, RPC, restricciones y triggers de Supabase. La revisión estática no confirma concurrencia, aislamiento entre negocios ni integridad de las escrituras.

## Matriz de regresión manual

Ejecutar con un negocio y registros de prueba, no con datos reales:

- [ ] Abrir una reserva pública con slug válido, slug inválido y error de red/RPC.
- [ ] Cambiar rápidamente fecha, barbero y servicio; confirmar que solo se muestran horas de la última selección.
- [ ] Enviar una reserva y hacer doble clic; comprobar que se crea una sola cita.
- [ ] Abrir un enlace de cita válido, inválido y vencido; probar confirmar, cancelar y reprogramar.
- [ ] Intentar dos acciones simultáneas desde dos pestañas y verificar que el backend conserva la integridad.
- [ ] Consultar perfiles, horarios e invitaciones con permisos de administrador y supervisor; simular error de lectura.
- [ ] Probar inicio e informe con permisos distintos y con error en cada una de las consultas.
- [ ] Atender una cita y verificar que la venta asociada no se duplica y que el cargo de cita corresponde al negocio activo.
- [ ] Simular fallo al insertar gasto después de liquidar comisión y comprobar el aviso de estado parcial.
- [ ] Simular fallo al insertar horarios después del borrado y comprobar el procedimiento de recuperación.
- [ ] Ejecutar los 12 flujos de `docs/PRUEBAS.md` en móvil y escritorio.

## Alcance

No se ejecutaron cambios SQL ni se alteraron tablas, RPC, RLS, triggers o reglas de negocio. No se integró la rama en `main`. La validación automatizada de CI no sustituye las pruebas manuales anteriores.
