-- v13: Pedido Modelo (plantilla mensual) + frecuencia por lugar

-- Frecuencia de entrega en lugares: 1=mensual, 2=quincenal, 4=semanal
ALTER TABLE lugares ADD COLUMN IF NOT EXISTS frecuencia_entrega integer DEFAULT 1
  CHECK (frecuencia_entrega IN (1, 2, 4));

-- Comentario del repartidor en pedido_detalle
ALTER TABLE pedido_detalle ADD COLUMN IF NOT EXISTS comentario_repartidor text;

-- Tabla: cabecera del modelo mensual
CREATE TABLE IF NOT EXISTS pedido_modelo (
  id          serial primary key,
  nombre      text not null,
  mes         date not null,            -- primer día del mes: 2025-06-01
  cliente_id  integer references clientes,
  activo      boolean default true,
  created_by  uuid references profiles,
  created_at  timestamptz default now()
);

-- Tabla: detalle del modelo (qué se entrega a cada lugar por visita)
CREATE TABLE IF NOT EXISTS pedido_modelo_detalle (
  id                  serial primary key,
  modelo_id           integer not null references pedido_modelo on delete cascade,
  lugar_id            integer not null references lugares,
  producto_id         integer not null references productos,
  cantidad_por_visita decimal not null default 0,
  -- Total mensual = cantidad_por_visita × frecuencia_entrega del lugar
  UNIQUE (modelo_id, lugar_id, producto_id)
);

CREATE INDEX IF NOT EXISTS idx_pmd_modelo  ON pedido_modelo_detalle(modelo_id);
CREATE INDEX IF NOT EXISTS idx_pmd_lugar   ON pedido_modelo_detalle(lugar_id);

-- RLS
ALTER TABLE pedido_modelo         ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedido_modelo_detalle ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth lee modelo"    ON pedido_modelo         FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth escribe modelo" ON pedido_modelo        FOR ALL    TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth lee detalle"   ON pedido_modelo_detalle FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth escribe detalle" ON pedido_modelo_detalle FOR ALL  TO authenticated USING (true) WITH CHECK (true);
