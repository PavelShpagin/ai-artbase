#!/usr/bin/env python3
"""
Final stratified visualization of the catalog by quality_score.

Renders 11 bands (0-9%, 10-19%, ..., 90-100%), N samples per band, sorted
within band by quality_score descending. Lets you eyeball whether the score
matches your eye across the full quality spectrum.

Pulls existing scores from the database — does NOT call any judge model. Run
scripts/judge_v2.py first to populate scores.

Usage:
  python scripts/judge-viz-final.py --per-band 8       # 8 samples each band
  python scripts/judge-viz-final.py --per-band 5 --open
"""
import argparse, html, os, sys, webbrowser
import psycopg2
from psycopg2.extras import RealDictCursor

DB_URL = os.environ["NEON_DATABASE_URL_DIRECT"]


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--per-band", type=int, default=8)
    p.add_argument("--out", default="scripts/judge-viz/final.html")
    p.add_argument("--open", action="store_true")
    args = p.parse_args()

    conn = psycopg2.connect(DB_URL)
    bands = []  # band -> list of rows
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        for lo in range(0, 101, 10):
            hi = lo + 9 if lo < 100 else 100
            cur.execute("""
                SELECT id, src, prompt, quality_score, ai_obvious_score, judge_notes
                FROM arts
                WHERE judged_at IS NOT NULL AND quality_score >= %s AND quality_score <= %s
                  AND src LIKE %s
                ORDER BY RANDOM() LIMIT %s
            """, (lo, hi, "http%", args.per_band))
            bands.append({"lo": lo, "hi": hi, "rows": cur.fetchall()})
        cur.execute("SELECT COUNT(*) FROM arts WHERE judged_at IS NOT NULL")
        total_judged = cur.fetchone()["count"]
    conn.close()

    out_path = os.path.abspath(args.out)
    os.makedirs(os.path.dirname(out_path), exist_ok=True)

    def card(r):
        q = r["quality_score"] or 0
        ai = r["ai_obvious_score"] or 0
        bg = "#1f6f3a" if q >= 70 else ("#a86b00" if q >= 45 else "#8a1f1f")
        notes = r["judge_notes"] or ""
        return f'''<div class="card">
  <a href="{html.escape(r["src"])}" target="_blank"><img src="{html.escape(r["src"])}" loading="lazy"/></a>
  <div class="badge" style="background:{bg}">{q:.0f}%<span class="ai">ai {ai:.0f}/10</span></div>
  <div class="meta"><div class="prompt">{html.escape((r.get("prompt") or "")[:120])}</div>
    <div class="notes">{html.escape(notes[:200])}</div>
  </div>
</div>'''

    blocks = []
    for b in bands:
        if not b["rows"]:
            blocks.append(f'<h2 class="hdr">{b["lo"]}-{b["hi"]}% <span class="empty">(no samples)</span></h2>')
            continue
        blocks.append(
            f'<h2 class="hdr">{b["lo"]}-{b["hi"]}%  <span class="count">({len(b["rows"])} of {args.per_band})</span></h2>'
            f'<div class="grid">{"".join(card(r) for r in b["rows"])}</div>'
        )

    page = f"""<!doctype html>
<html><head><meta charset="utf-8"/><title>AI ArtBase — Quality Bands</title>
<style>
  body {{ background:#0d0e12; color:#e2e2e2; font-family:-apple-system,Segoe UI,sans-serif; margin:0; padding:24px; }}
  h1 {{ font-size:22px; margin:0 0 4px; }}
  .sub {{ color:#888; font-size:13px; margin-bottom:18px; }}
  .legend {{ font-size:12px; color:#aaa; margin-bottom:24px; }}
  .legend span {{ display:inline-block; padding:3px 8px; border-radius:6px; margin-right:8px; color:white; font-weight:600; }}
  .hdr {{ font-size:15px; margin:24px 0 10px; padding-bottom:6px; border-bottom:1px solid #222; color:#cbd; }}
  .hdr .count {{ color:#666; font-weight:400; font-size:12px; }}
  .hdr .empty {{ color:#555; font-weight:400; font-size:12px; font-style:italic; }}
  .grid {{ display:grid; grid-template-columns:repeat(auto-fill,minmax(220px,1fr)); gap:14px; }}
  .card {{ background:#181a22; border-radius:10px; overflow:hidden; position:relative; }}
  .card img {{ width:100%; height:240px; object-fit:cover; display:block; }}
  .badge {{ position:absolute; top:8px; right:8px; padding:6px 10px; border-radius:6px; color:white; font-weight:700; font-size:18px; }}
  .badge .ai {{ display:block; font-size:10px; font-weight:500; opacity:0.85; }}
  .meta {{ padding:10px; }}
  .prompt {{ font-size:11px; color:#9bb; margin-bottom:4px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }}
  .notes {{ font-size:10px; color:#cdc; line-height:1.35; }}
</style></head>
<body>
  <h1>AI ArtBase — quality bands (final scorer)</h1>
  <div class="sub">{total_judged} arts judged · {sum(1 for b in bands if b["rows"])}/11 bands populated · LAION + cafe + shadow blend · click image for full-res</div>
  <div class="legend"><span style="background:#1f6f3a">≥70</span><span style="background:#a86b00">45-69</span><span style="background:#8a1f1f">&lt;45</span></div>
  {"".join(blocks)}
</body></html>
"""
    with open(out_path, "w", encoding="utf-8") as f: f.write(page)
    print(f"wrote {out_path}")
    if args.open:
        webbrowser.open(f"file:///{out_path.replace(os.sep, '/')}")


if __name__ == "__main__":
    main()
