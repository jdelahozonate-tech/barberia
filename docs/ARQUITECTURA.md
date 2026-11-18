# Arquitectura y plan de reorganización

## 1. Punto de partida

La aplicación actual es una PWA estática, sin framework ni sistema de módulos. La pantalla privada concentra cerca de 60 KB de HTML, CSS y JavaScript en `index.html`. Las pantallas `admin.html`, `reservar.html` y `cita.html` también contienen su propia interfaz, lógica y cliente Supabase.

La aplicación utiliza JavaScript vanilla y Supabase JS UMD desde CDN. No se encontró `package.json`, configuración de bundler, pruebas automatizadas ni workflow de GitHub Actions en el árbol revisado.

## 2. Mapa funcional observado

### Aplicación privada (`index.html`)

- **Acceso:** registro, inicio/cierre de sesión y onboarding por código de invitación.
- **Contexto del negocio:** carga de perfil, negocio y suscripción; bloqueo cuando el acceso no está activo.
- **Inicio:** resumen del día y panel gerencial con indicadores y rangos de fechas.
- **Agenda:** consulta por día, creación y edición de citas, confirmación y cobro al marcar como atendida.
- **Clientes:** listado, búsqueda, alta, edición y estado.
- **Equipo:** barberos, horarios, relación del perfil con el barbero e invitaciones/activación de perfiles.
- **Catálogos:** servicios, productos y cuentas de recaudo.
- **Ventas:** registro de ventas y pagos, consulta de movimientos y detalle.
- **Inventario:** existencias y entradas de stock.
- **Caja:** apertura/cierre, efectivo esperado, gastos y detalle de pagos.
- **Comisiones:** cálculo de pendientes, liquidación y consulta individual del barbero.
- **Ajustes:** datos del negocio, enlace público de reservas y opciones operativas.

### Administración de plataforma (`admin.html`)

- Acceso de administrador de plataforma.
- Listado de negocios.
- Creación de negocio e invitación inicial.
- Generación de invitación de administrador.
- Renovación de suscripción y registro de pago.
- Suspensión/reactivación de negocios.

### Flujos públicos

- **`reservar.html`:** consulta catálogo público por slug, horarios disponibles y crea la reserva mediante RPC.
- **`cita.html`:** consulta cita por token y permite confirmar, cancelar o reprogramar mediante RPC.

## 3. Dependencias y límites actuales

- Las pantallas crean su propio cliente Supabase y repiten utilidades como escape HTML y formato de fechas.
- La aplicación privada mezcla renderizado, eventos, consultas y reglas de interfaz en funciones globales.
- El enrutamiento es una selección de vistas dentro de una sola página.
- Hay consultas directas a tablas y llamadas RPC. La reorganización no debe cambiar su semántica.
- El service worker actual guarda la pantalla principal y los iconos como respaldo; no debe publicarse una versión nueva de archivos con caché desactualizada.
- La estrategia de despliegue todavía debe confirmarse antes de introducir Vite o rutas nuevas.

## 4. Arquitectura objetivo

Se propone mantener JavaScript vanilla y separar por responsabilidades:

- `config/`: configuración pública del cliente y constantes de entorno.
- `lib/`: cliente Supabase y adaptadores compartidos.
- `shared/utils/`: formato de moneda/fechas, escape de texto y utilidades.
- `shared/components/`: componentes reutilizables (mensajes, diálogos, botones).
- `modules/`: funcionalidades de negocio aisladas.
- `pages/`: puntos de entrada independientes para app privada, administración y flujos públicos.

Cada módulo debe exponer operaciones e inicialización claras. Evitar dependencias implícitas de variables globales como `S`, `sb`, `$()` y `dlg`; se migrarán gradualmente a dependencias explícitas.

## 5. Orden de migración

1. **Base y documentación:** registrar estado actual, decisiones y estructura propuesta.
2. **Infraestructura compartida:** centralizar cliente Supabase, configuración y utilidades sin cambiar pantallas.
3. **Acceso y contexto:** extraer autenticación, perfil, negocio y suscripción.
4. **Módulos de bajo acoplamiento:** clientes, catálogos y equipo/horarios.
5. **Agenda:** extraer citas y flujos de confirmación/cobro.
6. **Operación:** ventas, pagos, inventario, caja y gastos.
7. **Finanzas:** comisiones e informes.
8. **Pantallas separadas:** administración, reserva pública y gestión pública de cita.
9. **PWA y despliegue:** revisar rutas, caché, manifest y proceso de publicación.

No se debe mover todo el código de una sola vez. Cada etapa debe dejar la aplicación compilable y navegable.

## 6. Reglas de seguridad y compatibilidad

- No exponer claves privadas ni service-role.
- Mantener RLS y las validaciones del backend como autoridad.
- No sustituir RPC transaccionales por secuencias de escrituras desde el navegador.
- No cambiar tablas, columnas, nombres de RPC, parámetros ni valores de estados en una tarea de modularización.
- Mantener los controles de rol en interfaz, sin considerarlos una frontera de seguridad.
- No borrar ni modificar datos de Supabase durante esta reorganización.
- No integrar a `main` hasta revisar el diff y validar los flujos críticos.

## 7. Pendientes técnicos por confirmar

- Plataforma y configuración exacta de hosting/despliegue.
- Si se puede introducir Vite sin afectar URLs existentes de reservas y citas.
- Cobertura de pruebas manuales o automatizadas para login, onboarding, agenda, venta, caja y reservas públicas.
- Contratos exactos de datos para los módulos que se extraigan; se conservarán los actuales hasta validarlos.


## 8. Extracciones realizadas

- `src/lib/supabase.js`: cliente compartido de Supabase.
- `src/shared/utils.js`: escape HTML, fechas, horas, etiquetas, slug, traducción de errores y normalización de WhatsApp.
- `src/config/catalogos.js`: configuración de campos, permisos de interfaz y presentación para clientes, barberos, servicios, productos y cuentas de recaudo. Se construye mediante `crearConfigCatalogos(ADM, dinero)` para conservar las dependencias actuales.
- `index.html` importa las utilidades y la configuración de catálogos; la lógica CRUD permanece temporalmente en la pantalla principal.
- `sw.js` precarga los módulos compartidos y de catálogos en la versión `barberia-v5` para mejorar el arranque sin conexión.

Estas extracciones no modifican el esquema ni las RPC de Supabase. La validación realizada hasta ahora es sintáctica; falta comprobar flujos en navegador real.

- `src/modules/catalogos.js`: operaciones CRUD y formularios de catálogos extraídos de `index.html`; las dependencias se inyectan desde la pantalla y las reglas de negocio permanecen iguales.
