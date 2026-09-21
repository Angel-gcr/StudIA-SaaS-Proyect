import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: perfil } = await supabase
    .from("profiles")
    .select("nombre_completo, rol, creditos")
    .eq("id", user!.id)
    .single();

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-tight">
        Hola, {perfil?.nombre_completo ?? "de nuevo"}
      </h1>
      <p className="mt-1 text-zinc-500 dark:text-zinc-400">
        Este es tu panel de StudIA. Te quedan{" "}
        <strong className="text-zinc-900 dark:text-zinc-100">
          {perfil?.creditos ?? 0} créditos
        </strong>
        .
      </p>

      <div className="mt-8 rounded-lg border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
        La subida de ejercicios y la corrección por rúbrica llegan en la
        siguiente fase. Esto confirma que tu cuenta, tu rol ({perfil?.rol}) y
        el aislamiento por academia ya funcionan de extremo a extremo.
      </div>
    </div>
  );
}
