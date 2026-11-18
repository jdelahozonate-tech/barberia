// Cliente compartido de Supabase para todas las pantallas.
// La librería UMD se carga desde CDN antes de los módulos de cada HTML.
const SUPABASE_URL = "https://gjqobyjebalbscgozvpa.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_lEZmkS6mVv7WdiM3u4upeA_m64a4zM6";

if (!globalThis.supabase?.createClient) {
  throw new Error("No se pudo cargar la librería de Supabase.");
}

export const sb = globalThis.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);
