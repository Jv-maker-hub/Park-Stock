-- v6: agregar contacto_apellido y contacto_dni a la tabla lugares
ALTER TABLE lugares ADD COLUMN IF NOT EXISTS contacto_apellido text;
ALTER TABLE lugares ADD COLUMN IF NOT EXISTS contacto_dni text;

-- verificar
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'lugares'
  AND column_name IN ('contacto_nombre', 'contacto_apellido', 'contacto_dni', 'contacto_tel')
ORDER BY column_name;
