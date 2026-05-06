/**
 * Puppeteer-based scrapers for sites whose REST APIs are unstable/dead.
 * Currently: Lexica, Mage.space.
 *
 * Architecture: spin up one stealth Chromium, visit category pages, harvest
 * image URLs + prompts via DOM evaluation. Returns normalized records to
 * the dispatcher in run-multi.js.
 */
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteer.use(StealthPlugin());

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

let browserSingleton = null;
async function getBrowser() {
  if (browserSingleton && browserSingleton.isConnected?.()) return browserSingleton;
  browserSingleton = await puppeteer.launch({
    headless: "new",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled",
      "--window-size=1920,1080",
    ],
    ignoreHTTPSErrors: true,
  });
  return browserSingleton;
}

async function closeBrowser() {
  if (browserSingleton) {
    try { await browserSingleton.close(); } catch (_) {}
    browserSingleton = null;
  }
}

async function newPage() {
  const browser = await getBrowser();
  const page = await browser.newPage();
  await page.setUserAgent(UA);
  await page.setViewport({ width: 1920, height: 1080 });
  // Block fonts/css/media to speed up
  await page.setRequestInterception(true);
  page.on("request", (req) => {
    const t = req.resourceType();
    if (t === "font" || t === "media" || t === "stylesheet") req.abort();
    else req.continue();
  });
  return page;
}

// ---------- Lexica ----------
// Strategy: Lexica's HTML embeds image UUIDs in <img> tags after hydration.
// Visit https://lexica.art/?q=<query> for several queries to collect UUIDs,
// then for each image build a record.  Lexica image CDN: image.lexica.art/full_webp/{uuid}
async function* scrapeLexica({ limit = 100 }) {
  const queries = [
    "cinematic portrait", "cyberpunk", "fantasy landscape", "anime",
    "concept art", "photorealistic", "watercolor", "oil painting",
    "scifi", "warrior", "dragon", "abstract",
  ];
  let pulled = 0;
  let page;
  try {
    page = await newPage();
    for (const q of queries) {
      if (pulled >= limit) break;
      try {
        await page.goto(`https://lexica.art/?q=${encodeURIComponent(q)}`, {
          waitUntil: "networkidle2", timeout: 30000,
        });
        // give client hydration a moment
        await page.waitForSelector("img[src*='image.lexica.art']", { timeout: 15000 }).catch(() => {});
        const items = await page.evaluate(() => {
          const out = [];
          const seen = new Set();
          // Image tiles on Lexica search pages
          document.querySelectorAll("img").forEach((img) => {
            const src = img.currentSrc || img.src || "";
            const m = src.match(/image\.lexica\.art\/[a-z0-9_]+\/([a-f0-9-]{36})/i);
            if (!m) return;
            const uuid = m[1];
            if (seen.has(uuid)) return;
            seen.add(uuid);
            const alt = (img.getAttribute("alt") || "").trim();
            // Lexica often puts a prompt-ish snippet in alt
            out.push({ uuid, prompt: alt, w: img.naturalWidth, h: img.naturalHeight });
          });
          return out;
        });
        for (const it of items) {
          if (pulled >= limit) break;
          const fullUrl = `https://image.lexica.art/full_webp/${it.uuid}`;
          yield {
            source: "lexica",
            sourceId: it.uuid,
            link: fullUrl,
            src: fullUrl,
            prompt: it.prompt || `Lexica search: ${q}`,
            width: it.w || 0,
            height: it.h || 0,
          };
          pulled += 1;
        }
      } catch (e) {
        console.error(`[lexica] query "${q}" failed: ${e.message}`);
      }
    }
  } finally {
    if (page) try { await page.close(); } catch (_) {}
  }
}

// ---------- Mage.space ----------
// Mage's /explore page has cards with image + prompt.
async function* scrapeMage({ limit = 100 }) {
  const sortPaths = [
    "/explore",
    "/explore?sort=trending",
    "/explore?sort=top",
  ];
  let pulled = 0;
  let page;
  try {
    page = await newPage();
    for (const path of sortPaths) {
      if (pulled >= limit) break;
      try {
        await page.goto(`https://www.mage.space${path}`, {
          waitUntil: "networkidle2", timeout: 30000,
        });
        // Mage uses Cloudflare turnstile sometimes; wait for first image
        await page.waitForSelector("img[src*='mage'], img[src*='cdn.mage']", { timeout: 20000 }).catch(() => {});
        // Scroll a bit to load more
        await page.evaluate(async () => {
          for (let y = 0; y < 6000; y += 800) {
            window.scrollTo(0, y);
            await new Promise((r) => setTimeout(r, 400));
          }
        });
        const items = await page.evaluate(() => {
          const out = [];
          const seen = new Set();
          document.querySelectorAll("img").forEach((img) => {
            const src = img.currentSrc || img.src || "";
            if (!/mage\.space|cdn\.mage|cdn\.discordapp\.com/i.test(src)) return;
            if (seen.has(src)) return;
            seen.add(src);
            // Find prompt in nearby DOM
            const card = img.closest("a, article, div");
            const promptEl = card && card.querySelector("[class*='prompt' i], [class*='caption' i], p");
            const prompt = (promptEl?.textContent || img.getAttribute("alt") || "").trim().slice(0, 1000);
            out.push({ src, prompt, w: img.naturalWidth || 0, h: img.naturalHeight || 0 });
          });
          return out;
        });
        for (const it of items) {
          if (pulled >= limit) break;
          // Build a stable id from URL
          const idMatch = it.src.match(/([a-f0-9]{16,40})/i);
          const sourceId = idMatch ? idMatch[1] : Buffer.from(it.src).toString("base64").slice(-24);
          yield {
            source: "mage",
            sourceId,
            link: it.src,
            src: it.src,
            prompt: it.prompt || "Mage.space",
            width: it.w,
            height: it.h,
          };
          pulled += 1;
        }
      } catch (e) {
        console.error(`[mage] path "${path}" failed: ${e.message}`);
      }
    }
  } finally {
    if (page) try { await page.close(); } catch (_) {}
  }
}

module.exports = { scrapeLexica, scrapeMage, closeBrowser };
