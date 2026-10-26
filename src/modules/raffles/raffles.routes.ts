import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../../middleware/auth.middleware';
import { adminMiddleware } from '../../middleware/admin.middleware';
import { requireTermsAccepted } from '../../middleware/terms.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../utils/errors';
import { createPixForTransaction, handleMercadoPagoWebhook } from '../payments/pix.service';
import { quantitySchema, raffleSchema, resultSchema } from './raffles.schemas';
import { drawRaffle, listRaffles, myRafflePurchases, purchaseRaffle, raffleBuyers, saveRaffle, setRaffleStatus } from './raffles.service';

const uuid = z.string().uuid();
export const rafflesRouter = Router();
rafflesRouter.get('/', asyncHandler(async (_req, res) => { res.json(await listRaffles()); }));
rafflesRouter.use(authMiddleware);
rafflesRouter.get('/me/purchases', asyncHandler(async (req, res) => { res.json(await myRafflePurchases(req.userId!)); }));
rafflesRouter.post('/:id/purchases', asyncHandler(requireTermsAccepted),
  asyncHandler(async (req, res) => {
    res.status(201).json(await purchaseRaffle(req.userId!, uuid.parse(req.params.id), quantitySchema.parse(req.body).quantity));
  }));

async function refreshPurchase(id: string, userId?: string) {
  const purchase = await prisma.rafflePurchase.findFirst({ where: { id, ...(userId ? { userId } : {}) }, include: { transaction: true } });
  if (!purchase) throw new AppError('Compra não encontrada', 404);
  if (purchase.transaction.status !== 'PENDING') return { transactionId: purchase.transactionId, status: purchase.transaction.status };
  const charge = await createPixForTransaction(purchase.transaction);
  const current = await prisma.transaction.findUniqueOrThrow({ where: { id: purchase.transactionId } });
  if (current.providerReference) await handleMercadoPagoWebhook(current.providerReference);
  const updated = await prisma.transaction.findUniqueOrThrow({ where: { id: purchase.transactionId } });
  return { ...charge, status: updated.status };
}

rafflesRouter.post('/purchases/:id/refresh', asyncHandler(async (req, res) => {
  res.json(await refreshPurchase(uuid.parse(req.params.id), req.userId!));
}));

export const adminRafflesRouter = Router();
adminRafflesRouter.use(authMiddleware, asyncHandler(adminMiddleware));
adminRafflesRouter.get('/', asyncHandler(async (_req, res) => { res.json(await listRaffles(true)); }));
adminRafflesRouter.post('/', asyncHandler(async (req, res) => { res.status(201).json(await saveRaffle(raffleSchema.parse(req.body))); }));
adminRafflesRouter.put('/:id', asyncHandler(async (req, res) => { res.json(await saveRaffle(raffleSchema.parse(req.body), uuid.parse(req.params.id))); }));
adminRafflesRouter.post('/:id/publish', asyncHandler(async (req, res) => { res.json(await setRaffleStatus(uuid.parse(req.params.id), 'publish')); }));
adminRafflesRouter.post('/:id/close', asyncHandler(async (req, res) => { res.json(await setRaffleStatus(uuid.parse(req.params.id), 'close')); }));
adminRafflesRouter.get('/:id/purchases', asyncHandler(async (req, res) => {
  res.json(await raffleBuyers(uuid.parse(req.params.id), z.coerce.number().int().min(1).max(100000).default(1).parse(req.query.page)));
}));
adminRafflesRouter.post('/purchases/:id/refresh', asyncHandler(async (req, res) => { res.json(await refreshPurchase(uuid.parse(req.params.id))); }));
adminRafflesRouter.post('/:id/draw', asyncHandler(async (req, res) => {
  const input = resultSchema.parse(req.body);
  res.json(await drawRaffle(uuid.parse(req.params.id), req.userId!, input.resultNumber, input.resultSource));
}));
