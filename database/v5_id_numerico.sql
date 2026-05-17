-- ============================================================
-- MIGRACIÓN v5 — ID numérico propio para lugares
-- Corre en Supabase SQL Editor
-- ============================================================

-- 1. Agregar columna id_numerico como entero simple (NO auto-increment)
--    Este ID es nuestro — lo asignamos nosotros desde la planilla.
--    Supabase tiene su propio "id" interno, id_numerico es el nuestro.
ALTER TABLE lugares
  ADD COLUMN IF NOT EXISTS id_numerico integer;

-- 2. Si ya existe como SERIAL (auto), quitarle el auto-increment
ALTER TABLE lugares ALTER COLUMN id_numerico DROP DEFAULT;
DROP SEQUENCE IF EXISTS lugares_id_numerico_seq;

-- 3. Índice único — garantiza que no haya dos lugares con el mismo número
CREATE UNIQUE INDEX IF NOT EXISTS lugares_id_numerico_idx ON lugares(id_numerico);

-- 4. Verificar resultado
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'lugares' AND column_name = 'id_numerico';
