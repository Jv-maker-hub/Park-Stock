-- v11: Campos extra en profiles + fix constraint de rol

-- Hacer rol nullable (para nuevos usuarios Google que aún no tienen rol asignado)
ALTER TABLE profiles ALTER COLUMN rol DROP NOT NULL;

-- Actualizar constraint de roles válidos (incluir nuevos roles del sistema)
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_rol_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_rol_check
  CHECK (rol IN ('admin','compras','preparador','repartidor','recepcion') OR rol IS NULL);

-- Nuevos campos de perfil
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS telefono text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS cargo text;

-- Rellenar email de usuarios que lo tengan vacío (desde auth.users)
UPDATE profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id AND (p.email IS NULL OR p.email = '');
