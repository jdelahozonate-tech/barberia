# Pruebas y validación

## Pruebas automáticas

El proyecto usa el ejecutor de pruebas integrado de Node.js; no necesita instalar dependencias externas.

Requisitos: Node.js 20 o superior.

```bash
npm test
```

La suite cubre:

- Escape de contenido HTML.
- Formato de fecha, etiquetas, slug y normalización de teléfonos.
- Traducción de errores frecuentes.
- Sintaxis de los módulos JavaScript.
- Sintaxis de los scripts de las cuatro páginas.
- Existencia de importaciones locales.
- Inclusión de los módulos de la aplicación privada en la precarga del Service Worker.
- Aplicación efectiva del filtro de datos del barbero en el módulo de ventas.

GitHub Actions ejecuta estas pruebas al enviar cambios a `main` o a `refactor/arquitectura-modular`, y en pull requests dirigidos a `main`.

## Pruebas manuales obligatorias antes de integrar

Las pruebas automáticas no sustituyen una ejecución real con Supabase y navegador. Verificar en un entorno de prueba:

1. Iniciar sesión, cerrar sesión y recuperar sesión al recargar.
2. Crear un negocio y completar onboarding mediante invitación.
3. Verificar restricciones de menú por rol (administrador, supervisor y barbero).
4. Crear, editar, desactivar y reactivar clientes, barberos, servicios y productos.
5. Guardar horarios de un barbero y comprobar disponibilidad.
6. Crear, confirmar, atender y cancelar citas; revisar recordatorios de WhatsApp.
7. Registrar una venta con uno o varios medios de pago, abonar un saldo y anular una venta.
8. Abrir caja, registrar gastos, liquidar comisiones y cerrar caja.
9. Verificar indicadores e informe gerencial con distintos periodos.
10. Probar reserva pública y enlace de gestión de cita en una ventana privada.
11. Instalar la PWA, actualizarla y comprobar su comportamiento sin conexión.
12. Confirmar que la experiencia sigue funcionando en móvil y escritorio.
13. Probar errores de lectura en inicio, informes, equipo, caja y comisiones; la interfaz no debe presentar resultados parciales como completos.
14. Probar doble envío de reserva pública y acciones simultáneas de confirmar, cancelar y reprogramar una cita.
15. Probar cambios rápidos de fecha, barbero y servicio en la reserva pública; solo deben mostrarse horas de la última selección.

La matriz ampliada y los riesgos que requieren validación manual están en `docs/REVISION_TECNICA.md`.

No se deben probar escrituras destructivas sobre datos reales. Usar un negocio y registros de prueba.

## Cambios de ventas: edición y anulación

Antes de habilitar estas opciones en producción, aplicar el SQL de
`supabase/migrations/20261118000000_editar_anular_ventas.sql` desde el
SQL Editor del proyecto Supabase. La migración crea dos RPC protegidas por
rol y negocio; no modifica ventas existentes al instalarse.

Validar con ventas de prueba y productos con control de stock:

1. Editar cliente, barbero, servicios, productos, cantidades, precios y descuento.
2. Confirmar que el total bruto, total de venta y saldo se recalculan mediante las columnas generadas y triggers existentes.
3. Confirmar que todos los pagos anteriores siguen registrados y que no se permite un nuevo total inferior a lo ya pagado.
4. Editar una venta con productos y comprobar que el inventario refleja únicamente los nuevos detalles, incluso al editar la misma venta más de una vez.
5. Confirmar que una venta con comisión liquidada no se puede editar y que su historial permanece intacto.
6. Confirmar que una venta anulada no se puede editar ni anular por segunda vez.
7. Anular una venta con productos y verificar que el trigger devuelve las existencias una sola vez.
8. Intentar ejecutar ambas RPC como BARBERO y con una venta de otro negocio; ambas operaciones deben rechazarse.
9. Confirmar que la edición y anulación no eliminan pagos ni registros históricos.
10. Repetir los flujos con ADMINISTRADOR y SUPERVISOR.

No ejecutar estas pruebas destructivas sobre ventas reales. Usar registros de prueba.

## Criterio de salida

La rama solo debe integrarse cuando:

- La suite de GitHub Actions esté verde.
- Los flujos manuales anteriores estén revisados.
- Las rutas públicas y la PWA se hayan probado.
- El diff final se haya revisado y no incluya cambios no relacionados.


## Productos, proveedores y compras de inventario

Antes de habilitar la nueva pantalla, aplicar en Supabase SQL Editor la migración
`supabase/migrations/20261119000000_compras_proveedores_inventario.sql`. La migración crea tablas nuevas para proveedores, compras, detalle y pagos; agrega `compra_id` a movimientos de inventario y `caja_id` a pagos de compras. No altera productos, ventas, pagos de clientes ni movimientos existentes.

Pruebas funcionales con datos de prueba:

1. Crear, editar, desactivar y reactivar un proveedor.
2. Crear y editar un producto; comprobar costo, precio, control de stock y stock mínimo.
3. Registrar una compra con varios productos, cantidades y costos distintos, número de factura y fecha de vencimiento.
4. Confirmar que se crea una compra, sus detalles y movimientos `ENTRADA` relacionados por `compra_id`.
5. Confirmar que `stock_actual` aumenta una sola vez y que el costo de referencia se actualiza por promedio ponderado.
6. Registrar compra pagada, compra a crédito y compra con abono parcial; comprobar total, pagado y saldo.
7. Registrar abonos adicionales y comprobar que no se puede superar el saldo.
8. Pagar una compra en efectivo con caja abierta y verificar que el efectivo esperado disminuye al cerrar caja; pagos por transferencia/tarjeta no deben reducir el efectivo esperado.
9. Anular una compra sin pagos y verificar el movimiento inverso; comprobar que no se puede anular si ya hay pagos o si el stock disponible no alcanza.
10. Verificar historial de movimientos, proveedor, referencia, fechas y permisos por negocio.
11. Intentar llamar las RPC como BARBERO y con IDs de otro negocio; todas deben rechazarse.
12. Registrar ajustes de entrada y salida con motivo; comprobar que una salida superior al stock se rechaza.
13. Repetir en móvil y escritorio, y probar doble clic en los formularios.

Las compras de inventario no se registran como gastos operativos para no duplicar el costo de los productos cuando se venden. Los pagos a proveedores sí se consideran salidas de efectivo de la caja cuando se asocian a una caja abierta. Las compras registradas sin caja abierta quedan en el historial de pagos, pero no se asignan retrospectivamente a un cierre.
