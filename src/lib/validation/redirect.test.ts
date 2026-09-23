import { describe, expect, it } from "vitest";
import { rutaInternaSegura } from "./redirect";

describe("rutaInternaSegura", () => {
  it.each([
    ["/dashboard", "/dashboard"],
    ["/admin?pestana=usuarios", "/admin?pestana=usuarios"],
    ["/dashboard#creditos", "/dashboard#creditos"],
  ])("acepta la ruta interna %s", (next, esperado) => {
    expect(rutaInternaSegura(next)).toBe(esperado);
  });

  it.each([
    ["ausente", null],
    ["vacía", ""],
    ["con @ que cambia el host", "@dominio-ajeno.com"],
    ["relativa al protocolo", "//dominio-ajeno.com"],
    ["con barra invertida", "/\\dominio-ajeno.com"],
    ["con tabulador que el navegador elimina", "/\t/dominio-ajeno.com"],
    ["absoluta", "https://dominio-ajeno.com"],
    ["sin barra inicial", "dashboard"],
  ])("devuelve /dashboard si next está %s", (_caso, next) => {
    expect(rutaInternaSegura(next)).toBe("/dashboard");
  });
});
