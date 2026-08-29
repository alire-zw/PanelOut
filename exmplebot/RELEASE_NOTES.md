## PanelOut Bot — Initial Release

Telegram bot for panel and outbound VPN service sales with wallet, admin panel, and PasarGuard integration.

### Quick install (Docker)

```bash
git clone https://github.com/alire-zw/PanelOutBot.git
cd PanelOutBot
chmod +x setup.sh
./setup.sh
```

The interactive `setup.sh` script (English prompts) will:
- Collect bot token, webhook URL, database, Redis, and API keys
- Generate a `.env` file
- Build and start the stack with Docker Compose

### Requirements
- Docker 20+ with Compose v2
- Public HTTPS URL for Telegram webhook
- TronGrid and SwapWallet API keys

### Included
- Panel services (trial, unlimited, pay-as-you-go)
- Outbound services (volume + usage billing)
- Wallet (TRON + Rial deposits)
- Admin panel (payments, servers, channels, pricing)
- Public FAQ page at `/faq`
