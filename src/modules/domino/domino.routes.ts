import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requireTermsAccepted } from '../../middleware/terms.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import { adminMiddleware } from '../../middleware/admin.middleware';
import {
  adminGetTable,
  adminListTables,
  comeBack,
  enterQueue,
  exitQueue,
  getMyMatches,
  getMyTable,
  getTable,
  makeMove,
} from './domino.controller';

export const dominoRouter = Router();

dominoRouter.use(authMiddleware);
dominoRouter.get('/tables/me', asyncHandler(getMyTable));
dominoRouter.get('/history/me', asyncHandler(getMyMatches));
dominoRouter.get('/tables/:id', asyncHandler(getTable));
dominoRouter.post('/queue', asyncHandler(requireTermsAccepted), asyncHandler(enterQueue));
dominoRouter.post('/queue/leave', asyncHandler(exitQueue));
dominoRouter.post('/tables/:id/moves', asyncHandler(makeMove));
dominoRouter.post('/tables/:id/back', asyncHandler(comeBack));

export const adminDominoRouter = Router();

adminDominoRouter.use(authMiddleware, asyncHandler(adminMiddleware));
adminDominoRouter.get('/tables', asyncHandler(adminListTables));
adminDominoRouter.get('/tables/:id', asyncHandler(adminGetTable));
