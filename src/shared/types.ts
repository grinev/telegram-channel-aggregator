import type { TelegramClient } from 'telegram';

export interface AppConfig {
  apiId?: number;
  apiHash?: string;
  stringSession?: string;
  botToken: string;
  aggregatorChannel: string;
  sourceChannels: string[];
  logLevel: string;
  fetchMode: string;
  pollIntervalMs: number;
  channelStateFile: string;
}

export interface MessageDispatch {
  chatId: number | string;
  messageId: number;
}

export interface ProducerClient {
  client: TelegramClient;
  disconnect: () => Promise<void>;
}
