import { Request, Response } from 'express';
import { z } from 'zod';
import { AppError } from '../../utils/errors';
import { historyQuerySchema } from '../../utils/pagination';
import {
  getCurrentRoundView,
  getMyTicketsForRound,
  joinCurrentRound,
  leaveCurrentRound,
  listMyRounds,
} from './rounds.service';

export async function getCurrentRound(req: Request, res: Response): Promise<void> {
  const round = await getCurrentRoundView();
  if (!round) {
    res.status(200).json(null);
    return;
  }
  res.status(200).json(round);
}

export async function joinRound(req: Request, res: Response): Promise<void> {
  if (!req.userId) {
    throw new AppError('Não autenticado', 401);
  }
  const input = z.object({ quantity: z.number().int().min(1).max(100).default(1), roundId: z.string().uuid().optional() }).parse(req.body ?? {});
  const result = await joinCurrentRound(req.userId, input.quantity, input.roundId);
  res.status(201).json(result);
}

export async function getMyTickets(req: Request, res: Response): Promise<void> {
  if (!req.userId) {
    throw new AppError('Não autenticado', 401);
  }
  const tickets = await getMyTicketsForRound(req.userId, req.params.roundId);
  res.status(200).json(tickets);
}

export async function getMyRoundHistory(req: Request, res: Response): Promise<void> {
  if (!req.userId) {
    throw new AppError('Não autenticado', 401);
  }
  const page = historyQuerySchema.parse(req.query);
  res.status(200).json(await listMyRounds(req.userId, page));
}

export async function leaveRound(req: Request, res: Response): Promise<void> {
  if (!req.userId) {
    throw new AppError('Não autenticado', 401);
  }
  res.status(200).json(await leaveCurrentRound(req.userId));
}
