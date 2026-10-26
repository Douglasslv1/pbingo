import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../../middleware/auth.middleware';
import { adminMiddleware } from '../../middleware/admin.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../utils/errors';
import { listPartners, partnerDashboard, recordRefund, savePartner } from './partners.service';

const config = z.object({ rateBps: z.number().int().min(1).max(10000), holdDays: z.number().int().min(0).max(365),
  durationDays: z.number().int().min(1).max(3650).nullable(), active: z.boolean(), blocked: z.boolean(), reason: z.string().trim().min(3).max(500) });
const querySchema = z.object({ page: z.coerce.number().int().min(1).max(100000).default(1), from: z.coerce.date().optional(),
  to: z.coerce.date().optional(), raffleId: z.string().uuid().optional() }).refine((q) => !q.from || !q.to || q.from <= q.to, 'Período inválido');
const id = z.string().uuid();
export const partnersRouter = Router();
partnersRouter.use(authMiddleware);
partnersRouter.get('/me', asyncHandler(async (req, res) => {
  const partner = await prisma.partner.findUnique({ where: { userId: req.userId! } });
  if (!partner) throw new AppError('Seu cadastro ainda não está habilitado como parceiro. Solicite ao administrador.', 404);
  res.json(await partnerDashboard(partner.id, querySchema.parse(req.query)));
}));
export const adminPartnersRouter = Router();
adminPartnersRouter.use(authMiddleware, asyncHandler(adminMiddleware));
adminPartnersRouter.get('/', asyncHandler(async (_req, res) => { res.json(await listPartners()); }));
adminPartnersRouter.post('/', asyncHandler(async (req, res) => {
  const input = config.extend({ userEmail: z.string().email(), code: z.string().trim().toLowerCase().regex(/^[a-z0-9-]{4,32}$/).optional() }).parse(req.body);
  const { userEmail, code, ...settings } = input;
  res.status(201).json(await savePartner(req.userId!, settings, undefined, userEmail, code));
}));
adminPartnersRouter.put('/:id', asyncHandler(async (req, res) => { res.json(await savePartner(req.userId!, config.parse(req.body), id.parse(req.params.id))); }));
adminPartnersRouter.get('/:id/dashboard', asyncHandler(async (req, res) => { res.json(await partnerDashboard(id.parse(req.params.id), querySchema.parse(req.query), true)); }));
adminPartnersRouter.post('/purchases/:id/refund', asyncHandler(async (req, res) => {
  const input = z.object({ totalRefundedCents: z.number().int().min(1).max(999999999), reference: z.string().trim().min(5).max(500), confirmed: z.literal(true) }).parse(req.body);
  res.json(await recordRefund(req.userId!, id.parse(req.params.id), input.totalRefundedCents, input.reference));
}));
