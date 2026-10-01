import { z } from 'zod';
import { createTableRouters } from '../tables/tables.routes';
import { stakeSchema } from '../tables/tables.schemas';

const square = z.number().int().min(0).max(63);
const resign = z.object({ type: z.literal('RESIGN') });

/** Fila dos jogos de tabuleiro: so o valor da mesa (sempre mano a mano). */
const queue = (mode: string) =>
  z.object({ stake: stakeSchema }).transform(({ stake }) => ({ stake, mode, teamMode: 'DUEL' }));

export const damasRouters = createTableRouters('DAMAS', {
  queue: queue('BRASILEIRA'),
  action: z.discriminatedUnion('type', [z.object({ type: z.literal('MOVE'), path: z.array(square).min(2).max(20) }), resign]),
});

export const xadrezRouters = createTableRouters('XADREZ', {
  queue: queue('CLASSICO'),
  action: z.discriminatedUnion('type', [
    z.object({ type: z.literal('MOVE'), from: square, to: square, promotion: z.enum(['Q', 'R', 'B', 'N']).optional() }),
    resign,
  ]),
});
