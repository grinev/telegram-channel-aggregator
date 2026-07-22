import type { Logger } from '../shared/logger.js';

export interface FetchResult {
  postIds: number[];
  channelUsername: string;
}

const FETCH_TIMEOUT_MS = 10000;
const POST_ID_REGEX =
  /(?:data-post="[^"]+\/(\d+)"|href="https:\/\/t\.me\/[^/]+\/(\d+)(?:\?[^"]*)?")/gi;

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:127.0) Gecko/20100101 Firefox/127.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
];

function getRandomUserAgent(): string {
  const index = Math.floor(Math.random() * USER_AGENTS.length);
  return USER_AGENTS[index];
}

export async function fetchChannelPosts(
  channelUsername: string,
  logger: Logger,
): Promise<FetchResult> {
  const url = `https://t.me/s/${channelUsername}`;

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: {
        'User-Agent': getRandomUserAgent(),
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'max-age=0',
        'Upgrade-Insecure-Requests': '1',
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
  const ids = new Set<number>();
  let match: RegExpExecArray | null;

  while ((match = POST_ID_REGEX.exec(html)) !== null) {
    const idStr = match[1] ?? match[2];
    if (idStr) {
      const id = parseInt(idStr, 10);
      if (!isNaN(id)) {
        ids.add(id);
      }
    }
  }

  POST_ID_REGEX.lastIndex = 0;

  const sorted = Array.from(ids).sort((a, b) => b - a);

  return sorted.slice(0, 10);
}
