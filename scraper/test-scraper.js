const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteer.use(StealthPlugin());
const fs = require("fs");
const path = require("path");
const https = require("https");
const xlsx = require("xlsx");
const { URL } = require("url");
const crypto = require("crypto");
const net = require("net");

// Replace the existing proxy list with these new proxies
const proxyList = [
  "185.235.71.54:43621:vmYIUR6EvIxLJZq:dmiiskrUq2kautk",
  "185.235.71.84:45544:iLWogkubut7ZbEE:ovllWoPijNudRnA",
  "91.192.240.102:44992:qwoZ1u3wnDMn44J:EjsawCCaIFSF2x3",
  "91.192.240.202:44700:Eir8JUVeo8Q8tPz:7bL1qXGwQHweicl",
  "91.192.242.253:41922:LsQ1SBMOr3tqEcQ:JUsO8CEgOPsCmkg",
];

let currentProxyIndex = 0;

// Function to get the next proxy in the list
function getNextProxy() {
  const proxy = proxyList[currentProxyIndex];
  currentProxyIndex = (currentProxyIndex + 1) % proxyList.length;
  return proxy;
}

// Function to parse a proxy string
function parseProxy(proxyString) {
  const [ip, port, username, password] = proxyString.split(":");
  return { ip, port, username, password };
}

// Replace rotateIpAddress with rotateProxy
async function rotateProxy() {
  const proxy = getNextProxy();
  console.log(`Rotating to new proxy: ${proxy.split(":")[0]}`);
  return proxy;
}

// Function to set up a browser with a specific proxy
async function setupBrowserWithProxy(proxyString) {
  const { ip, port, username, password } = parseProxy(proxyString);

  // Launch browser with the selected proxy
  const browser = await puppeteer.launch({
    defaultNavigationTimeout: 60000,
    defaultTimeout: 60000,
    protocolTimeout: 600000,
    headless: false,
    args: [
      `--proxy-server=${ip}:${port}`,
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled",
      "--window-size=1920,1080",
    ],
    ignoreHTTPSErrors: true,
  });

  // Create and configure pages with proxy authentication
  const page = await browser.newPage();
  await page.authenticate({ username, password });

  // Set up page configurations
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
  );

  await page.setViewport({
    width: 1920,
    height: 1080,
    deviceScaleFactor: 1,
  });

  // Set up stealth
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, "webdriver", {
      get: () => false,
    });
    Object.defineProperty(navigator, "languages", {
      get: () => ["en-US", "en"],
    });
  });

  const pageForList = await browser.newPage();
  await pageForList.authenticate({ username, password });
  await pageForList.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
  );
  await pageForList.setViewport({
    width: 1920,
    height: 1080,
    deviceScaleFactor: 1,
  });

  const pageForLink = await browser.newPage();
  await pageForLink.authenticate({ username, password });
  await pageForLink.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
  );
  await pageForLink.setViewport({
    width: 1920,
    height: 1080,
    deviceScaleFactor: 1,
  });

  return { browser, page, pageForList, pageForLink };
}

const downloadImage = (url, filepath) => {
  return new Promise((resolve, reject) => {
    const fileStream = fs.createWriteStream(filepath);
    https
      .get(url, (response) => {
        response.pipe(fileStream);
        fileStream.on("finish", () => {
          fileStream.close(resolve);
        });
      })
      .on("error", (error) => {
        fs.unlink(filepath, () => reject(error));
      });
  });
};

async function safeWheel(page, options) {
  try {
    await page.mouse.wheel(options);
  } catch (error) {
    if (error instanceof puppeteer.errors.ProtocolError) {
      console.log("Timeout occurred, retrying...");
      await safeWheel(page, options);
    } else {
      throw error;
    }
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Modify main function to be wrapped in a continuous outer loop
async function mainLoop() {
  console.log("====================================");
  console.log(`Starting scraping loop at ${new Date().toISOString()}`);
  console.log("====================================");

  try {
    await main();
  } catch (error) {
    console.error("Error in main process:", error);
  }

  console.log("====================================");
  console.log(`Scraping cycle completed at ${new Date().toISOString()}`);
  console.log(`Waiting 5 minutes before starting next cycle...`);
  console.log("====================================");

  // Wait 5 minutes before restarting
  await delay(5 * 60 * 1000);

  // Recursively call mainLoop to continue indefinitely
  await mainLoop();
}

async function main() {
  // Directory setup
  const imagesDir = "./new_images";
  if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir);
  }

  const pageDataDir = "./pageData";
  if (!fs.existsSync(pageDataDir)) {
    fs.mkdirSync(pageDataDir);
  }

  // Get initial proxy
  const initialProxy = getNextProxy();
  console.log(`Starting with proxy: ${initialProxy.split(":")[0]}`);

  // Set up browser with the initial proxy
  let { browser, page, pageForList, pageForLink } = await setupBrowserWithProxy(
    initialProxy
  );

  // Helper functions for processed links
  const saveProcessedLinks = (processedLinks, filePath) => {
    const data = JSON.stringify([...processedLinks]);
    fs.writeFileSync(filePath, data, "utf8");
  };

  function loadProcessedLinks() {
    try {
      // Check if file exists first
      if (fs.existsSync("processedLinks.json")) {
        const data = fs.readFileSync("processedLinks.json", "utf8");
        // Check if file is empty
        if (!data || data.trim() === "") {
          return new Set();
        }
        return new Set(JSON.parse(data));
      }
      return new Set();
    } catch (error) {
      console.log(
        "No existing processed links found or error reading file:",
        error.message
      );
      return new Set();
    }
  }

  const generateHashFromUrl = (url) => {
    return crypto.createHash("sha256").update(url).digest("hex");
  };

  let batchData = [];

  const stateFilePath = path.resolve(__dirname, "processedLinks.json");
  let processedLinks = loadProcessedLinks(stateFilePath);
  let newLinks;

  try {
    // Test if proxy is working by checking our IP
    console.log("Checking IP through proxy...");
    await pageForList.goto("https://api.ipify.org", {
      waitUntil: "networkidle0",
      timeout: 60000,
    });

    const proxyIp = await pageForList.evaluate(() => document.body.textContent);
    console.log(`Connected via IP: ${proxyIp}`);

    // Navigate to Civitai images page
    console.log("Navigating to Civitai images page...");
    await pageForList.goto("https://civitai.com/images", {
      waitUntil: "networkidle0",
      timeout: 60000,
    });

    const viewport = pageForList.viewport();
    await pageForList.mouse.move(viewport.width / 2, viewport.height / 2);

    // Identify the current selector for image links
    // This might need adjustment if the site's HTML structure changes
    let currentLinks = await pageForList.evaluate(() =>
      Array.from(
        document.querySelectorAll(
          'a[href^="/images/"]' // '.mantine-16xlp3a a, .EdgeImage_image__iH4_q,
        )
      ).map((a) => a.href)
    );

    // Filter out links we've already processed
    newLinks = currentLinks.filter((link) => link && !processedLinks.has(link));

    // Counter for proxy rotation
    let requestCounter = 0;

    while (true) {
      console.log(`New links: ${newLinks.length}`);

      for (const link of newLinks) {
        processedLinks.add(link);
        saveProcessedLinks(processedLinks, stateFilePath);
        let filepath;
        let processState = false;

        try {
          // Rotate proxy every 10 requests
          requestCounter++;
          if (requestCounter >= 10) {
            console.log("Rotating to a new proxy...");
            await browser.close();

            // Get new proxy and set up a new browser
            const newProxy = await rotateProxy();
            const newBrowserSetup = await setupBrowserWithProxy(newProxy);

            // Update references
            browser = newBrowserSetup.browser;
            page = newBrowserSetup.page;
            pageForList = newBrowserSetup.pageForList;
            pageForLink = newBrowserSetup.pageForLink;

            requestCounter = 0;
            await delay(5000); // Wait for new connection to establish

            // Re-navigate to the images page to reset state after proxy rotation
            try {
              await pageForList.goto("https://civitai.com/images", {
                waitUntil: "networkidle0",
                timeout: 60000,
              });
            } catch (navError) {
              console.log(
                "Error re-navigating after proxy rotation:",
                navError.message
              );
            }
          }

          // Make sure link is valid before processing
          if (!link) {
            console.log("Skipping invalid link (null or undefined)");
            continue;
          }

          console.log(`Processing ${processedLinks.size}: ${link}`);
          await pageForLink.goto(link, {
            waitUntil: "networkidle0",
            timeout: 60000,
          });

          // Extract the main image source - updated selector
          const imageUrl = await pageForLink.evaluate(() => {
            // Try multiple selectors to be resilient to changes
            const imgSelectors = [
              "img.EdgeImage_image__iH4_q.max-h-full.w-auto.max-w-full",
            ];

            for (const selector of imgSelectors) {
              const img = document.querySelector(selector);
              if (img && img.src) return img.src;
            }
            return null;
          });

          if (!imageUrl) {
            console.log(`No image found for ${link}, skipping`);
            continue;
          }

          // Process and save the image
          const urlPath = new URL(imageUrl).pathname;
          const extension = path.extname(urlPath) || ".jpg";
          const hash = generateHashFromUrl(imageUrl);
          const filename = `${hash}${extension}`;
          filepath = path.resolve(imagesDir, filename);

          await downloadImage(imageUrl, filepath);

          // Get both positive and negative prompts
          let promptText = "";
          let negPromptText = "";
          try {
            const prompts = await pageForLink.evaluate(() => {
              // Find all elements with the class combination
              const elements = document.querySelectorAll(
                "div.mantine-Text-root.text-sm.mantine-1c2skr8"
              );

              // Convert to array and get text content
              const promptTexts = Array.from(elements).map(
                (el) => el.innerText
              );

              return {
                // First element is typically positive prompt
                positive: promptTexts[0] || "",
                // Second element is typically negative prompt
                negative: promptTexts[1] || "",
              };
            });

            promptText = prompts.positive;
            negPromptText = prompts.negative;
          } catch (e) {
            console.log(`Prompts not found for ${link}`, e);
          }

          // Extract comments - updated selectors
          const comments = await pageForLink.evaluate(() => {
            // Try to find comments in different containers
            const commentSelectors = [
              "div.mantine-TypographyStylesProvider-root.mantine-mqq5wg",
            ];

            let commentsArray = [];

            for (const selector of commentSelectors) {
              const comments = document.querySelectorAll(selector);
              if (comments.length > 0) {
                Array.from(comments).forEach((comment) => {
                  const text = comment.textContent.trim();
                  if (text) commentsArray.push(text);
                });
                break;
              }
            }

            return commentsArray.join(";;;");
          });

          // Extract upvotes - updated selectors
          const upvotes = await pageForLink.evaluate(() => {
            let localUpvotes = 0;

            try {
              // Select buttons with the specified class and find numbers in span elements
              const buttons = document.querySelectorAll(
                "button.mantine-UnstyledButton-root.mantine-Button-root.mantine-1agco08"
              );
              for (const button of buttons) {
                const span = button.querySelector("span.mantine-Button-label");
                if (span && !isNaN(span.textContent.trim())) {
                  localUpvotes += parseInt(span.textContent.trim(), 10);
                }
              }
            } catch (e) {
              console.error("Error parsing upvotes:", e);
            }

            return localUpvotes;
          });

          processState = true;

          // Create data object with all extracted info
          const data = {
            link,
            ImagePath: filepath,
            PromptText: promptText,
            NegPromptText: negPromptText,
            Comments: comments,
            Upvotes: upvotes,
          };
          batchData.push(data);

          // Save data to JSON file
          const jsonFileName = `${pageDataDir}/pageData_${processedLinks.size}.json`;
          fs.writeFileSync(
            path.resolve(__dirname, jsonFileName),
            JSON.stringify(data, null, 2)
          );
        } catch (error) {
          console.error(`Failed to process ${link}: ${error.message}`);
        }

        console.log("Finished processing. Waiting...");
        await delay(2000);
      }

      newLinks = [];

      // Scroll to find more links
      let patience = processedLinks.size + 1000;
      while (newLinks.length === 0) {
        if (patience === 0) {
          console.log("No new links found after many scrolls. Exiting.");
          await pageForList.close();
          await pageForLink.close();
          await browser.close();
          return 0;
        }

        patience--;
        await delay(500);
        await pageForList.screenshot({ path: "screenshot.png" });

        // Updated scroll approach
        try {
          await safeWheel(pageForList, { deltaY: 1000 });
        } catch (error) {
          console.error("Error scrolling:", error);
          // Try an alternative scroll method if wheel fails
          await pageForList.evaluate(() => {
            window.scrollBy(0, 1000);
          });
        }

        // Improved link extraction with additional validation
        let currentLinks = await pageForList.evaluate(() => {
          const links = Array.from(
            document.querySelectorAll(
              '.mantine-16xlp3a a, .EdgeImage_image__iH4_q, a[href^="/images/"]'
            )
          ).map((a) => a.href);

          // Filter out any invalid links
          return links.filter((link) => !!link && link.includes("/images/"));
        });

        newLinks = currentLinks.filter((link) => !processedLinks.has(link));

        // Rotate proxy if we've been scrolling for a while
        if (patience == 10) {
          console.log("Rotating to a new proxy during scroll...");
          await browser.close();

          // Get new proxy and set up a new browser
          const newProxy = await rotateProxy();
          const newBrowserSetup = await setupBrowserWithProxy(newProxy);

          // Update references
          browser = newBrowserSetup.browser;
          page = newBrowserSetup.page;
          pageForList = newBrowserSetup.pageForList;
          pageForLink = newBrowserSetup.pageForLink;

          await delay(5000);

          // Re-navigate to the images page after proxy rotation
          try {
            await pageForList.goto("https://civitai.com/images", {
              waitUntil: "networkidle0",
              timeout: 60000,
            });
          } catch (navError) {
            console.log(
              "Error re-navigating after scroll proxy rotation:",
              navError.message
            );
          }
        }
      }
    }
  } catch (error) {
    console.error("Main error:", error);
  } finally {
    // Close browser
    try {
      await browser.close();
    } catch (error) {
      console.error("Error closing browser:", error);
    }
  }
}

// Replace main() with mainLoop() as the entry point
mainLoop()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error("Fatal error in main loop:", err);
    process.exit(1);
  });
