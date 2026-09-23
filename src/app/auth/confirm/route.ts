import { NextResponse, type NextRequest } from "next/server";
import { type EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { rutaInternaSegura } from "@/lib/validation/redirect";

/**
 * Ruta que recibe el enlace del email de confirmación de Supabase Auth.
 *
 * La plantilla de email por defecto de Supabase apunta aquí con
 * `token_hash` y `type` en la URL (flujo OTP por enlace, no el flujo PKCE
 * de `code`). Verificamos el token con verifyOtp(), lo que crea la sesión
 * del usuario (y con ella las cookies, vía el cliente de servidor), y
 * entonces sí lo llevamos al panel.
 *
 * Si el enlace es inválido o ha caducado, lo mandamos a /login con un
 * mensaje claro en vez de dejarlo en una página rota.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = rutaInternaSegura(searchParams.get("next"));

  if (token_hash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });

    if (!error) {
      return NextResponse.redirect(new URL(next, origin));
    }
  }

  return NextResponse.redirect(
    `${origin}/login?error=enlace_invalido_o_caducado`
  );
}
