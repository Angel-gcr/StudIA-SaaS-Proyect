# ADR 0001 — ORM y acceso a datos

- **Estado:** aceptado (aprobado por el propietario del producto el 2026-09-21)
- **Fecha:** 2026-09-21
- **Decisores:** propietario del producto (aprueba), tech lead (propone)
- **Relacionado:** `CLAUDE.md` §3 (reglas de oro), `docs/TECNICO.md` §2 (Datos)

## Contexto

StudIA es multi-tenant. La regla innegociable es que **el aislamiento entre academias y entre roles lo garantiza la RLS de Postgres**, no la aplicación. Hoy (Fase 1) el acceso a datos se hace con `@supabase/supabase-js` 2.116.0 + `@supabase/ssr` 0.12.7:

- `src/lib/supabase/server.ts` y `client.ts`: clave anon + sesión del usuario → **respetan RLS**.
- `src/lib/supabase/admin.ts`: `service_role` → **salta RLS**; solo lo usa el registro de academia.
- Tipos en `src/lib/types/database.ts`, escritos a mano (pendiente de regenerar).

Antes de la Fase 2 (documentos, RAG, correcciones, créditos) hay que decidir si se añade un ORM. Factores: RLS por tenant y rol, transacciones (descontar crédito + guardar corrección), consultas vectoriales (pgvector), tipos, migraciones, despliegue serverless en Vercel y coste de mantenimiento para un equipo de una persona.

### Hecho clave de Postgres (verificado)

> "Superusers and roles with the `BYPASSRLS` attribute always bypass the row security system when accessing a table. Table owners normally bypass row security as well, though a table owner can choose to be subject to row security with ALTER TABLE ... FORCE ROW LEVEL SECURITY."
> — https://www.postgresql.org/docs/current/ddl-rowsecurity.html (PostgreSQL 18)

Por tanto, **cualquier conexión directa a Postgres con el usuario dueño de las tablas (`postgres`) o con un rol `bypassrls` ignora nuestras políticas**. Las únicas conexiones que aplican RLS son las que actúan como `anon` o `authenticated` con los claims del JWT puestos (`request.jwt.claims`), que es exactamente lo que hace PostgREST cuando se usa `supabase-js`.

## Opciones

### A) `supabase-js` tipado con tipos generados (estado actual, formalizado)

Cómo: cliente de servidor con la sesión del usuario (cookies) → PostgREST → Postgres con rol `authenticated` + JWT. Tipos con `npx supabase gen types typescript --project-id "$PROJECT_REF" --schema public > src/lib/types/database.ts` ([docs](https://supabase.com/docs/guides/api/rest/generating-types)). Lógica transaccional y vectorial en funciones SQL invocadas con `.rpc()`.

| Pros | Contras |
|---|---|
| **RLS se aplica por defecto**: cada petición lleva el JWT del usuario ([RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)). | No hay transacciones multi-sentencia desde el cliente; hay que escribirlas como funciones SQL (`rpc`). |
| Ya está en el proyecto: cero dependencias nuevas, cero migración. | Consultas complejas (joins, agregados) menos expresivas que un ORM; se resuelven con vistas `security_invoker` o funciones. |
| Encaja con serverless (HTTP, sin pool de conexiones que gestionar en Vercel). | Tipos generados: hay que regenerarlos tras cada migración (se automatiza como paso del flujo). |
| Storage, Auth y Realtime con el mismo cliente. | Dependencia de PostgREST (aceptable: es parte de la plataforma elegida). |
| Recomendado por la guía SSR de Supabase para Next.js ([docs](https://supabase.com/docs/guides/auth/server-side/creating-a-client)). | |

Riesgo de saltarse RLS: **solo** con `createAdminClient()` (service_role). Mitigación: ver "Decisión".

### B) Drizzle ORM

Cómo: conexión Postgres directa (`postgres-js`) a la URI del *Shared Pooler*, con `{ prepare: false }` porque el modo transacción no admite prepared statements ([Supabase + Drizzle](https://supabase.com/docs/guides/database/drizzle)). Versión publicada en npm: `drizzle-orm` 0.45.3 (consultado 2026-09-21).

| Pros | Contras |
|---|---|
| SQL tipado muy expresivo; transacciones nativas (`db.transaction`). | **No respeta RLS por defecto**: la URI del pooler usa el usuario `postgres` (dueño de las tablas) → según Postgres, **salta RLS**. La guía de Supabase para Drizzle no menciona RLS. |
| Soporta declarar políticas (`pgPolicy`, `authenticatedRole` de `drizzle-orm/supabase`) ([docs Drizzle RLS](https://github.com/drizzle-team/drizzle-orm-docs/blob/main/src/content/docs/pg/rls.mdx)). | Para aplicar RLS hay que envolver **cada** consulta en una transacción que haga `set local role authenticated` y `set_config('request.jwt.claims', …)`. El ejemplo oficial construye ese SQL con `sql.raw(JSON.stringify(token))`: frágil y fácil de olvidar en una consulta suelta. |
| Tipos inferidos del esquema TS. | Segunda fuente de verdad del esquema (TS vs `supabase/migrations/*.sql`) o migraciones generadas que hay que conciliar. |
| | Credencial de base de datos (`DATABASE_URL` con contraseña de `postgres`) en Vercel: secreto mucho más poderoso que la anon key. |
| | Pool de conexiones en serverless: más piezas que operar. |

Mitigación posible: crear un rol propio sin `bypassrls`, conceder solo lo necesario, y usar siempre el envoltorio `rls()`. Sigue dependiendo de disciplina en cada llamada.

### C) Prisma ORM

Cómo: la guía oficial de Supabase para Prisma crea un usuario dedicado **con `bypassrls`**: `create user "prisma" with password '…' bypassrls createdb;`, con `DATABASE_URL` (pooler 6543, `pgbouncer=true`) y `DIRECT_URL` (5432) para migraciones ([Supabase + Prisma](https://supabase.com/docs/guides/database/prisma)). Versión publicada en npm: `prisma` 8.0.0-rc.15 como `latest` (consultado 2026-09-21; **sin verificar** su estado estable ni el soporte de RLS en esa versión).

| Pros | Contras |
|---|---|
| DX excelente, Prisma Client muy maduro, migraciones integradas. | **Salta RLS por diseño** en la configuración recomendada por Supabase (`bypassrls`). Todo el aislamiento pasaría a la aplicación → **incumple la regla de oro 2**. |
| | Aplicar RLS exige extensiones de cliente y `set_config` por transacción (patrón no oficial de Supabase; **sin verificar** en docs de Prisma para esta versión). |
| | Motor/esquema propio (`schema.prisma`) en paralelo a las migraciones SQL; pgvector requiere `Unsupported("vector")` y SQL crudo (**sin verificar** en la versión actual). |
| | Dos cadenas de conexión con contraseñas privilegiadas en Vercel. |

## Comparativa

| Criterio | A) supabase-js | B) Drizzle | C) Prisma |
|---|---|---|---|
| RLS por tenant/rol **por defecto** | ✅ Sí | ❌ No (usuario `postgres`) | ❌ No (`bypassrls`) |
| Esfuerzo para respetar RLS | Ninguno | Envoltorio en cada consulta | Extensión + disciplina |
| Transacciones | Vía funciones SQL (`rpc`) | Nativas | Nativas |
| pgvector | Función SQL + `rpc` | SQL tipado / `sql` | SQL crudo |
| Secretos en el servidor | anon (pública) + service_role (aislada) | + `DATABASE_URL` privilegiada | + 2 URLs privilegiadas |
| Dependencias nuevas | 0 | 2+ | 2+ |
| Encaje serverless (Vercel) | HTTP, sin pool | Pooler transaccional | Pooler + direct |

## Decisión

**Opción A: `supabase-js` tipado con tipos generados, encapsulado en repositorios**, con estas reglas:

1. Todo acceso a datos pasa por una clase repositorio en `src/server/repositories/` que recibe el cliente Supabase **por constructor**. Nada de `supabase.from()` en componentes, páginas ni acciones.
2. El cliente por defecto es el de servidor con la sesión del usuario (`src/lib/supabase/server.ts`) → RLS siempre activa.
3. **Operaciones atómicas** (descontar crédito + registrar movimiento + crear corrección) se implementan como funciones SQL `security invoker` (valor por defecto de Postgres) en migraciones versionadas y se llaman con `.rpc()`. Si una función necesita `security definer`, vive en el esquema `private` y comprueba `auth.uid()`/rol dentro.
4. **Búsqueda vectorial**: función SQL tipo `match_documents` filtrada por `tenant_id` (ver `docs/TECNICO.md` §2.5), índice HNSW `vector_cosine_ops` ([docs](https://supabase.com/docs/guides/ai/semantic-search)).
5. **`service_role` confinado**: solo `src/lib/supabase/admin.ts`, marcado con `import "server-only"` (soportado de serie por Next, [docs](https://nextjs.org/docs/app/getting-started/server-and-client-components#preventing-environment-poisoning)), usado únicamente por casos listados en `docs/TECNICO.md` §5 (registro de academia, webhooks de Stripe, jobs del DUEÑO). Cada uso nuevo requiere justificarlo en el plan.
6. Tipos regenerados con el CLI/MCP tras **cada** migración, en la misma PR.

Revisar esta decisión si: aparece un caso con transacciones complejas que no quepa razonablemente en funciones SQL, o si Supabase cambia el modelo de exposición del Data API (ver Consecuencias).

## Consecuencias

- ✅ La RLS sigue siendo la única frontera de aislamiento; los tests de RLS (pgTAP + integración) cubren lo importante.
- ✅ Sin dependencias ni secretos nuevos.
- ⚠️ Parte de la lógica vive en SQL (funciones). Se testea con pgTAP (`supabase test db`) y se versiona en `supabase/migrations/`.
- ⚠️ Supabase anuncia que **va a revocar los `GRANT` automáticos** a `anon`/`authenticated` en tablas nuevas de `public` ("exposure becomes opt-in", [docs](https://supabase.com/docs/guides/api/securing-your-api)). Cada migración que cree una tabla debe incluir sus `grant` mínimos explícitos además de `enable row level security` y sus políticas.
- ⚠️ Si en el futuro se añade un ORM para informes o jobs, deberá conectarse con un rol sin `bypassrls` o limitarse a código del DUEÑO fuera del camino de usuario, con un ADR nuevo.

## Tareas derivadas (no incluidas en este ADR)

- T-ADR1-1: regenerar `src/lib/types/database.ts` con el MCP/CLI y eliminar la versión manual.
- T-ADR1-2: añadir `import "server-only"` a `src/lib/supabase/admin.ts` y a `src/server/**`.
- T-ADR1-3: crear `src/server/repositories/` y mover las consultas de `src/app/(app)/layout.tsx` y `dashboard/page.tsx` a un `PerfilRepository`.
