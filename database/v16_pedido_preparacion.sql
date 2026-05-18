-- v16: campos de preparación en pedido_detalle

ALTER TABLE pedido_detalle
  ADD COLUMN IF NOT EXISTS preparado       boolean     DEFAULT false,
  ADD COLUMN IF NOT EXISTS preparado_por   uuid        REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS preparado_at    timestamptz;

-- comentario_repartidor ya existe (v13), verificar
-- ALTER TABLE pedido_detalle ADD COLUMN IF NOT EXISTS comentario_repartidor text;

-- Índice para buscar pendientes de preparación rápido
CREATE INDEX IF NOT EXISTS pedido_detalle_preparado_idx ON pedido_detalle(pedido_id, preparado);
