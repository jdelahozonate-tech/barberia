-- Fotografía opcional de clientes. Los registros existentes permanecen sin foto.
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS foto_url text;

COMMENT ON COLUMN public.clientes.foto_url IS
  'URL pública opcional de la fotografía del cliente. NULL cuando no se ha cargado una imagen.';

-- Bucket público solo para lectura de fotos; la escritura exige sesión,
-- rol administrativo y una carpeta correspondiente al negocio activo.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('clientes', 'clientes', true, 5242880, ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp'];

DROP POLICY IF EXISTS clientes_fotos_lectura ON storage.objects;
CREATE POLICY clientes_fotos_lectura ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'clientes');

DROP POLICY IF EXISTS clientes_fotos_insertar ON storage.objects;
CREATE POLICY clientes_fotos_insertar ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'clientes'
    AND (storage.foldername(name))[1] = public.mi_negocio()::text
    AND COALESCE(public.mi_rol(), '') IN ('ADMINISTRADOR','SUPERVISOR')
  );
