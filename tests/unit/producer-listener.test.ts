import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setupMessageListener } from '../../src/producer/listener.js';

const mockAddEventHandler = vi.fn();

const mockClient = {
  addEventHandler: mockAddEventHandler,
} as any;

const mockLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

const mockDispatchFn = vi.fn();

const sourceChannels = ['@channel1', '@channel2'];

describe('setupMessageListener', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should register event handler with NewMessage and source channels', () => {
    setupMessageListener(mockClient, sourceChannels, mockLogger, mockDispatchFn);

    expect(mockAddEventHandler).toHaveBeenCalledTimes(1);

    const [handler, eventBuilder] = mockAddEventHandler.mock.calls[0];

    expect(typeof handler).toBe('function');
    expect(eventBuilder).toBeDefined();
  });

  it('should log registration message', () => {
    setupMessageListener(mockClient, sourceChannels, mockLogger, mockDispatchFn);

    expect(mockLogger.info).toHaveBeenCalledWith('Message listener registered for 2 channel(s)');
  });

  it('should dispatch valid channel post', async () => {
    setupMessageListener(mockClient, sourceChannels, mockLogger, mockDispatchFn);

    const [handler] = mockAddEventHandler.mock.calls[0];

    const mockEvent = {
      message: {
        post: true,
        chatId: { toNumber: () => -1001234567890 },
        id: 42,
      },
    };

    await handler(mockEvent);

    expect(mockDispatchFn).toHaveBeenCalledWith({
      chatId: -1001234567890,
      messageId: 42,
    });

    expect(mockLogger.info).toHaveBeenCalledWith(
      'New post detected: channel=-1001234567890, message=42',
    );
  });

  it('should ignore non-post messages', async () => {
    setupMessageListener(mockClient, sourceChannels, mockLogger, mockDispatchFn);

    const [handler] = mockAddEventHandler.mock.calls[0];

    const mockEvent = {
      message: {
        post: false,
        chatId: { toNumber: () => 12345 },
        id: 10,
      },
    };

    await handler(mockEvent);

    expect(mockDispatchFn).not.toHaveBeenCalled();
  });

  it('should handle dispatch errors gracefully', async () => {
    mockDispatchFn.mockRejectedValue(new Error('Dispatch failed'));

    setupMessageListener(mockClient, sourceChannels, mockLogger, mockDispatchFn);

    const [handler] = mockAddEventHandler.mock.calls[0];

    const mockEvent = {
      message: {
        post: true,
        chatId: { toNumber: () => -1001234567890 },
        id: 42,
      },
    };

    await handler(mockEvent);

    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('Failed to dispatch message'),
    );
  });

  it('should handle undefined chatId', async () => {
    setupMessageListener(mockClient, sourceChannels, mockLogger, mockDispatchFn);

    const [handler] = mockAddEventHandler.mock.calls[0];

    const mockEvent = {
      message: {
        post: true,
        chatId: undefined,
        id: 42,
      },
    };

    await handler(mockEvent);

    expect(mockDispatchFn).toHaveBeenCalledWith({
      chatId: 0,
      messageId: 42,
    });
  });
});
