import { io, Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

let socket: Socket | null = null;
let currentToken: string | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(SOCKET_URL, { transports: ['websocket'], auth: currentToken ? { token: currentToken } : {} });

    // Token recusado (expirado, senha trocada): segue anonimo para nao perder os eventos publicos do bingo
    socket.on('connect_error', () => {
      if (socket && currentToken) {
        currentToken = null;
        socket.auth = {};
        socket.connect();
      }
    });
  }
  return socket;
}

/**
 * Pedido com resposta pela conexao ja aberta (sem esperar abrir uma requisicao nova). Devolve null quando
 * nao da para usar o WebSocket agora (desconectado ou com outro login): ai o pedido vai por HTTP.
 * Enviado e sem resposta em 10s, rejeita; nao reenviar por HTTP, que poderia repetir a jogada.
 */
export function socketRequest(token: string, event: string, payload: unknown): Promise<{ data?: unknown; error?: string; status?: number }> | null {
  const active = getSocket();
  if (!active.connected || currentToken !== token) return null;
  return active.timeout(10_000).emitWithAck(event, payload);
}

/** Conecta com o login (eventos privados do domino) ou anonimo; reconecta so se o token mudou. */
export function setSocketToken(token: string | null): void {
  if (token === currentToken) return;
  currentToken = token;

  const active = getSocket();
  active.auth = token ? { token } : {};
  active.disconnect().connect();
}
