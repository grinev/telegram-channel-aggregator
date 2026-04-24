import { config } from './config.js';
import { createLogger } from './shared/logger.js';
import { createConsumerBot } from './consumer/bot.js';
import { startPolling } from './poller/scheduler.js';

async function main(): Promise<void> {
  const logger = createLogger(config.logLevel);

  logger.info('Starting Telegram Channel Aggregator...');
  logger.info(`Fetch mode: ${config.fetchMode}`);

  if (config.fetchMode === 'polling') {
    const { forward, start, stop } = createConsumerBot(config, logger);
    const scheduler = startPolling(config, forward, logger);

    start();

    async function shutdown(signal: string): Promise<void> {
      logger.info(`Received ${signal}, shutting down...`);
      scheduler.stop();
      stop();
      process.exit(0);
    }

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

    logger.info('Aggregator is running in polling mode. Press Ctrl+C to stop.');
  } else {
    const { createProducerClient } = await import('./producer/client.js');
    const { setupMessageListener } = await import('./producer/listener.js');

    const { client, disconnect } = await createProducerClient(config, logger);
    const { forward } = createConsumerBot(config, logger);

    const { loadChannels: loadChannelsFn } = await import('./poller/whitelist-store.js');
    const sourceChannels = loadChannelsFn(config.channelsFile, logger);
    setupMessageListener(client, sourceChannels, logger, forward);

    async function shutdown(signal: string): Promise<void> {
      logger.info(`Received ${signal}, shutting down...`);
      await disconnect();
      process.exit(0);
    }

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

    logger.info('Aggregator is running in event mode. Press Ctrl+C to stop.');
  }
}

main().catch((error) => {
  const logger = createLogger(config.logLevel);
  logger.error(`Fatal error: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
