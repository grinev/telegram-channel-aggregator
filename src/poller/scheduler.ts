import type {
  MessageDispatch,
  AppConfig,
  ChannelPost,
  ChannelStateEntry,
} from '../shared/types.js';
import type { Logger } from '../shared/logger.js';
import { loadState, saveState } from './state-store.js';
import { loadChannels } from './whitelist-store.js';
import { fetchChannelPosts } from './channel-fetcher.js';
import { Deduplicator } from './deduplicator.js';

function getRandomDelay(minMs: number, maxMs: number): number {
  return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
}

export interface PollingScheduler {
  stop: () => void;
}

export function startPolling(
  config: AppConfig,
  forwardFn: (dispatch: MessageDispatch) => void | Promise<void>,
  logger: Logger,
  stateCache?: Map<string, number>,
): PollingScheduler {
  const state = loadState(config.channelStateFile, logger);
  const initialKeys = Array.isArray(state._recentKeys) ? state._recentKeys : [];
  const deduplicator = new Deduplicator(10, initialKeys);
  let isRunning = false;

  async function runCycle(): Promise<void> {
    if (isRunning) {
      logger.warn('Previous polling cycle is still running, skipping');
      return;
    }

    isRunning = true;
    logger.info('Starting polling cycle...');

    if (stateCache && stateCache.size > 0) {
      for (const [channel, lastMessageId] of stateCache.entries()) {
        state[channel] = { lastMessageId };
        logger.info(`Merged cached state for @${channel}: lastMessageId=${lastMessageId}`);
      }
    }

    const sourceChannels = loadChannels(config.channelsFile, logger);

    if (sourceChannels.length === 0) {
      logger.warn('No channels configured, skipping polling cycle');
      isRunning = false;
      return;
    }

    const activeChannels = new Set(sourceChannels.map((ch) => ch.replace(/^@/, '')));
    const removedChannels: string[] = [];
    for (const channel of Object.keys(state)) {
      if (channel === '_recentKeys') {
        continue;
      }
      if (!activeChannels.has(channel)) {
        delete state[channel];
        removedChannels.push(channel);
      }
    }
    if (removedChannels.length > 0) {
      logger.info(
        `Removed ${removedChannels.length} channel(s) from state: ${removedChannels.join(', ')}`,
      );
      state._recentKeys = deduplicator.getKeys();
      saveState(config.channelStateFile, state, logger);
    }

    try {
      for (const channel of sourceChannels) {
        const cleanChannel = channel.replace(/^@/, '');

        try {
          const entry = state[cleanChannel];
          const lastMessageId =
            entry && typeof entry === 'object' && 'lastMessageId' in entry
              ? (entry as ChannelStateEntry).lastMessageId
              : 0;

          const result = await fetchChannelPosts(cleanChannel, logger);

          if (result.postIds.length === 0) {
            continue;
          }

          const latestId = Math.max(...result.postIds);

          if (!lastMessageId || lastMessageId === 0) {
            logger.info(`First run for @${cleanChannel}, saving latest post ID: ${latestId}`);
            state[cleanChannel] = { lastMessageId: latestId };
            state._recentKeys = deduplicator.getKeys();
            saveState(config.channelStateFile, state, logger);
            if (stateCache) {
              stateCache.delete(cleanChannel);
            }
            continue;
          }

          const posts: ChannelPost[] =
            result.posts && result.posts.length > 0
              ? result.posts
              : result.postIds.map((id) => ({ id, dedupKey: `${cleanChannel}:${id}` }));

          const newPosts = posts.filter((p) => p.id > lastMessageId).sort((a, b) => a.id - b.id);

          if (newPosts.length > 0) {
            const postsToForward: ChannelPost[] = [];
            for (const post of newPosts) {
              if (deduplicator.isDuplicate(post.dedupKey)) {
                logger.info(
                  `Skipping duplicate post ${post.id} from @${cleanChannel} (key: ${post.dedupKey})`,
                );
              } else {
                postsToForward.push(post);
              }
            }

            if (postsToForward.length > 0) {
              const idsToForward = postsToForward.map((p) => p.id);
              try {
                await sleep(config.forwardDelayMs);
                await forwardFn({ chatId: `@${cleanChannel}`, messageIds: idsToForward });
                for (const post of postsToForward) {
                  deduplicator.add(post.dedupKey);
                }
              } catch (error) {
                logger.error(
                  `Failed to forward post(s) [${idsToForward.join(', ')}] from @${cleanChannel}: ${error instanceof Error ? error.message : String(error)}`,
                );
              }
            }
          }

          if (latestId > lastMessageId) {
            state[cleanChannel] = { lastMessageId: latestId };
            state._recentKeys = deduplicator.getKeys();
            saveState(config.channelStateFile, state, logger);
          }

          if (stateCache) {
            stateCache.delete(cleanChannel);
          }

          await sleep(
            getRandomDelay(config.delayBetweenChannelsMinMs, config.delayBetweenChannelsMaxMs),
          );
        } catch (error) {
          logger.error(
            `Error polling @${cleanChannel}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
    } finally {
      isRunning = false;
    }

    logger.info('Polling cycle completed');
  }

  runCycle().catch((error) => {
    logger.error(
      `Failed to run initial polling cycle: ${error instanceof Error ? error.message : String(error)}`,
    );
  });

  const intervalId = setInterval(() => {
    runCycle().catch((error) => {
      logger.error(
        `Failed to run polling cycle: ${error instanceof Error ? error.message : String(error)}`,
      );
    });
  }, config.pollIntervalMs);

  return {
    stop: () => {
      clearInterval(intervalId);
      logger.info('Polling scheduler stopped');
    },
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
