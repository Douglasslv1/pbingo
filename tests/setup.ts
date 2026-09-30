import { afterAll, beforeEach } from 'vitest';
import { prisma } from '../src/lib/prisma';

async function truncateAll(): Promise<void> {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE withdrawals, transactions, tickets, rounds, user_prizes, user_credits, users
    RESTART IDENTITY CASCADE
  `);
}

beforeEach(async () => {
  await truncateAll();
});

afterAll(async () => {
  await prisma.$disconnect();
});
