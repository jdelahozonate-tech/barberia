-- Stock objetivo para sugerir reposiciones sin imponer cantidades.
ALTER TABLE public.productos
 ADD COLUMN IF NOT EXISTS stock_objetivo numeric(12,3) NOT NULL DEFAULT 0;
