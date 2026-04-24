import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createConsumerBot } from '../../src/consumer/bot.js';

const mockForwardMessage = vi.fn();
const mockGetChat = vi.fn();
const mockGetChatMember = vi.fn();
const mockSetMyCommands = vi.fn();
const mockCommandHandlers: Record<string, Function> = {};
let mockOnStartCallback: Function | undefined;

vi.mock('grammy', () => {
  class GrammyError extends Error {
    method: string;
    payload: Record<string, unknown>;
    ok: false;
    error_code: number;
    description: string;
    parameters: { retry_after?: number; migrate_to_chat_id?: number };

    constructor(message: string, err: any) {
      super(message);
      this.name = 'GrammyError';
      this.method = err.method ?? 'forwardMessage';
      this.payload = err.payload ?? {};
      this.ok = false;
      this.error_code = err.error_code ?? 400;
      this.description = err.description ?? message;
      this.parameters = err.parameters ?? {};
    }
  }

  class MockBot {
    botInfo = { id: 999, username: 'testbot' };
    api = {
      forwardMessage: mockForwardMessage,
      getChat: mockGetChat,
      getChatMember: mockGetChatMember,
      setMyCommands: mockSetMyCommands,
    };
    constructor(_token: string) {}
    command(name: string, handler: Function) {
      mockCommandHandlers[name] = handler;
    }
    start(options?: { onStart?: Function }) {
      mockOnStartCallback = options?.onStart;
    }
    stop() {}
  }

  return {
    Bot: MockBot,
    GrammyError,
  };
});

vi.mock('../../src/poller/whitelist-store.js', () => ({
  loadChannels: vi.fn(),
  addChannel: vi.fn(),
  removeChannel: vi.fn(),
}));

vi.mock('../../src/poller/channel-fetcher.js', () => ({
  fetchChannelPosts: vi.fn(),
}));

const { loadChannels, addChannel, removeChannel } = await import(
  '../../src/poller/whitelist-store.js'
);
const { fetchChannelPosts } = await import('../../src/poller/channel-fetcher.js');

const mockConfig = {
  botToken: 'test-bot-token',
  aggregatorChannel: '@test-channel',
  allowedUserIds: [12345],
  channelsFile: 'channels.txt',
  logLevel: 'info',
  fetchMode: 'polling',
  pollIntervalMs: 300000,
  channelStateFile: 'channel-state.json',
};

const mockLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

function createMockContext(match?: string, fromId?: number) {
  return {
    from: { id: fromId ?? 12345 },
    match,
    reply: vi.fn(),
  };
}

describe('createConsumerBot', () => {
  let stateCache: Map<string, number>;

  beforeEach(() => {
    vi.clearAllMocks();
    stateCache = new Map();
    mockForwardMessage.mockResolvedValue({ message_id: 99 });
    mockGetChat.mockResolvedValue({ id: -100123456, title: 'Test Channel' });
    mockGetChatMember.mockResolvedValue({ status: 'administrator' });
    fetchChannelPosts.mockResolvedValue({ postIds: [42], channelUsername: 'testchannel' });
    for (const key of Object.keys(mockCommandHandlers)) {
      delete mockCommandHandlers[key];
    }
    mockOnStartCallback = undefined;
  });

  it('should forward message successfully', async () => {
    const { forward } = createConsumerBot(mockConfig, mockLogger, stateCache);

    await forward({ chatId: -1001234567890, messageId: 42 });

    expect(mockForwardMessage).toHaveBeenCalledWith('@test-channel', -1001234567890, 42);
    expect(mockLogger.info).toHaveBeenCalledWith('Forwarded: channel=-1001234567890, message=42');
  });

  it('should retry on FloodWait and succeed', async () => {
    const { GrammyError } = await import('grammy');
    const floodError = new GrammyError('FloodWait', {
      error_code: 429,
      description: 'Too Many Requests: retry after 1',
      parameters: { retry_after: 0.01 },
    });

    mockForwardMessage.mockRejectedValueOnce(floodError).mockResolvedValue({ message_id: 99 });

    const { forward } = createConsumerBot(mockConfig, mockLogger, stateCache);

    await forward({ chatId: -1001234567890, messageId: 42 });

    expect(mockForwardMessage).toHaveBeenCalledTimes(2);
    expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('FloodWait'));
  });

  it('should throw on non-FloodWait errors', async () => {
    const { GrammyError } = await import('grammy');
    const error = new GrammyError('Forbidden', {
      error_code: 403,
      description: 'Forbidden: bot is not a member',
      parameters: {},
    });

    mockForwardMessage.mockRejectedValue(error);

    const { forward } = createConsumerBot(mockConfig, mockLogger, stateCache);

    await expect(forward({ chatId: -1001234567890, messageId: 42 })).rejects.toThrow('Forbidden');
    expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Failed to forward'));
  });

  it('should register command handlers and start bot', () => {
    createConsumerBot(mockConfig, mockLogger, stateCache);

    expect(mockCommandHandlers['add_channel']).toBeDefined();
    expect(mockCommandHandlers['remove_channel']).toBeDefined();
    expect(mockCommandHandlers['list_channels']).toBeDefined();
  });
});

describe('/add_channel command', () => {
  let stateCache: Map<string, number>;

  beforeEach(() => {
    vi.clearAllMocks();
    stateCache = new Map();
    mockForwardMessage.mockResolvedValue({ message_id: 99 });
    mockGetChat.mockResolvedValue({ id: -100123456, title: 'Test Channel' });
    mockGetChatMember.mockResolvedValue({ status: 'administrator' });
    fetchChannelPosts.mockResolvedValue({ postIds: [42], channelUsername: 'testchannel' });
    for (const key of Object.keys(mockCommandHandlers)) {
      delete mockCommandHandlers[key];
    }
  });

  it('should deny access to unauthorized users', async () => {
    createConsumerBot(mockConfig, mockLogger, stateCache);

    const ctx = createMockContext('channel1', 99999);
    await mockCommandHandlers['add_channel'](ctx);

    expect(ctx.reply).toHaveBeenCalledWith('Access denied.');
  });

  it('should reply with usage when no argument provided', async () => {
    createConsumerBot(mockConfig, mockLogger, stateCache);

    const ctx = createMockContext('', 12345);
    await mockCommandHandlers['add_channel'](ctx);

    expect(ctx.reply).toHaveBeenCalledWith('Usage: /add_channel @channel or /add_channel channel');
  });

  it('should add channel successfully', async () => {
    (addChannel as any).mockReturnValue(true);
    createConsumerBot(mockConfig, mockLogger, stateCache);

    const ctx = createMockContext('@testchannel', 12345);
    await mockCommandHandlers['add_channel'](ctx);

    expect(mockGetChat).toHaveBeenCalledWith('@testchannel');
    expect(mockGetChatMember).toHaveBeenCalledWith('@testchannel', 999);
    expect(addChannel).toHaveBeenCalledWith('channels.txt', 'testchannel', mockLogger);
    expect(ctx.reply).toHaveBeenCalledWith('@testchannel added to monitoring.');
  });

  it('should initialize state cache after adding channel', async () => {
    (addChannel as any).mockReturnValue(true);
    fetchChannelPosts.mockResolvedValue({ postIds: [100, 99], channelUsername: 'testchannel' });
    createConsumerBot(mockConfig, mockLogger, stateCache);

    const ctx = createMockContext('testchannel', 12345);
    await mockCommandHandlers['add_channel'](ctx);

    expect(fetchChannelPosts).toHaveBeenCalledWith('testchannel', mockLogger);
    expect(stateCache.get('testchannel')).toBe(100);
  });

  it('should handle fetch error when initializing cache', async () => {
    (addChannel as any).mockReturnValue(true);
    fetchChannelPosts.mockRejectedValue(new Error('Network error'));
    createConsumerBot(mockConfig, mockLogger, stateCache);

    const ctx = createMockContext('testchannel', 12345);
    await mockCommandHandlers['add_channel'](ctx);

    expect(stateCache.has('testchannel')).toBe(false);
    expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Failed to fetch initial state'));
  });

  it('should handle duplicate channel', async () => {
    (addChannel as any).mockReturnValue(false);
    createConsumerBot(mockConfig, mockLogger, stateCache);

    const ctx = createMockContext('testchannel', 12345);
    await mockCommandHandlers['add_channel'](ctx);

    expect(ctx.reply).toHaveBeenCalledWith('@testchannel is already in the list.');
  });

  it('should handle channel not found', async () => {
    mockGetChat.mockRejectedValue(new Error('Not Found'));
    createConsumerBot(mockConfig, mockLogger, stateCache);

    const ctx = createMockContext('nonexistent', 12345);
    await mockCommandHandlers['add_channel'](ctx);

    expect(ctx.reply).toHaveBeenCalledWith(
      'Channel @nonexistent not found or bot has no access.',
    );
  });

  it('should handle bot not being admin', async () => {
    mockGetChatMember.mockResolvedValue({ status: 'member' });
    createConsumerBot(mockConfig, mockLogger, stateCache);

    const ctx = createMockContext('testchannel', 12345);
    await mockCommandHandlers['add_channel'](ctx);

    expect(ctx.reply).toHaveBeenCalledWith('Bot is not an administrator in @testchannel.');
  });
});

describe('/remove_channel command', () => {
  let stateCache: Map<string, number>;

  beforeEach(() => {
    vi.clearAllMocks();
    stateCache = new Map();
    for (const key of Object.keys(mockCommandHandlers)) {
      delete mockCommandHandlers[key];
    }
  });

  it('should deny access to unauthorized users', async () => {
    createConsumerBot(mockConfig, mockLogger, stateCache);

    const ctx = createMockContext('channel1', 99999);
    await mockCommandHandlers['remove_channel'](ctx);

    expect(ctx.reply).toHaveBeenCalledWith('Access denied.');
  });

  it('should reply with usage when no argument provided', async () => {
    createConsumerBot(mockConfig, mockLogger, stateCache);

    const ctx = createMockContext('', 12345);
    await mockCommandHandlers['remove_channel'](ctx);

    expect(ctx.reply).toHaveBeenCalledWith(
      'Usage: /remove_channel @channel or /remove_channel channel',
    );
  });

  it('should remove channel successfully', async () => {
    (removeChannel as any).mockReturnValue(true);
    createConsumerBot(mockConfig, mockLogger, stateCache);

    const ctx = createMockContext('@testchannel', 12345);
    await mockCommandHandlers['remove_channel'](ctx);

    expect(removeChannel).toHaveBeenCalledWith('channels.txt', 'testchannel', mockLogger);
    expect(ctx.reply).toHaveBeenCalledWith('@testchannel removed from monitoring.');
  });

  it('should handle channel not in list', async () => {
    (removeChannel as any).mockReturnValue(false);
    createConsumerBot(mockConfig, mockLogger, stateCache);

    const ctx = createMockContext('testchannel', 12345);
    await mockCommandHandlers['remove_channel'](ctx);

    expect(ctx.reply).toHaveBeenCalledWith('@testchannel is not in the list.');
  });
});

describe('/list_channels command', () => {
  let stateCache: Map<string, number>;

  beforeEach(() => {
    vi.clearAllMocks();
    stateCache = new Map();
    for (const key of Object.keys(mockCommandHandlers)) {
      delete mockCommandHandlers[key];
    }
  });

  it('should deny access to unauthorized users', async () => {
    createConsumerBot(mockConfig, mockLogger, stateCache);

    const ctx = createMockContext(undefined, 99999);
    await mockCommandHandlers['list_channels'](ctx);

    expect(ctx.reply).toHaveBeenCalledWith('Access denied.');
  });

  it('should show channels list', async () => {
    (loadChannels as any).mockReturnValue(['channel1', 'channel2']);
    createConsumerBot(mockConfig, mockLogger, stateCache);

    const ctx = createMockContext(undefined, 12345);
    await mockCommandHandlers['list_channels'](ctx);

    expect(ctx.reply).toHaveBeenCalledWith('Channels (2):\n1. @channel1\n2. @channel2');
  });

  it('should handle empty list', async () => {
    (loadChannels as any).mockReturnValue([]);
    createConsumerBot(mockConfig, mockLogger, stateCache);

    const ctx = createMockContext(undefined, 12345);
    await mockCommandHandlers['list_channels'](ctx);

    expect(ctx.reply).toHaveBeenCalledWith('No channels configured.');
  });
});
