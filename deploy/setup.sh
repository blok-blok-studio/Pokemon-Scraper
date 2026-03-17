#!/bin/bash
set -e

echo "═══════════════════════════════════════════════════"
echo "🃏 Pokemon Card Agent — First Time Setup"
echo "═══════════════════════════════════════════════════"
echo ""

# Check for Node.js >= 22
echo "Checking Node.js..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
    if [ "$NODE_VERSION" -lt 22 ]; then
        echo "⚠️  Node.js version is below 22. Installing latest via nvm..."
        curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
        export NVM_DIR="$HOME/.nvm"
        [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
        nvm install 22
        nvm use 22
    else
        echo "✓ Node.js v$(node -v) found"
    fi
else
    echo "Node.js not found. Installing via nvm..."
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
    nvm install 22
    nvm use 22
fi

# Check for Git
echo ""
echo "Checking Git..."
if command -v git &> /dev/null; then
    echo "✓ Git found"
else
    echo "Installing Git..."
    sudo apt-get update && sudo apt-get install -y git
fi

# Check for Chromium (puppeteer dependency)
echo ""
echo "Checking Chromium..."
if command -v chromium-browser &> /dev/null || command -v chromium &> /dev/null || command -v google-chrome &> /dev/null; then
    echo "✓ Chromium/Chrome found"
else
    echo "Installing Chromium..."
    sudo apt-get update && sudo apt-get install -y chromium-browser
fi

# Install OpenClaw globally
echo ""
echo "Installing OpenClaw..."
npm install -g openclaw@latest
echo "✓ OpenClaw installed"

# Clone the repo
echo ""
read -p "Enter your GitHub repo URL (e.g. https://github.com/youruser/pokemon-card-agent.git): " REPO_URL
git clone "$REPO_URL"
cd pokemon-card-agent

# Install dependencies
echo ""
echo "Installing project dependencies..."
npm install
echo "✓ Dependencies installed"

# Setup environment variables
echo ""
echo "Setting up environment variables..."
cp .env.example .env
echo ""
echo "We need to configure your API keys. Each service is pay-as-you-go, no subscriptions."
echo ""

read -p "Enter your Anthropic API key (get one at https://console.anthropic.com): " ANTHROPIC_KEY
sed -i "s/your_anthropic_api_key_here/$ANTHROPIC_KEY/" .env

read -p "Enter your Telegram Bot Token (create a bot via @BotFather on Telegram): " TELEGRAM_TOKEN
sed -i "s/your_telegram_bot_token_here/$TELEGRAM_TOKEN/" .env

read -p "Enter your Telegram Chat ID (get it via @userinfobot on Telegram): " TELEGRAM_CHAT
sed -i "s/your_telegram_chat_id_here/$TELEGRAM_CHAT/" .env

read -p "Enter your Resend API key (get one at https://resend.com): " RESEND_KEY
sed -i "s/your_resend_api_key_here/$RESEND_KEY/" .env

read -p "Enter your Bland.ai API key (get one at https://bland.ai): " BLAND_KEY
sed -i "s/your_bland_ai_api_key_here/$BLAND_KEY/" .env

read -p "Enter your FROM email (must be verified in Resend): " FROM_EMAIL
sed -i "s/your_verified_resend_email/$FROM_EMAIL/" .env

read -p "Enter your reply-to email: " REPLY_EMAIL
sed -i "s/your_reply_email/$REPLY_EMAIL/" .env

read -p "Enter your name for voice calls: " AGENT_NAME_VAL
sed -i "s/your_name_for_voice_calls/$AGENT_NAME_VAL/" .env

# Setup config files
echo ""
echo "Setting up configuration files..."
cp config/config.example.json config/config.json
cp config/watchlist.example.json config/watchlist.json
cp config/contacts.example.json config/contacts.json
mkdir -p data logs data/backups
echo "✓ Config files created"

# Run health check
echo ""
echo "Running health check..."
echo ""

# Test database
echo "Testing database..."
node -e "const db = require('./tools/db/database'); db.init(); console.log('✓ Database initialized');" 2>/dev/null && echo "✓ Database OK" || echo "✗ Database failed"

# Test Telegram
echo "Testing Telegram..."
node tools/telegram-client/telegram-cli.js send-message "🃏 Pokemon Card Agent setup complete! This is a test message." 2>/dev/null && echo "✓ Telegram OK" || echo "✗ Telegram failed — check your bot token and chat ID"

# Test Anthropic
echo "Testing Anthropic API..."
node -e "
const Anthropic = require('@anthropic-ai/sdk');
require('dotenv').config();
const client = new Anthropic();
client.messages.create({model:'claude-sonnet-4-20250514',max_tokens:10,messages:[{role:'user',content:'hi'}]})
.then(() => console.log('✓ Anthropic API OK'))
.catch(e => console.log('✗ Anthropic API failed:', e.message));
" 2>/dev/null || echo "✗ Anthropic test script failed"

echo ""
echo "═══════════════════════════════════════════════════"
echo "✓ Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Run OpenClaw onboarding: openclaw onboard --install-daemon"
echo "  2. Configure OpenClaw to use this workspace"
echo "  3. Run: openclaw gateway start"
echo "  4. Open dashboard: http://localhost:3847"
echo "  5. Chat with your agent via Telegram!"
echo "═══════════════════════════════════════════════════"
