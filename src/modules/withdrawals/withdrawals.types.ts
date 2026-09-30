import { z } from 'zod';
import { isValidCpf, onlyDigits } from '../../utils/cpf';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const amountInReais = z
  .number()
  .positive()
  .refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-6, {
    message: 'Valor deve ter no máximo 2 casas decimais',
  });

const cpfField = z
  .string()
  .refine(isValidCpf, { message: 'CPF inválido' })
  .transform(onlyDigits);

/** Normaliza a chave Pix conforme o tipo; retorna null se ela for invalida. */
export function normalizePixKey(type: PixKeyTypeInput, rawKey: string): string | null {
  const key = rawKey.trim();

  switch (type) {
    case 'CPF':
      return isValidCpf(key) ? onlyDigits(key) : null;
    case 'EMAIL':
      return z.string().email().safeParse(key).success ? key.toLowerCase() : null;
    case 'PHONE': {
      const digits = onlyDigits(key).replace(/^55(?=\d{10,11}$)/, '');
      return /^\d{10,11}$/.test(digits) ? `+55${digits}` : null;
    }
    case 'RANDOM':
      return UUID_PATTERN.test(key) ? key.toLowerCase() : null;
  }
}

const pixKeyTypeSchema = z.enum(['CPF', 'EMAIL', 'PHONE', 'RANDOM']);
export type PixKeyTypeInput = z.infer<typeof pixKeyTypeSchema>;

export const withdrawalSchema = z
  .object({
    amount: amountInReais,
    cpf: cpfField,
    pixKeyType: pixKeyTypeSchema,
    pixKey: z.string().min(1).max(255),
  })
  .transform((input, ctx) => {
    const pixKey = normalizePixKey(input.pixKeyType, input.pixKey);
    if (!pixKey) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['pixKey'], message: 'Chave Pix inválida para o tipo informado' });
      return z.NEVER;
    }
    return { ...input, pixKey };
  });

export type WithdrawalInput = z.infer<typeof withdrawalSchema>;

export const markPaidSchema = z.object({
  paymentReference: z.string().trim().min(1).max(255),
});

export const rejectSchema = z.object({
  reason: z.string().trim().min(3).max(500),
});

export const withdrawalStatusFilterSchema = z.object({
  status: z.enum(['PENDING', 'PAID', 'REJECTED']).optional(),
});

export const withdrawalIdParamSchema = z.object({
  id: z.string().uuid(),
});
