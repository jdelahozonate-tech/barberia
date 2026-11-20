-- Inventario profesional: clasificación patrimonial, control de unidad y venta habilitada.
-- Los artículos existentes se conservan como productos comerciales para no interrumpir ventas.
ALTER TABLE public.productos
 ADD COLUMN IF NOT EXISTS tipo_inventario text NOT NULL DEFAULT 'PRODUCTO_VENTA',
 ADD COLUMN IF NOT EXISTS unidad_medida text NOT NULL DEFAULT 'unidad',
 ADD COLUMN IF NOT EXISTS vendible boolean NOT NULL DEFAULT true,
 ADD COLUMN IF NOT EXISTS valor_actual numeric(14,2) NOT NULL DEFAULT 0;

ALTER TABLE public.productos DROP CONSTRAINT IF EXISTS productos_tipo_inventario_check;
ALTER TABLE public.productos ADD CONSTRAINT productos_tipo_inventario_check
 CHECK (tipo_inventario IN ('PRODUCTO_VENTA','INSUMO','EQUIPO'));
ALTER TABLE public.productos DROP CONSTRAINT IF EXISTS productos_valor_actual_check;
ALTER TABLE public.productos ADD CONSTRAINT productos_valor_actual_check CHECK (valor_actual >= 0);

UPDATE public.productos SET tipo_inventario='PRODUCTO_VENTA',unidad_medida='unidad',vendible=true
 WHERE tipo_inventario IS NULL OR tipo_inventario NOT IN ('PRODUCTO_VENTA','INSUMO','EQUIPO');

UPDATE public.productos SET vendible=false,precio_venta=0
 WHERE tipo_inventario IN ('INSUMO','EQUIPO');

CREATE INDEX IF NOT EXISTS idx_productos_inventario_tipo
 ON public.productos(negocio_id,tipo_inventario,estado);
CREATE INDEX IF NOT EXISTS idx_productos_inventario_vendible
 ON public.productos(negocio_id,vendible,estado) WHERE vendible IS TRUE;

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
 WHERE p.negocio_id=v_negocio AND p.estado='ACTIVO' AND p.vendible IS TRUE AND p.tipo_inventario='PRODUCTO_VENTA'
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
 IF p_items IS NULL OR jsonb_typeof(p_items)<>'array' THEN
  RAISE EXCEPTION 'El formato del pedido no es válido.';
 END IF;
 IF jsonb_array_length(p_items)=0 OR jsonb_array_length(p_items)>30 THEN
  RAISE EXCEPTION 'Agrega entre 1 y 30 líneas de productos.';
 END IF;
 SELECT id INTO v_negocio FROM public.negocios WHERE slug=p_slug LIMIT 1;
 IF v_negocio IS NULL THEN RAISE EXCEPTION 'No encontramos esta barbería.'; END IF;

 FOR v_item IN SELECT producto_id,sum(cantidad)::integer AS cantidad FROM jsonb_to_recordset(p_items)
  AS x(producto_id uuid,cantidad integer) GROUP BY producto_id
 LOOP
  IF v_item.producto_id IS NULL OR v_item.cantidad IS NULL
   OR v_item.cantidad<1 OR v_item.cantidad>99 THEN
   RAISE EXCEPTION 'Hay un producto o cantidad inválida.';
  END IF;
  SELECT * INTO v_producto FROM public.productos
   WHERE id=v_item.producto_id AND negocio_id=v_negocio AND estado='ACTIVO' AND vendible IS TRUE AND tipo_inventario='PRODUCTO_VENTA';
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


