/**
 * Multi-source AI image scraper.
 * Sources implemented: Civitai (REST), Lexica (REST), Mage.space (HTML).
 * Sources stubbed (TODO Puppeteer-stealth): PromptHero, Tensor.art, OpenArt, SeaArt.
 *
 * Each source produces normalized records:
 *   { src, prompt, width, height, source, sourceId, link }
 *
 * The dispatcher dedups via the backend /check_processed_link/ endpoint,
 * downloads the image, then POSTs it to /arts/ + records the link.
 *
 * Env:
 *   API_URL                 backend root, e.g. https://api.aiartbase.com
 *   OWNER_ID                user id to assign scraped art to (default 4)
 *   CIVITAI_API_KEY         optional, increases rate limits
 *   PER_SOURCE_LIMIT        per-source page count this run (default 200)
 *   SLEEP_MS                delay between API calls (default 1000)
 */
require("dotenv").config();
const axios = require("axios");
const FormData = require("form-data");
const path = require("path");
const crypto = require("crypto");

const API_URL = process.env.API_URL || "http://localhost:8000";
const OWNER_ID = parseInt(process.env.OWNER_ID || "4", 10);
const CIVITAI_API_KEY = process.env.CIVITAI_API_KEY || "";
const PER_SOURCE_LIMIT = parseInt(process.env.PER_SOURCE_LIMIT || "200", 10);
const SLEEP_MS = parseInt(process.env.SLEEP_MS || "1000", 10);
const UA = "aiartbase-scraper/2.0 (+https://aiartbase.com)";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function isProcessed(link) {
  try {
    const r = await axios.get(`${API_URL}/check_processed_link/`, {
      params: { link },
      timeout: 10000,
    });
    return r.data === true || r.data?.exists === true;
  } catch (e) {
    if (e.response?.status === 404) return false;
    return false;
  }
}

async function markProcessed(link) {
  try {
    await axios.post(`${API_URL}/processed_links/`, null, {
      params: { link },
      timeout: 10000,
    });
  } catch (e) {
    // non-fatal
  }
}

async function downloadAsBuffer(url) {
  const r = await axios.get(url, {
    responseType: "arraybuffer",
    headers: { "User-Agent": UA },
    timeout: 30000,
    maxContentLength: 25 * 1024 * 1024, // 25 MB cap
  });
  return Buffer.from(r.data);
}

async function postArt({ buffer, filename, prompt, contentType }) {
  const fd = new FormData();
  fd.append("prompt", prompt || "");
  fd.append("owner_id", String(OWNER_ID));
  fd.append("image", buffer, { filename, contentType });
  await axios.post(`${API_URL}/arts/`, fd, {
    headers: { ...fd.getHeaders() },
    timeout: 90000,
    maxContentLength: 50 * 1024 * 1024,
    maxBodyLength: 50 * 1024 * 1024,
  });
}

function pickContentType(url) {
  const ext = (path.extname(new URL(url).pathname) || ".jpeg").toLowerCase();
  if (ext === ".png") return ["image/png", ".png"];
  if (ext === ".webp") return ["image/webp", ".webp"];
  if (ext === ".gif") return ["image/gif", ".gif"];
  return ["image/jpeg", ".jpeg"];
}

function safeFilename(source, sourceId, ext) {
  const id = String(sourceId).replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 80);
  return `${source}_${id}${ext}`;
}

// ---------- SOURCE: Civitai ----------
async function* sourceCivitai({ limit }) {
  let cursor = undefined;
  let pulled = 0;
  while (pulled < limit) {
    const params = { limit: 100, sort: "Most Reactions", nsfw: "None" };
    if (cursor) params.cursor = cursor;
    const headers = { "User-Agent": UA };
    if (CIVITAI_API_KEY) headers["Authorization"] = `Bearer ${CIVITAI_API_KEY}`;
    let resp;
    try {
      resp = await axios.get("https://civitai.com/api/v1/images", { params, headers, timeout: 30000 });
    } catch (e) {
      console.error(`[civitai] request failed: ${e.response?.status} ${e.message}`);
      return;
    }
    const items = resp.data?.items || [];
    if (!items.length) return;
    for (const it of items) {
      if (pulled >= limit) return;
      if (!it.url) continue;
      const meta = it.meta || {};
      yield {
        source: "civitai",
        sourceId: String(it.id),
        link: it.url,
        src: it.url,
        prompt: meta.prompt || "",
        width: it.width || 0,
        height: it.height || 0,
      };
      pulled += 1;
    }
    cursor = resp.data?.metadata?.nextCursor;
    if (!cursor) return;
    await sleep(SLEEP_MS);
  }
}

// ---------- SOURCE: Lexica ----------
async function* sourceLexica({ limit }) {
  // Lexica search API: 50 results per query. We rotate seed queries to get variety.
  const queries = [
    "cinematic", "portrait", "landscape", "anime", "cyberpunk",
    "fantasy", "sci-fi", "watercolor", "oil painting", "concept art",
    "photorealistic", "magical", "dragon", "warrior", "abstract",
  ];
  let pulled = 0;
  for (const q of queries) {
    if (pulled >= limit) return;
    let resp;
    try {
      resp = await axios.get("https://lexica.art/api/v1/search", {
        params: { q },
        headers: { "User-Agent": UA },
        timeout: 30000,
      });
    } catch (e) {
      console.error(`[lexica] query "${q}" failed: ${e.response?.status} ${e.message}`);
      continue;
    }
    const images = resp.data?.images || [];
    for (const it of images) {
      if (pulled >= limit) return;
      if (!it.srcSmall && !it.src) continue;
      yield {
        source: "lexica",
        sourceId: String(it.id),
        link: it.src || it.srcSmall,
        src: it.src || it.srcSmall,
        prompt: it.prompt || "",
        width: it.width || 0,
        height: it.height || 0,
      };
      pulled += 1;
    }
    await sleep(SLEEP_MS);
  }
}

// ---------- SOURCE: Mage.space (best-effort HTML) ----------
async function* sourceMage({ limit }) {
  // Mage public gallery; no official API. Fetch the public feed and parse JSON-LD.
  // Best-effort: skip on any error.
  try {
    const resp = await axios.get("https://www.mage.space/api/v3/images/feed", {
      params: { limit: Math.min(100, limit), filter: "best", interval: "week" },
      headers: { "User-Agent": UA, Accept: "application/json" },
      timeout: 30000,
    });
    const items = resp.data?.results || resp.data?.items || resp.data || [];
    let pulled = 0;
    for (const it of items) {
      if (pulled >= limit) return;
      const url = it.image_url || it.url || it.src;
      if (!url) continue;
      yield {
        source: "mage",
        sourceId: String(it.id || crypto.createHash("md5").update(url).digest("hex").slice(0, 16)),
        link: url,
        src: url,
        prompt: it.prompt || it.text_prompt || "",
        width: it.width || 0,
        height: it.height || 0,
      };
      pulled += 1;
    }
  } catch (e) {
    console.error(`[mage] feed request failed: ${e.response?.status} ${e.message} — likely needs Puppeteer; skipping`);
  }
}

// ---------- DISPATCHER ----------
const SOURCES = {
  civitai: sourceCivitai,
  lexica: sourceLexica,
  mage: sourceMage,
};

async function runSource(name) {
  console.log(`[${name}] start, limit=${PER_SOURCE_LIMIT}`);
  let processed = 0;
  let added = 0;
  let skipped = 0;
  let errors = 0;
  const fn = SOURCES[name];
  for await (const rec of fn({ limit: PER_SOURCE_LIMIT })) {
    processed += 1;
    try {
      if (await isProcessed(rec.link)) {
        skipped += 1;
        continue;
      }
      let imgBuf;
      try {
        imgBuf = await downloadAsBuffer(rec.src);
      } catch (e) {
        console.warn(`[${name}] download failed for ${rec.sourceId}: ${e.message}`);
        errors += 1;
        continue;
      }
      const [contentType, ext] = pickContentType(rec.src);
      const filename = safeFilename(name, rec.sourceId, ext);
      try {
        await postArt({ buffer: imgBuf, filename, prompt: rec.prompt, contentType });
        added += 1;
        await markProcessed(rec.link);
      } catch (e) {
        console.warn(`[${name}] postArt failed for ${rec.sourceId}: ${e.response?.status} ${e.message}`);
        errors += 1;
      }
      // be polite
      await sleep(Math.max(200, SLEEP_MS / 4));
    } catch (e) {
      errors += 1;
      console.error(`[${name}] unexpected: ${e.message}`);
    }
    if (processed % 25 === 0) {
      console.log(`[${name}] processed=${processed} added=${added} skipped=${skipped} errors=${errors}`);
    }
  }
  console.log(`[${name}] DONE processed=${processed} added=${added} skipped=${skipped} errors=${errors}`);
  return { name, processed, added, skipped, errors };
}

async function main() {
  console.log(`=== Scraper run @ ${new Date().toISOString()} | API_URL=${API_URL} ===`);
  const wanted = (process.env.SOURCES || "civitai,lexica,mage").split(",").map((s) => s.trim()).filter(Boolean);
  const results = [];
  for (const name of wanted) {
    if (!SOURCES[name]) { console.warn(`unknown source: ${name}`); continue; }
    results.push(await runSource(name));
  }
  console.log(`=== Summary @ ${new Date().toISOString()} ===`);
  for (const r of results) console.log(`  ${r.name}: +${r.added}  (skip ${r.skipped}, err ${r.errors})`);
  console.log(`Total added: ${results.reduce((s, r) => s + r.added, 0)}`);
}

main().catch((e) => {
  console.error("fatal:", e);
  process.exit(1);
});
