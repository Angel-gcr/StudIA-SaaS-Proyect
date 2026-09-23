# CLAUDE.md — StudIA

Leer siempre primero este archivo, `design.md` y (si existe) el plan de la tarea en `plans/`. Contexto completo del producto: documentos del Proyecto en claude.ai (Contexto, Instrucciones). Referencia técnica: `docs/TECNICO.md` (ver §4 y §10).

## 1. Qué es StudIA
SaaS B2B de suscripción para academias de oposiciones (foco inicial: oposiciones docentes de Educación, España). Corrige con IA ejercicios de desarrollo **criterio por criterio de una rúbrica**, con evidencia del texto del alumno y cita de la fuente, y ofrece chat de dudas sobre el temario. La IA **propone**, el profesor **decide** y publica.
- Roles: DUEÑO (plataforma) > ADMIN (academia) > PROFESOR > OPOSITOR.
- Negocio: la academia paga una suscripción con créditos; 1 crédito = 1 ejercicio corregido.

## 2. Stack (no cambiar sin justificarlo y sin ADR)
Versiones instaladas y verificadas el 2026-09-21 (detalle y fuentes en `docs/TECNICO.md` §0):
- **Next.js 16.3.5** (App Router). Adoptado por el ADR 0002; la PR `chore/next-16` lo fija a `~16.3.5` y renombra `middleware` → `proxy`.
- **React 18.3.1** en `package.json`; el App Router de Next 16 usa internamente React canary 19.2. Se alinea a 19.x en `chore/next-16`.
- **TypeScript 5.9.3** en modo estricto · **Tailwind CSS 4.3.3** (CSS-first, `@theme`).
- **Supabase**: Postgres + pgvector + Auth + Storage, región UE (`eu-west-1`), RLS siempre activa. `@supabase/supabase-js` 2.116.0, `@supabase/ssr` 0.12.7.
- **Acceso a datos**: `supabase-js` tipado + repositorios (ADR 0001, aceptado).
- **Zod 3.25.76** en toda frontera (formularios, Server Actions, Route Handlers). Migrar a Zod 4 cuando haya tests.
- **IA** tras la abstracción de servidor `AIProvider` (ADR 0003), con streaming en chat y correcciones. Proveedores **principales: OpenCode Go y OpenCode Zen** (solo modelos de la lista blanca con retención cero). Go se usa en producción con el riesgo de sus condiciones de uso **asumido explícitamente por el propietario** (2026-09-23); Zen actúa de respaldo automático. **Google Gemini: adaptador opcional**, desactivado por defecto; lo activan el ADMIN o el DUEÑO, y en producción solo con el nivel de pago.
- **Pagos**: Stripe, hoy en maqueta claramente señalizada.
- **Tests**: Vitest + Playwright + pgTAP, todavía sin instalar (tarea T-01/T-02).
- **Despliegue**: Vercel (app) + Supabase (datos).

## 3. Reglas de oro y "nunca hagas"
1. **RAG estricto**: la IA solo usa documentos autorizados del tenant y cita la fuente. Sin evidencia responde "no tengo información suficiente" o marca el criterio como "no verificable". Nunca inventa.
2. **Multi-tenant con RLS real**: toda tabla lleva `tenant_id` y RLS con políticas por tenant y rol. Nunca aislamiento solo visual ni solo en la app.
3. **Secretos solo en servidor**: `SUPABASE_SERVICE_ROLE_KEY` y las claves de IA y Stripe nunca llegan al cliente. La IA se llama siempre vía proxy de servidor. Solo son públicas las `NEXT_PUBLIC_*` y la anon key.
4. **Privacidad por diseño**: mínimo de datos personales; nunca datos de tarjeta; exportación y borrado por usuario (RGPD). Avisar de que el nivel gratuito de Gemini puede entrenar con los datos.
5. **Pagos en maqueta** señalizados en la UI; código listo para Stripe real con el mínimo cambio.
6. **Cero regresión**: nada se da por terminado sin pasar `typecheck`, `lint`, `test` y `build`.
7. Funciones auxiliares de seguridad de Postgres en el esquema `private` (no expuesto por PostgREST). Políticas con `(select auth.uid())`.

**Nunca:**
- Uses `createAdminClient()` (service_role) fuera de los casos listados en `docs/TECNICO.md` §5.3.
- Guardes rol, tenant ni permisos en `user_metadata`: el usuario puede editarlo.
- Decidas autorización con `getSession()` en servidor; usa `getClaims()`/`getUser()`.
- Crees una tabla sin RLS, sin políticas, sin `grant` explícitos o sin test negativo.
- Envíes datos de alumnos a un modelo de IA gratuito, que entrene con ellos o fuera de la lista blanca de ADR 0003.
- Actives o cambies el orden de proveedores de IA (`ProveedorIAConRespaldo`) fuera de lo decidido en ADR 0003.
- Conectes un ORM con un rol que salte la RLS.
- Commitees `.env*` reales, hagas `push --force` a `main`/`develop` o despliegues con build o tests rotos.
- Añadas dependencias, integraciones o funciones "de paso" fuera del plan aprobado.

## 4. Regla de verificación técnica

> **Siempre que se toque código o lógica, se DEBE leer `docs/TECNICO.md` (las secciones afectadas) y comprobar que el cambio lo cumple y no introduce regresión ni errores. Después, ejecutar `typecheck`, `lint`, tests y `build`. Si el cambio contradice `docs/TECNICO.md`, se para y se pregunta; si lo actualiza, se modifica `docs/TECNICO.md` en la misma PR.**

Antes de usar una API o librería, consultar su documentación oficial (MCP de Supabase `search_docs`, MCP de Vercel `search_vercel_documentation`, Context7, docs de Stripe, Gemini y OpenCode Zen) y citar la URL en el plan. Si la documentación contradice este archivo, se para y se pregunta. Instalar Context7 en Claude Code: `claude mcp add context7 -- npx -y @upstash/context7-mcp`.

## 5. Comandos
| Acción | Comando | Estado |
|---|---|---|
| Desarrollo | `npm run dev` | ✅ |
| Build | `npm run build` | ✅ |
| Lint | `npm run lint` | ✅ |
| Typecheck | `npx tsc --noEmit` (script `typecheck`: T-01) | ✅ vía npx |
| Tests unitarios | `npm test` → `vitest run` | ⏳ T-01 |
| E2E | `npm run e2e` → `playwright test` | ⏳ T-01 |
| Tests de BD (RLS) | `supabase test db` | ⏳ T-02 (CLI de Supabase + Docker) |
| Migraciones | archivo en `supabase/migrations/`, aplicado primero en desarrollo (MCP `apply_migration` o `supabase db push`) | ✅ |
| Tipos de Supabase | MCP `generate_typescript_types` o `npx supabase gen types typescript --project-id "$PROJECT_REF" --schema public > src/lib/types/database.ts` | ⏳ hoy los tipos son manuales |
| Asesores de Supabase | MCP `get_advisors` (security y performance) tras cada migración | ✅ |

## 6. Flujo por funcionalidad
1. **SDD**: `plans/<feature>.md` desde `plans/_TEMPLATE.md` (problema, alcance, criterios de aceptación, diseño, datos, seguridad, seams, tareas, URLs). El usuario lo aprueba antes de escribir código. `plans/` no se sube a Git: la PR resume el plan.
2. **Seams**: acordar con el usuario las fronteras públicas que se van a testear. No se escribe ningún test sin confirmarlas.
3. **TDD en cortes verticales**: un test en rojo → implementación mínima → verde → repetir. Tests de comportamiento por interfaz pública, sin mocks de internos.
4. **Seguridad**: checklist de `secure-saas-baseline` (TECNICO §5) y `semgrep` en cambios sensibles.
5. **Revisión**: `code-review` contra el plan, este archivo y `docs/TECNICO.md`. El refactor ocurre aquí.
6. **Verificación**: typecheck, lint, test, build y flujo manual o Playwright de la ruta crítica.
7. **PR** a `develop`. Tras validarla, `develop` → `main`.

Diseño: **antes de diseñar una pantalla**, mirar referencias en Figma (MCP) y en apps similares (Linear, Notion, Vercel, Stripe Dashboard, Gradescope para corrección) y registrar en el plan qué patrón se adopta y por qué. Fuente de verdad visual: `design.md`.

Arquitectura (detalle en TECNICO §1): POO en servidor y dominio (`src/server/{domain,ai,payments,services,repositories}`), dependencias inyectadas por constructor, repositorios para todo acceso a Supabase, componentes de React funcionales. Una feature = página + acción/API + flujo de datos, con estados idle/loading/done/error.

## 7. Git y despliegue
> Checklist paso a paso (crear rama, commits, verificar, PR, fusionar, borrar rama): `docs/FLUJO-GIT.md`. Consúltalo en cada tarea.
- `main`: producción, estable y desplegable; solo entra por PR desde `develop`.
- `develop`: integración; siempre pasa build y tests.
- `feature/<nombre>`, `fix/<nombre>`, `chore/<nombre>`, `docs/<nombre>`: salen de `develop`, una por funcionalidad.
- Commits convencionales (`feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`) con **el porqué** en el cuerpo.
- PR con `.github/pull_request_template.md`: qué se añade, por qué, cómo se probó, riesgos y plan.
- Vercel: `main` → producción; ramas y PRs → previews (nunca contra la BD de producción). Migraciones versionadas y aplicadas primero en desarrollo. Rollback con `vercel rollback`.

## 8. Definición de "terminado"
- [ ] Plan aprobado y todos sus criterios de aceptación cumplidos.
- [ ] Tests escritos antes que el código y en verde (unitarios, RLS y E2E si aplica).
- [ ] `docs/TECNICO.md` leído en las secciones afectadas y cumplido (o actualizado en la misma PR).
- [ ] typecheck, lint, test y build en verde; flujo manual de la ruta crítica hecho.
- [ ] Seguridad: autorización en servidor, RLS con test negativo, límites, Zod, sin secretos en el cliente; `get_advisors` limpio.
- [ ] UI: estados vacío/carga/error/éxito, AA, claro/oscuro y móvil.
- [ ] Tipos de Supabase regenerados si hubo migración.
- [ ] PR con el porqué, cómo se probó y los riesgos.

## 9. Mapa de skills por fase
Skills comprobadas en `.skillsrc.json` (94 instaladas) y en la lista de la sesión, 2026-09-21. Si una no aparece, se busca antes de improvisar.

| Fase | Objetivo | Skills a invocar | MCPs | Entregable |
|---|---|---|---|---|
| 1. Descubrir y especificar | Problema, usuario, criterios de aceptación | `product-discovery`, `spec-driven-development`, `domain-modeling`, `research-studia`, `grill-me` (en la sesión aparece también como `grilling`) | Context7 | `plans/<feature>.md` aprobado |
| 2. Diseño y referencias | Patrón visual justificado | `design-system`, `frontend-design`, `ui-ux-pro-max`, `web-design-guidelines` | Figma (`search_design_system`, `get_design_context`) | `design.md` actualizado y referencias en el plan |
| 3. Datos y multi-tenant | Esquema, RLS, funciones SQL | `supabase`, `supabase-postgres-best-practices` | Supabase (`search_docs`, `list_tables`, `apply_migration`, `get_advisors`, `generate_typescript_types`) | Migración, test pgTAP y tipos |
| 4. Construir funciones | Corte vertical con TDD | `studia-feature-builder`, `tdd`, `codebase-design`, `vercel-react-best-practices`, `vercel-composition-patterns`, `model-apis` (IA) | Context7, Vercel docs | Código y tests en verde |
| 5. Landing y ventas | Conversión, precios, SEO | `studia-landing-builder`, `frontend-design` | Figma | Landing y página de precios (maqueta de pagos visible) |
| 6. Seguridad | Baseline y análisis estático | `secure-saas-baseline`, `semgrep` | Supabase `get_advisors` | Checklist TECNICO §5 y SARIF sin críticos |
| 7. Revisión y pruebas | Calidad y ruta crítica | `code-review`, `qa-review`, `webapp-testing`, `diagnosing-bugs` | Chrome | Informe de revisión, capturas y E2E |
| 8. Despliegue | Preview → producción | `deploy-to-vercel`, `vercel-cli-with-tokens` | Vercel (`list_deployments`, `get_runtime_logs`) | Preview verificado y rollback probado |
| 9. Salida a producción | Vender con garantías | `commercial-launch`, `secure-saas-baseline`, `qa-review`, `vercel-optimize` | Stripe docs, Vercel, Supabase | Stripe real (con aprobación), páginas legales, monitorización, backups (plan Pro), soporte y precios |
| 10. Mantenimiento | Continuidad | `resolving-merge-conflicts`, `context-budget-workflow`, `handoff`, `diagnosing-bugs` | — | Ramas limpias y traspaso documentado |

## 10. Cuándo leer otros documentos
- `docs/TECNICO.md`: **siempre** antes de tocar código (secciones afectadas). No se importa con `@` para no cargarlo en cada sesión.
- `docs/adr/`: antes de cambiar el stack, el acceso a datos o una decisión registrada. Un cambio de ese tipo requiere un ADR nuevo.
- `design.md`: antes de cualquier cambio de UI.
- `README.md`: puesta en marcha y variables de entorno.

## 11. Estado actual y siguiente paso
- **Fase 1** (cuentas, roles, RLS) construida y en prueba manual. La confirmación de email está desactivada solo para pruebas; reactivarla al conectar un proveedor de email real.
- Comprobado el 2026-09-21: `tsc`, `lint` y `build` en verde, con el aviso de que `middleware` está obsoleto en Next 16.
- **Bloqueantes de seguridad** (TECNICO §5.1): **H-1** escalada de rol vía `user_metadata` en el trigger de registro; **H-2** un usuario puede editar su `rol`, `creditos` y `tenant_id`; **H-3** redirección abierta en `/auth/confirm`.
- **Decisiones aprobadas el 2026-09-21**: ADR 0001 (supabase-js + repositorios), ADR 0002 (Next 16 + React 19), ADR 0003 (OpenCode Zen primero, Gemini opcional), mantener Zod 3.25 por ahora, `plans/` local con el plan resumido en la PR, y claves publishable/secret más adelante.
- **Orden de trabajo**: (1) `fix/seguridad-perfiles`: H-1, H-2, H-3 y H-6, con el entorno local de Supabase, pgTAP y Vitest; (2) `chore/next-16`; (3) T-01 completo (Playwright y scripts). Cada uno con su plan aprobado en `plans/`.
- No empezar la Fase 2 (documentos, RAG, proveedores de IA) hasta que el usuario dé por probados el registro, el login y el diseño, y estén cerrados H-1, H-2 y H-3.
