-- v9: soporte para Google OAuth y gestión de usuarios

-- Agregar columnas a profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url text;

-- Permitir que admins vean todos los profiles (RLS)
-- Primero habilitamos RLS si no estaba
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Cada usuario puede ver su propio perfil
DROP POLICY IF EXISTS "Usuarios ven su propio perfil" ON profiles;
CREATE POLICY "Usuarios ven su propio perfil"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

-- Admins pueden ver todos los perfiles
DROP POLICY IF EXISTS "Admin ve todos los perfiles" ON profiles;
CREATE POLICY "Admin ve todos los perfiles"
  ON profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.rol = 'admin'
    )
  );

-- Admins pueden actualizar perfiles (aprobar, cambiar rol)
DROP POLICY IF EXISTS "Admin actualiza perfiles" ON profiles;
CREATE POLICY "Admin actualiza perfiles"
  ON profiles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.rol = 'admin'
    )
  );

-- Cualquier usuario autenticado puede insertar su propio perfil (primer login)
DROP POLICY IF EXISTS "Usuario inserta su propio perfil" ON profiles;
CREATE POLICY "Usuario inserta su propio perfil"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);
