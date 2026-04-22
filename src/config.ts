import 'dotenv/config';
import type { AppConfig } from './shared/types.js';

const fetchMode = process.env.FETCH_MODE ?? 'event';

const commonRequired = [
  'TELEGRAM_BOT_TOKEN',
  'TELEGRAM_AGGREGATOR_CHANNEL',
  'SOURCE_CHANNELS',
] as const;

const missing = commonRequired.filter((key) => !process.env[key]);

if (missing.length > 0) {
  throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
}

if (fetchMode === 'event') {
  const mtprotoRequired = [
    'TELEGRAM_API_ID',
    'TELEGRAM_API_HASH',
    'TELEGRAM_STRING_SESSION',
  ] as const;
  const mtprotoMissing = mtprotoRequired.filter((key) => !process.env[key]);

  if (mtprotoMissing.length > 0) {
    throw new Error(
      `Missing MTProto environment variables for event mode: ${mtprotoMissing.join(', ')}. Set FETCH_MODE=polling or provide these variables.`,
    );
  }
}

const apiId = process.env.TELEGRAM_API_ID ? Number(process.env.TELEGRAM_API_ID) : undefined;

if (apiId !== undefined && !Number.isInteger(apiId)) {
  throw new Error('TELEGRAM_API_ID must be a valid integer');
}

const pollIntervalMs = Number(process.env.POLL_INTERVAL_MS ?? '900000');

if (!Number.isInteger(pollIntervalMs) || pollIntervalMs <= 0) {
  throw new Error('POLL_INTERVAL_MS must be a valid positive integer');
}

export const config: AppConfig = {
  apiId,
  apiHash: process.env.TELEGRAM_API_HASH,
  stringSession: process.env.TELEGRAM_STRING_SESSION,
  botToken: process.env.TELEGRAM_BOT_TOKEN!,
  aggregatorChannel: process.env.TELEGRAM_AGGREGATOR_CHANNEL!,
  sourceChannels: process.env
    .SOURCE_CHANNELS!.split(',')
    .map((channel) => channel.trim())
    .filter(Boolean),
  logLevel: process.env.LOG_LEVEL ?? 'info',
  fetchMode,
  pollIntervalMs,
  channelStateFile: process.env.CHANNEL_STATE_FILE ?? 'channel-state.json',
};
