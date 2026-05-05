#!/usr/bin/env bash
# Run after deploy + DNS propagated. Issues Let's Encrypt cert for api.aiartbase.com.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."
source scripts/secrets.local.env
HOST="${HETZNER_HOST:?missing}"
USER="${HETZNER_USER:-root}"
KEY="$HOME/.ssh/id_ed25519"
SSH="ssh -i $KEY -o StrictHostKeyChecking=no $USER@$HOST"

echo "=== Verify DNS resolves to our IP ==="
RESOLVED=$($SSH "dig +short api.aiartbase.com @1.1.1.1 | head -1")
echo "api.aiartbase.com -> $RESOLVED"
if [ "$RESOLVED" != "$HOST" ]; then
  echo "WARNING: api.aiartbase.com does not resolve to $HOST yet. Cert may fail."
fi

echo "=== Issue Let's Encrypt cert via certbot --nginx ==="
$SSH "certbot --nginx --non-interactive --agree-tos -m pavelandrewshpagin@gmail.com -d api.aiartbase.com --redirect" 2>&1 | tail -15

echo "=== Test HTTPS ==="
$SSH "curl -sS -o /dev/null -w 'HTTP %{http_code}\\n' https://api.aiartbase.com/docs"
echo "=== From local ==="
curl -sS -o /dev/null -w "HTTP %{http_code}\n" https://api.aiartbase.com/docs
