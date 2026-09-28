import path from 'path';
import { config as loadEnv } from 'dotenv';
import { defineConfig } from 'vitest/config';

const { parsed } = loadEnv({ path: path.resolve(__dirname, '.env.test') });

export default defineConfig({
  test: {
    environment: 'node',
    env: parsed ?? {},
    globalSetup: ['./tests/globalSetup.ts'],
    setupFiles: ['./tests/setup.ts'],
    testTimeout: 20_000,
    hookTimeout: 30_000,
    pool: 'forks',
    poolOptions: {
      forks: { singleFork: true },
    },
  },
});
