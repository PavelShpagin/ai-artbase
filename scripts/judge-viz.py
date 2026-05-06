#!/usr/bin/env python3
"""
Judge sanity-check visualizer.

Pulls a representative sample of arts (mix of judged + unjudged), runs the same
Gemini judge used in production, and writes a static HTML page where you can
eyeball thumbnail vs score and decide whether the rubric matches your taste.

Usage:
    python scripts/judge-viz.py --n 30                   # 30 random unjudged
    python scripts/judge-viz.py --n 20 --include-judged  # mix already-judged
    python scripts/judge-viz.py --open                   # open in browser

Output: scripts/judge-viz/index.html
"""
import argparse, html, io, json, os, random, sys, time, urllib.request, webbrowser
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
GEMINI_KEY = os.environ["GEMINI_API_KEY"]
JUDGE_MODEL = os.environ.get("JUDGE_MODEL", "gemini-2.5-flash-lite")
genai.configure(api_key=GEMINI_KEY)
MODEL = genai.GenerativeModel(JUDGE_MODEL)

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
        return buf, "image/jpeg"
    try:
        im = Image.open(io.BytesIO(buf)).convert("RGB")
        w, h = im.size
        s = max_px / max(w, h)
        if s < 1:
            im = im.resize((int(w * s), int(h * s)), Image.LANCZOS)
        out = io.BytesIO()
        im.save(out, format="JPEG", quality=85)
        return out.getvalue(), "image/jpeg"
    except Exception:
        return buf, "image/jpeg"


def judge(image_bytes, mime="image/jpeg", retries=2):
    for i in range(retries + 1):
        try:
            resp = MODEL.generate_content(
                [RUBRIC, {"mime_type": mime, "data": image_bytes}],
                generation_config={"temperature": 0.2, "response_mime_type": "application/json"},
            )
            data = json.loads(resp.text.strip())
            for k in ("composition", "craftsmanship", "anatomy_or_subject_integrity", "wow_factor", "ai_obvious"):
                data[k] = max(0, min(10, int(data[k])))
            return data
        except Exception as e:
            if i < retries:
                time.sleep(3 * (i + 1))
                continue
            print(f"  judge failed: {e}", file=sys.stderr)
            return None


def quality(d):
    pos = d["composition"] * 1.5 + d["craftsmanship"] * 3.0 + d["anatomy_or_subject_integrity"] * 2.0 + d["wow_factor"] * 3.5
    pen = max(0.0, d["ai_obvious"] - 5) * 8.0
    return round(max(0.0, min(100.0, pos - pen)), 2)


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--n", type=int, default=30)
    p.add_argument("--include-judged", action="store_true")
    p.add_argument("--open", action="store_true")
    p.add_argument("--out", default="scripts/judge-viz/index.html")
    args = p.parse_args()

    conn = psycopg2.connect(DB_URL)
    where = "WHERE src LIKE 'http%'"
    if not args.include_judged:
        where += " AND judged_at IS NULL"
    sql = f"SELECT id, src, prompt, quality_score, ai_obvious_score, judge_notes FROM arts {where} ORDER BY RANDOM() LIMIT %s"
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(sql, (args.n,))
        rows = cur.fetchall()
    conn.close()

    print(f"=== Judging {len(rows)} sample arts ===")
    judged = []
    for i, r in enumerate(rows):
        print(f"  [{i+1}/{len(rows)}] art={r['id']}")
        if r["quality_score"] is not None and r["judge_notes"]:
            judged.append({
                "art": dict(r),
                "score": r["quality_score"],
                "ai": r["ai_obvious_score"] or 0,
                "verdict": r["judge_notes"],
            })
            continue
        raw = fetch_image_bytes(r["src"])
        if not raw:
            continue
        small, mime = downscale(raw)
        d = judge(small, mime)
        if not d:
            continue
        s = quality(d)
        verdict = (
            f"comp={d['composition']} craft={d['craftsmanship']} "
            f"integrity={d['anatomy_or_subject_integrity']} wow={d['wow_factor']} ai={d['ai_obvious']} | "
            f"{(d.get('verdict') or '')[:200]}"
        )
        judged.append({"art": dict(r), "score": s, "ai": d["ai_obvious"], "verdict": verdict})
        time.sleep(0.4)

    # Sort high → low so eye-test starts with best
    judged.sort(key=lambda x: x["score"], reverse=True)

    out_path = os.path.abspath(args.out)
    os.makedirs(os.path.dirname(out_path), exist_ok=True)

    cards = []
    for j in judged:
        a = j["art"]
        score = j["score"]
        ai = j["ai"]
        bg = "#1f6f3a" if score >= 75 else ("#a86b00" if score >= 55 else "#8a1f1f")
        cards.append(f'''<div class="card">
  <a href="{html.escape(a["src"])}" target="_blank"><img src="{html.escape(a["src"])}" loading="lazy"/></a>
  <div class="overlay" style="background:{bg}">{score:.0f}<span class="ai">ai {ai:.0f}/10</span></div>
  <div class="meta"><div class="prompt">{html.escape((a.get("prompt") or "")[:140])}</div>
    <div class="verdict">{html.escape(j["verdict"])}</div>
    <div class="id">art {a["id"]}</div>
  </div>
</div>''')

    page = f"""<!doctype html>
<html><head><meta charset="utf-8"/><title>AI ArtBase — Judge Sanity Check</title>
<style>
  body {{ background:#0d0e12; color:#e2e2e2; font-family:-apple-system,Segoe UI,sans-serif; margin:0; padding:24px; }}
  h1 {{ font-size:20px; margin:0 0 6px; }}
  .sub {{ color:#888; font-size:13px; margin-bottom:18px; }}
  .legend {{ font-size:12px; color:#aaa; margin-bottom:18px; }}
  .legend span {{ display:inline-block; padding:3px 8px; border-radius:6px; margin-right:8px; color:white; font-weight:600; }}
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
  <h1>AI ArtBase — Judge sanity check</h1>
  <div class="sub">{len(judged)} samples · model {JUDGE_MODEL} · sorted high → low · click any image to open full-res</div>
  <div class="legend">
    <span style="background:#1f6f3a">≥75 premium</span>
    <span style="background:#a86b00">55-74 curated</span>
    <span style="background:#8a1f1f">&lt;55 reject</span>
  </div>
  <div class="grid">{"".join(cards)}</div>
</body></html>
"""
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(page)
    print(f"=== wrote {out_path} ({len(judged)} cards) ===")
    if args.open:
        webbrowser.open(f"file:///{out_path.replace(os.sep, '/')}")


if __name__ == "__main__":
    main()
