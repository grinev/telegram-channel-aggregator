import type { Logger } from '../shared/logger.js';

export interface FetchResult {
  postIds: number[];
  channelUsername: string;
}

const FETCH_TIMEOUT_MS = 10000;
const DATA_POST_REGEX = /data-post="([^"]+\/(\d+))"/g;

export async function fetchChannelPosts(
  channelUsername: string,
  logger: Logger,
): Promise<FetchResult> {
  const url = `https://t.me/s/${channelUsername}`;

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    if (!response.ok) {
      logger.error(`Failed to fetch ${url}: HTTP ${response.status}`);
      throw new Error(`HTTP ${response.status} for ${url}`);
    }

    const html = await response.text();
    const postIds = parsePostIds(html);

    if (postIds.length === 0) {
      logger.warn(`No posts found in ${channelUsername}`);
    } else {
      logger.info(
        `Fetched ${postIds.length} post(s) from ${channelUsername}: ${postIds.join(', ')}`,
      );
    }

    return { postIds, channelUsername };
  } catch (error) {
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      logger.error(`Timeout fetching ${url}`);
      throw new Error(`Timeout fetching ${url}`, { cause: error });
    }

    logger.error(
      `Failed to fetch ${channelUsername}: ${error instanceof Error ? error.message : String(error)}`,
    );
    throw error;
  }
}

export function parsePostIds(html: string): number[] {
  const ids: number[] = [];
  let match: RegExpExecArray | null;

  while ((match = DATA_POST_REGEX.exec(html)) !== null) {
    const id = parseInt(match[2], 10);
    if (!isNaN(id)) {
      ids.push(id);
    }
  }

  DATA_POST_REGEX.lastIndex = 0;

  ids.sort((a, b) => b - a);

  return ids.slice(0, 5);
}
