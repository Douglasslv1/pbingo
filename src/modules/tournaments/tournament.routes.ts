import { Request, Response, Router } from 'express';
import { z } from 'zod';
import { adminMiddleware } from '../../middleware/admin.middleware';
import { authMiddleware } from '../../middleware/auth.middleware';
import { prisma } from '../../lib/prisma';
import { viewerOf } from '../../lib/session';
import { asyncHandler } from '../../utils/asyncHandler';
import { GameName } from '../tables/tables.types';
import {
  activeTournamentOf,
  cancelTournament,
  createTournament,
  getTournament,
  joinTournament,
  leaveTournament,
  listTournaments,
  TOURNAMENT_FORMATS,
  TOURNAMENT_SIZES,
} from './tournament.service';

const idOf = (req: Request) => z.string().uuid().parse(req.params.id);

const createSchema = z
  .object({
    name: z.string().trim().min(3).max(60),
    game: z.enum(Object.keys(TOURNAMENT_FORMATS) as [GameName, ...GameName[]]),
    mode: z.string().optional(),
    teamMode: z.string().optional(),
    size: z.coerce.number().refine((size): size is (typeof TOURNAMENT_SIZES)[number] => (TOURNAMENT_SIZES as readonly number[]).includes(size), {
      message: 'Vagas: 8, 16 ou 32',
    }),
    entryFee: z.coerce.number().int().min(0).max(10_000),
    startsAt: z.coerce.date().refine((date) => date > new Date(), { message: 'O início deve ser no futuro' }),
  })
  .transform((input) => {
    const [mode, teamMode] = TOURNAMENT_FORMATS[input.game][0];
    return { ...input, mode: input.mode ?? mode, teamMode: input.teamMode ?? teamMode };
  })
  .refine((input) => TOURNAMENT_FORMATS[input.game].some(([mode, teamMode]) => mode === input.mode && teamMode === input.teamMode), {
    message: 'Formato inválido para o jogo',
  })
  .refine((input) => input.teamMode !== 'PAIRS' || input.entryFee % 2 === 0, {
    message: 'Na dupla, a inscrição deve ser par (cada jogador paga metade)',
  });

const joinSchema = z.object({ partner: z.string().trim().min(1).max(20).optional() });

/** Lista e chave sao publicas; inscrever e desistir exigem login. */
export const tournamentsRouter = Router();

// Torneio em que o jogador esta vivo agora (e se a partida dele esta aberta): o aviso do cabecalho
tournamentsRouter.get(
  '/me/active',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => res.json(await activeTournamentOf(prisma, req.userId!))),
);
tournamentsRouter.get('/', asyncHandler(async (req: Request, res: Response) => res.json(await listTournaments(await viewerOf(req)))));
tournamentsRouter.get('/:id', asyncHandler(async (req: Request, res: Response) => res.json(await getTournament(idOf(req), await viewerOf(req)))));
tournamentsRouter.post(
  '/:id/entry',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => res.status(201).json(await joinTournament(req.userId!, idOf(req), joinSchema.parse(req.body ?? {}).partner))),
);
tournamentsRouter.delete(
  '/:id/entry',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => res.json(await leaveTournament(req.userId!, idOf(req)))),
);

export const adminTournamentsRouter = Router();

adminTournamentsRouter.use(authMiddleware, asyncHandler(adminMiddleware));
adminTournamentsRouter.post(
  '/',
  asyncHandler(async (req: Request, res: Response) => res.status(201).json(await createTournament(createSchema.parse(req.body)))),
);
adminTournamentsRouter.post(
  '/:id/cancel',
  asyncHandler(async (req: Request, res: Response) => {
    await cancelTournament(idOf(req));
    res.status(204).end();
  }),
);
