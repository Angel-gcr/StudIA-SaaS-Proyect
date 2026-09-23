-- =========================================================================
-- StudIA — Seguridad de perfiles (H-1, H-2, H-6 de docs/TECNICO.md §5.1)
-- =========================================================================
-- H-1: el rol y el tenant se asignaban desde raw_user_meta_data, que el
--      propio usuario rellena al hacer signUp con la anon key. Ahora solo
--      se leen de raw_app_meta_data, que únicamente el servidor (service_role)
--      puede escribir. Sin rol asignado por el servidor no se crea perfil y
--      el usuario no tiene acceso a nada. GoTrue (auth.admin.createUser)
--      inserta el usuario y añade el app_metadata propio en un UPDATE
--      posterior, así que el trigger escucha también ese UPDATE. Solo crea
--      perfiles: los cambios de rol no se sincronizan desde app_metadata.
-- H-2: la política de autoedición permitía cambiar rol, créditos y tenant.
--      Ahora el rol authenticated solo puede actualizar nombre_completo
--      (privilegio por columna). Roles y créditos se cambian desde el servidor.
-- H-6: políticas con "to authenticated", funciones envueltas en (select ...)
--      y una política permisiva por acción para no evaluar varias por fila.
-- =========================================================================

-- ---------------------------------------------------------------------
-- H-1. Trigger de alta: solo app_metadata
-- ---------------------------------------------------------------------
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rol rol_usuario := (new.raw_app_meta_data->>'rol')::rol_usuario;
begin
  -- Sin rol asignado por el servidor, o con perfil ya creado: nada que hacer.
  if v_rol is null or exists (select 1 from public.profiles where id = new.id) then
    return new;
  end if;

  insert into public.profiles (id, tenant_id, rol, nombre_completo, email)
  values (
    new.id,
    nullif(new.raw_app_meta_data->>'tenant_id', '')::uuid,
    v_rol,
    new.raw_user_meta_data->>'nombre_completo',
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert or update of raw_app_meta_data on auth.users
  for each row execute function private.handle_new_user();

-- ---------------------------------------------------------------------
-- H-2. Privilegios mínimos y explícitos
-- ---------------------------------------------------------------------
-- En remoto, anon y authenticated tenían TODOS los privilegios (incluido
-- TRUNCATE) por los grants automáticos de Supabase; en un proyecto nuevo no
-- tienen ninguno (Supabase está haciendo la exposición opt-in). Se parte de
-- cero en ambos casos y se concede solo lo necesario.
revoke all on public.profiles, public.tenants from anon, authenticated;

-- authenticated: lee según RLS; solo puede editar nombre_completo (qué filas,
-- lo decide la política de update). Alta y baja, solo el DUEÑO por política.
grant select, insert, delete on public.profiles to authenticated;
grant update (nombre_completo) on public.profiles to authenticated;
grant select, insert, update, delete on public.tenants to authenticated;

-- service_role (servidor): registro de academias, webhooks y tareas del DUEÑO.
grant select, insert, update, delete on public.profiles, public.tenants to service_role;

-- ---------------------------------------------------------------------
-- H-6. Políticas reescritas
-- ---------------------------------------------------------------------
drop policy if exists "dueno_ve_todos_los_tenants" on public.tenants;
drop policy if exists "dueno_gestiona_tenants" on public.tenants;
drop policy if exists "miembros_ven_su_tenant" on public.tenants;

create policy "tenants_visibles" on public.tenants
  for select to authenticated
  using ((select private.es_dueno()) or id = (select private.mi_tenant_id()));

create policy "dueno_crea_tenants" on public.tenants
  for insert to authenticated
  with check ((select private.es_dueno()));

create policy "dueno_edita_tenants" on public.tenants
  for update to authenticated
  using ((select private.es_dueno()))
  with check ((select private.es_dueno()));

create policy "dueno_borra_tenants" on public.tenants
  for delete to authenticated
  using ((select private.es_dueno()));

drop policy if exists "usuario_ve_su_propio_perfil" on public.profiles;
drop policy if exists "usuario_edita_su_propio_perfil" on public.profiles;
drop policy if exists "dueno_ve_todos_los_perfiles" on public.profiles;
drop policy if exists "dueno_gestiona_todos_los_perfiles" on public.profiles;
drop policy if exists "admin_ve_perfiles_de_su_tenant" on public.profiles;
drop policy if exists "admin_gestiona_perfiles_de_su_tenant" on public.profiles;
drop policy if exists "profesor_ve_alumnos_de_su_tenant" on public.profiles;

-- Propio perfil; DUEÑO todo; ADMIN su academia; PROFESOR los opositores de su academia.
create policy "perfiles_visibles" on public.profiles
  for select to authenticated
  using (
    id = (select auth.uid())
    or (select private.es_dueno())
    or ((select private.es_admin_o_superior()) and tenant_id = (select private.mi_tenant_id()))
    or ((select private.mi_rol()) = 'PROFESOR'
        and tenant_id = (select private.mi_tenant_id())
        and rol = 'OPOSITOR')
  );

-- Qué filas se pueden editar; qué columnas lo limita el grant de arriba.
create policy "perfiles_editables" on public.profiles
  for update to authenticated
  using (
    id = (select auth.uid())
    or (select private.es_dueno())
    or ((select private.es_admin_o_superior()) and tenant_id = (select private.mi_tenant_id()))
  )
  with check (
    id = (select auth.uid())
    or (select private.es_dueno())
    or ((select private.es_admin_o_superior()) and tenant_id = (select private.mi_tenant_id()))
  );

create policy "dueno_crea_perfiles" on public.profiles
  for insert to authenticated
  with check ((select private.es_dueno()));

create policy "dueno_borra_perfiles" on public.profiles
  for delete to authenticated
  using ((select private.es_dueno()));
