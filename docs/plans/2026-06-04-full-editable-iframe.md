# Full Editable Iframe Canvas Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Move ngx-email-studio toward a fully iframe-isolated email canvas, step by step, without breaking current drag/drop, selection, outline navigation, inspector editing, export, or demo deployment.

**Architecture:** Introduce an iframe renderer progressively. Start with a read-only iframe preview that renders `lastHtml`, then add a lightweight iframe bridge, then move canvas rendering into an iframe while keeping parent-owned document state. Full editability comes from iframe-to-parent events (`select`, `duplicate`, `delete`, `drop`, `reorder`, `scroll`) and parent-to-iframe render/scroll messages. Do not move the whole Angular app into the iframe unless the bridge approach proves insufficient.

**Tech Stack:** Angular 21 standalone component, TypeScript, Angular CDK drag/drop, DOM iframe `srcdoc`, `postMessage`/direct iframe `contentWindow` bridge, Vitest/Karma-style Angular tests, GitHub Pages demo deploy.

---

## Decisions Confirmed

- We want to eventually reach **full editable iframe canvas**.
- We want to do it **step by step**, not one big rewrite.
- Existing editor features must keep working throughout:
  - drag/drop from palette;
  - selecting nodes;
  - inspector edits;
  - section/content module hierarchy;
  - nested floating tools;
  - outline click scroll;
  - outline same-parent drag reorder;
  - HTML/MJML export;
  - GitHub Pages demo.
- Email/layout sizing rules remain:
  - email/body: `width: 100%`, `max-width: 600px`;
  - section: `width: 100%`, `max-width: 600px`;
  - columns: configurable width/max-width;
  - exported columns stack at real viewport `<=480px`.
- Preview iframe is useful because it isolates website CSS and lets media queries react to iframe viewport, not browser viewport.

## Remaining Open Questions

1. Should iframe edit mode initially support drag/drop from the parent palette, or should first editable iframe milestone only support click/select/floating tools?
   - Recommended: click/select/floating tools first, drag/drop later.
2. Should the iframe renderer use the exact exported HTML, or a dedicated editor HTML with `data-node-id` hooks and editor overlays?
   - Recommended: dedicated editor HTML for edit mode; exported HTML for preview mode.
3. Should full iframe editing keep Angular rendering in parent and send static HTML to iframe, or run a mini renderer app inside iframe?
   - Recommended: static HTML + event bridge first. Avoid second Angular app unless necessary.

---

## Phase 0: Safety Baseline

### Task 0.1: Capture current behavior with tests

**Objective:** Lock existing behavior before iframe work.

**Files:**
- Modify: `projects/ngx-email-studio/src/lib/ngx-email-studio.spec.ts`

**Steps:**
1. Add/confirm tests for:
   - default email/body width and max-width;
   - section width/max-width defaults;
   - column width/max-width controls;
   - exported column `@media only screen and (max-width:480px)`;
   - outline click scroll;
   - nested floating tools;
   - same-parent outline reorder.
2. Run:
   ```bash
   npm run build:lib && npm test -- --watch=false
   ```
3. Expected:
   ```text
   ngx-email-studio: all tests passed
   demo: all tests passed
   ```
4. Commit only if new tests are added:
   ```bash
   git add projects/ngx-email-studio/src/lib/ngx-email-studio.spec.ts
   git commit -m "test: lock current editor behavior before iframe work"
   ```

---

## Phase 1: Read-only iframe preview mode

### Task 1.1: Add explicit canvas mode state

**Objective:** Add a mode switch without changing existing edit canvas behavior.

**Files:**
- Modify: `projects/ngx-email-studio/src/lib/ngx-email-studio.ts`
- Test: `projects/ngx-email-studio/src/lib/ngx-email-studio.spec.ts`

**Implementation sketch:**
```ts
canvasMode: 'edit' | 'preview' = 'edit';

setCanvasMode(mode: 'edit' | 'preview'): void {
  this.canvasMode = mode;
}
```

**Template sketch:**
```html
<div class="nes-mode-toggle" role="group" aria-label="Canvas mode">
  <button type="button" [class.is-active]="canvasMode === 'edit'" (click)="setCanvasMode('edit')">Edit</button>
  <button type="button" [class.is-active]="canvasMode === 'preview'" (click)="setCanvasMode('preview')">Preview</button>
</div>
```

**Test:**
- Default mode is `edit`.
- Clicking Preview changes mode to `preview`.
- Clicking Edit changes mode back.

**Verify:**
```bash
npm run build:lib && npm test -- --watch=false
```

### Task 1.2: Render exported HTML in iframe in Preview mode

**Objective:** Use iframe `srcdoc` for preview mode so website CSS cannot affect email preview.

**Files:**
- Modify: `projects/ngx-email-studio/src/lib/ngx-email-studio.ts`
- Test: `projects/ngx-email-studio/src/lib/ngx-email-studio.spec.ts`

**Template sketch:**
```html
<ng-container *ngIf="canvasMode === 'edit'; else iframePreview">
  <!-- existing editable .nes-canvas stays unchanged -->
</ng-container>

<ng-template #iframePreview>
  <iframe
    class="nes-preview-frame"
    title="Email preview"
    sandbox="allow-same-origin"
    [style.width.px]="previewWidth"
    [attr.srcdoc]="lastHtml">
  </iframe>
</ng-template>
```

**CSS sketch:**
```css
.nes-preview-frame {
  display: block;
  max-width: 100%;
  min-height: 720px;
  margin: 0 auto;
  border: 0;
  background: #fff;
  border-radius: 0 0 16px 16px;
}
```

**Tests:**
- Edit mode renders `.nes-canvas` and no iframe.
- Preview mode renders `.nes-preview-frame` and no editable `.nes-canvas`.
- Iframe `srcdoc` contains `lastHtml` and `@media only screen and (max-width:480px)`.
- Preview width chip `400` sets iframe width to `400px`.

**Verify:**
```bash
npm run build:lib && npm test -- --watch=false
npm run build:pages
```

### Task 1.3: Add preview mode UX guardrails

**Objective:** Make it obvious iframe preview is read-only.

**Files:**
- Modify: `projects/ngx-email-studio/src/lib/ngx-email-studio.ts`

**Implementation:**
Add text in preview header:
```text
Preview mode renders the exported HTML in an isolated iframe. Switch to Edit to change content.
```

**Tests:**
- Preview mode helper text appears only in Preview mode.

**Verify:**
```bash
npm run build:lib && npm test -- --watch=false
```

**Commit:**
```bash
git add projects/ngx-email-studio/src/lib/ngx-email-studio.ts projects/ngx-email-studio/src/lib/ngx-email-studio.spec.ts
git commit -m "feat: add isolated iframe preview mode"
```

---

## Phase 2: Build an iframe bridge foundation

### Task 2.1: Extract preview iframe HTML builder

**Objective:** Stop binding raw `lastHtml` directly and create a controlled iframe document builder.

**Files:**
- Modify: `projects/ngx-email-studio/src/lib/ngx-email-studio.ts`
- Test: `projects/ngx-email-studio/src/lib/ngx-email-studio.spec.ts`

**Implementation sketch:**
```ts
get previewIframeHtml(): string {
  return this.buildIframeDocument(this.lastHtml, { editable: false });
}

private buildIframeDocument(bodyHtml: string, options: { editable: boolean }): string {
  return bodyHtml;
}
```

**Reason:** Later we can inject bridge scripts/styles for editable iframe without touching export HTML.

**Tests:**
- iframe uses `previewIframeHtml`.
- exported `lastHtml` remains unchanged.

### Task 2.2: Add iframe readiness handshake

**Objective:** Parent component can know when iframe loaded and ready.

**Files:**
- Modify: `projects/ngx-email-studio/src/lib/ngx-email-studio.ts`
- Test: `projects/ngx-email-studio/src/lib/ngx-email-studio.spec.ts`

**Implementation sketch:**
```ts
iframeReady = false;

handlePreviewFrameLoad(event: Event): void {
  this.iframeReady = true;
}
```

**Template:**
```html
<iframe ... (load)="handlePreviewFrameLoad($event)"></iframe>
```

**Tests:**
- `iframeReady` false before load.
- Calling `handlePreviewFrameLoad()` sets true.

### Task 2.3: Add safe message/event types

**Objective:** Define bridge event shape before editable iframe work.

**Files:**
- Modify: `projects/ngx-email-studio/src/lib/ngx-email-studio.ts`

**Types sketch:**
```ts
type EmailIframeMessage =
  | { type: 'nes:ready' }
  | { type: 'nes:select'; nodeId: string }
  | { type: 'nes:duplicate'; nodeId: string }
  | { type: 'nes:delete'; nodeId: string }
  | { type: 'nes:scroll-complete'; nodeId: string };
```

**YAGNI:** Do not implement drag/drop bridge yet.

**Commit:**
```bash
git add projects/ngx-email-studio/src/lib/ngx-email-studio.ts projects/ngx-email-studio/src/lib/ngx-email-studio.spec.ts
git commit -m "feat: add iframe preview bridge foundation"
```

---

## Phase 3: Iframe-rendered read-only editor canvas

### Task 3.1: Add node IDs to rendered/export-like HTML for iframe edit renderer

**Objective:** Generate iframe renderer HTML with `data-node-id` hooks, without changing export HTML.

**Files:**
- Modify: `projects/ngx-email-studio/src/lib/ngx-email-studio.ts`
- Test: `projects/ngx-email-studio/src/lib/ngx-email-studio.spec.ts`

**Implementation sketch:**
```ts
private renderNodeForIframe(node: EmailNode): string {
  return this.nodeToHtml(node, { includeEditorHooks: true });
}
```

If `nodeToHtml` currently cannot accept options, add a small internal option object:
```ts
private nodeToHtml(node: EmailNode, options: { editorHooks?: boolean } = {}): string
```

**Expected hook:**
```html
<table data-nes-node-id="abc123" data-nes-node-type="section">...</table>
```

**Tests:**
- `lastHtml` does not contain `data-nes-node-id`.
- `editableIframeHtml` contains `data-nes-node-id`.

### Task 3.2: Render read-only iframe canvas in a new experimental mode

**Objective:** Add an internal/hidden `iframe-edit` mode that renders the editable document in iframe but does not support editing yet.

**Files:**
- Modify: `projects/ngx-email-studio/src/lib/ngx-email-studio.ts`

**State:**
```ts
type CanvasMode = 'edit' | 'preview' | 'iframe-edit';
```

**UI:**
Keep `iframe-edit` hidden behind a dev-only flag or temporary method during development. Do not expose publicly until stable.

**Tests:**
- `iframe-edit` mode iframe contains node hooks.
- Existing edit mode still uses Angular canvas.

**Commit:**
```bash
git add projects/ngx-email-studio/src/lib/ngx-email-studio.ts projects/ngx-email-studio/src/lib/ngx-email-studio.spec.ts
git commit -m "feat: add iframe-rendered editor canvas prototype"
```

---

## Phase 4: Selection bridge

### Task 4.1: Inject minimal iframe click script

**Objective:** Clicking a node inside iframe sends selected node ID to parent.

**Files:**
- Modify: `projects/ngx-email-studio/src/lib/ngx-email-studio.ts`
- Test: `projects/ngx-email-studio/src/lib/ngx-email-studio.spec.ts`

**Script sketch injected into iframe document:**
```html
<script>
  document.addEventListener('click', function(event) {
    var target = event.target.closest('[data-nes-node-id]');
    if (!target) return;
    event.preventDefault();
    parent.postMessage({ type: 'nes:select', nodeId: target.getAttribute('data-nes-node-id') }, '*');
  });
</script>
```

**Parent listener sketch:**
```ts
private handleIframeMessage = (event: MessageEvent<EmailIframeMessage>) => {
  if (!event.data || typeof event.data !== 'object') return;
  if (event.data.type === 'nes:select') this.selectNode(event.data.nodeId);
};
```

**Security note:** Since iframe uses `srcdoc` generated locally, `'*'` is acceptable short-term, but prefer checking `event.source === iframe.contentWindow` once iframe reference is available.

**Tests:**
- `handleIframeMessage({ data: { type: 'nes:select', nodeId } })` selects node.
- Unknown message ignored.

### Task 4.2: Highlight selected node inside iframe

**Objective:** Parent selection state is reflected inside iframe render.

**Implementation options:**
1. Rebuild iframe `srcdoc` when `selectedNodeId` changes and add selected class.
2. Post message to iframe to update class without full rebuild.

**Recommended first step:** rebuild iframe `srcdoc` on selection, because simpler.

**Expected HTML:**
```html
<table data-nes-node-id="abc123" class="nes-iframe-selected">...</table>
```

**Tests:**
- `editableIframeHtml` includes selected class for selected node only.

**Commit:**
```bash
git add projects/ngx-email-studio/src/lib/ngx-email-studio.ts projects/ngx-email-studio/src/lib/ngx-email-studio.spec.ts
git commit -m "feat: bridge iframe node selection"
```

---

## Phase 5: Floating tools bridge

### Task 5.1: Render iframe floating tools for selected node

**Objective:** Show duplicate/delete tools inside iframe for selected node.

**Files:**
- Modify: `projects/ngx-email-studio/src/lib/ngx-email-studio.ts`

**Implementation sketch:**
Inject buttons near selected node:
```html
<div class="nes-iframe-tools">
  <button data-nes-action="duplicate">Duplicate</button>
  <button data-nes-action="delete">Delete</button>
</div>
```

**Script:**
```js
document.addEventListener('click', function(event) {
  var action = event.target.closest('[data-nes-action]');
  if (!action) return;
  var selected = document.querySelector('.nes-iframe-selected');
  if (!selected) return;
  parent.postMessage({ type: 'nes:' + action.dataset.nesAction, nodeId: selected.dataset.nesNodeId }, '*');
});
```

**Tests:**
- Selected node renders iframe tools.
- Readonly mode does not render duplicate/delete actions.
- Parent handles `nes:duplicate` by calling existing duplicate flow.
- Parent handles `nes:delete` by calling existing delete flow.

**Commit:**
```bash
git commit -m "feat: add iframe floating tools bridge"
```

---

## Phase 6: Outline scroll bridge

### Task 6.1: Scroll iframe to node from parent outline

**Objective:** When outline item clicked in iframe mode, iframe scrolls to node.

**Files:**
- Modify: `projects/ngx-email-studio/src/lib/ngx-email-studio.ts`

**Approach:**
- Keep parent outline click calling `selectNodeFromOutline(node.id)`.
- If canvas mode is iframe edit, send message:
  ```ts
  iframe.contentWindow?.postMessage({ type: 'nes:scroll-to-node', nodeId }, '*');
  ```
- Iframe script receives it and calls:
  ```js
  document.querySelector('[data-nes-node-id="' + nodeId + '"]')?.scrollIntoView({ block: 'center' });
  ```

**Tests:**
- Parent posts scroll message in iframe edit mode.
- Normal edit mode still scrolls `.nes-stage` directly.

**Commit:**
```bash
git commit -m "feat: bridge outline scrolling into iframe canvas"
```

---

## Phase 7: Drag/drop bridge — staged carefully

### Task 7.1: Keep parent edit mode as fallback

**Objective:** Before drag/drop iframe work, keep a user-visible fallback to current editor.

**Requirement:** Do not remove existing Angular edit canvas until iframe drag/drop is proven.

### Task 7.2: Implement iframe internal reorder only

**Objective:** First drag operation inside iframe should only reorder nodes within the same parent already rendered in iframe.

**Scope:** Same-parent reorder only. No palette-to-iframe yet.

**Approach:**
- Use native HTML5 drag handles inside iframe, similar to current Outline native drag pattern.
- Iframe sends:
  ```ts
  { type: 'nes:reorder', sourceId, targetId, position: 'before' | 'after' }
  ```
- Parent validates same-parent with existing `findNodeLocation()` logic.

**Tests:**
- Valid same-parent reorder changes document.
- Cross-parent reorder is rejected.
- MJML structure remains legal.

### Task 7.3: Implement palette-to-iframe drop

**Objective:** Dragging from parent palette into iframe creates a node in iframe canvas.

**Risk:** This is hardest part.

**Recommended approach:**
- Do not rely on Angular CDK across iframe.
- On palette drag start, store a simple payload in parent:
  ```ts
  activePaletteDrag = { type, preset };
  ```
- Iframe listens for native `dragover/drop` on drop zones and posts:
  ```ts
  { type: 'nes:drop-palette', targetContainerId, index, paletteType, preset }
  ```
- Parent creates node using existing `createNodeFromPalette()` / drop normalization logic.

**Tests:**
- Drop text into section creates content child.
- Drop row into body creates row.
- Drop content module at root wraps/legalizes if existing behavior requires it.
- Invalid drop target rejected.

**Commit:**
```bash
git commit -m "feat: bridge iframe drag and drop editing"
```

---

## Phase 8: Make iframe edit mode default

### Task 8.1: Feature flag iframe edit mode

**Objective:** Allow toggling between legacy edit canvas and iframe edit canvas while stabilizing.

**Config sketch:**
```ts
export interface EmailStudioConfig {
  iframeCanvas?: boolean;
}
```

**Behavior:**
- `iframeCanvas: false` = legacy Angular canvas.
- `iframeCanvas: true` = iframe edit canvas.

**Tests:**
- Default remains legacy until explicitly enabled.
- Demo can opt in after smoke testing.

### Task 8.2: Dogfood demo with iframe edit mode

**Objective:** Enable iframe edit canvas in demo after all critical interactions pass.

**Files:**
- Modify: `projects/demo/src/app/app.ts`

**Manual smoke checklist:**
- Select text module from iframe canvas.
- Edit rich text from inspector.
- Duplicate/delete nested module.
- Drag module within same section.
- Drop new content module into section.
- Outline click scrolls iframe canvas.
- Export HTML unchanged from legacy path.
- Preview mode still renders pure exported HTML.

**Commit:**
```bash
git commit -m "feat: enable iframe canvas in demo"
```

---

## Phase 9: Remove legacy canvas only after stability

### Task 9.1: Keep legacy for one release cycle

**Objective:** Do not delete working canvas immediately.

**Reason:** If iframe drag/drop has edge cases, fallback is valuable.

### Task 9.2: Remove legacy Angular canvas after confirmed stable

**Objective:** Simplify code only after iframe canvas is proven.

**Preconditions:**
- All automated tests pass.
- Manual smoke checklist passes on live demo.
- No regressions in export HTML/MJML.

---

## Verification Commands

Run these before every deploy:

```bash
npm run build:lib
npm test -- --watch=false
npm run build:pages
npm run pack:lib
rm -f ngx-email-studio-0.0.1.tgz
```

Deploy:

```bash
npm run deploy:pages
```

Live verify:

```bash
python3 - <<'PY'
import ssl, re, urllib.request
base='https://edward124689.github.io/ngx-email-studio/'
ctx=ssl._create_unverified_context()
html=urllib.request.urlopen(base, context=ctx, timeout=20).read().decode('utf-8','replace')
main=re.search(r'(main-[A-Z0-9]+\.js)', html).group(1)
js=urllib.request.urlopen(base+main, context=ctx, timeout=20).read().decode('utf-8','replace')
print('main:', main)
print('iframe preview:', 'nes-preview-frame' in js)
print('480 media:', '@media only screen and (max-width:480px)' in js)
print('column class:', 'nes-email-column' in js)
PY
```

---

## Manual Smoke Checklist

Use this after each iframe phase:

- [ ] Live page loads.
- [ ] TinyMCE asset loads.
- [ ] Existing edit mode still selects nodes.
- [ ] Existing edit mode drag/drop still works.
- [ ] Export MJML opens.
- [ ] Export HTML opens.
- [ ] Preview iframe mode renders the current document.
- [ ] Preview size `400` shows exported media-query behavior inside iframe.
- [ ] Website CSS does not affect iframe email styling.
- [ ] Working tree clean after deploy.

---

## Rollback Plan

If iframe changes feel wrong:

```bash
git revert <bad_commit_sha>
npm run build:lib && npm test -- --watch=false
npm run deploy:pages
```

Keep each phase in its own commit so rollback is cheap.

---

## Recommended Execution Order

1. Phase 0 baseline tests.
2. Phase 1 read-only iframe Preview mode.
3. Stop and manually review UX.
4. Phase 2 iframe bridge foundation.
5. Phase 3 hidden iframe-rendered editor canvas.
6. Stop and manually review rendering fidelity.
7. Phase 4 selection bridge.
8. Phase 5 floating tools bridge.
9. Phase 6 outline scroll bridge.
10. Phase 7 drag/drop bridge.
11. Phase 8 enable iframe edit mode behind config.
12. Phase 9 remove legacy only after stable.

**Recommendation:** Start with Phase 1 only. Do not start full editable iframe drag/drop until read-only iframe preview feels correct.
