import { z } from 'zod';
import { createTableRouters } from '../tables/tables.routes';
import { stakeSchema } from '../tables/tables.schemas';
import { AbilityId } from './ludo.abilities';
import { LUDO_CONFIG } from './ludo.config';
import { PIECES } from './ludo.engine';

/** Fila do Ludo: modalidade, mano a mano ou 4 jogadores; o valor da mesa so conta quando o ludo deixar de ser gratuito. */
export const ludoRouters = createTableRouters('LUDO', {
  queue: z
    .object({
      mode: z.enum(['CLASSICO', 'ARENA']).default('CLASSICO'),
      teamMode: z.enum(['DUEL', 'INDIVIDUAL']),
      stake: stakeSchema.default(1),
    }),
  action: z.discriminatedUnion('type', [
    z.object({ type: z.literal('ROLL') }),
    z.object({ type: z.literal('MOVE'), piece: z.number().int().min(0).max(PIECES - 1) }),
    z.object({ type: z.literal('PASS') }),
    z.object({
      type: z.literal('ABILITY'),
      ability: z.enum(Object.keys(LUDO_CONFIG.abilities) as [AbilityId, ...AbilityId[]]),
      pieces: z.array(z.number().int().min(0).max(PIECES - 1)).min(1).max(2).optional(),
      targetSeat: z.number().int().min(0).max(3).optional(),
    }),
  ]),
});
