import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";

/**
 * Cliente ADMIN de Supabase: usa la service_role key y SALTA el RLS.
 *
 * ⚠️ SOLO se importa desde código que se ejecuta en el servidor
 * (Route Handlers, Server Actions, jobs) y NUNCA se expone al cliente.
 * La variable SUPABASE_SERVICE_ROLE_KEY no lleva el prefijo NEXT_PUBLIC_
 * precisamente para que Next.js nunca la incluya en el bundle del navegador.
 *
 * Úsalo solo para operaciones que de verdad necesitan saltarse RLS
 * (por ejemplo, crear el primer perfil de un usuario tras el registro,
 * o tareas administrativas del DUEÑO). Para todo lo demás, usa
 * los clientes de client.ts o server.ts, que sí respetan RLS.
 */
export function createAdminClient() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY no está definida. Este cliente solo debe " +
        "usarse en el servidor, nunca en código que se envía al navegador."
    );
  }

  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
