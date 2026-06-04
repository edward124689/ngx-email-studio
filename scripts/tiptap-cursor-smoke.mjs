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
  await page.locator('ngx-email-studio').evaluate((host) => host.shadowRoot.querySelector('.nes-render-text').click());
  const editor = await editorHandle(page);
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

  const panelBox = await page.locator('ngx-email-studio').evaluate((host) => {
    const rect = host.shadowRoot.querySelector('.nes-tiptap-editor').getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  });
  await page.mouse.click(panelBox.x + Math.floor(panelBox.width * 0.35), panelBox.y + Math.floor(panelBox.height * 0.75));
  await page.keyboard.type('Y');
  const afterBlankClick = await editor.evaluate((node) => node.textContent || '');
  if (!afterBlankClick.includes('chXYarlie')) throw new Error(`blank click moved cursor unexpectedly: ${afterBlankClick}`);
  if (afterBlankClick.endsWith('Y')) throw new Error(`blank click inserted at end: ${afterBlankClick}`);
  console.log('Tiptap cursor smoke passed');
  await browser.close();
} finally {
  server.kill('SIGTERM');
  await once(server, 'exit').catch(() => {});
}
