# Telegram Channel Aggregator

A service that monitors new posts from specified Telegram channels and automatically forwards them to a single aggregator channel using a lightweight HTTP polling approach.

## Features

- **No user account required** — works with just a bot token
- **Lightweight polling** — fetches public channel previews via HTTP every 15 minutes
- **Persistent state** — remembers the last forwarded post ID per channel
- **Smart forwarding** — only forwards new posts since the last check
- **First-run safe** — initializes state without flooding the aggregator

## Prerequisites

- Node.js 20+
- A Telegram bot (get a token from [@BotFather](https://t.me/BotFather))
- The bot must be added as an administrator to **all source channels** you want to monitor

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` with your values:

```env
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_AGGREGATOR_CHANNEL=@your_aggregator_channel
SOURCE_CHANNELS=@channel1,@channel2,@channel3
```

### 3. Run

```bash
# Development with auto-reload
npm run dev

# Production build
npm run build
npm start
```

## How It Works

The service uses **polling mode** (the default):

1. Every 15 minutes, it fetches the latest posts from each source channel via `https://t.me/s/{channel}`
2. Compares post IDs against a local JSON state file (`channel-state.json`)
3. Forwards only new posts to the aggregator channel via Bot API

### First Run Behavior

On the first run (no state file exists):
- The service fetches the latest posts from each channel
- Saves the highest post ID as the baseline
- **Does not forward anything**

On subsequent runs:
- Compares fetched posts against the saved baseline
- Forwards only posts with a higher ID
- Updates the baseline after forwarding

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `TELEGRAM_BOT_TOKEN` | Yes | — | Bot token from @BotFather |
| `TELEGRAM_AGGREGATOR_CHANNEL` | Yes | — | Target aggregator channel (username or ID) |
| `SOURCE_CHANNELS` | Yes | — | Comma-separated list of source channel usernames |
| `FETCH_MODE` | No | `polling` | Mode: `polling` or `event` |
| `POLL_INTERVAL_MS` | No | `300000` | Polling interval in milliseconds (15 min) |
| `CHANNEL_STATE_FILE` | No | `channel-state.json` | Path to state file |
| `LOG_LEVEL` | No | `info` | Logging level: debug, info, warn, error |

## Important: Adding Bot to Source Channels

For forwarding to work, **the bot must be an administrator** in each source channel:

1. Open the source channel in Telegram
2. Go to Channel Info → Administrators
3. Add your bot as an administrator
4. Grant at least "Post Messages" permission

Without this, the bot cannot access messages for forwarding and will log errors.

## Available Commands

```bash
# Development (with tsx watch)
npm run dev

# Build
npm run build

# Production
npm start

# Lint
npm run lint

# Type check
npm run typecheck

# Tests
npm run test
npm run test:watch
npm run test:coverage
```

## Event Mode (In Development)

An alternative event-driven mode using MTProto is planned but not yet production-ready. This mode would:
- Use a real Telegram user account (via GramJS)
- Listen to `NewMessage` events in real-time
- Require `TELEGRAM_API_ID`, `TELEGRAM_API_HASH`, and `TELEGRAM_STRING_SESSION`

To try it (not recommended for production):
```env
FETCH_MODE=event
```

## Tech Stack

- TypeScript
- Node.js
- grammY (Bot API)
- HTTP scraping (no MTProto client needed in polling mode)

## License

MIT
