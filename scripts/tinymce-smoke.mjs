#!/usr/bin/env node
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { once } from 'node:events';

const port = Number(process.env.NES_SMOKE_PORT || 4311);
const url = `http://127.0.0.1:${port}/`;
const timeoutMs = 90_000;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer() {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // keep polling until Angular dev server is ready
    }
    await delay(1_000);
  }
  throw new Error(`Timed out waiting for demo server at ${url}`);
}

const server = spawn('npm', ['run', 'start', '--', '--host', '127.0.0.1', '--port', String(port)], {
  cwd: new URL('..', import.meta.url),
  stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env, BROWSER: 'none' },
});

let serverLog = '';
server.stdout.on('data', (chunk) => { serverLog += chunk.toString(); });
server.stderr.on('data', (chunk) => { serverLog += chunk.toString(); });

let browser;
try {
  await waitForServer();
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  await page.goto(url, { waitUntil: 'networkidle' });

  const studio = page.locator('ngx-email-studio').first();
  await studio.locator('.nes-shell').waitFor({ state: 'visible', timeout: 30_000 });
  await studio.locator('[data-node-id="hero_text"], [data-node-id="summary_text"], .nes-render-text').first().click({ timeout: 15_000 });

  // TinyMCE should initialize inside the Shadow DOM and expose a visible toolbar.
  await studio.locator('.tox-tinymce').first().waitFor({ state: 'visible', timeout: 30_000 });
  await studio.locator('.tox-edit-area iframe').first().waitFor({ state: 'visible', timeout: 30_000 });

  // Exercise a real TinyMCE dropdown/popover. This catches Shadow DOM skin/popup regressions
  // without relying on a specific translated toolbar label.
  const toolbarButtons = studio.locator('.tox button:not([aria-disabled="true"]), .tox [role="button"]:not([aria-disabled="true"])');
  const buttonCount = await toolbarButtons.count();
  if (buttonCount === 0) throw new Error('TinyMCE toolbar rendered but no toolbar buttons were found');
  let dropdownOpened = false;
  for (let i = 0; i < Math.min(buttonCount, 12); i += 1) {
    await toolbarButtons.nth(i).click({ timeout: 5_000 });
    try {
      await studio.locator('.tox-toolbar__overflow, .tox-menu, .tox-collection, .tox-pop').first().waitFor({ state: 'visible', timeout: 1_500 });
      dropdownOpened = true;
      break;
    } catch {
      await page.keyboard.press('Escape').catch(() => {});
    }
  }
  if (!dropdownOpened) throw new Error('TinyMCE toolbar rendered but no menu/dropdown opened from the first toolbar controls');
  const overflowTrigger = studio.locator('.tox-toolbar__overflow button[aria-haspopup="true"]').first();
  if (await overflowTrigger.count()) {
    await overflowTrigger.click({ timeout: 5_000 });
    await studio.locator('.tox-collection, .tox-menu, .tox-pop').first().waitFor({ state: 'visible', timeout: 5_000 });
  }
  await page.keyboard.press('Escape');

  // Exercise the large editor modal and its TinyMCE instance too.
  await studio.locator('.nes-expand-editor').first().click({ timeout: 15_000 });
  await studio.locator('.nes-rich-text-modal .tox-tinymce').first().waitFor({ state: 'visible', timeout: 30_000 });
  await studio.locator('.nes-rich-text-modal .tox-edit-area iframe').first().waitFor({ state: 'visible', timeout: 30_000 });

  console.log('TinyMCE browser smoke passed');
} catch (error) {
  console.error('TinyMCE browser smoke failed');
  console.error(error);
  console.error('\n--- dev server log ---\n' + serverLog.slice(-4000));
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  server.kill('SIGTERM');
  try { await once(server, 'exit'); } catch {}
}

if (process.exitCode) process.exit(process.exitCode);
