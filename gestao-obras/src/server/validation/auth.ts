import { z } from "zod";
import { email } from "./common";

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Informe a senha.").max(128),
});

export const mfaCodeSchema = z.object({
  code: z.string().trim().min(6, "Informe o código.").max(20),
});

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z.object({
  token: z.string().min(20).max(100),
  password: z.string().min(1).max(128),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Informe a senha atual.").max(128),
  newPassword: z.string().min(1).max(128),
});
