import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { environment: 'node', include: ['tests/rafflePricing.test.ts', 'tests/raffleNumbers.test.ts', 'tests/partnerCommission.test.ts', 'tests/referralCapture.test.ts'] },
});
