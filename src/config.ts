import 'dotenv/config';
import type { AppConfig } from './shared/types.js';

const fetchMode = process.env.FETCH_MODE ?? 'polling';

const commonRequired = [
  'TELEGRAM_BOT_TOKEN',
  'TELEGRAM_AGGREGATOR_CHANNEL',
  'ALLOWED_USER_IDS',
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

const pollIntervalMs = Number(process.env.POLL_INTERVAL_MS ?? '300000');

if (!Number.isInteger(pollIntervalMs) || pollIntervalMs <= 0) {
  throw new Error('POLL_INTERVAL_MS must be a valid positive integer');
}

const allowedUserIds = process.env
  .ALLOWED_USER_IDS!.split(',')
  .map((id) => Number(id.trim()))
  .filter((id) => !isNaN(id) && id > 0);

export const config: AppConfig = {
  apiId,
  apiHash: process.env.TELEGRAM_API_HASH,
  stringSession: process.env.TELEGRAM_STRING_SESSION,
  botToken: process.env.TELEGRAM_BOT_TOKEN!,
  aggregatorChannel: process.env.TELEGRAM_AGGREGATOR_CHANNEL!,
  allowedUserIds,
  channelsFile: process.env.CHANNELS_FILE ?? 'channels.txt',
  logLevel: process.env.LOG_LEVEL ?? 'info',
  fetchMode,
  pollIntervalMs,
  channelStateFile: process.env.CHANNEL_STATE_FILE ?? 'channel-state.json',
};
