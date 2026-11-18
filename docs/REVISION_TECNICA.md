# Revisión técnica y pendientes de validación

**Estado:** revisión estática de código. Los puntos funcionales marcados abajo requieren validación manual en navegador y Supabase; no equivalen a fallos reproducidos.

## Correcciones de esta revisión

- Las páginas públicas muestran los errores devueltos por las RPC de catálogo y consulta de cita, en lugar de confundirlos con enlaces inválidos.
- La reserva pública descarta respuestas de disponibilidad obsoletas cuando el usuario cambia fecha, barbero o servicio rápidamente, y evita un segundo envío mientras la reserva está en curso.
- La gestión pública de citas evita solicitudes simultáneas de confirmación, cancelación o reprogramación y comprueba los errores de las RPC.
- El módulo de equipo informa errores de lectura de perfiles, horarios y barberos disponibles antes de mostrar formularios incompletos.
- Ventas valida todas las lecturas de clientes, barberos, servicios, productos y cuentas antes de abrir el formulario; también valida el detalle y los pagos al consultar una venta y evita doble envío.
- Catálogos e inventario validan las lecturas de existencias y referencias antes de mostrar opciones; se evita duplicar una entrada de inventario por doble clic.
- El acceso valida la sesión y el resultado de la RPC de suscripción antes de habilitar la aplicación.
- Inicio e informes comprueban los errores de todas sus consultas antes de calcular indicadores. No se muestran totales parciales como si fueran completos.
- El cobro de una cita valida la lectura para evitar duplicados y limita la búsqueda del servicio de cargo de cita al negocio activo.

## Correcciones adicionales

- Las consultas de caja, pagos, gastos y comisiones ahora incluyen el identificador del negocio activo, además de las políticas RLS; esto reduce el riesgo de mezclar registros si el usuario pertenece a más de un negocio.

- Ventas ahora limita las lecturas de catálogos, detalle y pagos al negocio activo; los pagos adicionales y la anulación evitan doble clic y llevan filtro de negocio.
- Catálogos, referencias y existencias se consultan por negocio; las actualizaciones y cambios de estado también incluyen el negocio activo.

## Riesgos y límites pendientes

1. **Liquidación de comisiones y gasto asociado:** el flujo inserta primero las liquidaciones y después el gasto. Si la segunda escritura falla, la comisión puede quedar liquidada sin el gasto correspondiente. Se informa el resultado parcial, pero la atomicidad requiere una transacción o RPC backend; no se modifica desde el frontend.
2. **Guardado de horarios:** se eliminan los horarios actuales y luego se insertan los nuevos en dos operaciones. Un fallo de inserción puede dejar el horario vacío. Requiere solución transaccional backend antes de cambiar el flujo.
3. **Guardado de ajustes:** negocio y servicio de reserva se guardan en operaciones separadas. El frontend ya informa el estado parcial; la atomicidad queda pendiente de una operación backend.
4. **Límites de lectura:** informes, comisiones y vistas de mis comisiones usan límites fijos (hasta 5.000, 1.000/5.000 y 500/2.000 filas respectivamente). En negocios con más registros podrían quedar resultados incompletos. Evaluar paginación o agregación backend con datos representativos.
5. **Registro de ventas:** la creación de venta, detalle y pagos son escrituras separadas. El frontend intenta borrar la cabecera si falla el detalle o el pago, pero esa compensación también puede fallar o no revertir relaciones si el backend no permite la operación. Se muestra el resultado del intento; la atomicidad requiere una RPC/transacción backend.
6. **Movimientos de inventario y stock:** el frontend registra entradas mediante `movimientos_inventario` y lee existencias desde `stock_actual`; la consistencia depende de triggers/vistas y RLS. Verificar que una entrada se refleje una sola vez en stock.
7. **Reglas de disponibilidad, permisos y unicidad:** dependen de RLS, RPC, restricciones y triggers de Supabase. La revisión estática no confirma concurrencia, aislamiento entre negocios ni integridad de las escrituras.

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
- [ ] Simular fallo al insertar detalle o pago después de crear la cabecera de venta; comprobar el resultado del intento de reversión y que no queden registros huérfanos.
- [ ] Registrar una entrada de inventario y comprobar que `stock_actual` se actualiza una sola vez.
- [ ] Simular error de sesión y de la RPC `mi_suscripcion`; confirmar que no se habilita la aplicación con estado desconocido.
- [ ] Simular fallo al insertar gasto después de liquidar comisión y comprobar el aviso de estado parcial.
- [ ] Simular fallo al insertar horarios después del borrado y comprobar el procedimiento de recuperación.
- [ ] Ejecutar los 12 flujos de `docs/PRUEBAS.md` en móvil y escritorio.

## Alcance

No se ejecutaron cambios SQL ni se alteraron tablas, RPC, RLS, triggers o reglas de negocio. No se integró la rama en `main`. La validación automatizada de CI no sustituye las pruebas manuales anteriores.

## Revisión de equipo, agenda y cierre de caja (18 nov 2026)

- Equipo: perfiles, barberos activos y horarios se consultan dentro del negocio activo; las escrituras de estado de perfil y borrado de horarios también quedan acotadas por negocio.
- Horarios e invitaciones: se bloquean envíos duplicados mientras una operación está en curso; ante error se permite reintentar. Antes de borrar el horario anterior, se validan tramos incompletos, rangos invertidos y días marcados sin horas. También se serializa el cambio de estado de perfiles.
- Agenda: las citas del día, citas por confirmar, catálogos de nueva cita, cambios de estado y comprobación de venta asociada quedan limitados al negocio activo.
- Caja: el formulario de cierre impide envíos simultáneos y permite reintentar si falla la actualización.
- Se añadieron pruebas de regresión estática para alcance por negocio y protección de doble envío.

**Límite pendiente:** el guardado de horarios sigue ejecutando borrado e inserción en dos operaciones. Se evita el doble envío y se limita el borrado al negocio, pero un fallo de inserción aún puede dejar el horario sin filas. La solución completa exige una RPC/transacción backend; no se altera Supabase desde esta revisión.
