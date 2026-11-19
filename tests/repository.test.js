import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import vm from 'node:vm';
import { crearModuloVentas } from '../src/modules/ventas.js';
import { crearModuloAcceso } from '../src/modules/acceso.js';

const root = process.cwd();
const pageFiles = ['index.html', 'admin.html', 'reservar.html', 'cita.html'];
const sourceFiles = [
  'src/lib/supabase.js',
  'src/shared/utils.js',
  'src/config/catalogos.js',
  'src/modules/acceso.js',
  'src/modules/agenda.js',
  'src/modules/ajustes.js',
  'src/modules/notificaciones.js',
  'src/modules/catalogos.js',
  'src/modules/productos.js',
  'src/modules/equipo.js',
  'src/modules/finanzas.js',
  'src/modules/inicio.js',
  'src/modules/ventas.js',
  'src/pages/admin.js',
  'src/pages/reservar.js',
  'src/pages/cita.js'
];

function checkSyntax(file, code) {
  code = code.replace(/^import .*;\s*$/gm, '').replace(/^export\s+/gm, '');
  assert.doesNotThrow(() => new vm.Script(code, { filename: file }), file);
}

test('todos los módulos JavaScript tienen sintaxis válida', () => {
  for (const file of sourceFiles) {
    checkSyntax(file, readFileSync(resolve(root, file), 'utf8'));
  }
});

test('las cuatro páginas tienen un punto de entrada JavaScript válido', () => {
  for (const file of pageFiles) {
    const html = readFileSync(resolve(root, file), 'utf8');
    const inline = html.match(/<script type="module">([\s\S]*?)<\/script>/);
    const external = html.match(/<script type="module" src="([^"]+)"><\/script>/);
    if (inline) {
      checkSyntax(file, inline[1]);
    } else {
      assert.ok(external, file + ': falta script de módulo');
      const path = resolve(root, dirname(file), external[1]);
      assert.ok(existsSync(path), file + ': no existe ' + external[1]);
      checkSyntax(external[1], readFileSync(path, 'utf8'));
    }
  }
});

test('todas las importaciones locales existen', () => {
  const entries = [...sourceFiles];
  for (const file of pageFiles) {
    const html = readFileSync(resolve(root, file), 'utf8');
    const inline = html.match(/<script type="module">([\s\S]*?)<\/script>/);
    if (inline) {
      for (const match of inline[1].matchAll(/from\s+["']([^"']+)["']/g)) {
        if (match[1].startsWith('.')) {
          assert.ok(existsSync(resolve(root, dirname(file), match[1])), file + ': ' + match[1]);
        }
      }
    }
  }
  for (const file of entries) {
    const code = readFileSync(resolve(root, file), 'utf8');
    for (const match of code.matchAll(/from\s+["']([^"']+)["']/g)) {
      if (match[1].startsWith('.')) {
        assert.ok(existsSync(resolve(root, dirname(file), match[1])), file + ': ' + match[1]);
      }
    }
  }
});

test('el service worker precarga módulos privados y páginas públicas', () => {
  const sw = readFileSync(resolve(root, 'sw.js'), 'utf8');
  for (const file of [...sourceFiles]) {
    assert.ok(sw.includes(file), 'No está en caché: ' + file);
  }
});

test('el módulo de ventas aplica el filtro de datos del barbero', async () => {
  let aplicado = 0;
  const query = {
    select() { return this; },
    order() { return this; },
    limit() { return Promise.resolve({ data: [], error: null }); }
  };
  const previo = globalThis.document;
  globalThis.document = { querySelectorAll: () => [] };
  try {
    const modulo = crearModuloVentas({
      $: () => ({ innerHTML: '' }),
      dlg: {},
      sb: { from: tabla => { assert.equal(tabla, 'ventas'); return query; } },
      S: {},
      esc: String,
      dinero: String,
      hora: String,
      bonito: String,
      traducir: String,
      toast: () => {},
      ADM: [],
      METODOS: [],
      mio: q => { aplicado++; return q; }
    });
    await modulo.ventas();
    assert.equal(aplicado, 1);
  } finally {
    if (previo === undefined) delete globalThis.document;
    else globalThis.document = previo;
  }
});


test('el formulario de venta no continúa si falla la lectura de catálogos', async () => {
  let mensaje = '';
  const query = {
    select() { return this; },
    eq() { return this; },
    order() { return this; },
    maybeSingle() { return Promise.resolve({ data: null, error: { message: 'permiso denegado' } }); },
    then(resolve) { resolve({ data: null, error: { message: 'permiso denegado' } }); }
  };
  const modulo = crearModuloVentas({
    $: () => ({ innerHTML: '' }),
    dlg: {},
    sb: { from: () => query },
    S: { perfil: { negocio_id: 'n1' } },
    esc: String,
    dinero: String,
    hora: String,
    bonito: String,
    traducir: String,
    toast: value => { mensaje = value; },
    ADM: [],
    METODOS: [],
    mio: q => q
  });
  await modulo.nuevaVenta();
  assert.match(mensaje, /permiso denegado/);
});


test('el acceso no habilita la aplicación si falla la verificación de suscripción', async () => {
  let mensaje = '';
  let abrioApp = false;
  const perfilQuery = {
    select() { return this; },
    eq() { return this; },
    maybeSingle: async () => ({ data: { id: 'u1', negocios: { id: 'n1' } }, error: null })
  };
  const modulo = crearModuloAcceso({
    $: () => ({ innerHTML: '' }),
    app: { innerHTML: '' },
    sb: {
      auth: { getUser: async () => ({ data: { user: { id: 'u1' } }, error: null }) },
      from: tabla => { assert.equal(tabla, 'perfiles'); return perfilQuery; },
      rpc: async nombre => {
        assert.equal(nombre, 'mi_suscripcion');
        return { data: null, error: { message: 'fallo de conexión' } };
      }
    },
    S: {},
    esc: String,
    traducir: String,
    toast: value => { mensaje = value; },
    waNum: () => '',
    shell: () => { abrioApp = true; }
  });
  await modulo.cargar();
  assert.match(mensaje, /fallo de conexión/);
  assert.equal(abrioApp, false);
});


test('las consultas financieras quedan limitadas al negocio activo', () => {
  const finanzas = readFileSync(resolve(root, 'src/modules/finanzas.js'), 'utf8');
  for (const tabla of ['cajas', 'pagos', 'gastos', 'detalle_ventas', 'comisiones']) {
    assert.ok(finanzas.includes("from('" + tabla + "')"), 'Falta consulta de ' + tabla);
    assert.ok(finanzas.includes(".eq('negocio_id',S.perfil.negocio_id)"), 'Falta filtro de negocio en ' + tabla);
  }
});


test('ventas y catálogos filtran lecturas y escrituras por negocio activo', () => {
  const ventas = readFileSync(resolve(root, 'src/modules/ventas.js'), 'utf8');
  const catalogos = readFileSync(resolve(root, 'src/modules/catalogos.js'), 'utf8');
  assert.match(ventas, /from\(t\)\.select\(campos\)\.eq\('negocio_id',S\.perfil\.negocio_id\)/);
  assert.match(ventas, /from\('detalle_ventas'\)[\s\S]*?eq\('negocio_id',S\.perfil\.negocio_id\)/);
  assert.match(ventas, /from\('pagos'\)[\s\S]*?eq\('negocio_id',S\.perfil\.negocio_id\)/);
  assert.match(catalogos, /from\(k\)\.select\('\*'\)\.eq\('negocio_id',S\.perfil\.negocio_id\)/);
  assert.match(catalogos, /from\('stock_actual'\)[\s\S]*?eq\('negocio_id',S\.perfil\.negocio_id\)/);
});


test('equipo, agenda y cierres limitan operaciones al negocio y bloquean escrituras repetidas', () => {
  const equipo = readFileSync(resolve(root, 'src/modules/equipo.js'), 'utf8');
  const agenda = readFileSync(resolve(root, 'src/modules/agenda.js'), 'utf8');
  const finanzas = readFileSync(resolve(root, 'src/modules/finanzas.js'), 'utf8');
  assert.match(equipo, /from\('perfiles'\)[\s\S]*?eq\('negocio_id',S\.perfil\.negocio_id\)/);
  assert.match(equipo, /from\('horarios_barbero'\)\.delete\(\)\.eq\('negocio_id',S\.perfil\.negocio_id\)/);
  assert.match(equipo, /let guardando=false/);
  assert.match(equipo, /let creando=false/);
  assert.match(equipo, /Completa la hora de entrada y salida/);
  assert.match(equipo, /Cada día marcado debe tener al menos un horario/);
  assert.match(equipo, /if\(b\.disabled\)return;b\.disabled=true/);
  assert.match(agenda, /from\('citas'\)[\s\S]*?eq\('negocio_id',S\.perfil\.negocio_id\)/);
  assert.match(agenda, /update\(\{estado:f\.estado[\s\S]*?eq\('negocio_id',S\.perfil\.negocio_id\)/);
  assert.match(finanzas, /let cerrando=false/);
});


test('la edición y anulación de ventas usan RPC transaccional y no borrado físico', () => {
  const ventas = readFileSync(resolve(root, 'src/modules/ventas.js'), 'utf8');
  const sql = readFileSync(resolve(root, 'supabase/migrations/20261118000000_editar_anular_ventas.sql'), 'utf8');
  assert.match(ventas, /sb\.rpc\('editar_venta'/);
  assert.match(ventas, /sb\.rpc\('anular_venta'/);
  assert.match(ventas, /ADM\.includes\(S\.perfil\.rol\)/);
  assert.match(sql, /SECURITY DEFINER/);
  assert.match(sql, /mi_negocio\(\)/);
  assert.match(sql, /mi_rol\(\)/);
  assert.match(sql, /FOR UPDATE/);
  assert.match(sql, /estado_pago = 'REGISTRADO'/);
  assert.match(sql, /comisiones c/);
  assert.match(sql, /x\.cantidad \* s\.precio \* v_porcentaje \/ 100/);
  assert.match(sql, /Ajuste por edición de venta/);
  assert.match(sql, /public\.stock_actual/);
  assert.match(sql, /No hay existencias suficientes/);
  assert.match(sql, /No se puede anular: esta venta tiene comisiones liquidadas/);
  assert.match(sql, /trg_devolver_inventario/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.editar_venta/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.anular_venta/);
  const editar = ventas.slice(ventas.indexOf('async function editarVenta'), ventas.indexOf('async function detalleVenta'));
  assert.doesNotMatch(editar, /\.delete\(/);
});

test('los informes gerenciales limitan cada fuente al negocio activo', () => {
  const inicio = readFileSync(resolve(root, 'src/modules/inicio.js'), 'utf8');
  for (const tabla of ['ventas', 'detalle_ventas', 'pagos', 'gastos', 'citas', 'stock_actual']) {
    assert.match(inicio, new RegExp("from\\('" + tabla + "'\\)[^\\n]*eq\\('negocio_id',S\\.perfil\\.negocio_id\\)"));
  }
});

test('cierre de caja y ajustes permiten reintentar después de errores', () => {
  const finanzas = readFileSync(resolve(root, 'src/modules/finanzas.js'), 'utf8');
  const ajustes = readFileSync(resolve(root, 'src/modules/ajustes.js'), 'utf8');
  assert.match(finanzas, /cerrando=false;if\(boton\)boton\.disabled=false;return toast\(error\.message,true\)/);
  assert.match(ajustes, /let guardando=false/);
  assert.match(ajustes, /guardando=false;if\(boton\)boton\.disabled=false;return toast\(error\.message,true\)/);
  assert.match(ajustes, /guardando=false;if\(boton\)boton\.disabled=false;return toast\('Los datos del negocio se guardaron, pero no se pudo consultar/);
  assert.match(ajustes, /guardando=false;if\(boton\)boton\.disabled=false;return toast\('Los datos del negocio se guardaron, pero no se pudo actualizar/);
});

test('cambio de estado de catálogos impide doble envío y filtra por negocio', () => {
  const catalogos = readFileSync(resolve(root, 'src/modules/catalogos.js'), 'utf8');
  assert.match(catalogos, /const b=\$\('#tg'\);if\(b\.disabled\)return;b\.disabled=true/);
  assert.match(catalogos, /\.update\(\{estado:r\.estado==='ACTIVO'\?'INACTIVO':'ACTIVO'\}\)\.eq\('negocio_id',S\.perfil\.negocio_id\)\.eq\('id',r\.id\)/);
});


test('ventas rechaza cantidades, precios y pagos no finitos o inválidos', () => {
  const ventas = readFileSync(resolve(root, 'src/modules/ventas.js'), 'utf8');
  assert.match(ventas, /Number\.isFinite\(l\.q\)/);
  assert.match(ventas, /l\.q<=0/);
  assert.match(ventas, /Number\.isFinite\(l\.i\.p\)/);
  assert.match(ventas, /valoresPago\.some\(x=>!Number\.isFinite\(x\)\|\|x<0\)/);
  assert.match(ventas, /Number\.isFinite\(c\.t\)/);
});

test('entrada de inventario rechaza cantidades no finitas y no positivas', () => {
  const catalogos = readFileSync(resolve(root, 'src/modules/catalogos.js'), 'utf8');
  assert.match(catalogos, /!Number\.isFinite\(n\)\|\|n<=0/);
});


test('caja y gastos rechazan importes no finitos o negativos', () => {
  const finanzas = readFileSync(resolve(root, 'src/modules/finanzas.js'), 'utf8');
  assert.match(finanzas, /Number\.isFinite\(inicial\)\|\|inicial<0/);
  assert.match(finanzas, /Number\.isFinite\(n\)\|\|n<0/);
  assert.match(finanzas, /Number\.isFinite\(valor\)\|\|valor<=0/);
});


test('las reservas públicas toleran catálogos incompletos y filtran horarios inválidos', () => {
  const reservar = readFileSync(resolve(root, 'src/pages/reservar.js'), 'utf8');
  const cita = readFileSync(resolve(root, 'src/pages/cita.js'), 'utf8');
  assert.match(reservar, /C\.servicios=Array\.isArray\(C\.servicios\)\?C\.servicios:\[\]/);
  assert.match(reservar, /C\.barberos=Array\.isArray\(C\.barberos\)\?C\.barberos:\[\]/);
  assert.match(reservar, /filter\(x=>x&&typeof x\.inicio==='string'&&Number\.isFinite\(Date\.parse\(x\.inicio\)\)\)/);
  assert.match(reservar, /data-t="\$\{esc\(x\.inicio\)\}"/);
  assert.match(cita, /!data\|\|typeof data!=='object'\|\|!data\.inicio\|\|!data\.estado/);
  assert.match(cita, /tk\.length>512/);
  assert.match(cita, /data-t="\$\{esc\(x\.inicio\)\}"/);
});


test('la interfaz reserva edición administrativa de catálogos, citas, ventas y equipo', () => {
  const cfg = readFileSync(resolve(root, 'src/config/catalogos.js'), 'utf8');
  const ventas = readFileSync(resolve(root, 'src/modules/ventas.js'), 'utf8');
  const agenda = readFileSync(resolve(root, 'src/modules/agenda.js'), 'utf8');
  const equipo = readFileSync(resolve(root, 'src/modules/equipo.js'), 'utf8');
  const inicio = readFileSync(resolve(root, 'src/modules/inicio.js'), 'utf8');
  const index = readFileSync(resolve(root, 'index.html'), 'utf8');
  assert.ok(cfg.includes("clientes:{t:'Clientes',uno:'cliente',w:ADM"));
  assert.ok(ventas.includes("abierta=v.estado_venta==='PENDIENTE'&&admin"));
  assert.ok(ventas.includes("admin&&v.estado_venta!=='ANULADA'"));
  assert.ok(agenda.includes("const admin=['ADMINISTRADOR','SUPERVISOR'].includes(S.perfil.rol);"));
  assert.ok(agenda.includes('Vista de solo lectura'));
  assert.ok(agenda.includes("if(admin)$('#df').onsubmit=async e=>"));
  assert.ok(equipo.includes('Solo administración puede gestionar el equipo.'));
  assert.ok(equipo.includes('Solo administración puede invitar usuarios.'));
  assert.ok(inicio.includes('Exportar CSV'));
  assert.ok(inicio.includes('informe-barberia-'));
  assert.ok(index.includes('m[2]===2?ADM.includes(S.perfil.rol)'));
});


test('los informes gerenciales paginan todas las fuentes y muestran gráficos gerenciales', () => {
  const inicio = readFileSync(resolve(root, 'src/modules/inicio.js'), 'utf8');
  assert.match(inicio, /async function todos\(q,nombre\)/);
  assert.match(inicio, /q\.abortSignal\(controller\.signal\)\.range\(desde,desde\+999\)/);
  assert.match(inicio, /if\(bloque\.length<1000\)break/);
  assert.match(inicio, /fuentes\.map\(async\(\[nombre,q\]\)=>/);
  assert.match(inicio, /function grafica\(/);
  assert.match(inicio, /Ventas por día/);
  assert.match(inicio, /Gastos por día/);
  assert.match(inicio, /Estado de las citas/);
  assert.match(inicio, /Ticket promedio/);
});


test('el panel gerencial recibe el formateador de estados y métodos de pago', () => {
  const inicio = readFileSync(resolve(root, 'src/modules/inicio.js'), 'utf8');
  assert.match(inicio, /const \{[^}]*\bbonito\b[^}]*\} = deps/);
  assert.match(inicio, /bonito\(x\.metodo_pago\)/);
  assert.match(inicio, /bonito\(x\.k\)/);
});


test('el informe gerencial informa el progreso, corta consultas colgadas y evita resultados obsoletos', () => {
  const inicio = readFileSync(resolve(root, 'src/modules/inicio.js'), 'utf8');
  assert.match(inicio, /let informeEjecucion=0/);
  assert.match(inicio, /const controller=new AbortController\(\)/);
  assert.match(inicio, /setTimeout\(\(\)=>controller\.abort\(\),20000\)/);
  assert.match(inicio, /superó los 20 segundos/);
  assert.match(inicio, /fuentes\.map\(async\(\[nombre,q\]\)=>/);
  assert.match(inicio, /Consultando:/);
  assert.match(inicio, /if\(ejecucion!==informeEjecucion\|\|!\$\('#inf'\)\)return/);
});


test('el panel de inicio muestra etapas y errores reales del cálculo del informe', () => {
  const inicio = readFileSync(resolve(root, 'src/modules/inicio.js'), 'utf8');
  assert.match(inicio, /Consultas completas\. Validando datos/);
  assert.match(inicio, /Calculando ventas, costos y gastos/);
  assert.match(inicio, /Preparando gráficas y agrupaciones/);
  assert.match(inicio, /Mostrando resultados/);
  assert.match(inicio, /catch\(error\)/);
  assert.match(inicio, /No se pudo preparar el informe al/);
  assert.match(inicio, /x\.ventas\?\.barberos\?\.nombre/);
});

test('las tarjetas del dashboard actualizan la gráfica seleccionada sin recargar el informe', () => {
  const inicio = readFileSync(resolve(root, 'src/modules/inicio.js'), 'utf8');
  for (const metrica of ['ingresos', 'utilidad', 'recaudo', 'operaciones', 'citas', 'gastos']) {
    assert.match(inicio, new RegExp('data-metric="' + metrica + '"'));
  }
  assert.match(inicio, /id="dash-dynamic-graph"/);
  assert.match(inicio, /tarjeta\.addEventListener\('click'/);
  assert.match(inicio, /aria-pressed="true"/);
  assert.match(inicio, /graficaIndicador\(serie,m\.campo,m\.moneda\)/);
  assert.match(inicio, /S\.rg=x\.target\.value/);
});


test('el módulo de productos integra proveedores, compras, pagos e historial de inventario', () => {
  const productos = readFileSync(resolve(root, 'src/modules/productos.js'), 'utf8');
  const sql = readFileSync(resolve(root, 'supabase/migrations/20261119000000_compras_proveedores_inventario.sql'), 'utf8');
  const index = readFileSync(resolve(root, 'index.html'), 'utf8');
  const sw = readFileSync(resolve(root, 'sw.js'), 'utf8');
  const finanzas = readFileSync(resolve(root, 'src/modules/finanzas.js'), 'utf8');
  for (const table of ['proveedores_inventario', 'compras_inventario', 'detalle_compras_inventario', 'pagos_compras_inventario']) {
    assert.ok(sql.includes('public.' + table), 'Falta tabla ' + table);
  }
  for (const rpc of ['registrar_compra_inventario', 'registrar_pago_compra_inventario', 'anular_compra_inventario', 'ajustar_inventario_producto']) {
    assert.ok(sql.includes('FUNCTION public.' + rpc), 'Falta RPC ' + rpc);
    assert.ok(productos.includes("rpc('" + rpc + "'"), 'La interfaz no llama ' + rpc);
  }
  assert.match(sql, /SECURITY DEFINER/);
  assert.match(sql, /mi_negocio\(\)/);
  assert.match(sql, /mi_rol\(\)/);
  assert.match(sql, /FOR UPDATE/);
  assert.match(sql, /compra_id/);
  assert.match(sql, /stock_actual/);
  assert.match(sql, /No hay existencias suficientes para revertir esta compra/);
  assert.match(sql, /promedio ponderado/);
  assert.match(sql, /fecha_vencimiento/);
  assert.match(sql, /numero_factura/);
  assert.match(productos, /Ajuste de inventario/);
  assert.match(sql, /caja_id/);
  assert.equal((sql.match(/La caja indicada no existe/g) || []).length, 2);
  assert.match(sql, /COALESCE\(st\.existencias,0\) \* COALESCE\(p\.costo_unitario,0\) > r\.costo_total/);
  assert.match(finanzas, /pagos_compras_inventario/);
  assert.match(finanzas, /Compras pagadas en efectivo/);
  assert.match(productos, /eq\('negocio_id',nid\(\)\)/);
  assert.match(productos, /data-tab="movimientos"/);
  assert.match(productos, /data-tab="proveedores"/);
  assert.match(index, /crearModuloProductos/);
  assert.match(index, /productos,pedidos:pedidosProductos,caja/);
  assert.match(sw, /src\/modules\/productos\.js/);
  assert.match(sw, /barberia-v19/);
});

test('los pagos de compras requieren caja abierta en interfaz y base de datos', () => {
  const productos = readFileSync(resolve(root, 'src/modules/productos.js'), 'utf8');
  const sql = readFileSync(resolve(root, 'supabase/migrations/20261119020000_exigir_caja_abierta_operaciones.sql'), 'utf8');
  assert.match(productos, /Para registrar un abono al proveedor, primero abre la caja/);
  assert.match(sql, /NEW\.caja_id IS NULL OR NOT EXISTS/);
  assert.match(sql, /BEFORE INSERT OR UPDATE OF metodo_pago, caja_id, negocio_id/);
});


test('ventas, compras, gastos y pagos requieren caja abierta en interfaz y Supabase', () => {
  const ventas = readFileSync(resolve(root, 'src/modules/ventas.js'), 'utf8');
  const productos = readFileSync(resolve(root, 'src/modules/productos.js'), 'utf8');
  const finanzas = readFileSync(resolve(root, 'src/modules/finanzas.js'), 'utf8');
  const sql = readFileSync(resolve(root, 'supabase/migrations/20261119020000_exigir_caja_abierta_operaciones.sql'), 'utf8');
  assert.match(ventas, /Para registrar una venta, primero abre la caja/);
  assert.match(ventas, /La caja se cerró\. Abre una caja para registrar la venta/);
  assert.match(productos, /Para registrar una compra, primero abre la caja/);
  assert.match(productos, /Para registrar un abono al proveedor, primero abre la caja/);
  assert.match(finanzas, /Para registrar un gasto, primero abre la caja/);
  assert.match(finanzas, /Para liquidar comisiones, primero abre la caja/);
  for (const table of ['ventas', 'pagos', 'compras_inventario', 'gastos', 'pagos_compras_inventario']) {
    assert.match(sql, new RegExp('ON public\\.' + table));
  }
  assert.match(sql, /estado_caja = 'ABIERTA'/);
  assert.match(sql, /NEW\.caja_id IS NULL/);
});

test('el catálogo de productos incorpora imágenes y pedidos públicos sin mover inventario', () => {
  const productos = readFileSync(resolve(root, 'src/modules/productos.js'), 'utf8');
  const publico = readFileSync(resolve(root, 'src/pages/reservar.js'), 'utf8');
  const sql = readFileSync(resolve(root, 'supabase/migrations/20261119030000_catalogo_visual_pedidos_productos.sql'), 'utf8');
  const index = readFileSync(resolve(root, 'index.html'), 'utf8');
  assert.match(productos, /storage\.from\('productos'\)\.upload/);
  assert.match(productos, /data-tab="pedidos"/);
  assert.match(productos, /pedidos_productos/);
  assert.match(publico, /catalogo_productos_publico/);
  assert.match(publico, /crear_pedido_producto_publico/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.pedidos_productos/);
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.crear_pedido_producto_publico/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.crear_pedido_producto_publico.*TO anon,authenticated/);
  assert.match(sql, /imagen_url/);
  assert.match(index, /\.product-grid/);
});


test('pedidos a proveedores no se confunden con compras ni modifican stock', () => {
  const productos = readFileSync(resolve(root, 'src/modules/productos.js'), 'utf8');
  const sql = readFileSync(resolve(root, 'supabase/migrations/20261120000000_pedidos_proveedores_notificaciones.sql'), 'utf8');
  assert.match(productos, /async function pedidoProveedorForm/);
  assert.match(productos, /from\('pedidos_proveedores'\)/);
  assert.match(productos, /generarPdfPedido/);
  assert.match(productos, /navigator\.share/);
  assert.match(productos, /Stock ideal/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.pedidos_proveedores/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.detalle_pedidos_proveedores/);
  assert.match(sql, /estado IN \('BORRADOR','ENVIADO','RECIBIDO','CANCELADO'\)/);
});

test('proveedores solo solicitan nombre y teléfono desde el formulario', () => {
  const productos = readFileSync(resolve(root, 'src/modules/productos.js'), 'utf8');
  const form = productos.slice(productos.indexOf('async function proveedorForm'), productos.indexOf('async function compraForm'));
  assert.match(form, /name="nombre"/);
  assert.match(form, /name="telefono"/);
  assert.doesNotMatch(form, /name="correo"|name="documento"|name="direccion"/);
});

test('preferencias y centro de notificaciones están integrados y cacheados', () => {
  const index = readFileSync(resolve(root, 'index.html'), 'utf8');
  const ajustes = readFileSync(resolve(root, 'src/modules/ajustes.js'), 'utf8');
  const notif = readFileSync(resolve(root, 'src/modules/notificaciones.js'), 'utf8');
  const sql = readFileSync(resolve(root, 'supabase/migrations/20261120000000_pedidos_proveedores_notificaciones.sql'), 'utf8');
  const sw = readFileSync(resolve(root, 'sw.js'), 'utf8');
  assert.match(index, /crearModuloNotificaciones/);
  assert.match(index, /campana-notificaciones/);
  assert.match(ajustes, /citas_30m/);
  assert.match(ajustes, /stock_agotado/);
  assert.match(notif, /setInterval\(revisar,60000\)/);
  assert.match(notif, /from\('citas'\)/);
  assert.match(notif, /from\('stock_actual'\)/);
  assert.match(sql, /preferencias_notificaciones/);
  assert.match(sw, /src\/modules\/notificaciones\.js/);
});


test('las comisiones nuevas guardan porcentaje y base neta, sin comisión en productos', () => {
  const ventas = readFileSync(resolve(root, 'src/modules/ventas.js'), 'utf8');
  const finanzas = readFileSync(resolve(root, 'src/modules/finanzas.js'), 'utf8');
  const sql = readFileSync(resolve(root, 'supabase/migrations/20261121000000_comisiones_perfiles_barberos.sql'), 'utf8');
  assert.match(ventas, /porcentaje_comision_aplicado:porcentaje/);
  assert.match(ventas, /base_comision:base/);
  assert.match(ventas, /const brutoLinea=l\.i\.p\*l\.q/);
  assert.match(ventas, /c\.ds\*brutoLinea\/c\.br/);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS porcentaje_comision_aplicado/);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS base_comision/);
  assert.match(sql, /UPDATE public\.barberos SET porcentaje_comision = 65/);
  assert.match(sql, /SET DEFAULT 65/);
  assert.match(sql, /No se puede editar: esta venta tiene comisiones liquidadas/);
  assert.match(sql, /No se puede editar para evitar cambiar retroactivamente su comisión/);
  assert.match(finanzas, /valor_base:x\.base_comision\?\?x\.subtotal/);
});

test('los perfiles de barberos permiten fotografía privada de administración y lectura propia', () => {
  const catalogos = readFileSync(resolve(root, 'src/modules/catalogos.js'), 'utf8');
  const equipo = readFileSync(resolve(root, 'src/modules/equipo.js'), 'utf8');
  const index = readFileSync(resolve(root, 'index.html'), 'utf8');
  const sql = readFileSync(resolve(root, 'supabase/migrations/20261121000000_comisiones_perfiles_barberos.sql'), 'utf8');
  const sw = readFileSync(resolve(root, 'sw.js'), 'utf8');
  assert.match(catalogos, /storage\.from\('barberos'\)\.upload/);
  assert.match(catalogos, /max="100"/);
  assert.match(catalogos, /n==='porcentaje_comision'\?65/);
  assert.match(equipo, /async function miPerfil\(\)/);
  assert.match(equipo, /S\.perfil\.barbero_id/);
  assert.match(index, /miperfil:miPerfil/);
  assert.match(sql, /CREATE POLICY barberos_perfil_propio/);
  assert.match(sql, /barberos_fotos_insertar/);
  assert.match(sw, /barberia-v19/);
});


test('la reserva pública entrega un enlace privado y excluye el cargo de cita de comisiones', () => {
  const publico = readFileSync(resolve(root, 'src/pages/reservar.js'), 'utf8');
  const ventas = readFileSync(resolve(root, 'src/modules/ventas.js'), 'utf8');
  const sql = readFileSync(resolve(root, 'supabase/migrations/20261122000000_agenda_publica_segura.sql'), 'utf8');
  assert.match(publico, /const\{data,error\}=await sb\.rpc\('reservar_cita_publica'/);
  assert.match(publico, /gestion\.searchParams\.set\('t',data\.token\)/);
  assert.match(publico, /Ver, cancelar o cambiar mi cita/);
  assert.match(sql, /RETURNS jsonb/);
  assert.match(sql, /'cita_id', cita, 'token', token_privado/);
  assert.match(sql, /AND acepta_citas/);
  assert.match(ventas, /sv\.categoria!=='CITA'/);
  assert.match(sql, /s\.categoria IS DISTINCT FROM 'CITA'/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.reservar_cita_publica.*TO anon, authenticated/);
});
