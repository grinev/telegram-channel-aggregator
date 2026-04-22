import { describe, it, expect, vi, beforeEach } from 'vitest';
import { startPolling } from '../../src/poller/scheduler.js';

vi.mock('../../src/poller/state-store.js', () => ({
  loadState: vi.fn(),
  saveState: vi.fn(),
}));

vi.mock('../../src/poller/channel-fetcher.js', () => ({
  fetchChannelPosts: vi.fn(),
}));

const { loadState, saveState } = await import('../../src/poller/state-store.js');
const { fetchChannelPosts } = await import('../../src/poller/channel-fetcher.js');

const mockConfig = {
  botToken: 'test-bot-token',
  aggregatorChannel: '@test-channel',
  sourceChannels: ['@channel1', '@channel2'],
  logLevel: 'info',
  fetchMode: 'polling',
  pollIntervalMs: 300000,
  channelStateFile: 'test-state.json',
};

const mockForwardFn = vi.fn();

const mockLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('startPolling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should skip forwarding on first run for a channel', async () => {
    (loadState as any).mockReturnValue({});
    (fetchChannelPosts as any).mockResolvedValue({
      postIds: [100, 99],
      channelUsername: 'channel1',
    });

    const scheduler = startPolling(mockConfig, mockForwardFn, mockLogger);

    await sleep(500);

    expect(mockForwardFn).not.toHaveBeenCalled();
    expect(saveState).toHaveBeenCalledWith(
      'test-state.json',
      expect.objectContaining({ channel1: { lastMessageId: 100 } }),
      mockLogger,
    );

    scheduler.stop();
  });

  it('should forward new messages on subsequent runs', async () => {
    (loadState as any).mockReturnValue({
      channel1: { lastMessageId: 100 },
      channel2: { lastMessageId: 200 },
    });
    (fetchChannelPosts as any)
      .mockResolvedValueOnce({
        postIds: [102, 101, 100],
        channelUsername: 'channel1',
      })
      .mockResolvedValueOnce({
        postIds: [201, 200],
        channelUsername: 'channel2',
      });

    const scheduler = startPolling(mockConfig, mockForwardFn, mockLogger);

    await sleep(5000);

    expect(mockForwardFn).toHaveBeenCalledTimes(3);
    expect(mockForwardFn).toHaveBeenNthCalledWith(1, { chatId: '@channel1', messageId: 101 });
    expect(mockForwardFn).toHaveBeenNthCalledWith(2, { chatId: '@channel1', messageId: 102 });
    expect(mockForwardFn).toHaveBeenNthCalledWith(3, { chatId: '@channel2', messageId: 201 });

    scheduler.stop();
  }, 15000);

  it('should save state after each channel with new posts', async () => {
    (loadState as any).mockReturnValue({
      channel1: { lastMessageId: 100 },
      channel2: { lastMessageId: 200 },
    });
    (fetchChannelPosts as any)
      .mockResolvedValueOnce({
        postIds: [101, 100],
        channelUsername: 'channel1',
      })
      .mockResolvedValueOnce({
        postIds: [201, 200],
        channelUsername: 'channel2',
      });

    const scheduler = startPolling(mockConfig, mockForwardFn, mockLogger);

    await sleep(5000);

    expect(saveState).toHaveBeenCalledTimes(2);

    scheduler.stop();
  }, 15000);

  it('should handle fetch errors gracefully and continue to next channel', async () => {
    (loadState as any).mockReturnValue({
      channel1: { lastMessageId: 100 },
      channel2: { lastMessageId: 200 },
    });
    (fetchChannelPosts as any)
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({
        postIds: [201, 200],
        channelUsername: 'channel2',
      });

    const scheduler = startPolling(mockConfig, mockForwardFn, mockLogger);

    await sleep(5000);

    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('Error polling'),
    );
    expect(mockForwardFn).toHaveBeenCalledWith({ chatId: '@channel2', messageId: 201 });

    scheduler.stop();
  }, 15000);

  it('should handle forward errors by logging and continuing', async () => {
    mockForwardFn.mockRejectedValueOnce(new Error('Forward failed'));
    (loadState as any).mockReturnValue({
      channel1: { lastMessageId: 100 },
      channel2: { lastMessageId: 200 },
    });
    (fetchChannelPosts as any)
      .mockResolvedValueOnce({
        postIds: [101, 100],
        channelUsername: 'channel1',
      })
      .mockResolvedValueOnce({
        postIds: [200],
        channelUsername: 'channel2',
      });

    const scheduler = startPolling(mockConfig, mockForwardFn, mockLogger);

    await sleep(5000);

    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('Failed to forward'),
    );
    expect(mockForwardFn).toHaveBeenCalledTimes(1);

    scheduler.stop();
  }, 15000);

  it('should stop polling when stop is called', async () => {
    (loadState as any).mockReturnValue({});
    const scheduler = startPolling(mockConfig, mockForwardFn, mockLogger);

    scheduler.stop();

    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.stringContaining('Polling scheduler stopped'),
    );
  });

  it('should skip channels with no posts', async () => {
    (loadState as any).mockReturnValue({
      channel1: { lastMessageId: 100 },
      channel2: { lastMessageId: 200 },
    });
    (fetchChannelPosts as any)
      .mockResolvedValueOnce({
        postIds: [],
        channelUsername: 'channel1',
      })
      .mockResolvedValueOnce({
        postIds: [201, 200],
        channelUsername: 'channel2',
      });

    const scheduler = startPolling(mockConfig, mockForwardFn, mockLogger);

    await sleep(5000);

    expect(mockForwardFn).toHaveBeenCalledTimes(1);
    expect(mockForwardFn).toHaveBeenCalledWith({ chatId: '@channel2', messageId: 201 });

    scheduler.stop();
  }, 15000);
});