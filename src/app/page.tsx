import Link from "next/link";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
        <span className="font-semibold tracking-tight">StudIA</span>
        <div className="flex items-center gap-4">
          <ThemeToggle />
          <Link
            href="/login"
            className="text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            Iniciar sesión
          </Link>
          <Link
            href="/registro"
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:opacity-90 dark:bg-zinc-100 dark:text-zinc-900"
          >
            Registra tu academia
          </Link>
        </div>
      </header>

      <main className="mx-auto flex max-w-2xl flex-1 flex-col items-center justify-center px-6 py-24 text-center">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Corrige ejercicios de oposiciones como lo haría un profesor
        </h1>
        <p className="mt-6 text-lg text-zinc-600 dark:text-zinc-400">
          StudIA corrige supuestos prácticos, programaciones y unidades
          didácticas criterio por criterio, con la rúbrica oficial, evidencia
          del texto del alumno y revisión de tu profesorado antes de publicar
          cada nota.
        </p>
        <div className="mt-8 flex gap-4">
          <Link
            href="/registro"
            className="rounded-md bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white hover:opacity-90 dark:bg-zinc-100 dark:text-zinc-900"
          >
            Empieza gratis
          </Link>
        </div>
      </main>
    </div>
  );
}
