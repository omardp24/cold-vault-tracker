-- Cold Vault Tracker — configuración de Supabase
-- Corre esto UNA VEZ en tu proyecto de Supabase: Dashboard → SQL Editor → New query → pega esto → Run

-- 1) Tabla única donde vive todo el estado de la app (wallets, aliados, planes, usuarios, sesiones, invitaciones)
--    como un solo bloque JSON. Es intencional: mantiene el resto del código sin cambios y es más que
--    suficiente para el volumen de datos de esta herramienta.
create table if not exists app_state (
  id boolean primary key default true,
  data jsonb not null default '{}'::jsonb,
  version integer not null default 0,
  updated_at timestamptz not null default now(),
  constraint app_state_singleton check (id = true)  -- solo puede existir una fila
);

-- Si ya tenías esta tabla creada antes de la columna `version` (concurrencia optimista:
-- ver updateDb() en src/lib/db.ts), esto la agrega sin romper nada. Es seguro correrlo
-- de nuevo aunque la columna ya exista.
alter table app_state add column if not exists version integer not null default 0;

-- Bloquea el acceso por las claves públicas (anon/publishable) — la app solo se conecta
-- con la clave secreta (service_role / secret key), que en teoría ignora RLS por diseño.
-- NOTA: en algunos proyectos de Supabase esto no se comporta así con las claves nuevas
-- ("secret key") y bloquea también al backend. Como esta tabla NUNCA se toca desde el
-- navegador (solo desde las rutas /api del servidor), lo más simple y seguro es dejarla
-- SIN row level security — el acceso ya está protegido por requerir la clave secreta,
-- que nunca se expone al cliente.
alter table app_state disable row level security;

-- 2) Historial del valor del portafolio, para el gráfico "Evolución" — una fila por snapshot
--    diario que guarda el cron (ver src/app/api/cron/portfolio-snapshot/route.ts). Tabla aparte
--    de app_state a propósito: es una serie de tiempo que crece indefinidamente, y meterla en el
--    blob JSON de app_state encarecería cada lectura/escritura de TODO el estado de la app.
create table if not exists portfolio_snapshots (
  id bigint generated always as identity primary key,
  taken_at timestamptz not null default now(),
  total_usd numeric not null
);
create index if not exists portfolio_snapshots_taken_at_idx on portfolio_snapshots (taken_at);
alter table portfolio_snapshots disable row level security; -- mismo criterio que app_state: solo se toca con la service_role key

-- 3) Log de auditoría interno — quién hizo qué (agregar/quitar wallet, clasificar un
--    movimiento, invitar/quitar usuarios, crear/borrar un plan). Serie de tiempo que
--    crece indefinidamente, igual criterio que portfolio_snapshots: tabla aparte.
create table if not exists audit_log (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  user_id text not null,
  user_name text not null,
  action text not null,
  detail jsonb
);
create index if not exists audit_log_created_at_idx on audit_log (created_at desc);
alter table audit_log disable row level security;

-- 4) Caché de la última respuesta buena de /api/fees por red — para poder mostrar un
--    valor "desactualizado" en vez de un error cuando mempool.space / el RPC de turno
--    está caído (pasa seguido). Una fila por combinación red+isToken, se sobrescribe.
create table if not exists fee_cache (
  chain text not null,
  is_token boolean not null,
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (chain, is_token)
);
alter table fee_cache disable row level security;

-- 5) Historial de saldo POR wallet (no solo el total agregado) — mismo cron diario que
--    portfolio_snapshots, un snapshot por wallet además del total.
create table if not exists wallet_snapshots (
  id bigint generated always as identity primary key,
  wallet_id text not null,
  taken_at timestamptz not null default now(),
  balance_usd numeric not null
);
create index if not exists wallet_snapshots_wallet_taken_idx on wallet_snapshots (wallet_id, taken_at);
alter table wallet_snapshots disable row level security;

-- 6) Deduplicador de notificaciones push por movimiento — mismo espíritu que la label
--    "Recordatorio-creado" en la ingesta de Gmail de tu otro proyecto: evita re-avisar
--    el mismo movimiento en cada corrida del cron diario.
create table if not exists notified_movements (
  movement_key text primary key,
  notified_at timestamptz not null default now()
);
alter table notified_movements disable row level security;

-- 7) Bucket privado de Storage para los comprobantes de transferencias (capturas, PDFs).
--    Privado = nunca accesible por URL pública directa; la app genera links firmados de 60s
--    solo después de verificar que el usuario tiene sesión activa.
insert into storage.buckets (id, name, public)
values ('cold-vault-attachments', 'cold-vault-attachments', false)
on conflict (id) do nothing;

-- Permite que el backend (rol service_role, usando la clave secreta) suba/lea/borre
-- archivos de este bucket. Sin esto, Storage también puede bloquear con el mismo error
-- de row-level security que viste en app_state.
drop policy if exists "cold vault backend access" on storage.objects;
create policy "cold vault backend access"
on storage.objects for all
using (bucket_id = 'cold-vault-attachments' and auth.role() = 'service_role')
with check (bucket_id = 'cold-vault-attachments' and auth.role() = 'service_role');
