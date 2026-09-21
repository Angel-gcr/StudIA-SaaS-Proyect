"use client";

import Link from "next/link";
import { useActionState } from "react";
import { registrarAcademia } from "@/lib/actions/auth";

export default function RegistroPage() {
  const [estado, accionFormulario, enviando] = useActionState(
    registrarAcademia,
    null
  );

  // Tras un registro correcto (con confirmación de email activada) no hay
  // sesión todavía: mostramos el aviso de "revisa tu correo" en vez del
  // formulario, para que quede claro que el siguiente paso es del usuario.
  if (estado?.mensaje) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-white p-6 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="mb-2 text-lg font-semibold">Revisa tu correo</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {estado.mensaje}
        </p>
        <Link
          href="/login"
          className="mt-6 inline-block text-sm font-medium text-zinc-900 underline dark:text-zinc-100"
        >
          Ir a iniciar sesión
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h1 className="mb-1 text-lg font-semibold">Registra tu academia</h1>
      <p className="mb-6 text-sm text-zinc-500 dark:text-zinc-400">
        Crea la cuenta de administrador de tu academia. Empiezas con el plan
        Gratis (5 créditos).
      </p>

      <form action={accionFormulario} className="space-y-4">
        <div>
          <label
            htmlFor="nombreAcademia"
            className="mb-1 block text-sm font-medium"
          >
            Nombre de la academia
          </label>
          <input
            id="nombreAcademia"
            name="nombreAcademia"
            type="text"
            required
            className="w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700"
          />
        </div>

        <div>
          <label
            htmlFor="nombreCompleto"
            className="mb-1 block text-sm font-medium"
          >
            Tu nombre completo
          </label>
          <input
            id="nombreCompleto"
            name="nombreCompleto"
            type="text"
            required
            className="w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700"
          />
        </div>

        <div>
          <label htmlFor="email" className="mb-1 block text-sm font-medium">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className="w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700"
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="mb-1 block text-sm font-medium"
          >
            Contraseña
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            className="w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700"
          />
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Mínimo 8 caracteres.
          </p>
        </div>

        {estado?.error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            {estado.error}
          </p>
        )}

        <button
          type="submit"
          disabled={enviando}
          className="w-full rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {enviando ? "Creando cuenta…" : "Crear academia"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
        ¿Ya tienes cuenta?{" "}
        <Link href="/login" className="font-medium text-zinc-900 underline dark:text-zinc-100">
          Inicia sesión
        </Link>
      </p>
    </div>
  );
}
