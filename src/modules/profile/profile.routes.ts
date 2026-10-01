import { Request, Response, Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import { nicknameSchema } from './nickname';
import { getProfile, setNickname } from './profile.service';

export const profileRouter = Router();

profileRouter.use(authMiddleware);
profileRouter.get(
  '/me',
  asyncHandler(async (req: Request, res: Response) => res.status(200).json(await getProfile(req.userId!))),
);
profileRouter.put(
  '/me/nickname',
  asyncHandler(async (req: Request, res: Response) =>
    res.status(200).json(await setNickname(req.userId!, nicknameSchema.parse(req.body).nickname)),
  ),
);
