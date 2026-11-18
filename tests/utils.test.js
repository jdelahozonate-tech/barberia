import test from 'node:test';
import assert from 'node:assert/strict';
import { esc, fecha, bonito, slug, traducir, waNum } from '../src/shared/utils.js';

test('escapa caracteres HTML', () => {
  assert.equal(esc(`<script a="b">'&</script>`), '&lt;script a=&quot;b&quot;&gt;&#39;&amp;&lt;/script&gt;');
});

test('formatea fechas locales como YYYY-MM-DD', () => {
  assert.equal(fecha(new Date(2026, 0, 9)), '2026-01-09');
});

test('convierte estados técnicos en etiquetas legibles', () => {
  assert.equal(bonito('NO_ASISTIO'), 'No asistio');
  assert.equal(bonito(''), '');
});

test('normaliza slugs con tildes y caracteres especiales', () => {
  assert.equal(slug('Barbería Ñandú Centro'), 'barberia-nandu-centro');
});

test('traduce errores conocidos de autenticación y agenda', () => {
  assert.equal(traducir('Invalid login credentials'), 'Correo o contraseña incorrectos.');
  assert.equal(traducir('sin_cruce_cliente'), 'Ese cliente ya tiene una cita a esa hora.');
});

test('normaliza teléfonos colombianos para WhatsApp', () => {
  assert.equal(waNum('300 123 4567'), '573001234567');
  assert.equal(waNum('+57 300 123 4567'), '573001234567');
});
