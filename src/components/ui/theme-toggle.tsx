"use client";

import { useEffect, useState } from "react";

/**
 * Interruptor de modo claro/oscuro. Guarda la preferencia en localStorage
 * bajo la clave "studia-tema" ("claro" | "oscuro").
 */
export function ThemeToggle() {
  const [esOscuro, setEsOscuro] = useState(false);

  useEffect(() => {
    setEsOscuro(document.documentElement.classList.contains("dark"));
  }, []);

  function alternar() {
    const nuevoEsOscuro = !esOscuro;
    setEsOscuro(nuevoEsOscuro);
    document.documentElement.classList.toggle("dark", nuevoEsOscuro);
    try {
      localStorage.setItem("studia-tema", nuevoEsOscuro ? "oscuro" : "claro");
    } catch {
      // localStorage puede no estar disponible; no es crítico.
    }
  }

  return (
    <button
      type="button"
      onClick={alternar}
      aria-label={esOscuro ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      className="rounded-md border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-900"
    >
      {esOscuro ? "Modo claro" : "Modo oscuro"}
    </button>
  );
}
