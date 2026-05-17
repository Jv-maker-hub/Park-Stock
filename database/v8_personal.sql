-- v8: tabla de personal operativo
CREATE TABLE IF NOT EXISTS personal (
  id              serial PRIMARY KEY,
  dni             text UNIQUE NOT NULL,
  nombre          text NOT NULL,
  apellido        text NOT NULL,
  celular         text,
  estado          text NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo','inactivo')),
  cargo           text,
  id_externo      text,          -- ID en sistema externo de RRHH
  observaciones   text,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- Responsable operativo en lugares (referencia a personal)
ALTER TABLE lugares ADD COLUMN IF NOT EXISTS responsable_id integer REFERENCES personal(id) ON DELETE SET NULL;

-- Índices
CREATE INDEX IF NOT EXISTS personal_estado_idx ON personal(estado);
CREATE INDEX IF NOT EXISTS personal_dni_idx    ON personal(dni);

-- Ver columnas resultantes
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name IN ('personal','lugares')
  AND column_name IN ('id','dni','nombre','apellido','celular','estado','cargo','id_externo','responsable_id')
ORDER BY table_name, ordinal_position;
