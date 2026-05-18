-- v14: RLS policies para tabla personal
-- La tabla se creó en v8 sin políticas — agregar ahora para que la app pueda leer.

-- Habilitar RLS (si no estaba habilitado, no pasa nada; si estaba, queda igual)
ALTER TABLE personal ENABLE ROW LEVEL SECURITY;

-- Política SELECT: cualquier usuario autenticado puede ver todo el personal
DROP POLICY IF EXISTS "Autenticados leen personal" ON personal;
CREATE POLICY "Autenticados leen personal"
  ON personal FOR SELECT
  TO authenticated
  USING (true);

-- Política INSERT: admin y compras pueden cargar personal
DROP POLICY IF EXISTS "Admin/compras insertan personal" ON personal;
CREATE POLICY "Admin/compras insertan personal"
  ON personal FOR INSERT
  TO authenticated
  WITH CHECK (get_my_role() IN ('admin','compras'));

-- Política UPDATE: admin y compras pueden editar
DROP POLICY IF EXISTS "Admin/compras actualizan personal" ON personal;
CREATE POLICY "Admin/compras actualizan personal"
  ON personal FOR UPDATE
  TO authenticated
  USING (get_my_role() IN ('admin','compras'));

-- Verificar cuántos registros hay (debería mostrar los 354 importados)
SELECT COUNT(*), estado FROM personal GROUP BY estado;
