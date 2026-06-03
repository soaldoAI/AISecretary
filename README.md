# AISecretary

A self-hosted AI-powered workspace for solo founders. Kanban board, AI Co-Pilot, Google Calendar, and daily Telegram briefs — all running on a single machine.

Built to run on a mini PC (Intel NUC), Raspberry Pi, or any Linux box you have lying around.

![AISecretary](https://img.shields.io/badge/status-active-brightgreen) ![License](https://img.shields.io/badge/license-MIT-blue)

## Features

- **Kanban Board** — Drag-and-drop task management with AI agent assignments
- **AI Co-Pilot** — Chat panel with full context of your tasks, can create/update/assign tasks via tool calling
- **Google Calendar** — OAuth-connected calendar view with a self-hosted booking system (like Calendly)
- **Daily Telegram Briefs** — Cron job that sends your priorities every morning
- **PWA** — Installable on mobile, works offline
- **SQLite** — Zero-config database, single file, easy to back up

## Quick Start

```bash
git clone https://github.com/soaldoAI/AISecretary.git
cd AISecretary
npm install
cp .env.example .env.local
# Edit .env.local with your API keys
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16, React 19 |
| Database | SQLite (better-sqlite3) |
| Drag & drop | @hello-pangea/dnd |
| Calendar | Google Calendar API (googleapis) |
| Styling | Tailwind CSS 4 |
| Language | TypeScript |

## Configuration

Copy `.env.example` to `.env.local` and fill in your keys:

### Co-Pilot (required for AI chat)
Get an API key from [OpenAI](https://platform.openai.com/api-keys) or [OpenRouter](https://openrouter.ai/).

### Google Calendar (optional)
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Enable the Google Calendar API
3. Create OAuth 2.0 credentials (Web application)
4. Set redirect URI to `http://localhost:3001/api/calendar/callback`
5. Add `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` to `.env.local`

### Telegram Daily Brief (optional)
1. Message [@BotFather](https://t.me/BotFather) on Telegram to create a bot
2. Get your chat ID from [@userinfobot](https://t.me/userinfobot)
3. Add `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` to `.env.local`
4. Set up the cron job:
```bash
chmod +x daily-tasks-notify.sh
# Test it
./daily-tasks-notify.sh
# Schedule for 8am daily
(crontab -l 2>/dev/null; echo "0 8 * * * $(pwd)/daily-tasks-notify.sh") | crontab -
```

## Production Deployment

Build and run with systemd:

```bash
npm run build

# Create systemd service
sudo tee /etc/systemd/system/aisecretary.service << 'SERVICE'
[Unit]
Description=AISecretary
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=YOUR_USERNAME
WorkingDirectory=/home/YOUR_USERNAME/AISecretary
ExecStart=/usr/bin/npm start
Environment=NODE_ENV=production
Environment=PORT=3001
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
SERVICE

sudo systemctl daemon-reload
sudo systemctl enable aisecretary
sudo systemctl start aisecretary
```

### HTTPS with Caddy (optional)

```bash
sudo apt install -y caddy
echo 'your-hostname.example.com { reverse_proxy localhost:3001 }' | sudo tee /etc/caddy/Caddyfile
sudo systemctl restart caddy
```

## Project Structure

```
AISecretary/
├── migrations/           # SQL migration files
├── src/
│   ├── app/
│   │   ├── (dashboard)/  # Kanban, Calendar pages
│   │   ├── (public)/     # Public booking page
│   │   └── api/          # REST API routes
│   │       ├── tasks/    # CRUD for tasks
│   │       ├── agents/   # Agent roster
│   │       ├── copilot/  # AI chat with tool calling
│   │       ├── calendar/ # Google Calendar OAuth + events
│   │       └── bookings/ # Booking system
│   ├── components/       # React components
│   └── lib/              # Database, LLM, calendar helpers
├── daily-tasks-notify.sh # Telegram cron script
├── kanban.db             # SQLite database (gitignored)
└── .env.local            # Your secrets (gitignored)
```

## Blog Series

This project is documented in a blog series:

1. [How I Turned a $300 Intel NUC Into My Always-On AI Secretary](https://medium.com/@domingo.sohan/how-i-turned-a-300-intel-nuc-into-my-always-on-ai-secretary-f4466ed4ce6e) — Ubuntu, Claude Code, Telegram, Syncthing
2. Taking My NUC to the Next Level — Kanban, Co-Pilot, Calendar, Telegram Briefs *(coming soon)*

## License

MIT
