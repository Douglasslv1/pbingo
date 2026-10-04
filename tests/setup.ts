import { afterAll, beforeEach } from 'vitest';
import { prisma } from '../src/lib/prisma';
import { clearAllTurnTimeouts } from '../src/modules/tables/turn.scheduler';

async function truncateAll(): Promise<void> {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE tournaments, game_moves, game_seats, game_tables, access_logs, password_reset_tokens, withdrawals, transactions, tickets, rounds, user_prizes, user_credits, users
    RESTART IDENTITY CASCADE
  `);
}

beforeEach(async () => {
  // Cronometros de mesas do teste anterior nao podem disparar no meio do proximo
  clearAllTurnTimeouts();
  await truncateAll();
});

afterAll(async () => {
  await prisma.$disconnect();
});
