import { Request, Response, Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import { historyQuerySchema } from '../../utils/pagination';
import { claimDaily, getVenox, listVenoxHistory } from './venox.service';

export const venoxRouter = Router();

venoxRouter.use(authMiddleware);
venoxRouter.get(
  '/me',
  asyncHandler(async (req: Request, res: Response) => res.status(200).json(await getVenox(req.userId!))),
);
venoxRouter.post(
  '/daily',
  asyncHandler(async (req: Request, res: Response) => res.status(200).json(await claimDaily(req.userId!))),
);
venoxRouter.get(
  '/history',
  asyncHandler(async (req: Request, res: Response) =>
    res.status(200).json(await listVenoxHistory(req.userId!, historyQuerySchema.parse(req.query))),
  ),
);
