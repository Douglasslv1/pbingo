import { afterAll, beforeEach } from 'vitest';
import { prisma } from '../src/lib/prisma';
import { clearAllTurnTimeouts } from '../src/modules/domino/domino.scheduler';

async function truncateAll(): Promise<void> {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE domino_moves, domino_seats, domino_tables, access_logs, password_reset_tokens, withdrawals, transactions, tickets, rounds, user_prizes, user_credits, users
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
