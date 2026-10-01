import { z } from 'zod';
import { stakeSchema } from '../tables/tables.schemas';

export const trucoQueueSchema = z
  .object({
    teamMode: z.enum(['DUEL', 'PAIRS']),
    stake: stakeSchema,
  })
  .transform((choice) => ({ ...choice, mode: 'PAULISTA' }));

export const trucoActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('PLAY'), index: z.number().int().min(0).max(2), covered: z.boolean().optional() }),
  z.object({ type: z.literal('TRUCO') }),
  z.object({ type: z.literal('ACCEPT') }),
  z.object({ type: z.literal('RUN') }),
  z.object({ type: z.literal('RAISE') }),
]);
