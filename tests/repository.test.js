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
  'src/modules/catalogos.js',
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
  assert.match(inicio, /async function todos\(q\)/);
  assert.match(inicio, /q\.range\(desde,desde\+999\)/);
  assert.match(inicio, /if\(bloque\.length<1000\)break/);
  assert.match(inicio, /\]\.map\(todos\)\)/);
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
