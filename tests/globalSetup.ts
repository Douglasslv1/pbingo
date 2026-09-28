import { execSync } from 'child_process';
import path from 'path';
import { config as loadEnv } from 'dotenv';

export default async function globalSetup(): Promise<void> {
  loadEnv({ path: path.resolve(__dirname, '../.env.test') });

  execSync('npx prisma migrate deploy', {
    cwd: path.resolve(__dirname, '..'),
    stdio: 'inherit',
    env: process.env,
  });
}
