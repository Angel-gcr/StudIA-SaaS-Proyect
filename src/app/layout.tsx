import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "StudIA — Corrección de oposiciones con IA",
  description:
    "StudIA corrige ejercicios de desarrollo de opositores por criterios de rúbrica, con evidencias y revisión del profesor.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" suppressHydrationWarning className="h-full antialiased">
      <head>
        {/* Evita el "flash" de tema incorrecto antes de que cargue React */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function () {
                try {
                  var tema = localStorage.getItem("studia-tema");
                  if (tema === "oscuro" || (!tema && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
                    document.documentElement.classList.add("dark");
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100 font-sans">
        {children}
      </body>
    </html>
  );
}
