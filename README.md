# App-Barberia

Aplicación web progresiva (PWA) para la gestión de barberías. El frontend actual está construido con HTML, CSS y JavaScript, y utiliza Supabase para autenticación, base de datos y funciones RPC.

## Estado del proyecto

El repositorio contiene la versión funcional inicial. La reorganización se está realizando en la rama `refactor/arquitectura-modular`; la rama `main` se conserva como referencia estable.

**No se está reconstruyendo el producto desde cero.** La prioridad es conservar los flujos actuales y mejorar gradualmente su estructura.

## Pantallas actuales

| Archivo | Responsabilidad |
| --- | --- |
| `index.html` | Aplicación privada: acceso, inicio, agenda, clientes, equipo, servicios, productos, ventas, caja, comisiones y ajustes. |
| `admin.html` | Administración de la plataforma: negocios, invitaciones de administrador, renovaciones y suspensión. |
| `reservar.html` | Catálogo público y creación de reservas por negocio. |
| `cita.html` | Consulta, confirmación, cancelación y reprogramación de una cita mediante enlace. |
| `sw.js` | Service worker y caché de respaldo de la PWA. |
| `manifest.webmanifest` | Metadatos e instalación de la PWA. |

## Funcionalidades identificadas

- Autenticación y vinculación de usuarios mediante invitaciones.
- Perfiles con roles de administrador, supervisor y barbero.
- Gestión de clientes, barberos, servicios y productos.
- Agenda, horarios de atención y gestión de estados de citas.
- Reservas públicas y gestión de citas mediante enlaces.
- Ventas, detalle de ventas y pagos por diferentes medios.
- Apertura/cierre de caja y registro de gastos.
- Control de inventario y movimientos de stock.
- Cálculo y liquidación de comisiones.
- Panel gerencial e indicadores.
- Ajustes del negocio y administración de suscripciones desde la plataforma.

## Backend

Supabase es el backend. Las operaciones del cliente usan la API de Supabase y algunas operaciones de negocio se ejecutan mediante funciones RPC de PostgreSQL. Las reglas de acceso y la integridad de datos deben seguir aplicándose en el backend; ocultar botones en la interfaz no sustituye RLS ni validaciones del servidor.

No almacenar claves privadas o service-role en el frontend. La clave publicable que utiliza el cliente no es un secreto; su seguridad depende de las políticas y permisos correctamente configurados en Supabase.

## Criterios de reorganización

1. Conservar las pantallas y flujos existentes mientras se extraen módulos.
2. Separar configuración, acceso a Supabase, utilidades compartidas y funcionalidades de negocio.
3. Evitar duplicar reglas de negocio entre la aplicación privada, administración y reservas públicas.
4. Mantener JavaScript sin framework por ahora; no introducir React u otra capa visual sin una necesidad concreta.
5. No cambiar nombres de tablas, columnas, RPC ni contratos de datos como parte de una simple reorganización.
6. Realizar cambios pequeños, revisables y probables en la rama de refactor antes de integrarlos a `main`.

## Estructura objetivo (propuesta)

La estructura definitiva se confirmará al revisar el despliegue actual y completar la extracción inicial:

```text
src/
  app/
  config/
  lib/
  shared/
    components/
    utils/
  modules/
    auth/
    agenda/
    clientes/
    equipo/
    catalogos/
    ventas/
    inventario/
    caja/
    comisiones/
    ajustes/
    suscripciones/
  pages/
    admin/
    reservar/
    cita/
public/
  icons/
  manifest.webmanifest
  sw.js
```

La estructura es un destino de trabajo, no implica que todos los módulos deban implementarse de nuevo.

## Trabajo en curso

Consulta [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md) para conocer el mapa funcional y el orden previsto de migración.
