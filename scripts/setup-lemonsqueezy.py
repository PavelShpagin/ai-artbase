#!/usr/bin/env python3
"""Fetch variant IDs for the 3 products + create buy URLs + create webhook."""
import json, os, secrets, ssl, sys, urllib.error, urllib.request

KEY = os.environ["LS_API_KEY"]
STORE = os.environ["LS_STORE_ID"]
API = "https://api.lemonsqueezy.com/v1"
HEADERS = {
    "Accept": "application/vnd.api+json",
    "Content-Type": "application/vnd.api+json",
    "Authorization": f"Bearer {KEY}",
}
CTX = ssl.create_default_context()
CTX.check_hostname = False
CTX.verify_mode = ssl.CERT_NONE

def req(method, path, body=None):
    url = f"{API}{path}"
    data = json.dumps(body).encode() if body else None
    r = urllib.request.Request(url, data=data, headers=HEADERS, method=method)
    try:
        with urllib.request.urlopen(r, context=CTX, timeout=30) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        print(f"HTTP {e.code} on {method} {path}:\n{body}", file=sys.stderr)
        raise

PRODUCTS = [
    {"key": "STARTER", "credits": 100,  "product_id": 1030801},
    {"key": "PLUS",    "credits": 350,  "product_id": 1030803},
    {"key": "PRO",     "credits": 1000, "product_id": 1030807},
]

print("=== fetching variants ===")
for p in PRODUCTS:
    resp = req("GET", f"/products/{p['product_id']}/variants")
    variants = resp["data"]
    if not variants:
        print(f"  {p['key']}: no variants", file=sys.stderr)
        sys.exit(1)
    p["variant_id"] = variants[0]["id"]
    p["variant_attrs"] = variants[0]["attributes"]
    print(f"  {p['key']:>8}  product={p['product_id']}  variant={p['variant_id']}  status={p['variant_attrs'].get('status')}")

print()
print("=== creating reusable checkout buy URLs ===")
for p in PRODUCTS:
    body = {
        "data": {
            "type": "checkouts",
            "attributes": {
                "checkout_options": {"embed": False, "media": True},
                "checkout_data": {},
                "preview": False,
                "test_mode": True,
            },
            "relationships": {
                "store":   {"data": {"type": "stores",   "id": str(STORE)}},
                "variant": {"data": {"type": "variants", "id": str(p["variant_id"])}},
            },
        }
    }
    cresp = req("POST", "/checkouts", body)
    p["buy_url"] = cresp["data"]["attributes"]["url"]
    print(f"  {p['key']:>8}  buy_url={p['buy_url']}")

print()
print("=== creating webhook ===")
webhook_secret = secrets.token_urlsafe(24)
wresp = req("POST", "/webhooks", {
    "data": {
        "type": "webhooks",
        "attributes": {
            "url": "https://api.aiartbase.com/webhooks/lemon-squeezy",
            "events": ["order_created", "subscription_payment_success"],
            "secret": webhook_secret,
            "test_mode": True,
        },
        "relationships": {
            "store": {"data": {"type": "stores", "id": str(STORE)}},
        },
    },
})
webhook_id = wresp["data"]["id"]
print(f"  webhook_id={webhook_id}")
print(f"  webhook_secret={webhook_secret}")

print()
print("=== writing scripts/secrets.local.env ===")
with open("scripts/secrets.local.env", "a") as f:
    f.write("\n# Lemon Squeezy products + webhook (test mode)\n")
    for p in PRODUCTS:
        f.write(f"LS_PRODUCT_{p['key']}_ID={p['product_id']}\n")
        f.write(f"LS_VARIANT_{p['key']}_ID={p['variant_id']}\n")
        f.write(f'LS_BUY_URL_{p["key"]}="{p["buy_url"]}"\n')
    f.write(f"LS_WEBHOOK_ID={webhook_id}\n")
    f.write(f"LS_WEBHOOK_SECRET={webhook_secret}\n")
    mapping = {p["variant_id"]: p["credits"] for p in PRODUCTS}
    f.write(f"LS_VARIANT_CREDITS={json.dumps(mapping)}\n")
print("done")
