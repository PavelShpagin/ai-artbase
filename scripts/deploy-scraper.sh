#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."
source scripts/secrets.local.env
HOST="${HETZNER_HOST:?missing}"
USER="${HETZNER_USER:-root}"
KEY="$HOME/.ssh/id_ed25519"
SSH="ssh -i $KEY -o StrictHostKeyChecking=no $USER@$HOST"
SCP="scp -i $KEY -o StrictHostKeyChecking=no"

echo "=== install Node 20 + Chromium deps on server ==="
$SSH bash -s <<'EOS'
set -euo pipefail
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
# Chromium runtime libs that puppeteer needs (it downloads its own Chromium binary)
apt-get install -y --no-install-recommends \
  libgtk-3-0 libnss3 libxss1 libasound2t64 libxshmfence1 libgbm1 \
  libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 \
  fonts-liberation ca-certificates \
  || apt-get install -y --no-install-recommends \
    libgtk-3-0 libnss3 libxss1 libasound2 libxshmfence1 libgbm1 \
    libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 \
    fonts-liberation ca-certificates
node --version
EOS

echo ""
echo "=== ship scraper code (no node_modules, no screenshots) ==="
$SSH "mkdir -p /root/aiartbase/scraper && rm -rf /root/aiartbase/scraper/*"
tar -C ./scraper \
  --exclude='node_modules' --exclude='*.png' --exclude='*.log' \
  -czf - civitai-scraper.js test-scraper.js package.json package-lock.json \
  | $SSH "tar -xzf - -C /root/aiartbase/scraper/"
$SSH "ls -la /root/aiartbase/scraper/"

echo ""
echo "=== install npm deps (this downloads Chromium ~200MB; takes ~3min) ==="
$SSH "cd /root/aiartbase/scraper && npm install --omit=dev 2>&1 | tail -5"

echo ""
echo "=== write production .env for scraper ==="
LOCAL_OPENAI=$(grep '^OPENAI_API_KEY=' scraper/.env | cut -d'=' -f2-)
$SSH "cat > /root/aiartbase/scraper/.env <<ENV
API_URL=https://api.aiartbase.com
OWNER_ID=4
OPENAI_API_KEY=$LOCAL_OPENAI
ENV
chmod 600 /root/aiartbase/scraper/.env"

echo ""
echo "=== systemd timer: run daily at 03:30 UTC ==="
$SSH bash -s <<'EOS'
cat > /etc/systemd/system/aiartbase-scraper.service <<'UNIT'
[Unit]
Description=AI ArtBase Civitai scraper
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
WorkingDirectory=/root/aiartbase/scraper
EnvironmentFile=/root/aiartbase/scraper/.env
ExecStart=/usr/bin/node civitai-scraper.js
StandardOutput=append:/var/log/aiartbase-scraper.log
StandardError=append:/var/log/aiartbase-scraper.log
TimeoutStartSec=2h
UNIT
cat > /etc/systemd/system/aiartbase-scraper.timer <<'UNIT'
[Unit]
Description=Daily AI ArtBase scraper run

[Timer]
OnCalendar=*-*-* 03:30:00
RandomizedDelaySec=15min
Persistent=true

[Install]
WantedBy=timers.target
UNIT
systemctl daemon-reload
systemctl enable --now aiartbase-scraper.timer
systemctl list-timers aiartbase-scraper.timer --no-pager
EOS

echo ""
echo "=== Done. To trigger a manual run: ssh ... systemctl start aiartbase-scraper.service ==="
echo "=== Logs: ssh ... tail -f /var/log/aiartbase-scraper.log ==="
