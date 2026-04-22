import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchChannelPosts, parsePostIds } from '../../src/poller/channel-fetcher.js';

const mockLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

describe('parsePostIds', () => {
  it('should extract post IDs from HTML with data-post attributes', () => {
    const html = `
      <div class="tgme_widget_message" data-post="durov/471">message 1</div>
      <div class="tgme_widget_message" data-post="durov/472">message 2</div>
      <div class="tgme_widget_message" data-post="durov/473">message 3</div>
    `;

    const ids = parsePostIds(html);

    expect(ids).toEqual([473, 472, 471]);
  });

  it('should return empty array when no posts found', () => {
    const html = '<html><body>No posts here</body></html>';

    const ids = parsePostIds(html);

    expect(ids).toEqual([]);
  });

  it('should handle HTML with mixed content', () => {
    const html = `
      <div class="tgme_widget_message_wrap"><div class="tgme_widget_message" data-post="channel_name/42">content</div></div>
      <div class="tgme_widget_message_wrap"><div class="tgme_widget_message" data-post="channel_name/43">content</div></div>
      <div>some other div</div>
    `;

    const ids = parsePostIds(html);

    expect(ids).toEqual([43, 42]);
  });

  it('should ignore non-numeric IDs', () => {
    const html = `
      <div data-post="channel/abc">msg</div>
      <div data-post="channel/100">msg</div>
    `;

    const ids = parsePostIds(html);

    expect(ids).toEqual([100]);
  });

  it('should limit to 5 newest posts', () => {
    const html = Array.from(
      { length: 10 },
      (_, i) => `<div class="tgme_widget_message" data-post="ch/${i + 1}">${i + 1}</div>`,
    ).join('\n');

    const ids = parsePostIds(html);

    expect(ids).toEqual([10, 9, 8, 7, 6]);
    expect(ids.length).toBe(5);
  });
});

describe('fetchChannelPosts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch posts from t.me/s/ and return IDs', async () => {
    const html = `
      <div class="tgme_widget_message" data-post="testchannel/10">msg1</div>
      <div class="tgme_widget_message" data-post="testchannel/11">msg2</div>
    `;

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(html),
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await fetchChannelPosts('testchannel', mockLogger);

    expect(result.postIds).toEqual([11, 10]);
    expect(result.channelUsername).toBe('testchannel');
    expect(mockFetch).toHaveBeenCalledWith(
      'https://t.me/s/testchannel',
      expect.objectContaining({
        signal: expect.any(AbortSignal),
      }),
    );

    vi.restoreAllMocks();
  });

  it('should return empty array when no posts found', async () => {
    const html = '<html><body>No posts</body></html>';

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(html),
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await fetchChannelPosts('empty_channel', mockLogger);

    expect(result.postIds).toEqual([]);
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('No posts found'),
    );

    vi.restoreAllMocks();
  });

  it('should throw on HTTP error', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      text: () => Promise.resolve('Not found'),
    });
    vi.stubGlobal('fetch', mockFetch);

    await expect(fetchChannelPosts('nonexistent', mockLogger)).rejects.toThrow('HTTP 404');
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('Failed to fetch'),
    );

    vi.restoreAllMocks();
  });

  it('should throw on network error', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'));
    vi.stubGlobal('fetch', mockFetch);

    await expect(fetchChannelPosts('testchannel', mockLogger)).rejects.toThrow('Network error');
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('Failed to fetch'),
    );

    vi.restoreAllMocks();
  });

  it('should log fetched post count', async () => {
    const html = `
      <div class="tgme_widget_message" data-post="mychannel/5">msg</div>
      <div class="tgme_widget_message" data-post="mychannel/6">msg</div>
      <div class="tgme_widget_message" data-post="mychannel/7">msg</div>
    `;

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(html),
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await fetchChannelPosts('mychannel', mockLogger);

    expect(result.postIds).toEqual([7, 6, 5]);
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.stringContaining('Fetched 3 post(s)'),
    );

    vi.restoreAllMocks();
  });
});