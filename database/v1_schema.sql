-- ============================================================
-- PARK STOCK — Schema Supabase
-- Ejecutar en: Supabase Dashboard > SQL Editor > New query
-- ============================================================

-- Función helper para evitar recursión en RLS
create or replace function get_my_role()
returns text
language sql
security definer
stable
as $$
  select rol from profiles where id = auth.uid()
$$;

-- ============================================================
-- PROFILES (extiende auth.users)
-- ============================================================
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  nombre text not null,
  rol text not null check (rol in ('admin','supervisor','preparador','repartidor')),
  activo boolean default true,
  created_at timestamptz default now()
);

alter table profiles enable row level security;
create policy "Ver propio perfil" on profiles for select using (auth.uid() = id);
create policy "Admin ve todos" on profiles for select using (get_my_role() = 'admin');
create policy "Admin gestiona" on profiles for all using (get_my_role() = 'admin');

-- Trigger: crea perfil automáticamente al registrar usuario
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id, nombre, rol)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nombre', new.email),
    coalesce(new.raw_user_meta_data->>'rol', 'preparador')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ============================================================
-- LUGARES
-- ============================================================
create table lugares (
  id serial primary key,
  nombre text not null,
  nombre_oficial text,
  direccion text,
  lat decimal(10,7),
  lng decimal(10,7),
  supervisor text,
  estado text default 'activo' check (estado in ('activo','inactivo','revisar')),
  dias_atencion text[] default '{}',
  horario_apertura time,
  horario_cierre time,
  contacto_nombre text,
  contacto_tel text,
  observaciones text,
  foto_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table lugares enable row level security;
create policy "Auth lee lugares" on lugares for select using (auth.role() = 'authenticated');
create policy "Admin/sup gestiona lugares" on lugares for all
  using (get_my_role() in ('admin','supervisor'));

-- ============================================================
-- PRODUCTOS
-- ============================================================
create table productos (
  id serial primary key,
  nombre text not null,
  codigo_interno text unique,
  codigo_xubio text,
  categoria text,
  unidad text default 'unidad',
  stock_minimo decimal default 0,
  activo boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table productos enable row level security;
create policy "Auth lee productos" on productos for select using (auth.role() = 'authenticated');
create policy "Admin gestiona productos" on productos for all using (get_my_role() = 'admin');

-- ============================================================
-- COSTOS DE PRODUCTOS (manual o desde Xubio)
-- ============================================================
create table producto_costos (
  id serial primary key,
  producto_id int references productos on delete cascade,
  costo decimal not null,
  fecha date not null,
  fuente text default 'manual' check (fuente in ('manual','xubio')),
  created_at timestamptz default now()
);

alter table producto_costos enable row level security;
create policy "Auth lee costos" on producto_costos for select using (auth.role() = 'authenticated');
create policy "Admin gestiona costos" on producto_costos for all using (get_my_role() = 'admin');

-- ============================================================
-- PLANILLA MODELO (cantidad asignada por lugar × producto)
-- ============================================================
create table lugar_modelo (
  id serial primary key,
  lugar_id int references lugares on delete cascade,
  producto_id int references productos on delete cascade,
  cantidad_mensual decimal not null,
  vigente_desde date default current_date,
  vigente_hasta date,
  created_by uuid references profiles,
  created_at timestamptz default now(),
  unique(lugar_id, producto_id, vigente_desde)
);

alter table lugar_modelo enable row level security;
create policy "Auth lee modelo" on lugar_modelo for select using (auth.role() = 'authenticated');
create policy "Admin/sup gestiona modelo" on lugar_modelo for all
  using (get_my_role() in ('admin','supervisor'));

-- ============================================================
-- STOCK
-- ============================================================
create table stock (
  producto_id int references productos on delete cascade primary key,
  cantidad decimal default 0,
  updated_at timestamptz default now()
);

alter table stock enable row level security;
create policy "Auth lee stock" on stock for select using (auth.role() = 'authenticated');
create policy "Admin gestiona stock" on stock for all using (get_my_role() = 'admin');

create table stock_movimientos (
  id serial primary key,
  producto_id int references productos,
  cantidad decimal not null,  -- positivo=entrada, negativo=salida
  tipo text not null check (tipo in ('compra','entrega','ajuste','extra_repartidor','devolucion')),
  referencia_id int,
  referencia_tipo text,
  notas text,
  creado_por uuid references profiles,
  created_at timestamptz default now()
);

alter table stock_movimientos enable row level security;
create policy "Auth lee movimientos" on stock_movimientos for select using (auth.role() = 'authenticated');
create policy "Admin/repartidor registra movimientos" on stock_movimientos for insert
  with check (get_my_role() in ('admin','repartidor'));

-- ============================================================
-- ÓRDENES DE COMPRA
-- ============================================================
create table ordenes_compra (
  id serial primary key,
  numero text,
  proveedor text,
  estado text default 'pendiente' check (estado in ('pendiente','recibida_parcial','recibida','anulada')),
  fecha_orden date default current_date,
  fecha_recepcion date,
  notas text,
  created_by uuid references profiles,
  created_at timestamptz default now()
);

alter table ordenes_compra enable row level security;
create policy "Auth lee OC" on ordenes_compra for select using (auth.role() = 'authenticated');
create policy "Admin gestiona OC" on ordenes_compra for all using (get_my_role() = 'admin');

create table orden_compra_items (
  id serial primary key,
  orden_compra_id int references ordenes_compra on delete cascade,
  producto_id int references productos,
  cantidad_ordenada decimal not null,
  cantidad_recibida decimal default 0,
  precio_unitario decimal,
  recibido boolean default false
);

alter table orden_compra_items enable row level security;
create policy "Auth lee OC items" on orden_compra_items for select using (auth.role() = 'authenticated');
create policy "Admin gestiona OC items" on orden_compra_items for all using (get_my_role() = 'admin');

-- ============================================================
-- PEDIDOS
-- ============================================================
create table pedidos (
  id serial primary key,
  lugar_id int references lugares,
  fecha_entrega date,
  estado text default 'borrador'
    check (estado in ('borrador','en_preparacion','listo','en_ruta','entregado','parcial','no_entregado','anulado')),
  preparado_por uuid references profiles,
  created_by uuid references profiles,
  notas text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table pedidos enable row level security;
create policy "Auth lee pedidos" on pedidos for select using (auth.role() = 'authenticated');
create policy "Admin crea pedidos" on pedidos for insert with check (get_my_role() = 'admin');
create policy "Admin/preparador actualiza pedidos" on pedidos for update
  using (get_my_role() in ('admin','preparador'));

create table pedido_items (
  id serial primary key,
  pedido_id int references pedidos on delete cascade,
  producto_id int references productos,
  cantidad_modelo decimal,
  cantidad_solicitada decimal,
  cantidad_ajustada decimal,
  ajuste_razon text,
  ajuste_estado text check (ajuste_estado in ('pendiente','aprobado_supervisor','aprobado_admin','rechazado')),
  ajuste_aprobado_por uuid references profiles,
  cantidad_entregada decimal,
  created_at timestamptz default now()
);

alter table pedido_items enable row level security;
create policy "Auth lee pedido items" on pedido_items for select using (auth.role() = 'authenticated');
create policy "Admin/preparador gestiona items" on pedido_items for all
  using (get_my_role() in ('admin','preparador'));

-- ============================================================
-- SOLICITUDES DE AJUSTE
-- ============================================================
create table solicitudes_ajuste (
  id serial primary key,
  pedido_item_id int references pedido_items on delete cascade,
  pedido_id int references pedidos,
  producto_id int references productos,
  solicitado_por uuid references profiles,
  cantidad_original decimal,
  cantidad_solicitada decimal,
  porcentaje_cambio decimal,
  razon text,
  estado text default 'pendiente' check (estado in ('pendiente','aprobado','rechazado')),
  revisado_por uuid references profiles,
  revision_notas text,
  created_at timestamptz default now()
);

alter table solicitudes_ajuste enable row level security;
create policy "Auth lee solicitudes" on solicitudes_ajuste for select using (auth.role() = 'authenticated');
create policy "Preparador crea solicitudes" on solicitudes_ajuste for insert
  with check (get_my_role() in ('preparador','admin'));
create policy "Sup/admin revisa solicitudes" on solicitudes_ajuste for update
  using (get_my_role() in ('supervisor','admin'));

-- ============================================================
-- RUTAS
-- ============================================================
create table rutas (
  id serial primary key,
  fecha date not null,
  repartidor_id uuid references profiles,
  vehiculo text,
  estado text default 'planificada'
    check (estado in ('planificada','en_curso','completada','cancelada')),
  notas text,
  created_by uuid references profiles,
  created_at timestamptz default now()
);

alter table rutas enable row level security;
create policy "Auth lee rutas" on rutas for select using (auth.role() = 'authenticated');
create policy "Admin gestiona rutas" on rutas for all using (get_my_role() = 'admin');

create table ruta_paradas (
  id serial primary key,
  ruta_id int references rutas on delete cascade,
  lugar_id int references lugares,
  pedido_id int references pedidos,
  orden int,
  hora_planificada time,
  hora_llegada timestamptz,
  estado text default 'pendiente'
    check (estado in ('pendiente','en_progreso','completada','saltada')),
  notas text
);

alter table ruta_paradas enable row level security;
create policy "Auth lee paradas" on ruta_paradas for select using (auth.role() = 'authenticated');
create policy "Admin/repartidor gestiona paradas" on ruta_paradas for all
  using (get_my_role() in ('admin','repartidor'));

-- ============================================================
-- ENTREGAS
-- ============================================================
create table entregas (
  id serial primary key,
  ruta_parada_id int references ruta_paradas,
  entregado_completo boolean default true,
  foto_url text,
  gps_lat decimal(10,7),
  gps_lng decimal(10,7),
  firma_url text,
  receptor_nombre text,
  notas text,
  created_at timestamptz default now()
);

alter table entregas enable row level security;
create policy "Auth lee entregas" on entregas for select using (auth.role() = 'authenticated');
create policy "Repartidor/admin registra entregas" on entregas for all
  using (get_my_role() in ('repartidor','admin'));

create table entrega_items (
  id serial primary key,
  entrega_id int references entregas on delete cascade,
  producto_id int references productos,
  cantidad_entregada decimal
);

alter table entrega_items enable row level security;
create policy "Auth lee entrega items" on entrega_items for select using (auth.role() = 'authenticated');
create policy "Repartidor/admin registra entrega items" on entrega_items for all
  using (get_my_role() in ('repartidor','admin'));

-- ============================================================
-- TRACKING GPS
-- ============================================================
create table repartidor_ubicacion (
  id serial primary key,
  repartidor_id uuid references profiles,
  ruta_id int references rutas,
  lat decimal(10,7),
  lng decimal(10,7),
  timestamp timestamptz default now()
);

alter table repartidor_ubicacion enable row level security;
create policy "Auth lee ubicacion" on repartidor_ubicacion for select using (auth.role() = 'authenticated');
create policy "Repartidor inserta ubicacion" on repartidor_ubicacion for insert
  with check (auth.uid() = repartidor_id);

-- ============================================================
-- NOTIFICACIONES
-- ============================================================
create table notificaciones (
  id serial primary key,
  usuario_id uuid references profiles,
  tipo text,
  titulo text not null,
  mensaje text,
  leida boolean default false,
  referencia_id int,
  referencia_tipo text,
  created_at timestamptz default now()
);

alter table notificaciones enable row level security;
create policy "Ver propias notif" on notificaciones for select using (auth.uid() = usuario_id);
create policy "Marcar leida" on notificaciones for update using (auth.uid() = usuario_id);
create policy "Sistema inserta notif" on notificaciones for insert with check (true);

-- ============================================================
-- ÍNDICES DE PERFORMANCE
-- ============================================================
create index idx_pedidos_fecha on pedidos(fecha_entrega);
create index idx_pedidos_estado on pedidos(estado);
create index idx_lugar_modelo_lugar on lugar_modelo(lugar_id);
create index idx_stock_mov_producto on stock_movimientos(producto_id, created_at desc);
create index idx_ruta_paradas_ruta on ruta_paradas(ruta_id);
create index idx_notif_usuario on notificaciones(usuario_id, leida);
create index idx_gps_ruta on repartidor_ubicacion(ruta_id, timestamp desc);

-- ============================================================
-- REALTIME: habilitar para seguimiento en vivo
-- ============================================================
alter publication supabase_realtime add table repartidor_ubicacion;
alter publication supabase_realtime add table notificaciones;
alter publication supabase_realtime add table pedidos;
alter publication supabase_realtime add table rutas;
