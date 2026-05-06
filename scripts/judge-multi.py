#!/usr/bin/env python3
"""
Multi-method quality scorer benchmark.

Runs several candidate scoring pipelines on the same set of images so you can
visually compare which signal best matches your taste.

Methods:
  shadow      -> shadowlilac/aesthetic-shadow-v2 (ViT, AI-art-specific HQ probability)
  cafe        -> cafeai/cafe_aesthetic (ViT, general "aesthetic" probability)
  laion       -> LAION aesthetic-predictor v2.5 SigLIP (1-10 regression — gold standard)
  llava       -> Cloudflare Workers AI llava-1.5-7b-hf (verbal ai_obvious verdict)

Each method emits a 0-100 quality score; viz renders side-by-side cards so you
can eyeball correlations.

Output: scripts/judge-viz/multi.html

Usage:
  python scripts/judge-multi.py --n 60                # 60 random samples
  python scripts/judge-multi.py --n 60 --methods shadow,cafe,llava  # subset
"""
import argparse, html, io, json, os, random, re, sys, time, urllib.request, webbrowser
from datetime import datetime
import psycopg2
from psycopg2.extras import RealDictCursor

DB_URL = os.environ["NEON_DATABASE_URL_DIRECT"]
CF_ACCOUNT = os.environ.get("CLOUDFLARE_ACCOUNT_ID")
CF_TOKEN = os.environ.get("CLOUDFLARE_API_TOKEN")

try:
    from PIL import Image
except Exception:
    print("PIL required: pip install Pillow", file=sys.stderr); sys.exit(1)

JUDGE_RUBRIC = """Rate this AI-generated image. Return STRICT JSON ONLY:
{"composition": <int 0-10>, "craftsmanship": <int 0-10>, "anatomy_or_subject_integrity": <int 0-10>, "wow_factor": <int 0-10>, "ai_obvious": <int 0-10>, "verdict": "<one short sentence>"}
ai_obvious is INVERSE: 0 = looks intentional/handmade, 10 = textbook AI slop."""


# ---------- IMAGE LOADING ----------
def fetch_image(url, max_bytes=4_000_000, timeout=20):
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "aiartbase-judge-multi/1.0"})
        with urllib.request.urlopen(req, timeout=timeout) as r:
            data = r.read(max_bytes + 1)
        if len(data) > max_bytes: return None
        return Image.open(io.BytesIO(data)).convert("RGB")
    except Exception as e:
        print(f"  fetch failed: {e}", file=sys.stderr)
        return None


# ---------- METHOD: shadowlilac/aesthetic-shadow-v2 ----------
def make_shadow():
    """Original shadowlilac/aesthetic-shadow-v2 was deleted; use NeoChen1024's mirror."""
    try:
        from transformers import pipeline
        repo = "NeoChen1024/aesthetic-shadow-v2-backup"
        print(f"loading shadow {repo} ...", file=sys.stderr)
        pipe = pipeline("image-classification", model=repo, device=0 if _has_cuda() else -1)
        def score(im: Image.Image) -> float:
            try:
                out = pipe(im, top_k=2)
                hq = next((x["score"] for x in out if x["label"].lower() in ("hq", "high_quality", "high")), 0.0)
                return round(hq * 100, 2)
            except Exception as e:
                print(f"  shadow err: {e}", file=sys.stderr); return None
        return score
    except Exception as e:
        print(f"shadow init failed: {e}", file=sys.stderr); return None


# ---------- METHOD: cafeai/cafe_aesthetic ----------
def make_cafe():
    try:
        from transformers import pipeline
        print("loading cafe_aesthetic ...", file=sys.stderr)
        pipe = pipeline("image-classification", model="cafeai/cafe_aesthetic", device=0 if _has_cuda() else -1)
        def score(im: Image.Image) -> float:
            try:
                out = pipe(im, top_k=3)
                aes = next((x["score"] for x in out if x["label"].lower().startswith("aesthetic")), 0.0)
                return round(aes * 100, 2)
            except Exception as e:
                print(f"  cafe err: {e}", file=sys.stderr); return None
        return score
    except Exception as e:
        print(f"cafe init failed: {e}", file=sys.stderr); return None


# ---------- METHOD: LAION aesthetic predictor v2.5 ----------
def make_laion():
    """LAION's CLIP-regression aesthetic predictor (1-10 scale; mapped to 0-100)."""
    try:
        import torch
        from transformers import AutoModel, AutoProcessor
        print("loading LAION aesthetic-predictor-v2.5 ...", file=sys.stderr)
        # discus0434's port — uses SigLIP backbone
        model_id = "discus0434/aesthetic-predictor-v2-5"
        device = "cuda" if _has_cuda() else "cpu"
        # The recommended way is via the discus0434 helper; if not pip-installed we use raw transformers fallback
        try:
            from aesthetic_predictor_v2_5 import convert_v2_5_from_siglip
            model, preprocessor = convert_v2_5_from_siglip(low_cpu_mem_usage=True, trust_remote_code=True)
            model = model.to(torch.bfloat16 if device == "cuda" else torch.float32).to(device).eval()
            def score(im: Image.Image):
                pixel_values = preprocessor(images=im, return_tensors="pt").pixel_values.to(model.device)
                if device == "cuda": pixel_values = pixel_values.to(torch.bfloat16)
                with torch.inference_mode():
                    s = model(pixel_values).logits.squeeze().float().cpu().item()
                # LAION scale 1-10 -> 0-100
                return round(max(0.0, min(100.0, (s - 1) * 100 / 9)), 2)
            return score
        except Exception as inner:
            print(f"laion v2.5 unavailable ({inner}); skipping", file=sys.stderr); return None
    except Exception as e:
        print(f"laion init failed: {e}", file=sys.stderr); return None


# ---------- METHOD: Cloudflare LLaVA ----------
def make_llava():
    if not (CF_ACCOUNT and CF_TOKEN):
        print("llava skipped: missing CF env", file=sys.stderr); return None
    import httpx
    url = f"https://api.cloudflare.com/client/v4/accounts/{CF_ACCOUNT}/ai/run/@cf/llava-hf/llava-1.5-7b-hf"
    def score(im: Image.Image):
        try:
            buf = io.BytesIO()
            small = im.copy()
            small.thumbnail((512, 512))
            small.save(buf, format="JPEG", quality=85)
            payload = {"image": list(buf.getvalue()), "prompt": JUDGE_RUBRIC + "\nReturn ONLY JSON.", "max_tokens": 256}
            r = httpx.post(url, headers={"Authorization": f"Bearer {CF_TOKEN}"}, json=payload, timeout=45)
            r.raise_for_status()
            text = (r.json().get("result") or {}).get("description") or (r.json().get("result") or {}).get("response") or ""
            m = re.search(r"\{[^{}]*\"composition\"[\s\S]*?\}", text)
            if not m: return None, ""
            cleaned = re.sub(r'\\(?![\\"/bfnrtu])', '', m.group(0))
            data = json.loads(cleaned)
            comp = int(data.get("composition", 0)); craft = int(data.get("craftsmanship", 0))
            integ = int(data.get("anatomy_or_subject_integrity", 0)); wow = int(data.get("wow_factor", 0))
            ai = int(data.get("ai_obvious", 0))
            pos = comp * 1.5 + craft * 3.0 + integ * 2.0 + wow * 3.5
            penalty = max(0.0, ai - 5) * 8.0
            q = round(max(0.0, min(100.0, pos - penalty)), 2)
            return q, f"ai={ai}/10 — {(data.get('verdict') or '')[:120]}"
        except Exception as e:
            return None, f"err: {str(e)[:80]}"
    return score


# ---------- HELPERS ----------
def _has_cuda():
    try:
        import torch; return torch.cuda.is_available()
    except Exception: return False


# ---------- MAIN ----------
def main():
    p = argparse.ArgumentParser()
    p.add_argument("--n", type=int, default=60)
    p.add_argument("--methods", default="shadow,cafe,llava,laion", help="Comma-list of: shadow,cafe,llava,laion")
    p.add_argument("--out", default="scripts/judge-viz/multi.html")
    p.add_argument("--open", action="store_true")
    args = p.parse_args()

    requested = {m.strip() for m in args.methods.split(",") if m.strip()}
    print(f"requested methods: {sorted(requested)}")

    methods = {}
    if "shadow" in requested: methods["shadow"] = make_shadow()
    if "cafe"   in requested: methods["cafe"]   = make_cafe()
    if "laion"  in requested: methods["laion"]  = make_laion()
    if "llava"  in requested: methods["llava"]  = make_llava()
    methods = {k: v for k, v in methods.items() if v}
    if not methods:
        print("no methods loaded", file=sys.stderr); sys.exit(1)
    print(f"loaded methods: {list(methods)}")

    conn = psycopg2.connect(DB_URL)
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute("SELECT id, src, prompt FROM arts WHERE src LIKE %s ORDER BY RANDOM() LIMIT %s", ("http%", args.n))
        rows = cur.fetchall()
    conn.close()
    print(f"sampling {len(rows)} arts")

    results = []
    for i, r in enumerate(rows):
        print(f"  [{i+1}/{len(rows)}] art={r['id']}", flush=True)
        im = fetch_image(r["src"])
        if im is None: continue
        scores = {}
        for name, fn in methods.items():
            t0 = time.time()
            if name == "llava":
                v = fn(im)
                if isinstance(v, tuple):
                    scores[name], scores[f"{name}_note"] = v
                else:
                    scores[name] = v
            else:
                scores[name] = fn(im)
            scores[f"{name}_ms"] = int((time.time() - t0) * 1000)
        results.append({"id": r["id"], "src": r["src"], "prompt": r["prompt"] or "", **scores})

    if not results:
        print("no results"); sys.exit(1)

    # Combined score: simple unweighted mean of available method scores (excluding _ms / _note)
    score_keys = [k for k in methods.keys() if k != "llava"] + (["llava"] if "llava" in methods else [])
    for r in results:
        vals = [r[k] for k in score_keys if isinstance(r.get(k), (int, float))]
        r["combined"] = round(sum(vals) / len(vals), 2) if vals else 0.0

    results.sort(key=lambda r: r["combined"], reverse=True)

    out_path = os.path.abspath(args.out)
    os.makedirs(os.path.dirname(out_path), exist_ok=True)

    def chip(name, v):
        if v is None: return f'<span class="chip none">{name}: —</span>'
        bg = "#1f6f3a" if v >= 70 else ("#a86b00" if v >= 45 else "#8a1f1f")
        return f'<span class="chip" style="background:{bg}">{name}: {v:.0f}</span>'

    def card(r):
        chips = []
        for k in score_keys:
            chips.append(chip(k, r.get(k)))
        note = r.get("llava_note") or ""
        timings = " · ".join(f"{k} {r.get(k+'_ms','?')}ms" for k in score_keys)
        c_score = r["combined"]
        c_bg = "#1f6f3a" if c_score >= 70 else ("#a86b00" if c_score >= 45 else "#8a1f1f")
        return f'''<div class="card">
  <a href="{html.escape(r["src"])}" target="_blank"><img src="{html.escape(r["src"])}" loading="lazy"/></a>
  <div class="combined" style="background:{c_bg}">{c_score:.0f}<span class="lbl">combined</span></div>
  <div class="meta">
    <div class="chips">{"".join(chips)}</div>
    <div class="prompt">{html.escape((r["prompt"] or "")[:140])}</div>
    <div class="note">{html.escape(note[:200])}</div>
    <div class="timings">{html.escape(timings)} · art {r["id"]}</div>
  </div>
</div>'''

    page = f"""<!doctype html>
<html><head><meta charset="utf-8"/><title>AI ArtBase — Multi-method Judge Comparison</title>
<style>
  body {{ background:#0d0e12; color:#e2e2e2; font-family:-apple-system,Segoe UI,sans-serif; margin:0; padding:24px; }}
  h1 {{ font-size:20px; margin:0 0 4px; }}
  .sub {{ color:#888; font-size:13px; margin-bottom:18px; }}
  .legend {{ font-size:12px; color:#aaa; margin-bottom:18px; }}
  .legend span {{ display:inline-block; padding:3px 8px; border-radius:6px; margin-right:8px; color:white; font-weight:600; }}
  .grid {{ display:grid; grid-template-columns:repeat(auto-fill,minmax(260px,1fr)); gap:16px; }}
  .card {{ background:#181a22; border-radius:10px; overflow:hidden; position:relative; }}
  .card img {{ width:100%; height:300px; object-fit:cover; display:block; }}
  .combined {{ position:absolute; top:8px; right:8px; padding:6px 10px; border-radius:6px; color:white; font-weight:700; font-size:18px; }}
  .combined .lbl {{ display:block; font-size:9px; font-weight:500; opacity:0.85; }}
  .meta {{ padding:10px; }}
  .chips {{ display:flex; flex-wrap:wrap; gap:4px; margin-bottom:6px; }}
  .chip {{ font-size:10px; padding:2px 6px; border-radius:4px; color:white; font-weight:600; }}
  .chip.none {{ background:#333; opacity:0.5; }}
  .prompt {{ font-size:11px; color:#9bb; margin-bottom:4px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }}
  .note {{ font-size:10px; color:#bcc; line-height:1.35; margin-bottom:4px; }}
  .timings {{ font-size:9px; color:#555; }}
</style></head>
<body>
  <h1>Multi-method judge comparison · {len(results)} samples · methods: {", ".join(methods)}</h1>
  <div class="sub">Each card shows scores from every loaded method. Combined = unweighted mean. Sorted high → low. Click image for full-res.</div>
  <div class="legend"><span style="background:#1f6f3a">≥70</span><span style="background:#a86b00">45-69</span><span style="background:#8a1f1f">&lt;45</span></div>
  <div class="grid">{"".join(card(r) for r in results)}</div>
</body></html>
"""
    with open(out_path, "w", encoding="utf-8") as f: f.write(page)
    print(f"wrote {out_path} ({len(results)} cards)")
    if args.open:
        webbrowser.open(f"file:///{out_path.replace(os.sep, '/')}")


if __name__ == "__main__":
    main()
