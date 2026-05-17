-- ============================================================
-- Park Stock – Migration v4 FIX (versión final)
-- Corre aunque v3 haya sido ejecutado parcialmente.
-- Seguro: entregas está vacía, se puede recrear.
-- ============================================================

-- 1. Quitar la view si existe (depende de entregas)
DROP VIEW IF EXISTS v_consumo_mensual;

-- 2. Recrear entregas limpio (sin datos todavía = seguro dropar)
DROP TABLE IF EXISTS entrega_items;
DROP TABLE IF EXISTS entregas CASCADE;
CREATE TABLE entregas (
  id                bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  lugar_id          bigint NOT NULL REFERENCES lugares(id)   ON DELETE CASCADE,
  producto_id       bigint NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  mes               date   NOT NULL,
  cantidad_mensual  decimal(10,3),
  semana_1          decimal(10,3),
  semana_2          decimal(10,3),
  semana_3          decimal(10,3),
  semana_4          decimal(10,3),
  semana_5          decimal(10,3),
  fuente            text DEFAULT 'planilla_excel',
  archivo_origen    text,
  contacto_planilla text,
  created_at        timestamptz DEFAULT now(),
  UNIQUE (lugar_id, producto_id, mes)
);

-- 3. Campos extra en lugares (idempotente)
ALTER TABLE lugares
  ADD COLUMN IF NOT EXISTS metros_cuadrados     decimal(10,2),
  ADD COLUMN IF NOT EXISTS cantidad_empleados   integer,
  ADD COLUMN IF NOT EXISTS cantidad_banos       integer,
  ADD COLUMN IF NOT EXISTS cantidad_pisos       integer,
  ADD COLUMN IF NOT EXISTS acceso_publico       boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS tiene_cocina         boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS frecuencia_limpieza  integer,
  ADD COLUMN IF NOT EXISTS personal_limpieza    integer,
  ADD COLUMN IF NOT EXISTS dia_reparto          text;

ALTER TABLE lugares ADD COLUMN IF NOT EXISTS tipo_lugar text DEFAULT 'otro';
ALTER TABLE lugares DROP CONSTRAINT IF EXISTS lugares_tipo_lugar_check;
ALTER TABLE lugares ADD CONSTRAINT lugares_tipo_lugar_check
  CHECK (tipo_lugar IN ('administrativo','salud','deportivo','educativo','seguridad','servicios','otro'));

-- 4. mapeo_lugares
CREATE TABLE IF NOT EXISTS mapeo_lugares (
  id              bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  nombre_planilla text NOT NULL UNIQUE,
  lugar_id        bigint REFERENCES lugares(id) ON DELETE SET NULL,
  confirmado      boolean DEFAULT false,
  created_at      timestamptz DEFAULT now()
);

-- 5. mapeo_productos
CREATE TABLE IF NOT EXISTS mapeo_productos (
  id              bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  codigo_planilla text,
  nombre_planilla text NOT NULL UNIQUE,
  producto_id     bigint REFERENCES productos(id) ON DELETE SET NULL,
  confirmado      boolean DEFAULT false,
  created_at      timestamptz DEFAULT now()
);

-- 6. Indexes
CREATE INDEX IF NOT EXISTS idx_entregas_lugar_mes ON entregas(lugar_id, mes);
CREATE INDEX IF NOT EXISTS idx_entregas_producto  ON entregas(producto_id);
CREATE INDEX IF NOT EXISTS idx_entregas_mes       ON entregas(mes);

-- 7. RLS
ALTER TABLE mapeo_lugares   ENABLE ROW LEVEL SECURITY;
ALTER TABLE mapeo_productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE entregas        ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='mapeo_lugares' AND policyname='mapeo_lugares_admin') THEN
    CREATE POLICY mapeo_lugares_admin ON mapeo_lugares
      USING (get_my_role() IN ('admin','supervisor'))
      WITH CHECK (get_my_role() = 'admin');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='mapeo_productos' AND policyname='mapeo_productos_admin') THEN
    CREATE POLICY mapeo_productos_admin ON mapeo_productos
      USING (get_my_role() IN ('admin','supervisor'))
      WITH CHECK (get_my_role() = 'admin');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='entregas' AND policyname='entregas_read') THEN
    CREATE POLICY entregas_read ON entregas FOR SELECT
      USING (get_my_role() IN ('admin','supervisor','preparador','repartidor'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='entregas' AND policyname='entregas_write') THEN
    CREATE POLICY entregas_write ON entregas FOR ALL
      USING (get_my_role() = 'admin')
      WITH CHECK (get_my_role() = 'admin');
  END IF;
END $$;

-- 8. View (al final cuando todo ya existe)
CREATE VIEW v_consumo_mensual AS
SELECT
  e.mes,
  l.id                 AS lugar_id,
  l.nombre             AS lugar,
  l.tipo_lugar,
  l.metros_cuadrados,
  l.cantidad_empleados,
  p.id                 AS producto_id,
  p.nombre             AS producto,
  p.unidad_entrega,
  c.nombre             AS categoria,
  e.cantidad_mensual,
  e.semana_1, e.semana_2, e.semana_3, e.semana_4, e.semana_5
FROM entregas e
JOIN lugares            l ON l.id = e.lugar_id
JOIN productos          p ON p.id = e.producto_id
LEFT JOIN categorias_producto c ON c.id = p.categoria_id;
