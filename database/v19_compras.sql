-- v19: módulo de compras y recepción

-- ─── 1. PROVEEDORES ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS proveedores (
  id              serial PRIMARY KEY,
  nombre          text NOT NULL,
  xubio_id        bigint UNIQUE,
  cuit            text,
  email           text,
  telefono        text,
  contacto        text,
  activo          boolean NOT NULL DEFAULT true,
  observaciones   text,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- ─── 2. ORDENES DE COMPRA ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ordenes_compra (
  id              serial PRIMARY KEY,
  numero          text,
  xubio_id        bigint UNIQUE,
  proveedor_id    integer REFERENCES proveedores(id) ON DELETE RESTRICT,
  estado          text NOT NULL DEFAULT 'borrador'
                  CHECK (estado IN ('borrador','pendiente_aprobacion','aprobada','enviada','parcialmente_recibida','recibida','anulada')),
  fecha_emision   date NOT NULL DEFAULT CURRENT_DATE,
  fecha_esperada  date,
  observaciones   text,
  aprobada_por    uuid REFERENCES auth.users(id),
  aprobada_at     timestamptz,
  enviada_xubio   boolean NOT NULL DEFAULT false,
  enviada_xubio_at timestamptz,
  creada_por      uuid REFERENCES auth.users(id),
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- ─── 3. LÍNEAS DE ORDEN DE COMPRA ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ordenes_compra_linea (
  id              serial PRIMARY KEY,
  oc_id           integer NOT NULL REFERENCES ordenes_compra(id) ON DELETE CASCADE,
  producto_id     integer REFERENCES productos(id) ON DELETE RESTRICT,
  xubio_producto_id bigint,
  nombre_snapshot text NOT NULL,
  cantidad_pedida numeric NOT NULL CHECK (cantidad_pedida > 0),
  precio_unitario numeric,
  unidad          text,
  cantidad_recibida numeric DEFAULT 0,
  recibida_en     timestamptz,
  recibida_por    uuid REFERENCES auth.users(id),
  created_at      timestamptz DEFAULT now()
);

-- ─── 4. RECEPCIONES ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS recepciones (
  id              serial PRIMARY KEY,
  oc_id           integer NOT NULL REFERENCES ordenes_compra(id) ON DELETE RESTRICT,
  recibido_por    uuid REFERENCES auth.users(id),
  fecha_recepcion date NOT NULL DEFAULT CURRENT_DATE,
  observaciones   text,
  diferencias     boolean NOT NULL DEFAULT false,
  stock_actualizado boolean NOT NULL DEFAULT false,
  created_at      timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS recepciones_linea (
  id              serial PRIMARY KEY,
  recepcion_id    integer NOT NULL REFERENCES recepciones(id) ON DELETE CASCADE,
  oc_linea_id     integer NOT NULL REFERENCES ordenes_compra_linea(id) ON DELETE CASCADE,
  cantidad_recibida numeric NOT NULL DEFAULT 0,
  observaciones   text
);

-- ─── 5. CAMPO codigo_xubio en productos ──────────────────────────────────────
ALTER TABLE productos ADD COLUMN IF NOT EXISTS codigo_xubio bigint UNIQUE;

-- ─── 6. ÍNDICES ───────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS oc_estado_idx          ON ordenes_compra(estado);
CREATE INDEX IF NOT EXISTS oc_proveedor_idx       ON ordenes_compra(proveedor_id);
CREATE INDEX IF NOT EXISTS oc_fecha_idx           ON ordenes_compra(fecha_emision DESC);
CREATE INDEX IF NOT EXISTS oc_linea_oc_idx        ON ordenes_compra_linea(oc_id);
CREATE INDEX IF NOT EXISTS oc_linea_producto_idx  ON ordenes_compra_linea(producto_id);
CREATE INDEX IF NOT EXISTS recepciones_oc_idx     ON recepciones(oc_id);
CREATE INDEX IF NOT EXISTS proveedores_xubio_idx  ON proveedores(xubio_id);

-- ─── 7. RLS ───────────────────────────────────────────────────────────────────
ALTER TABLE proveedores          ENABLE ROW LEVEL SECURITY;
ALTER TABLE ordenes_compra       ENABLE ROW LEVEL SECURITY;
ALTER TABLE ordenes_compra_linea ENABLE ROW LEVEL SECURITY;
ALTER TABLE recepciones          ENABLE ROW LEVEL SECURITY;
ALTER TABLE recepciones_linea    ENABLE ROW LEVEL SECURITY;

-- Helper rol (puede ya existir de v17)
CREATE OR REPLACE FUNCTION get_rol()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT rol FROM profiles WHERE id = auth.uid()
$$;

-- proveedores
DROP POLICY IF EXISTS prov_select ON proveedores;
DROP POLICY IF EXISTS prov_insert ON proveedores;
DROP POLICY IF EXISTS prov_update ON proveedores;
CREATE POLICY prov_select ON proveedores FOR SELECT
  USING (get_rol() IN ('admin','compras','recepcion'));
CREATE POLICY prov_insert ON proveedores FOR INSERT
  WITH CHECK (get_rol() IN ('admin','compras'));
CREATE POLICY prov_update ON proveedores FOR UPDATE
  USING (get_rol() IN ('admin','compras'));

-- ordenes_compra
DROP POLICY IF EXISTS oc_select ON ordenes_compra;
DROP POLICY IF EXISTS oc_insert ON ordenes_compra;
DROP POLICY IF EXISTS oc_update ON ordenes_compra;
CREATE POLICY oc_select ON ordenes_compra FOR SELECT
  USING (
    get_rol() IN ('admin','compras')
    OR (get_rol() = 'recepcion' AND estado IN ('aprobada','enviada','parcialmente_recibida'))
  );
CREATE POLICY oc_insert ON ordenes_compra FOR INSERT
  WITH CHECK (get_rol() IN ('admin','compras'));
CREATE POLICY oc_update ON ordenes_compra FOR UPDATE
  USING (get_rol() IN ('admin','compras','recepcion'));

-- ordenes_compra_linea
DROP POLICY IF EXISTS ocl_select ON ordenes_compra_linea;
DROP POLICY IF EXISTS ocl_insert ON ordenes_compra_linea;
DROP POLICY IF EXISTS ocl_update ON ordenes_compra_linea;
CREATE POLICY ocl_select ON ordenes_compra_linea FOR SELECT
  USING (get_rol() IN ('admin','compras','recepcion'));
CREATE POLICY ocl_insert ON ordenes_compra_linea FOR INSERT
  WITH CHECK (get_rol() IN ('admin','compras'));
CREATE POLICY ocl_update ON ordenes_compra_linea FOR UPDATE
  USING (get_rol() IN ('admin','compras','recepcion'));

-- recepciones
DROP POLICY IF EXISTS rec_select ON recepciones;
DROP POLICY IF EXISTS rec_insert ON recepciones;
DROP POLICY IF EXISTS rec_update ON recepciones;
CREATE POLICY rec_select ON recepciones FOR SELECT
  USING (get_rol() IN ('admin','compras','recepcion'));
CREATE POLICY rec_insert ON recepciones FOR INSERT
  WITH CHECK (get_rol() IN ('admin','compras','recepcion'));
CREATE POLICY rec_update ON recepciones FOR UPDATE
  USING (get_rol() IN ('admin','compras','recepcion'));

DROP POLICY IF EXISTS recl_select ON recepciones_linea;
DROP POLICY IF EXISTS recl_insert ON recepciones_linea;
DROP POLICY IF EXISTS recl_update ON recepciones_linea;
CREATE POLICY recl_select ON recepciones_linea FOR SELECT
  USING (get_rol() IN ('admin','compras','recepcion'));
CREATE POLICY recl_insert ON recepciones_linea FOR INSERT
  WITH CHECK (get_rol() IN ('admin','compras','recepcion'));
CREATE POLICY recl_update ON recepciones_linea FOR UPDATE
  USING (get_rol() IN ('admin','compras','recepcion'));

-- ─── 8. ROL recepcion en profiles ─────────────────────────────────────────────
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_rol_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_rol_check
  CHECK (rol IN ('admin','supervisor','compras','preparador','repartidor','recepcion','auditor'));

-- ─── 9. VERIFICACIÓN ──────────────────────────────────────────────────────────
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_name IN ('proveedores','ordenes_compra','ordenes_compra_linea','recepciones')
ORDER BY table_name, ordinal_position;
