#!/usr/bin/env python3
"""
Final-pipeline quality scorer for AI ArtBase.

Pipeline (decided after multi-method comparison — see scripts/judge-multi.py):
  - LAION aesthetic-predictor v2.5 SigLIP   (primary, weight 0.55) — calibrated 1-10 -> 0-100
  - cafeai/cafe_aesthetic                   (secondary, weight 0.25) — general aesthetic ViT
  - aesthetic-shadow-v2                     (specialist, weight 0.20) — AI-art HQ ViT
  - LLaVA via Cloudflare                    (verbal verdict only — NOT used in score)

LLaVA produces narrow-band noisy scores (stdev 4.5, r≈0.13 vs aesthetics) so it's dropped
from the ranking signal. We still call it once per art so each row has a human-readable
"why this scored as it did" string.

Usage:
  python scripts/judge_v2.py --limit 200                  # judge 200 fresh
  python scripts/judge_v2.py --rejudge --limit 100        # re-score
  python scripts/judge_v2.py --skip-llava --limit 1000    # fast pass, no verdict text
"""
import argparse, io, json, os, re, sys, time, urllib.request
from datetime import datetime
import psycopg2
from psycopg2.extras import RealDictCursor
from PIL import Image

DB_URL = os.environ["NEON_DATABASE_URL_DIRECT"]
CF_ACCOUNT = os.environ.get("CLOUDFLARE_ACCOUNT_ID")
CF_TOKEN = os.environ.get("CLOUDFLARE_API_TOKEN")

# Weights — chosen after multi-method correlation study (see judge-multi.py).
# shadow (AI-art HQ specialist) is the strongest signal; cafe has the widest
# dynamic range (best at flagging slop); LAION is the calibrated baseline.
W_SHADOW = 0.45
W_CAFE   = 0.30
W_LAION  = 0.25

UA = "aiartbase-judge-v2/1.0"

JUDGE_RUBRIC = """Rate this AI-generated image briefly. Return STRICT JSON ONLY:
{"ai_obvious": <int 0-10>, "verdict": "<one short sentence, max 120 chars, plain English>"}
ai_obvious: 0 = looks intentional/handmade, 10 = textbook AI slop (plastic skin, dead eyes, fused fingers, smear backgrounds, broken text)."""


def fetch_image(url, max_bytes=4_000_000, timeout=20):
    try:
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=timeout) as r:
            data = r.read(max_bytes + 1)
        if len(data) > max_bytes: return None
        return Image.open(io.BytesIO(data)).convert("RGB")
    except Exception:
        return None


# ------------- model loaders -------------
def load_laion():
    import torch
    from aesthetic_predictor_v2_5 import convert_v2_5_from_siglip
    print("loading LAION aesthetic-predictor v2.5 ...", file=sys.stderr)
    model, preprocessor = convert_v2_5_from_siglip(low_cpu_mem_usage=True, trust_remote_code=True)
    device = "cuda" if torch.cuda.is_available() else "cpu"
    if device == "cuda":
        model = model.to(torch.bfloat16)
    model = model.to(device).eval()
    def score(im):
        try:
            px = preprocessor(images=im, return_tensors="pt").pixel_values.to(model.device)
            if device == "cuda": px = px.to(torch.bfloat16)
            with torch.inference_mode():
                s = model(px).logits.squeeze().float().cpu().item()
            return float(s), round(max(0.0, min(100.0, (s - 1) * 100 / 9)), 2)
        except Exception as e:
            print(f"  laion err: {e}", file=sys.stderr); return None, None
    return score


def load_cafe():
    from transformers import pipeline
    import torch
    print("loading cafe_aesthetic ...", file=sys.stderr)
    pipe = pipeline("image-classification", model="cafeai/cafe_aesthetic",
                    device=0 if torch.cuda.is_available() else -1)
    def score(im):
        try:
            out = pipe(im, top_k=3)
            aes = next((x["score"] for x in out if x["label"].lower().startswith("aesthetic")), 0.0)
            return round(aes * 100, 2)
        except Exception as e:
            print(f"  cafe err: {e}", file=sys.stderr); return None
    return score


def load_shadow():
    from transformers import pipeline
    import torch
    print("loading shadow aesthetic-shadow-v2 ...", file=sys.stderr)
    pipe = pipeline("image-classification", model="NeoChen1024/aesthetic-shadow-v2-backup",
                    device=0 if torch.cuda.is_available() else -1)
    def score(im):
        try:
            out = pipe(im, top_k=2)
            hq = next((x["score"] for x in out if x["label"].lower() in ("hq", "high_quality", "high")), 0.0)
            return round(hq * 100, 2)
        except Exception as e:
            print(f"  shadow err: {e}", file=sys.stderr); return None
    return score


def call_llava(im):
    """Returns (ai_obvious 0-10 int, verdict str) or (None, '')."""
    if not (CF_ACCOUNT and CF_TOKEN): return None, ""
    import httpx
    url = f"https://api.cloudflare.com/client/v4/accounts/{CF_ACCOUNT}/ai/run/@cf/llava-hf/llava-1.5-7b-hf"
    try:
        buf = io.BytesIO()
        small = im.copy(); small.thumbnail((512, 512))
        small.save(buf, format="JPEG", quality=85)
        payload = {"image": list(buf.getvalue()), "prompt": JUDGE_RUBRIC + "\nReturn ONLY JSON.", "max_tokens": 200}
        r = httpx.post(url, headers={"Authorization": f"Bearer {CF_TOKEN}"}, json=payload, timeout=45)
        r.raise_for_status()
        text = (r.json().get("result") or {}).get("description") or (r.json().get("result") or {}).get("response") or ""
        m = re.search(r"\{[\s\S]*?\}", text)
        if not m: return None, ""
        cleaned = re.sub(r'\\(?![\\"/bfnrtu])', '', m.group(0))
        data = json.loads(cleaned)
        ai = max(0, min(10, int(data.get("ai_obvious", 5))))
        verdict = (data.get("verdict") or "")[:200]
        return ai, verdict
    except Exception as e:
        return None, f"err:{str(e)[:60]}"


def combine(laion_pct, cafe_pct, shadow_pct):
    """Weighted blend; missing methods are dropped and weights renormalized."""
    parts = []
    if laion_pct  is not None: parts.append((W_LAION,  laion_pct))
    if cafe_pct   is not None: parts.append((W_CAFE,   cafe_pct))
    if shadow_pct is not None: parts.append((W_SHADOW, shadow_pct))
    if not parts: return None
    wsum = sum(w for w, _ in parts)
    return round(sum(w * v for w, v in parts) / wsum, 2)


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--limit", type=int, default=100)
    p.add_argument("--rejudge", action="store_true")
    p.add_argument("--skip-llava", action="store_true", help="Skip LLaVA verdict for speed")
    p.add_argument("--id-from", type=int, default=0)
    args = p.parse_args()

    laion = load_laion()
    cafe  = load_cafe()
    shadow = load_shadow()

    conn = psycopg2.connect(DB_URL)
    where = "WHERE src LIKE %s"
    params = ["http%"]
    if args.id_from:
        where += " AND id >= %s"; params.append(args.id_from)
    if not args.rejudge:
        where += " AND judged_at IS NULL"
    sql = f"SELECT id, src, prompt FROM arts {where} ORDER BY id LIMIT %s"
    params.append(args.limit)
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(sql, tuple(params))
        rows = cur.fetchall()
    print(f"=== judging {len(rows)} arts (LAION primary + cafe + shadow{', LLaVA verdict' if not args.skip_llava else ''}) ===")

    ok = fail = 0
    t0 = time.time()
    for i, r in enumerate(rows):
        im = fetch_image(r["src"])
        if im is None:
            fail += 1; continue
        try:
            laion_raw, laion_pct = laion(im)
        except Exception as e:
            laion_raw, laion_pct = None, None
        cafe_pct = cafe(im)
        shadow_pct = shadow(im)
        quality = combine(laion_pct, cafe_pct, shadow_pct)
        if quality is None:
            fail += 1; continue
        if not args.skip_llava:
            ai, verdict = call_llava(im)
        else:
            ai, verdict = None, ""
        notes = (
            f"LAION={laion_pct} cafe={cafe_pct} shadow={shadow_pct}"
            + (f" ai_obvious={ai}/10" if ai is not None else "")
            + (f" | {verdict}" if verdict else "")
        )[:240]
        try:
            with conn.cursor() as cur:
                cur.execute("""
                    UPDATE arts SET
                      aesthetic_score = %s,
                      ai_obvious_score = %s,
                      quality_score = %s,
                      judge_notes = %s,
                      judged_at = NOW()
                    WHERE id = %s
                """, (
                    laion_raw if laion_raw is not None else (laion_pct / 10 if laion_pct else None),
                    float(ai) if ai is not None else None,
                    quality,
                    notes,
                    r["id"],
                ))
            conn.commit()
            ok += 1
        except Exception as e:
            conn.rollback(); fail += 1
            print(f"  db update failed for {r['id']}: {e}", file=sys.stderr)
        if (i + 1) % 25 == 0:
            rate = (i + 1) / max(0.001, time.time() - t0)
            print(f"  {i+1}/{len(rows)} ok={ok} fail={fail} {rate:.2f} img/s", flush=True)

    elapsed = time.time() - t0
    print(f"=== done: ok={ok} fail={fail} in {elapsed:.1f}s ({ok/max(0.001,elapsed):.2f} img/s) ===")

    # Recompute is_curated / is_premium thresholds
    print("=== recomputing curated/premium tiers ===")
    with conn.cursor() as cur:
        cur.execute("UPDATE arts SET is_curated=false, is_premium=false WHERE judged_at IS NOT NULL")
        cur.execute("""
            WITH q AS (
              SELECT id, NTILE(10) OVER (ORDER BY quality_score DESC NULLS LAST) AS dec
              FROM arts WHERE judged_at IS NOT NULL
            )
            UPDATE arts SET is_curated = true WHERE id IN (SELECT id FROM q WHERE dec <= 3)
        """)
        cur.execute("""
            WITH q AS (
              SELECT id, NTILE(20) OVER (ORDER BY quality_score DESC NULLS LAST) AS bucket
              FROM arts WHERE judged_at IS NOT NULL
            )
            UPDATE arts SET is_premium = true WHERE id IN (SELECT id FROM q WHERE bucket <= 1)
        """)
        cur.execute("SELECT COUNT(*) FILTER(WHERE judged_at IS NOT NULL), COUNT(*) FILTER(WHERE is_curated), COUNT(*) FILTER(WHERE is_premium) FROM arts")
        j, c, pm = cur.fetchone()
    conn.commit()
    print(f"  judged={j} curated={c} premium={pm}")
    conn.close()


if __name__ == "__main__":
    main()
