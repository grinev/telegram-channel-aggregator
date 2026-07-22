import type { Logger } from '../shared/logger.js';
import type { ChannelPost, FetchResult } from '../shared/types.js';

export type { FetchResult };

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
    const posts = parsePosts(html, channelUsername);
    const postIds = posts.map((p) => p.id);

    if (postIds.length === 0) {
      logger.warn(`No posts found in ${channelUsername}`);
    } else {
      logger.info(
        `Fetched ${postIds.length} post(s) from ${channelUsername}: ${postIds.join(', ')}`,
      );
    }

    return { postIds, posts, channelUsername };
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

export function parsePosts(html: string, channelUsername: string): ChannelPost[] {
  const cleanChannel = channelUsername.replace(/^@/, '').toLowerCase();

  const postRegex = /data-post="([^"/]+)\/(\d+)"/g;
  const postPositions: Array<{ channel: string; id: number; index: number }> = [];
  let match: RegExpExecArray | null;

  while ((match = postRegex.exec(html)) !== null) {
    const id = parseInt(match[2], 10);
    if (!isNaN(id)) {
      postPositions.push({ channel: match[1], id, index: match.index });
    }
  }

  if (postPositions.length === 0) {
    const ids = parsePostIds(html);
    return ids.map((id) => ({ id, dedupKey: cleanChannel ? `${cleanChannel}:${id}` : `${id}` }));
  }

  const posts: ChannelPost[] = [];
  const seenIds = new Set<number>();

  for (let i = 0; i < postPositions.length; i++) {
    const current = postPositions[i];
    if (seenIds.has(current.id)) {
      continue;
    }
    seenIds.add(current.id);

    const startIndex = current.index;
    const endIndex = i < postPositions.length - 1 ? postPositions[i + 1].index : html.length;
    const blockHtml = html.substring(startIndex, endIndex);

    const fwdMatch =
      /class="tgme_widget_message_forwarded_from_name"[^>]*href="https:\/\/t\.me\/([^/]+)\/(\d+)"/i.exec(
        blockHtml,
      ) ||
      /href="https:\/\/t\.me\/([^/]+)\/(\d+)"[^>]*class="tgme_widget_message_forwarded_from_name"/i.exec(
        blockHtml,
      );

    let dedupKey: string;
    if (fwdMatch) {
      dedupKey = `${fwdMatch[1].toLowerCase()}:${fwdMatch[2]}`;
    } else {
      dedupKey = `${cleanChannel}:${current.id}`;
    }

    posts.push({ id: current.id, dedupKey });
  }

  return posts.sort((a, b) => b.id - a.id).slice(0, 10);
}
