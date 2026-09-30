import { Request, Response } from 'express';
import { WebhookSignatureValidator } from 'mercadopago';
import { env } from '../../config/env';
import { logger } from '../../lib/logger';
import { AppError } from '../../utils/errors';
import { confirmMockPixPurchase } from './payments.service';
import { createPixChargeSchema, mockPixSchema } from './payments.types';
import { createPixCharge, getPixChargeStatus, handleMercadoPagoWebhook } from './pix.service';

export async function mockPix(req: Request, res: Response): Promise<void> {
  if (env.isProduction) {
    throw new AppError('Endpoint de pagamento simulado desabilitado em produção', 403);
  }
  if (!req.userId) {
    throw new AppError('Não autenticado', 401);
  }

  const input = mockPixSchema.parse(req.body);
  const result = await confirmMockPixPurchase(req.userId, input);
  res.status(200).json(result);
}

export async function createPix(req: Request, res: Response): Promise<void> {
  if (!req.userId) {
    throw new AppError('Não autenticado', 401);
  }

  const input = createPixChargeSchema.parse(req.body);
  const result = await createPixCharge(req.userId, input.creditsAmount);
  res.status(201).json(result);
}

export async function getPixStatus(req: Request, res: Response): Promise<void> {
  if (!req.userId) {
    throw new AppError('Não autenticado', 401);
  }

  const result = await getPixChargeStatus(req.userId, req.params.transactionId);
  res.status(200).json(result);
}

export async function mercadoPagoWebhook(req: Request, res: Response): Promise<void> {
  const dataIdRaw = req.query['data.id'] ?? req.query.id;
  const dataId = Array.isArray(dataIdRaw) ? dataIdRaw[0] : dataIdRaw;
  const orderId = dataId ?? req.body?.data?.id;
  const topic = req.query.type ?? req.body?.type;

  if (env.mercadoPagoWebhookSecret) {
    // A documentacao manda usar IDs alfanumericos (ORD...) em minusculas na
    // assinatura; o ID original fica como alternativa caso o envio nao siga isso.
    const candidateIds =
      typeof dataId === 'string' ? [...new Set([dataId.toLowerCase(), dataId])] : [undefined];
    let lastError: unknown;
    const valid = candidateIds.some((candidate) => {
      try {
        WebhookSignatureValidator.validate({
          xSignature: req.headers['x-signature'],
          xRequestId: req.headers['x-request-id'],
          dataId: candidate,
          secret: env.mercadoPagoWebhookSecret,
          toleranceSeconds: 300,
        });
        return true;
      } catch (err) {
        lastError = err;
        return false;
      }
    });

    if (!valid) {
      // Nada aqui e secreto: o x-signature e so o hash da mensagem, nao a chave.
      logger.warn('Assinatura de webhook do Mercado Pago inválida, ignorando notificação', {
        error: lastError,
        query: req.query,
        xSignature: req.headers['x-signature'],
        xRequestId: req.headers['x-request-id'],
      });
      res.status(401).send('invalid signature');
      return;
    }
  }

  // So avisos de order interessam: outros topicos (ex.: "payment") sao confirmados e ignorados.
  if (orderId && (!topic || topic === 'order')) {
    try {
      await handleMercadoPagoWebhook(String(orderId));
    } catch (err) {
      logger.error('Erro ao processar webhook do Mercado Pago', { orderId: String(orderId), err });
    }
  }

  res.status(200).send('ok');
}
