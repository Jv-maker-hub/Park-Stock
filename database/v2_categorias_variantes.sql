-- ============================================================
-- PARK STOCK — Migración v2
-- Ejecutar en: Supabase Dashboard > SQL Editor > New query
-- Requiere que ya esté ejecutado el schema v1 (supabase_schema.sql)
-- ============================================================

-- ============================================================
-- SUPERVISORES
-- ============================================================
create table if not exists supervisores (
  id serial primary key,
  nombre text not null,
  email text,
  telefono text,
  activo boolean default true,
  created_at timestamptz default now()
);

alter table supervisores enable row level security;
create policy "Auth lee supervisores" on supervisores for select using (auth.role() = 'authenticated');
create policy "Admin gestiona supervisores" on supervisores for all using (get_my_role() = 'admin');

-- ============================================================
-- CLIENTES
-- ============================================================
create table if not exists clientes (
  id serial primary key,
  nombre text not null,
  razon_social text,
  cuit text,
  email text,
  telefono text,
  activo boolean default true,
  created_at timestamptz default now()
);

alter table clientes enable row level security;
create policy "Auth lee clientes" on clientes for select using (auth.role() = 'authenticated');
create policy "Admin gestiona clientes" on clientes for all using (get_my_role() = 'admin');

-- ============================================================
-- CATEGORÍAS DE PRODUCTO
-- ============================================================
create table if not exists categorias_producto (
  id serial primary key,
  nombre text not null unique,
  descripcion text,
  campos_ficha jsonb default '[]',
  created_at timestamptz default now()
);

alter table categorias_producto enable row level security;
create policy "Auth lee categorias_producto" on categorias_producto for select using (auth.role() = 'authenticated');
create policy "Admin gestiona categorias_producto" on categorias_producto for all using (get_my_role() = 'admin');

-- Datos iniciales
insert into categorias_producto (nombre, descripcion, campos_ficha) values
  ('Limpieza', 'Productos de limpieza general',
    '[{"campo":"concentracion","label":"Concentración"},{"campo":"rendimiento","label":"Rendimiento"},{"campo":"certificaciones","label":"Certificaciones"}]'),
  ('Desinfección', 'Productos desinfectantes',
    '[{"campo":"principio_activo","label":"Principio activo"},{"campo":"concentracion","label":"Concentración"},{"campo":"espectro","label":"Espectro de acción"}]'),
  ('Papel e higiene', 'Papel higiénico, toallas, servilletas',
    '[{"campo":"hojas","label":"Cantidad de hojas"},{"campo":"capas","label":"Capas"},{"campo":"gramaje","label":"Gramaje (gr/m²)"}]'),
  ('Bolsas', 'Bolsas de residuos y afines',
    '[{"campo":"medidas","label":"Medidas (cm)"},{"campo":"micronaje","label":"Micronaje"},{"campo":"resistencia","label":"Resistencia kg"}]'),
  ('Equipamiento', 'Mopas, escobas, trapos, dispensers',
    '[{"campo":"material","label":"Material"},{"campo":"medidas","label":"Medidas"},{"campo":"vida_util","label":"Vida útil estimada"}]'),
  ('Otros', 'Otros productos', '[]')
on conflict (nombre) do nothing;

-- ============================================================
-- VARIANTES DE PRODUCTO (marca/proveedor por producto)
-- ============================================================
create table if not exists producto_variantes (
  id serial primary key,
  producto_id int references productos on delete cascade,
  nombre text,
  marca text,
  proveedor text,
  codigo_barras text,
  codigo_xubio text,
  codigo_interno text,
  unidad_compra text,
  cantidad_por_unidad_compra decimal default 1,
  activo boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table producto_variantes enable row level security;
create policy "Auth lee variantes" on producto_variantes for select using (auth.role() = 'authenticated');
create policy "Admin gestiona variantes" on producto_variantes for all using (get_my_role() = 'admin');

-- ============================================================
-- ESPECIFICACIONES / FICHA TÉCNICA (historial por producto)
-- ============================================================
create table if not exists producto_especificaciones (
  id serial primary key,
  producto_id int references productos on delete cascade,
  ficha_tecnica jsonb default '{}',
  vigente_desde date not null default current_date,
  vigente_hasta date,
  notas text,
  created_by uuid references profiles,
  created_at timestamptz default now()
);

alter table producto_especificaciones enable row level security;
create policy "Auth lee especificaciones" on producto_especificaciones for select using (auth.role() = 'authenticated');
create policy "Admin gestiona especificaciones" on producto_especificaciones for all using (get_my_role() = 'admin');

-- ============================================================
-- PRECIOS DE VARIANTES (historial)
-- ============================================================
create table if not exists variante_precios (
  id serial primary key,
  variante_id int references producto_variantes on delete cascade,
  precio decimal not null,
  fecha date not null default current_date,
  fuente text default 'manual' check (fuente in ('manual','xubio')),
  created_at timestamptz default now()
);

alter table variante_precios enable row level security;
create policy "Auth lee variante_precios" on variante_precios for select using (auth.role() = 'authenticated');
create policy "Admin gestiona variante_precios" on variante_precios for all using (get_my_role() = 'admin');

-- ============================================================
-- NUEVAS COLUMNAS EN LUGARES
-- ============================================================
alter table lugares add column if not exists nombre_anterior text;
alter table lugares add column if not exists supervisor_id int references supervisores;
alter table lugares add column if not exists cliente_id int references clientes;

-- ============================================================
-- NUEVAS COLUMNAS EN PRODUCTOS
-- ============================================================
alter table productos add column if not exists categoria_id int references categorias_producto;
alter table productos add column if not exists unidad_entrega text;
alter table productos add column if not exists unidad_compra text;
alter table productos add column if not exists factor_conversion decimal default 1;

-- ============================================================
-- ÍNDICES
-- ============================================================
create index if not exists idx_variantes_producto on producto_variantes(producto_id);
create index if not exists idx_variantes_activo on producto_variantes(producto_id, activo);
create index if not exists idx_especificaciones_producto on producto_especificaciones(producto_id, vigente_desde desc);
create index if not exists idx_variante_precios on variante_precios(variante_id, fecha desc);
create index if not exists idx_lugares_supervisor_id on lugares(supervisor_id);
create index if not exists idx_lugares_cliente_id on lugares(cliente_id);
create index if not exists idx_productos_categoria on productos(categoria_id);
