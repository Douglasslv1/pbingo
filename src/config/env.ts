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

  // Rodadas comecam em horarios fixos (ex.: :00, :15, :30, :45) se houver o minimo de jogadores
  roundIntervalMinutes: optionalNumber('ROUND_INTERVAL_MINUTES', 15),
  minPlayersPerRound: optionalNumber('MIN_PLAYERS_PER_ROUND', 5),
  // Mesa de domino que nao completa 4 jogadores nesse prazo e cancelada, com as chaves devolvidas
  // Enquanto false, so administradores jogam domino (liberacao gradual)
  dominoEnabled: process.env.DOMINO_ENABLED === 'true',
  dominoTurnSeconds: optionalNumber('DOMINO_TURN_SECONDS', 30),
  dominoQueueTimeoutMinutes: optionalNumber('DOMINO_QUEUE_TIMEOUT_MINUTES', 10),
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
  minWithdrawalBrl: optionalNumber('MIN_WITHDRAWAL_BRL', 10),

  // Origens do frontend aceitas pelo CORS e pelo WebSocket; vazio libera todas (apenas desenvolvimento)
  corsOrigins: (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean),
  rateLimitEnabled: process.env.RATE_LIMIT_ENABLED !== 'false',
  bootstrapAdminEmail: process.env.BOOTSTRAP_ADMIN_EMAIL ?? '',
  trustProxyHops: optionalNumber('TRUST_PROXY_HOPS', 2),

  frontendUrl: (process.env.FRONTEND_URL ?? 'http://localhost:5173').replace(/\/$/, ''),
  resendApiKey: process.env.RESEND_API_KEY ?? '',
  brevoApiKey: process.env.BREVO_API_KEY ?? '',
  emailFrom: process.env.EMAIL_FROM ?? 'Pbingu <onboarding@resend.dev>',
  passwordResetTtlMs: optionalNumber('PASSWORD_RESET_TTL_MS', 60 * 60 * 1000),
};
