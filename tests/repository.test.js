import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import vm from 'node:vm';

const root = process.cwd();
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
  'src/modules/ventas.js'
];

test('todos los módulos JavaScript tienen sintaxis válida', () => {
  for (const file of sourceFiles) {
    const code = readFileSync(resolve(root, file), 'utf8')
      .replace(/^export\s+/gm, '');
    assert.doesNotThrow(() => new vm.Script(code, { filename: file }), file);
  }
});

test('las cuatro páginas HTML tienen scripts de módulo válidos', () => {
  for (const file of ['index.html', 'admin.html', 'reservar.html', 'cita.html']) {
    const html = readFileSync(resolve(root, file), 'utf8');
    const match = html.match(/<script type="module">([\s\S]*?)<\/script>/);
    assert.ok(match, file + ': falta script type=module');
    const code = match[1].replace(/^import .*;\s*$/gm, '');
    assert.doesNotThrow(() => new vm.Script(code, { filename: file }), file);
  }
});

test('todas las importaciones locales de las páginas existen', () => {
  for (const file of ['index.html', 'admin.html', 'reservar.html', 'cita.html']) {
    const html = readFileSync(resolve(root, file), 'utf8');
    for (const match of html.matchAll(/from\s+["'](\.\/[^"']+)["']/g)) {
      assert.ok(existsSync(resolve(root, dirname(file), match[1])), file + ': ' + match[1]);
    }
  }
});

test('el service worker precarga todos los módulos importados por index', () => {
  const html = readFileSync(resolve(root, 'index.html'), 'utf8');
  const sw = readFileSync(resolve(root, 'sw.js'), 'utf8');
  for (const match of html.matchAll(/from\s+["'](\.\/[^"']+)["']/g)) {
    assert.ok(sw.includes(match[1].replace(/^\.\//, '')), 'No está en caché: ' + match[1]);
  }
});
