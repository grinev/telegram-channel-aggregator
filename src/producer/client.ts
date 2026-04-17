import { TelegramClient } from 'telegram';
import { sessions } from 'telegram';
import type { AppConfig, ProducerClient } from '../shared/types.js';
import type { Logger } from '../shared/logger.js';

const CONNECTION_RETRIES = 5;
const RECONNECT_RETRIES = undefined;
const RETRY_DELAY = 1000;
const REQUEST_RETRIES = 5;

export async function createProducerClient(
  config: AppConfig,
  logger: Logger,
): Promise<ProducerClient> {
  const session = new sessions.StringSession(config.stringSession);

  const client = new TelegramClient(session, config.apiId, config.apiHash, {
    connectionRetries: CONNECTION_RETRIES,
    reconnectRetries: RECONNECT_RETRIES,
    retryDelay: RETRY_DELAY,
    requestRetries: REQUEST_RETRIES,
    autoReconnect: true,
  });

  logger.info('Connecting to Telegram...');

  try {
    await client.connect();

    if (!(await client.isUserAuthorized())) {
      throw new Error('StringSession is invalid or expired');
    }

    const me = await client.getMe();
    logger.info(`Connected as ${me.firstName} ${me.lastName ?? ''} (@${me.username ?? me.id})`);
  } catch (error) {
    logger.error(`Failed to connect: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }

  const disconnect = async (): Promise<void> => {
    logger.info('Disconnecting producer client...');
    await client.disconnect();
  };

  return { client, disconnect };
}
