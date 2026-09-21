"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { loginSchema, registroSchema } from "@/lib/validation/auth";

export type EstadoFormulario = {
  error?: string;
  mensaje?: string;
} | null;

/**
 * Registro de una nueva academia (ADMIN) + su primer usuario.
 *
 * Crea el tenant con el cliente admin (salta RLS: es la única forma de crear
 * la primera fila de una academia nueva, porque hasta que exista el usuario
 * no hay ningún "mi_tenant_id()" al que atarse). Después registra al usuario
 * en Supabase Auth pasándole tenant_id y rol=ADMIN en user_metadata; el
 * trigger handle_new_user() crea su profile automáticamente.
 *
 * IMPORTANTE: en un proyecto Supabase hospedado, la confirmación de email
 * está activada por defecto. signUp() crea el usuario pero NO deja sesión
 * iniciada hasta que confirme su correo (data.session viene null). Por eso
 * no redirigimos a /dashboard aquí: mostramos un aviso pidiendo que revise
 * su bandeja de entrada. Si algún día se desactiva la confirmación desde el
 * panel de Supabase, data.session sí vendrá relleno y entonces redirigimos
 * directo, sin cambiar nada de este código.
 */
export async function registrarAcademia(
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const parsed = registroSchema.safeParse({
    nombreCompleto: formData.get("nombreCompleto"),
    email: formData.get("email"),
    password: formData.get("password"),
    nombreAcademia: formData.get("nombreAcademia"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const { nombreCompleto, email, password, nombreAcademia } = parsed.data;

  const admin = createAdminClient();

  const slug = nombreAcademia
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  const { data: tenant, error: tenantError } = await admin
    .from("tenants")
    .insert({ nombre: nombreAcademia, slug: `${slug}-${Date.now().toString(36)}` })
    .select("id")
    .single();

  if (tenantError || !tenant) {
    return { error: "No se pudo crear la academia. Inténtalo de nuevo." };
  }

  const supabase = await createClient();
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        tenant_id: tenant.id,
        rol: "ADMIN",
        nombre_completo: nombreCompleto,
      },
    },
  });

  if (signUpError) {
    // Revertimos el tenant huérfano si el registro del usuario falla.
    await admin.from("tenants").delete().eq("id", tenant.id);

    if (signUpError.code === "user_already_exists") {
      return { error: "Ya existe una cuenta con ese email. Inicia sesión." };
    }
    if (signUpError.code === "over_email_send_rate_limit") {
      return {
        error:
          "Se ha alcanzado el límite de correos de confirmación que permite el servidor de pruebas de Supabase (es un límite bajo, pensado solo para desarrollo). Espera unos minutos antes de registrar otra cuenta nueva.",
      };
    }
    return { error: "No se pudo completar el registro. Inténtalo de nuevo." };
  }

  // Si la confirmación de email está desactivada, Supabase ya deja sesión
  // iniciada (signUpData.session no es null) y podemos entrar directo.
  if (signUpData.session) {
    redirect("/dashboard");
  }

  // Caso normal con confirmación de email activada: sin sesión todavía.
  return {
    mensaje:
      "Cuenta creada. Te hemos enviado un email de confirmación: ábrelo y pulsa el enlace para poder iniciar sesión.",
  };
}

export async function iniciarSesion(
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    if (error.code === "email_not_confirmed") {
      return {
        error:
          "Todavía no has confirmado tu email. Revisa tu bandeja de entrada (y la carpeta de spam) y pulsa el enlace de confirmación.",
      };
    }
    return { error: "Email o contraseña incorrectos." };
  }

  redirect("/dashboard");
}

export async function reenviarConfirmacion(
  _prevState: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const email = formData.get("email");
  if (typeof email !== "string" || !email) {
    return { error: "Introduce tu email para reenviar la confirmación." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resend({ type: "signup", email });

  if (error) {
    return { error: "No se pudo reenviar el correo. Inténtalo de nuevo en unos minutos." };
  }

  return { mensaje: "Te hemos reenviado el email de confirmación." };
}

export async function cerrarSesion() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
