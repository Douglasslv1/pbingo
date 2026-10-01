import { logger } from '../../lib/logger';

type TimeoutHandler = (tableId: string) => Promise<Date | null>;

const timers = new Map<string, NodeJS.Timeout>();
let handler: TimeoutHandler | null = null;

/** O servico de mesas registra aqui o que fazer quando o prazo de uma jogada vence. */
export function registerTurnTimeoutHandler(fn: TimeoutHandler): void {
  handler = fn;
}

/** Agenda (ou cancela, com `null`) o cronometro da jogada da vez de uma mesa. */
export function scheduleTurnTimeout(tableId: string, deadline: Date | null): void {
  const existing = timers.get(tableId);
  if (existing) {
    clearTimeout(existing);
    timers.delete(tableId);
  }
  if (!deadline) return;

  const timer = setTimeout(() => {
    timers.delete(tableId);
    if (!handler) return;
    handler(tableId)
      .then((next) => scheduleTurnTimeout(tableId, next))
      .catch((err) => {
        logger.error('Erro ao jogar automaticamente na mesa', { tableId, err });
        // Tenta de novo em instantes para a mesa nunca ficar travada
        scheduleTurnTimeout(tableId, new Date(Date.now() + 5000));
      });
  }, Math.max(deadline.getTime() - Date.now(), 0));
  // Nao impede o processo de encerrar (testes, desligamento)
  timer.unref();
  timers.set(tableId, timer);
}

export function clearAllTurnTimeouts(): void {
  timers.forEach((timer) => clearTimeout(timer));
  timers.clear();
}
