import { z } from 'zod';

const pip = z.number().int().min(0).max(6);

export const queueChoiceSchema = z.object({
  mode: z.enum(['SIX_TILES', 'BURRINHO']),
  teamMode: z.enum(['INDIVIDUAL', 'PAIRS']),
});

export const dominoActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('PLAY'), tile: z.tuple([pip, pip]), side: z.enum(['LEFT', 'RIGHT']) }),
  z.object({ type: z.literal('DRAW') }),
  z.object({ type: z.literal('PASS') }),
]);

export const tableIdParamSchema = z.object({ id: z.string().uuid() });
