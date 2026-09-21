import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { cerrarSesion } from "@/lib/actions/auth";

const ETIQUETA_ROL: Record<string, string> = {
  DUENO: "Dueño",
  ADMIN: "Administrador",
  PROFESOR: "Profesor",
  OPOSITOR: "Opositor",
};

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: perfil } = await supabase
    .from("profiles")
    .select("rol, nombre_completo, email, creditos, tenant_id")
    .eq("id", user.id)
    .single();

  const rol = perfil?.rol ?? "OPOSITOR";

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b border-zinc-200 px-6 py-3 dark:border-zinc-800">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="font-semibold tracking-tight">
            StudIA
          </Link>
          <nav className="flex items-center gap-4 text-sm text-zinc-600 dark:text-zinc-400">
            <Link href="/dashboard" className="hover:text-zinc-900 dark:hover:text-zinc-100">
              Panel
            </Link>
            {rol === "DUENO" || rol === "ADMIN" ? (
              <Link href="/admin" className="hover:text-zinc-900 dark:hover:text-zinc-100">
                Administración
              </Link>
            ) : null}
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
            {ETIQUETA_ROL[rol] ?? rol}
          </span>
          <span className="text-sm text-zinc-500 dark:text-zinc-400">
            {perfil?.creditos ?? 0} créditos
          </span>
          <ThemeToggle />
          <form action={cerrarSesion}>
            <button
              type="submit"
              className="text-sm text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              Cerrar sesión
            </button>
          </form>
        </div>
      </header>
      <main className="flex-1 px-6 py-8">{children}</main>
    </div>
  );
}
