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
  'src/modules/reportes.js',
  'src/modules/catalogos.js',
  'src/modules/productos.js',
  'src/modules/pedidos.js',
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


test('la navegación móvil usa un menú lateral y muestra la foto existente del usuario', () => {
  const index = readFileSync(resolve(root, 'index.html'), 'utf8');
  const acceso = readFileSync(resolve(root, 'src/modules/acceso.js'), 'utf8');
  assert.ok(index.includes('id="menu-toggle"'));
  assert.ok(index.includes('class="nav-backdrop"'));
  assert.ok(index.includes('nav.nav.open'));
  assert.ok(index.includes('translateX(-105%)'));
  assert.ok(index.includes('class="nav-profile"'));
  assert.ok(index.includes('S.perfil.foto_url'));
  assert.ok(index.includes('main{padding:16px 14px 28px}'));
  assert.ok(acceso.includes('p.foto_url||p.avatar_url'));
  assert.ok(acceso.includes("from('barberos').select('foto_url')"));
  assert.ok(acceso.includes(".ilike('correo',auth.user.email)"));
  assert.ok(acceso.includes("else if(auth.user.email)"));
  assert.ok(acceso.includes('S.perfil={...p,foto_url:fotoPerfil}'));
});

test('Pedidos gestiona las órdenes de compra de la barbería a proveedores', () => {
  const pedidos = readFileSync(resolve(root, 'src/modules/pedidos.js'), 'utf8');
  const productos = readFileSync(resolve(root, 'src/modules/productos.js'), 'utf8');
  const index = readFileSync(resolve(root, 'index.html'), 'utf8');
  assert.match(pedidos, /pedidos_proveedores/);
  assert.match(pedidos, /detalle_pedidos_proveedores/);
  assert.match(pedidos, /ENVIADO/);
  assert.match(pedidos, /RECIBIDO/);
  assert.match(pedidos, /registrar recepción/i);
  assert.doesNotMatch(pedidos, /pedidos_productos/);
  assert.doesNotMatch(pedidos, /detalle_pedidos_productos/);
  assert.doesNotMatch(productos.slice(productos.indexOf('const tabs='), productos.indexOf('async function productosVista')), /pedido_proveedor/);
  assert.match(index, /crearModuloPedidos/);
  assert.match(index, /pedidos: pedidosProductos/);
});

test('Agenda bloquea citas y reprogramaciones con fecha u hora pasada', () => {
  const agenda = readFileSync(resolve(root, 'src/modules/agenda.js'), 'utf8');
  assert.match(agenda, /function validarInicioFuturo/);
  assert.match(agenda, /min=.*valorLocal\(new Date\(\)\)/);
  assert.equal((agenda.match(/validarInicioFuturo\(i\)/g) || []).length, 2);
  assert.match(agenda, /Selecciona un horario futuro/);
});

test('Ventas genera y comparte el comprobante como imagen JPG, no como PDF', () => {
  const ventas = readFileSync(resolve(root, 'src/modules/ventas.js'), 'utf8');
  assert.match(ventas, /Registrar saldo pendiente \(fiado\)/);
  assert.match(ventas, /async function generarImagenComprobante/);
  assert.match(ventas, /async function cargarLogoComprobante/);
  assert.match(ventas, /function imagenComprobante\(datosVenta,logo\)/);
  assert.match(ventas, /COMPROBANTE DE VENTA/);
  assert.match(ventas, /SALDO PENDIENTE/);
  assert.match(ventas, /canvas\.toBlob/);
  assert.match(ventas, /type:'image\/jpeg'/);
  assert.match(ventas, /new File\(\[blob\],nombreArchivo,\{type:'image\/jpeg'\}\)/);
  assert.match(ventas, /navigator\.canShare/);
  assert.match(ventas, /ESTADO DE CUENTA/);
  assert.match(ventas, /Saldo pendiente/);
  assert.match(ventas, /No sustituye una factura electrónica/);
  assert.match(ventas, /id="shareimage"/);
  assert.match(ventas, /id="image"/);
  assert.doesNotMatch(ventas, /application\/pdf|generarFacturaPDF|pdfTextoFactura|Descargar PDF|Compartir PDF/);
  assert.doesNotMatch(ventas, /window\.print\(/);
  assert.doesNotMatch(ventas, /window\.open\('about:blank'/);
  assert.doesNotMatch(ventas, /cdnjs\.cloudflare\.com\/ajax\/libs\/jspdf/);
});

test('La anulación de ventas exige la misma caja abierta del turno', () => {
  const ventas = readFileSync(resolve(root, 'src/modules/ventas.js'), 'utf8');
  const sql = readFileSync(resolve(root, 'supabase/migrations/20261120050000_ventas_caja_activa_anulacion.sql'), 'utf8');
  assert.match(ventas, /v\.caja_id===cajaActiva\.id/);
  assert.match(ventas, /No se puede anular desde la caja actual/);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS caja_id uuid/);
  assert.match(sql, /CREATE TRIGGER trg_asignar_caja_venta/);
  assert.match(sql, /v_caja_venta <> v_caja_actual/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public.asignar_caja_venta/);
  assert.match(sql, /caja cerrada o a otro turno/);
});

test('Liquidaciones de barberos gestionan comisiones pagadas, anticipos, descuentos y abonos', () => {
  const finanzas = readFileSync(resolve(root, 'src/modules/finanzas.js'), 'utf8');
  const index = readFileSync(resolve(root, 'index.html'), 'utf8');
  const sql = readFileSync(resolve(root, 'supabase/migrations/20261120070000_liquidaciones_profesionales_barberos.sql'), 'utf8');
  assert.match(finanzas, /function prepararLiquidacion/);
  assert.match(finanzas, /registrar_anticipo_barbero/);
  assert.match(finanzas, /registrar_abono_liquidacion_barbero/);
  assert.match(finanzas, /total_descuentos/);
  assert.match(index, /\['comisiones','Liquidaciones',1\]/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.liquidaciones_barbero/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.movimientos_liquidacion_barbero/);
  assert.match(sql, /estado_venta = 'PAGADA'/);
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.liquidar_barbero/);
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.registrar_anticipo_barbero/);
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.registrar_abono_liquidacion_barbero/);
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/);
});

test('Reportes ofrece informes gerenciales y exportación PDF y Excel', () => {
  const reportes = readFileSync(resolve(root, 'src/modules/reportes.js'), 'utf8');
  const index = readFileSync(resolve(root, 'index.html'), 'utf8');
  const sw = readFileSync(resolve(root, 'sw.js'), 'utf8');
  assert.match(reportes, /\['VENTAS','Ventas'\]/);
  assert.match(reportes, /\['PAGOS','Recaudos y medios de pago'\]/);
  assert.match(reportes, /\['CARTERA','Cartera de clientes'\]/);
  assert.match(reportes, /\['LIQUIDACIONES','Liquidaciones de barberos'\]/);
  assert.match(reportes, /\['PEDIDOS','Pedidos a proveedores'\]/);
  assert.match(reportes, /async function consultar/);
  assert.match(reportes, /async function exportarPDF/);
  assert.match(reportes, /async function exportarExcel/);
  assert.match(reportes, /xlsx\.full\.min\.js/);
  assert.match(reportes, /jspdf\.umd\.min\.js/);
  assert.match(reportes, /\.range\(desde,desde\+999\)/);
  assert.match(index, /\['reportes','Reportes',1\]/);
  assert.match(index, /crearModuloReportes/);
  assert.match(sw, /src\/modules\/reportes\.js/);
  assert.match(sw, /barberia-v24/);
});

test('Las comisiones históricas de ventas no pagadas se limpian', () => {
  const sql = readFileSync(resolve(root, 'supabase/migrations/20261120090000_comisiones_solo_ventas_pagadas.sql'), 'utf8');
  assert.match(sql, /v\.estado_venta <> 'PAGADA'/);
  assert.match(sql, /SET comision_generada = 0/);
  assert.match(sql, /d\.base_comision IS NOT NULL/);
});

test('Agenda bloquea citas y reprogramaciones en horarios pasados desde la base de datos', () => {
  const agenda = readFileSync(resolve(root, 'src/modules/agenda.js'), 'utf8');
  const sql = readFileSync(resolve(root, 'supabase/migrations/20261120100000_agenda_validar_horarios_futuros.sql'), 'utf8');
  assert.match(agenda, /validarInicioFuturo/);
  assert.match(agenda, /type="datetime-local" min=/);
  assert.match(sql, /CREATE TRIGGER trg_citas_bloquear_horarios_pasados/);
  assert.match(sql, /NEW\.inicio <= clock_timestamp\(\)/);
  assert.match(sql, /NEW\.estado IN \('PENDIENTE','CONFIRMADA'\)/);
});

test('La regla de comisión también limpia servicios históricos sin desglose', () => {
  const sql = readFileSync(resolve(root, 'supabase/migrations/20261120110000_comisiones_legacy_no_pagadas.sql'), 'utf8');
  assert.match(sql, /IF NEW\.tipo_item = 'SERVICIO' THEN/);
  assert.match(sql, /WHEN NEW\.estado_venta <> 'PAGADA'/);
  assert.match(sql, /d\.comision_generada > 0/);
});

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

test('el módulo de ventas aplica el filtro del barbero a ventas y citas atendidas', async () => {
  let aplicado = 0;
  const tablas = [];
  const query = {
    select() { return this; },
    eq() { return this; },
    gte() { return this; },
    lt() { return this; },
    in() { return this; },
    neq() { return this; },
    order() { return this; },
    limit() { return Promise.resolve({ data: [], error: null }); }
  };
  const previo = globalThis.document;
  globalThis.document = { querySelectorAll: () => [] };
  try {
    const modulo = crearModuloVentas({
      $: () => ({ innerHTML: '' }),
      dlg: {},
      sb: { from: tabla => { tablas.push(tabla); return query; } },
      S: { perfil: { negocio_id: 'negocio-test' } },
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
    assert.deepEqual(tablas, ['ventas', 'citas']);
    assert.equal(aplicado, 2);
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
  assert.match(agenda, /const cambios=\{estado:f\.estado[\s\S]*?update\(cambios\)\.eq\('negocio_id',S\.perfil\.negocio_id\)/);
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


test('Agenda ofrece vistas de día, semana y mes y filtro por barbero', () => {
  const agenda = readFileSync(resolve(root, 'src/modules/agenda.js'), 'utf8');
  assert.match(agenda, /option value="dia"/);
  assert.match(agenda, /option value="semana"/);
  assert.match(agenda, /option value="mes"/);
  assert.match(agenda, /id="fb"/);
  assert.match(agenda, /eq\('barbero_id',S\.barberoAgenda\)/);
  assert.match(agenda, /agenda-mes/);
});
test('Agenda administrativa valida turnos, ausencias y cruces antes de crear o reprogramar', () => {
  const agenda = readFileSync(resolve(root, 'src/modules/agenda.js'), 'utf8');
  assert.match(agenda, /async function validarDisponibilidad/);
  assert.match(agenda, /from\('horarios_barbero'\)[\s\S]*?dia_semana/);
  assert.match(agenda, /from\('ausencias_barbero'\)[\s\S]*?\.lt\('desde',fin\)\.gt\('hasta',inicio\)/);
  assert.match(agenda, /\.in\('estado',\['PENDIENTE','CONFIRMADA'\]\)/);
  assert.match(agenda, /from\('citas'\)[\s\S]*?eq\('cliente_id',cliente\)/);
  assert.match(agenda, /instanteNegocio\(f\.inicio\)/);
  assert.match(agenda, /cambios\.inicio=i\.toISOString\(\);cambios\.fin=fin\.toISOString\(\)/);
  assert.match(agenda, /cambioHorario\?'Cita reprogramada'/);
});
test('las RPC públicas de Agenda no quedan ejecutables por el rol PUBLIC', () => {
  const sql = readFileSync(resolve(root, 'supabase/migrations/20261119040000_agenda_publica_permisos.sql'), 'utf8');
  for (const fn of ['cita_publica', 'horas_libres_publicas', 'reprogramar_cita_publica', 'reservar_cita_publica', 'responder_cita_publica']) {
    assert.match(sql, new RegExp('REVOKE ALL ON FUNCTION public\\.' + fn + '\\('));
    assert.match(sql, new RegExp('GRANT EXECUTE ON FUNCTION public\\.' + fn + '.*TO anon, authenticated, service_role'));
  }
});

test('la reserva pública entrega el enlace privado usando el token devuelto por Supabase', () => {
  const reservar = readFileSync(resolve(root, 'src/pages/reservar.js'), 'utf8');
  assert.match(reservar, /const\{data,error\}=await sb\.rpc\('reservar_cita_publica'/);
  assert.match(reservar, /typeof data\?\.token==='string'/);
  assert.match(reservar, /new URL\('cita\.html',location\.href\)/);
  assert.match(reservar, /enlace\.searchParams\.set\('t',token\)/);
  assert.match(reservar, /Consultar, confirmar o cambiar mi cita/);
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
  assert.match(index, /const \{ productos \} = crearModuloProductos/);
  assert.match(index, /pedidos: pedidosProductos/);
  assert.match(sw, /src\/modules\/productos\.js/);
  assert.match(sw, /barberia-v24/);
  assert.match(sw, /src\/modules\/pedidos\.js/);
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
  assert.match(finanzas, /Abre Caja para registrar el pago/);
  assert.match(finanzas, /registrar_abono_liquidacion_barbero/);
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
  const pedidos = readFileSync(resolve(root, 'src/modules/pedidos.js'), 'utf8');
  assert.doesNotMatch(productos, /Pedidos de clientes/);
  assert.doesNotMatch(pedidos, /pedidos_productos/);
  assert.match(pedidos, /pedidos_proveedores/);
  assert.match(publico, /catalogo_productos_publico/);
  assert.match(publico, /crear_pedido_producto_publico/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.pedidos_productos/);
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.crear_pedido_producto_publico/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.crear_pedido_producto_publico.*TO anon,authenticated/);
  assert.match(sql, /imagen_url/);
  assert.match(index, /\.product-grid/);
});


test('los pedidos a proveedores se administran desde Pedidos y no descuentan stock al crearse', () => {
  const productos = readFileSync(resolve(root, 'src/modules/productos.js'), 'utf8');
  const ventas = readFileSync(resolve(root, 'src/modules/ventas.js'), 'utf8');
  const pedidos = readFileSync(resolve(root, 'src/modules/pedidos.js'), 'utf8');
  const sql = readFileSync(resolve(root, 'supabase/migrations/20261120000000_pedidos_proveedores_notificaciones.sql'), 'utf8');
  const recepcion = readFileSync(resolve(root, 'supabase/migrations/20261120080000_pedidos_proveedores_recepcion.sql'), 'utf8');
  assert.match(pedidos, /pdfTexto/);
  assert.match(ventas, /navigator\.canShare/);
  assert.match(pedidos, /recibir_pedido_proveedor/);
  assert.match(pedidos, /Confirmar recepción e ingresar inventario/);
  assert.doesNotMatch(productos.slice(productos.indexOf('const tabs='), productos.indexOf('async function productosVista')), /pedido_proveedor/);
  assert.match(productos, /Stock ideal/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.pedidos_proveedores/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.detalle_pedidos_proveedores/);
  assert.match(sql, /estado IN \('BORRADOR','ENVIADO','RECIBIDO','CANCELADO'\)/);
  assert.match(recepcion, /registrar_compra_inventario/);
  assert.match(recepcion, /compra_id=v_compra/);
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
  const liquidaciones = readFileSync(resolve(root, 'supabase/migrations/20261120070000_liquidaciones_profesionales_barberos.sql'), 'utf8');
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
  assert.match(liquidaciones, /COALESCE\(d\.base_comision,d\.subtotal,0\)/);
  assert.match(liquidaciones, /d\.porcentaje_comision_aplicado/);
});

test('los perfiles de barberos permiten fotografía privada de administración y lectura propia', () => {
  const catalogos = readFileSync(resolve(root, 'src/modules/catalogos.js'), 'utf8');
  const equipo = readFileSync(resolve(root, 'src/modules/equipo.js'), 'utf8');
  const index = readFileSync(resolve(root, 'index.html'), 'utf8');
  const sql = readFileSync(resolve(root, 'supabase/migrations/20261121000000_comisiones_perfiles_barberos.sql'), 'utf8');
  const sw = readFileSync(resolve(root, 'sw.js'), 'utf8');
  assert.match(catalogos, /storage\.from\(k==='clientes'\?'clientes':'barberos'\)\.upload/);
  assert.match(catalogos, /max="100"/);
  assert.match(catalogos, /n==='porcentaje_comision'\?65/);
  assert.match(equipo, /async function miPerfil\(\)/);
  assert.match(equipo, /S\.perfil\.barbero_id/);
  assert.match(index, /miperfil:miPerfil/);
  assert.match(sql, /CREATE POLICY barberos_perfil_propio/);
  assert.match(sql, /barberos_fotos_insertar/);
  assert.match(sw, /barberia-v24/);
});



test('los clientes admiten fotografía opcional y muestran avatar cuando no existe', () => {
  const catalogos = readFileSync(resolve(root, 'src/modules/catalogos.js'), 'utf8');
  const sql = readFileSync(resolve(root, 'supabase/migrations/20261119070000_clientes_foto_opcional.sql'), 'utf8');
  assert.match(catalogos, /\['barberos','clientes'\]\.includes\(k\)/);
  assert.match(catalogos, /Fotografía \$\{k==='clientes'\?'del cliente':'del barbero'\} <span class="mute">\(opcional\)<\/span>/);
  assert.match(catalogos, /name="foto_\$\{k\}"/);
  assert.match(catalogos, /storage\.from\(k==='clientes'\?'clientes':'barberos'\)\.upload/);
  assert.match(catalogos, /r\.foto_url\?/);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS foto_url text/);
  assert.match(sql, /clientes_fotos_insertar/);
  assert.match(sql, /public\.mi_negocio\(\)/);
});

test('la disponibilidad y los enlaces privados de Agenda validan el negocio y serializan cambios', () => {
  const sql = readFileSync(resolve(root, 'supabase/migrations/20261119050000_agenda_publica_integridad.sql'), 'utf8');
  const agenda = readFileSync(resolve(root, 'src/modules/agenda.js'), 'utf8');
  assert.match(sql, /categoria IS DISTINCT FROM 'CITA'/);
  assert.match(sql, /FROM public\.horarios_barbero[\s\S]*?negocio_id = n/);
  assert.match(sql, /ci\.negocio_id = n/);
  assert.match(sql, /a\.negocio_id = n/);
  assert.match(sql, /FOR UPDATE/);
  const reprogramar = sql.slice(sql.indexOf('CREATE OR REPLACE FUNCTION public.reprogramar_cita_publica'), sql.indexOf('CREATE OR REPLACE FUNCTION public.responder_cita_publica'));
  assert.match(reprogramar, /SET inicio = p_inicio,[\s\S]*?fin = p_inicio \+ make_interval/);
  assert.doesNotMatch(reprogramar, /estado\s*=\s*'CONFIRMADA'/);
  assert.match(sql, /l::date <> lf::date/);
  assert.match(agenda, /async function agenda\(\)\{\s*const main=\$\('#main'\)/);
});


test('el cobro de citas marca ATENDIDA y permite productos y servicios adicionales', () => {
  const ventas = readFileSync(resolve(root, 'src/modules/ventas.js'), 'utf8');
  assert.match(ventas, /in\('estado',\['PENDIENTE','CONFIRMADA','ATENDIDA'\]\)/);
  assert.match(ventas, /update\(\{estado:'ATENDIDA'\}\)/);
  assert.match(ventas, /tipo==='SERVICIOS'\?x\.k\.startsWith\('s:'\):true/);
  assert.match(ventas, /class="btn sec rm" aria-label="Quitar ítem"/);
  assert.match(ventas, /trg_salida_inventario|tipo_item:s\?'SERVICIO':'PRODUCTO'/);
  assert.match(ventas, /data-filtro-ventas="HOY"/);
  assert.match(ventas, /data-filtro-ventas="SEMANA"/);
  assert.match(ventas, /data-filtro-ventas="MES"/);
  assert.match(ventas, /data-filtro-ventas="PERSONALIZADO"/);
  assert.match(ventas, /gte\('fecha_hora',rango\.desde\)\.lt\('fecha_hora',rango\.hasta\)/);
  assert.match(ventas, /Saldo pendiente:/);
  assert.match(ventas, /Deudor:/);
  assert.match(ventas, /Descuento:/);
});


test('ventas permite filtrar por tipo y distingue visualmente productos, servicios y mixtas', () => {
  const ventas = readFileSync(resolve(root, 'src/modules/ventas.js'), 'utf8');
  assert.match(ventas, /data-tipo-venta="TODOS"/);
  assert.match(ventas, /data-tipo-venta="PRODUCTOS"/);
  assert.match(ventas, /data-tipo-venta="SERVICIOS"/);
  assert.match(ventas, /data-tipo-venta="MIXTA"/);
  assert.match(ventas, /ventasFiltradas=.*\.filter/);
  assert.match(ventas, /tipos\.has\('PRODUCTO'\)/);
  assert.match(ventas, /tipos\.has\('SERVICIO'\)/);
  assert.match(ventas, /return p&&s\?'MIXTA':p\?'PRODUCTOS':s\?'SERVICIOS':'OTRA'/);
  assert.match(ventas, /border-left:4px solid/);
  assert.match(ventas, /etiquetasTipo\[tipo\]/);
});

test('el catálogo de servicios presenta tarjetas, métricas y filtros sin cambiar su CRUD', () => {
  const catalogos = readFileSync(resolve(root, 'src/modules/catalogos.js'), 'utf8');
  const config = readFileSync(resolve(root, 'src/config/catalogos.js'), 'utf8');
  const index = readFileSync(resolve(root, 'index.html'), 'utf8');
  assert.match(catalogos, /services-shell/);
  assert.match(catalogos, /service-stats/);
  assert.match(catalogos, /service-category/);
  assert.match(catalogos, /service-card-description/);
  assert.match(catalogos, /service-duration/);
  assert.match(catalogos, /Mostrar inactivos/);
  assert.match(catalogos, /const esServicios=k==='servicios'/);
  assert.match(catalogos, /insert\(\{\.\.\.o,negocio_id:S\.perfil\.negocio_id\}\)/);
  assert.match(catalogos, /update\(o\)\.eq\('negocio_id',S\.perfil\.negocio_id\)/);
  assert.match(config, /servicios:\{t:'Servicios'/);
  assert.match(config, /\['precio','Precio','number',1\]/);
  assert.match(config, /\['duracion_minutos','Duración \(minutos\)','number',1\]/);
  assert.match(index, /\.services-grid/);
  assert.match(index, /\.service-form-grid/);
  assert.match(index, /@media\(max-width:700px\)[\s\S]*?\.services-grid/);
});

test('Caja permite consultar historial por fechas, ver balances y exportar movimientos', () => {
  const finanzas = readFileSync(resolve(root, 'src/modules/finanzas.js'), 'utf8');
  const index = readFileSync(resolve(root, 'index.html'), 'utf8');
  assert.match(finanzas, /async function historialCaja\(\)/);
  assert.match(finanzas, /CONSULTAS E INFORMES/);
  assert.match(finanzas, /data-cash-period="hoy"/);
  assert.match(finanzas, /data-cash-period="30"/);
  assert.match(finanzas, /Ingresos por medio de pago/);
  assert.match(finanzas, /Exportar CSV/);
  assert.match(finanzas, /cash-report-metrics/);
  assert.match(finanzas, /fecha_apertura/);
  assert.match(finanzas, /fecha_cierre/);
  assert.match(finanzas, /\.range\(desde,desde\+999\)/);
  assert.match(finanzas, /estado_venta!=='ANULADA'/);
  assert.match(index, /\.cash-report-filters/);
  assert.match(index, /\.cash-report-metrics/);
});

test('Caja presenta un panel estructurado de ingresos, egresos, arqueo e historial', () => {
  const finanzas = readFileSync(resolve(root, 'src/modules/finanzas.js'), 'utf8');
  const index = readFileSync(resolve(root, 'index.html'), 'utf8');
  assert.match(finanzas, /cash-shell/);
  assert.match(finanzas, /cash-metrics/);
  assert.match(finanzas, /Efectivo esperado en caja/);
  assert.match(finanzas, /Ingresos por método de pago/);
  assert.match(finanzas, /Movimientos de caja/);
  assert.match(finanzas, /Pagos a proveedores/);
  assert.match(finanzas, /cash-history-grid/);
  assert.match(finanzas, /cash-difference/);
  assert.match(finanzas, /Efectivo contado físicamente/);
  assert.match(finanzas, /\.eq\('caja_id',cj\.id\)/);
  assert.match(finanzas, /const esp=Number\(cj\.saldo_inicial\)\+\(por\.EFECTIVO\|\|0\)-gEf-cEf/);
  assert.match(finanzas, /estado_caja:'CERRADA'/);
  assert.match(finanzas, /diferencia:n-esp/);
  assert.match(index, /\.cash-shell/);
  assert.match(index, /@media\(max-width:760px\)[\s\S]*?\.cash-metrics/);
});


test('el inventario clasifica artículos, calcula utilidad y convierte compras por presentación', () => {
  const productos = readFileSync(resolve(root, 'src/modules/productos.js'), 'utf8');
  const ventas = readFileSync(resolve(root, 'src/modules/ventas.js'), 'utf8');
  const sql = readFileSync(resolve(root, 'supabase/migrations/20261122000000_inventario_profesional.sql'), 'utf8');
  const index = readFileSync(resolve(root, 'index.html'), 'utf8');
  assert.match(productos, /tipo_inventario/);
  assert.match(productos, /PRODUCTO_VENTA/);
  assert.match(productos, /INSUMO/);
  assert.match(productos, /EQUIPO/);
  assert.match(productos, /const utilidad=p=>Number\(p\.precio_venta\|\|0\)-Number\(p\.costo_unitario\|\|0\)/);
  assert.match(productos, /costoUnitario=unidades>0\?costoPaquete\/unidades:0/);
  assert.match(productos, /cantidad:d\.cantidad/);
  assert.match(productos, /name="imagen"/);
  assert.match(ventas, /q=q\.eq\('vendible',true\)/);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS tipo_inventario/);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS vendible boolean NOT NULL DEFAULT true/);
  assert.match(sql, /vendible IS TRUE AND tipo_inventario='PRODUCTO_VENTA'/);
  assert.match(index, /\['productos','Inventario'\]/);
  assert.match(index, /\.inventory-purchase-line/);
});
