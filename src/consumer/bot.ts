import { Bot, GrammyError } from 'grammy';
import type { AppConfig, MessageDispatch } from '../shared/types.js';
import type { Logger } from '../shared/logger.js';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createConsumerBot(
  config: AppConfig,
  logger: Logger,
): { forward: (dispatch: MessageDispatch) => Promise<void> } {
  const bot = new Bot(config.botToken);

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

  return { forward };
}
