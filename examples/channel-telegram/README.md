# channel-telegram

Example [Kapsel](https://kapsel.sh) channel extension. Bidirectional Telegram messaging via Bot API.

**Demonstrates:**
- Channel extension contract (`receive`, `send`, `health`)
- Pairing flow via `onPairingRequest`
- Config-driven setup via `channelConfig` schema
- `sdk.storage` for persisting paired chat IDs and poll offsets
- `onConfigUpdate` for hot config reload

## Setup

1. Create a bot via [@BotFather](https://t.me/BotFather) and get a token.
2. Install this extension on a Kapsel host.
3. Configure `botToken` in the channel settings.
4. Send any message to your bot — the host will initiate pairing.
