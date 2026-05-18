-- v12: Módulo de entregas mensuales

-- Cabecera del pedido mensual
CREATE TABLE IF NOT EXISTS pedidos (
  id           serial primary key,
  mes          date not null,              -- siempre el 1° del mes (2024-06-01)
  cliente_id   integer references clientes,
  estado       text not null default 'borrador'
               check (estado in ('borrador','confirmado','en_reparto','completado')),
  notas        text,
  created_by   uuid references profiles,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

-- Detalle: qué producto va a cada lugar, en qué cantidad
CREATE TABLE IF NOT EXISTS pedido_detalle (
  id                   serial primary key,
  pedido_id            integer not null references pedidos on delete cascade,
  lugar_id             integer not null references lugares,
  producto_id          integer not null references productos,
  cantidad_planificada decimal not null default 0,
  cantidad_entregada   decimal,            -- null = aún no entregado
  entregado            boolean default false,
  repartidor_id        uuid references profiles,
  fecha_entrega        timestamptz,
  notas_entrega        text,
  created_at           timestamptz default now()
);

-- Índices útiles
CREATE INDEX IF NOT EXISTS idx_pedido_detalle_pedido ON pedido_detalle(pedido_id);
CREATE INDEX IF NOT EXISTS idx_pedido_detalle_lugar  ON pedido_detalle(lugar_id);

-- RLS: todos los autenticados leen y escriben (ajustar por rol si se necesita)
ALTER TABLE pedidos         ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedido_detalle  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados leen pedidos"
  ON pedidos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Autenticados escriben pedidos"
  ON pedidos FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Autenticados leen detalle"
  ON pedido_detalle FOR SELECT TO authenticated USING (true);
CREATE POLICY "Autenticados escriben detalle"
  ON pedido_detalle FOR ALL TO authenticated USING (true) WITH CHECK (true);
