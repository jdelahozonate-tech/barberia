import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import vm from 'node:vm';
import { crearModuloVentas } from '../src/modules/ventas.js';

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
    S: {},
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
