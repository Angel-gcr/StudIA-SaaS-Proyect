import { Suspense } from "react";
import { LoginForm } from "./login-form";

/**
 * Envolvemos el formulario en Suspense porque usa useSearchParams()
 * (para leer ?error=... del enlace de confirmación de email), y Next.js
 * exige un límite de Suspense alrededor de cualquier componente cliente
 * que lo use, para poder pre-renderizar el resto de la página sin
 * bloquearse en los parámetros de la URL.
 */
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
