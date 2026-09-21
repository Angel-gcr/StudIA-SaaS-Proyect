import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/types/database";

/**
 * Cliente de Supabase para Server Components, Route Handlers y Server Actions.
 * Usa la anon key (pública, respeta RLS) + la sesión del usuario vía cookies.
 * NUNCA la service_role aquí: este cliente sigue estando sujeto a RLS.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(
          cookiesToSet: { name: string; value: string; options: CookieOptions }[]
        ) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Se puede ignorar si esto se llama desde un Server Component:
            // el middleware ya se encarga de refrescar la sesión.
          }
        },
      },
    }
  );
}
