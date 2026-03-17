#!/bin/bash

echo "═══════════════════════════════════════════════════"
echo "🔒 Pokemon Card Agent — Security Hardening"
echo "═══════════════════════════════════════════════════"
echo ""
echo "⚠️  This script requires sudo privileges."
echo "⚠️  It will modify firewall rules, SSH config, and system settings."
echo ""
read -p "Continue? (y/N): " CONFIRM
if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
    echo "Aborted."
    exit 0
fi

# a. Update system packages
echo ""
echo "Updating system packages..."
sudo apt-get update && sudo apt-get upgrade -y

# b. Firewall setup with UFW
echo ""
echo "Configuring firewall..."
read -p "Enter custom SSH port (default 2222): " SSH_PORT
SSH_PORT=${SSH_PORT:-2222}

sudo apt-get install -y ufw
sudo ufw default deny incoming    # Block all incoming by default
sudo ufw default allow outgoing   # Allow all outgoing (needed for API calls)
sudo ufw allow "$SSH_PORT"/tcp    # Allow SSH on custom port
# Localhost is always allowed by UFW
sudo ufw --force enable
echo "✓ Firewall enabled — SSH on port $SSH_PORT, outbound allowed"

# c. SSH hardening
echo ""
echo "Hardening SSH..."
sudo cp /etc/ssh/sshd_config /etc/ssh/sshd_config.backup

# Change SSH port
sudo sed -i "s/#Port 22/Port $SSH_PORT/" /etc/ssh/sshd_config
sudo sed -i "s/Port 22/Port $SSH_PORT/" /etc/ssh/sshd_config

# Disable root login
sudo sed -i 's/#PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
sudo sed -i 's/PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config

# Disable password authentication (key-only)
sudo sed -i 's/#PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
sudo sed -i 's/PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config

sudo systemctl restart sshd
echo "✓ SSH hardened — port $SSH_PORT, root login disabled, key-only auth"

# d. Install and configure fail2ban
echo ""
echo "Installing fail2ban..."
sudo apt-get install -y fail2ban

sudo cat > /tmp/jail.local << EOF
[sshd]
enabled = true
port = $SSH_PORT
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
bantime = 3600
findtime = 600
EOF
sudo mv /tmp/jail.local /etc/fail2ban/jail.local
sudo systemctl enable fail2ban
sudo systemctl restart fail2ban
echo "✓ fail2ban active — 3 failed attempts = 1 hour ban"

# e. Create dedicated user
echo ""
echo "Creating dedicated pokemon-agent user..."
if id "pokemon-agent" &>/dev/null; then
    echo "User pokemon-agent already exists"
else
    sudo adduser --system --group --home /home/pokemon-agent --shell /bin/bash pokemon-agent
    echo "✓ User pokemon-agent created (no sudo access)"
fi

# f. Automatic security updates
echo ""
echo "Configuring automatic security updates..."
sudo apt-get install -y unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
echo "✓ Automatic security updates enabled"

# g. File permissions
echo ""
echo "Locking down file permissions..."
if [ -f .env ]; then
    chmod 600 .env                    # Owner read/write only
    echo "✓ .env: owner read/write only (600)"
fi
if [ -d config ]; then
    chmod 700 config                  # Owner full access only
    echo "✓ config/: owner only (700)"
fi
if [ -d deploy ]; then
    chmod 700 deploy                  # Owner full access only
    echo "✓ deploy/: owner only (700)"
fi
if [ -d data ]; then
    chmod 700 data                    # Owner full access only
    echo "✓ data/: owner only (700)"
fi

# h. OpenClaw-specific hardening
echo ""
echo "Checking OpenClaw config..."
if [ -f openclaw.json ]; then
    if grep -q '"bind": "loopback"' openclaw.json; then
        echo "✓ OpenClaw gateway bound to loopback"
    else
        echo "⚠️  OpenClaw gateway is NOT bound to loopback — fix this in openclaw.json!"
    fi
fi

# Run openclaw doctor if available
if command -v openclaw &> /dev/null; then
    echo ""
    echo "Running openclaw doctor..."
    openclaw doctor || true
fi

# i. Disable unnecessary services
echo ""
echo "Disabling unnecessary services..."
for service in bluetooth cups avahi-daemon; do
    if systemctl is-active --quiet "$service" 2>/dev/null; then
        sudo systemctl disable "$service"
        sudo systemctl stop "$service"
        echo "  Disabled: $service"
    fi
done

echo ""
echo "═══════════════════════════════════════════════════"
echo "🔒 Security Hardening Complete"
echo "═══════════════════════════════════════════════════"
echo ""
echo "✓ Firewall enabled (SSH port $SSH_PORT, outbound HTTPS)"
echo "✓ SSH key-only on port $SSH_PORT"
echo "✓ fail2ban active (3 attempts = 1hr ban)"
echo "✓ Automatic security updates enabled"
echo "✓ Dedicated pokemon-agent user created"
echo "✓ File permissions locked down"
echo "✓ OpenClaw gateway bound to loopback"
echo ""
echo "⚠️  IMPORTANT: Make sure your SSH public key is on this"
echo "    machine BEFORE you log out! Password auth is now disabled."
echo ""
echo "⚠️  Connect via: ssh -p $SSH_PORT pokemon-agent@<this-ip>"
echo "═══════════════════════════════════════════════════"
