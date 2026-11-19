-- Pedidos de compra a proveedores y preferencias de notificaciones por negocio.
-- Preparar un pedido no registra una compra ni modifica existencias.
CREATE TABLE IF NOT EXISTS public.pedidos_proveedores (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 negocio_id uuid NOT NULL REFERENCES public.negocios(id) ON DELETE CASCADE,
 proveedor_id uuid NOT NULL REFERENCES public.proveedores_inventario(id) ON DELETE RESTRICT,
 fecha_pedido date NOT NULL DEFAULT CURRENT_DATE,
 estado text NOT NULL DEFAULT 'BORRADOR'
   CHECK (estado IN ('BORRADOR','ENVIADO','RECIBIDO','CANCELADO')),
 observaciones text,
 creado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 creado_en timestamptz NOT NULL DEFAULT now(),
 actualizado_en timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pedidos_proveedores_negocio_fecha
 ON public.pedidos_proveedores(negocio_id, creado_en DESC);

CREATE TABLE IF NOT EXISTS public.detalle_pedidos_proveedores (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 pedido_id uuid NOT NULL REFERENCES public.pedidos_proveedores(id) ON DELETE CASCADE,
 negocio_id uuid NOT NULL REFERENCES public.negocios(id) ON DELETE CASCADE,
 producto_id uuid NOT NULL REFERENCES public.productos(id) ON DELETE RESTRICT,
 nombre_producto text NOT NULL,
 cantidad numeric(12,3) NOT NULL CHECK (cantidad > 0),
 costo_estimado numeric(14,2) NOT NULL DEFAULT 0 CHECK (costo_estimado >= 0)
);
CREATE INDEX IF NOT EXISTS idx_detalle_pedidos_proveedores_pedido
 ON public.detalle_pedidos_proveedores(negocio_id,pedido_id);

ALTER TABLE public.pedidos_proveedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.detalle_pedidos_proveedores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pedidos_proveedores_admin ON public.pedidos_proveedores;
CREATE POLICY pedidos_proveedores_admin ON public.pedidos_proveedores
 FOR ALL TO authenticated
 USING (negocio_id = public.mi_negocio()
   AND COALESCE(public.mi_rol(),'') IN ('ADMINISTRADOR','SUPERVISOR'))
 WITH CHECK (negocio_id = public.mi_negocio()
   AND COALESCE(public.mi_rol(),'') IN ('ADMINISTRADOR','SUPERVISOR'));
DROP POLICY IF EXISTS detalle_pedidos_proveedores_admin ON public.detalle_pedidos_proveedores;
CREATE POLICY detalle_pedidos_proveedores_admin ON public.detalle_pedidos_proveedores
 FOR ALL TO authenticated
 USING (negocio_id = public.mi_negocio()
   AND COALESCE(public.mi_rol(),'') IN ('ADMINISTRADOR','SUPERVISOR'))
 WITH CHECK (negocio_id = public.mi_negocio()
   AND COALESCE(public.mi_rol(),'') IN ('ADMINISTRADOR','SUPERVISOR'));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pedidos_proveedores TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.detalle_pedidos_proveedores TO authenticated;

CREATE TABLE IF NOT EXISTS public.preferencias_notificaciones (
 negocio_id uuid PRIMARY KEY REFERENCES public.negocios(id) ON DELETE CASCADE,
 preferencias jsonb NOT NULL DEFAULT '{"citas_30m":true,"citas_15m":false,"stock_bajo":true,"stock_agotado":true,"pedidos_clientes":true,"cuentas_vencer":true}'::jsonb,
 actualizado_en timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.preferencias_notificaciones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS preferencias_notificaciones_admin ON public.preferencias_notificaciones;
CREATE POLICY preferencias_notificaciones_admin ON public.preferencias_notificaciones
 FOR ALL TO authenticated
 USING (negocio_id = public.mi_negocio()
   AND COALESCE(public.mi_rol(),'') IN ('ADMINISTRADOR','SUPERVISOR'))
 WITH CHECK (negocio_id = public.mi_negocio()
   AND COALESCE(public.mi_rol(),'') IN ('ADMINISTRADOR','SUPERVISOR'));
GRANT SELECT, INSERT, UPDATE ON public.preferencias_notificaciones TO authenticated;
