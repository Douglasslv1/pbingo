import { config } from 'dotenv';

config();

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Variavel de ambiente obrigatoria ausente: ${name}`);
  }
  return value;
}

function optionalNumber(name: string, fallback: number): number {
  const value = process.env[name];
  return value ? Number(value) : fallback;
}

function percent(name: string, fallback: number): number {
  const value = optionalNumber(name, fallback);
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new Error(`${name} deve ser um percentual entre 0 e 100`);
  }
  return value;
}

const ticketPriceCredits = optionalNumber('TICKET_PRICE_CREDITS', 1);
const creditPriceBrl = optionalNumber('CREDIT_PRICE_BRL', 1.0);
const houseFeePercent = percent('HOUSE_FEE_PERCENT', 20);

/** Valor da cartela menos a comissao da casa, arredondado para baixo em centavos. */
function computePrizeContributionPerTicket(): number {
  const ticketPriceCents = Math.round(ticketPriceCredits * creditPriceBrl * 100);
  return Math.floor((ticketPriceCents * (100 - houseFeePercent)) / 100) / 100;
}

export const env = {
  port: optionalNumber('PORT', 3000),
  databaseUrl: required('DATABASE_URL'),
  jwtSecret: required('JWT_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',

  roundWaitMs: optionalNumber('ROUND_WAIT_MS', 60_000),
  drawIntervalMs: optionalNumber('DRAW_INTERVAL_MS', 3_000),
  nextRoundDelayMs: optionalNumber('NEXT_ROUND_DELAY_MS', 5_000),

  ticketPriceCredits,
  houseFeePercent,
  prizeContributionPerTicket: computePrizeContributionPerTicket(),

  isProduction: process.env.NODE_ENV === 'production',
  publicBaseUrl: process.env.PUBLIC_BASE_URL ?? `http://localhost:${optionalNumber('PORT', 3000)}`,
  mercadoPagoAccessToken: process.env.MERCADOPAGO_ACCESS_TOKEN ?? '',
  mercadoPagoWebhookSecret: process.env.MERCADOPAGO_WEBHOOK_SECRET ?? '',
  creditPriceBrl,
};
