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

echo "=== Step 1: wait for cloud-init to finish ==="
$SSH "cloud-init status --wait 2>&1 | tail -5"
$SSH "docker --version && docker compose version && nginx -v"

echo "=== Step 2: tar + ssh backend code ==="
$SSH "mkdir -p /root/aiartbase/backend && rm -rf /root/aiartbase/backend/*"
tar -C ./backend \
  --exclude='__pycache__' \
  --exclude='venv' \
  --exclude='postgres_data' \
  --exclude='chroma_data' \
  --exclude='images' \
  --exclude='*.pyc' \
  --exclude='backend.log' \
  -czf - . | $SSH "tar -xzf - -C /root/aiartbase/backend/"
$SSH "ls /root/aiartbase/backend/ | head -20"

echo "=== Step 3: write production .env on server ==="
# Construct the .env from local backend/.env but swap DATABASE_URL to Neon pooled
# and ensure DISABLE_CHROMA=true, APP_ENV=production
LOCAL_ENV="backend/.env"
NEON_URL="$NEON_DATABASE_URL_POOLED"
TMP_ENV=$(mktemp)
{
  # Copy all lines from local .env except DATABASE_URL
  grep -v -E '^(DATABASE_URL|APP_ENV|DISABLE_CHROMA|CHROMA_HOST|CHROMA_PORT)=' "$LOCAL_ENV"
  echo ""
  echo "# Production overrides (Neon DB, no Chroma)"
  echo "DATABASE_URL=$NEON_URL"
  echo "APP_ENV=production"
  echo "DISABLE_CHROMA=true"
} > "$TMP_ENV"
$SCP "$TMP_ENV" "$USER@$HOST:/root/aiartbase/backend/.env"
rm -f "$TMP_ENV"
$SSH "chmod 600 /root/aiartbase/backend/.env"

echo "=== Step 4: build and run backend docker container ==="
$SSH "cd /root/aiartbase/backend && docker build -t aiartbase-backend:latest ." 2>&1 | tail -20

# Stop any existing container
$SSH "docker rm -f aiartbase-backend 2>/dev/null || true"

# Run new container, expose 8000 only on localhost so nginx proxies it
$SSH "docker run -d --name aiartbase-backend --restart unless-stopped \
  -p 127.0.0.1:8000:8000 \
  --env-file /root/aiartbase/backend/.env \
  aiartbase-backend:latest"

echo "=== Step 5: wait for backend health ==="
sleep 8
$SSH "curl -fsS --max-time 10 http://localhost:8000/docs | head -c 200" || echo "  backend not responding yet"

echo "=== Step 6: nginx reverse proxy for api.aiartbase.com ==="
$SSH "cat > /etc/nginx/sites-available/aiartbase << 'NGINX'
server {
    listen 80;
    server_name api.aiartbase.com;

    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 300s;
    }
}
NGINX
ln -sf /etc/nginx/sites-available/aiartbase /etc/nginx/sites-enabled/aiartbase
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx"

echo "=== done ==="
echo "Server IP: $HOST"
echo "Backend running at: http://127.0.0.1:8000 (server-local)"
echo "Public via nginx HTTP: http://$HOST  -> proxied to backend"
echo "Next: point api.aiartbase.com DNS at $HOST, then certbot --nginx -d api.aiartbase.com"
