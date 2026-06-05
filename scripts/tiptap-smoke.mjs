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
  const toolbarText = await studio.locator('.nes-tiptap-toolbar').first().textContent();
  for (const marker of ['Paragraph', 'H1', 'Size', 'Line', 'Table', '2×2', '4×4']) {
    if (!toolbarText?.includes(marker)) throw new Error(`Tiptap toolbar missing ${marker}: ${toolbarText}`);
  }
  for (const label of ['Undo', 'Redo', 'Bold', 'Italic', 'Underline', 'Bullet list', 'Align center', 'Add link', 'Edit HTML source']) {
    const count = await studio.locator(`.nes-tiptap-toolbar button[aria-label="${label}"] .nes-icon`).count();
    if (count === 0) throw new Error(`Tiptap icon button missing ${label}`);
  }
  await studio.locator('.nes-tiptap-toolbar button[aria-label="Edit HTML source"]').first().click();
  await studio.locator('.nes-source-modal textarea').waitFor({ state: 'visible', timeout: 15_000 });
  const sourceValue = await studio.locator('.nes-source-modal textarea').inputValue();
  if (!sourceValue.includes('Product newsletter')) throw new Error(`Source modal did not load rich text HTML: ${sourceValue}`);
  await studio.locator('.nes-source-modal button', { hasText: 'Cancel' }).click();
  await studio.locator('.nes-source-modal').waitFor({ state: 'detached', timeout: 15_000 });
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
