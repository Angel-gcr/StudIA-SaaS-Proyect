-- =========================================================================
-- StudIA — Datos de demostración
-- =========================================================================
-- Crea la academia demo. Los USUARIOS de auth (dueño/admin/profesor/alumno)
-- no se crean aquí por SQL (auth.users lo gestiona Supabase Auth); se crean
-- con el script de seed en Node (ver scripts/seed-demo-users.ts, Fase 9)
-- o manualmente desde el panel de Supabase, pasando tenant_id y rol en
-- user_metadata para que el trigger handle_new_user() cree el profile.
-- =========================================================================

insert into tenants (nombre, slug, activo)
values ('Academia Demo StudIA', 'academia-demo', true)
on conflict (slug) do nothing;
