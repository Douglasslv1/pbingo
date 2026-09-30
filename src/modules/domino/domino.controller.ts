import { Request, Response } from 'express';
import { AppError } from '../../utils/errors';
import { dominoActionSchema, queueChoiceSchema, tableIdParamSchema } from './domino.schemas';
import { getActiveTable, getTableForPlayer, joinQueue, leaveQueue, playMove, returnToTable } from './domino.service';

function requireUserId(req: Request): string {
  if (!req.userId) {
    throw new AppError('Nao autenticado', 401);
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
