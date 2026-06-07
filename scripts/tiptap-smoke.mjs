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
  for (const marker of ['Paragraph', 'H1', 'Size', 'Line', 'Table', '2×2', '4×4', 'Table tools', 'Merge', 'Split', 'Head row', 'Bg', 'Border']) {
    if (!toolbarText?.includes(marker)) throw new Error(`Tiptap toolbar missing ${marker}: ${toolbarText}`);
  }
  const tableToolsCollapsed = await studio.locator('.nes-tiptap-toolbar .nes-tiptap-table-tools').first().evaluate((node) => !(node instanceof HTMLDetailsElement) || !node.open);
  if (!tableToolsCollapsed) throw new Error('Tiptap table tools should be collapsed by default to avoid crowding the inspector');
  for (const label of ['Undo', 'Redo', 'Bold', 'Italic', 'Underline', 'Bullet list', 'Align center', 'Add link', 'Edit HTML source']) {
    const count = await studio.locator(`.nes-tiptap-toolbar button[aria-label="${label}"] .nes-icon`).count();
    if (count === 0) throw new Error(`Tiptap icon button missing ${label}`);
  }
  const rowBreakCount = await studio.locator('.nes-tiptap-toolbar .nes-tiptap-row-break').count();
  if (rowBreakCount < 2) throw new Error(`Tiptap toolbar row breaks missing: ${rowBreakCount}`);
  const groupLayout = await studio.locator('.nes-tiptap-toolbar .nes-tiptap-group').evaluateAll((groups) => groups
    .filter((group) => group.getClientRects().length > 0)
    .map((group) => {
    const style = getComputedStyle(group);
    const childTops = Array.from(group.children)
      .filter((child) => !child.classList.contains('nes-tiptap-row-break'))
      .map((child) => Math.round(child.getBoundingClientRect().top));
    return {
      className: group.className,
      flexWrap: style.flexWrap,
      rows: new Set(childTops).size,
    };
  }));
  const wrappedGroups = groupLayout.filter((group) => group.flexWrap !== 'nowrap' || group.rows > 1);
  if (wrappedGroups.length) throw new Error(`Tiptap control groups should not wrap internally: ${JSON.stringify(wrappedGroups)}`);
  const toolbarOverflow = await studio.locator('.nes-tiptap-toolbar').first().evaluate((toolbar) => {
    const toolbarRect = toolbar.getBoundingClientRect();
    const overflowing = Array.from(toolbar.querySelectorAll('.nes-tiptap-group')).filter((group) => {
      if (!group.getClientRects().length) return false;
      const rect = group.getBoundingClientRect();
      return rect.left < toolbarRect.left - 1 || rect.right > toolbarRect.right + 1;
    }).map((group) => ({ className: group.className, right: group.getBoundingClientRect().right, toolbarRight: toolbarRect.right }));
    return { clientWidth: toolbar.clientWidth, scrollWidth: toolbar.scrollWidth, overflowing };
  });
  if (toolbarOverflow.scrollWidth > toolbarOverflow.clientWidth + 1 || toolbarOverflow.overflowing.length) {
    throw new Error(`Tiptap toolbar overflowed inspector: ${JSON.stringify(toolbarOverflow)}`);
  }
  const tooltipContent = await studio.locator('.nes-tiptap-toolbar button[aria-label="Bold"]').evaluate((node) => getComputedStyle(node, '::after').content);
  if (!tooltipContent.includes('Bold')) throw new Error(`Tiptap icon hover label CSS missing: ${tooltipContent}`);
  await studio.locator('.nes-tiptap-toolbar button[aria-label="Add link"]').first().click();
  await page.locator('.nes-tiptap-prompt-modal input[name="tiptapPromptValue"]').waitFor({ state: 'visible', timeout: 15_000 });
  const linkPromptTitle = await page.locator('.nes-tiptap-prompt-modal').textContent();
  if (!linkPromptTitle?.includes('Edit link URL')) throw new Error(`Link prompt modal missing expected title: ${linkPromptTitle}`);
  await page.locator('.nes-tiptap-prompt-modal input[name="tiptapPromptValue"]').fill('https://example.com/tiptap-smoke');
  await page.locator('.nes-tiptap-prompt-modal button', { hasText: 'Apply' }).click();
  await page.locator('.nes-tiptap-prompt-modal').waitFor({ state: 'detached', timeout: 15_000 });
  await studio.locator('.nes-tiptap-toolbar button[aria-label="Insert 2 by 2 table"]').first().click();
  await studio.locator('.nes-tiptap-editor .ProseMirror table').waitFor({ state: 'visible', timeout: 15_000 });
  const tableUi = await studio.locator('.nes-tiptap-editor .ProseMirror').first().evaluate((node) => ({
    hasTable: !!node.querySelector('table'),
    hasResizeHandle: !!node.querySelector('.column-resize-handle'),
    hasWrapper: !!node.querySelector('.tableWrapper'),
  }));
  if (!tableUi.hasTable || !tableUi.hasWrapper) throw new Error(`Tiptap table wrapper missing: ${JSON.stringify(tableUi)}`);
  await studio.locator('.nes-tiptap-toolbar .nes-tiptap-table-tools').first().evaluate((node) => { if (node instanceof HTMLDetailsElement) node.open = true; });
  await studio.locator('.nes-tiptap-toolbar button[aria-label="Set cell width"]').first().click();
  await page.locator('.nes-tiptap-prompt-modal input[name="tiptapPromptValue"]').waitFor({ state: 'visible', timeout: 15_000 });
  const cellPromptText = await page.locator('.nes-tiptap-prompt-modal').textContent();
  if (!cellPromptText?.includes('Table cell style') || !cellPromptText.includes('Cell width')) throw new Error(`Cell style prompt modal missing expected copy: ${cellPromptText}`);
  await page.locator('.nes-tiptap-prompt-modal input[name="tiptapPromptValue"]').fill('180px');
  await page.locator('.nes-tiptap-prompt-modal button', { hasText: 'Apply' }).click();
  await page.locator('.nes-tiptap-prompt-modal').waitFor({ state: 'detached', timeout: 15_000 });
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
