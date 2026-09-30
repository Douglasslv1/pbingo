const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/** Formata valores em reais no padrao brasileiro: 5.6 -> "R$ 5,60". */
export function formatBrl(value: string | number): string {
  return BRL.format(Number(value));
}
