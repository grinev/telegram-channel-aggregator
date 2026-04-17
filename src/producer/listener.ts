import type { TelegramClient } from 'telegram';
import { NewMessage, NewMessageEvent } from 'telegram/events';
import type { MessageDispatch } from '../shared/types.js';
import type { Logger } from '../shared/logger.js';

export function setupMessageListener(
  client: TelegramClient,
  sourceChannels: string[],
  logger: Logger,
  dispatchFn: (dispatch: MessageDispatch) => void | Promise<void>,
): void {
  async function handler(event: NewMessageEvent): Promise<void> {
    const message = event.message;

    if (!message.post) {
      return;
    }

    try {
      const chatId = message.chatId?.toNumber() ?? 0;
      const messageId = message.id;

      logger.info(`New post detected: channel=${chatId}, message=${messageId}`);

      await dispatchFn({ chatId, messageId });
    } catch (error) {
      logger.error(
        `Failed to dispatch message: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  client.addEventHandler(handler, new NewMessage({ chats: sourceChannels }));

  logger.info(`Message listener registered for ${sourceChannels.length} channel(s)`);
}
