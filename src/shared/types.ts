export interface AppConfig {
  botToken: string;
  aggregatorChannel: string;
  allowedUserIds: number[];
  channelsFile: string;
  logLevel: string;
  pollIntervalMs: number;
  channelStateFile: string;
  delayBetweenChannelsMinMs: number;
  delayBetweenChannelsMaxMs: number;
  forwardDelayMs: number;
}

export interface MessageDispatch {
  chatId: number | string;
  messageId: number;
}
