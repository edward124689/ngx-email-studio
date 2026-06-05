#!/usr/bin/env node
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { once } from 'node:events';

const port = Number(process.env.NES_TIPTAP_SMOKE_PORT || 4314);
const url = `http://127.0.0.1:${port}/?editor=tiptap`;
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
  await studio.locator('.nes-tiptap-shell').first().waitFor({ state: 'visible', timeout: 30_000 });
  await studio.locator('.nes-tiptap-toolbar button').first().waitFor({ state: 'visible', timeout: 30_000 });
  const editor = studio.locator('.nes-tiptap-editor .ProseMirror').first();
  await editor.waitFor({ state: 'visible', timeout: 30_000 });

  const html = await editor.evaluate((node) => node.innerHTML);
  if (!html.includes('Product newsletter')) throw new Error(`Tiptap editor did not load document content: ${html}`);
  const legacyEditorCount = await studio.locator('.tox-tinymce, editor').count();
  if (legacyEditorCount !== 0) throw new Error('Default Tiptap mode unexpectedly rendered a legacy editor shell');

  console.log('Tiptap browser smoke passed');
} catch (error) {
  console.error(error);
  console.error('\n--- Angular server log ---\n');
  console.error(serverLog.slice(-8_000));
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  server.kill('SIGTERM');
  await once(server, 'exit').catch(() => {});
}
