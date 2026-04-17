import { config } from './config.js';
import { createLogger } from './shared/logger.js';
import { createProducerClient } from './producer/client.js';
import { setupMessageListener } from './producer/listener.js';
import { createConsumerBot } from './consumer/bot.js';

async function main(): Promise<void> {
  const logger = createLogger(config.logLevel);

  logger.info('Starting Telegram Channel Aggregator...');

  try {
    const { client, disconnect } = await createProducerClient(config, logger);
    const { forward } = createConsumerBot(config, logger);

    setupMessageListener(client, config.sourceChannels, logger, forward);

    async function shutdown(signal: string): Promise<void> {
      logger.info(`Received ${signal}, shutting down...`);
      await disconnect();
      process.exit(0);
    }

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

    logger.info('Aggregator is running. Press Ctrl+C to stop.');
  } catch (error) {
    logger.error(`Fatal error: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

main();
