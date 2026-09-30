import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requireTermsAccepted } from '../../middleware/terms.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import { getCurrentRound, getMyRoundHistory, getMyTickets, joinRound, leaveRound } from './rounds.controller';

export const roundsRouter = Router();

roundsRouter.get('/current', asyncHandler(getCurrentRound));
roundsRouter.post('/join', authMiddleware, asyncHandler(requireTermsAccepted), asyncHandler(joinRound));
roundsRouter.post('/leave', authMiddleware, asyncHandler(leaveRound));
roundsRouter.get('/:roundId/my-tickets', authMiddleware, asyncHandler(getMyTickets));
roundsRouter.get('/history/me', authMiddleware, asyncHandler(getMyRoundHistory));
