# App-Barberia

Aplicación web progresiva (PWA) para la gestión de barberías. Frontend en HTML, CSS y JavaScript nativo; backend en Supabase.

## Estado del proyecto

La versión funcional inicial se conserva como base. La reorganización ocurre en `refactor/arquitectura-modular`; `main` no se modifica durante este trabajo.

La prioridad es ordenar el código sin romper URLs públicas, instalación PWA ni flujos existentes. No se ha introducido todavía un bundler ni un framework.

## Pantallas y entradas públicas

| Archivo | Responsabilidad |
| --- | --- |
| `index.html` | Aplicación privada: acceso, agenda, clientes, equipo, catálogos, ventas y finanzas. |
| `admin.html` | Administración de la plataforma. |
| `reservar.html` | Reserva pública por negocio. |
| `cita.html` | Consulta y gestión pública de una cita mediante token. |
| `sw.js` | Service worker y caché PWA. |
| `manifest.webmanifest` | Metadatos de instalación PWA. |

Los HTML de entrada y los archivos PWA permanecen en la raíz intencionalmente: GitHub Pages publica desde la raíz y las rutas actuales forman parte de los enlaces compartidos y del funcionamiento instalado. Su traslado requiere una migración coordinada de URLs, manifest, caché y enlaces externos.

## Estructura actual

```text
/
├── index.html                 # Aplicación privada (entrada estable)
├── admin.html                 # Administración de plataforma
├── reservar.html              # Reservas públicas
├── cita.html                  # Gestión pública de citas
├── sw.js                      # Service worker
├── manifest.webmanifest       # Manifest PWA
├── icon-192.png               # Icono PWA
├── icon-512.png               # Icono PWA
├── logo-dhbarber.png          # Logo usado por la aplicación
├── src/
│   ├── config/
│   │   └── catalogos.js       # Configuración de catálogos
│   ├── lib/
│   │   └── supabase.js        # Cliente Supabase compartido
│   ├── modules/
│   │   ├── agenda.js          # Agenda y gestión de citas
│   │   ├── equipo.js          # Equipo, invitaciones y horarios
│   │   └── catalogos.js       # CRUD y formularios de catálogos
│   └── shared/
│       └── utils.js           # Utilidades puras compartidas
├── docs/
│   ├── ARQUITECTURA.md        # Mapa funcional y plan de migración
│   └── ESTRUCTURA_REPOSITORIO.md # Organización y convenciones
└── src/README.md              # Guía de módulos fuente
```

La estructura se ampliará a medida que se extraigan módulos reales; no se crean carpetas vacías como sustituto de código modular.

## Funcionalidades existentes

- Autenticación, perfiles e invitaciones por rol.
- Clientes, barberos, servicios y productos.
- Horarios, agenda y citas.
- Reservas públicas y enlaces de gestión de citas.
- Ventas, pagos, caja y gastos.
- Inventario y movimientos de stock.
- Comisiones e informes gerenciales.
- Ajustes del negocio y administración de suscripciones.

## Backend y seguridad

Supabase gestiona autenticación, datos y funciones RPC. RLS y las validaciones del backend son la autoridad; ocultar botones en la interfaz no sustituye controles del servidor.

No incluir claves privadas ni service-role en el frontend. La clave publicable del cliente puede estar en el navegador, con RLS y permisos correctamente configurados.

## Convenciones de trabajo

1. Mantener `main` intacta hasta completar revisión y pruebas.
2. Extraer una responsabilidad a la vez y conservar los contratos actuales.
3. Mantener las rutas públicas y PWA hasta planificar una migración explícita.
4. No cambiar tablas, columnas, RPC ni estados al reorganizar frontend.
5. No duplicar lógica de negocio ni introducir dependencias sin necesidad.
6. Actualizar `sw.js` y su versión de caché cuando se agreguen módulos necesarios para el arranque offline.
7. Documentar los cambios y validar sintaxis; las pruebas de navegador siguen siendo obligatorias antes de integrar.

## Documentación

- [Arquitectura y plan de migración](docs/ARQUITECTURA.md)
- [Estructura y convenciones del repositorio](docs/ESTRUCTURA_REPOSITORIO.md)
