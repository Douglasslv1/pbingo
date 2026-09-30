/** Tempo minimo de sala aberta: evita uma rodada que comeca segundos depois de abrir. */
export const MIN_LOBBY_MS = 60 * 1000;

/**
 * Proximo horario da grade (multiplos do intervalo contados a partir da hora cheia, em UTC -
 * com intervalos que dividem 60 min, coincide com o horario de Brasilia) que deixe
 * pelo menos MIN_LOBBY_MS de sala aberta.
 */
export function nextRoundSlot(now: Date, intervalMinutes: number): Date {
  const intervalMs = intervalMinutes * 60 * 1000;
  const earliest = now.getTime() + MIN_LOBBY_MS;
  return new Date(Math.ceil(earliest / intervalMs) * intervalMs);
}
