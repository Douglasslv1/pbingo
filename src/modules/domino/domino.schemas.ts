import { z } from 'zod';
import { stakeSchema } from '../tables/tables.schemas';

const pip = z.number().int().min(0).max(6);

export const queueChoiceSchema = z
  .object({
    mode: z.enum(['SIX_TILES', 'BURRINHO']),
    teamMode: z.enum(['INDIVIDUAL', 'PAIRS', 'DUEL']),
    stake: stakeSchema,
  })
  .refine((choice) => choice.teamMode !== 'DUEL' || choice.mode === 'SIX_TILES', {
    message: 'Mano a mano só existe no jogo de 6 peças',
  });

export const dominoActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('PLAY'), tile: z.tuple([pip, pip]), side: z.enum(['LEFT', 'RIGHT']) }),
  z.object({ type: z.literal('DRAW') }),
  z.object({ type: z.literal('PASS') }),
]);
