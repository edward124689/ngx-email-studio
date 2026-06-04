#!/usr/bin/env node
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { once } from 'node:events';

const port = Number(process.env.NES_TIPTAP_CURSOR_PORT || 4230);
const server = spawn('npx', ['ng', 'serve', 'demo', '--host', '127.0.0.1', '--port', String(port)], {
  cwd: new URL('..', import.meta.url).pathname,
  stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env, NG_FORCE_TTY: '0' },
});
let logs = '';
server.stdout.on('data', (chunk) => { logs += chunk.toString(); });
server.stderr.on('data', (chunk) => { logs += chunk.toString(); });

async function waitForServer() {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/`);
      if (res.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`dev server did not start:\n${logs}`);
}

async function editorHandle(page) {
  await page.waitForFunction(() => document.querySelector('ngx-email-studio')?.shadowRoot?.querySelector('.nes-tiptap-editor .ProseMirror'));
  return page.locator('ngx-email-studio').evaluateHandle((host) => host.shadowRoot.querySelector('.nes-tiptap-editor .ProseMirror'));
}

try {
  await waitForServer();
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`http://127.0.0.1:${port}/?editor=tiptap`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelector('ngx-email-studio')?.shadowRoot?.querySelector('.nes-render-text'));
  const studio = page.locator('ngx-email-studio');
  await studio.evaluate((host) => host.shadowRoot.querySelector('.nes-render-text')?.closest('article')?.click());
  const editor = await editorHandle(page);
  const titleBox = await studio.locator('.nes-tiptap-editor h1').first().boundingBox();
  if (!titleBox) throw new Error('missing hero title bounding box');
  await page.mouse.click(titleBox.x + titleBox.width * 0.45, titleBox.y + titleBox.height / 2);
  await page.keyboard.type('Z');
  const afterTitleClick = await editor.evaluate((node) => node.innerHTML || '');
  if (!/<h1>[^<]*Z[^<]*<\/h1>/.test(afterTitleClick) || afterTitleClick.endsWith('Z</p>')) throw new Error(`hero title click did not edit in place: ${afterTitleClick}`);

  await editor.evaluate((node) => node.focus());
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
  await page.keyboard.type('Alpha bravo charlie delta echo');
  const box = await editor.evaluate((node) => {
    const rect = node.getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  });

  await page.mouse.click(box.x + Math.floor(box.width * 0.35), box.y + 18);
  await page.keyboard.type('X');
  const afterLineClick = await editor.evaluate((node) => node.textContent || '');
  if (!afterLineClick.includes('chXarlie')) throw new Error(`line click did not insert in middle: ${afterLineClick}`);

  const textRect = await editor.evaluate((node) => {
    const textNode = node.querySelector('p')?.firstChild;
    if (!textNode) throw new Error('missing paragraph text node');
    const range = document.createRange();
    range.selectNodeContents(textNode);
    const rect = Array.from(range.getClientRects())[0];
    range.detach();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  });
  await page.mouse.click(textRect.x + textRect.width + 40, textRect.y + textRect.height / 2);
  await page.keyboard.type('Y');
  const afterRightBlankClick = await editor.evaluate((node) => node.textContent || '');
  if (!afterRightBlankClick.includes('chXYarlie')) throw new Error(`right-side whitespace click did not preserve middle cursor: ${afterRightBlankClick}`);
  if (afterRightBlankClick.endsWith('Y')) throw new Error(`right-side whitespace click inserted at end: ${afterRightBlankClick}`);

  const panelBox = await page.locator('ngx-email-studio').evaluate((host) => {
    const rect = host.shadowRoot.querySelector('.nes-tiptap-editor').getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  });
  await page.mouse.click(panelBox.x + Math.floor(panelBox.width * 0.35), panelBox.y + Math.floor(panelBox.height * 0.75));
  await page.keyboard.type('Y');
  const afterBlankClick = await editor.evaluate((node) => node.textContent || '');
  if (!afterBlankClick.includes('chXYYarlie')) throw new Error(`blank click moved cursor unexpectedly: ${afterBlankClick}`);
  if (afterBlankClick.endsWith('Y')) throw new Error(`blank click inserted at end: ${afterBlankClick}`);
  console.log('Tiptap cursor smoke passed');
  await browser.close();
} finally {
  server.kill('SIGTERM');
  await once(server, 'exit').catch(() => {});
}
