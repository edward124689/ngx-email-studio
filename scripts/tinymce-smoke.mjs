#!/usr/bin/env node
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { once } from 'node:events';

const port = Number(process.env.NES_SMOKE_PORT || 4311);
const url = `http://127.0.0.1:${port}/?editor=tinymce`;
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

  // TinyMCE should initialize in the light DOM and expose a visible toolbar.
  await studio.locator('.tox-tinymce').first().waitFor({ state: 'visible', timeout: 30_000 });
  await studio.locator('.tox-edit-area iframe').first().waitFor({ state: 'visible', timeout: 30_000 });

  // Pressing Enter in a scrolled TinyMCE document should keep the caret and following typed text at the bottom.
  await page.evaluate(() => {
    const tinyMce = globalThis.tinymce;
    const editor = tinyMce?.activeEditor;
    const longHtml = Array.from({ length: 32 }, (_, index) => `<p>Line ${index + 1} abc</p>`).join('');
    editor?.setContent(longHtml);
    editor?.focus();
    const doc = editor?.getDoc();
    const lastBlock = doc?.body?.lastElementChild;
    if (editor && lastBlock) {
      editor.selection.select(lastBlock, true);
      editor.selection.collapse(false);
    }
  });
  const inlineFrame = await studio.locator('.tox-edit-area iframe').first().contentFrame();
  const beforeEnterScroll = await inlineFrame.locator('body').evaluate((body) => {
    const scroller = document.scrollingElement || document.documentElement;
    scroller.scrollTop = scroller.scrollHeight;
    return scroller.scrollTop;
  });
  if (beforeEnterScroll <= 0) throw new Error('TinyMCE scroll regression setup did not create a scrolled editor');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(380);
  const afterEnterScroll = await inlineFrame.locator('body').evaluate(() => (document.scrollingElement || document.documentElement).scrollTop);
  if (afterEnterScroll < beforeEnterScroll - 20) throw new Error(`TinyMCE Enter jumped upward: before=${beforeEnterScroll}, after=${afterEnterScroll}`);
  await page.keyboard.type('XYZ');
  await page.waitForTimeout(150);
  const typedResult = await page.evaluate(() => {
    const editor = globalThis.tinymce?.activeEditor;
    const doc = editor?.getDoc();
    const scroller = doc?.scrollingElement || doc?.documentElement;
    const html = editor?.getContent() || '';
    return { html, scrollTop: scroller?.scrollTop ?? 0 };
  });
  if (typedResult.scrollTop < beforeEnterScroll - 20) throw new Error(`TinyMCE typing after Enter jumped upward: before=${beforeEnterScroll}, after=${typedResult.scrollTop}`);
  if (!/<p>XYZ<\/p>\s*$/.test(typedResult.html)) throw new Error(`TinyMCE typed text did not stay at the new bottom paragraph: ${typedResult.html.slice(0, 120)} ... ${typedResult.html.slice(-160)}`);

  // Exercise a real TinyMCE dropdown/popover. This catches skin/popup regressions
  // without relying on a specific translated toolbar label.
  const toolbarButtons = studio.locator('.tox button:not([aria-disabled="true"]), .tox [role="button"]:not([aria-disabled="true"])');
  const buttonCount = await toolbarButtons.count();
  if (buttonCount === 0) throw new Error('TinyMCE toolbar rendered but no toolbar buttons were found');
  let dropdownOpened = false;
  for (let i = 0; i < Math.min(buttonCount, 12); i += 1) {
    await toolbarButtons.nth(i).click({ timeout: 5_000 });
    try {
      await page.locator('.tox-toolbar__overflow, .tox-menu, .tox-collection, .tox-pop').first().waitFor({ state: 'visible', timeout: 1_500 });
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
    await page.locator('.tox-collection, .tox-menu, .tox-pop').first().waitFor({ state: 'visible', timeout: 5_000 });
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
