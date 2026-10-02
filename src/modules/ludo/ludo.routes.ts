import { z } from 'zod';
import { createTableRouters } from '../tables/tables.routes';
import { stakeSchema } from '../tables/tables.schemas';
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
  ]),
});
