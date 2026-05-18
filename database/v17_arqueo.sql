-- v17: módulo auditor — arqueos de stock del depósito

-- ─── 1. Agregar rol 'auditor' al check constraint de profiles ────────────────
ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS profiles_rol_check;

ALTER TABLE profiles
  ADD CONSTRAINT profiles_rol_check
  CHECK (rol IN ('admin','compras','preparador','repartidor','recepcion','supervisor','auditor'));

-- ─── 2. Tabla principal de arqueos ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stock_arqueo (
  id                 serial PRIMARY KEY,
  tipo               text NOT NULL CHECK (tipo IN ('completo','parcial')),
  estado             text NOT NULL DEFAULT 'en_progreso'
                     CHECK (estado IN ('en_progreso','cerrado')),
  auditor_id         uuid REFERENCES auth.users(id),
  observaciones      text,
  ajuste_aplicado    boolean NOT NULL DEFAULT false,
  productos_total    integer NOT NULL DEFAULT 0,
  productos_contados integer NOT NULL DEFAULT 0,
  diferencias_count  integer NOT NULL DEFAULT 0,
  created_at         timestamptz DEFAULT now(),
  cerrado_at         timestamptz
);

-- ─── 3. Líneas de cada arqueo (un producto por fila) ─────────────────────────
CREATE TABLE IF NOT EXISTS stock_arqueo_linea (
  id               serial PRIMARY KEY,
  arqueo_id        integer NOT NULL REFERENCES stock_arqueo(id) ON DELETE CASCADE,
  producto_id      integer NOT NULL REFERENCES productos(id),
  producto_nombre  text NOT NULL,
  producto_unidad  text,
  cantidad_sistema numeric NOT NULL DEFAULT 0,
  cantidad_contada numeric,
  observaciones    text,
  contado_en       timestamptz,
  contado_por      uuid REFERENCES auth.users(id)
);

-- ─── 4. Índices ──────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS stock_arqueo_estado_idx    ON stock_arqueo(estado);
CREATE INDEX IF NOT EXISTS stock_arqueo_created_idx   ON stock_arqueo(created_at DESC);
CREATE INDEX IF NOT EXISTS stock_arqueo_linea_arq_idx ON stock_arqueo_linea(arqueo_id);
CREATE INDEX IF NOT EXISTS stock_arqueo_linea_prod_idx ON stock_arqueo_linea(producto_id);

-- ─── 5. RLS ──────────────────────────────────────────────────────────────────
ALTER TABLE stock_arqueo       ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_arqueo_linea ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Arqueos lectura"
  ON stock_arqueo FOR SELECT TO authenticated
  USING (get_my_role() IN ('admin','auditor','compras'));

CREATE POLICY "Arqueos insertar"
  ON stock_arqueo FOR INSERT TO authenticated
  WITH CHECK (get_my_role() IN ('admin','auditor'));

CREATE POLICY "Arqueos actualizar"
  ON stock_arqueo FOR UPDATE TO authenticated
  USING (get_my_role() IN ('admin','auditor'));

CREATE POLICY "Arqueo lineas lectura"
  ON stock_arqueo_linea FOR SELECT TO authenticated
  USING (get_my_role() IN ('admin','auditor','compras'));

CREATE POLICY "Arqueo lineas insertar"
  ON stock_arqueo_linea FOR INSERT TO authenticated
  WITH CHECK (get_my_role() IN ('admin','auditor'));

CREATE POLICY "Arqueo lineas actualizar"
  ON stock_arqueo_linea FOR UPDATE TO authenticated
  USING (get_my_role() IN ('admin','auditor'));
