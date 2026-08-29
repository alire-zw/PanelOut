# PanelOut Bot

Telegram bot for selling panel and outbound VPN services. Built with [grammY](https://grammy.dev), Express webhooks, PostgreSQL (Prisma), Redis, and PasarGuard integration.

## Features

- Panel services: trial, unlimited (capacity-based), and pay-as-you-go usage
- Outbound services: volume packages and pay-as-you-go usage
- Wallet: TRON deposits, Rial card-to-card, transaction history, usage invoices
- Admin panel: payment settings, server/channel management, capacity & pricing
- Public FAQ page at `/faq`
- Docker-ready deployment with interactive setup script

## Requirements

- Docker 20+ with Compose v2 (or `docker-compose`)
- A public HTTPS domain with nginx (or another reverse proxy) in front of the app
- Telegram bot token from [@BotFather](https://t.me/BotFather)
- TronGrid and SwapWallet API keys

## Quick start (Docker)

```bash
git clone https://github.com/alire-zw/PanelOutBot.git
cd PanelOutBot
chmod +x setup.sh
./setup.sh
```

The setup script will:

1. Ask for required configuration (bot token, webhook URL, database, etc.)
2. Generate a `.env` file
3. Build and start the application with Docker Compose

### Manual setup

```bash
cp .env.example .env
# Edit .env with your values
docker compose up -d --build
```

## Environment variables

See [`.env.example`](.env.example) for the full list. Key variables:

| Variable | Description |
|----------|-------------|
| `BOT_TOKEN` | Telegram bot token |
| `WEBHOOK_URL` | Public base URL (no trailing slash) |
| `WEBHOOK_SECRET` | Random secret for webhook verification |
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `ADMIN_IDS` | Comma-separated Telegram user IDs for admins |
| `TRONGRID_API_KEY` | TronGrid API key |
| `SWAPWALLET_API_KEY` | SwapWallet API key |

## Production with nginx

Point nginx at the app container on port `4444` and set `WEBHOOK_URL` to your public HTTPS domain.

1. Copy and edit the example config:

```bash
sudo cp deploy/nginx.conf /etc/nginx/sites-available/panelout
# Replace example.com and SSL paths, then:
sudo ln -s /etc/nginx/sites-available/panelout /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

2. In `.env`:

```env
WEBHOOK_URL=https://your-domain.com
WEBHOOK_PATH=/webhook
PORT=4444
```

3. Start the stack:

```bash
docker compose up -d --build
```

Telegram will send updates to `https://your-domain.com/webhook`. The app registers the webhook on startup and re-checks it every 15 minutes.

Health check (for monitoring):

```bash
curl https://your-domain.com/health
```

## Docker commands

```bash
# Start with bundled PostgreSQL + Redis
docker compose up -d

# View logs
docker compose logs -f app

# Stop all services
docker compose down

# Optional: database UI (Adminer)
docker compose --profile tools up -d adminer
```

## Development (without Docker)

```bash
npm install
cp .env.example .env
# Set DATABASE_URL and REDIS_URL to localhost
npx prisma db push
npm run dev
```

## Project structure

```
src/           Application source code
prisma/        Database schema
public/faq/    Static FAQ page
deploy/        nginx example config
docker/        Container entrypoint
setup.sh       Interactive Docker installer
```

## License

Private / all rights reserved unless otherwise specified by the repository owner.
