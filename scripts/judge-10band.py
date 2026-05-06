#!/usr/bin/env python3
"""
Curated 10-band visualization: one example per quality decile (0%, 10%, ... 100%)
mixing already-scored catalog arts with freshly generated modern flux-schnell images.

This is the "show me the algorithm in action across the full range" demo.

Usage:
  python scripts/judge-10band.py                    # default: 8 fresh + DB
  python scripts/judge-10band.py --no-fresh         # DB-only

Output: scripts/judge-viz/ten-band.html
"""
import argparse, base64, hashlib, html, io, json, os, sys, time, urllib.request, webbrowser
import psycopg2
from psycopg2.extras import RealDictCursor
from PIL import Image
import httpx

DB_URL = os.environ["NEON_DATABASE_URL_DIRECT"]
CF_ACCOUNT = os.environ.get("CLOUDFLARE_ACCOUNT_ID")
CF_TOKEN = os.environ.get("CLOUDFLARE_API_TOKEN")

# Modern, varied prompts that should land all over the quality spectrum.
# Some are intentionally weak/generic (low end), most are strong cinematic prompts (high end).
FRESH_PROMPTS = [
    # Strong cinematic photography — high end
    "Cinematic close-up portrait of an old fisherman, weathered face, sea spray, 35mm film grain, golden hour, Hasselblad",
    "Editorial fashion photo, asian woman in white silk, harsh sunlight, brutalist concrete background, Vogue 2025",
    "Hyperrealistic studio still-life of a single ripe peach on dark velvet, Caravaggio lighting, 8k macro",
    "A lone wolf silhouetted on a snowy ridge at blue hour, soft volumetric mist, National Geographic style",
    # Concept-art / illustration — mid-high
    "Cyberpunk Tokyo alley at night, neon kanji reflections in puddles, lone figure with umbrella, Blade Runner 2049 mood",
    "Watercolor painting of a small wooden cottage in autumn forest, soft warm light through windows, cozy",
    # Generic / weak prompts — should land mid
    "a cat",
    "blurry photo of a sunset",
]


def cf_generate(prompt: str, model: str = "@cf/black-forest-labs/flux-1-schnell"):
    url = f"https://api.cloudflare.com/client/v4/accounts/{CF_ACCOUNT}/ai/run/{model}"
    r = httpx.post(url, headers={"Authorization": f"Bearer {CF_TOKEN}"},
                   json={"prompt": prompt}, timeout=90)
    r.raise_for_status()
    img_b64 = (r.json().get("result") or {}).get("image")
    if not img_b64: return None
    return base64.b64decode(img_b64)


def fetch_image_url(url, timeout=20):
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "judge-10band/1.0"})
        with urllib.request.urlopen(req, timeout=timeout) as r:
            data = r.read(4_000_000 + 1)
        if len(data) > 4_000_000: return None
        return data
    except Exception:
        return None


# ---------- judge methods (subset of judge_v2 — reused) ----------
def load_models():
    print("loading judge models...", file=sys.stderr)
    import torch
    from aesthetic_predictor_v2_5 import convert_v2_5_from_siglip
    from transformers import pipeline
    laion, lpre = convert_v2_5_from_siglip(low_cpu_mem_usage=True, trust_remote_code=True)
    device = "cuda" if torch.cuda.is_available() else "cpu"
    if device == "cuda": laion = laion.to(torch.bfloat16)
    laion = laion.to(device).eval()
    cafe = pipeline("image-classification", model="cafeai/cafe_aesthetic", device=0 if device=="cuda" else -1)
    shadow = pipeline("image-classification", model="NeoChen1024/aesthetic-shadow-v2-backup", device=0 if device=="cuda" else -1)
    return laion, lpre, cafe, shadow, device


def score_image(image_bytes: bytes, models):
    laion, lpre, cafe, shadow, device = models
    import torch
    im = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    px = lpre(images=im, return_tensors="pt").pixel_values.to(laion.device)
    if device == "cuda": px = px.to(torch.bfloat16)
    with torch.inference_mode():
        l_raw = laion(px).logits.squeeze().float().cpu().item()
    laion_pct = max(0.0, min(100.0, (l_raw - 1) * 100 / 9))
    cafe_out = cafe(im, top_k=3)
    cafe_pct = next((x["score"] for x in cafe_out if x["label"].lower().startswith("aesthetic")), 0.0) * 100
    shadow_out = shadow(im, top_k=2)
    shadow_pct = next((x["score"] for x in shadow_out if x["label"].lower() in ("hq","high","high_quality")), 0.0) * 100
    quality = round(0.45 * shadow_pct + 0.30 * cafe_pct + 0.25 * laion_pct, 2)
    return {
        "laion_pct": round(laion_pct, 2), "cafe_pct": round(cafe_pct, 2),
        "shadow_pct": round(shadow_pct, 2), "quality": quality,
    }


# ---------- main ----------
def main():
    p = argparse.ArgumentParser()
    p.add_argument("--no-fresh", action="store_true", help="Skip generating fresh images")
    p.add_argument("--out", default="scripts/judge-viz/ten-band.html")
    p.add_argument("--open", action="store_true")
    args = p.parse_args()

    models = load_models()
    candidates = []  # list of dicts with: src, prompt, source ("db"/"fresh"), scores

    # 1) Pull DB-judged arts (broad sample)
    conn = psycopg2.connect(DB_URL)
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute("""
            SELECT id, src, prompt, quality_score, judge_notes
            FROM arts WHERE judged_at IS NOT NULL AND quality_score IS NOT NULL
            ORDER BY RANDOM() LIMIT 120
        """)
        db_rows = cur.fetchall()
    conn.close()
    for r in db_rows:
        candidates.append({
            "src": r["src"], "prompt": r["prompt"] or "", "source": "db",
            "quality": r["quality_score"], "id": r["id"], "notes": r["judge_notes"] or "",
        })
    print(f"  pulled {len(db_rows)} db-judged candidates", file=sys.stderr)

    # 2) Generate fresh modern flux-schnell images
    if not args.no_fresh and CF_ACCOUNT and CF_TOKEN:
        os.makedirs("scripts/judge-viz/fresh", exist_ok=True)
        for i, prompt in enumerate(FRESH_PROMPTS):
            print(f"  generating fresh [{i+1}/{len(FRESH_PROMPTS)}]: {prompt[:70]}...", file=sys.stderr)
            try:
                img_bytes = cf_generate(prompt)
                if not img_bytes: continue
                # save locally to embed via data URL or relative path
                fname = f"fresh-{hashlib.md5(prompt.encode()).hexdigest()[:8]}.png"
                fpath = f"scripts/judge-viz/fresh/{fname}"
                with open(fpath, "wb") as f: f.write(img_bytes)
                scores = score_image(img_bytes, models)
                candidates.append({
                    "src": f"fresh/{fname}", "prompt": prompt, "source": "fresh",
                    "quality": scores["quality"], "notes": f"LAION={scores['laion_pct']:.0f} cafe={scores['cafe_pct']:.0f} shadow={scores['shadow_pct']:.0f}",
                })
                print(f"    -> q={scores['quality']:.1f}  ({scores})", file=sys.stderr)
            except Exception as e:
                print(f"    fresh gen failed: {e}", file=sys.stderr)

    if not candidates:
        print("no candidates; exiting", file=sys.stderr); sys.exit(1)

    # 3) Pick one closest to each target percentile (0, 10, 20, ..., 100)
    targets = list(range(0, 101, 10))
    picks = []
    used_ids = set()
    for t in targets:
        # pick closest unused candidate
        best = None; best_d = 1e9
        for c in candidates:
            key = c.get("id", c["src"])
            if key in used_ids: continue
            d = abs(c["quality"] - t)
            if d < best_d:
                best, best_d = c, d
        if best:
            used_ids.add(best.get("id", best["src"]))
            picks.append((t, best, best_d))

    # 4) Render
    out_path = os.path.abspath(args.out)
    os.makedirs(os.path.dirname(out_path), exist_ok=True)

    def card(target, c, dist):
        q = c["quality"]
        # tier accent (matches frontend badge)
        accent = "#34d399" if q >= 75 else ("#fbbf24" if q >= 55 else "#f87171")
        src = c["src"]
        # If src is a fresh local file, make it relative to the html
        href = src if src.startswith("http") else src
        prompt = c.get("prompt", "")
        notes = c.get("notes", "")
        tag = "FRESH FLUX" if c["source"] == "fresh" else f"catalog #{c.get('id', '?')}"
        miss = "" if dist <= 5 else f" <span class='miss'>(closest available: Δ{dist:.0f})</span>"
        return f'''<div class="row">
  <div class="target" style="border-left:4px solid {accent}">{target}%</div>
  <a href="{html.escape(href)}" target="_blank" class="thumb"><img src="{html.escape(href)}" loading="lazy"/></a>
  <div class="content">
    <div class="head"><span class="score" style="color:{accent}">{q:.0f}%</span><span class="tag">{tag}</span>{miss}</div>
    <div class="prompt">{html.escape(prompt[:220])}</div>
    <div class="notes">{html.escape(notes[:200])}</div>
  </div>
</div>'''

    page = f"""<!doctype html>
<html><head><meta charset="utf-8"/><title>AI ArtBase — final scorer · 10 examples</title>
<style>
  body {{ background:#0a0b10; color:#e9ecef; font-family:-apple-system,Segoe UI,sans-serif; margin:0; padding:32px; }}
  h1 {{ font-size:22px; margin:0 0 6px; }}
  .sub {{ color:#888; font-size:13px; margin-bottom:24px; }}
  .legend span {{ display:inline-block; padding:3px 8px; border-radius:6px; margin-right:8px; color:white; font-weight:600; font-size:11px; }}
  .legend {{ margin-bottom:24px; }}
  .row {{ display:grid; grid-template-columns: 70px 240px 1fr; gap:18px; align-items:center; padding:14px; background:#13151c; border-radius:12px; margin-bottom:14px; }}
  .target {{ font-size:24px; font-weight:700; color:#cbd; padding-left:14px; }}
  .thumb img {{ width:240px; height:240px; object-fit:cover; border-radius:10px; display:block; }}
  .content {{ min-width:0; }}
  .head {{ display:flex; align-items:center; gap:10px; margin-bottom:6px; }}
  .score {{ font-size:28px; font-weight:700; }}
  .tag {{ font-size:11px; color:#9ba; background:#222; padding:2px 8px; border-radius:4px; letter-spacing:0.5px; }}
  .miss {{ font-size:11px; color:#888; }}
  .prompt {{ font-size:13px; color:#aab; line-height:1.45; margin-bottom:6px; max-width:780px; }}
  .notes {{ font-size:11px; color:#789; }}
</style></head>
<body>
  <h1>AI ArtBase — final scorer demo · 10 examples</h1>
  <div class="sub">Target percentile (left) · best-matching example from catalog + fresh flux-schnell generations · scorer = shadow·0.45 + cafe·0.30 + LAION·0.25 · click image for full-res</div>
  <div class="legend"><span style="background:#34d399">≥75 premium</span><span style="background:#fbbf24">55-74 curated</span><span style="background:#f87171">&lt;55 reject</span></div>
  {"".join(card(t, c, d) for t, c, d in picks)}
</body></html>
"""
    with open(out_path, "w", encoding="utf-8") as f: f.write(page)
    print(f"wrote {out_path}", file=sys.stderr)
    if args.open:
        webbrowser.open(f"file:///{out_path.replace(os.sep, '/')}")


if __name__ == "__main__":
    main()
