import { execFileSync, spawn, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const root = resolve(import.meta.dirname, "..");
const workDir = mkdtempSync(join(tmpdir(), "foundry-ui-starter-"));
const packDir = join(workDir, "packs");
const appDir = join(workDir, "app");
// `--screenshot <path>` reuses the browser smoke end-to-end (same scaffold,
// same mocked AG-UI stream) and captures the result. Sharing one code path
// means the README screenshot can never drift from what CI actually verifies.
const screenshotFlagIndex = process.argv.indexOf("--screenshot");
let screenshotPath = null;
if (screenshotFlagIndex !== -1) {
  const value = process.argv[screenshotFlagIndex + 1];
  // Fail fast rather than silently no-op (missing value) or write a file
  // literally named after the next flag (e.g. `--screenshot --browser`).
  if (!value || value.startsWith("-")) {
    console.error("Usage: node scripts/smoke-starter.mjs --screenshot <path>");
    process.exit(1);
  }
  screenshotPath = resolve(value);
}
const runBrowserSmoke = process.argv.includes("--browser") || screenshotPath !== null;
const browserSmokeWatchdog = runBrowserSmoke
  ? setTimeout(() => {
      console.error("Starter browser smoke timed out.");
      process.exit(1);
    }, 8 * 60_000)
  : null;

const packages = [
  "packages/agent",
  "packages/web-primitives",
  "packages/web-ui",
  "packages/web-shell",
  "packages/web-voice",
];

function resolvePnpmCommand() {
  if (process.env.PNPM_EXECUTABLE) {
    return { command: process.env.PNPM_EXECUTABLE, prefixArgs: [] };
  }

  if (process.env.COREPACK_ROOT) {
    const corepackPnpm = join(process.env.COREPACK_ROOT, "dist", "pnpm.js");
    if (existsSync(corepackPnpm)) {
      return { command: process.execPath, prefixArgs: [corepackPnpm] };
    }
  }

  return { command: "pnpm", prefixArgs: [] };
}

const pnpmCommand = resolvePnpmCommand();

function run(command, args, options = {}) {
  execFileSync(command, args, {
    cwd: options.cwd ?? root,
    env: process.env,
    stdio: "inherit",
  });
}

function runOutput(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? root,
    env: process.env,
    encoding: "utf8",
  });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  if (result.status !== 0) {
    process.stdout.write(output);
    throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status}`);
  }
  return output;
}

function runJson(command, args, options = {}) {
  const output = execFileSync(command, args, {
    cwd: options.cwd ?? root,
    env: process.env,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  });
  return JSON.parse(output);
}

function firstJson(value) {
  return Array.isArray(value) ? value[0] : value;
}

async function runPnpmLiveOutput(args, options = {}) {
  return new Promise((resolveOutput, reject) => {
    const child = spawn(pnpmCommand.command, [...pnpmCommand.prefixArgs, ...args], {
      cwd: options.cwd ?? root,
      // Honour a caller-supplied environment: the voice-enabled build below
      // is only meaningful if its feature flag actually reaches Vite.
      env: options.env ?? process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    const timeout =
      options.timeoutMs === undefined
        ? null
        : setTimeout(() => {
            child.kill("SIGTERM");
            setTimeout(() => {
              if (child.exitCode === null) child.kill("SIGKILL");
            }, 5_000);
            reject(new Error(`pnpm ${args.join(" ")} timed out after ${options.timeoutMs} ms`));
          }, options.timeoutMs);

    child.stdout.on("data", (chunk) => {
      output += chunk.toString();
      process.stdout.write(chunk);
    });
    child.stderr.on("data", (chunk) => {
      output += chunk.toString();
      process.stderr.write(chunk);
    });
    child.on("error", (error) => {
      if (timeout) clearTimeout(timeout);
      reject(error);
    });
    child.on("close", (code) => {
      if (timeout) clearTimeout(timeout);
      if (code === 0) {
        resolveOutput(output);
        return;
      }
      reject(new Error(`pnpm ${args.join(" ")} failed with exit code ${code}`));
    });
  });
}

function spawnPnpm(args, options = {}) {
  return spawn(pnpmCommand.command, [...pnpmCommand.prefixArgs, ...args], {
    cwd: options.cwd ?? root,
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

async function getFreePort() {
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close(() => reject(new Error("Unable to allocate a local port.")));
        return;
      }
      const { port } = address;
      server.close(() => resolvePort(port));
    });
  });
}

async function waitForHttp(url, serverProcess, getServerOutput) {
  const deadline = Date.now() + 30_000;
  let lastError = null;

  while (Date.now() < deadline) {
    if (serverProcess.exitCode !== null) {
      throw new Error(`Vite dev server exited early.\n${getServerOutput()}`);
    }

    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch (error) {
      lastError = error;
    }

    await sleep(250);
  }

  throw new Error(
    `Timed out waiting for ${url}.${
      lastError instanceof Error ? ` Last error: ${lastError.message}` : ""
    }\n${getServerOutput()}`,
  );
}

function encodeSse(events) {
  return events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join("");
}

function createHelloWorldEvents(requestBody) {
  const threadId =
    typeof requestBody.threadId === "string" ? requestBody.threadId : "browser-smoke-thread";
  const runId = typeof requestBody.runId === "string" ? requestBody.runId : "browser-smoke-run";
  const messageId = `${runId}-assistant`;
  const toolCallId = `${runId}-hello-world`;
  const answer =
    "Hello from the hello_world tool. Your Foundry UI starter is rendering an AG-UI streamed response.";

  return [
    { type: "RUN_STARTED", threadId, runId },
    {
      type: "TOOL_CALL_START",
      toolCallId,
      toolCallName: "hello_world",
    },
    {
      type: "TOOL_CALL_ARGS",
      toolCallId,
      delta: JSON.stringify({ name: "Foundry UI" }),
    },
    { type: "TOOL_CALL_END", toolCallId },
    {
      type: "TOOL_CALL_RESULT",
      messageId: `${toolCallId}-result`,
      toolCallId,
      content: JSON.stringify({ greeting: "Hello, Foundry UI.", source: "hello_world" }),
      role: "tool",
    },
    { type: "TEXT_MESSAGE_START", messageId, role: "assistant" },
    { type: "TEXT_MESSAGE_CONTENT", messageId, delta: answer },
    { type: "TEXT_MESSAGE_END", messageId },
    { type: "RUN_FINISHED", threadId, runId },
  ];
}

// Screenshot-only variant of the hello-world stream: same event shapes, richer
// copy so the captured frame shows off markdown rendering and the tool card.
function createShowcaseEvents(requestBody) {
  const threadId = typeof requestBody.threadId === "string" ? requestBody.threadId : "showcase";
  const runId = typeof requestBody.runId === "string" ? requestBody.runId : "showcase-run";
  const messageId = `${runId}-assistant`;
  const toolCallId = `${runId}-hello-world`;
  const answer = [
    "Hello from the `hello_world` tool — your Foundry UI starter is rendering a live ",
    "AG-UI stream.\n\nWhat just happened:\n",
    "- The agent called a **server-side tool**, streamed over the AG-UI protocol\n",
    "- The call rendered as a tool card above, with its arguments and result\n",
    "- This text streamed token-by-token into the assistant message\n\n",
    "Add your own tools in `agent/app/tools.py` and they show up here automatically.",
  ].join("");

  return [
    { type: "RUN_STARTED", threadId, runId },
    { type: "TOOL_CALL_START", toolCallId, toolCallName: "hello_world" },
    { type: "TOOL_CALL_ARGS", toolCallId, delta: JSON.stringify({ name: "Foundry UI" }) },
    { type: "TOOL_CALL_END", toolCallId },
    {
      type: "TOOL_CALL_RESULT",
      messageId: `${toolCallId}-result`,
      toolCallId,
      content: JSON.stringify({ greeting: "Hello, Foundry UI.", source: "hello_world" }),
      role: "tool",
    },
    { type: "TEXT_MESSAGE_START", messageId, role: "assistant" },
    { type: "TEXT_MESSAGE_CONTENT", messageId, delta: answer },
    { type: "TEXT_MESSAGE_END", messageId },
    { type: "RUN_FINISHED", threadId, runId },
  ];
}

async function runBrowserStarterSmoke() {
  const { chromium } = await import("playwright");
  const port = await getFreePort();
  const url = `http://127.0.0.1:${port}/`;
  const serverProcess = spawnPnpm(
    ["dev:web", "--host", "127.0.0.1", "--port", `${port}`, "--strictPort"],
    {
      cwd: appDir,
    },
  );
  let serverOutput = "";
  const appendServerOutput = (chunk) => {
    serverOutput += chunk.toString();
    serverOutput = serverOutput.slice(-8_000);
  };
  serverProcess.stdout.on("data", appendServerOutput);
  serverProcess.stderr.on("data", appendServerOutput);

  const browser = await chromium.launch({ headless: true });
  const pageErrors = [];
  const consoleErrors = [];

  try {
    await waitForHttp(url, serverProcess, () => serverOutput);

    const page = await browser.newPage(
      screenshotPath
        ? { viewport: { width: 1440, height: 700 }, deviceScaleFactor: 2 }
        : { viewport: { width: 1280, height: 900 } },
    );
    let sawAgentRequest = false;

    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });

    // The shell asks the backend what the composer's `Auto` effort resolves
    // to on boot. Part of the backend surface the shell touches, so the smoke
    // models it like /api/agent below — an unstubbed call would 500 against
    // the dev server and fail the console-error gate.
    await page.route("**/api/chat/config", async (route) => {
      await route.fulfill({
        status: 200,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reasoning: { defaultEffort: "medium" } }),
      });
    });

    await page.route("**/api/agent", async (route) => {
      sawAgentRequest = true;
      const requestBody = JSON.parse(route.request().postData() || "{}");
      await route.fulfill({
        status: 200,
        headers: {
          "cache-control": "no-cache",
          "content-type": "text/event-stream",
        },
        body: encodeSse(
          screenshotPath ? createShowcaseEvents(requestBody) : createHelloWorldEvents(requestBody),
        ),
      });
    });

    if (screenshotPath) {
      // The shell defaults to the collapsed rail and persists the choice under
      // localStorage["sidebar"] (see web-ui's sidebar-store). Seed it before
      // the SPA boots so the capture shows the expanded navigation.
      await page.addInitScript(() => {
        try {
          localStorage.setItem("sidebar", "true");
        } catch {
          // Storage unavailable; fall back to the default rail.
        }
      });
    }

    await page.goto(url, { waitUntil: "domcontentloaded" });

    const title = await page.title();
    if (title !== "Foundry UI") {
      throw new Error(`Expected browser title "Foundry UI", got "${title}".`);
    }

    await page.getByText("How can I help you today?").waitFor({ timeout: 10_000 });
    await page.getByRole("button", { name: "Say hello world using the hello_world tool" }).click();
    await page.getByText("Hello from the", { exact: false }).first().waitFor({ timeout: 10_000 });

    if (screenshotPath) {
      // Let streaming settle and the composer lose focus so the capture has no
      // caret or half-rendered markdown in it.
      await page.locator("body").click({ position: { x: 5, y: 5 } });
      await page.waitForTimeout(1_500);
      // Playwright will not create missing parent directories.
      mkdirSync(dirname(screenshotPath), { recursive: true });
      await page.screenshot({ path: screenshotPath, scale: "device" });
      console.log(`Starter screenshot written to ${screenshotPath}`);
    }

    if (!sawAgentRequest) {
      throw new Error("The generated starter did not call /api/agent.");
    }

    if (pageErrors.length > 0 || consoleErrors.length > 0) {
      throw new Error(
        [
          "Browser smoke saw client-side errors.",
          ...pageErrors.map((error) => `pageerror: ${error}`),
          ...consoleErrors.map((error) => `console.error: ${error}`),
        ].join("\n"),
      );
    }

    console.log(`Starter browser smoke passed at ${url}`);
  } finally {
    await Promise.race([browser.close().catch(() => undefined), sleep(5_000)]);
    if (serverProcess.exitCode === null) {
      serverProcess.kill("SIGTERM");
      const closed = await Promise.race([
        new Promise((resolveClose) => serverProcess.once("close", resolveClose)),
        sleep(5_000).then(() => false),
      ]);
      if (closed === false && serverProcess.exitCode === null) {
        serverProcess.kill("SIGKILL");
        await Promise.race([
          new Promise((resolveClose) => serverProcess.once("close", resolveClose)),
          sleep(1_000),
        ]);
      }
    }
  }
}

run("mkdir", ["-p", packDir]);

const tarballs = new Map();
for (const pkgDir of packages) {
  const pack = firstJson(
    runJson(
      pnpmCommand.command,
      [...pnpmCommand.prefixArgs, "pack", "--json", "--pack-destination", packDir],
      {
        cwd: join(root, pkgDir),
      },
    ),
  );
  tarballs.set(
    pack.name,
    `file:${pack.filename.startsWith("/") ? pack.filename : join(packDir, pack.filename)}`,
  );
}

run("node", ["packages/create-foundry-ui-app/dist/index.mjs", appDir, "--no-install"]);

const packageJsonPath = join(appDir, "package.json");
const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
const generatedOverrides = packageJson.overrides ?? {};
for (const [name, specifier] of tarballs) {
  packageJson.dependencies[name] = specifier;
}
packageJson.pnpm = {
  ...(packageJson.pnpm ?? {}),
  overrides: {
    ...generatedOverrides,
    ...(packageJson.pnpm?.overrides ?? {}),
    ...Object.fromEntries(tarballs),
  },
};
packageJson.overrides = {
  ...generatedOverrides,
  ...Object.fromEntries(tarballs),
};
writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);

await runPnpmLiveOutput(["install", "--frozen-lockfile=false"], {
  cwd: appDir,
  timeoutMs: 5 * 60_000,
});
const buildOutput = await runPnpmLiveOutput(["build"], {
  cwd: appDir,
  timeoutMs: 3 * 60_000,
});

if (buildOutput.includes("Some chunks are larger than 500 kB")) {
  throw new Error("Starter production build emitted Vite's large chunk warning.");
}

// The build above is the DEFAULT scaffold, where voice is switched off and
// tree-shaken out entirely. That is worth proving, but on its own it can only
// ever exercise the half of the template where voice does not exist — which is
// how a missing Tailwind @source for the voice package survived review: with
// the feature off, none of its classes are referenced, so none are missing.
//
// Build it again with the feature ON and check the CSS actually carries the
// utilities those components use.
const voiceBuild = await runPnpmLiveOutput(["build"], {
  cwd: appDir,
  timeoutMs: 3 * 60_000,
  env: { ...process.env, VITE_VOICE_PROXY_URL: "ws://localhost:8080/ws" },
});
if (voiceBuild.includes("Some chunks are larger than 500 kB")) {
  throw new Error("Voice-enabled starter build emitted Vite's large chunk warning.");
}

const voiceAssets = join(appDir, "dist", "assets");
const cssFiles = readdirSync(voiceAssets).filter((f) => f.endsWith(".css"));
const css = cssFiles.map((f) => readFileSync(join(voiceAssets, f), "utf8")).join("\n");
const jsFiles = readdirSync(voiceAssets).filter((f) => f.endsWith(".js"));
const js = jsFiles.map((f) => readFileSync(join(voiceAssets, f), "utf8")).join("\n");

if (!js.includes("VoiceLive") && !js.includes("voice-live")) {
  throw new Error(
    "Voice-enabled starter build contains no Voice Live code — the env gate did not switch it on.",
  );
}
// Classes that exist ONLY in the voice package. If its dist is not a Tailwind
// source, these are absent and the mic button and stage render unstyled.
for (const utility of ["object-cover", "ring-background"]) {
  if (!css.includes(utility)) {
    throw new Error(
      `Voice-enabled starter CSS is missing "${utility}" — add the voice package to the ` +
        `template's Tailwind @source directives.`,
    );
  }
}

if (runBrowserSmoke) {
  await runBrowserStarterSmoke();
}

console.log(`Starter smoke passed in ${appDir}`);

if (browserSmokeWatchdog) {
  clearTimeout(browserSmokeWatchdog);
  process.exit(0);
}
