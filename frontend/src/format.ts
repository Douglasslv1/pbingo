const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/** Formata valores em reais no padrao brasileiro: 5.6 -> "R$ 5,60". */
export function formatBrl(value: string | number): string {
  return BRL.format(Number(value));
}

/** Segundos restantes como relogio: 872 -> "14:32". */
export function formatCountdown(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/** Horario local curto: "20:15". */
export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}
