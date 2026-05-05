#!/usr/bin/env python3
"""
Gemini Vision quality judge for AI ArtBase.

Reads arts from Neon, scores each via Gemini, writes back:
  aesthetic_score   (0-10) overall visual appeal
  ai_obvious_score  (0-10, INVERSE) 10 = obviously AI slop, 0 = looks intentional/handmade
  quality_score     (0-100) combined heuristic
  is_curated        (bool) top ~30% threshold
  is_premium        (bool) top ~5% threshold
  judge_notes       (text) one-sentence verdict
  judged_at         (timestamp)

Usage:
    python scripts/judge-arts.py --limit 30           # try a small batch
    python scripts/judge-arts.py --limit 30 --rejudge # re-score even already-judged
    python scripts/judge-arts.py                       # full catalog (skip already-judged)
    python scripts/judge-arts.py --sample 20 --print   # interactive sample mode for prompt iteration

Env required:
    GEMINI_API_KEY
    NEON_DATABASE_URL_DIRECT
"""
import argparse, json, os, sys, time, urllib.request, base64, io, re
from datetime import datetime
import psycopg2
from psycopg2.extras import RealDictCursor

# Optional Pillow for image preprocessing — if missing we just send raw bytes
try:
    from PIL import Image
    HAS_PIL = True
except Exception:
    HAS_PIL = False

import google.generativeai as genai

DB_URL = os.environ["NEON_DATABASE_URL_DIRECT"]
GEMINI_KEY = os.environ["GEMINI_API_KEY"]
JUDGE_MODEL = os.environ.get("JUDGE_MODEL", "gemini-2.5-flash-lite")

genai.configure(api_key=GEMINI_KEY)
MODEL = genai.GenerativeModel(JUDGE_MODEL)

JUDGE_RUBRIC = """You are a senior art director reviewing AI-generated images for inclusion in a premium curated gallery called AI ArtBase. Your job is to spot AI slop and only let through images that look genuinely intentional and well-crafted — work that a designer would actually use as a reference.

Look at the image carefully and rate it on FOUR axes, then return STRICT JSON ONLY (no markdown, no commentary).

Axes (each 0–10, integers):
1. **composition** — focal point, framing, balance, depth. Random center-crop AI default = 4–5. Strong intentional composition = 8–10.
2. **craftsmanship** — fine detail, texture quality, lighting coherence, consistent style. Smeared/plasticky/over-smoothed = 2–4. Sharp, deliberate detail = 8–10.
3. **anatomy_or_subject_integrity** — for images with humans/animals: are hands, faces, eyes, proportions correct? For non-figurative: is the subject coherent (no melting structures, broken perspective)? Severe issues (extra fingers, melted faces, broken architecture) = 1–3. Flawless = 9–10.
4. **wow_factor** — would a working designer or artist show this to a peer? Generic anime/portrait/landscape = 3–5. Striking, memorable, original = 8–10.

Then ONE more score:
5. **ai_obvious** (0–10, INVERSE — HIGHER = MORE OBVIOUSLY AI) — telltale signs: plastic skin, dead eyes, identical faces, "diffusion smear" backgrounds, broken text, fused fingers, generic lighting, oversaturated colors, predictable bokeh. 0 = could pass for human-made/intentional editorial, 10 = textbook AI slop.

Return EXACTLY this JSON shape, nothing else:
{
  "composition": <int 0-10>,
  "craftsmanship": <int 0-10>,
  "anatomy_or_subject_integrity": <int 0-10>,
  "wow_factor": <int 0-10>,
  "ai_obvious": <int 0-10>,
  "verdict": "<one short sentence, max 120 chars, plain English why this scored as it did>"
}

Be strict. Most AI-art-site uploads are slop. Default is mediocrity; reserve 9–10 for genuinely impressive work."""


def fetch_image_bytes(url: str, max_bytes=4_000_000, timeout=20) -> bytes | None:
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "aiartbase-judge/1.0"})
        with urllib.request.urlopen(req, timeout=timeout) as r:
            data = r.read(max_bytes + 1)
        if len(data) > max_bytes:
            return None
        return data
    except Exception as e:
        print(f"  download failed for {url[:80]}: {e}", file=sys.stderr)
        return None


def downscale(buf: bytes, max_px=896) -> tuple[bytes, str]:
    """Resize to keep <=max_px on the long edge; saves Gemini cost without losing judgement quality."""
    if not HAS_PIL or not buf:
        return buf, "image/jpeg"
    try:
        im = Image.open(io.BytesIO(buf))
        im = im.convert("RGB")
        w, h = im.size
        s = max_px / max(w, h)
        if s < 1:
            im = im.resize((int(w * s), int(h * s)), Image.LANCZOS)
        out = io.BytesIO()
        im.save(out, format="JPEG", quality=85)
        return out.getvalue(), "image/jpeg"
    except Exception:
        return buf, "image/jpeg"


def judge(image_bytes: bytes, mime: str = "image/jpeg", max_retries: int = 3) -> dict | None:
    """Call Gemini, parse JSON, return dict or None. Retries on 429 with backoff parsed from error."""
    for attempt in range(max_retries + 1):
        try:
            resp = MODEL.generate_content(
                [
                    JUDGE_RUBRIC,
                    {"mime_type": mime, "data": image_bytes},
                ],
                generation_config={"temperature": 0.2, "response_mime_type": "application/json"},
            )
            text = resp.text.strip()
            text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text, flags=re.S)
            data = json.loads(text)
            for k in ("composition", "craftsmanship", "anatomy_or_subject_integrity", "wow_factor", "ai_obvious"):
                if k not in data:
                    return None
                data[k] = max(0, min(10, int(data[k])))
            data["verdict"] = (data.get("verdict") or "")[:240]
            return data
        except Exception as e:
            msg = str(e)
            if "429" in msg or "quota" in msg.lower() or "rate" in msg.lower():
                # Try to parse server-suggested retry delay; default exponential
                m = re.search(r"retry_delay\s*\{\s*seconds:\s*(\d+)", msg) or re.search(r"in\s+([\d.]+)s", msg)
                wait = float(m.group(1)) if m else (5 * (2 ** attempt))
                wait = min(wait + 1.0, 90.0)
                if attempt < max_retries:
                    print(f"  rate-limited; sleeping {wait:.1f}s (attempt {attempt+1}/{max_retries})", file=sys.stderr)
                    time.sleep(wait)
                    continue
            print(f"  gemini call failed: {msg[:200]}", file=sys.stderr)
            return None
    return None


def combined_quality(d: dict) -> float:
    """Combine the 5 axes into a single 0-100 quality score.
    Higher = more premium-worthy.
    ai_obvious is inverted (so 10/10 ai_obvious -> -10 contribution).
    Weights: craftsmanship + wow_factor matter most; ai_obvious is a heavy penalty.
    """
    composition = d["composition"]
    crafts = d["craftsmanship"]
    integrity = d["anatomy_or_subject_integrity"]
    wow = d["wow_factor"]
    ai = d["ai_obvious"]
    # Sum weighted positives (max 100), penalize ai_obvious heavily
    pos = composition * 1.5 + crafts * 3.0 + integrity * 2.0 + wow * 3.5  # max = 15+30+20+35 = 100
    penalty = max(0.0, ai - 5) * 8.0   # past 5 each point hurts; ai=10 -> -40
    score = max(0.0, min(100.0, pos - penalty))
    return round(score, 2)


def update_art_score(conn, art_id: int, d: dict, score: float):
    crafts = d["craftsmanship"]
    composition = d["composition"]
    integrity = d["anatomy_or_subject_integrity"]
    wow = d["wow_factor"]
    aesthetic = round((composition + crafts + integrity + wow) / 4.0, 2)
    ai_obvious = float(d["ai_obvious"])
    notes = (
        f"comp={composition} craft={crafts} integrity={integrity} wow={wow} "
        f"ai={ai_obvious:.0f} | {d.get('verdict','')}"
    )
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE arts SET
              aesthetic_score = %s,
              ai_obvious_score = %s,
              quality_score = %s,
              judge_notes = %s,
              judged_at = NOW()
            WHERE id = %s
            """,
            (aesthetic, ai_obvious, score, notes, art_id),
        )
    conn.commit()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=0, help="Max images to judge this run (0 = all)")
    parser.add_argument("--rejudge", action="store_true", help="Re-score even if already judged")
    parser.add_argument("--sample", type=int, default=0, help="Random sample N for prompt-iteration mode")
    parser.add_argument("--print", action="store_true", help="Print verdicts inline (for iteration)")
    parser.add_argument("--sleep", type=float, default=0.4, help="Delay between calls")
    parser.add_argument("--id-from", type=int, default=0, help="Only judge ids >= this")
    args = parser.parse_args()

    conn = psycopg2.connect(DB_URL)
    where = "WHERE src IS NOT NULL AND src LIKE 'http%'"
    params: list = []
    if args.id_from:
        where += " AND id >= %s"
        params.append(args.id_from)
    if not args.rejudge:
        where += " AND judged_at IS NULL"
    if args.sample:
        order = "ORDER BY RANDOM()"
        limit = args.sample
    else:
        order = "ORDER BY id"
        limit = args.limit if args.limit > 0 else None

    sql = f"SELECT id, src, prompt FROM arts {where} {order}"
    if limit:
        sql += f" LIMIT {limit}"
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        if params:
            cur.execute(sql, tuple(params))
        else:
            cur.execute(sql)
        rows = cur.fetchall()

    print(f"=== Judging {len(rows)} images via {JUDGE_MODEL} ===")
    success = fail = 0
    t0 = time.time()
    for i, r in enumerate(rows):
        if args.print:
            print(f"[{i+1}/{len(rows)}] art={r['id']} src={r['src'][:90]}")
        raw = fetch_image_bytes(r["src"])
        if not raw:
            fail += 1
            continue
        small, mime = downscale(raw)
        d = judge(small, mime)
        if not d:
            fail += 1
            time.sleep(args.sleep)
            continue
        score = combined_quality(d)
        update_art_score(conn, r["id"], d, score)
        success += 1
        if args.print:
            print(f"   score={score:5.1f}  {d.get('verdict','')[:140]}")
        else:
            if (i + 1) % 25 == 0:
                rate = (i + 1) / max(0.001, time.time() - t0)
                print(f"  {i+1}/{len(rows)}  ok={success} fail={fail}  {rate:.2f} img/s")
        time.sleep(args.sleep)

    print(f"=== done: ok={success} fail={fail}  in {time.time()-t0:.1f}s ===")

    # Final pass: re-mark is_curated / is_premium thresholds
    print("=== recomputing is_curated / is_premium thresholds ===")
    with conn.cursor() as cur:
        # Reset
        cur.execute("UPDATE arts SET is_curated = false, is_premium = false WHERE judged_at IS NOT NULL")
        # Curated = top 30% by quality_score (among judged + non-empty src)
        cur.execute(
            """
            WITH q AS (
              SELECT id, NTILE(10) OVER (ORDER BY quality_score DESC NULLS LAST) AS dec
              FROM arts WHERE judged_at IS NOT NULL
            )
            UPDATE arts SET is_curated = true WHERE id IN (SELECT id FROM q WHERE dec <= 3);
            """
        )
        cur.execute(
            """
            WITH q AS (
              SELECT id, NTILE(20) OVER (ORDER BY quality_score DESC NULLS LAST) AS bucket
              FROM arts WHERE judged_at IS NOT NULL
            )
            UPDATE arts SET is_premium = true WHERE id IN (SELECT id FROM q WHERE bucket <= 1);
            """
        )
        cur.execute("SELECT COUNT(*) FILTER (WHERE judged_at IS NOT NULL) judged, COUNT(*) FILTER (WHERE is_curated) curated, COUNT(*) FILTER (WHERE is_premium) premium FROM arts;")
        row = cur.fetchone()
    conn.commit()
    print(f"  judged={row[0]} curated={row[1]} premium={row[2]}")
    conn.close()


if __name__ == "__main__":
    main()
