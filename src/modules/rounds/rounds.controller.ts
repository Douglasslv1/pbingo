import { Request, Response } from 'express';
import { AppError } from '../../utils/errors';
import { getCurrentRoundView, getMyTicketsForRound, joinCurrentRound } from './rounds.service';

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
    throw new AppError('Nao autenticado', 401);
  }
  const result = await joinCurrentRound(req.userId);
  res.status(201).json(result);
}

export async function getMyTickets(req: Request, res: Response): Promise<void> {
  if (!req.userId) {
    throw new AppError('Nao autenticado', 401);
  }
  const tickets = await getMyTicketsForRound(req.userId, req.params.roundId);
  res.status(200).json(tickets);
}
