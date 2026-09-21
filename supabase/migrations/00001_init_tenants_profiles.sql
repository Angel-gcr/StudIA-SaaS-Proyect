-- =========================================================================
-- StudIA — Migración inicial: tenants (academias), perfiles y roles
-- =========================================================================
-- Jerarquía de roles: DUENO > ADMIN > PROFESOR > OPOSITOR
--   - DUENO: el propietario de la plataforma. Ve y gestiona TODO,
--     de todas las academias (tenants).
--   - ADMIN: administrador de UNA academia. Ve y gestiona solo su academia.
--   - PROFESOR: pertenece a una academia. Ve su ámbito (sus alumnos).
--   - OPOSITOR: alumno. Solo ve lo suyo.
--
-- Regla de oro del proyecto: TODA tabla lleva tenant_id y tiene RLS activo
-- con políticas por tenant y rol. Nunca aislamiento solo visual.
--
-- Las funciones auxiliares (mi_rol, mi_tenant_id, es_dueno, ...) viven en
-- el esquema "private", NO en "public": PostgREST solo expone por API los
-- esquemas listados en "Exposed schemas" (por defecto solo "public"), así
-- que moverlas a "private" evita que queden como endpoints RPC públicos
-- (/rest/v1/rpc/mi_rol) sin aportar nada — son helpers internos de RLS.
-- =========================================================================

-- ---------------------------------------------------------------------
-- 1. Tipo enumerado de roles
-- ---------------------------------------------------------------------
create type rol_usuario as enum ('DUENO', 'ADMIN', 'PROFESOR', 'OPOSITOR');

-- ---------------------------------------------------------------------
-- 2. tenants — cada fila es una academia, un espacio aislado
-- ---------------------------------------------------------------------
create table tenants (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null,
  slug        text not null unique,
  activo      boolean not null default true,
  created_at  timestamptz not null default now()
);

comment on table tenants is
  'Cada fila es una academia de oposiciones. Es la unidad de aislamiento multi-tenant.';

-- ---------------------------------------------------------------------
-- 3. profiles — un perfil por usuario de auth.users, con rol y tenant
-- ---------------------------------------------------------------------
-- El DUEÑO no pertenece a ningún tenant concreto (tenant_id NULL):
-- ve todas las academias. ADMIN/PROFESOR/OPOSITOR siempre tienen tenant_id.
create table profiles (
  id                uuid primary key references auth.users(id) on delete cascade,
  tenant_id         uuid references tenants(id) on delete cascade,
  rol               rol_usuario not null default 'OPOSITOR',
  nombre_completo   text,
  email             text not null,
  creditos          integer not null default 5,
  created_at        timestamptz not null default now(),

  -- Solo el DUEÑO puede tener tenant_id nulo; el resto de roles necesita academia.
  constraint profiles_tenant_requerido_segun_rol check (
    (rol = 'DUENO' and tenant_id is null)
    or (rol <> 'DUENO' and tenant_id is not null)
  )
);

comment on table profiles is
  'Perfil de cada usuario: a qué academia (tenant) pertenece y qué rol tiene.';

create index profiles_tenant_id_idx on profiles(tenant_id);

-- ---------------------------------------------------------------------
-- 4. Esquema privado + funciones auxiliares para las políticas RLS
-- ---------------------------------------------------------------------
-- SECURITY DEFINER + search_path fijo: evita que las políticas que las usan
-- recursionen sobre "profiles" (RLS de profiles llamaría a una función que
-- vuelve a leer profiles bajo RLS) y evita el secuestro de search_path.
create schema if not exists private;

create or replace function private.mi_rol()
returns rol_usuario
language sql
security definer
set search_path = public
stable
as $$
  select rol from profiles where id = auth.uid();
$$;

create or replace function private.mi_tenant_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select tenant_id from profiles where id = auth.uid();
$$;

create or replace function private.es_dueno()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((select rol = 'DUENO' from profiles where id = auth.uid()), false);
$$;

create or replace function private.es_admin_o_superior()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((select rol in ('DUENO', 'ADMIN') from profiles where id = auth.uid()), false);
$$;

create or replace function private.es_profesor_o_superior()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((select rol in ('DUENO', 'ADMIN', 'PROFESOR') from profiles where id = auth.uid()), false);
$$;

-- ---------------------------------------------------------------------
-- 5. Trigger: crear el profile automáticamente al registrarse
-- ---------------------------------------------------------------------
-- El tenant_id y rol iniciales se pasan en user_metadata al hacer signUp()
-- desde la página de registro (ver src/app/(auth)/registro).
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, tenant_id, rol, nombre_completo, email)
  values (
    new.id,
    nullif(new.raw_user_meta_data->>'tenant_id', '')::uuid,
    coalesce((new.raw_user_meta_data->>'rol')::rol_usuario, 'OPOSITOR'),
    new.raw_user_meta_data->>'nombre_completo',
    new.email
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- ---------------------------------------------------------------------
-- 6. Activar RLS en TODAS las tablas (regla de oro no negociable)
-- ---------------------------------------------------------------------
alter table tenants enable row level security;
alter table profiles enable row level security;

-- ---------------------------------------------------------------------
-- 7. Políticas RLS — tenants
-- ---------------------------------------------------------------------
-- El DUEÑO ve y gestiona todas las academias.
create policy "dueno_ve_todos_los_tenants"
  on tenants for select
  using (private.es_dueno());

create policy "dueno_gestiona_tenants"
  on tenants for all
  using (private.es_dueno())
  with check (private.es_dueno());

-- ADMIN/PROFESOR/OPOSITOR pueden ver (solo lectura) los datos de SU academia.
create policy "miembros_ven_su_tenant"
  on tenants for select
  using (id = private.mi_tenant_id());

-- ---------------------------------------------------------------------
-- 8. Políticas RLS — profiles
-- ---------------------------------------------------------------------
-- Cualquier usuario autenticado puede ver y editar su propio perfil.
-- (select auth.uid()) en vez de auth.uid() a secas: Postgres cachea el
-- resultado una vez por consulta en lugar de reevaluarlo fila a fila.
create policy "usuario_ve_su_propio_perfil"
  on profiles for select
  using (id = (select auth.uid()));

create policy "usuario_edita_su_propio_perfil"
  on profiles for update
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- El DUEÑO ve y gestiona todos los perfiles de todas las academias.
create policy "dueno_ve_todos_los_perfiles"
  on profiles for select
  using (private.es_dueno());

create policy "dueno_gestiona_todos_los_perfiles"
  on profiles for all
  using (private.es_dueno())
  with check (private.es_dueno());

-- ADMIN ve y gestiona los perfiles de SU propia academia (no de otras).
create policy "admin_ve_perfiles_de_su_tenant"
  on profiles for select
  using (
    private.es_admin_o_superior()
    and tenant_id = private.mi_tenant_id()
  );

create policy "admin_gestiona_perfiles_de_su_tenant"
  on profiles for update
  using (
    private.es_admin_o_superior()
    and tenant_id = private.mi_tenant_id()
  )
  with check (
    private.es_admin_o_superior()
    and tenant_id = private.mi_tenant_id()
  );

-- PROFESOR ve los perfiles de OPOSITOR de su misma academia (para poder
-- revisar y corregir). No puede editar perfiles ajenos, solo verlos.
create policy "profesor_ve_alumnos_de_su_tenant"
  on profiles for select
  using (
    private.mi_rol() = 'PROFESOR'
    and tenant_id = private.mi_tenant_id()
    and rol = 'OPOSITOR'
  );
