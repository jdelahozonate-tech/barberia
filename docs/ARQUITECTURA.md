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

- Las cuatro páginas comparten ahora una instancia de Supabase mediante `src/lib/supabase.js`; aún hay utilidades pequeñas repetidas en las páginas públicas que pueden centralizarse después.
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

## 5. Estado de la migración

- [x] Documentación y estructura base del repositorio.
- [x] Cliente Supabase compartido.
- [x] Utilidades comunes y configuración de catálogos.
- [x] Acceso, onboarding y contexto de suscripción.
- [x] CRUD de catálogos, equipo e invitaciones.
- [x] Agenda, citas, confirmaciones y cobro asociado.
- [x] Ventas, pagos, caja, gastos y comisiones.
- [x] Inicio, indicadores, informes y ajustes.
- [x] Lógica de administración, reservas públicas y gestión pública de citas separada de los HTML.
- [x] Precarga PWA actualizada para los módulos locales.
- [x] Pruebas automatizadas de sintaxis, rutas e utilidades con GitHub Actions.

**Pendiente antes de integrar:** pruebas funcionales en navegador real con Supabase, revisión visual/responsiva y validación de instalación/actualización PWA. No se ha introducido un bundler porque las rutas estáticas actuales funcionan con GitHub Pages y deben conservarse.


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


## 8. Estructura implementada

- `src/lib/supabase.js`: cliente compartido de Supabase.
- `src/shared/utils.js`: escape HTML, fechas, horas, etiquetas, slug, traducción de errores y normalización de WhatsApp.
- `src/config/catalogos.js`: configuración declarativa de clientes, barberos, servicios, productos y cuentas.
- `src/modules/acceso.js`: autenticación, onboarding, carga de perfil, negocio y suscripción.
- `src/modules/agenda.js`: agenda diaria, citas, confirmación, cobro asociado y recordatorios.
- `src/modules/ajustes.js`: datos del negocio, enlace público y opciones operativas.
- `src/modules/catalogos.js`: operaciones CRUD y formularios de catálogos.
- `src/modules/equipo.js`: perfiles, invitaciones y horarios de barberos.
- `src/modules/finanzas.js`: caja, gastos, liquidaciones y vista individual de comisiones.
- `src/modules/inicio.js`: resumen diario e informe gerencial.
- `src/modules/ventas.js`: registro, detalle, pagos adicionales y anulación de ventas.
- `src/pages/admin.js`, `reservar.js`, `cita.js`: lógica de las pantallas independientes, separada de su HTML.
- `tests/` y `.github/workflows/ci.yml`: pruebas automáticas y ejecución continua.
- `docs/`: arquitectura, estructura y guía de validación.

Las cuatro páginas conservan sus nombres y rutas de entrada. La aplicación privada mantiene en `index.html` el montaje, navegación y estado de pantalla; las operaciones de dominio se delegan en módulos. La reorganización no cambia tablas, RPC ni datos de Supabase.

La suite automática se ejecuta con `npm test` y está configurada en GitHub Actions. La última ejecución consultada completó correctamente. Esto valida sintaxis, rutas e utilidades, pero no sustituye la prueba manual en navegador real descrita en `docs/PRUEBAS.md`.
