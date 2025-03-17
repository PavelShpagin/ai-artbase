require("dotenv").config();

const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteer.use(StealthPlugin());
const fs = require("fs");
const path = require("path");
const https = require("https");
const axios = require("axios");
const FormData = require("form-data");
const { URL } = require("url");
const crypto = require("crypto");
const OpenAI = require("openai");

// Replace the existing proxy list with these new proxies
const proxyList = [
  "185.235.71.54:43621:vmYIUR6EvIxLJZq:dmiiskrUq2kautk",
  "185.235.71.84:45544:iLWogkubut7ZbEE:ovllWoPijNudRnA",
  "91.192.240.102:44992:qwoZ1u3wnDMn44J:EjsawCCaIFSF2x3",
  "91.192.240.202:44700:Eir8JUVeo8Q8tPz:7bL1qXGwQHweicl",
  "91.192.242.253:41922:LsQ1SBMOr3tqEcQ:JUsO8CEgOPsCmkg",
];

// ... existing proxy functions ...
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
    headless: true,
    args: [
      `--proxy-server=${ip}:${port}`,
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled",
      "--window-size=1920,1080",
    ],
    ignoreHTTPSErrors: true,
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

  return { browser, pageForList, pageForLink };
}

// Replace hardcoded values with environment variables
const API_URL = process.env.API_URL || "http://localhost:8000";
const OWNER_ID = parseInt(process.env.OWNER_ID || "4", 10);

// Import OpenAI and initialize
const openai = new OpenAI();

// Function to check if a link has been processed
async function isLinkProcessed(link) {
  try {
    const response = await axios.get(
      `${API_URL}/check_processed_link/?link=${encodeURIComponent(link)}`
    );
    return response.data.processed;
  } catch (error) {
    console.error(`Error checking if link is processed: ${error.message}`);
    return false;
  }
}

// Function to save a processed link to the database
async function saveProcessedLink(link) {
  try {
    // Send link as a query parameter, not form data
    await axios.post(
      `${API_URL}/processed_links/?link=${encodeURIComponent(link)}`
    );
    console.log(`Saved processed link: ${link}`);
  } catch (error) {
    console.error(`Error saving processed link: ${error.message}`);
  }
}

// Replace the downloadImageTemp function with this streamlined approach
async function getImageBuffer(url) {
  try {
    const response = await axios.get(url, {
      responseType: "arraybuffer",
    });
    return response.data;
  } catch (error) {
    console.error(`Error fetching image: ${error.message}`);
    throw error;
  }
}

// Function to upload art to the API
async function uploadArtToAPI(
  imageUrl,
  promptText,
  negPromptText,
  comments,
  upvotes
) {
  try {
    // Get image as buffer
    const imageBuffer = await getImageBuffer(imageUrl);

    // Check if promptText is empty and generate a prompt using OpenAI if needed
    if (!promptText) {
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "What's in this image?" },
              {
                type: "image_url",
                image_url: {
                  url: imageUrl,
                },
              },
            ],
          },
        ],
      });
      promptText = response.choices[0].message.content;
    }

    // Create form data for the API request
    const formData = new FormData();
    formData.append("prompt", promptText || "");

    // Get file extension from URL
    const urlPath = new URL(imageUrl).pathname;
    const extension = path.extname(urlPath) || ".jpg";

    // Create unique filename
    const filename = `image_${Date.now()}${extension}`;

    // Properly append the image with filename and content type
    formData.append("image", imageBuffer, {
      filename: filename,
      contentType: `image/${extension.substring(1)}` || "image/jpeg",
    });

    formData.append("owner_id", OWNER_ID);

    // Upload image to /arts/ endpoint
    const response = await axios.post(`${API_URL}/arts/`, formData, {
      headers: {
        ...formData.getHeaders(),
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });

    const artId = response.data.id;

    // If we have metadata, upload it separately
    if (negPromptText || comments || upvotes) {
      // Send parameters as query parameters instead of form data
      await axios.post(
        `${API_URL}/art_metadata/?` +
          `art_id=${artId}&` +
          `neg_prompt_text=${encodeURIComponent(negPromptText || "")}&` +
          `comments=${encodeURIComponent(comments || "")}&` +
          `upvotes=${upvotes || 0}`
      );
    }

    console.log(`Successfully uploaded art ID: ${artId}`);
    return artId;
  } catch (error) {
    console.error(`Error uploading art: ${error.message}`);
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error(`Headers:`, error.response.headers);
      try {
        console.error(
          `Data:`,
          typeof error.response.data === "object"
            ? JSON.stringify(error.response.data)
            : error.response.data
        );
      } catch (e) {
        console.error("Cannot stringify response data");
      }
    }
    return null;
  }
}

// Function to perform smooth scrolling with randomization
async function smoothScroll(page, deltaY, step = 100, delayMs = 50) {
  const steps = Math.abs(deltaY) / step;
  const direction = deltaY > 0 ? 1 : -1;

  for (let i = 0; i < steps; i++) {
    // Introduce randomization in step size and delay
    const randomStep = step + Math.floor(Math.random() * 20 - 10); // Random step variation
    const randomDelay = delayMs + Math.floor(Math.random() * 20 - 10); // Random delay variation

    await page.mouse.wheel({ deltaY: direction * randomStep });
    await delay(randomDelay);
  }
}

// Update the safeWheel function to use smoothScroll
async function safeWheel(page, options) {
  try {
    console.log("scrolling...");
    await smoothScroll(page, options.deltaY);

    // Introduce a random long pause after a certain number of scrolls
    if (options.scrollCount && options.scrollCount % 10 === 0) {
      const randomPause = 60 * 1000 + Math.floor(Math.random() * 60 * 1000); // 1 to 2 minutes
      console.log(
        `Pausing for ${
          randomPause / 1000
        } seconds to simulate real user behavior.`
      );
      await delay(randomPause);
    }
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
  await delay(120 * 60 * 1000);

  // Recursively call mainLoop to continue indefinitely
  await mainLoop();
}

async function main() {
  // Get initial proxy
  const initialProxy = getNextProxy();
  console.log(`Starting with proxy: ${initialProxy.split(":")[0]}`);

  // Set up browser with the initial proxy
  let { browser, pageForList, pageForLink } = await setupBrowserWithProxy(
    initialProxy
  );

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
    let currentLinks = await pageForList.evaluate(() =>
      Array.from(document.querySelectorAll('a[href^="/images/"]')).map(
        (a) => a.href
      )
    );

    // Filter out links we've already processed (check with API)
    newLinks = [];
    for (const link of currentLinks) {
      if (link && !(await isLinkProcessed(link))) {
        newLinks.push(link);
      }
    }

    // Counter for proxy rotation
    let requestCounter = 0;

    // Update the scrolling logic to pass scrollCount
    let scrollCount = 0;

    while (true) {
      console.log(`New links: ${newLinks.length}`);

      for (const link of newLinks) {
        // Save this link as processed in the database
        await saveProcessedLink(link);

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

          console.log(`Processing: ${link}`);
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

          // Upload art to API instead of saving locally
          await uploadArtToAPI(
            imageUrl,
            promptText,
            negPromptText,
            comments,
            upvotes
          );
        } catch (error) {
          console.error(`Failed to process ${link}: ${error.message}`);
        }

        console.log("Finished processing. Waiting...");
        await delay(2000);
      }

      newLinks = [];

      // Scroll to find more links
      let patience = 1000;
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
          console.log("pageForList", pageForList);
          scrollCount++;
          await safeWheel(pageForList, { deltaY: 1000, scrollCount });
        } catch (error) {
          console.error("Error scrolling:", error);
          // Try an alternative scroll method if wheel fails
          await pageForList.evaluate(() => {
            window.scrollBy(0, 1000);
          });
        }
        console.log("success");

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

        // Check each link with API to see if it's been processed
        for (const link of currentLinks) {
          if (link && !(await isLinkProcessed(link))) {
            newLinks.push(link);
          }
        }

        // Rotate proxy if we've been scrolling for a while
        if (patience == 10) {
          console.log("Rotating to a new proxy during scroll...");
          await browser.close();

          // Get new proxy and set up a new browser
          const newProxy = await rotateProxy();
          const newBrowserSetup = await setupBrowserWithProxy(newProxy);

          // Update references
          browser = newBrowserSetup.browser;
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
