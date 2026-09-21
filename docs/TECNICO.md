# TECNICO.md — Referencia técnica de StudIA

> Se lee **al tocar código o lógica** (solo las secciones afectadas). `CLAUDE.md` dice *cómo trabajamos*; este archivo dice *cómo debe ser el código*. Si un cambio lo contradice, se para y se pregunta. Si lo actualiza, se modifica aquí en la misma PR.

**Última verificación:** 2026-09-21 · Next.js docs 16.3.5 (nextjs.org, `lastUpdated 2026-08-25`) · Supabase docs (`search_docs` MCP + supabase.com/docs) · Supabase advisors del proyecto `nsgcpfmbalonuauozabe` · Vercel docs (MCP `search_vercel_documentation`) · Context7 (Drizzle, Vitest, stripe-node) · docs.stripe.com/webhooks · zod.dev · tailwindcss.com · postgresql.org/docs (v18) · ai.google.dev/gemini-api/terms · opencode.ai/docs/zen y /docs/go · versiones instaladas con `node_modules/*/package.json` y publicadas con `npm view`.
Lo marcado **(sin verificar)** no se ha contrastado con documentación oficial en esa fecha.

## Índice
0. [Versiones y deuda de plataforma](#0-versiones-y-deuda-de-plataforma)
1. [Arquitectura y POO](#1-arquitectura-y-poo)
2. [Datos y acceso a datos](#2-datos-y-acceso-a-datos)
3. [Testing (TDD)](#3-testing-tdd)
4. [SDD: planes y descomposición](#4-sdd-planes-y-descomposición)
5. [Seguridad](#5-seguridad)
6. [Frontend](#6-frontend)
7. [RGPD y legal](#7-rgpd-y-legal)
8. [Git, despliegue y lanzamiento](#8-git-despliegue-y-lanzamiento)
9. [Buenas prácticas generales](#9-buenas-prácticas-generales)

---

## 0. Versiones y deuda de plataforma

| Pieza | Instalada | `package.json` | Última publicada (npm, 2026-09-21) | Nota |
|---|---|---|---|---|
| Next.js | **16.3.5** | `^16.3.5` | 16.3.5 (15.x solo como `backport` 15.5.25) | Adoptado (ADR 0002). Fijar a `~16.3.5` en `chore/next-16`. |
| React / React DOM | 18.3.1 | `18.3.1` | 19.3.0 | El App Router de Next 16 usa internamente React canary con 19.2 ([guía v16](https://nextjs.org/docs/app/guides/upgrading/version-16#react-192)); la guía pide `react@latest`. `useActionState` ya se usa. |
| TypeScript | 5.9.3 | `^5` | 7.0.2 | Next 16 exige ≥ 5.1. Compatibilidad de TS 7 con Next **(sin verificar)**: no subir sin probar. |
| Tailwind CSS | 4.3.3 | `^4` | 4.3.3 | Configuración CSS-first con `@theme`. |
| Zod | 3.25.76 | `^3.23.8` | 4.x | En 3.25.x, `"zod"` exporta Zod 3 y `"zod/v4"` exporta Zod 4 ([versionado](https://zod.dev/v4/versioning)). |
| @supabase/supabase-js | 2.116.0 | `^2.45.4` | 2.117.0 | |
| @supabase/ssr | 0.12.7 | `^0.12.7` | — | |
| eslint / eslint-config-next | 9.39.5 / **15.5.25** | `^9` / `^15.5.25` | — | Config de ESLint de Next 15 con Next 16: alinear a 16.x en `chore/next-16`. |
| Vitest / Playwright | no instalados | — | 5.0.1 / 1.63.0 | Tarea T-01. |
| Node (local) | 26.1.0 | — | — | Next 16 exige ≥ 20.9. Fijar la versión de Node en Vercel **(sin verificar)**. |

Estado comprobado el 2026-09-21: `npx tsc --noEmit` ✔, `npm run lint` ✔, `npm run build` ✔ (con aviso *"middleware file convention is deprecated… use proxy"*).

**D-1 (aprobada, [ADR 0002](adr/0002-nextjs-16-y-react-19.md)):** se adopta Next 16. En la PR `chore/next-16` se fija `~16.3.5`, se alinean `react`, `react-dom`, `@types/react*` (19.x) y `eslint-config-next` (16.x), y se migra `src/middleware.ts` → `src/proxy.ts` (función `proxy`, runtime Node) con `npx @next/codemod@canary middleware-to-proxy .` ([guía](https://nextjs.org/docs/app/guides/upgrading/version-16#middleware-to-proxy)).

Cambios de Next 16 que afectan al código ([guía v16](https://nextjs.org/docs/app/guides/upgrading/version-16)):
- `cookies()`, `headers()`, `params`, `searchParams` **solo asíncronos**.
- `next lint` eliminado (ya usamos `eslint` directamente) y `next build` ya no ejecuta el lint.
- Turbopack por defecto en `dev` y `build`.
- `revalidateTag(tag, perfil)` exige el segundo argumento; `updateTag` para leer lo que se acaba de escribir en Server Actions.

---

## 1. Arquitectura y POO

### 1.1 Capas

```
UI (src/app, src/components)       → componentes funcionales, sin lógica de negocio ni SQL
  │ llama a
Frontera (Server Actions, Route Handlers en src/lib/actions y src/app/api)
  │ valida con Zod, autentica (getClaims/getUser), compone dependencias
  ▼
Servicios (src/server/services)    → casos de uso: CorrectionService, CreditService, DocumentService
  │ dependen de interfaces
  ▼
Puertos / adaptadores
  ├─ src/server/repositories       → acceso a Supabase (RLS del usuario)
  ├─ src/server/ai                 → AIProvider, EmbeddingProvider
  └─ src/server/payments           → PaymentProvider
Dominio (src/server/domain)        → tipos y reglas puras: Rubrica, Criterio, Correccion, Credito
```

Reglas:
- La dependencia apunta hacia dentro: el dominio no importa nada de Next, Supabase ni proveedores.
- Los servicios **reciben** sus dependencias por constructor. Solo la *raíz de composición* (una función `crearServicios()` en `src/server/composicion.ts`) hace `new` de proveedores y repositorios.
- Todo archivo de `src/server/**` empieza con `import "server-only";`. Next lo gestiona sin instalar el paquete y da error de build si se importa desde el cliente ([docs](https://nextjs.org/docs/app/getting-started/server-and-client-components#preventing-environment-poisoning)).
- Los componentes de React son funciones. Las clases solo están en `src/server`.
- `src/server/domain/` es una carpeta nueva que propone este documento para las entidades; el resto de carpetas son las de `CLAUDE.md`.

### 1.2 Interfaces intercambiables

| Interfaz | Implementaciones | Selección |
|---|---|---|
| `AIProvider` | `OpenCodeZenProvider` (**principal**), `GeminiProvider` (**opcional**, desactivado por defecto) | `ProveedorIAConRespaldo` con la lista ordenada `[Zen, Gemini?]` (composición, no herencia). Gemini solo entra si `GEMINI_API_KEY` existe, el ADMIN o el DUEÑO lo han activado y el tenant ha aceptado ese encargado. Nunca OpenCode Go ([ADR 0003](adr/0003-proveedores-de-ia.md)). |
| `EmbeddingProvider` | Por decidir en el plan de la Fase 2 | La dimensión del vector depende del modelo |
| `PaymentProvider` | `MockPaymentProvider` (hoy), `StripePaymentProvider` | Variable de entorno de servidor; la maqueta muestra un aviso visible en la UI |

Datos de proveedores verificados: OpenCode Zen tiene endpoints distintos según la familia de modelo (`/zen/v1/chat/completions`, `/zen/v1/responses`, `/zen/v1/messages`, `/zen/v1/models/<id>`) y **aloja todos los modelos en EE. UU.** ([docs](https://opencode.ai/docs/zen/)). Por eso `OPENCODE_ZEN_BASE_URL` = `https://opencode.ai/zen/v1/` y la ruta concreta la decide el adaptador. El adaptador rechaza cualquier modelo fuera de la **lista blanca** (retención cero, no entrena; nunca `Free` ni *Contributor*). OpenCode Go (`/zen/go/v1/...`) está limitado a *"typical coding agent traffic"* ([docs](https://opencode.ai/docs/go/)) y no se usa en el producto.

### 1.3 Ejemplo completo: interfaz + implementación + test con doble

```ts
// src/server/domain/correccion.ts
export type EstadoCriterio = "cumple" | "parcial" | "no_cumple" | "no_verificable";
export interface Criterio { id: string; descripcion: string; puntuacionMaxima: number }
export interface Rubrica { id: string; tenantId: string; criterios: Criterio[] }
export interface Fragmento { documentoId: string; contenido: string; pagina: number | null }
export interface ValoracionCriterio {
  criterioId: string;
  estado: EstadoCriterio;
  puntuacion: number;
  evidenciaAlumno: string | null; // cita literal del texto del opositor
  fuente: Fragmento | null;       // cita del temario autorizado
  comentario: string;
}
export interface PropuestaCorreccion { estado: "propuesta"; valoraciones: ValoracionCriterio[] }

export function noVerificable(c: Criterio): ValoracionCriterio {
  return { criterioId: c.id, estado: "no_verificable", puntuacion: 0, evidenciaAlumno: null, fuente: null,
           comentario: "No tengo información suficiente en los documentos autorizados." };
}
```

```ts
// src/server/ai/ai-provider.ts
import "server-only";
import type { Criterio, Fragmento, ValoracionCriterio } from "@/server/domain/correccion";

export interface AIProvider {
  readonly nombre: string;
  evaluarCriterio(entrada: { criterio: Criterio; respuesta: string; fragmentos: Fragmento[] }): Promise<ValoracionCriterio>;
}
```

```ts
// src/server/services/correction-service.ts
import "server-only";
import type { AIProvider } from "@/server/ai/ai-provider";
import { noVerificable, type Fragmento, type PropuestaCorreccion, type Rubrica } from "@/server/domain/correccion";

export interface FuentesAutorizadas {
  buscar(tenantId: string, consulta: string): Promise<Fragmento[]>;
}

export class CorrectionService {
  constructor(private readonly ia: AIProvider, private readonly fuentes: FuentesAutorizadas) {}

  async proponer(rubrica: Rubrica, respuesta: string): Promise<PropuestaCorreccion> {
    const valoraciones = [];
    for (const criterio of rubrica.criterios) {
      const fragmentos = await this.fuentes.buscar(rubrica.tenantId, criterio.descripcion);
      if (fragmentos.length === 0) { valoraciones.push(noVerificable(criterio)); continue; }
      const v = await this.ia.evaluarCriterio({ criterio, respuesta, fragmentos });
      // RAG estricto: sin cita de una fuente autorizada no hay valoración.
      const citaValida = v.fuente !== null && fragmentos.some((f) => f.documentoId === v.fuente!.documentoId);
      valoraciones.push(citaValida ? v : noVerificable(criterio));
    }
    return { estado: "propuesta", valoraciones }; // la IA propone; el profesor publica
  }
}
```

```ts
// src/server/services/correction-service.test.ts
import { describe, expect, it, vi } from "vitest";
import { CorrectionService, type FuentesAutorizadas } from "./correction-service";
import type { AIProvider } from "@/server/ai/ai-provider";

vi.mock("server-only", () => ({})); // en Vitest no actúa el bundler de Next (ver nota)
const rubrica = { id: "r1", tenantId: "t1", criterios: [{ id: "c1", descripcion: "Cita la LOMLOE", puntuacionMaxima: 2 }] };
const fragmento = { documentoId: "doc-1", contenido: "Ley Orgánica 3/2020…", pagina: 4 };

class IAFalsa implements AIProvider {
  readonly nombre = "falsa";
  llamadas = 0;
  constructor(private readonly documentoCitado: string) {}
  async evaluarCriterio() {
    this.llamadas++;
    return { criterioId: "c1", estado: "cumple" as const, puntuacion: 2, evidenciaAlumno: "según la LOMLOE",
             fuente: { ...fragmento, documentoId: this.documentoCitado }, comentario: "Correcto" };
  }
}
const fuentes = (lista: typeof fragmento[]): FuentesAutorizadas => ({ buscar: async () => lista });

describe("CorrectionService.proponer", () => {
  it("marca el criterio como no verificable y no llama a la IA si no hay fuentes", async () => {
    const ia = new IAFalsa("doc-1");
    const r = await new CorrectionService(ia, fuentes([])).proponer(rubrica, "texto");
    expect(r.valoraciones[0].estado).toBe("no_verificable");
    expect(ia.llamadas).toBe(0);
  });

  it("descarta una valoración que cita un documento no autorizado", async () => {
    const r = await new CorrectionService(new IAFalsa("doc-inventado"), fuentes([fragmento])).proponer(rubrica, "texto");
    expect(r.valoraciones[0].estado).toBe("no_verificable");
  });

  it("devuelve una propuesta, nunca una corrección publicada", async () => {
    const r = await new CorrectionService(new IAFalsa("doc-1"), fuentes([fragmento])).proponer(rubrica, "texto");
    expect(r).toMatchObject({ estado: "propuesta", valoraciones: [{ estado: "cumple", puntuacion: 2 }] });
  });
});
```
> Este ejemplo se ejecutará cuando exista Vitest (T-01). Cómo resolver `server-only` en Vitest (con `vi.mock` o con un alias en `vitest.config.mts`) está **(sin verificar)**: confirmarlo en T-01.

### 1.4 SOLID aplicado
- **S**: un servicio = un caso de uso. `CreditService` no sabe de IA; `CorrectionService` no descuenta créditos directamente, se orquesta desde la frontera o desde un servicio de aplicación.
- **O/L**: nuevo proveedor = nueva clase que implementa `AIProvider`; ningún `if (proveedor === "gemini")` en servicios.
- **I**: interfaces pequeñas definidas por quien las usa (`FuentesAutorizadas` vive junto al servicio).
- **D**: servicios dependen de interfaces; la composición está en un solo sitio.
- Composición sobre herencia: el *fallback* es un `AIProvider` que envuelve una lista de `AIProvider`.

### Comprobaciones antes de dar por bueno un cambio aquí
- [ ] Ningún `new` de proveedor/repositorio fuera de `src/server/composicion.ts` (salvo en tests).
- [ ] `import "server-only"` en todo archivo nuevo de `src/server/**`.
- [ ] El dominio no importa Next, Supabase ni SDKs de IA/pagos.
- [ ] Sin evidencia/fuente autorizada → `no_verificable`. Nada se publica sin acción del profesor.
- [ ] Nombres de dominio en español del negocio (rúbrica, criterio, corrección, crédito, tenant).

---

## 2. Datos y acceso a datos

### 2.1 Resumen del ADR 0001 (aceptado)
`supabase-js` tipado con tipos generados, encapsulado en repositorios; transacciones y búsqueda vectorial como funciones SQL llamadas con `.rpc()`; `service_role` confinado. Drizzle y Prisma descartados porque, con la configuración de Supabase, **se conectan con roles que saltan la RLS** (dueño de tablas / `bypassrls`). Detalle: [`docs/adr/0001-orm-y-acceso-a-datos.md`](adr/0001-orm-y-acceso-a-datos.md).

### 2.2 Reglas de acceso
| Dónde | Permitido |
|---|---|
| Componentes cliente | Nada de datos directos salvo Auth del navegador. |
| Server Components, Server Actions, Route Handlers | Solo a través de repositorios/servicios. |
| `src/server/repositories/*` | `supabase.from()` / `.rpc()` con el cliente de sesión (`src/lib/supabase/server.ts`). |
| `src/lib/supabase/admin.ts` (service_role) | Solo casos listados en §5.3. |

- **Autenticación en servidor:** usar `supabase.auth.getClaims()` para proteger páginas y datos; *"Never trust `supabase.auth.getSession()` inside server code"* ([docs](https://supabase.com/docs/guides/auth/server-side/creating-a-client)). `getUser()` cuando se necesite el usuario fresco del servidor de Auth. Hoy usamos `getUser()`: válido, más lento.
- **Filtro explícito además de RLS**: añadir `.eq("tenant_id", …)` aunque la política ya filtre; mejora el plan de consulta ([docs RLS](https://supabase.com/docs/guides/database/postgres/row-level-security#add-filters-to-every-query)).

### 2.3 Migraciones y tipos
- Una migración por cambio en `supabase/migrations/NNNNN_descripcion.sql`, aplicada **primero en desarrollo** (rama de Supabase o proyecto local) y luego en producción.
- Toda tabla nueva: `tenant_id uuid not null references tenants(id)`, índice en `tenant_id`, `enable row level security`, políticas `to authenticated` con `(select auth.uid())` / `(select private.fn())`, y **`grant` explícitos mínimos**: Supabase va a revocar los permisos automáticos de tablas nuevas en `public` ([docs](https://supabase.com/docs/guides/api/securing-your-api)).
- Tipos: `npx supabase gen types typescript --project-id "$PROJECT_REF" --schema public > src/lib/types/database.ts` o `--local` ([docs](https://supabase.com/docs/guides/api/rest/generating-types)); o MCP `generate_typescript_types`. Hoy el archivo es manual (T-ADR1-1).
- Tras cada migración: MCP `get_advisors` (security y performance).

### 2.4 Transacciones
Supabase-js no abre transacciones multi-sentencia; se usa una función SQL (una llamada = una transacción):

```sql
-- Consumir 1 crédito y registrar el movimiento de forma atómica.
create or replace function public.consumir_credito(p_correccion_id uuid)
returns integer language plpgsql security invoker set search_path = public as $$
declare v_restantes integer;
begin
  update profiles set creditos = creditos - 1
   where id = (select auth.uid()) and creditos > 0
  returning creditos into v_restantes;
  if v_restantes is null then raise exception 'sin_creditos' using errcode = 'P0001'; end if;
  insert into movimientos_credito (tenant_id, usuario_id, correccion_id, cantidad)
  values ((select private.mi_tenant_id()), (select auth.uid()), p_correccion_id, -1);
  return v_restantes;
end $$;
```
> Ejemplo de diseño: requiere la tabla `movimientos_credito` y **que el usuario no pueda editar `creditos` directamente** (hoy sí puede, ver §5 H-2). Se decidirá en el plan de créditos si esta función debe ser `security definer` en `private` con comprobación de rol.

### 2.5 Consultas vectoriales (pgvector)
`pgvector` ya está activado en el esquema `extensions` (migración 00003). Patrón ([docs](https://supabase.com/docs/guides/ai/semantic-search)):

```sql
create index on fragmentos using hnsw (embedding extensions.vector_cosine_ops);

create or replace function public.buscar_fragmentos(consulta extensions.vector(768), limite int default 8)
returns table (id uuid, documento_id uuid, contenido text, similitud float)
language sql stable security invoker set search_path = public, extensions as $$
  select f.id, f.documento_id, f.contenido, 1 - (f.embedding <=> consulta)
  from fragmentos f
  where f.tenant_id = (select private.mi_tenant_id())   -- además de la RLS
  order by f.embedding <=> consulta
  limit least(limite, 50);
$$;
```
- `768` es un ejemplo: la dimensión la fija el `EmbeddingProvider` elegido.
- `security invoker` (valor por defecto) ⇒ se aplica la RLS de `fragmentos` al que llama.

### 2.6 Ejemplo de repositorio
```ts
// src/server/repositories/perfil-repository.ts
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Rol } from "@/lib/types/database";

export interface Perfil { id: string; tenantId: string | null; rol: Rol; nombre: string | null; creditos: number }

export class PerfilRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async obtener(id: string): Promise<Perfil | null> {
    const { data, error } = await this.db
      .from("profiles").select("id, tenant_id, rol, nombre_completo, creditos").eq("id", id).maybeSingle();
    if (error) throw new Error(`perfil.obtener: ${error.code}`); // sin datos personales en el mensaje
    return data && { id: data.id, tenantId: data.tenant_id, rol: data.rol, nombre: data.nombre_completo, creditos: data.creditos };
  }
}
```

### 2.7 Ejemplo de política RLS y su test
```sql
-- supabase/migrations/000NN_documentos.sql (ejemplo para la Fase 2)
create table documentos (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  subido_por uuid not null references profiles(id),
  titulo text not null,
  ruta_storage text not null,
  created_at timestamptz not null default now()
);
create index documentos_tenant_id_idx on documentos(tenant_id);
alter table documentos enable row level security;
grant select, insert, delete on documentos to authenticated;

create policy "miembros_leen_documentos_de_su_tenant" on documentos for select to authenticated
  using (tenant_id = (select private.mi_tenant_id()));
create policy "profesores_suben_documentos" on documentos for insert to authenticated
  with check (tenant_id = (select private.mi_tenant_id()) and (select private.es_profesor_o_superior())
              and subido_por = (select auth.uid()));
```

```sql
-- supabase/tests/database/documentos_rls.test.sql  (pgTAP, `supabase test db`)
begin;
create extension if not exists pgtap with schema extensions;
select plan(3);

insert into tenants (id, nombre, slug) values
  ('00000000-0000-0000-0000-00000000000a', 'A', 'a'), ('00000000-0000-0000-0000-00000000000b', 'B', 'b');
insert into auth.users (id, email, raw_user_meta_data) values
  ('10000000-0000-0000-0000-000000000001', 'prof-a@test.com', '{"tenant_id":"00000000-0000-0000-0000-00000000000a","rol":"PROFESOR"}'),
  ('10000000-0000-0000-0000-000000000002', 'alum-b@test.com', '{"tenant_id":"00000000-0000-0000-0000-00000000000b","rol":"OPOSITOR"}');
insert into documentos (tenant_id, subido_por, titulo, ruta_storage) values
  ('00000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-000000000001', 'Temario A', 'a/t.pdf');

set local role authenticated;
set local request.jwt.claim.sub = '10000000-0000-0000-0000-000000000002';  -- opositor de B
select results_eq('select count(*) from documentos', array[0::bigint], 'B no ve documentos de A');
select throws_ok($$insert into documentos (tenant_id, subido_por, titulo, ruta_storage)
  values ('00000000-0000-0000-0000-00000000000b', '10000000-0000-0000-0000-000000000002', 'x', 'x')$$,
  '42501', null, 'un opositor no puede subir documentos');

set local request.jwt.claim.sub = '10000000-0000-0000-0000-000000000001';  -- profesor de A
select results_eq('select count(*) from documentos', array[1::bigint], 'A ve su documento');

select * from finish();
rollback;
```
Patrón de `set local role` / `request.jwt.claim.sub` tomado de la [guía de testing de Supabase](https://supabase.com/docs/guides/local-development/testing/overview). Requiere el CLI de Supabase y Docker (T-02).

### Comprobaciones antes de dar por bueno un cambio aquí
- [ ] Tabla nueva con `tenant_id`, índice, RLS, políticas `to authenticated`, `grant` mínimos.
- [ ] Test pgTAP con al menos un caso **negativo** por rol y por tenant.
- [ ] Tipos regenerados y `get_advisors` sin avisos nuevos de seguridad.
- [ ] Ninguna consulta fuera de `src/server/repositories`.
- [ ] Ningún uso nuevo de `createAdminClient()` sin justificar en el plan.

---

## 3. Testing (TDD)

### 3.1 Ciclo
1. **Seams acordados** con el usuario y apuntados en el plan (§7 de la plantilla) **antes** del primer test.
2. Rojo: un test de comportamiento por la interfaz pública.
3. Verde: la implementación mínima.
4. Repetir por cortes verticales (UI → acción → servicio → repositorio → BD) en lugar de por capas completas.
5. El refactor se hace en la revisión, con los tests en verde.

### 3.2 Pirámide para StudIA
| Nivel | Qué | Herramienta | Dónde |
|---|---|---|---|
| Unitario | Servicios y dominio con dobles en los seams (`AIProvider`, `FuentesAutorizadas`, `PaymentProvider`) | Vitest | junto al archivo: `*.test.ts` |
| Integración BD | Políticas RLS, funciones SQL, triggers | pgTAP + `supabase test db` ([docs](https://supabase.com/docs/guides/database/testing)) | `supabase/tests/database/*.test.sql` |
| Integración app | Repositorios contra Supabase local con usuarios de prueba únicos por suite ([docs](https://supabase.com/docs/guides/local-development/testing/overview)) | Vitest (entorno `node`) | `tests/integracion/` |
| E2E | Rutas críticas: registro, login, subir documento, corregir, publicar, exportar datos | Playwright contra `npm run build && npm run start` ([docs](https://nextjs.org/docs/app/guides/testing/playwright)) | `tests/e2e/` |

Vitest no admite Server Components `async`; para ellos, E2E ([docs](https://nextjs.org/docs/app/guides/testing/vitest)).

### 3.3 Qué NO testear
- Detalles internos (métodos privados, orden de llamadas internas, clases de Tailwind).
- El SDK de Supabase, de Stripe o de la IA en sí; solo nuestro adaptador en su frontera.
- Llamadas reales a proveedores de IA en CI (coste y no determinismo).
- Mocks de módulos internos propios: si hace falta, el diseño necesita un seam.

### 3.4 Herramientas (tarea T-01, no instaladas)
Instalación documentada por Next ([Vitest](https://nextjs.org/docs/app/guides/testing/vitest)):
`npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/dom vite-tsconfig-paths`

```ts
// vitest.config.mts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
export default defineConfig({ plugins: [tsconfigPaths(), react()], test: { environment: "jsdom" } });
```
Scripts propuestos: `"typecheck": "tsc --noEmit"`, `"test": "vitest run"`, `"test:watch": "vitest"`, `"e2e": "playwright test"`, `"test:db": "supabase test db"`.
Playwright: `npm init playwright` ([docs](https://nextjs.org/docs/app/guides/testing/playwright)), con `webServer` apuntando a `npm run start` tras el build.

Ejemplo de test de corrección por criterios: §1.3.

### Comprobaciones antes de dar por bueno un cambio aquí
- [ ] Cada test se vio en rojo antes de pasar a verde.
- [ ] Los tests usan solo interfaces públicas y seams acordados.
- [ ] Hay casos negativos (sin fuente, sin créditos, otro tenant, rol insuficiente).
- [ ] `npm run typecheck && npm run lint && npm test && npm run build` en verde.

---

## 4. SDD: planes y descomposición

1. Copiar `plans/_TEMPLATE.md` a `plans/<feature>.md`. **`plans/` está en `.gitignore`**: el plan es local, y la PR resume su contenido (decisión D-4).
2. Rellenar: problema, alcance y no-alcance, criterios de aceptación comprobables, diseño con referencias, datos y RLS, seguridad, seams, tareas pequeñas y URLs de documentación.
3. El usuario lo aprueba (`Estado: aprobado`). Sin aprobación no se escribe código.
4. Cada tarea cabe en una sesión: un test → código → verificación → commit.

### Plan de ejemplo: subida de documentos (resumido)
```md
# Plan: subida de documentos del temario
Rama: feature/subida-documentos · Estado: borrador · Fecha: 2026-09-21

## 1. Por qué
El profesor necesita cargar el temario autorizado para que la IA pueda citarlo (RAG estricto).
## 2. Alcance / fuera de alcance
Sí: subir PDF (máx. 20 MB), listar, borrar; solo PROFESOR+ de su academia.
No: OCR, troceado y embeddings (plan siguiente), DOCX, carpetas.
## 3. Criterios de aceptación
- Un PROFESOR sube un PDF de ≤ 20 MB y lo ve en la lista con título, fecha y tamaño.
- Un OPOSITOR no ve el botón y recibe 403 si llama a la acción.
- Un usuario de otra academia no puede leer ni el registro ni el objeto de Storage (test RLS).
- Un archivo > 20 MB o que no sea PDF se rechaza con un mensaje claro y sin gastar almacenamiento.
## 4. Diseño
Referencia: lista de archivos de Linear/Notion. Estados: vacío ("Aún no hay temario"), carga, error, éxito.
## 5. Datos y flujo
Tabla `documentos` (§2.7), bucket privado `temario` con `file_size_limit` y `allowed_mime_types`
(docs: supabase.com/docs/guides/storage/uploads/file-limits), políticas en `storage.objects` por
carpeta `<tenant_id>/…`. Flujo: formulario → Server Action (Zod) → DocumentService → Storage + repositorio.
## 6. Seguridad
Autorización en servidor por rol; límite de tamaño en bucket y en Zod; cuota de almacenamiento por tenant;
nombre de archivo saneado; rate limit de subidas.
## 7. Seams (a confirmar)
DocumentService.subir(); política RLS de `documentos` y `storage.objects`; E2E de subida.
## 8. Tareas
- [ ] T1 Migración `documentos` + test pgTAP (rojo → verde)
- [ ] T2 Bucket + políticas Storage + test de acceso cruzado
- [ ] T3 DocumentService.subir con doble de Storage
- [ ] T4 Server Action con Zod + UI con estados
- [ ] T5 E2E Playwright
## 9. Verificación
typecheck, lint, test, test:db, build; flujo manual con PROFESOR y OPOSITOR de dos academias.
## 10. Documentación consultada
(URLs)
## 11. Riesgos
PDFs con datos personales de menores: aviso al subir y retención definida (§7).
```

### Comprobaciones antes de dar por bueno un cambio aquí
- [ ] Existe un plan aprobado y la PR lo resume y enlaza.
- [ ] Nada fuera del alcance del plan.
- [ ] Todas las URLs de documentación del plan se consultaron de verdad.

---

## 5. Seguridad

### 5.1 Hallazgos abiertos (análisis del código y docs, 2026-09-21)
| Id | Gravedad | Hallazgo | Propuesta | Cuándo |
|---|---|---|---|---|
| **H-1** | **Crítica** | `private.handle_new_user()` toma `rol` y `tenant_id` de `raw_user_meta_data`. Supabase lo documenta como editable por el usuario y *"not a good place to store authorization data"* ([docs](https://supabase.com/docs/guides/database/postgres/row-level-security#authjwt)). Cualquiera con la anon key puede llamar a `signUp` con `{rol:"DUENO"}` sin `tenant_id` (el `check` lo permite) o `{rol:"ADMIN", tenant_id:<otra academia>}`. | El trigger deja de leer `raw_user_meta_data` para rol y tenant. Diseño a elegir en el plan `fix-seguridad-perfiles` (opciones A/B). Test pgTAP de regresión escrito primero (rojo). | **Ya**, antes de nada |
| **H-2** | **Crítica** | La política `usuario_edita_su_propio_perfil` permite `UPDATE` de **todas** las columnas de su fila: un usuario puede cambiarse `rol`, `creditos` o `tenant_id`. | `revoke update on profiles from authenticated; grant update (nombre_completo) on profiles to authenticated;` ([privilegios por columna](https://supabase.com/docs/guides/database/postgres/column-level-security); Supabase los considera avanzados y recomienda en general una tabla de roles aparte). Los cambios de rol y créditos se hacen solo desde el servidor. Test pgTAP. | **Ya** |
| **H-3** | Alta | `/auth/confirm` redirige a `${origin}${next}` sin validar `next`. Un valor como `@dominio-ajeno.com` produce `https://studia…@dominio-ajeno.com` (redirección abierta). | Aceptar solo rutas internas que empiecen por `/` y no por `//` ni `/\`; validar con Zod. Test unitario. | **Ya** |
| H-4 | Media | Registro: crea el tenant con `service_role` **antes** de `signUp` y sin límite de peticiones → creación masiva de academias. | Rate limit por IP/email y CAPTCHA **(sin verificar)**; limpieza de tenants huérfanos. | Plan propio, antes de abrir el registro público |
| H-5 | Media | *Leaked password protection* desactivada (advisor de Supabase). Solo existe en el **plan Pro o superior** ([docs](https://supabase.com/docs/guides/auth/password-security)). | Activarla al pasar a Pro. Mientras tanto: longitud mínima y caracteres obligatorios en Auth, alineados con el Zod de registro. | Al pasar a Pro (puerta de lanzamiento) |
| H-6 | Baja | Políticas sin `to authenticated` y funciones auxiliares sin envolver en `(select …)`; el advisor avisa de *multiple permissive policies* en `profiles` y `tenants`. | Añadir `to authenticated`, `(select private.fn())` y consolidar políticas ([docs](https://supabase.com/docs/guides/database/postgres/row-level-security#rls-performance-recommendations)). | Junto a H-2 (misma migración) |
| H-7 | Baja | Confirmación de email desactivada solo para pruebas. | Reactivarla antes de cualquier usuario real. | Puerta de lanzamiento |

**H-1, H-2 y H-3 bloquean la Fase 2** y se corrigen en la PR `fix/seguridad-perfiles`, con su plan aprobado y sus tests.

### 5.2 Checklist `secure-saas-baseline` aplicada a StudIA
| Área | Regla |
|---|---|
| Autenticación | `getClaims()`/`getUser()` en servidor. Nunca decidir con `getSession()`. |
| Autorización | Rol y tenant se comprueban en el servidor **y** en la RLS. La UI solo oculta. |
| RLS | Toda tabla; test negativo por rol y tenant; `get_advisors` tras cada migración. |
| Datos de autorización | Solo en `profiles` (controlado por políticas) o `app_metadata`; nunca en `user_metadata`. |
| Secretos | Solo `NEXT_PUBLIC_SUPABASE_URL` y la anon key son públicos. `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `OPENCODE_ZEN_API_KEY`, `STRIPE_*`: solo servidor, en Vercel por entorno. Supabase documenta ahora claves `publishable`/`secret` como nombres nuevos ([docs](https://supabase.com/docs/guides/auth/server-side/creating-a-client)); migrar es opcional (D-5). |
| Cuotas de IA | 1 crédito = 1 corrección, descontado atómicamente (§2.4); límite de tokens por petición, de peticiones por minuto por usuario y tenant, de gasto diario global; *timeout* y cancelación. |
| Subidas | Bucket privado, `file_size_limit` y `allowed_mime_types` por bucket (Free ≤ 50 MB global) ([docs](https://supabase.com/docs/guides/storage/uploads/file-limits)); ruta `<tenant_id>/…`; políticas en `storage.objects`; cuota por tenant. |
| Rate limiting | Login, recuperación, registro, IA, subidas, exportaciones, emails y webhooks. Mecanismo **(sin verificar)**: decidir en un plan (p. ej. tabla en Postgres o Vercel Firewall). |
| Validación | Zod en toda frontera (§9). Tamaños máximos de texto en ejercicios y chats. |
| Webhooks | Verificar la firma con el cuerpo **sin procesar** (`await req.text()` + `stripe.webhooks.constructEvent`); guardar `event.id` procesados (idempotencia); responder 2xx rápido; los eventos pueden llegar desordenados y repetidos; Stripe reintenta hasta 3 días en modo activo ([docs](https://docs.stripe.com/webhooks)). |
| Cabeceras | CSP, `frame-ancestors`, `Referrer-Policy` en `next.config.ts` **(sin verificar)**: definir en un plan. |
| Backups | Plan Free: **sin backups automáticos**; Pro: 7 días; PITR como add-on. Los backups **no incluyen los objetos de Storage** ([docs](https://supabase.com/docs/guides/platform/backups)). Antes de clientes reales: plan Pro y copia propia del bucket. |
| Rollback | App: `vercel rollback` / *Instant Rollback* ([docs](https://vercel.com/docs/deployments/rollback-production-deployment)). BD: migraciones solo hacia delante, con migración de reversión escrita y probada en desarrollo. |
| Análisis estático | `semgrep` en cambios sensibles (auth, pagos, IA, subidas). |

### 5.3 Usos permitidos de `service_role`
1. Crear el tenant en el registro de academia (hasta que H-1/H-4 cambien el flujo).
2. Webhooks de Stripe (no hay sesión de usuario).
3. Tareas programadas y del DUEÑO, en rutas protegidas por rol.
Cualquier otro uso se justifica en el plan y en la PR.

### Comprobaciones antes de dar por bueno un cambio aquí
- [ ] Checklist §5.2 revisada para las áreas tocadas.
- [ ] Ningún secreto en cliente: `grep` de `SERVICE_ROLE|API_KEY|SECRET` en `src/app` y `src/components` sin resultados.
- [ ] Tests negativos de autorización.
- [ ] `semgrep` ejecutado si se tocó auth, pagos, IA o subidas.

---

## 6. Frontend

### 6.1 Tokens (`design.md` es la fuente de verdad)
Hoy `globals.css` define solo `--background` y `--foreground` en `:root`/`.dark`, expuestos con `@theme inline`. Patrón a seguir para el resto de tokens de `design.md` ([Tailwind `@theme`](https://tailwindcss.com/docs/theme)):

```css
:root { --superficie: #fafafa; --borde: #e4e4e7; --marca: #1d4ed8; --error: #b91c1c; }
.dark { --superficie: #18181b; --borde: #27272a; --marca: #60a5fa; --error: #f87171; }
@theme inline {
  --color-superficie: var(--superficie);
  --color-borde: var(--borde);
  --color-marca: var(--marca);
  --color-error: var(--error);
  --radius-sm: 6px; --radius-md: 10px;
}
```
(Valores de ejemplo: los definitivos salen de `design.md` tras revisar referencias, comprobando contraste AA.) Usar `bg-superficie`, `border-borde`… en lugar de `zinc-*` sueltos.

### 6.2 Accesibilidad (AA)
- Foco visible en todo elemento interactivo. Navegación completa con teclado.
- Etiqueta en todo campo (`<label>`); errores asociados con `aria-describedby`; mensajes de estado en `aria-live="polite"`.
- El estado de un criterio nunca se indica solo con color: texto + icono con etiqueta.
- `lang="es"` en `<html>`.
- Revisión con `web-design-guidelines` y capturas con `webapp-testing`.

### 6.3 Rendimiento en React y Next
- Server Components por defecto; `"use client"` solo en hojas interactivas ([docs](https://nextjs.org/docs/app/getting-started/server-and-client-components#reducing-js-bundle-size)).
- Evitar cascadas: `Promise.all` para cargas independientes; `layout.tsx` y `dashboard/page.tsx` piden hoy el mismo perfil dos veces → deduplicar con `cache` de React en el repositorio **(sin verificar en esta sesión)**.
- Streaming con `<Suspense>` y `loading.tsx` en vistas lentas (correcciones, chat).
- Skills: `vercel-react-best-practices`, `vercel-composition-patterns`.

### 6.4 Composición
- Componentes compuestos y `children` antes que props booleanas acumuladas.
- Base propuesta en `design.md`: shadcn/ui + Radix + Tailwind (no instalada; decidir en el plan de diseño).
- Formularios con `useActionState` + Server Actions (patrón ya usado en `login-form.tsx` y `registro/page.tsx`).

### 6.5 Estados obligatorios por vista
| Estado | Ejemplo |
|---|---|
| Vacío | "Aún no hay temario. Sube el primer PDF." + acción principal |
| Carga | Esqueleto con la forma final; nunca pantalla en blanco |
| Error | Mensaje en español sin detalles técnicos + reintento |
| Éxito | Confirmación breve y siguiente paso |

### Comprobaciones antes de dar por bueno un cambio aquí
- [ ] Solo tokens de `design.md`; claro y oscuro revisados.
- [ ] Los 4 estados implementados.
- [ ] Teclado, foco y contraste AA comprobados; capturas móvil y escritorio.
- [ ] Sin `"use client"` innecesarios.

---

## 7. RGPD y legal

> Esto es orientación técnica, no asesoramiento jurídico. Antes de vender: revisión legal (skill `commercial-launch`).

| Tema | Regla en StudIA |
|---|---|
| Región | Supabase en UE (`eu-west-1`). Vercel: fijar la región de las funciones cerca de la BD **(sin verificar)**. |
| Encargados de tratamiento | Supabase, Vercel, Google (Gemini), OpenCode Zen, Stripe, proveedor de email. Lista pública en la política de privacidad, con los DPA firmados. |
| Transferencias internacionales | **OpenCode Zen (proveedor principal) aloja todos sus modelos en EE. UU.**; algunos modelos gratuitos usan los datos para mejorar el modelo ([docs](https://opencode.ai/docs/zen/)). Solo modelos de la lista blanca (retención cero). Antes de enviar datos reales de alumnos: DPA o condiciones de tratamiento de OpenCode y base legal de la transferencia **(sin verificar: existencia del DPA)**. |
| Gemini (opcional) | Desactivado por defecto. Sin pago: Google puede usar el contenido para mejorar productos, con revisión humana, y pide *"Do not submit sensitive, confidential, or personal information to the Unpaid Services"*. Para usuarios del EEE, Suiza y Reino Unido se aplican las protecciones del servicio de pago ([términos](https://ai.google.dev/gemini-api/terms)). Si se activa: solo con el nivel de pago en producción, aviso de la regla de oro 4 y aceptación del tenant. |
| Datos de categoría especial | Los ejercicios pueden mencionar salud o NEAE de menores (supuestos prácticos). Minimización: no pedir datos reales y avisar al subir. |
| Derechos | Exportar (portabilidad, art. 20) y borrar (art. 17) desde la cuenta; borrado en cascada en BD **y** en Storage; plazo de respuesta de un mes ([RGPD](https://eur-lex.europa.eu/eli/reg/2016/679/oj)). |
| Retención | Definir por tipo: ejercicios y correcciones, logs, facturas (obligación fiscal). Job de purga. |
| Registro de actividades | Documento interno (art. 30) en `docs/legal/` (tarea futura). |
| Páginas legales | Aviso legal, privacidad, cookies (solo técnicas mientras no haya analítica), términos, condiciones de suscripción y reembolsos. |
| Pagos | Nunca guardar datos de tarjeta: Stripe Checkout/Elements. |

### Comprobaciones antes de dar por bueno un cambio aquí
- [ ] Todo dato personal nuevo tiene finalidad, base legal, retención y borrado.
- [ ] El borrado de usuario elimina también sus objetos de Storage.
- [ ] Ningún dato personal se envía a un proveedor de IA sin aviso y modelo aprobado.

---

## 8. Git, despliegue y lanzamiento

| Tema | Regla |
|---|---|
| Ramas | `main` (producción) ← PR desde `develop` ← `feature/*`, `fix/*`, `chore/*`, `docs/*`. Nunca `push --force` a `main`/`develop`. |
| Commits | Convencionales con el porqué en el cuerpo. |
| PR | `.github/pull_request_template.md`: qué, por qué, cómo se probó, riesgos, plan. |
| Previews | Cada rama/PR genera un preview en Vercel; variables por entorno y por rama con `vercel env add NOMBRE preview <rama>` ([docs](https://vercel.com/docs/environment-variables/manage-across-environments)). Los previews **nunca** apuntan a la BD de producción. |
| Migraciones | Primero en desarrollo (rama de Supabase), después en producción, **antes** de desplegar el código que las usa. Compatibles hacia atrás (añadir → desplegar → retirar). |
| Rollback | `vercel rollback [deployment]` ([docs](https://vercel.com/docs/cli/rollback)); rollback a un despliegue concreto solo en Pro/Enterprise ([docs](https://vercel.com/docs/deployments/rollback-production-deployment)). BD: migración inversa probada. |
| CI | GitHub Actions con typecheck, lint, test, build, `supabase test db` (tarea futura; ejemplo oficial en [Supabase testing](https://supabase.com/docs/guides/local-development/testing/overview)). |
| Monitorización | Logs de Vercel y Supabase; alertas de errores y de gasto de IA. Herramienta **(sin verificar)**: decidir en un plan. |
| Backups | §5.2. |
| Pagos reales | Cambiar `MockPaymentProvider` → `StripePaymentProvider` solo con aprobación explícita: webhooks idempotentes, conciliación del estado de la suscripción, modo test probado de principio a fin, facturas e IVA. |
| Soporte y precios | Canal de soporte, SLA, página de precios con créditos incluidos y política de reembolsos (skill `commercial-launch`). |

### Comprobaciones antes de dar por bueno un cambio aquí
- [ ] Build y tests en verde antes de mergear a `develop` y a `main`.
- [ ] Migraciones aplicadas en desarrollo y probadas con `get_advisors`.
- [ ] Variables de entorno nuevas dadas de alta en Vercel por entorno y en `.env.example` (sin valores).
- [ ] Plan de rollback escrito en la PR si hay migración.

---

## 9. Buenas prácticas generales

- **Zod en cada frontera**: Server Actions, Route Handlers, `searchParams`, respuestas de la IA (salida estructurada validada con un esquema antes de guardarla) y variables de entorno al arrancar. Importar desde `"zod"`; migrar a Zod 4 es la decisión D-3.
  ```ts
  const siguienteSchema = z.string().regex(/^\/(?!\/)/).default("/dashboard"); // corrige H-3
  ```
- **Errores**: los servicios lanzan errores de dominio con código (`sin_creditos`, `sin_permiso`); la frontera los traduce a mensajes en español. Nunca se devuelven mensajes de Postgres ni trazas al usuario.
- **Logs**: sin datos personales (ni emails, ni textos de ejercicios, ni prompts completos); se registran ids, códigos y tiempos. Nada de `console.log` de objetos de sesión.
- **Límites**: tamaño máximo de entrada, *timeout* de la IA, reintentos con retroceso, concurrencia por usuario.
- **Nombres**: dominio en español (`rubrica`, `criterio`, `correccion`, `credito`, `tenant`); sin abreviaturas crípticas; booleanos con `es`/`tiene`.
- **Sin código muerto**: sin comentarios de código antiguo, sin *feature flags* abandonados, sin exports sin uso. Los comentarios explican el porqué.
- **TypeScript estricto**: sin `any`; sin `!` salvo en variables de entorno validadas; tipos de la BD generados.

### Comprobaciones antes de dar por bueno un cambio aquí
- [ ] Toda entrada externa pasa por un esquema Zod.
- [ ] Ningún log con datos personales.
- [ ] Sin `any`, sin código muerto, sin TODOs sin tarea asociada.

---

## Decisiones (aprobadas el 2026-09-21)
| Id | Decisión | Resultado |
|---|---|---|
| D-1 | Next 15 vs 16 | Next 16 + React 19 + `eslint-config-next` 16 + `proxy` ([ADR 0002](adr/0002-nextjs-16-y-react-19.md)); PR `chore/next-16` |
| D-2 | Acceso a datos | supabase-js + repositorios ([ADR 0001](adr/0001-orm-y-acceso-a-datos.md)) |
| D-3 | Zod 3 → Zod 4 | Mantener 3.25; migrar cuando haya tests |
| D-4 | `plans/` fuera de Git | Se mantiene local; la PR resume el plan |
| D-5 | Claves `publishable`/`secret` | Pospuesto; no bloquea |
| D-6 | Proveedores de IA | OpenCode Zen principal, Gemini opcional, Go no en producción ([ADR 0003](adr/0003-proveedores-de-ia.md)) |
