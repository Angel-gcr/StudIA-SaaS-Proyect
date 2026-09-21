# ADR 0002 — Adoptar Next.js 16 y React 19

- **Estado:** aceptado (aprobado por el propietario del producto el 2026-09-21). Pendiente de ejecutar en la PR `chore/next-16`.
- **Fecha:** 2026-09-21
- **Sustituye a:** la nota de `CLAUDE.md` que pedía fijar Next en 15.x.
- **Relacionado:** `docs/TECNICO.md` §0

## Contexto
`CLAUDE.md` pedía Next 15.x, pero `package.json` tenía `"next": "^16.3.5"` y está instalado **16.3.5**, con `react`/`react-dom` **18.3.1**, `@types/react` ^18 y `eslint-config-next` **15.5.25**. El proyecto compila (`tsc`, `lint` y `build` en verde el 2026-09-21), pero:
- En npm, `latest` es 16.3.5 y la línea 15 solo publica `backport` (15.5.25).
- La guía oficial de actualización pide `npm install next@latest react@latest react-dom@latest` y actualizar `@types/react*`. El App Router de Next 16 usa React canary con las funciones de 19.2 ([guía v16](https://nextjs.org/docs/app/guides/upgrading/version-16)).
- `middleware` está obsoleto y pasa a llamarse `proxy` (runtime Node, no configurable). La guía SSR de Supabase ya usa `proxy.ts` y `getClaims()` ([docs](https://supabase.com/docs/guides/auth/server-side/creating-a-client)).

## Opciones
1. **Volver a 15.5.x**: menos cambios hoy, pero solo recibiría backports y la documentación de Next y de Supabase ya está escrita para 16.
2. **Adoptar 16 y alinear el resto** (elegida).

## Decisión
Adoptar Next 16. En una PR `chore/next-16` aislada:
1. Fijar `next` a `~16.3.5` para que el `^` no suba de minor sin revisarlo.
2. `react`, `react-dom` → 19.x; `@types/react`, `@types/react-dom` → 19.x; `eslint-config-next` → 16.x.
3. `src/middleware.ts` → `src/proxy.ts` con la función `proxy` (codemod `npx @next/codemod@canary middleware-to-proxy .`). `src/lib/supabase/middleware.ts` → `src/lib/supabase/proxy.ts`.
4. En el proxy, proteger las rutas con `getClaims()` en lugar de `getUser()`, como hace la guía de Supabase.
5. Verificar: typecheck, lint, build, y login, registro, dashboard y logout a mano.

## Consecuencias
- ✅ Versión con soporte y documentación actual. Desaparece el aviso de `middleware`.
- ⚠️ La PR no debe mezclar funcionalidades. Riesgo principal: tipos de React 19 (`useActionState`, `ref`) y reglas nuevas de ESLint.
- TypeScript se queda en 5.9: la compatibilidad de TS 7 con Next está **(sin verificar)**.
