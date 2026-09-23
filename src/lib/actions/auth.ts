"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { confirmacionDeEmailAutomatica } from "@/lib/supabase/auth-settings";
import { loginSchema, registroSchema } from "@/lib/validation/auth";

export type EstadoFormulario = {
  error?: string;
  mensaje?: string;
} | null;

/**
 * Registro de una nueva academia (ADMIN) + su primer usuario.
 *
 * Todo ocurre en el servidor con el cliente admin (service_role), porque el
 * registro público de Supabase Auth está desactivado: un signUp con la anon
 * key permitiría al usuario elegir su rol y su academia (hallazgo H-1).
 *
 * 1. Se crea el tenant.
 * 2. Se crea el usuario con rol y tenant en app_metadata, que el usuario no
 *    puede modificar; el trigger handle_new_user() crea su perfil a partir
 *    de ahí. El nombre va en user_metadata porque no da permisos.
 * 3. Si el proyecto confirma los emails automáticamente, se inicia sesión y
 *    se entra al panel; si no, se envía el email de confirmación.
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

  const confirmacionAutomatica = await confirmacionDeEmailAutomatica();

  const { error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: confirmacionAutomatica,
    app_metadata: { tenant_id: tenant.id, rol: "ADMIN" },
    user_metadata: { nombre_completo: nombreCompleto },
  });

  if (createError) {
    // Revertimos el tenant huérfano si el alta del usuario falla.
    await admin.from("tenants").delete().eq("id", tenant.id);

    if (createError.code === "email_exists" || createError.code === "user_already_exists") {
      return { error: "Ya existe una cuenta con ese email. Inicia sesión." };
    }
    if (createError.code === "weak_password") {
      return { error: "La contraseña es demasiado débil. Prueba con una más larga." };
    }
    return { error: "No se pudo completar el registro. Inténtalo de nuevo." };
  }

  const supabase = await createClient();

  if (confirmacionAutomatica) {
    const { error: loginError } = await supabase.auth.signInWithPassword({ email, password });
    if (!loginError) {
      redirect("/dashboard");
    }
    return { mensaje: "Cuenta creada. Ya puedes iniciar sesión." };
  }

  const { error: resendError } = await supabase.auth.resend({ type: "signup", email });

  if (resendError?.code === "over_email_send_rate_limit") {
    return {
      mensaje:
        "Cuenta creada, pero se ha alcanzado el límite de envío de correos. Espera unos minutos y usa \"Reenviar confirmación\" en la página de inicio de sesión.",
    };
  }

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
