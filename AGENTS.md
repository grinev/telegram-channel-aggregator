# AGENTS.md

## Project Overview

Telegram Channel Aggregator — a real-time service that monitors new posts from specified Telegram channels and automatically forwards them to a single aggregator channel using a Producer-Consumer architecture.

## Tech Stack

- **Language:** TypeScript (Node.js)
- **Reader (MTProto):** GramJS (`telegram` npm package) — user client for reading
- **Writer (Bot API):** grammY (`grammy` npm package) — bot client for publishing
- **Runtime:** Node.js (ts-node for development, compiled JS for production)

## Architecture

Single-process Producer-Consumer pattern:

1. **Reader / Producer** — authenticates via StringSession, subscribes to source channels, receives NewMessage events via MTProto, passes `message_id` + `chat_id` to the Writer.
2. **Writer / Consumer** — authenticates via Bot token, forwards messages to the aggregator channel using `forwardMessage`.

## Commands

```bash
# Install dependencies
npm install

# Development (run with ts-node)
npm run dev

# Build
npm run build

# Start (production)
npm start

# Lint
npm run lint

# Type check
npm run typecheck

# Test
npm run test

# Test (watch mode)
npm run test:watch

# Test with coverage
npm run test:coverage
```

## Code Style

- TypeScript strict mode enabled
- No comments unless explicitly requested
- Use `async/await` over `.then()` chains
- Prefer `const` over `let`; never use `var`
- Use descriptive variable names in English
- Error handling: always wrap `await` calls in try/catch, log errors via the logging utility, never silently swallow errors
- All strings and logs in English (code); PRODUCT.md and user-facing docs in Russian

## Project Structure

```
src/
  index.ts            # Entry point: boot both Producer and Consumer
  config.ts            # Load and validate env vars from .env
  producer/
    client.ts          # GramJS client init, StringSession auth
    listener.ts        # NewMessage event handler, dispatch to consumer
  consumer/
    bot.ts             # grammY bot init, forwardMessage logic
  shared/
    logger.ts          # Logging utility
    types.ts           # Shared TypeScript interfaces/types
tests/
  unit/                # Unit tests for isolated modules
  integration/         # Integration tests with mocked Telegram APIs
```

## Environment Variables

All config via `.env`:

| Variable                      | Description                                          |
| ----------------------------- | ---------------------------------------------------- |
| `TELEGRAM_API_ID`             | Telegram API ID (from my.telegram.org)               |
| `TELEGRAM_API_HASH`           | Telegram API Hash (from my.telegram.org)             |
| `TELEGRAM_STRING_SESSION`     | StringSession for the reader account                 |
| `TELEGRAM_BOT_TOKEN`          | Bot token for the writer (from @BotFather)           |
| `TELEGRAM_AGGREGATOR_CHANNEL` | Target aggregator channel (username or ID)           |
| `SOURCE_CHANNELS`             | Comma-separated list of source channel usernames/IDs |
| `LOG_LEVEL`                   | Logging level (default: `info`)                      |

## Key Implementation Details

- **forwardMessage** is used for publishing (preserves original author attribution)
- Source channels are configured in `.env` as a comma-separated list (must match the technical account's subscriptions)
- The Reader connects via MTProto and listens for `NewMessage` events only from the configured source channels
- The Writer receives dispatches and calls `forwardMessage` to the aggregator channel
- Single aggregator channel — all posts from all sources go to one destination
- No post filtering — every new post from source channels is forwarded

## Testing

- **Framework:** Vitest (native TypeScript + ESM support)
- **Test location:** `tests/` directory with `.test.ts` suffix
- **Structure:** `tests/unit/` for isolated module tests, `tests/integration/` for integration tests with mocked Telegram APIs
- **Happy-path focus:** Tests verify successful scenarios first, then edge cases
- **Mocking:** Use `vi.mock()` for external dependencies (GramJS, grammY, Telegram API)
- **No real API calls:** All tests must run without network access or real credentials

## Git Conventions

- Commit messages in English, imperative mood (`add feature`, `fix bug`)
- No commits of `.env` or secrets
