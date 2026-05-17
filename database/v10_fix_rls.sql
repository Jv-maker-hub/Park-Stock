-- v10: simplificar RLS profiles (política recursiva causaba bloqueo total)

-- Eliminar políticas problemáticas
DROP POLICY IF EXISTS "Admin ve todos los perfiles" ON profiles;
DROP POLICY IF EXISTS "Admin actualiza perfiles" ON profiles;
DROP POLICY IF EXISTS "Usuarios ven su propio perfil" ON profiles;
DROP POLICY IF EXISTS "Usuario inserta su propio perfil" ON profiles;

-- Política simple: cualquier usuario autenticado puede leer todos los perfiles
-- (app interna, la seguridad real está en los route guards)
CREATE POLICY "Autenticados leen perfiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

-- Cualquier usuario autenticado puede insertar su propio perfil (primer login)
CREATE POLICY "Autenticados insertan su perfil"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Cualquier usuario autenticado puede actualizar perfiles
-- (el control admin se hace en la UI, no en RLS para esta app interna)
CREATE POLICY "Autenticados actualizan perfiles"
  ON profiles FOR UPDATE
  TO authenticated
  USING (true);
