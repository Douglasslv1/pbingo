import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import { getCurrentRound, getMyRoundHistory, getMyTickets, joinRound } from './rounds.controller';

export const roundsRouter = Router();

roundsRouter.get('/current', asyncHandler(getCurrentRound));
roundsRouter.post('/join', authMiddleware, asyncHandler(joinRound));
roundsRouter.get('/:roundId/my-tickets', authMiddleware, asyncHandler(getMyTickets));
roundsRouter.get('/history/me', authMiddleware, asyncHandler(getMyRoundHistory));
