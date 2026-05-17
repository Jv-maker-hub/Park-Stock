-- v7: eliminar columna tipo_lugar de lugares
ALTER TABLE lugares DROP COLUMN IF EXISTS tipo_lugar;

-- verificar
SELECT column_name FROM information_schema.columns
WHERE table_name = 'lugares' ORDER BY ordinal_position;
