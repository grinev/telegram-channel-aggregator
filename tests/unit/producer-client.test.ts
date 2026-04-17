import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createProducerClient } from '../../src/producer/client.js';

const mockState = {
  connect: vi.fn().mockResolvedValue(undefined),
  isUserAuthorized: vi.fn().mockResolvedValue(true),
  getMe: vi.fn().mockResolvedValue({
    id: 12345,
    firstName: 'Test',
    lastName: 'User',
    username: 'testuser',
  }),
  disconnect: vi.fn().mockResolvedValue(undefined),
};

vi.mock('telegram', () => {
  class MockStringSession {
    constructor(_session?: string) {}
  }

  return {
    TelegramClient: vi.fn().mockImplementation(function MockClient(
      _session: any,
      _apiId: number,
      _apiHash: string,
      _params: any,
    ) {
      const state = (globalThis as any).__mockState;
      this.connect = state.connect;
      this.isUserAuthorized = state.isUserAuthorized;
      this.getMe = state.getMe;
      this.disconnect = state.disconnect;
    }),
    sessions: {
      StringSession: MockStringSession,
    },
  };
});

vi.mock('telegram/sessions', () => ({
  StringSession: class MockStringSession {
    constructor(_session?: string) {}
  },
}));

beforeEach(() => {
  (globalThis as any).__mockState = mockState;
  vi.clearAllMocks();
  mockState.connect.mockResolvedValue(undefined);
  mockState.isUserAuthorized.mockResolvedValue(true);
  mockState.getMe.mockResolvedValue({
    id: 12345,
    firstName: 'Test',
    lastName: 'User',
    username: 'testuser',
  });
});

const mockConfig = {
  apiId: 12345,
  apiHash: 'test-api-hash',
  stringSession: 'test-string-session',
  botToken: 'test-bot-token',
  aggregatorChannel: '@test-channel',
  sourceChannels: ['@channel1', '@channel2'],
  logLevel: 'info',
};

const mockLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

describe('createProducerClient', () => {
  it('should connect to Telegram with valid credentials', async () => {
    const { TelegramClient } = await import('telegram');

    const result = await createProducerClient(mockConfig, mockLogger);

    expect(TelegramClient).toHaveBeenCalledWith(
      expect.any(Object),
      mockConfig.apiId,
      mockConfig.apiHash,
      expect.objectContaining({
        autoReconnect: true,
      }),
    );

    expect(mockState.connect).toHaveBeenCalled();
    expect(mockState.isUserAuthorized).toHaveBeenCalled();
    expect(mockState.getMe).toHaveBeenCalled();
    expect(result.client).toBeDefined();
    expect(typeof result.disconnect).toBe('function');
  });

  it('should log successful connection', async () => {
    await createProducerClient(mockConfig, mockLogger);

    expect(mockLogger.info).toHaveBeenCalledWith('Connecting to Telegram...');
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.stringContaining('Connected as Test User (@testuser)'),
    );
  });

  it('should throw error when StringSession is invalid', async () => {
    mockState.isUserAuthorized.mockResolvedValue(false);

    await expect(createProducerClient(mockConfig, mockLogger)).rejects.toThrow(
      'StringSession is invalid or expired',
    );

    expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Failed to connect'));
  });

  it('should throw error when connection fails', async () => {
    mockState.connect.mockRejectedValue(new Error('Network error'));

    await expect(createProducerClient(mockConfig, mockLogger)).rejects.toThrow('Network error');

    expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Failed to connect'));
  });

  it('should return disconnect function that calls client.disconnect', async () => {
    const { disconnect } = await createProducerClient(mockConfig, mockLogger);

    await disconnect();

    expect(mockState.disconnect).toHaveBeenCalled();
    expect(mockLogger.info).toHaveBeenCalledWith('Disconnecting producer client...');
  });
});
