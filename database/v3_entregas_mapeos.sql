-- ============================================================
-- PARK STOCK — Migración v3
-- Ejecutar en: Supabase Dashboard > SQL Editor > New query
-- Requiere v1 y v2 ejecutadas previamente
-- ============================================================

-- ============================================================
-- ENTREGAS (historial de pedidos por lugar/producto/mes)
-- ============================================================
create table if not exists entregas (
  id serial primary key,
  lugar_id int references lugares on delete cascade,
  producto_id int references productos on delete set null,
  cantidad decimal not null default 0,
  cantidad_mensual decimal,          -- cantidad planificada del mes
  mes date not null,                 -- primer día del mes: 2026-02-01
  semana_1 decimal,
  semana_2 decimal,
  semana_3 decimal,
  semana_4 decimal,
  semana_5 decimal,
  fuente text default 'planilla' check (fuente in ('planilla','manual')),
  archivo_origen text,               -- nombre del archivo fuente
  contacto_planilla text,            -- contacto registrado en la planilla
  created_by uuid references profiles,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (lugar_id, producto_id, mes)
);

alter table entregas enable row level security;
create policy "Auth lee entregas" on entregas
  for select using (auth.role() = 'authenticated');
create policy "Admin gestiona entregas" on entregas
  for all using (get_my_role() = 'admin');

-- ============================================================
-- TABLA DE MAPEO: nombre planilla → lugar/producto en app
-- Sirve para el proceso de validación antes de importar
-- ============================================================
create table if not exists mapeo_lugares (
  id serial primary key,
  nombre_planilla text not null unique,   -- nombre tal como viene en el Excel
  lugar_id int references lugares,        -- lugar correspondiente en la app
  confirmado boolean default false,
  created_at timestamptz default now()
);

create table if not exists mapeo_productos (
  id serial primary key,
  codigo_planilla text,                   -- código Xubio del Excel
  nombre_planilla text not null unique,   -- nombre tal como viene en el Excel
  producto_id int references productos,   -- producto correspondiente en la app
  confirmado boolean default false,
  created_at timestamptz default now()
);

alter table mapeo_lugares enable row level security;
create policy "Auth lee mapeo_lugares" on mapeo_lugares
  for select using (auth.role() = 'authenticated');
create policy "Admin gestiona mapeo_lugares" on mapeo_lugares
  for all using (get_my_role() = 'admin');

alter table mapeo_productos enable row level security;
create policy "Auth lee mapeo_productos" on mapeo_productos
  for select using (auth.role() = 'authenticated');
create policy "Admin gestiona mapeo_productos" on mapeo_productos
  for all using (get_my_role() = 'admin');

-- ============================================================
-- CAMPO dia_reparto EN LUGARES
-- ============================================================
alter table lugares add column if not exists dia_reparto text;
  -- valores: 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'

-- ============================================================
-- ÍNDICES
-- ============================================================
create index if not exists idx_entregas_lugar_mes on entregas(lugar_id, mes desc);
create index if not exists idx_entregas_producto on entregas(producto_id);
create index if not exists idx_entregas_mes on entregas(mes desc);
create index if not exists idx_mapeo_lugares_nombre on mapeo_lugares(nombre_planilla);
create index if not exists idx_mapeo_productos_codigo on mapeo_productos(codigo_planilla);
