# Estructura y convenciones del repositorio

## Por qué existen archivos en la raíz

Los cuatro HTML son entradas públicas actuales. Además, `manifest.webmanifest`, iconos y `sw.js` tienen rutas relativas usadas por GitHub Pages y por instalaciones PWA existentes. No moverlos hasta diseñar una migración de rutas y probar los enlaces guardados.

## Responsabilidad de carpetas

- `src/lib/`: integraciones técnicas compartidas, como el cliente de Supabase.
- `src/shared/`: funciones puras y reutilizables; evitar dependencias del DOM, estado de pantalla o consultas.
- `src/config/`: configuración declarativa de formularios, menús y catálogos.
- `src/modules/`: casos de uso y lógica de interfaz agrupados por dominio.
- `docs/`: decisiones técnicas, mapa del sistema, procesos y guías.

## Convenciones JavaScript

- Usar módulos ES (`import`/`export`) para código nuevo.
- Preferir dependencias explícitas por parámetros frente a variables globales implícitas.
- No acceder a Supabase desde utilidades puras.
- Mantener nombres de tablas, columnas, RPC, parámetros y estados existentes.
- Escapar texto de usuario antes de interpolarlo en HTML.
- Manejar errores de Supabase de forma visible y no ocultarlos.
- Evitar introducir librerías o un proceso de build hasta que exista una necesidad concreta y se haya evaluado el impacto sobre GitHub Pages.

## Convenciones de cambios

1. Trabajar en una rama distinta de `main`.
2. Hacer cambios pequeños, con mensajes de commit descriptivos.
3. Actualizar la precarga y versión del service worker si un módulo nuevo es necesario para iniciar sin conexión.
4. Revisar rutas relativas desde cada HTML.
5. Validar sintaxis de módulos y probar login, agenda, reserva, venta y PWA en navegador antes de integrar.

## Estructura objetivo gradual

La estructura se ampliará cuando cada módulo exista realmente. Dominios previstos: acceso, agenda, clientes, equipo, catálogos, ventas, inventario, caja, comisiones, informes y ajustes. No crear módulos vacíos ni mover archivos solo para que el árbol parezca más ordenado.
