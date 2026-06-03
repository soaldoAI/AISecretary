#!/bin/bash
set -e

# AISecretary Installer (Linux / macOS)
# Usage: curl -fsSL https://raw.githubusercontent.com/soaldoAI/AISecretary/main/install.sh | bash

REPO="https://github.com/soaldoAI/AISecretary.git"
INSTALL_DIR="$HOME/AISecretary"

echo ""
echo "  ╔══════════════════════════════════════╗"
echo "  ║       AISECRETARY INSTALLER          ║"
echo "  ║  Your self-hosted AI workspace       ║"
echo "  ╚══════════════════════════════════════╝"
echo ""

# --- Detect OS ---
OS="$(uname -s)"
case "$OS" in
  Linux*)   PLATFORM=linux ;;
  Darwin*)  PLATFORM=mac ;;
  *)        echo "❌ Unsupported OS: $OS"; echo "   Use install.ps1 for Windows."; exit 1 ;;
esac
echo "🖥️  Detected platform: $PLATFORM"
echo ""

# --- Check prerequisites ---
MISSING=0

check_command() {
  if ! command -v "$1" &>/dev/null; then
    echo "❌ $1 is not installed."
    return 1
  fi
  echo "✅ $1 found"
  return 0
}

echo "Checking prerequisites..."
echo ""

if ! check_command node; then
  if [ "$PLATFORM" = "mac" ]; then
    echo "   Install Node.js: brew install node"
  else
    echo "   Install Node.js: https://nodejs.org (v18+ required)"
    echo "   Or: curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt install -y nodejs"
  fi
  MISSING=1
fi

if ! check_command npm; then
  echo "   npm comes with Node.js"
  MISSING=1
fi

if ! check_command git; then
  if [ "$PLATFORM" = "mac" ]; then
    echo "   Install git: xcode-select --install"
  else
    echo "   Install git: sudo apt install -y git"
  fi
  MISSING=1
fi

echo ""

if [ "$MISSING" -eq 1 ]; then
  echo "Please install the missing prerequisites above and re-run this script."
  exit 1
fi

# Check Node version
NODE_MAJOR=$(node -v | cut -d. -f1 | tr -d v)
if [ "$NODE_MAJOR" -lt 18 ]; then
  echo "❌ Node.js v18+ required. You have $(node -v)."
  exit 1
fi
echo "✅ Node.js version: $(node -v)"
echo ""

# --- Clone or update ---
if [ -d "$INSTALL_DIR" ]; then
  echo "📁 AISecretary already exists at $INSTALL_DIR"
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
npm install 2>&1 | tail -3
echo "✅ Dependencies installed"

# --- Environment setup ---
echo ""
if [ ! -f .env.local ]; then
  cp .env.example .env.local
  echo "📝 Created .env.local from template"
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "  Configure your AI Co-Pilot"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  echo "  Pick a provider:"
  echo "    1) OpenRouter (recommended — many models)"
  echo "    2) OpenAI (direct)"
  echo "    3) Ollama (local, free, no key needed)"
  echo "    4) Skip for now"
  echo ""
  read -p "  Choice [1-4]: " PROVIDER_CHOICE
  PROVIDER_CHOICE=${PROVIDER_CHOICE:-4}

  case "$PROVIDER_CHOICE" in
    1)
      echo ""
      echo "  Get an API key at: https://openrouter.ai/keys"
      read -p "  OpenRouter API key: " API_KEY
      if [ -n "$API_KEY" ]; then
        sed -i.bak "s|your-api-key-here|$API_KEY|" .env.local
        rm -f .env.local.bak
        echo "  ✅ OpenRouter configured"
      fi
      ;;
    2)
      echo ""
      echo "  Get an API key at: https://platform.openai.com/api-keys"
      read -p "  OpenAI API key: " API_KEY
      if [ -n "$API_KEY" ]; then
        sed -i.bak "s|OPENROUTER_BASE_URL=https://openrouter.ai/api/v1|OPENROUTER_BASE_URL=https://api.openai.com/v1|" .env.local
        sed -i.bak "s|your-api-key-here|$API_KEY|" .env.local
        rm -f .env.local.bak
        echo "  ✅ OpenAI configured"
      fi
      ;;
    3)
      echo ""
      if command -v ollama &>/dev/null; then
        echo "  ✅ Ollama found"
      else
        echo "  ⚠️  Ollama not installed. Get it at: https://ollama.com"
        echo "  After installing, run: ollama pull llama3.2:3b"
      fi
      sed -i.bak "s|COPILOT_DEFAULT_PROVIDER=openrouter|COPILOT_DEFAULT_PROVIDER=ollama|" .env.local
      sed -i.bak "s|COPILOT_DEFAULT_MODEL=gpt-4o-mini|COPILOT_DEFAULT_MODEL=llama3.2:3b|" .env.local
      rm -f .env.local.bak
      echo "  ✅ Ollama configured"
      ;;
    *)
      echo "  ⏭️  Skipped — edit ~/AISecretary/.env.local later"
      ;;
  esac
  echo ""
else
  echo "✅ .env.local already exists — keeping your config"
fi

# --- Build ---
echo ""
echo "🔨 Building AISecretary..."
npm run build 2>&1 | tail -5
echo "✅ Build complete"

# --- Done ---
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  ✅ AISecretary is ready!"
echo ""
echo "  Start it:"
echo "    cd ~/AISecretary && npm start"
echo ""
echo "  Then open: http://localhost:3000"
echo ""
echo "  Your Kanban board is waiting."
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
