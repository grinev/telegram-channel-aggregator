import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createConsumerBot } from '../../src/consumer/bot.js';

const mockForwardMessage = vi.fn();

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
    api = {
      forwardMessage: mockForwardMessage,
    };
    constructor(_token: string) {}
  }

  return {
    Bot: MockBot,
    GrammyError,
  };
});

const mockConfig = {
  botToken: 'test-bot-token',
  aggregatorChannel: '@test-channel',
  sourceChannels: ['@channel1', '@channel2'],
  logLevel: 'info',
  fetchMode: 'event',
  pollIntervalMs: 300000,
  channelStateFile: 'channel-state.json',
};

const mockLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

describe('createConsumerBot', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockForwardMessage.mockResolvedValue({ message_id: 99 });
  });

  it('should forward message successfully', async () => {
    const { forward } = createConsumerBot(mockConfig, mockLogger);

    await forward({ chatId: -1001234567890, messageId: 42 });

    expect(mockForwardMessage).toHaveBeenCalledWith('@test-channel', -1001234567890, 42);

    expect(mockLogger.info).toHaveBeenCalledWith('Forwarded: channel=-1001234567890, message=42');
  });

  it('should log success after forwarding', async () => {
    const { forward } = createConsumerBot(mockConfig, mockLogger);

    await forward({ chatId: -1001234567890, messageId: 42 });

    expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Forwarded:'));
  });

  it('should retry on FloodWait and succeed', async () => {
    const { GrammyError } = await import('grammy');
    const floodError = new GrammyError('FloodWait', {
      error_code: 429,
      description: 'Too Many Requests: retry after 1',
      parameters: { retry_after: 0.01 },
    });

    mockForwardMessage.mockRejectedValueOnce(floodError).mockResolvedValue({ message_id: 99 });

    const { forward } = createConsumerBot(mockConfig, mockLogger);

    await forward({ chatId: -1001234567890, messageId: 42 });

    expect(mockForwardMessage).toHaveBeenCalledTimes(2);
    expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('FloodWait'));
    expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Forwarded:'));
  });

  it('should throw on non-FloodWait errors', async () => {
    const { GrammyError } = await import('grammy');
    const error = new GrammyError('Forbidden', {
      error_code: 403,
      description: 'Forbidden: bot is not a member',
      parameters: {},
    });

    mockForwardMessage.mockRejectedValue(error);

    const { forward } = createConsumerBot(mockConfig, mockLogger);

    await expect(forward({ chatId: -1001234567890, messageId: 42 })).rejects.toThrow('Forbidden');

    expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Failed to forward'));
  });
});
