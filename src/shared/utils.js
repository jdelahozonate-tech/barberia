// Utilidades compartidas de presentación y normalización.
// Mantener estas funciones puras: no deben depender del DOM ni de Supabase.

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]));

export const fecha = d =>
  d.getFullYear() + '-' +
  String(d.getMonth() + 1).padStart(2, '0') + '-' +
  String(d.getDate()).padStart(2, '0');

export const hora = d =>
  new Date(d).toLocaleTimeString('es-CO', {
    hour: '2-digit',
    minute: '2-digit'
  });

export const bonito = s => {
  s = String(s ?? '').replace(/_/g, ' ').toLowerCase();
  return s ? s[0].toUpperCase() + s.slice(1) : '';
};

export const slug = s =>
  String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '').slice(0, 40);

export const traducir = m => {
  m = String(m ?? '');
  return m.includes('Invalid login') ? 'Correo o contraseña incorrectos.'
    : m.includes('not confirmed') ? 'Confirma tu correo antes de entrar.'
    : m.includes('already registered') ? 'Ese correo ya tiene cuenta. Entra con tu contraseña.'
    : m.includes('sin_cruce_cliente') ? 'Ese cliente ya tiene una cita a esa hora.'
    : m.includes('exclusion') ? 'Ese barbero ya tiene una cita en ese horario.'
    : m.includes('duplicate key') ? 'Ese enlace ya está en uso, prueba otro.'
    : m;
};

export const waNum = t => {
  t = String(t || '').replace(/\D/g, '');
  return t.length === 10 ? '57' + t : t;
};
