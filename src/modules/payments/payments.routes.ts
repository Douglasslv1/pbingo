import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import { createPix, getPixStatus, mercadoPagoWebhook, mockPix } from './payments.controller';

export const paymentsRouter = Router();

// Simula o webhook de confirmacao de pagamento Pix - apenas para desenvolvimento/testes.
paymentsRouter.post('/mock-pix', authMiddleware, asyncHandler(mockPix));

paymentsRouter.post('/pix/create', authMiddleware, asyncHandler(createPix));
paymentsRouter.get('/pix/:transactionId/status', authMiddleware, asyncHandler(getPixStatus));

// Webhook publico chamado pelo Mercado Pago - sem autenticacao de usuario.
paymentsRouter.post('/webhook/mercadopago', asyncHandler(mercadoPagoWebhook));
