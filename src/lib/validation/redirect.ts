import { z } from "zod";

const RUTA_POR_DEFECTO = "/dashboard";
const ORIGEN_DE_PRUEBA = "http://studia.invalid";

// Ruta relativa al sitio: empieza por "/" pero no por "//" ni "/\"
// (los navegadores tratan ambos como URL de otro host).
const rutaInternaSchema = z.string().regex(/^\/(?![/\\])/);

/**
 * Devuelve `next` solo si apunta a una ruta de StudIA; si no, el panel.
 * Evita redirecciones abiertas en enlaces como /auth/confirm?next=...
 */
export function rutaInternaSegura(next: string | null | undefined): string {
  const parsed = rutaInternaSchema.safeParse(next);
  if (!parsed.success) return RUTA_POR_DEFECTO;

  // Refuerzo: el parser de URL elimina tabuladores y saltos de línea, así que
  // "/\t/otro.com" acabaría siendo "//otro.com". Se resuelve contra un origen
  // ficticio y se exige que el origen no cambie.
  const url = new URL(parsed.data, ORIGEN_DE_PRUEBA);
  if (url.origin !== ORIGEN_DE_PRUEBA) return RUTA_POR_DEFECTO;

  return `${url.pathname}${url.search}${url.hash}`;
}
