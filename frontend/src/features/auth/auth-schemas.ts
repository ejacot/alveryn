import { z } from "zod";
import { i18n } from "../../i18n";

export const loginSchema = z.object({
  email: z.string().email(i18n.t("auth:validation.email")),
  password: z.string().min(8, i18n.t("auth:validation.passwordMin"))
});

export const registerSchema = loginSchema;

export const forgotPasswordSchema = z.object({
  email: z.string().email(i18n.t("auth:validation.email"))
});

export const resetPasswordSchema = z.object({
  email: z.string().email(i18n.t("auth:validation.email")),
  code: z.string().min(6, i18n.t("auth:validation.codeLength")),
  newPassword: z.string().min(8, i18n.t("auth:validation.passwordMin"))
});

export const verifyEmailSchema = z.object({
  email: z.string().email(i18n.t("auth:validation.email")),
  code: z.string().min(6, i18n.t("auth:validation.codeLength"))
});

export type LoginValues = z.infer<typeof loginSchema>;
export type RegisterValues = z.infer<typeof registerSchema>;
export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;
export type VerifyEmailValues = z.infer<typeof verifyEmailSchema>;
