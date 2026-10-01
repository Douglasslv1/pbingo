import { Server as HttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { env } from '../config/env';
import { logger } from '../lib/logger';
import { authenticateToken } from '../lib/session';

let io: SocketIOServer | null = null;

const userRoom = (userId: string) => `user:${userId}`;

export function initSocket(httpServer: HttpServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: { origin: env.corsOrigins.length > 0 ? env.corsOrigins : '*' },
  });

  // Conexoes com token entram na sala privada do usuario (eventos do domino).
  // Sem token a conexao continua valida, so recebe os eventos publicos (bingo).
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (typeof token !== 'string' || token.length === 0) {
      next();
      return;
    }
    authenticateToken(token)
      .then((userId) => {
        socket.data.userId = userId;
        socket.join(userRoom(userId));
        next();
      })
      .catch(() => {
        logger.warn('Conexão WebSocket com token inválido recusada');
        next(new Error('Token de autenticação inválido ou expirado'));
      });
  });

  return io;
}

export function broadcast(event: string, payload: unknown): void {
  if (!io) {
    return;
  }
  io.emit(event, payload);
}

/** Envia um evento somente para as conexoes autenticadas de um usuario. */
export function emitToUser(userId: string, event: string, payload: unknown): void {
  if (!io) {
    return;
  }
  io.to(userRoom(userId)).emit(event, payload);
}

/** Conexoes abertas agora: usuarios logados distintos e total (inclui visitantes sem login). */
export async function onlineCounts(): Promise<{ onlineUsers: number; onlineConnections: number }> {
  if (!io) {
    return { onlineUsers: 0, onlineConnections: 0 };
  }
  const sockets = await io.fetchSockets();
  return {
    onlineUsers: new Set(sockets.map((socket) => socket.data.userId).filter(Boolean)).size,
    onlineConnections: sockets.length,
  };
}
