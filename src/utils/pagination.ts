import { z } from 'zod';

/** Paginacao por cursor: `cursor` e o id do ultimo item da pagina anterior. */
export const historyQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().uuid().optional(),
});

export type HistoryPage = z.infer<typeof historyQuerySchema>;
