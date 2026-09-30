import { Server as HttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { env } from '../config/env';

let io: SocketIOServer | null = null;

export function initSocket(httpServer: HttpServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: { origin: env.corsOrigins.length > 0 ? env.corsOrigins : '*' },
  });
  return io;
}

export function broadcast(event: string, payload: unknown): void {
  if (!io) {
    return;
  }
  io.emit(event, payload);
}
