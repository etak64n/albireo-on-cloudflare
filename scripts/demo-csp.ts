// Opens the demo build with the Content-Security-Policy that a deployment sends with its
// pages (worker/security-headers.ts), and fails when the browser blocks anything. The demo
// is the browser app of albireo with sample data, so a change that adds an inline script,
// a call to eval, or a load from another site fails here, before the demo goes out. The
// demo reads its sample files from its own origin, where a deployment reads them from the
// bucket, so the policy here allows no bucket. The Pages workflow runs this after
// scripts/demo-media.ts, with Playwright and its Chromium in a folder of their own:
//   node scripts/demo-csp.ts <folder of the demo build> <folder of the tools> <base path of the demo>

import { createReadStream, readdirSync, statSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { createRequire } from "node:module";
import type { AddressInfo } from "node:net";
import { extname, join, resolve, sep } from "node:path";
import { contentSecurityPolicy } from "../worker/security-headers.ts";

// The parts of Playwright that this script uses. Playwright is no dependency of albireo,
// so its own types are not at hand.
interface Locator {
  click(): Promise<void>;
  count(): Promise<number>;
  first(): Locator;
  nth(index: number): Locator;
  setInputFiles(path: string): Promise<void>;
  waitFor(options?: { state: "attached" | "visible" }): Promise<void>;
}

interface Page {
  goto(url: string): Promise<unknown>;
  getByRole(role: string, options?: { name: string | RegExp; exact?: boolean; level?: number }): Locator;
  locator(selector: string): Locator;
  keyboard: { press(key: string): Promise<void>; type(text: string): Promise<void> };
  waitForLoadState(state: "networkidle"): Promise<void>;
  waitForTimeout(milliseconds: number): Promise<void>;
  on(event: "console", listener: (message: { text(): string }) => void): void;
}

interface Browser {
  newContext(options: { viewport: { width: number; height: number } }): Promise<{
    addInitScript(script: string): Promise<void>;
    newPage(): Promise<Page>;
  }>;
  close(): Promise<void>;
}

interface Playwright {
  chromium: { launch(): Promise<Browser> };
}

// The series and the episode whose attachments have every kind that albireo previews:
// PDF, PowerPoint, a picture, CSV, JSON, Python, and Markdown (src/demo/lessons.ts).
const SERIES = "SQL in 20 lessons";
const EPISODE = /SQL lesson 8:/;
const QUERY = "design";

// Every document of the page reports what the policy blocks to the console, where this
// script reads it. The listener comes before any script of the document runs.
const REPORT = "Content-Security-Policy blocked ";
const WATCH = `document.addEventListener("securitypolicyviolation", (event) => {
  console.error(${JSON.stringify(REPORT)} + JSON.stringify({
    directive: event.effectiveDirective,
    blocked: event.blockedURI,
    source: event.sourceFile,
    line: event.lineNumber,
    sample: event.sample,
  }));
}, true);`;

const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".wasm": "application/wasm",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".pdf": "application/pdf",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".csv": "text/csv",
  ".md": "text/markdown",
  ".woff2": "font/woff2",
};

/** Serves the demo under its base path, as GitHub Pages does, with the policy on every response. */
function serve(site: string, base: string, policy: string): Promise<Server> {
  const root = resolve(site);
  const server = createServer((request, response) => {
    response.setHeader("Content-Security-Policy", policy);
    const path = decodeURIComponent(new URL(request.url ?? "/", "http://localhost").pathname);
    if (!path.startsWith(base)) {
      response.writeHead(404).end();
      return;
    }
    let file = resolve(root, path.slice(base.length));
    if (file !== root && !file.startsWith(root + sep)) {
      response.writeHead(404).end();
      return;
    }
    let size = statSync(file, { throwIfNoEntry: false });
    // The paths of the app are no files: GitHub Pages answers them with the page of the app.
    if (size === undefined || size.isDirectory()) {
      if (extname(file) !== "") {
        response.writeHead(404).end();
        return;
      }
      file = join(root, "index.html");
      size = statSync(file);
    }
    response.writeHead(200, {
      "Content-Type": CONTENT_TYPES[extname(file)] ?? "application/octet-stream",
      "Content-Length": size.size,
    });
    createReadStream(file).pipe(response);
  });
  return new Promise((done) => server.listen(0, "127.0.0.1", () => done(server)));
}

async function main(site: string, toolsFolder: string, base: string): Promise<void> {
  const policy = contentSecurityPolicy(null);
  console.log(`Content-Security-Policy: ${policy}`);
  const server = await serve(site, base, policy);
  const { port } = server.address() as AddressInfo;
  const home = `http://127.0.0.1:${port}${base}`;

  const tools = createRequire(join(toolsFolder, "package.json"));
  const { chromium } = tools("playwright") as Playwright;
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript(WATCH);
  const page = await context.newPage();

  let step = "Opening the demo";
  const blocked: string[] = [];
  page.on("console", (message) => {
    const text = message.text();
    if (text.startsWith(REPORT)) blocked.push(`${step}: ${text.slice(REPORT.length)}`);
  });
  // Lets the requests of a step end, and the previews draw what they read.
  const settle = async () => {
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1500);
  };
  const run = async (name: string, action: () => Promise<void>) => {
    step = name;
    console.log(name);
    await action();
    await settle();
  };

  try {
    await run("Home", async () => {
      await page.goto(home);
      await page.getByRole("heading", { name: "Home", level: 1 }).waitFor();
    });
    await run(`The series ${SERIES}`, async () => {
      await page.getByRole("link", { name: SERIES, exact: true }).first().click();
      await page.getByRole("heading", { name: SERIES, level: 1 }).waitFor();
    });
    await run("The episode with every kind of attachment", async () => {
      await page.getByRole("link", { name: EPISODE }).first().click();
      await page.locator("video").first().waitFor({ state: "attached" });
    });
    const previews = page.getByRole("button", { name: "Preview", exact: true });
    const count = await previews.count();
    if (count === 0) throw new Error("The episode shows no attachment to preview.");
    for (let index = 0; index < count; index += 1) {
      await run(`The preview of attachment ${index + 1} of ${count}`, async () => {
        await previews.nth(index).click();
        await page.getByRole("dialog").waitFor();
      });
      await page.keyboard.press("Escape");
    }
    await run(`A search for "${QUERY}"`, async () => {
      await page.getByRole("textbox", { name: "Search videos" }).click();
      await page.keyboard.type(QUERY);
      await page.keyboard.press("Enter");
      await page.getByRole("heading", { name: new RegExp(QUERY), level: 1 }).waitFor();
    });
    // The demo keeps no files, so an upload stops after the browser reads the video,
    // which it does from a blob: URL.
    await run("Choosing a video to upload", async () => {
      await page.locator('input[type="file"][accept="video/*"]').first().setInputFiles(firstFile(join(site, "media", "videos"), ".mp4"));
      await page.waitForTimeout(3000);
    });
    // Cropping shows the chosen picture from a blob: URL.
    await run("Choosing a picture for the channel", async () => {
      await page.goto(`${home}settings/channel`);
      await page.locator('input[type="file"][accept="image/*"]').first().setInputFiles(firstFile(join(site, "media", "people"), ".jpg"));
      await page.getByRole("dialog").waitFor();
    });
  } finally {
    await browser.close();
    server.close();
    // What the policy blocked shows even when a step could not finish.
    if (blocked.length > 0) {
      console.error(`The Content-Security-Policy blocked ${blocked.length} request(s):`);
      for (const line of blocked) console.error(`- ${line}`);
      process.exitCode = 1;
    }
  }
  if (blocked.length === 0) console.log("The Content-Security-Policy blocked nothing.");
}

/** The path of the first file of a folder with the extension, in the order of their names. */
function firstFile(folder: string, extension: string): string {
  const name = readdirSync(folder).sort().find((file) => file.endsWith(extension));
  if (name === undefined) throw new Error(`${folder} has no ${extension} file.`);
  return join(folder, name);
}

const [site, toolsFolder, base] = process.argv.slice(2);
if (site === undefined || toolsFolder === undefined || base === undefined || !base.startsWith("/") || !base.endsWith("/")) {
  console.error("Usage: node scripts/demo-csp.ts <folder of the demo build> <folder of the tools> </base path of the demo/>");
  process.exit(1);
}
await main(site, toolsFolder, base);
