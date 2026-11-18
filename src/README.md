# Código fuente

Este directorio contiene módulos JavaScript ES importados por las páginas HTML de la raíz.

## Carpetas

- `lib/`: integraciones técnicas compartidas. No colocar reglas de negocio específicas aquí.
- `shared/`: funciones reutilizables y preferiblemente puras, sin acceso al DOM ni a Supabase.
- `config/`: configuración declarativa construida con dependencias explícitas.
- `modules/`: funcionalidades por dominio. Reciben sus dependencias mediante parámetros para reducir acoplamiento con la pantalla que las monta.

## Módulos existentes

| Archivo | Responsabilidad |
| --- | --- |
| `lib/supabase.js` | Instancia compartida de Supabase. |
| `shared/utils.js` | Formato, fechas, escape HTML y normalización. |
| `config/catalogos.js` | Campos, permisos de interfaz y etiquetas de catálogos. |
| `modules/acceso.js` | Autenticación, onboarding y contexto de negocio/suscripción. |
| `modules/agenda.js` | Agenda, citas, confirmaciones, cobro y recordatorios. |
| `modules/ajustes.js` | Datos y preferencias del negocio. |
| `modules/catalogos.js` | Listados, CRUD y formularios de clientes, barberos, servicios, productos y cuentas. |
| `modules/equipo.js` | Perfiles, invitaciones y horarios. |
| `modules/finanzas.js` | Caja, gastos y comisiones. |
| `modules/inicio.js` | Resumen e informe gerencial. |
| `modules/ventas.js` | Registro y consulta de ventas y pagos. |
| `pages/admin.js` | Interfaz de administración de plataforma. |
| `pages/reservar.js` | Reserva pública. |
| `pages/cita.js` | Gestión pública de cita. |

## Regla de extracción

Un módulo nuevo debe tener una responsabilidad concreta, exportaciones claras y dependencias explícitas. Evitar crear archivos vacíos o mover funciones sin definir quién las usa. Las páginas siguen siendo las entradas públicas mientras no se migre el hosting.

## Entradas de páginas separadas

- `pages/admin.js`: lógica del panel de administración de plataforma.
- `pages/reservar.js`: lógica de reservas públicas.
- `pages/cita.js`: consulta y gestión pública de citas.

Las páginas HTML de la raíz conservan sus URLs públicas y cargan estos módulos externos.
