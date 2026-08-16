# Aegis — Messaging Gateway

The `/gateway` command connects Aegis to messaging platforms as a headless bot. Each chat gets its own headless AgentSession; replies are captured from `message_end` events and sent back. Loop protection ignores the bot's own messages.

## Supported channels

| Channel | Adapter | Requirements |
|---|---|---|
| **Telegram** | Bot API long-polling (no server) | Bot token from @BotFather |
| **Discord** | Gateway websocket + REST | Bot token |
| **Slack** | Socket Mode (no public endpoint) | App token (xapp-) + bot token (xoxb-) |
| **WhatsApp** | Meta Cloud API webhook | Meta Business account + phone number + token; public webhook URL (tunnel for local) |
| **Matrix** | Client-server sync loop | Homeserver + access token + user id |

## Usage

```bash
/gateway start telegram <token>
/gateway start discord <token>
/gateway start slack <app-token> <bot-token>
/gateway start whatsapp <phone-id> <token> <verify>
/gateway start matrix <homeserver> <token> <user>
/gateway stop [channel]
/gateway status
```

## Config via env vars

| Channel | Env vars |
|---|---|
| Telegram | `AEGIS_TELEGRAM_TOKEN` |
| Discord | `AEGIS_DISCORD_TOKEN` |
| Slack | `AEGIS_SLACK_APP_TOKEN`, `AEGIS_SLACK_BOT_TOKEN` |
| WhatsApp | `AEGIS_WHATSAPP_PHONE_ID`, `AEGIS_WHATSAPP_TOKEN`, `AEGIS_WHATSAPP_VERIFY`, `AEGIS_WHATSAPP_PORT` |
| Matrix | `AEGIS_MATRIX_HOMESERVER`, `AEGIS_MATRIX_TOKEN`, `AEGIS_MATRIX_USER` |

## Gateway behavior

- **Per-chat sessions**: each chat gets its own headless AgentSession with its own history.
- **Loop protection**: the bot's own messages are ignored on every channel.
- **Replies**: the assistant's reply is captured from `message_end` events and sent back to the originating chat.

## Security notes

- WhatsApp webhook needs HTTPS in production (tunnel with ngrok/cloudflared for local testing).
- WhatsApp webhook verification uses the `verify` token you provide.
