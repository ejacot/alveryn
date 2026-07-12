import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "Password must have at least 8 characters")
});

export const registerSchema = loginSchema;

export const forgotPasswordSchema = z.object({
  email: z.string().email("Enter a valid email")
});

export const resetPasswordSchema = z.object({
  email: z.string().email("Enter a valid email"),
  code: z.string().min(6, "Code must have 6 digits"),
  newPassword: z.string().min(8, "Password must have at least 8 characters")
});

export const verifyEmailSchema = z.object({
  email: z.string().email("Enter a valid email"),
  code: z.string().min(6, "Code must have 6 digits")
});

export type LoginValues = z.infer<typeof loginSchema>;
export type RegisterValues = z.infer<typeof registerSchema>;
export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;
export type VerifyEmailValues = z.infer<typeof verifyEmailSchema>;
