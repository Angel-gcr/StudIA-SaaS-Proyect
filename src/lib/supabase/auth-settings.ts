import "server-only";

/**
 * Indica si el proyecto de Supabase confirma los emails automáticamente
 * (ajuste "Confirm email" desactivado en Auth).
 *
 * Se consulta el endpoint público de ajustes de Auth en lugar de duplicar el
 * ajuste en una variable de entorno: así el registro nunca se salta una
 * confirmación que el proyecto exige. Si la consulta falla, se asume que la
 * confirmación es obligatoria (opción segura).
 */
export async function confirmacionDeEmailAutomatica(): Promise<boolean> {
  try {
    const respuesta = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`,
      {
        headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! },
        cache: "no-store",
      }
    );
    if (!respuesta.ok) return false;
    const ajustes: unknown = await respuesta.json();
    return (
      typeof ajustes === "object" &&
      ajustes !== null &&
      (ajustes as { mailer_autoconfirm?: unknown }).mailer_autoconfirm === true
    );
  } catch {
    return false;
  }
}
