import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requireTermsAccepted } from '../../middleware/terms.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import { comeBack, enterQueue, exitQueue, getMyTable, getTable, makeMove } from './domino.controller';

export const dominoRouter = Router();

dominoRouter.use(authMiddleware);
dominoRouter.get('/tables/me', asyncHandler(getMyTable));
dominoRouter.get('/tables/:id', asyncHandler(getTable));
dominoRouter.post('/queue', asyncHandler(requireTermsAccepted), asyncHandler(enterQueue));
dominoRouter.post('/queue/leave', asyncHandler(exitQueue));
dominoRouter.post('/tables/:id/moves', asyncHandler(makeMove));
dominoRouter.post('/tables/:id/back', asyncHandler(comeBack));
