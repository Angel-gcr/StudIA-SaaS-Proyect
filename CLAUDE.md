# CLAUDE.md — StudIA

Leer siempre primero este archivo, `design.md` y (si existe) el plan de la tarea en `plans/`. Contexto completo del producto: documentos del Proyecto en claude.ai (Contexto, Instrucciones).

## 1. Qué es StudIA
SaaS de suscripción para academias de oposiciones. Corrige con IA ejercicios de desarrollo **criterio por criterio de una rúbrica**, con evidencia y cita de la fuente, y ofrece chat de dudas sobre el temario. Foco inicial: oposiciones docentes de Educación. La IA **propone**, el profesor **decide** y publica.
Roles: DUEÑO > ADMIN (academia) > PROFESOR > OPOSITOR. 1 crédito = 1 ejercicio corregido.

## 2. Stack (no cambiar sin justificarlo y sin ADR)
- Next.js 15 (App Router) + React + TypeScript estricto + Tailwind. UI en español, sobria, claro/oscuro, responsive.
- Supabase: Postgres + pgvector + Auth + Storage, región UE. RLS siempre activo.
- IA multi-proveedor tras una abstracción de servidor: OpenCode Zen y Google Gemini (selector de admin + fallback). Streaming en chat y correcciones.
- Pagos: Stripe, hoy en maqueta claramente señalizada.
- Despliegue: Vercel (app) + Supabase (datos).
- Validación con Zod en toda frontera (formularios, Server Actions, Route Handlers).
- Nota: `package.json` debe fijar Next en 15.x (comprobar que no sube a 16 por el `^`).

## 3. Reglas de oro (no negociables)
1. **RAG estricto**: la IA solo usa documentos autorizados del tenant y cita la fuente. Sin evidencia: "no tengo información suficiente" / criterio "no verificable". Nunca inventa.
2. **Multi-tenant con RLS real**: toda tabla lleva `tenant_id` y RLS con políticas por tenant y rol. Nunca aislamiento solo visual ni solo en la app.
3. **Secretos solo en servidor**: `SUPABASE_SERVICE_ROLE_KEY` y claves de IA/Stripe nunca llegan al cliente. La IA se llama siempre vía proxy de servidor. Solo `NEXT_PUBLIC_*` y la anon key son públicas.
4. **Privacidad por diseño**: mínimo de datos personales; nunca datos de tarjeta; export y borrado por usuario (RGPD). Aviso de que el nivel gratuito de Gemini puede entrenar con datos.
5. **Pagos en maqueta** señalizados en la UI; código listo para Stripe real con el mínimo cambio.
6. **Cero regresión**: nada se da por terminado sin pasar `typecheck`, `lint`, `test` y `build`.
7. Funciones auxiliares de seguridad de Postgres en el esquema `private` (no expuesto por PostgREST). Políticas con `(select auth.uid())`.

## 4. Programación orientada a objetos y arquitectura
Aplicamos POO donde aporta (capa de servidor y dominio); los componentes de React siguen siendo funcionales.
- **Interfaces + clases** para todo lo intercambiable: `AIProvider` (`OpenCodeZenProvider`, `GeminiProvider`), `PaymentProvider` (`MockPaymentProvider`, `StripePaymentProvider`), `EmbeddingProvider`.
- **Servicios** con una responsabilidad (`CorrectionService`, `CreditService`, `DocumentService`) que reciben sus dependencias por constructor (inyección de dependencias). Nada de `new` de proveedores dentro de la lógica.
- **Repositorios** encapsulan el acceso a Supabase; ninguna consulta SQL/`supabase.from` suelta en componentes.
- Principios SOLID, composición sobre herencia, módulos profundos con interfaz pequeña, entidades de dominio con lenguaje del negocio (criterio, rúbrica, corrección, crédito, tenant).
- Estructura: `src/lib/{actions,validation,supabase,types}` existente; nuevo código de dominio en `src/server/{ai,payments,services,repositories}`; UI en `src/components` y `src/app`.
- Una feature = una página + su API route + su flujo de datos, con estados idle/loading/done/error.

## 5. Documentación oficial primero
Antes de usar una API o librería, **consultar la documentación oficial** y no fiarse de memoria:
- Supabase: MCP de Supabase (`search_docs`, `get_advisors`, `list_tables`) y skills `supabase`, `supabase-postgres-best-practices`.
- Vercel/Next.js: MCP de Vercel (`search_vercel_documentation`) y skills `vercel-react-best-practices`, `vercel-composition-patterns`.
- Librerías en general: MCP Context7 (docs actualizadas por versión). Instalar en Claude Code: `claude mcp add context7 -- npx -y @upstash/context7-mcp`.
- Stripe, Gemini, OpenCode Zen: su documentación oficial, citando la URL en el plan.
Si la documentación contradice este archivo, se para y se pregunta.

## 6. Diseño y frontend profesional
- Fuente de verdad visual: `design.md`. Skills: `design-system`, `frontend-design`, `ui-ux-pro-max`, `web-design-guidelines`.
- **Antes de diseñar una pantalla**, mirar referencias en Figma con el MCP de Figma (`search_design_system`, `get_design_context`) y en apps influyentes similares (Linear, Notion, Vercel, Stripe Dashboard, Gradescope para corrección). Registrar en el plan qué patrón se adopta y por qué.
- Accesibilidad AA, teclado completo, estados vacío/carga/error en cada vista. Revisar con `web-design-guidelines` y `webapp-testing` (capturas).

## 7. Flujo de trabajo por funcionalidad (spec-driven + TDD)
Skills: `spec-driven-development`, `tdd`, `domain-modeling`, `code-review`, `secure-saas-baseline`, `semgrep`.
1. **Plan**: crear `plans/<feature>.md` desde `plans/_TEMPLATE.md` (problema, alcance, criterios de aceptación, datos, seguridad, diseño, tareas pequeñas). El usuario lo aprueba antes de escribir código.
2. **Seams**: acordar con el usuario las fronteras públicas que se van a testear. No se escribe ningún test en una frontera sin confirmar.
3. **TDD en cortes verticales**: un test → una implementación mínima → repetir (rojo antes de verde). Los tests describen comportamiento por interfaz pública, sin mocks de internos.
4. **Seguridad**: pasar la checklist de `secure-saas-baseline` (autorización, RLS, límites, cuotas, validación, secretos) y `semgrep` en cambios sensibles.
5. **Revisión**: `code-review` contra el plan y las reglas de este archivo. El refactor ocurre aquí, no dentro del ciclo rojo-verde.
6. **Verificación**: `npm run typecheck && npm run lint && npm test && npm run build`, más flujo manual/Playwright de la ruta crítica.
7. **Entrega**: PR a `develop`; tras validar, `develop` → `main`.
No se añade nada fuera del plan (sin funciones "de paso").

## 8. Git y despliegue estable
- `main`: producción, siempre estable y desplegable. Solo entra por PR desde `develop`.
- `develop`: integración; siempre pasa build y tests.
- `feature/<nombre>`, `fix/<nombre>`, `chore/<nombre>`: salen de `develop`, una por funcionalidad.
- Commits convencionales (`feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`) con **el porqué** en el cuerpo, no solo el qué.
- Cada PR explica: qué se añade, **por qué**, cómo se probó, riesgos y enlace al plan. Plantilla en `.github/pull_request_template.md`.
- Vercel: `main` → producción; ramas y PRs → previews. Nunca desplegar con build o tests rotos. Migraciones de Supabase versionadas en `supabase/migrations/` y aplicadas primero en desarrollo.
- Nunca `push --force` a `main`/`develop`. Nunca commitear `.env*` reales.

## 9. Comandos
- `npm run dev` · `npm run build` · `npm run lint`
- `npm run typecheck` y `npm test`: pendientes de añadir en la primera tarea (Vitest + Playwright).
- Tipos de Supabase: regenerar con el MCP (`generate_typescript_types`) tras cada migración.

## 10. Estado actual
Fase 1 (cuentas, roles, RLS) construida y en prueba manual. La confirmación de email está desactivada solo para pruebas; reactivar al conectar un proveedor de email real. No empezar la Fase 2 (documentos + RAG + proveedores IA) hasta que el usuario dé por probados registro, login y diseño.
