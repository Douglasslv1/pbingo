import { Router } from 'express';
import { adminMiddleware } from '../../middleware/admin.middleware';
import { authMiddleware } from '../../middleware/auth.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import { getPlatformStats } from './stats.service';

export const adminStatsRouter = Router();

adminStatsRouter.use(authMiddleware, asyncHandler(adminMiddleware));
adminStatsRouter.get('/', asyncHandler(async (_req, res) => res.status(200).json(await getPlatformStats())));
