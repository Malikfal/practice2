import 'dotenv/config';

export const ENV = {
  ENV: (process.env.ENV ?? 'dev') as 'dev' | 'prod',
  PORT: Number(process.env.PORT) ?? 3000,
  DATABASE_URL: process.env.DATABASE_URL ?? '',
  REDIS_URL: process.env.REDIS_URL ?? 'redis://localhost:6379',
  JWT_SECRET: process.env.JWT_SECRET ?? 'dev_jwt_secret_change_me',
  FRONTEND_URL: process.env.FRONTEND_URL ?? 'http://localhost:5173',
} as const;
