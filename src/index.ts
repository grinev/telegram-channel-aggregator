import { config } from './config.js';
import { createLogger } from './shared/logger.js';
import { createConsumerBot } from './consumer/bot.js';
import { startPolling } from './poller/scheduler.js';

async function main(): Promise<void> {
  const logger = createLogger(config.logLevel);
  const stateCache = new Map<string, number>();

  logger.info('Starting Telegram Channel Aggregator...');

  const { forward, start, stop } = createConsumerBot(config, logger, stateCache);
  const scheduler = startPolling(config, forward, logger, stateCache);

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
}

main().catch((error) => {
  const logger = createLogger(config.logLevel);
  logger.error(`Fatal error: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
