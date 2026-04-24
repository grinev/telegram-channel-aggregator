import { Bot, GrammyError } from 'grammy';
import type { AppConfig, MessageDispatch } from '../shared/types.js';
import type { Logger } from '../shared/logger.js';
import { loadChannels, addChannel, removeChannel } from '../poller/whitelist-store.js';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createConsumerBot(
  config: AppConfig,
  logger: Logger,
): { forward: (dispatch: MessageDispatch) => Promise<void>; start: () => void; stop: () => void } {
  const bot = new Bot(config.botToken);

  function isAuthorized(userId: number): boolean {
    return config.allowedUserIds.includes(userId);
  }

  bot.command('add_channel', async (ctx) => {
    if (!ctx.from || !isAuthorized(ctx.from.id)) {
      logger.warn(`Access denied for user ${ctx.from?.id} on /add_channel`);
      await ctx.reply('Access denied.');
      return;
    }

    const arg = ctx.match?.trim();
    logger.info(`/add_channel command received from user ${ctx.from.id}, arg=${arg}`);

    if (!arg) {
      await ctx.reply('Usage: /add_channel @channel or /add_channel channel');
      return;
    }

    const channel = arg.replace(/^@/, '').trim();
    if (!channel) {
      await ctx.reply('Usage: /add_channel @channel or /add_channel channel');
      return;
    }

    try {
      logger.info(`Checking channel @${channel} via getChat...`);
      await bot.api.getChat(`@${channel}`);
    } catch (error) {
      logger.error(
        `getChat failed for @${channel}: ${error instanceof Error ? error.message : String(error)}`,
      );
      await ctx.reply(`Channel @${channel} not found or bot has no access.`);
      return;
    }

    try {
      logger.info(`Checking bot admin status in @${channel}...`);
      const member = await bot.api.getChatMember(`@${channel}`, bot.botInfo!.id);
      if (member.status !== 'administrator' && member.status !== 'creator') {
        logger.warn(`Bot is not admin in @${channel}, status=${member.status}`);
        await ctx.reply(`Bot is not an administrator in @${channel}.`);
        return;
      }
    } catch (error) {
      logger.error(
        `getChatMember failed for @${channel}: ${error instanceof Error ? error.message : String(error)}`,
      );
      await ctx.reply(`Failed to check bot status in @${channel}.`);
      return;
    }

    const added = addChannel(config.channelsFile, channel, logger);
    if (added) {
      logger.info(`Channel @${channel} added by user ${ctx.from.id}`);
      await ctx.reply(`@${channel} added to monitoring.`);
    } else {
      logger.info(`Channel @${channel} already in the list, user ${ctx.from.id}`);
      await ctx.reply(`@${channel} is already in the list.`);
    }
  });

  bot.command('remove_channel', async (ctx) => {
    if (!ctx.from || !isAuthorized(ctx.from.id)) {
      logger.warn(`Access denied for user ${ctx.from?.id} on /remove_channel`);
      await ctx.reply('Access denied.');
      return;
    }

    const arg = ctx.match?.trim();
    logger.info(`/remove_channel command received from user ${ctx.from.id}, arg=${arg}`);

    if (!arg) {
      await ctx.reply('Usage: /remove_channel @channel or /remove_channel channel');
      return;
    }

    const channel = arg.replace(/^@/, '').trim();
    if (!channel) {
      await ctx.reply('Usage: /remove_channel @channel or /remove_channel channel');
      return;
    }

    const removed = removeChannel(config.channelsFile, channel, logger);
    if (removed) {
      logger.info(`Channel @${channel} removed by user ${ctx.from.id}`);
      await ctx.reply(`@${channel} removed from monitoring.`);
    } else {
      logger.info(`Channel @${channel} not found in list, user ${ctx.from.id}`);
      await ctx.reply(`@${channel} is not in the list.`);
    }
  });

  bot.command('list_channels', async (ctx) => {
    if (!ctx.from || !isAuthorized(ctx.from.id)) {
      logger.warn(`Access denied for user ${ctx.from?.id} on /list_channels`);
      await ctx.reply('Access denied.');
      return;
    }

    logger.info(`/list_channels command received from user ${ctx.from.id}`);
    const channels = loadChannels(config.channelsFile, logger);
    logger.info(`Listed ${channels.length} channel(s) for user ${ctx.from.id}`);

    if (channels.length === 0) {
      await ctx.reply('No channels configured.');
      return;
    }

    const list = channels.map((ch, i) => `${i + 1}. @${ch}`).join('\n');
    await ctx.reply(`Channels (${channels.length}):\n${list}`);
  });

  async function forward(dispatch: MessageDispatch): Promise<void> {
    try {
      await bot.api.forwardMessage(config.aggregatorChannel, dispatch.chatId, dispatch.messageId);
      logger.info(`Forwarded: channel=${dispatch.chatId}, message=${dispatch.messageId}`);
    } catch (error) {
      if (error instanceof GrammyError) {
        const retryAfter = error.parameters?.retry_after;
        if (retryAfter) {
          logger.warn(`FloodWait: waiting ${retryAfter}s before retry...`);
          await sleep(retryAfter * 1000);
          return forward(dispatch);
        }
      }

      logger.error(`Failed to forward: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  function start(): void {
    bot.start({
      onStart: async (botInfo) => {
        await bot.api.setMyCommands([
          { command: 'add_channel', description: 'Add a channel to monitoring' },
          { command: 'remove_channel', description: 'Remove a channel from monitoring' },
          { command: 'list_channels', description: 'Show monitored channels' },
        ]);
        logger.info(`Bot started: @${botInfo.username}`);
      },
    });
  }

  function stop(): void {
    bot.stop();
    logger.info('Bot stopped');
  }

  return { forward, start, stop };
}
