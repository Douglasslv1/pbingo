import { z } from 'zod';
import { Stake, STAKES } from './tables.types';

export const stakeSchema = z
  .number()
  .int()
  .refine((value): value is Stake => (STAKES as readonly number[]).includes(value), {
    message: `Valor da mesa deve ser ${STAKES.join(', ')} chaves`,
  })
  .default(1);

export const tableStatusFilterSchema = z.object({
  status: z.enum(['WAITING', 'PLAYING', 'FINISHED', 'CANCELLED']).optional(),
});

export const tableIdParamSchema = z.object({ id: z.string().uuid() });
