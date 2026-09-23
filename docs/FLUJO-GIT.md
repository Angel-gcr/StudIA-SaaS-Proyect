# FLUJO-GIT.md — Paso a paso para cada tarea

> Consulta este fichero al empezar y al terminar cualquier `feature/fix/chore/docs`. Es el "cómo, paso a paso"; la política (por qué, qué se permite) está en `CLAUDE.md` §7 y `docs/TECNICO.md` §8.

## 1. Antes de empezar
```bash
git checkout develop
git pull origin develop
git status   # debe estar limpio; si no, commitea o guarda (stash) lo que haya
git checkout -b <tipo>/<nombre-corto>   # tipo: feature | fix | chore | docs
```
Si la tarea no es trivial: crea `plans/<feature>.md` desde `plans/_TEMPLATE.md` (problema, alcance, criterios de aceptación, seguridad, tareas) y espera la aprobación del usuario antes de escribir código.

## 2. Durante el trabajo
- Commits convencionales: `feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:` — con **el porqué** en el cuerpo, no solo el qué.
- Commits pequeños; en TDD, uno por corte rojo→verde cuando tenga sentido.
- Nunca commitees `.env*` reales ni secretos.
- Si tocas código o lógica: lee las secciones afectadas de `docs/TECNICO.md` antes de escribir. Si el cambio lo contradice, para y pregunta; si lo actualiza, edita `docs/TECNICO.md` en la misma PR.

## 3. Antes de abrir el PR (todo en verde)
```bash
npm run typecheck && npm run lint && npm test && npm run build
```
- `npm run test:db` si se tocó `supabase/migrations/`.
- `semgrep` si se tocó auth, pagos, IA o subidas.
- Tipos de Supabase regenerados (MCP `generate_typescript_types`) si hubo migración.
- Flujo manual (o Playwright) de la ruta crítica afectada.

## 4. Push y PR
```bash
git push -u origin <tipo>/<nombre-corto>
```
Abre el PR hacia `develop` (con `gh pr create` si está disponible, o desde GitHub) usando `.github/pull_request_template.md`: qué se añade, por qué, cómo se probó, riesgos, enlace al plan.

**No fusiones sin que el usuario lo confirme explícitamente**, aunque el trabajo ya esté aprobado en un plan más amplio: cada fusión a una rama compartida se enseña antes de ejecutarla.

## 5. Merge a `develop`
- Solo con la verificación del paso 3 en verde.
- Tras fusionar, borra la rama (local y remoto):
```bash
git checkout develop && git pull origin develop
git branch -d <tipo>/<nombre-corto>
git push origin --delete <tipo>/<nombre-corto>
```

## 6. `develop` → `main`
- Solo por PR, nunca commits ni push directos a `main` (GitHub lo bloquea igualmente por regla de repositorio).
- Fusiona cuando `develop` esté probado y estable.
- Tras fusionar: `git checkout main && git pull` y confirma que `develop` sigue igual (sin commits huérfanos).

## 7. Rama obsoleta o vacía
Si una rama ya se fusionó, quedó completada en otra rama, o se creó y no llegó a usarse (0 diffs con `develop`): bórrala (local + remoto) y arranca una rama nueva desde el paso 1. Antes de empezar la siguiente tarea, `develop` y `main` deben estar a la misma altura (ver paso 6).
