-- Seguridad de perfiles: H-1 (rol/tenant desde metadatos del usuario),
-- H-2 (autoedición de rol, créditos y tenant) y aislamiento por tenant/rol.
-- Ejecutar con: supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

-- ---------------------------------------------------------------------
-- Datos: dos academias y usuarios legítimos creados como lo hace el
-- servidor (rol y tenant en app_metadata, que el usuario no puede editar).
-- ---------------------------------------------------------------------
insert into tenants (id, nombre, slug) values
  ('a0000000-0000-0000-0000-000000000000', 'Academia A', 'test-a'),
  ('b0000000-0000-0000-0000-000000000000', 'Academia B', 'test-b');

insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data) values
  ('d0000000-0000-0000-0000-000000000000', 'dueno@test.com',
    '{"rol":"DUENO"}', '{"nombre_completo":"Dueño"}'),
  ('a1000000-0000-0000-0000-000000000000', 'admin-a@test.com',
    '{"rol":"ADMIN","tenant_id":"a0000000-0000-0000-0000-000000000000"}', '{"nombre_completo":"Admin A"}'),
  ('a2000000-0000-0000-0000-000000000000', 'prof-a@test.com',
    '{"rol":"PROFESOR","tenant_id":"a0000000-0000-0000-0000-000000000000"}', '{}'),
  ('a3000000-0000-0000-0000-000000000000', 'opo-a@test.com',
    '{"rol":"OPOSITOR","tenant_id":"a0000000-0000-0000-0000-000000000000"}', '{}'),
  ('b3000000-0000-0000-0000-000000000000', 'opo-b@test.com',
    '{"rol":"OPOSITOR","tenant_id":"b0000000-0000-0000-0000-000000000000"}', '{}');

-- Ataques H-1: signUp público con rol/tenant en user_metadata
-- (lo único que la anon key permite rellenar).
insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data) values
  ('e1000000-0000-0000-0000-000000000000', 'atacante1@test.com',
    '{"provider":"email"}', '{"rol":"DUENO"}'),
  ('e2000000-0000-0000-0000-000000000000', 'atacante2@test.com',
    '{"provider":"email"}', '{"rol":"ADMIN","tenant_id":"b0000000-0000-0000-0000-000000000000"}');

-- ---------------------------------------------------------------------
-- H-1
-- ---------------------------------------------------------------------
select is((select count(*) from profiles where id = 'e1000000-0000-0000-0000-000000000000'), 0::bigint,
  'H-1: rol DUENO en user_metadata no crea perfil');
select is((select count(*) from profiles where id = 'e2000000-0000-0000-0000-000000000000'), 0::bigint,
  'H-1: rol ADMIN + tenant ajeno en user_metadata no crea perfil');
select is((select rol::text || ':' || tenant_id::text from profiles where id = 'a1000000-0000-0000-0000-000000000000'),
  'ADMIN:a0000000-0000-0000-0000-000000000000',
  'H-1: el rol y el tenant se toman de app_metadata');

-- Así lo hace GoTrue con auth.admin.createUser: inserta el usuario con
-- app_metadata {provider,...} y añade rol y tenant en un UPDATE posterior.
insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data) values
  ('a4000000-0000-0000-0000-000000000000', 'admin2-a@test.com', '{"provider":"email"}', '{}');
update auth.users
   set raw_app_meta_data = raw_app_meta_data || '{"rol":"ADMIN","tenant_id":"a0000000-0000-0000-0000-000000000000"}'
 where id = 'a4000000-0000-0000-0000-000000000000';
select is((select rol::text from profiles where id = 'a4000000-0000-0000-0000-000000000000'), 'ADMIN',
  'H-1: el perfil se crea cuando el servidor añade el rol a app_metadata tras el alta');

-- Un cambio posterior de app_metadata no reescribe el perfil existente.
update auth.users
   set raw_app_meta_data = raw_app_meta_data || '{"rol":"DUENO"}'
 where id = 'a4000000-0000-0000-0000-000000000000';
select is((select rol::text from profiles where id = 'a4000000-0000-0000-0000-000000000000'), 'ADMIN',
  'H-1: el trigger solo crea perfiles, no cambia roles');
delete from auth.users where id = 'a4000000-0000-0000-0000-000000000000';

-- ---------------------------------------------------------------------
-- H-2: el opositor A solo puede cambiar su nombre
-- ---------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claim.sub = 'a3000000-0000-0000-0000-000000000000';

select lives_ok($$update profiles set nombre_completo = 'Nuevo nombre'
  where id = 'a3000000-0000-0000-0000-000000000000'$$, 'H-2: el usuario puede cambiar su nombre');
select is((select nombre_completo from profiles where id = 'a3000000-0000-0000-0000-000000000000'),
  'Nuevo nombre', 'H-2: el nombre queda guardado');
select throws_ok($$update profiles set rol = 'DUENO'
  where id = 'a3000000-0000-0000-0000-000000000000'$$, '42501', null, 'H-2: no puede cambiarse el rol');
select throws_ok($$update profiles set creditos = 999999
  where id = 'a3000000-0000-0000-0000-000000000000'$$, '42501', null, 'H-2: no puede cambiarse los créditos');
select throws_ok($$update profiles set tenant_id = 'b0000000-0000-0000-0000-000000000000'
  where id = 'a3000000-0000-0000-0000-000000000000'$$, '42501', null, 'H-2: no puede cambiarse de academia');

-- El ADMIN tampoco cambia roles con un update directo (se hará desde el servidor).
set local request.jwt.claim.sub = 'a1000000-0000-0000-0000-000000000000';
select throws_ok($$update profiles set rol = 'ADMIN'
  where id = 'a3000000-0000-0000-0000-000000000000'$$, '42501', null, 'H-2: el ADMIN no cambia roles por update directo');

-- ---------------------------------------------------------------------
-- Aislamiento (regresión al reescribir las políticas, H-6)
-- ---------------------------------------------------------------------
select is((select count(*) from profiles), 3::bigint, 'ADMIN A ve solo los 3 perfiles de su academia');

set local request.jwt.claim.sub = 'a2000000-0000-0000-0000-000000000000';
select is((select count(*) from profiles), 2::bigint, 'PROFESOR A ve su perfil y los opositores de A');

set local request.jwt.claim.sub = 'a3000000-0000-0000-0000-000000000000';
select is((select count(*) from profiles), 1::bigint, 'OPOSITOR A solo ve su perfil');

set local request.jwt.claim.sub = 'b3000000-0000-0000-0000-000000000000';
select is((select count(*) from tenants), 1::bigint, 'OPOSITOR B solo ve su academia');

set local request.jwt.claim.sub = 'd0000000-0000-0000-0000-000000000000';
select is((select count(*) from profiles where id in (
    'd0000000-0000-0000-0000-000000000000', 'a1000000-0000-0000-0000-000000000000',
    'a2000000-0000-0000-0000-000000000000', 'a3000000-0000-0000-0000-000000000000',
    'b3000000-0000-0000-0000-000000000000')), 5::bigint,
  'DUEÑO ve los perfiles de todas las academias');

reset role;
set local request.jwt.claim.sub = '';
set local role anon;
select throws_ok('select count(*) from profiles', '42501', null,
  'anon no tiene ningún privilegio sobre profiles');

select * from finish();
rollback;
