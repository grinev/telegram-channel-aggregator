import 'dotenv/config';
import type { AppConfig } from './shared/types.js';

const requiredEnvVars = [
  'TELEGRAM_API_ID',
  'TELEGRAM_API_HASH',
  'TELEGRAM_STRING_SESSION',
  'TELEGRAM_BOT_TOKEN',
  'TELEGRAM_AGGREGATOR_CHANNEL',
  'SOURCE_CHANNELS',
] as const;

const missing = requiredEnvVars.filter((key) => !process.env[key]);

if (missing.length > 0) {
  throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
}

const apiId = Number(process.env.TELEGRAM_API_ID);

if (!Number.isInteger(apiId)) {
  throw new Error('TELEGRAM_API_ID must be a valid integer');
}

export const config: AppConfig = {
  apiId,
  apiHash: process.env.TELEGRAM_API_HASH!,
  stringSession: process.env.TELEGRAM_STRING_SESSION!,
  botToken: process.env.TELEGRAM_BOT_TOKEN!,
  aggregatorChannel: process.env.TELEGRAM_AGGREGATOR_CHANNEL!,
  sourceChannels: process.env
    .SOURCE_CHANNELS!.split(',')
    .map((channel) => channel.trim())
    .filter(Boolean),
  logLevel: process.env.LOG_LEVEL ?? 'info',
};
