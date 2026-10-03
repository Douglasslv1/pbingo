import { Request, Response, Router } from 'express';
import { ZodType, ZodTypeDef } from 'zod';
import { adminMiddleware } from '../../middleware/admin.middleware';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requireTermsAccepted } from '../../middleware/terms.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import { AppError } from '../../utils/errors';
import { historyQuerySchema } from '../../utils/pagination';
import { onSocketRequest } from '../../websocket/socket';
import { tableIdParamSchema, tableStatusFilterSchema } from './tables.schemas';
import {
  getActiveTable,
  getTableForAdmin,
  getTableForPlayer,
  joinQueue,
  leaveQueue,
  listMyMatches,
  listTablesForAdmin,
  playMove,
  returnToTable,
} from './tables.service';
import { GameName, QueueChoice } from './tables.types';

function requireUserId(req: Request): string {
  if (!req.userId) {
    throw new AppError('Não autenticado', 401);
  }
  return req.userId;
}

const handle = (fn: (req: Request) => Promise<unknown>, status = 200) =>
  asyncHandler(async (req: Request, res: Response) => {
    res.status(status).json(await fn(req));
  });

/** Rotas do jogador e do admin de um jogo de mesa; so os formatos de fila e de jogada mudam por jogo. */
export function createTableRouters(game: GameName, schemas: { queue: ZodType<QueueChoice, ZodTypeDef, unknown>; action: ZodType }) {
  const tableId = (req: Request) => tableIdParamSchema.parse(req.params).id;

  const router = Router();
  router.use(authMiddleware);
  router.get('/tables/me', handle((req) => getActiveTable(game, requireUserId(req))));
  router.get('/history/me', handle((req) => listMyMatches(game, requireUserId(req), historyQuerySchema.parse(req.query))));
  router.get('/tables/:id', handle((req) => getTableForPlayer(game, requireUserId(req), tableId(req))));
  router.post(
    '/queue',
    asyncHandler(requireTermsAccepted),
    handle((req) => joinQueue(game, requireUserId(req), schemas.queue.parse(req.body)), 201),
  );
  router.post('/queue/leave', handle((req) => leaveQueue(requireUserId(req))));
  router.post(
    '/tables/:id/moves',
    handle((req) => playMove(game, requireUserId(req), tableId(req), schemas.action.parse(req.body))),
  );
  // A mesma jogada pelo WebSocket: { id, action }
  onSocketRequest(`${game.toLowerCase()}:move`, (userId, payload) =>
    playMove(game, userId, tableIdParamSchema.parse(payload).id, schemas.action.parse((payload as { action?: unknown }).action)),
  );
  router.post('/tables/:id/back', handle((req) => returnToTable(game, requireUserId(req), tableId(req))));

  const admin = Router();
  admin.use(authMiddleware, asyncHandler(adminMiddleware));
  admin.get('/tables', handle((req) => listTablesForAdmin(game, tableStatusFilterSchema.parse(req.query).status)));
  admin.get('/tables/:id', handle((req) => getTableForAdmin(game, tableId(req))));

  return { router, admin };
}
