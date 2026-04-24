# Telegram Channel Aggregator

A service that monitors new posts from specified Telegram channels and automatically forwards them to a single aggregator channel using a lightweight HTTP polling approach.

## Features

- **No user account required** — works with just a bot token
- **Lightweight polling** — fetches public channel previews via HTTP every 5 minutes
- **Persistent state** — remembers the last forwarded post ID per channel
- **Smart forwarding** — only forwards new posts since the last check
- **First-run safe** — initializes state without flooding the aggregator
- **Dynamic channel management** — add/remove channels via bot commands without restart

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
ALLOWED_USER_IDS=your_telegram_user_id
```

### 3. Run

```bash
# Development with auto-reload
npm run dev

# Production build
npm run build
npm start
```

### 4. Add channels

Send commands to your bot in Telegram:

```
/add_channel @channel1
/add_channel @channel2
/list_channels
```

## Managing Channels

Channels are managed at runtime via bot commands. No restart needed.

| Command | Description |
|---|---|
| `/add_channel @channel` | Add a channel to monitoring. Bot verifies it has admin access. |
| `/remove_channel @channel` | Remove a channel from monitoring. |
| `/list_channels` | Show the current list of monitored channels. |

Only users listed in `ALLOWED_USER_IDS` can use these commands.

Channels are stored in `channels.txt` (configurable via `CHANNELS_FILE`), one channel per line without `@` prefix. The file is created automatically on first `/add_channel`.

## How It Works

The service uses **polling mode**:

1. Every 5 minutes, it reads the channel list from `channels.txt`
2. Fetches the latest posts from each channel via `https://t.me/s/{channel}`
3. Compares post IDs against a local JSON state file (`channel-state.json`)
4. Forwards only new posts to the aggregator channel via Bot API

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
| `ALLOWED_USER_IDS` | Yes | — | Comma-separated Telegram user IDs that can manage channels |
| `CHANNELS_FILE` | No | `channels.txt` | Path to the file storing channel list |
| `POLL_INTERVAL_MS` | No | `300000` | Polling interval in milliseconds (5 min) |
| `CHANNEL_STATE_FILE` | No | `channel-state.json` | Path to state file |
| `LOG_LEVEL` | No | `info` | Logging level: debug, info, warn, error |
| `DELAY_BETWEEN_CHANNELS_MIN_MS` | No | `2000` | Minimum random delay between fetching each channel |
| `DELAY_BETWEEN_CHANNELS_MAX_MS` | No | `5000` | Maximum random delay between fetching each channel |
| `FORWARD_DELAY_MS` | No | `1200` | Delay between consecutive `forwardMessage` calls |

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

## Tech Stack

- TypeScript
- Node.js
- grammY (Bot API)
- HTTP scraping (no MTProto client needed in polling mode)

## License

MIT
