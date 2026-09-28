import { z } from 'zod';

export const mockPixSchema = z.object({
  creditsAmount: z.number().int().positive(),
  amountFiat: z.number().positive(),
});

export type MockPixInput = z.infer<typeof mockPixSchema>;

export const createPixChargeSchema = z.object({
  creditsAmount: z.number().int().positive(),
});

export type CreatePixChargeInput = z.infer<typeof createPixChargeSchema>;
