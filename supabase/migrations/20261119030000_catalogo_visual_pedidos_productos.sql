-- Catálogo visual y pedidos públicos de productos.
-- Los pedidos no descuentan inventario ni mueven caja: solo se registran como solicitudes.
ALTER TABLE public.productos
 ADD COLUMN IF NOT EXISTS imagen_url text;

CREATE TABLE IF NOT EXISTS public.pedidos_productos (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 negocio_id uuid NOT NULL REFERENCES public.negocios(id) ON DELETE CASCADE,
 nombre_cliente text NOT NULL CHECK (length(btrim(nombre_cliente)) BETWEEN 2 AND 120),
 telefono_cliente text NOT NULL CHECK (length(btrim(telefono_cliente)) BETWEEN 7 AND 30),
 estado text NOT NULL DEFAULT 'NUEVO'
  CHECK (estado IN ('NUEVO','EN_PREPARACION','LISTO','ENTREGADO','CANCELADO')),
 total numeric(14,2) NOT NULL DEFAULT 0 CHECK (total >= 0),
 notas text,
 creado_en timestamptz NOT NULL DEFAULT now(),
 actualizado_en timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pedidos_productos_negocio_fecha
 ON public.pedidos_productos(negocio_id, creado_en DESC);

CREATE TABLE IF NOT EXISTS public.detalle_pedidos_productos (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 pedido_id uuid NOT NULL REFERENCES public.pedidos_productos(id) ON DELETE CASCADE,
 negocio_id uuid NOT NULL REFERENCES public.negocios(id) ON DELETE CASCADE,
 producto_id uuid NOT NULL REFERENCES public.productos(id) ON DELETE RESTRICT,
 nombre_producto text NOT NULL,
 cantidad integer NOT NULL CHECK (cantidad > 0 AND cantidad <= 99),
 precio_unitario numeric(14,2) NOT NULL CHECK (precio_unitario >= 0),
 subtotal numeric(14,2) GENERATED ALWAYS AS (round(cantidad * precio_unitario,2)) STORED
);
CREATE INDEX IF NOT EXISTS idx_detalle_pedidos_productos_pedido
 ON public.detalle_pedidos_productos(negocio_id,pedido_id);

ALTER TABLE public.pedidos_productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.detalle_pedidos_productos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pedidos_productos_admin ON public.pedidos_productos;
CREATE POLICY pedidos_productos_admin ON public.pedidos_productos
 FOR SELECT TO authenticated
 USING (negocio_id = public.mi_negocio()
   AND COALESCE(public.mi_rol(),'') IN ('ADMINISTRADOR','SUPERVISOR','BARBERO'));
DROP POLICY IF EXISTS pedidos_productos_actualizar ON public.pedidos_productos;
CREATE POLICY pedidos_productos_actualizar ON public.pedidos_productos
 FOR UPDATE TO authenticated
 USING (negocio_id = public.mi_negocio()
   AND COALESCE(public.mi_rol(),'') IN ('ADMINISTRADOR','SUPERVISOR','BARBERO'))
 WITH CHECK (negocio_id = public.mi_negocio()
   AND COALESCE(public.mi_rol(),'') IN ('ADMINISTRADOR','SUPERVISOR','BARBERO'));
DROP POLICY IF EXISTS detalle_pedidos_productos_admin ON public.detalle_pedidos_productos;
CREATE POLICY detalle_pedidos_productos_admin ON public.detalle_pedidos_productos
 FOR SELECT TO authenticated
 USING (negocio_id = public.mi_negocio()
   AND COALESCE(public.mi_rol(),'') IN ('ADMINISTRADOR','SUPERVISOR','BARBERO'));

GRANT SELECT, UPDATE ON public.pedidos_productos TO authenticated;
GRANT SELECT ON public.detalle_pedidos_productos TO authenticated;

-- Bucket público solo para mostrar imágenes; escritura restringida al negocio propietario.
INSERT INTO storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
VALUES ('productos','productos',true,5242880,ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO UPDATE SET public=true,file_size_limit=5242880,
 allowed_mime_types=ARRAY['image/jpeg','image/png','image/webp'];

DROP POLICY IF EXISTS productos_imagenes_lectura ON storage.objects;
CREATE POLICY productos_imagenes_lectura ON storage.objects
 FOR SELECT TO public USING (bucket_id='productos');
DROP POLICY IF EXISTS productos_imagenes_insertar ON storage.objects;
CREATE POLICY productos_imagenes_insertar ON storage.objects
 FOR INSERT TO authenticated WITH CHECK (
  bucket_id='productos'
  AND (storage.foldername(name))[1]=public.mi_negocio()::text
  AND COALESCE(public.mi_rol(),'') IN ('ADMINISTRADOR','SUPERVISOR')
 );
DROP POLICY IF EXISTS productos_imagenes_actualizar ON storage.objects;
CREATE POLICY productos_imagenes_actualizar ON storage.objects
 FOR UPDATE TO authenticated USING (
  bucket_id='productos'
  AND (storage.foldername(name))[1]=public.mi_negocio()::text
  AND COALESCE(public.mi_rol(),'') IN ('ADMINISTRADOR','SUPERVISOR')
 ) WITH CHECK (
  bucket_id='productos'
  AND (storage.foldername(name))[1]=public.mi_negocio()::text
  AND COALESCE(public.mi_rol(),'') IN ('ADMINISTRADOR','SUPERVISOR')
 );
DROP POLICY IF EXISTS productos_imagenes_eliminar ON storage.objects;
CREATE POLICY productos_imagenes_eliminar ON storage.objects
 FOR DELETE TO authenticated USING (
  bucket_id='productos'
  AND (storage.foldername(name))[1]=public.mi_negocio()::text
  AND COALESCE(public.mi_rol(),'') IN ('ADMINISTRADOR','SUPERVISOR')
 );

CREATE OR REPLACE FUNCTION public.catalogo_productos_publico(p_slug text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path=public,pg_temp
AS $$
DECLARE v_negocio uuid; v_result jsonb;
BEGIN
 SELECT id INTO v_negocio FROM public.negocios WHERE slug=p_slug LIMIT 1;
 IF v_negocio IS NULL THEN RETURN '[]'::jsonb; END IF;
 SELECT COALESCE(jsonb_agg(jsonb_build_object(
  'id',p.id,'nombre',p.nombre,'categoria',p.categoria,
  'descripcion',p.descripcion,'precio_venta',p.precio_venta,
  'imagen_url',p.imagen_url,
  'disponible',CASE WHEN p.control_stock IS FALSE THEN true
   ELSE COALESCE(st.existencias,0)>0 END
 ) ORDER BY p.nombre),'[]'::jsonb)
 INTO v_result
 FROM public.productos p
 LEFT JOIN public.stock_actual st ON st.producto_id=p.id AND st.negocio_id=p.negocio_id
 WHERE p.negocio_id=v_negocio AND p.estado='ACTIVO'
   AND (p.control_stock IS FALSE OR COALESCE(st.existencias,0)>0);
 RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.crear_pedido_producto_publico(
 p_slug text,p_nombre text,p_telefono text,p_items jsonb,p_notas text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public,pg_temp
AS $$
DECLARE v_negocio uuid; v_pedido uuid; v_item record; v_producto public.productos%ROWTYPE;
 v_stock numeric; v_total numeric(14,2):=0;
BEGIN
 IF length(btrim(COALESCE(p_nombre,''))) NOT BETWEEN 2 AND 120
  OR length(regexp_replace(COALESCE(p_telefono,''),'[^0-9+]','','g')) NOT BETWEEN 7 AND 30 THEN
  RAISE EXCEPTION 'Escribe un nombre y teléfono válidos.';
 END IF;
 IF p_items IS NULL OR jsonb_typeof(p_items)<>'array'
  OR jsonb_array_length(p_items)=0 OR jsonb_array_length(p_items)>30 THEN
  RAISE EXCEPTION 'Agrega al menos un producto al pedido.';
 END IF;
 SELECT id INTO v_negocio FROM public.negocios WHERE slug=p_slug LIMIT 1;
 IF v_negocio IS NULL THEN RAISE EXCEPTION 'No encontramos esta barbería.'; END IF;

 FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items)
  AS x(producto_id uuid,cantidad integer)
 LOOP
  IF v_item.producto_id IS NULL OR v_item.cantidad IS NULL
   OR v_item.cantidad<1 OR v_item.cantidad>99 THEN
   RAISE EXCEPTION 'Hay un producto o cantidad inválida.';
  END IF;
  SELECT * INTO v_producto FROM public.productos
   WHERE id=v_item.producto_id AND negocio_id=v_negocio AND estado='ACTIVO';
  IF NOT FOUND THEN RAISE EXCEPTION 'Uno de los productos ya no está disponible.'; END IF;
  SELECT COALESCE(existencias,0) INTO v_stock FROM public.stock_actual
   WHERE producto_id=v_producto.id AND negocio_id=v_negocio;
  IF COALESCE(v_producto.control_stock,true) AND COALESCE(v_stock,0)<v_item.cantidad THEN
   RAISE EXCEPTION 'No hay existencias suficientes de %.',v_producto.nombre;
  END IF;
  v_total:=v_total+round(v_producto.precio_venta*v_item.cantidad,2);
 END LOOP;

 INSERT INTO public.pedidos_productos(negocio_id,nombre_cliente,telefono_cliente,total,notas)
 VALUES(v_negocio,btrim(p_nombre),btrim(p_telefono),v_total,NULLIF(btrim(COALESCE(p_notas,'')),''))
 RETURNING id INTO v_pedido;

 FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items)
  AS x(producto_id uuid,cantidad integer)
 LOOP
  SELECT * INTO v_producto FROM public.productos
   WHERE id=v_item.producto_id AND negocio_id=v_negocio AND estado='ACTIVO';
  INSERT INTO public.detalle_pedidos_productos(
   pedido_id,negocio_id,producto_id,nombre_producto,cantidad,precio_unitario
  ) VALUES(v_pedido,v_negocio,v_producto.id,v_producto.nombre,v_item.cantidad,v_producto.precio_venta);
 END LOOP;
 RETURN v_pedido;
END;
$$;

REVOKE ALL ON FUNCTION public.catalogo_productos_publico(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.crear_pedido_producto_publico(text,text,text,jsonb,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.catalogo_productos_publico(text) TO anon,authenticated;
GRANT EXECUTE ON FUNCTION public.crear_pedido_producto_publico(text,text,text,jsonb,text) TO anon,authenticated;

-- Permite usar el enlace de productos aunque la barbería no tenga activadas las reservas.
CREATE OR REPLACE FUNCTION public.negocio_productos_publico(p_slug text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path=public,pg_temp
AS $$
 SELECT CASE WHEN n.id IS NULL THEN NULL ELSE jsonb_build_object(
  'negocio',jsonb_build_object('nombre',n.nombre,'logo_url',n.logo_url,
   'direccion',n.direccion,'telefono',n.telefono,'valor_cita',n.valor_cita),
  'servicios','[]'::jsonb,'barberos','[]'::jsonb
 ) END
 FROM (SELECT id,nombre,logo_url,direccion,telefono,valor_cita
       FROM public.negocios WHERE slug=p_slug LIMIT 1) n;
$$;
REVOKE ALL ON FUNCTION public.negocio_productos_publico(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.negocio_productos_publico(text) TO anon,authenticated;
