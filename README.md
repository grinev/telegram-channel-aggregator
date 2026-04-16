# Telegram Channel Aggregator

A real-time service that monitors new posts from specified Telegram channels and automatically forwards them to a single aggregator channel.

Uses a Producer-Consumer architecture:

- **Producer** — connects via MTProto (GramJS) as a user client, listens for `NewMessage` events from source channels
- **Consumer** — connects via Bot API (grammY) as a bot, forwards messages to the aggregator channel using `forwardMessage`

This keeps the reading account in stealth mode (read-only, zero ban risk) while the bot handles all publishing.