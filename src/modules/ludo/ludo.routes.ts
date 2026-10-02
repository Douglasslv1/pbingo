import { z } from 'zod';
import { createTableRouters } from '../tables/tables.routes';
import { stakeSchema } from '../tables/tables.schemas';
import { PIECES } from './ludo.engine';

/** Fila do Ludo: mano a mano ou 4 jogadores; o valor da mesa so conta quando o ludo deixar de ser gratuito. */
export const ludoRouters = createTableRouters('LUDO', {
  queue: z
    .object({ teamMode: z.enum(['DUEL', 'INDIVIDUAL']), stake: stakeSchema.default(1) })
    .transform((choice) => ({ ...choice, mode: 'CLASSICO' })),
  action: z.discriminatedUnion('type', [
    z.object({ type: z.literal('ROLL') }),
    z.object({ type: z.literal('MOVE'), piece: z.number().int().min(0).max(PIECES - 1) }),
  ]),
});
