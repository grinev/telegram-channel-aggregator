import type { TelegramClient } from 'telegram';

export interface AppConfig {
  apiId: number;
  apiHash: string;
  stringSession: string;
  botToken: string;
  aggregatorChannel: string;
  sourceChannels: string[];
  logLevel: string;
}

export interface MessageDispatch {
  chatId: number;
  messageId: number;
}

export interface ProducerClient {
  client: TelegramClient;
  disconnect: () => Promise<void>;
}
