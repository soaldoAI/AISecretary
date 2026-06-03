# AISecretary Installer (Windows)
# Usage: irm https://raw.githubusercontent.com/soaldoAI/AISecretary/main/install.ps1 | iex

$ErrorActionPreference = "Stop"
$REPO = "https://github.com/soaldoAI/AISecretary.git"
$INSTALL_DIR = Join-Path $HOME "AISecretary"

Write-Host ""
Write-Host "  +======================================+" -ForegroundColor Cyan
Write-Host "  |       AISECRETARY INSTALLER          |" -ForegroundColor Cyan
Write-Host "  |  Your self-hosted AI workspace       |" -ForegroundColor Cyan
Write-Host "  +======================================+" -ForegroundColor Cyan
Write-Host ""

# --- Check prerequisites ---
$missing = $false

function Test-Cmd($name, $installHint) {
    if (Get-Command $name -ErrorAction SilentlyContinue) {
        Write-Host "  [OK] $name found" -ForegroundColor Green
        return $true
    } else {
        Write-Host "  [X]  $name is not installed." -ForegroundColor Red
        Write-Host "       $installHint" -ForegroundColor Yellow
        return $false
    }
}

Write-Host "Checking prerequisites..."
Write-Host ""

if (-not (Test-Cmd "node" "Install from https://nodejs.org (v18+ required) or: winget install OpenJS.NodeJS.LTS")) { $missing = $true }
if (-not (Test-Cmd "npm" "npm comes with Node.js")) { $missing = $true }
if (-not (Test-Cmd "git" "Install from https://git-scm.com or: winget install Git.Git")) { $missing = $true }

Write-Host ""

if ($missing) {
    Write-Host "Please install the missing prerequisites above and re-run this script." -ForegroundColor Red
    exit 1
}

# Check Node version
$nodeVersion = (node -v).TrimStart("v")
$nodeMajor = [int]($nodeVersion.Split(".")[0])
if ($nodeMajor -lt 18) {
    Write-Host "  [X] Node.js v18+ required. You have v$nodeVersion." -ForegroundColor Red
    exit 1
}
Write-Host "  [OK] Node.js version: v$nodeVersion" -ForegroundColor Green
Write-Host ""

# --- Clone or update ---
if (Test-Path $INSTALL_DIR) {
    Write-Host "  AISecretary already exists at $INSTALL_DIR"
    $update = Read-Host "  Update to latest version? [Y/n]"
    if ($update -eq "" -or $update -match "^[Yy]") {
        Set-Location $INSTALL_DIR
        git pull origin main
        Write-Host "  [OK] Updated to latest version" -ForegroundColor Green
    }
} else {
    Write-Host "  Cloning AISecretary..."
    git clone $REPO $INSTALL_DIR
    Write-Host "  [OK] Cloned to $INSTALL_DIR" -ForegroundColor Green
}

Set-Location $INSTALL_DIR

# --- Install dependencies ---
Write-Host ""
Write-Host "  Installing dependencies..."
npm install 2>&1 | Select-Object -Last 3
Write-Host "  [OK] Dependencies installed" -ForegroundColor Green

# --- Environment setup ---
Write-Host ""
if (-not (Test-Path ".env.local")) {
    Copy-Item ".env.example" ".env.local"
    Write-Host "  Created .env.local from template"
    Write-Host ""
    Write-Host "  ----------------------------------------"
    Write-Host "  Configure your AI Co-Pilot"
    Write-Host "  ----------------------------------------"
    Write-Host ""
    Write-Host "    1) OpenRouter (recommended)"
    Write-Host "    2) OpenAI (direct)"
    Write-Host "    3) Ollama (local, free)"
    Write-Host "    4) Skip for now"
    Write-Host ""
    $choice = Read-Host "  Choice [1-4]"
    if ($choice -eq "") { $choice = "4" }

    switch ($choice) {
        "1" {
            Write-Host ""
            Write-Host "  Get an API key at: https://openrouter.ai/keys"
            $apiKey = Read-Host "  OpenRouter API key"
            if ($apiKey) {
                (Get-Content .env.local) -replace "your-api-key-here", $apiKey | Set-Content .env.local
                Write-Host "  [OK] OpenRouter configured" -ForegroundColor Green
            }
        }
        "2" {
            Write-Host ""
            Write-Host "  Get an API key at: https://platform.openai.com/api-keys"
            $apiKey = Read-Host "  OpenAI API key"
            if ($apiKey) {
                (Get-Content .env.local) -replace "OPENROUTER_BASE_URL=https://openrouter.ai/api/v1", "OPENROUTER_BASE_URL=https://api.openai.com/v1" -replace "your-api-key-here", $apiKey | Set-Content .env.local
                Write-Host "  [OK] OpenAI configured" -ForegroundColor Green
            }
        }
        "3" {
            Write-Host ""
            if (Get-Command "ollama" -ErrorAction SilentlyContinue) {
                Write-Host "  [OK] Ollama found" -ForegroundColor Green
            } else {
                Write-Host "  Ollama not installed. Get it at: https://ollama.com" -ForegroundColor Yellow
                Write-Host "  After installing, run: ollama pull llama3.2:3b"
            }
            (Get-Content .env.local) -replace "COPILOT_DEFAULT_PROVIDER=openrouter", "COPILOT_DEFAULT_PROVIDER=ollama" -replace "COPILOT_DEFAULT_MODEL=gpt-4o-mini", "COPILOT_DEFAULT_MODEL=llama3.2:3b" | Set-Content .env.local
            Write-Host "  [OK] Ollama configured" -ForegroundColor Green
        }
        default {
            Write-Host "  Skipped - edit $INSTALL_DIR\.env.local later"
        }
    }
    Write-Host ""
} else {
    Write-Host "  [OK] .env.local already exists" -ForegroundColor Green
}

# --- Build ---
Write-Host ""
Write-Host "  Building AISecretary..."
npm run build 2>&1 | Select-Object -Last 5
Write-Host "  [OK] Build complete" -ForegroundColor Green

# --- Done ---
Write-Host ""
Write-Host "  ==============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "    AISecretary is ready!" -ForegroundColor Green
Write-Host ""
Write-Host "    Start it:"
Write-Host "      cd ~/AISecretary; npm start"
Write-Host ""
Write-Host "    Then open: http://localhost:3000"
Write-Host ""
Write-Host "    Your Kanban board is waiting."
Write-Host ""
Write-Host "  ==============================================" -ForegroundColor Cyan
Write-Host ""
