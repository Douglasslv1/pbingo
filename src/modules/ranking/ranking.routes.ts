import { Request, Response, Router } from 'express';
import { z } from 'zod';
import { viewerOf } from '../../lib/session';
import { asyncHandler } from '../../utils/asyncHandler';
import { getRanking, RankingGame } from './ranking.service';

const querySchema = z.object({
  game: z.enum(['bingo', 'domino', 'truco', 'damas', 'xadrez', 'ludo']).transform((game) => game.toUpperCase() as RankingGame),
  period: z.enum(['month', 'all']).default('month'),
});

/** Ranking e publico; com login valido, mostra tambem a posicao de quem esta vendo. */
export const rankingRouter = Router();

rankingRouter.get(
  '/:game',
  asyncHandler(async (req: Request, res: Response) => {
    const { game, period } = querySchema.parse({ ...req.params, ...req.query });
    res.status(200).json(await getRanking(game, period, await viewerOf(req)));
  }),
);
