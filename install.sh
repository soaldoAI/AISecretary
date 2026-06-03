#!/bin/bash
set -e

# AISecretary Installer
# Usage: curl -fsSL https://raw.githubusercontent.com/soaldoAI/AISecretary/main/install.sh | bash

REPO="https://github.com/soaldoAI/AISecretary.git"
INSTALL_DIR="$HOME/AISecretary"
PORT=3001

echo ""
echo "  ╔══════════════════════════════════════╗"
echo "  ║         AISECRETARY INSTALLER         ║"
echo "  ║  Your self-hosted AI workspace       ║"
echo "  ╚══════════════════════════════════════╝"
echo ""

# --- Check prerequisites ---
check_command() {
  if ! command -v "$1" &>/dev/null; then
    echo "❌ $1 is not installed."
    return 1
  fi
  echo "✅ $1 found: $(command -v "$1")"
  return 0
}

echo "Checking prerequisites..."
echo ""

MISSING=0

if ! check_command node; then
  echo "   Install Node.js: https://nodejs.org (v18+ required)"
  MISSING=1
fi

if ! check_command npm; then
  echo "   npm comes with Node.js"
  MISSING=1
fi

if ! check_command git; then
  echo "   Install git: sudo apt install -y git"
  MISSING=1
fi

if ! check_command sqlite3; then
  echo "   ⚠️  sqlite3 not found (optional, needed for Telegram briefs)"
  echo "   Install: sudo apt install -y sqlite3"
fi

echo ""

if [ "$MISSING" -eq 1 ]; then
  echo "Please install the missing prerequisites above and re-run this script."
  exit 1
fi

# Check Node version
NODE_MAJOR=$(node -v | cut -d'.' -f1 | tr -d 'v')
if [ "$NODE_MAJOR" -lt 18 ]; then
  echo "❌ Node.js v18+ required. You have $(node -v)."
  exit 1
fi
echo "✅ Node.js version: $(node -v)"
echo ""

# --- Clone or update ---
if [ -d "$INSTALL_DIR" ]; then
  echo "📁 AISecretary directory already exists at $INSTALL_DIR"
  read -p "   Update to latest version? [Y/n] " UPDATE
  UPDATE=${UPDATE:-Y}
  if [[ "$UPDATE" =~ ^[Yy]$ ]]; then
    cd "$INSTALL_DIR"
    git pull origin main
    echo "✅ Updated to latest version"
  fi
else
  echo "📥 Cloning AISecretary..."
  git clone "$REPO" "$INSTALL_DIR"
  echo "✅ Cloned to $INSTALL_DIR"
fi

cd "$INSTALL_DIR"

# --- Install dependencies ---
echo ""
echo "📦 Installing dependencies..."
npm install --production=false 2>&1 | tail -3
echo "✅ Dependencies installed"

# --- Environment setup ---
echo ""
if [ ! -f .env.local ]; then
  cp .env.example .env.local
  echo "📝 Created .env.local from template"
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "  Let's configure your workspace"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""

  # OpenAI key
  echo "🤖 AI Co-Pilot Setup"
  echo "   Get an API key from: https://platform.openai.com/api-keys"
  read -p "   OpenAI API key (or press Enter to skip): " OPENAI_KEY
  if [ -n "$OPENAI_KEY" ]; then
    sed -i "s|sk-your-openai-key-here|$OPENAI_KEY|" .env.local
    echo "   ✅ API key saved"
  else
    echo "   ⏭️  Skipped — you can add it later in .env.local"
  fi
  echo ""

  # Telegram
  echo "📱 Telegram Daily Brief (optional)"
  echo "   Create a bot: message @BotFather on Telegram"
  echo "   Get your chat ID: message @userinfobot on Telegram"
  read -p "   Telegram bot token (or press Enter to skip): " TG_TOKEN
  if [ -n "$TG_TOKEN" ]; then
    sed -i "s|your-telegram-bot-token|$TG_TOKEN|" .env.local
    read -p "   Your Telegram chat ID: " TG_CHAT
    if [ -n "$TG_CHAT" ]; then
      sed -i "s|your-telegram-user-id|$TG_CHAT|" .env.local
      echo "   ✅ Telegram configured"
    fi
  else
    echo "   ⏭️  Skipped — you can add it later in .env.local"
  fi
  echo ""
else
  echo "✅ .env.local already exists — keeping your config"
fi

# --- Build ---
echo ""
echo "🔨 Building AISecretary..."
npm run build 2>&1 | tail -5
echo "✅ Build complete"

# --- Start ---
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  🚀 AISecretary is ready!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  Start it now:"
echo "    cd $INSTALL_DIR && npm start"
echo ""
echo "  Then open: http://localhost:$PORT"
echo ""
echo "  Optional next steps:"
echo "    • Edit ~/AISecretary/.env.local to add API keys"
echo "    • Set up Google Calendar (see README.md)"
echo "    • Set up daily Telegram briefs:"
echo "        chmod +x daily-tasks-notify.sh"
echo "        ./daily-tasks-notify.sh  # test it"
echo "        (crontab -l; echo \"0 8 * * * $INSTALL_DIR/daily-tasks-notify.sh\") | crontab -"
echo ""
echo "  Run as a background service (Linux):"
echo "    See README.md → Production Deployment"
echo ""
echo "  Happy building! 🛠️"
echo ""
