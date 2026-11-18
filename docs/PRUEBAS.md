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

No se deben probar escrituras destructivas sobre datos reales. Usar un negocio y registros de prueba.

## Criterio de salida

La rama solo debe integrarse cuando:

- La suite de GitHub Actions esté verde.
- Los flujos manuales anteriores estén revisados.
- Las rutas públicas y la PWA se hayan probado.
- El diff final se haya revisado y no incluya cambios no relacionados.
