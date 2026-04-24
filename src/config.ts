import 'dotenv/config';
import type { AppConfig } from './shared/types.js';

const required = ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_AGGREGATOR_CHANNEL', 'ALLOWED_USER_IDS'] as const;

const missing = required.filter((key) => !process.env[key]);

if (missing.length > 0) {
  throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
}

const pollIntervalMs = Number(process.env.POLL_INTERVAL_MS ?? '300000');

if (!Number.isInteger(pollIntervalMs) || pollIntervalMs <= 0) {
  throw new Error('POLL_INTERVAL_MS must be a valid positive integer');
}

const delayBetweenChannelsMinMs = Number(process.env.DELAY_BETWEEN_CHANNELS_MIN_MS ?? '2000');
const delayBetweenChannelsMaxMs = Number(process.env.DELAY_BETWEEN_CHANNELS_MAX_MS ?? '5000');

if (
  !Number.isInteger(delayBetweenChannelsMinMs) ||
  delayBetweenChannelsMinMs < 0 ||
  !Number.isInteger(delayBetweenChannelsMaxMs) ||
  delayBetweenChannelsMaxMs < 0
) {
  throw new Error(
    'DELAY_BETWEEN_CHANNELS_MIN_MS and DELAY_BETWEEN_CHANNELS_MAX_MS must be valid non-negative integers',
  );
}

if (delayBetweenChannelsMinMs > delayBetweenChannelsMaxMs) {
  throw new Error(
    'DELAY_BETWEEN_CHANNELS_MIN_MS must not be greater than DELAY_BETWEEN_CHANNELS_MAX_MS',
  );
}

const forwardDelayMs = Number(process.env.FORWARD_DELAY_MS ?? '1200');

if (!Number.isInteger(forwardDelayMs) || forwardDelayMs < 0) {
  throw new Error('FORWARD_DELAY_MS must be a valid non-negative integer');
}

const allowedUserIds = process.env
  .ALLOWED_USER_IDS!.split(',')
  .map((id) => Number(id.trim()))
  .filter((id) => !isNaN(id) && id > 0);

export const config: AppConfig = {
  botToken: process.env.TELEGRAM_BOT_TOKEN!,
  aggregatorChannel: process.env.TELEGRAM_AGGREGATOR_CHANNEL!,
  allowedUserIds,
  channelsFile: process.env.CHANNELS_FILE ?? 'channels.txt',
  logLevel: process.env.LOG_LEVEL ?? 'info',
  pollIntervalMs,
  channelStateFile: process.env.CHANNEL_STATE_FILE ?? 'channel-state.json',
  delayBetweenChannelsMinMs,
  delayBetweenChannelsMaxMs,
  forwardDelayMs,
};
