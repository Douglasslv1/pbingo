import { Request, Response } from 'express';
import { AppError } from '../../utils/errors';
import { historyQuerySchema } from '../../utils/pagination';
import { dominoActionSchema, queueChoiceSchema, tableIdParamSchema, tableStatusFilterSchema } from './domino.schemas';
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
} from './domino.service';

function requireUserId(req: Request): string {
  if (!req.userId) {
    throw new AppError('Não autenticado', 401);
  }
  return req.userId;
}

export async function getMyTable(req: Request, res: Response): Promise<void> {
  res.status(200).json(await getActiveTable(requireUserId(req)));
}

export async function getTable(req: Request, res: Response): Promise<void> {
  const { id } = tableIdParamSchema.parse(req.params);
  res.status(200).json(await getTableForPlayer(requireUserId(req), id));
}

export async function enterQueue(req: Request, res: Response): Promise<void> {
  const choice = queueChoiceSchema.parse(req.body);
  res.status(201).json(await joinQueue(requireUserId(req), choice));
}

export async function exitQueue(req: Request, res: Response): Promise<void> {
  res.status(200).json(await leaveQueue(requireUserId(req)));
}

export async function makeMove(req: Request, res: Response): Promise<void> {
  const { id } = tableIdParamSchema.parse(req.params);
  const action = dominoActionSchema.parse(req.body);
  res.status(200).json(await playMove(requireUserId(req), id, action));
}

export async function comeBack(req: Request, res: Response): Promise<void> {
  const { id } = tableIdParamSchema.parse(req.params);
  res.status(200).json(await returnToTable(requireUserId(req), id));
}

export async function getMyMatches(req: Request, res: Response): Promise<void> {
  const page = historyQuerySchema.parse(req.query);
  res.status(200).json(await listMyMatches(requireUserId(req), page));
}

export async function adminListTables(req: Request, res: Response): Promise<void> {
  const { status } = tableStatusFilterSchema.parse(req.query);
  res.status(200).json(await listTablesForAdmin(status));
}

export async function adminGetTable(req: Request, res: Response): Promise<void> {
  const { id } = tableIdParamSchema.parse(req.params);
  res.status(200).json(await getTableForAdmin(id));
}
