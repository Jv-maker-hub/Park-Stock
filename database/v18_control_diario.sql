-- v18: control diario por repartidor — conteo inicial + post-preparación
-- Diseño: Lorena cuenta a la mañana (inicial), luego cuenta después de que el
-- preparador armó los pedidos (post_prep). El sistema cruza con pedido_detalle
-- para saber cuánto debería haber sacado el preparador y detecta diferencias.

-- ─── 1. Tipo 'diario' en stock_arqueo ────────────────────────────────────────
ALTER TABLE stock_arqueo DROP CONSTRAINT IF EXISTS stock_arqueo_tipo_check;
ALTER TABLE stock_arqueo ADD CONSTRAINT stock_arqueo_tipo_check
  CHECK (tipo IN ('completo','parcial','diario'));

-- ─── 2. Columnas nuevas en stock_arqueo ──────────────────────────────────────
ALTER TABLE stock_arqueo
  ADD COLUMN IF NOT EXISTS assigned_to          uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS fecha_conteo         date,
  ADD COLUMN IF NOT EXISTS post_prep_completado boolean NOT NULL DEFAULT false;

-- ─── 3. Columnas en stock_arqueo_linea para control diario ───────────────────
-- Para arqueos tipo 'completo'/'parcial' se sigue usando cantidad_contada.
-- Para tipo 'diario' se usan las columnas nuevas:
ALTER TABLE stock_arqueo_linea
  ADD COLUMN IF NOT EXISTS cantidad_inicial       numeric,         -- conteo de Lorena a la mañana
  ADD COLUMN IF NOT EXISTS inicial_en             timestamptz,     -- hora exacta del conteo inicial
  ADD COLUMN IF NOT EXISTS inicial_por            uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS cantidad_preparada_sis numeric DEFAULT 0, -- lo que dice el sistema que se preparó
  ADD COLUMN IF NOT EXISTS cantidad_post_prep     numeric,         -- conteo post-preparación
  ADD COLUMN IF NOT EXISTS post_prep_en           timestamptz,     -- hora exacta del segundo conteo
  ADD COLUMN IF NOT EXISTS post_prep_por          uuid REFERENCES auth.users(id);

-- ─── 4. Índices ──────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS stock_arqueo_fecha_idx    ON stock_arqueo(fecha_conteo DESC);
CREATE INDEX IF NOT EXISTS stock_arqueo_assigned_idx ON stock_arqueo(assigned_to);

-- ─── 5. RLS actualizadas ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Arqueos lectura"          ON stock_arqueo;
DROP POLICY IF EXISTS "Arqueos actualizar"        ON stock_arqueo;
DROP POLICY IF EXISTS "Arqueo lineas lectura"     ON stock_arqueo_linea;
DROP POLICY IF EXISTS "Arqueo lineas actualizar"  ON stock_arqueo_linea;

CREATE POLICY "Arqueos lectura"
  ON stock_arqueo FOR SELECT TO authenticated
  USING (
    get_my_role() IN ('admin','auditor','compras')
    OR (get_my_role() IN ('repartidor','preparador') AND assigned_to = auth.uid())
  );

CREATE POLICY "Arqueos actualizar"
  ON stock_arqueo FOR UPDATE TO authenticated
  USING (
    get_my_role() IN ('admin','auditor')
    OR (get_my_role() IN ('repartidor','preparador') AND assigned_to = auth.uid())
  );

CREATE POLICY "Arqueo lineas lectura"
  ON stock_arqueo_linea FOR SELECT TO authenticated
  USING (
    get_my_role() IN ('admin','auditor','compras')
    OR EXISTS (
      SELECT 1 FROM stock_arqueo a
      WHERE a.id = arqueo_id
        AND a.assigned_to = auth.uid()
    )
  );

CREATE POLICY "Arqueo lineas actualizar"
  ON stock_arqueo_linea FOR UPDATE TO authenticated
  USING (
    get_my_role() IN ('admin','auditor')
    OR EXISTS (
      SELECT 1 FROM stock_arqueo a
      WHERE a.id = arqueo_id
        AND a.assigned_to = auth.uid()
    )
  );
