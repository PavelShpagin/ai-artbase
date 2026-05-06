#!/usr/bin/env python3
"""
Stratified judge sanity-check visualizer.

Pulls the highest-quality art and 5 candidates per quality band (10 bands of 10
points each, 0-9 ... 90-100), so you can eyeball how the rubric maps onto real
images across the full quality spectrum.

The judge tries Gemini first; if Gemini hits its daily 20/day free-tier cap, it
falls back to Cloudflare Workers AI llava-1.5-7b-hf (free up to ~10k neurons/day).

Usage:
    python scripts/judge-viz.py --n 100              # judge up to 100 fresh samples
    python scripts/judge-viz.py --n 0                # use only what's already judged
    python scripts/judge-viz.py --open               # open in browser

Output: scripts/judge-viz/index.html
"""
import argparse, html, io, json, os, random, re, sys, time, urllib.request, webbrowser
from datetime import datetime
import psycopg2
from psycopg2.extras import RealDictCursor

try:
    from PIL import Image
    HAS_PIL = True
except Exception:
    HAS_PIL = False

import google.generativeai as genai

DB_URL = os.environ["NEON_DATABASE_URL_DIRECT"]
GEMINI_KEY = os.environ.get("GEMINI_API_KEY")
CF_ACCOUNT = os.environ.get("CLOUDFLARE_ACCOUNT_ID")
CF_TOKEN = os.environ.get("CLOUDFLARE_API_TOKEN")
JUDGE_MODEL = os.environ.get("JUDGE_MODEL", "gemini-2.5-flash-lite")

if GEMINI_KEY:
    genai.configure(api_key=GEMINI_KEY)
GEM = genai.GenerativeModel(JUDGE_MODEL) if GEMINI_KEY else None

RUBRIC = """You are a senior art director reviewing AI-generated images. Rate strictly. Return STRICT JSON ONLY:
{"composition": <int 0-10>, "craftsmanship": <int 0-10>, "anatomy_or_subject_integrity": <int 0-10>, "wow_factor": <int 0-10>, "ai_obvious": <int 0-10>, "verdict": "<one short sentence, max 120 chars>"}
ai_obvious is INVERSE: 0 = looks intentional/handmade, 10 = textbook AI slop (plastic skin, dead eyes, fused fingers, smear backgrounds, broken text)."""


def fetch_image_bytes(url, max_bytes=4_000_000, timeout=20):
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "aiartbase-judge-viz/1.0"})
        with urllib.request.urlopen(req, timeout=timeout) as r:
            data = r.read(max_bytes + 1)
        return data if len(data) <= max_bytes else None
    except Exception:
        return None


def downscale(buf, max_px=896):
    if not HAS_PIL or not buf:
        return buf
    try:
        im = Image.open(io.BytesIO(buf)).convert("RGB")
        w, h = im.size
        s = max_px / max(w, h)
        if s < 1:
            im = im.resize((int(w * s), int(h * s)), Image.LANCZOS)
        out = io.BytesIO()
        im.save(out, format="JPEG", quality=85)
        return out.getvalue()
    except Exception:
        return buf


def parse_axes(data):
    return {
        "composition": max(0, min(10, int(data.get("composition", 0)))),
        "craftsmanship": max(0, min(10, int(data.get("craftsmanship", 0)))),
        "integrity": max(0, min(10, int(data.get("anatomy_or_subject_integrity", 0)))),
        "wow": max(0, min(10, int(data.get("wow_factor", 0)))),
        "ai": max(0, min(10, int(data.get("ai_obvious", 0)))),
        "verdict": (data.get("verdict") or "")[:200],
    }


def quality(d):
    pos = d["composition"] * 1.5 + d["craftsmanship"] * 3.0 + d["integrity"] * 2.0 + d["wow"] * 3.5
    pen = max(0.0, d["ai"] - 5) * 8.0
    return round(max(0.0, min(100.0, pos - pen)), 2)


def judge_via_gemini(image_bytes):
    if not GEM:
        return None
    try:
        small = downscale(image_bytes, 896)
        resp = GEM.generate_content(
            [RUBRIC, {"mime_type": "image/jpeg", "data": small}],
            generation_config={"temperature": 0.2, "response_mime_type": "application/json"},
        )
        return parse_axes(json.loads(resp.text.strip()))
    except Exception as e:
        msg = str(e)
        if "429" in msg or "quota" in msg.lower():
            print(f"  gemini cap hit, will fall back", file=sys.stderr)
        else:
            print(f"  gemini failed: {msg[:120]}", file=sys.stderr)
        return None


def judge_via_cloudflare(image_bytes):
    if not (CF_ACCOUNT and CF_TOKEN):
        return None
    try:
        import httpx
        small = downscale(image_bytes, 512)
        url = f"https://api.cloudflare.com/client/v4/accounts/{CF_ACCOUNT}/ai/run/@cf/llava-hf/llava-1.5-7b-hf"
        payload = {"image": list(small), "prompt": RUBRIC + "\n\nReturn ONLY valid JSON.", "max_tokens": 256}
        r = httpx.post(url, headers={"Authorization": f"Bearer {CF_TOKEN}"}, json=payload, timeout=45)
        r.raise_for_status()
        result = r.json().get("result") or {}
        text = result.get("description") or result.get("response") or ""
        m = re.search(r"\{[^{}]*\"composition\"[\s\S]*?\}", text)
        if not m:
            return None
        cleaned = re.sub(r'\\(?![\\"/bfnrtu])', '', m.group(0))
        try:
            return parse_axes(json.loads(cleaned))
        except Exception:
            return None
    except Exception as e:
        print(f"  cf llava failed: {str(e)[:120]}", file=sys.stderr)
        return None


def judge(image_bytes):
    """Try Gemini first, fall back to Cloudflare LLaVA."""
    return judge_via_gemini(image_bytes) or judge_via_cloudflare(image_bytes)


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--n", type=int, default=100, help="Judge up to this many fresh samples (0=use existing only)")
    p.add_argument("--open", action="store_true")
    p.add_argument("--out", default="scripts/judge-viz/index.html")
    args = p.parse_args()

    conn = psycopg2.connect(DB_URL)

    # First: pull every already-judged art (cheap)
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute("""
            SELECT id, src, prompt, quality_score, ai_obvious_score, judge_notes
            FROM arts WHERE judged_at IS NOT NULL AND quality_score IS NOT NULL
        """)
        prejudged = cur.fetchall()
    print(f"  starting from {len(prejudged)} pre-judged samples")

    samples = [
        {"id": r["id"], "src": r["src"], "prompt": r["prompt"] or "", "score": r["quality_score"],
         "ai": r["ai_obvious_score"] or 0, "verdict": r["judge_notes"] or ""}
        for r in prejudged
    ]

    # Then: pick N random unjudged to fill out bands that are sparse
    if args.n > 0:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT id, src, prompt FROM arts
                WHERE judged_at IS NULL AND src LIKE %s
                ORDER BY RANDOM() LIMIT %s
            """, ("http%", args.n))
            fresh = cur.fetchall()

        for i, r in enumerate(fresh):
            print(f"  [{i+1}/{len(fresh)}] art={r['id']}")
            raw = fetch_image_bytes(r["src"])
            if not raw:
                continue
            d = judge(raw)
            if not d:
                continue
            s = quality(d)
            verdict = (
                f"comp={d['composition']} craft={d['craftsmanship']} integrity={d['integrity']} "
                f"wow={d['wow']} ai={d['ai']} | {d['verdict']}"
            )
            samples.append({"id": r["id"], "src": r["src"], "prompt": r["prompt"] or "",
                            "score": s, "ai": d["ai"], "verdict": verdict})
            time.sleep(0.3)

    if not samples:
        print("no samples; exiting")
        sys.exit(1)

    # Sort descending; pick highest plus 5 per band of 10
    samples.sort(key=lambda x: x["score"], reverse=True)
    highest = samples[0]
    bands: list = [[] for _ in range(10)]  # band 0 = 0-9, band 9 = 90-100
    for s in samples:
        b = min(9, int(s["score"] // 10))
        bands[b].append(s)
    # Take 5 from each band
    for i in range(10):
        bands[i] = bands[i][:5]

    # Render
    out_path = os.path.abspath(args.out)
    os.makedirs(os.path.dirname(out_path), exist_ok=True)

    def card(s):
        score = s["score"]
        ai = s["ai"]
        bg = "#1f6f3a" if score >= 75 else ("#a86b00" if score >= 55 else "#8a1f1f")
        return f'''<div class="card">
  <a href="{html.escape(s["src"])}" target="_blank"><img src="{html.escape(s["src"])}" loading="lazy"/></a>
  <div class="overlay" style="background:{bg}">{score:.0f}<span class="ai">ai {ai:.0f}/10</span></div>
  <div class="meta"><div class="prompt">{html.escape((s.get("prompt") or "")[:120])}</div>
    <div class="verdict">{html.escape(s["verdict"])}</div>
    <div class="id">art {s["id"]}</div>
  </div>
</div>'''

    band_blocks = []
    band_blocks.append(f'''
    <h2 class="hdr">Highest score in catalog</h2>
    <div class="grid">{card(highest)}</div>
    ''')
    for i in range(9, -1, -1):
        lo, hi = i * 10, (i * 10 + 9) if i < 9 else 100
        if not bands[i]:
            band_blocks.append(f'''
    <h2 class="hdr">Band {lo}-{hi} <span class="empty">(no samples — judge more or this band is naturally rare)</span></h2>''')
            continue
        band_blocks.append(f'''
    <h2 class="hdr">Band {lo}-{hi}  <span class="count">({len(bands[i])} of 5)</span></h2>
    <div class="grid">{"".join(card(s) for s in bands[i])}</div>''')

    page = f"""<!doctype html>
<html><head><meta charset="utf-8"/><title>AI ArtBase — Judge Bands</title>
<style>
  body {{ background:#0d0e12; color:#e2e2e2; font-family:-apple-system,Segoe UI,sans-serif; margin:0; padding:24px; }}
  h1 {{ font-size:22px; margin:0 0 4px; }}
  .sub {{ color:#888; font-size:13px; margin-bottom:24px; }}
  .legend {{ font-size:12px; color:#aaa; margin-bottom:24px; }}
  .legend span {{ display:inline-block; padding:3px 8px; border-radius:6px; margin-right:8px; color:white; font-weight:600; }}
  .hdr {{ font-size:15px; margin:24px 0 12px; padding-bottom:6px; border-bottom:1px solid #222; color:#cbd; }}
  .hdr .count {{ color:#666; font-weight:400; font-size:12px; }}
  .hdr .empty {{ color:#555; font-weight:400; font-size:12px; font-style:italic; }}
  .grid {{ display:grid; grid-template-columns:repeat(auto-fill,minmax(220px,1fr)); gap:14px; }}
  .card {{ background:#181a22; border-radius:10px; overflow:hidden; position:relative; }}
  .card img {{ width:100%; height:240px; object-fit:cover; display:block; }}
  .overlay {{ position:absolute; top:8px; right:8px; padding:6px 10px; border-radius:6px; color:white; font-weight:700; font-size:18px; }}
  .overlay .ai {{ display:block; font-size:11px; font-weight:500; opacity:0.85; }}
  .meta {{ padding:10px; }}
  .prompt {{ font-size:11px; color:#9bb; margin-bottom:6px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }}
  .verdict {{ font-size:11px; color:#cdc; line-height:1.35; }}
  .id {{ margin-top:6px; font-size:10px; color:#555; }}
</style></head>
<body>
  <h1>AI ArtBase — Judge bands</h1>
  <div class="sub">{len(samples)} samples judged · {len([b for b in bands if b])}/10 bands populated · click any image for full-res</div>
  <div class="legend">
    <span style="background:#1f6f3a">≥75 premium-tier</span>
    <span style="background:#a86b00">55-74 curated</span>
    <span style="background:#8a1f1f">&lt;55 reject</span>
  </div>
  {"".join(band_blocks)}
</body></html>
"""
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(page)
    print(f"=== wrote {out_path} (highest + {sum(len(b) for b in bands)} cards across bands) ===")
    if args.open:
        webbrowser.open(f"file:///{out_path.replace(os.sep, '/')}")


if __name__ == "__main__":
    main()
