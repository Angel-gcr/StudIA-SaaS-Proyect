import { z } from "zod";

export const registroSchema = z.object({
  nombreCompleto: z.string().trim().min(2, "Escribe tu nombre completo."),
  email: z.string().email("Introduce un email válido."),
  password: z
    .string()
    .min(8, "La contraseña debe tener al menos 8 caracteres."),
  nombreAcademia: z
    .string()
    .trim()
    .min(2, "Escribe el nombre de tu academia."),
});

export const loginSchema = z.object({
  email: z.string().email("Introduce un email válido."),
  password: z.string().min(1, "Introduce tu contraseña."),
});

export type RegistroInput = z.infer<typeof registroSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
