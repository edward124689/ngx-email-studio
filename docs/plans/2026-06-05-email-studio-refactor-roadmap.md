# Email Studio Refactor Roadmap Implementation Plan

> **For Hermes:** Use incremental extraction with build/test/smoke gates after each phase. Do not split UI child components until pure logic extraction is stable.

**Goal:** Continue reducing `projects/ngx-email-studio/src/lib/ngx-email-studio.ts` from the current ~2261 lines into maintainable focused modules without changing public API, DOM class names, light-DOM styling, Tiptap behavior, MJML/HTML output, or demo UX.

**Architecture:** Keep `NgxEmailStudio` as the main standalone Angular container for now. Extract pure helpers first (`html-export`, presenter/view-model helpers, drag/drop tree helpers), then extract Tiptap runtime orchestration if stable, and only then consider Angular child components. Every phase should be small enough to revert as one commit.

**Tech Stack:** Angular 21 standalone component, Angular CDK drag/drop, Tiptap/ProseMirror, frontend-only MJML import/export, Vite/Angular test runner, browser smokes.

---

## Current State

Already extracted:

```text
projects/ngx-email-studio/src/lib/ngx-email-studio.css
projects/ngx-email-studio/src/lib/models.ts
projects/ngx-email-studio/src/lib/config.ts
projects/ngx-email-studio/src/lib/constants.ts
projects/ngx-email-studio/src/lib/tree/block-factory.ts
projects/ngx-email-studio/src/lib/tree/node-utils.ts
projects/ngx-email-studio/src/lib/export/export-utils.ts
projects/ngx-email-studio/src/lib/export/mjml-export.ts
projects/ngx-email-studio/src/lib/import/mjml-import.ts
projects/ngx-email-studio/src/lib/tiptap/rich-text-sanitizer.ts
projects/ngx-email-studio/src/lib/tiptap/tiptap-extensions.ts
projects/ngx-email-studio/src/lib/tiptap/tiptap-options.ts
```

Current main file size:

```text
projects/ngx-email-studio/src/lib/ngx-email-studio.ts  ~2261 lines
```

Important invariants:

- Component remains light DOM: `host.shadowRoot === null`.
- Component metadata stays `encapsulation: ViewEncapsulation.None` unless a deliberate redesign happens.
- CSS root selector remains `ngx-email-studio`, not `:host`.
- Tiptap default remains enabled; `richTextEditor: 'tiptap' | 'plain'` only.
- TinyMCE must not return.
- `.ProseMirror { white-space: pre-wrap; }` must remain effective.
- Tiptap group nowrap regression must stay covered.
- Public import remains valid:

```ts
import { NgxEmailStudio } from 'ngx-email-studio';
```

---

## Phase 1: Extract HTML Export

**Objective:** Move the remaining HTML export generator out of `ngx-email-studio.ts` into `export/html-export.ts`.

**Why first:** This is pure logic, currently the biggest obvious block still inside the component, and future email-client hardening should not happen inside Angular UI code.

**Files:**

- Create: `projects/ngx-email-studio/src/lib/export/html-export.ts`
- Modify: `projects/ngx-email-studio/src/lib/ngx-email-studio.ts`
- Test: `projects/ngx-email-studio/src/lib/ngx-email-studio.spec.ts`

**Move from component:**

```text
renderHtml
nodeToHtml
rowToHtml
sectionToHtml
columnToHtml
blockToHtmlRow
blockToHtmlCellContent
outlookHtmlWidth
indent usage if only used by HTML
```

**Use existing shared utilities:**

```ts
import {
  columnMaxWidthCss,
  columnWidthCss,
  contentAlign,
  dimensionCss,
  dimensionHtmlWidthAttr,
  dimensionUnit,
  dimensionValue,
  escapeAttr,
  escapeHtml,
  indent,
  sectionMaxWidthCss,
  sectionPaddingCss,
  sectionWidthCss,
} from './export-utils';
```

**Component wrapper after extraction:**

```ts
import { renderHtml as renderHtmlDocument } from './export/html-export';

private renderHtml(document: EmailDocument): string {
  return renderHtmlDocument(document);
}
```

**Regression checks:**

- Existing HTML export tests must still pass:
  - email-client compatibility head / Outlook reset
  - 480px media query
  - wrapper width/background
  - formatted output newlines
  - sandboxed preview uses generated HTML
- Browser live should still show Preview iframe and Export HTML modal.

**Commands:**

```bash
npm run build:lib
npm test -- --watch=false
```

**Expected:**

```text
Library tests: 72 passed
Demo tests: 3 passed
```

**Commit:**

```bash
git add projects/ngx-email-studio/src/lib/export/html-export.ts projects/ngx-email-studio/src/lib/ngx-email-studio.ts
git commit -m "refactor: extract html export helper"
```

---

## Phase 2: Extract View / Presentation Helpers

**Objective:** Move pure UI label/value helpers out of the component while keeping the Angular template unchanged.

**Why second:** These are pure functions used by the template. They reduce component noise without introducing child component input/output complexity.

**Files:**

- Create: `projects/ngx-email-studio/src/lib/view/document-view.ts`
- Create: `projects/ngx-email-studio/src/lib/view/outline-view.ts`
- Modify: `projects/ngx-email-studio/src/lib/ngx-email-studio.ts`
- Test: existing spec file

**Move candidates:**

```text
outlineLabel
outlineMeta
outlineIcon
countOutlineNodes
plainText
backgroundFor
colorPickerValue
containedCssSize
isAlignableContent
contentAlign wrapper around export-utils contentAlign
dimensionValueFromCss
dimensionUnitFromCss
```

**Example helper shape:**

```ts
export function outlineLabel(node: EmailNode): string {
  if (node.type === 'section') return 'Section';
  if (node.type === 'row') return `MJML ${node.children?.length || 1} columns`;
  // ...existing logic
}
```

**Component wrapper pattern:**

```ts
outlineLabel(node: EmailNode): string {
  return outlineLabelForNode(node);
}
```

**Do not change:**

- Template class names
- Outline click behavior
- Stage scrolling behavior
- Body root node behavior

**Regression checks:**

- Outline nested tree test
- Section label test
- Sidebar tab tests
- Inspector control tests

**Commands:**

```bash
npm run build:lib
npm test -- --watch=false
```

**Commit:**

```bash
git add projects/ngx-email-studio/src/lib/view projects/ngx-email-studio/src/lib/ngx-email-studio.ts
git commit -m "refactor: extract view helpers"
```

---

## Phase 3: Extract Drag / Drop Helpers

**Objective:** Move drop validation and node normalization logic into `tree/drop-utils.ts` while leaving CDK event handling in the component.

**Why third:** Drag/drop has more state coupling than export helpers, but validation is mostly pure and worth isolating before UI component extraction.

**Files:**

- Create: `projects/ngx-email-studio/src/lib/tree/drop-utils.ts`
- Modify: `projects/ngx-email-studio/src/lib/ngx-email-studio.ts`
- Test: existing drag/drop specs

**Move candidates:**

```text
isPaletteItem
isEmailNode
isContentModule
nodeContainsId wrapper if possible
canDropIntoContainer pure portion
wrapForRootDrop pure portion
normalizeNestedDropNode pure portion
collectContainerDropListIds helper can move if prefix/id callback is passed in
```

**Keep in component:**

```text
drop(event)
createNodeForDrop(item, containerId)
selectedNodeId changes
emitDocument()
CDK-specific transferArrayItem / moveItemInArray calls
```

**Suggested helper signature:**

```ts
export function canDropIntoContainer(args: {
  data: unknown;
  containerId?: string;
  paletteDropListId: string;
  rootDropListId: string;
  findTargetContainer: (containerId: string) => EmailNode | undefined;
}): boolean
```

**Regression checks:**

- reject drops into palette
- reject cyclic drops
- drop palette blocks into row column
- normalize section presets dropped inside section
- red insertion-line styling still present

**Commands:**

```bash
npm run build:lib
npm test -- --watch=false
npm run smoke:tiptap
```

**Commit:**

```bash
git add projects/ngx-email-studio/src/lib/tree/drop-utils.ts projects/ngx-email-studio/src/lib/ngx-email-studio.ts
git commit -m "refactor: extract drag drop helpers"
```

---

## Phase 4: Extract Output / Clipboard / Modal Helpers

**Objective:** Separate output modal utilities from component state orchestration.

**Why fourth:** Copy/preview shell code is self-contained and currently mixed with editor/canvas logic.

**Files:**

- Create: `projects/ngx-email-studio/src/lib/output/output-utils.ts`
- Modify: `projects/ngx-email-studio/src/lib/ngx-email-studio.ts`
- Test: existing copy/export/preview specs

**Move candidates:**

```text
buildSandboxedPreviewShell
fallbackCopyToClipboard
output modal title/content pure mapping if useful
```

**Keep in component:**

```text
copyState
copyStateTimer
setCopyState
openOutputModal
closeOutputModal
previewHtmlOutput window.open orchestration
EventEmitter emissions
```

**Regression checks:**

- Export dropdown opens / closes on outside click and Escape
- MJML output modal
- HTML output modal
- sandboxed iframe preview shell
- clipboard success / fallback failure

**Commands:**

```bash
npm run build:lib
npm test -- --watch=false
```

**Commit:**

```bash
git add projects/ngx-email-studio/src/lib/output/output-utils.ts projects/ngx-email-studio/src/lib/ngx-email-studio.ts
git commit -m "refactor: extract output helpers"
```

---

## Phase 5: Extract Tiptap Runtime Controller Carefully

**Objective:** Move Tiptap editor lifecycle and command wrappers into a non-Angular helper/controller only if the previous phases are stable.

**Why later:** Tiptap is highly coupled to Angular lifecycle, selected node, modal state, DOM query timing, and cursor regression fixes. This phase is higher risk.

**Files:**

- Create: `projects/ngx-email-studio/src/lib/tiptap/tiptap-controller.ts`
- Modify: `projects/ngx-email-studio/src/lib/ngx-email-studio.ts`
- Test: Tiptap specs + browser smokes

**Move candidates:**

```text
createTiptapEditor
installTiptapBlankClickGuard
isTiptapStructuredEditorTarget
isPointInTiptapTextRect
tiptapTextSelectionFromPoint
tiptapSelectionAtDomOffset
tiptapContentBottom
syncTiptapContent
destroy editor helpers
```

**Keep in component initially:**

```text
syncTiptapEditors
syncInlineTiptapEditor
syncModalTiptapEditor
runTiptapCommand
source modal state
selectedNode / expandedRichTextNode decisions
```

**Acceptance criteria:**

- Physical cursor smoke must pass.
- First click in hero title must not jump to final paragraph.
- Blank/right-side ProseMirror clicks must not move cursor unexpectedly.
- Focus outline stays suppressed.
- Source modal still applies sanitized content.

**Commands:**

```bash
npm run build
npm test -- --watch=false
npm run smoke:tiptap
npm run smoke:tiptap-cursor
```

**Commit:**

```bash
git add projects/ngx-email-studio/src/lib/tiptap/tiptap-controller.ts projects/ngx-email-studio/src/lib/ngx-email-studio.ts
git commit -m "refactor: extract tiptap runtime helpers"
```

---

## Phase 6: Split Angular Child Components Only After Helper Extraction

**Objective:** Split UI into child components only after pure helpers and Tiptap runtime have stabilized.

**Why last:** UI split changes Angular inputs/outputs, template ownership, lifecycle timing, and test selectors. Doing this too early risks regressions.

**Candidate components, in recommended order:**

```text
components/output-modal.component.ts
components/import-modal.component.ts
components/rich-text-source-modal.component.ts
components/header-toolbar.component.ts
components/sidebar.component.ts
components/outline-tree.component.ts
components/inspector.component.ts
components/canvas.component.ts
```

**First component to extract:** `output-modal.component.ts`

Reason: lowest coupling. Inputs are mostly strings/state, outputs are button events.

**Do not extract first:**

```text
canvas.component.ts
inspector.component.ts
tiptap-inline-editor.component.ts
```

Reason: these have the highest coupling to selection, drag state, active editor lifecycle, and DOM timing.

**Acceptance criteria for every component extraction:**

- DOM class names remain unchanged.
- Existing specs pass without rewriting them around implementation details.
- Browser smoke passes.
- No new public API requirement for host apps.

**Commands per child component extraction:**

```bash
npm run build:lib
npm test -- --watch=false
npm run smoke:tiptap
npm run smoke:tiptap-cursor
```

**Commit pattern:**

```bash
git commit -m "refactor: extract output modal component"
git commit -m "refactor: extract import modal component"
```

---

## Suggested Execution Order Summary

```text
1. export/html-export.ts               low risk, high value
2. view/document-view.ts + outline     low risk, medium value
3. tree/drop-utils.ts                  medium risk, medium value
4. output/output-utils.ts              low risk, small value
5. tiptap/tiptap-controller.ts         high risk, high value
6. Angular child components            high risk, only after above
```

---

## Full Verification Gate Before Delivery

After each committed phase, and always before deploy:

```bash
npm run build
npm test -- --watch=false
NPM_CONFIG_CACHE=/tmp/ngx-email-studio-npm-cache npm run pack:lib
npm run smoke:tiptap
npm run smoke:tiptap-cursor
rm -f ngx-email-studio-0.0.1.tgz
git diff --check
```

Expected:

```text
Library tests: 72 passed
Demo tests: 3 passed
Tiptap browser smoke passed
Tiptap cursor smoke passed
```

Known non-blocking warning:

```text
Initial total ~813 kB > 500 kB
```

---

## Deployment Verification Gate

After final phase for the day:

```bash
git push origin main
npm run deploy:pages
```

Poll live bundle:

```bash
curl -L https://edward124689.github.io/ngx-email-studio/
```

Browser verify:

```js
(() => {
  const studio = document.querySelector('ngx-email-studio');
  const groups = [...studio.querySelectorAll('.nes-tiptap-group')].map((group) => {
    const rows = new Set([...group.children].map((el) => Math.round(el.getBoundingClientRect().top))).size;
    return { flexWrap: getComputedStyle(group).flexWrap, rows };
  });
  return {
    shadowRootIsNull: studio.shadowRoot === null,
    hasCssApplied: getComputedStyle(studio).getPropertyValue('--nes-accent').trim() === '#2563eb',
    hasTiptap: !!studio.querySelector('.nes-tiptap-toolbar'),
    legacyEditorCount: studio.querySelectorAll('editor, .tox-tinymce').length,
    groups,
  };
})()
```

Expected:

```json
{
  "shadowRootIsNull": true,
  "hasCssApplied": true,
  "hasTiptap": true,
  "legacyEditorCount": 0,
  "groups": [
    { "flexWrap": "nowrap", "rows": 1 }
  ]
}
```

---

## What Not To Do Yet

- Do not reintroduce Shadow DOM.
- Do not reintroduce TinyMCE.
- Do not split Canvas/Inspector before helper extraction stabilizes.
- Do not change DOM class names just because files move.
- Do not update tests to assert private implementation details of helper files unless behavior coverage remains intact.
- Do not remove existing browser smokes; Tiptap regressions require real browser hit-testing.

---

## Target End State

Expected after Phases 1-5:

```text
projects/ngx-email-studio/src/lib/ngx-email-studio.ts       ~1500-1700 lines
projects/ngx-email-studio/src/lib/ngx-email-studio.css      UI styles
projects/ngx-email-studio/src/lib/export/                   MJML + HTML export
projects/ngx-email-studio/src/lib/import/                   MJML import
projects/ngx-email-studio/src/lib/tree/                     model/tree/drop helpers
projects/ngx-email-studio/src/lib/view/                     labels, values, display helpers
projects/ngx-email-studio/src/lib/output/                   output modal helpers
projects/ngx-email-studio/src/lib/tiptap/                   extensions, options, sanitizer, runtime helpers
```

Only after that should we decide whether Angular child components are worth the coupling cost.
