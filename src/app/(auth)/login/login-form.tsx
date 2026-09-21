"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useActionState, useState } from "react";
import { iniciarSesion, reenviarConfirmacion } from "@/lib/actions/auth";

const MENSAJES_ERROR_URL: Record<string, string> = {
  enlace_invalido_o_caducado:
    "El enlace de confirmación no es válido o ha caducado. Pide uno nuevo abajo.",
};

function LoginForm() {
  const [estado, accionFormulario, enviando] = useActionState(
    iniciarSesion,
    null
  );
  const [estadoReenvio, accionReenvio, reenviando] = useActionState(
    reenviarConfirmacion,
    null
  );
  const [email, setEmail] = useState("");
  const searchParams = useSearchParams();
  const errorUrl = searchParams.get("error");
  const mensajeErrorUrl = errorUrl ? MENSAJES_ERROR_URL[errorUrl] : null;

  const emailNoConfirmado =
    estado?.error?.includes("confirmado") || Boolean(mensajeErrorUrl);

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h1 className="mb-1 text-lg font-semibold">Iniciar sesión</h1>
      <p className="mb-6 text-sm text-zinc-500 dark:text-zinc-400">
        Accede a tu cuenta de StudIA.
      </p>

      <form action={accionFormulario} className="space-y-4">
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
            value={email}
            onChange={(e) => setEmail(e.target.value)}
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
            autoComplete="current-password"
            className="w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700"
          />
        </div>

        {(estado?.error || mensajeErrorUrl) && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            {estado?.error ?? mensajeErrorUrl}
          </p>
        )}

        <button
          type="submit"
          disabled={enviando}
          className="w-full rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {enviando ? "Entrando…" : "Entrar"}
        </button>
      </form>

      {emailNoConfirmado && (
        <form action={accionReenvio} className="mt-3">
          <input type="hidden" name="email" value={email} />
          {estadoReenvio?.mensaje ? (
            <p className="text-center text-sm text-emerald-700 dark:text-emerald-400">
              {estadoReenvio.mensaje}
            </p>
          ) : (
            <button
              type="submit"
              disabled={reenviando || !email}
              className="w-full text-center text-sm font-medium text-zinc-600 underline hover:text-zinc-900 disabled:opacity-50 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              {reenviando ? "Reenviando…" : "Reenviar email de confirmación"}
            </button>
          )}
        </form>
      )}

      <p className="mt-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
        ¿No tienes cuenta?{" "}
        <Link href="/registro" className="font-medium text-zinc-900 underline dark:text-zinc-100">
          Registra tu academia
        </Link>
      </p>
    </div>
  );
}

export { LoginForm };
