import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/types/database";

/**
 * Cliente de Supabase para usar en Componentes de Cliente ("use client").
 * Usa la anon key (pública, respeta RLS). NUNCA la service_role aquí.
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
