import { z } from 'zod';
import { acceptTermsField, birthDateSchema } from './terms';

export const registerSchema = z.object({
  name: z.string().min(2).max(255),
  email: z.string().email(),
  password: z.string().min(8).max(72),
  birthDate: birthDateSchema,
  acceptTerms: acceptTermsField,
});

export const acceptTermsSchema = z.object({
  birthDate: birthDateSchema,
  acceptTerms: acceptTermsField,
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordSchema = z.object({
  token: z.string().regex(/^[0-9a-f]{64}$/, 'Link de redefinicao invalido'),
  password: z.string().min(8).max(72),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type AcceptTermsInput = z.infer<typeof acceptTermsSchema>;
