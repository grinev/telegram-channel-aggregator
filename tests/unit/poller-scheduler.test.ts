import { describe, it, expect, vi, beforeEach } from 'vitest';
import { startPolling } from '../../src/poller/scheduler.js';

vi.mock('../../src/poller/state-store.js', () => ({
  loadState: vi.fn(),
  saveState: vi.fn(),
}));

vi.mock('../../src/poller/channel-fetcher.js', () => ({
  fetchChannelPosts: vi.fn(),
}));

vi.mock('../../src/poller/whitelist-store.js', () => ({
  loadChannels: vi.fn(),
}));

const { loadState, saveState } = await import('../../src/poller/state-store.js');
const { fetchChannelPosts } = await import('../../src/poller/channel-fetcher.js');
const { loadChannels } = await import('../../src/poller/whitelist-store.js');

const mockConfig = {
  botToken: 'test-bot-token',
  aggregatorChannel: '@test-channel',
  allowedUserIds: [12345],
  channelsFile: 'channels.txt',
  logLevel: 'info',
  fetchMode: 'polling',
  pollIntervalMs: 300000,
  channelStateFile: 'test-state.json',
  delayBetweenChannelsMinMs: 0,
  delayBetweenChannelsMaxMs: 0,
  forwardDelayMs: 0,
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
    vi.spyOn(global.Math, 'random').mockReturnValue(0);
    (loadChannels as any).mockReturnValue(['channel1', 'channel2']);
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

    expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Error polling'));
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

    expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Failed to forward'));
    expect(mockForwardFn).toHaveBeenCalledTimes(1);

    scheduler.stop();
  }, 15000);

  it('should stop polling when stop is called', async () => {
    (loadState as any).mockReturnValue({});
    const scheduler = startPolling(mockConfig, mockForwardFn, mockLogger);

    scheduler.stop();

    expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Polling scheduler stopped'));
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

  it('should read channels from whitelist store on each cycle', async () => {
    (loadState as any).mockReturnValue({});
    (fetchChannelPosts as any).mockResolvedValue({
      postIds: [100],
      channelUsername: 'channel1',
    });

    const scheduler = startPolling(mockConfig, mockForwardFn, mockLogger);

    await sleep(500);

    expect(loadChannels).toHaveBeenCalledWith('channels.txt', mockLogger);

    scheduler.stop();
  });

  it('should skip cycle when no channels configured', async () => {
    (loadChannels as any).mockReturnValue([]);
    (loadState as any).mockReturnValue({});

    const scheduler = startPolling(mockConfig, mockForwardFn, mockLogger);

    await sleep(500);

    expect(mockLogger.warn).toHaveBeenCalledWith(
      'No channels configured, skipping polling cycle',
    );
    expect(fetchChannelPosts).not.toHaveBeenCalled();
    expect(mockForwardFn).not.toHaveBeenCalled();

    scheduler.stop();
  });

  it('should merge cached state into loaded state', async () => {
    (loadState as any).mockReturnValue({});
    (loadChannels as any).mockReturnValue(['cachedchannel']);
    (fetchChannelPosts as any).mockResolvedValue({
      postIds: [200, 150],
      channelUsername: 'cachedchannel',
    });

    const stateCache = new Map([['cachedchannel', 150]]);
    const scheduler = startPolling(mockConfig, mockForwardFn, mockLogger, stateCache);

    await sleep(5000);

    expect(mockForwardFn).toHaveBeenCalledWith({ chatId: '@cachedchannel', messageId: 200 });
    expect(saveState).toHaveBeenCalledWith(
      'test-state.json',
      expect.objectContaining({ cachedchannel: { lastMessageId: 200 } }),
      mockLogger,
    );

    scheduler.stop();
  }, 15000);

  it('should clear cache entries after processing', async () => {
    (loadState as any).mockReturnValue({});
    (loadChannels as any).mockReturnValue(['cachedchannel']);
    (fetchChannelPosts as any).mockResolvedValue({
      postIds: [100],
      channelUsername: 'cachedchannel',
    });

    const stateCache = new Map([['cachedchannel', 50]]);
    const scheduler = startPolling(mockConfig, mockForwardFn, mockLogger, stateCache);

    await sleep(5000);

    expect(stateCache.has('cachedchannel')).toBe(false);

    scheduler.stop();
  }, 15000);

  it('should remove stale channels from state', async () => {
    (loadState as any).mockReturnValue({
      activechannel: { lastMessageId: 100 },
      removedchannel: { lastMessageId: 200 },
    });
    (loadChannels as any).mockReturnValue(['activechannel']);
    (fetchChannelPosts as any).mockResolvedValue({
      postIds: [101, 100],
      channelUsername: 'activechannel',
    });

    const scheduler = startPolling(mockConfig, mockForwardFn, mockLogger);

    await sleep(5000);

    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.stringContaining('Removed 1 channel(s) from state: removedchannel'),
    );
    expect(saveState).toHaveBeenCalledWith(
      'test-state.json',
      expect.objectContaining({ activechannel: { lastMessageId: 101 } }),
      mockLogger,
    );
    expect(saveState).not.toHaveBeenCalledWith(
      'test-state.json',
      expect.objectContaining({ removedchannel: expect.anything() }),
      mockLogger,
    );

    scheduler.stop();
  }, 15000);

  it('should apply forward delay between consecutive forwards', async () => {
    vi.useFakeTimers();
    const testConfig = { ...mockConfig, forwardDelayMs: 1200 };
    (loadState as any).mockReturnValue({
      channel1: { lastMessageId: 100 },
    });
    (loadChannels as any).mockReturnValue(['channel1']);
    (fetchChannelPosts as any).mockResolvedValue({
      postIds: [103, 102, 101],
      channelUsername: 'channel1',
    });

    const scheduler = startPolling(testConfig, mockForwardFn, mockLogger);

    await vi.advanceTimersByTimeAsync(0);
    expect(mockForwardFn).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(testConfig.forwardDelayMs);
    expect(mockForwardFn).toHaveBeenCalledTimes(1);
    expect(mockForwardFn).toHaveBeenNthCalledWith(1, {
      chatId: '@channel1',
      messageId: 101,
    });

    await vi.advanceTimersByTimeAsync(testConfig.forwardDelayMs);
    expect(mockForwardFn).toHaveBeenCalledTimes(2);
    expect(mockForwardFn).toHaveBeenNthCalledWith(2, {
      chatId: '@channel1',
      messageId: 102,
    });

    await vi.advanceTimersByTimeAsync(testConfig.forwardDelayMs);
    expect(mockForwardFn).toHaveBeenCalledTimes(3);
    expect(mockForwardFn).toHaveBeenNthCalledWith(3, {
      chatId: '@channel1',
      messageId: 103,
    });

    scheduler.stop();
    vi.useRealTimers();
  });

  it('should use random delay between channels based on config', async () => {
    vi.useFakeTimers();
    const randomSpy = vi.spyOn(global.Math, 'random').mockReturnValue(0.5);
    const testConfig = {
      ...mockConfig,
      delayBetweenChannelsMinMs: 2000,
      delayBetweenChannelsMaxMs: 5000,
      forwardDelayMs: 0,
    };

    (loadState as any).mockReturnValue({
      channel1: { lastMessageId: 100 },
      channel2: { lastMessageId: 200 },
    });
    (loadChannels as any).mockReturnValue(['channel1', 'channel2']);
    (fetchChannelPosts as any)
      .mockResolvedValueOnce({
        postIds: [101, 100],
        channelUsername: 'channel1',
      })
      .mockResolvedValueOnce({
        postIds: [201, 200],
        channelUsername: 'channel2',
      });

    const expectedDelay = Math.floor(
      0.5 *
        (testConfig.delayBetweenChannelsMaxMs -
          testConfig.delayBetweenChannelsMinMs +
          1),
    ) + testConfig.delayBetweenChannelsMinMs;

    const scheduler = startPolling(testConfig, mockForwardFn, mockLogger);

    await vi.advanceTimersByTimeAsync(0);
    expect(fetchChannelPosts).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(testConfig.forwardDelayMs);
    expect(mockForwardFn).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(expectedDelay);
    expect(fetchChannelPosts).toHaveBeenCalledTimes(2);

    scheduler.stop();
    randomSpy.mockReturnValue(0);
    vi.useRealTimers();
  });
});
