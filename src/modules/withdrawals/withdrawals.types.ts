import { z } from 'zod';

export const withdrawalSchema = z.object({
  amount: z.number().positive(),
});

export type WithdrawalInput = z.infer<typeof withdrawalSchema>;
