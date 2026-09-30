import { randomUUID } from 'crypto';
import { NextFunction, Request, Response } from 'express';
import { logger } from '../lib/logger';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}

const IGNORED_PATHS = new Set(['/health']);

/** Registra cada requisicao com um id que tambem volta no header X-Request-Id (facilita cruzar reclamacao e log). */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const requestId = req.header('x-request-id') ?? randomUUID();
  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);

  if (IGNORED_PATHS.has(req.path)) {
    next();
    return;
  }

  // Ajuda a calibrar TRUST_PROXY_HOPS: mostra a cadeia de proxies que chegou ate o servidor
  logger.debug('Cabecalhos de proxy', {
    requestId,
    forwardedFor: req.header('x-forwarded-for'),
    realIp: req.header('x-real-ip'),
    resolvedIp: req.ip,
  });

  const startedAt = process.hrtime.bigint();
  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    const fields = {
      requestId,
      method: req.method,
      path: req.originalUrl.split('?')[0],
      status: res.statusCode,
      durationMs: Math.round(durationMs),
      userId: req.userId,
      ip: req.ip,
    };

    if (res.statusCode >= 500) {
      logger.error('Requisição com erro', fields);
    } else {
      logger.info('Requisição', fields);
    }
  });

  next();
}
