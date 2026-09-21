# StudIA

SaaS de suscripción que corrige ejercicios de desarrollo de opositores con
IA, como lo haría un profesor: por criterios de una rúbrica oficial, con
evidencia del propio texto del alumno y citando siempre la fuente. Enfoque
inicial: oposiciones docentes de Educación (España).

## Estado del proyecto

**Fase 1 completada: cuentas, roles y aislamiento multi-tenant.**

Lo que ya funciona:

- Proyecto Next.js 15 (App Router) + TypeScript + Tailwind.
- Proyecto Supabase real (**StudIA-SaaS-Proyect**, región eu-west-1/UE) con
  el esquema ya aplicado: `tenants` (academias) y `profiles` (usuarios, con
  rol y academia). `pgvector` activado para la Fase 3.
- Cuatro roles jerárquicos: `DUENO` > `ADMIN` > `PROFESOR` > `OPOSITOR`.
- **Row Level Security (RLS) activo** en todas las tablas, con políticas
  reales por `tenant_id` y por rol — no es un filtro solo en la interfaz.
- Registro (crea una academia nueva + su administrador), inicio de sesión,
  cierre de sesión, todo con Supabase Auth (contraseñas hasheadas).
- Middleware que protege `/dashboard` y `/admin` y redirige según sesión.
- Panel básico que muestra el rol, la academia y los créditos del usuario.
- Modo claro/oscuro, interfaz en español, diseño sobrio.

Lo que **todavía no existe** (siguientes fases, ver el documento de Contexto
del proyecto): subida de documentos, RAG, corrección por rúbrica, chat de
dudas, créditos reales/pagos, landing completa, panel de administración
avanzado, despliegue.

## Cómo ponerlo en marcha

### 1. Proyecto de Supabase — ya está creado y configurado

Ya tienes el proyecto **StudIA-SaaS-Proyect** creado en Supabase, región
**eu-west-1 (UE)**. Las migraciones (tablas, RLS, pgvector) ya están
aplicadas directamente en él, y `.env.local` ya tiene rellenas la URL y la
clave pública (anon key).

**Lo único que falta es la clave secreta `SUPABASE_SERVICE_ROLE_KEY`**, que
por seguridad no relleno yo automáticamente:

1. Entra en el [panel de tu proyecto](https://supabase.com/dashboard/project/nsgcpfmbalonuauozabe).
2. Ve a **Project Settings → API**.
3. Baja hasta **Project API keys**, pulsa "Reveal" junto a **service_role**,
   cópiala.
4. Pégala en `.env.local`, en la línea `SUPABASE_SERVICE_ROLE_KEY=`.

**Esta clave es secreta: salta el RLS por completo. No la compartas, no la
subas a git, no la pegues en ningún chat.** Es la única razón por la que el
registro de una academia nueva (que necesita crear el `tenant` antes de que
exista ningún usuario) funciona: sin ella, `/registro` fallará.

Si en algún momento creas un proyecto de Supabase nuevo desde cero (por
ejemplo, en otra región), estos son los mismos pasos con la única salvedad
de que en el paso 2 debes marcar **región Frankfurt (UE)** al crear el
proyecto — es importante por privacidad, así lo pide el proyecto.

### 2. Variables de entorno

`.env.local` ya existe en la raíz con la URL y la anon key rellenas. Solo
falta el paso 1 de arriba (la service_role key). El archivo tiene
comentarios explicando qué variable es pública (llega al navegador) y cuál
es secreta (solo servidor) — es importante respetarlo si añades variables
nuevas más adelante.

### 3. Esquema de base de datos — ya aplicado

Las migraciones ya están aplicadas en el proyecto real de Supabase (no hace
falta que las ejecutes tú). Quedan también guardadas en
`supabase/migrations/` como referencia y para poder reconstruir la base
desde cero si alguna vez hace falta (por ejemplo en un proyecto de
Supabase nuevo):

1. `00001_init_tenants_profiles.sql` — tablas, roles, RLS.
2. `00002_seed_demo.sql` — academia demo.
3. `00003_enable_pgvector.sql` — extensión pgvector (para el RAG, Fase 3).

(Más adelante, cuando instales la CLI de Supabase, esto se gestiona con
`supabase db push` en vez de copiar y pegar en el editor SQL de la web.)

### 4. Instalar dependencias y arrancar

```bash
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000). Pulsa "Empieza gratis"
para registrar tu primera academia (te convierte automáticamente en su
`ADMIN`).

### 5. Verificar que todo funciona

```bash
npm run lint      # ESLint
npx tsc --noEmit  # Comprobación de tipos
npm run build     # Build de producción
```

Los tres deben terminar sin errores antes de dar una fase por buena.

## Variables de entorno: pública vs secreta

| Variable | ¿Dónde vive? | Motivo |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Navegador y servidor | Es la URL pública del proyecto, no es sensible. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Navegador y servidor | Diseñada para ser pública: la seguridad real la da el RLS, no el secreto de esta clave. |
| `SUPABASE_SERVICE_ROLE_KEY` | **Solo servidor** | Salta el RLS por completo. Si llegara al navegador, cualquiera podría leer o modificar los datos de cualquier academia. |
| `OPENCODE_ZEN_API_KEY`, `GEMINI_API_KEY` | **Solo servidor** (Fase 3) | Claves de pago/uso medido; nunca deben llegar al navegador. |
| `STRIPE_SECRET_KEY` | **Solo servidor** (Fase 6+) | Clave secreta de Stripe. |

## Seguridad de datos (por qué el RLS importa aquí)

Los ejercicios que suban los alumnos pueden mencionar datos de categoría
especial (diversidad funcional, NEAE, salud de menores en un supuesto
práctico, etc.). El aislamiento entre academias y entre alumnos **no es un
filtro de interfaz**: está garantizado por las políticas de Row Level
Security de Postgres, que se aplican aunque alguien intente saltarse la
interfaz y llamar directamente a la API de Supabase con la clave pública.
La única clave que salta ese aislamiento es `SUPABASE_SERVICE_ROLE_KEY`, y
por eso vive solo en el servidor.
