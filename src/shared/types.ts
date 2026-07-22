export interface ChannelPost {
  id: number;
  dedupKey: string;
}

export interface FetchResult {
  postIds: number[];
  posts: ChannelPost[];
  channelUsername: string;
}

export interface ChannelStateEntry {
  lastMessageId: number;
}

export type ChannelState = Record<string, ChannelStateEntry | string[] | undefined> & {
  _recentKeys?: string[];
};

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
  messageId?: number;
  messageIds?: number[];
}
