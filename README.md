# AISecretary

A self-hosted AI-powered workspace for solo founders. Kanban board, AI Co-Pilot, Google Calendar, and daily Telegram briefs — all running on a single machine.

Works on **Linux**, **macOS**, and **Windows**. Built to run on anything — a mini PC, a laptop, a Raspberry Pi, or a cloud VM.

![AISecretary](https://img.shields.io/badge/status-active-brightgreen) ![License](https://img.shields.io/badge/license-MIT-blue)

## Features

- **Kanban Board** — Drag-and-drop task management with AI agent assignments
- **AI Co-Pilot** — Chat panel with full context of your tasks, can create/update/assign tasks via tool calling
- **Google Calendar** — OAuth-connected calendar view with a self-hosted booking system (like Calendly)
- **Daily Telegram Briefs** — Cron job that sends your priorities every morning
- **PWA** — Installable on mobile, works offline
- **SQLite** — Zero-config database, single file, easy to back up

## One-Line Install

The installer checks prerequisites, clones the repo, installs dependencies, walks you through config, builds the app, and gets you to your Kanban board.

**Linux / macOS:**

```bash
curl -fsSL https://raw.githubusercontent.com/soaldoAI/AISecretary/main/install.sh | bash
```

**Windows (PowerShell):**

```powershell
irm https://raw.githubusercontent.com/soaldoAI/AISecretary/main/install.ps1 | iex
```

After install, start it and open your board:

```bash
cd ~/AISecretary && npm start
```

Open [http://localhost:3000](http://localhost:3000) — your Kanban board is ready.

## Manual Install

If you prefer to set things up yourself:

### Prerequisites

| Requirement | Linux | macOS | Windows |
|------------|-------|-------|---------|
| Node.js 18+ | `sudo apt install nodejs` or [nodejs.org](https://nodejs.org) | `brew install node` | `winget install OpenJS.NodeJS.LTS` |
| npm | Comes with Node.js | Comes with Node.js | Comes with Node.js |
| Git | `sudo apt install git` | `xcode-select --install` | `winget install Git.Git` |

### Steps

```bash
git clone https://github.com/soaldoAI/AISecretary.git
cd AISecretary
npm install
cp .env.example .env.local
# Edit .env.local — pick your AI provider (see below)
npm run build
npm start
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

Copy `.env.example` to `.env.local` and pick your AI provider:

### AI Co-Pilot (pick one)

| Provider | Cost | Setup |
|----------|------|-------|
| [OpenRouter](https://openrouter.ai/) | Pay per use | Get a key at [openrouter.ai/keys](https://openrouter.ai/keys) |
| [OpenAI](https://platform.openai.com/api-keys) | Pay per use | Get a key at [platform.openai.com](https://platform.openai.com/api-keys) |
| [Ollama](https://ollama.com) | Free (local) | Install Ollama, then `ollama pull llama3.2:3b` |

See `.env.example` for the exact variables to set for each provider.

### Google Calendar (optional)
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Enable the Google Calendar API
3. Create OAuth 2.0 credentials (Web application)
4. Set redirect URI to `http://localhost:3000/api/calendar/callback`
5. Add `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` to `.env.local`

### Telegram Daily Brief (optional, Linux/macOS)
1. Message [@BotFather](https://t.me/BotFather) on Telegram to create a bot
2. Get your chat ID from [@userinfobot](https://t.me/userinfobot)
3. Add `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` to `.env.local`
4. Set up the cron job:
```bash
chmod +x daily-tasks-notify.sh
./daily-tasks-notify.sh  # test it
(crontab -l 2>/dev/null; echo "0 8 * * * $(pwd)/daily-tasks-notify.sh") | crontab -
```

## Production Deployment (Linux)

For always-on servers (NUC, Raspberry Pi, VPS), run as a systemd service:

```bash
npm run build

sudo tee /etc/systemd/system/aisecretary.service << SERVICE
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
echo your-hostname.example.com { reverse_proxy localhost:3000 } | sudo tee /etc/caddy/Caddyfile
sudo systemctl restart caddy
```

## Project Structure

```
AISecretary/
├── install.sh            # Linux/macOS installer
├── install.ps1           # Windows installer
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
