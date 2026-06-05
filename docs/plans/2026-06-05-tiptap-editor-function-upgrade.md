# Tiptap Editor Function Upgrade Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Status:** Implemented and verified in `ngx-email-studio` on 2026-06-05. Kept as a reference plan for future editor work.

**Goal:** Upgrade `ngx-email-studio` rich-text editing from a small Tiptap toolbar into a practical email-editor toolbar with H1-H6, paragraph, lists, undo/redo, font size, line height, inline formatting, links, alignment, and table drawing/management.

**Architecture:** Keep Tiptap as the only rich-text provider and keep the existing sanitizer/MJML/export pipeline. Add editor capabilities in small reusable command/config arrays so inline editor and modal editor share one toolbar model instead of duplicating buttons. Prefer email-safe formatting stored as sanitized HTML inline styles or safe tags, and regression-test that editor output survives stored content, MJML export, HTML export, and browser smoke.

**Tech Stack:** Angular 21 standalone component, Tiptap v3 (`@tiptap/core`, `StarterKit`, `Link`, `TextAlign`, `Table*`), Angular unit tests, Playwright browser smokes.

---

## Decisions Confirmed

- TinyMCE is removed; do not reintroduce it.
- Supported rich text providers remain `richTextEditor: 'tiptap' | 'plain'`.
- Keep email-builder scope: text-block rich editing, not a full Notion document/database clone.
- Keep Tiptap output sanitized before storage/render/export.
- Keep real-browser cursor/focus regressions covered by `scripts/tiptap-cursor-smoke.mjs`.

## Recommended Feature Scope

### Must-have for first pass

- Undo / redo.
- Paragraph + H1-H6 block format selector.
- Bold / italic / strike / underline.
- Bullet list / ordered list.
- Link / unlink.
- Align left / center / right / justify.
- Font size presets.
- Line height presets.
- Table insert with row/column count controls.
- Table add/delete row/column and delete table.
- View/edit source code for the selected rich-text block, similar to TinyMCE's source-code dialog.
- Toolbar active/disabled states.
- Same toolbar behavior in inline editor and modal editor.

### Nice-to-have after first pass

- Floating selection toolbar.
- Markdown shortcuts.
- Color / background highlight.
- Horizontal rule.
- Clear formatting.
- Keyboard shortcut hints.

### Explicitly avoid for now

- Full Notion-like block dragging inside the text editor.
- Collaboration, comments, AI, mentions, emoji menu.
- Complex blocks that cannot export safely to email HTML.

---

## Task 1: Add missing Tiptap formatting extensions

**Objective:** Install/import only the extensions needed for underline, font size/text style, and line-height storage.

**Files:**
- Modify: `package.json`
- Modify: `projects/ngx-email-studio/package.json`
- Modify: `projects/ngx-email-studio/src/lib/ngx-email-studio.ts`
- Test: `projects/ngx-email-studio/src/lib/ngx-email-studio.spec.ts`

**Implementation notes:**

1. Add likely dependencies:
   - `@tiptap/extension-underline`
   - `@tiptap/extension-text-style`

2. For font size and line height, first check whether current Tiptap v3 has official extensions available in npm. If yes, use them. If no, add small local extensions inside `ngx-email-studio.ts`:

```ts
const FontSize = TextStyle.extend({
  addGlobalAttributes() {
    return [{
      types: ['textStyle'],
      attributes: {
        fontSize: {
          default: null,
          parseHTML: element => element.style.fontSize || null,
          renderHTML: attributes => attributes['fontSize'] ? { style: `font-size: ${attributes['fontSize']}` } : {},
        },
      },
    }];
  },
});
```

For line height, prefer paragraph/heading attributes:

```ts
const LineHeight = Extension.create({
  name: 'lineHeight',
  addGlobalAttributes() {
    return [{
      types: ['paragraph', 'heading'],
      attributes: {
        lineHeight: {
          default: null,
          parseHTML: element => element.style.lineHeight || null,
          renderHTML: attributes => attributes['lineHeight'] ? { style: `line-height: ${attributes['lineHeight']}` } : {},
        },
      },
    }];
  },
});
```

**Test:**

Add a spec that creates a Tiptap editor, applies underline/font size/line height, and asserts stored content contains safe output.

**Verify:**

```bash
npm install
npm run build:lib
npm test -- --watch=false
```

---

## Task 2: Support H1-H6 and paragraph block format

**Objective:** Replace the single `H2` button with a block-format dropdown supporting paragraph and H1-H6.

**Files:**
- Modify: `projects/ngx-email-studio/src/lib/ngx-email-studio.ts`
- Test: `projects/ngx-email-studio/src/lib/ngx-email-studio.spec.ts`

**Implementation notes:**

1. Change StarterKit heading config:

```ts
StarterKit.configure({ heading: { levels: [1, 2, 3, 4, 5, 6] }, link: false })
```

2. Add reusable format options:

```ts
headingOptions = [
  { label: 'Paragraph', value: 'paragraph' },
  { label: 'H1', value: '1' },
  { label: 'H2', value: '2' },
  { label: 'H3', value: '3' },
  { label: 'H4', value: '4' },
  { label: 'H5', value: '5' },
  { label: 'H6', value: '6' },
] as const;
```

3. Add command:

```ts
setTiptapBlockFormat(scope: 'inline' | 'modal', value: string): void {
  const editor = this.getTiptapEditor(scope);
  if (!editor) return;
  const chain = editor.chain().focus();
  if (value === 'paragraph') chain.setParagraph().run();
  else chain.toggleHeading({ level: Number(value) as 1 | 2 | 3 | 4 | 5 | 6 }).run();
}
```

**Test:**

- Apply H1-H6 and paragraph via component command path.
- Assert stored HTML contains matching heading tags.
- Assert export keeps H1-H6 safe tags.

**Verify:**

```bash
npm run build:lib
npm test -- --watch=false
npm run smoke:tiptap
```

---

## Task 3: Refactor toolbar into shared reusable template/data

**Objective:** Stop duplicating inline and modal toolbar buttons so future functions stay consistent.

**Files:**
- Modify: `projects/ngx-email-studio/src/lib/ngx-email-studio.ts`
- Test: `projects/ngx-email-studio/src/lib/ngx-email-studio.spec.ts`

**Implementation notes:**

Create a shared Angular `ng-template`:

```html
<ng-template #tiptapToolbar let-scope="scope">
  <div class="nes-tiptap-toolbar" role="toolbar" aria-label="Rich text formatting">
    <!-- block format select -->
    <!-- undo/redo group -->
    <!-- inline formatting group -->
    <!-- list/alignment/link group -->
    <!-- table group -->
  </div>
</ng-template>
```

Use it in both places:

```html
<ng-container *ngTemplateOutlet="tiptapToolbar; context: { scope: 'inline' }"></ng-container>
<ng-container *ngTemplateOutlet="tiptapToolbar; context: { scope: 'modal' }"></ng-container>
```

**Test:**

- Assert inline and modal toolbars contain same core controls.
- Assert clicking inline and modal bold both update content.

**Verify:**

```bash
npm run build:lib
npm test -- --watch=false
```

---

## Task 4: Add undo/redo and active/disabled states

**Objective:** Add predictable undo/redo controls and visible active state for formatting buttons.

**Files:**
- Modify: `projects/ngx-email-studio/src/lib/ngx-email-studio.ts`
- Test: `projects/ngx-email-studio/src/lib/ngx-email-studio.spec.ts`

**Implementation notes:**

Commands:

```ts
runTiptapCommand(scope, command) {
  const editor = this.getTiptapEditor(scope);
  if (!editor) return;
  const chain = editor.chain().focus();
  if (command === 'undo') chain.undo().run();
  if (command === 'redo') chain.redo().run();
}
```

State helpers:

```ts
canRunTiptapCommand(scope: 'inline' | 'modal', command: string): boolean {
  const editor = this.getTiptapEditor(scope);
  if (!editor) return false;
  if (command === 'undo') return editor.can().undo();
  if (command === 'redo') return editor.can().redo();
  return true;
}

isTiptapActive(scope: 'inline' | 'modal', markOrNode: string, attrs?: Record<string, unknown>): boolean {
  return this.getTiptapEditor(scope)?.isActive(markOrNode, attrs) ?? false;
}
```

**Test:**

- Type/update content, undo, redo.
- Assert disabled state before history exists.
- Assert active state class appears for bold/italic/heading/list.

**Verify:**

```bash
npm run build:lib
npm test -- --watch=false
```

---

## Task 5: Add inline formatting controls

**Objective:** Add underline, strike, clear formatting, and improve link/unlink UX.

**Files:**
- Modify: `projects/ngx-email-studio/src/lib/ngx-email-studio.ts`
- Test: `projects/ngx-email-studio/src/lib/ngx-email-studio.spec.ts`

**Implementation notes:**

Toolbar controls:

- B
- I
- U
- S
- Clear
- Link
- Unlink

Commands:

```ts
if (command === 'underline') chain.toggleUnderline().run();
if (command === 'strike') chain.toggleStrike().run();
if (command === 'clearFormatting') chain.unsetAllMarks().clearNodes().run();
if (command === 'unlink') chain.unsetLink().run();
```

For link, keep current `prompt()` initially to avoid overbuilding. Later replace with a small popover.

**Test:**

- Apply underline/strike/link/unlink.
- Clear formatting removes marks but preserves text.

**Verify:**

```bash
npm run build:lib
npm test -- --watch=false
```

---

## Task 6: Add list controls and indentation

**Objective:** Improve list editing with bullet list, ordered list, lift/sink list item.

**Files:**
- Modify: `projects/ngx-email-studio/src/lib/ngx-email-studio.ts`
- Test: `projects/ngx-email-studio/src/lib/ngx-email-studio.spec.ts`

**Implementation notes:**

Controls:

- Bullet list
- Ordered list
- Outdent
- Indent

Commands:

```ts
if (command === 'bulletList') chain.toggleBulletList().run();
if (command === 'orderedList') chain.toggleOrderedList().run();
if (command === 'sinkListItem') chain.sinkListItem('listItem').run();
if (command === 'liftListItem') chain.liftListItem('listItem').run();
```

**Test:**

- Convert paragraphs to bullet/ordered lists.
- Nest and unnest list items.
- Assert sanitized stored content keeps `<ul>`, `<ol>`, `<li>`.

**Verify:**

```bash
npm run build:lib
npm test -- --watch=false
npm run smoke:tiptap-cursor
```

---

## Task 7: Add font size controls

**Objective:** Allow email-safe font size presets on selected text.

**Files:**
- Modify: `projects/ngx-email-studio/src/lib/ngx-email-studio.ts`
- Test: `projects/ngx-email-studio/src/lib/ngx-email-studio.spec.ts`

**Implementation notes:**

Use presets only, not arbitrary free text in first pass:

```ts
fontSizeOptions = ['12px', '14px', '16px', '18px', '20px', '24px', '28px', '32px'] as const;
```

Command:

```ts
setTiptapFontSize(scope: 'inline' | 'modal', size: string): void {
  this.getTiptapEditor(scope)?.chain().focus().setMark('textStyle', { fontSize: size }).run();
}
```

Clear command:

```ts
unsetTiptapFontSize(scope) {
  this.getTiptapEditor(scope)?.chain().focus().setMark('textStyle', { fontSize: null }).removeEmptyTextStyle().run();
}
```

**Test:**

- Select text, apply `20px`.
- Assert stored HTML contains `font-size: 20px`.
- Assert sanitizer/export does not remove it unexpectedly.

**Verify:**

```bash
npm run build:lib
npm test -- --watch=false
```

---

## Task 8: Add line-height controls

**Objective:** Allow paragraph/heading line-height presets for better email typography.

**Files:**
- Modify: `projects/ngx-email-studio/src/lib/ngx-email-studio.ts`
- Test: `projects/ngx-email-studio/src/lib/ngx-email-studio.spec.ts`

**Implementation notes:**

Presets:

```ts
lineHeightOptions = ['1', '1.15', '1.3', '1.5', '1.75', '2'] as const;
```

Command:

```ts
setTiptapLineHeight(scope: 'inline' | 'modal', lineHeight: string): void {
  const editor = this.getTiptapEditor(scope);
  editor?.chain().focus().updateAttributes('paragraph', { lineHeight }).updateAttributes('heading', { lineHeight }).run();
}
```

If updating both node types in one chain is flaky, branch based on `editor.isActive('heading')`.

**Test:**

- Apply line-height to paragraph and heading.
- Assert stored HTML has `line-height` style.
- Assert MJML/HTML export preserves readable output.

**Verify:**

```bash
npm run build:lib
npm test -- --watch=false
```

---

## Task 9: Improve table drawing and table toolbar

**Objective:** Replace the simple `Table` button with a small draw-table picker and clear table management controls.

**Files:**
- Modify: `projects/ngx-email-studio/src/lib/ngx-email-studio.ts`
- Test: `projects/ngx-email-studio/src/lib/ngx-email-studio.spec.ts`
- Modify: `scripts/tiptap-smoke.mjs`

**Implementation notes:**

First pass UI:

- `Table 2x2`
- `Table 3x3`
- `Table 4x4`
- `+ Row`
- `+ Col`
- `− Row`
- `− Col`
- `Delete table`

Optional second pass: visual 6x6 grid picker.

Command:

```ts
insertTiptapTable(scope: 'inline' | 'modal', rows: number, cols: number): void {
  this.getTiptapEditor(scope)?.chain().focus().insertTable({ rows, cols, withHeaderRow: true }).run();
}
```

**Test:**

- Insert 2x2 / 3x3 / 4x4.
- Assert row/column counts.
- Add/delete row/column.
- Delete table.

**Smoke:**

Update `scripts/tiptap-smoke.mjs` to assert table controls exist and no legacy editor exists.

**Verify:**

```bash
npm run build:lib
npm test -- --watch=false
npm run smoke:tiptap
```

---

## Task 10: Polish toolbar layout for inspector and modal

**Objective:** Make expanded toolbar usable without cramping the right inspector.

**Files:**
- Modify: `projects/ngx-email-studio/src/lib/ngx-email-studio.ts`
- Test: `projects/ngx-email-studio/src/lib/ngx-email-studio.spec.ts`

**Implementation notes:**

Suggested layout:

- Inline inspector toolbar: compact two-row toolbar, icon/text abbreviated.
- Modal toolbar: fuller labels and grouped controls.
- Use horizontal scroll only if needed; avoid vertical overflow breaking inspector.

CSS direction:

```css
.nes-tiptap-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.nes-tiptap-group {
  display: inline-flex;
  gap: 4px;
  padding-right: 6px;
  border-right: 1px solid #e2e8f0;
}
.nes-tiptap-toolbar select {
  height: 32px;
  border-radius: 8px;
}
.nes-tiptap-toolbar button.is-active {
  background: #dbeafe;
  color: #1d4ed8;
}
```

**Test:**

- Assert toolbar group classes exist.
- Assert no focused ProseMirror outline regression.
- Assert inline editor click still does not open modal.

**Verify:**

```bash
npm run build:lib
npm test -- --watch=false
npm run smoke:tiptap-cursor
```

---

## Task 11: Add view/edit source code dialog

**Objective:** Add a TinyMCE-like source-code dialog for the selected rich-text block so users can inspect or directly edit sanitized HTML.

**Files:**
- Modify: `projects/ngx-email-studio/src/lib/ngx-email-studio.ts`
- Test: `projects/ngx-email-studio/src/lib/ngx-email-studio.spec.ts`
- Modify: `scripts/tiptap-smoke.mjs`

**UX recommendation:**

Add a `Source` button in the Tiptap toolbar. It should open a modal over the editor, not replace the whole Email Studio shell.

Dialog layout:

```text
Source code
[ monospace textarea with current selected text block HTML ]

Cancel | Apply source
```

Rules:

- Source editor edits only the current rich-text block content, not the whole MJML document.
- On open, show `selectedNode.attrs['content']` / `expandedRichTextNode.attrs['content']` as formatted-ish HTML.
- On Apply, sanitize the textarea HTML with existing `sanitizeRichTextContent(...)` before storing.
- After Apply, update the active Tiptap editor via `setContent(..., { emitUpdate: false })` only once, then close the dialog.
- If sanitizer strips content, show a small non-blocking warning such as `Unsafe markup was removed`.
- Keep `script`, event handlers, iframe/object/embed, and unsafe URL protocols stripped.

Suggested state:

```ts
sourceEditorScope: 'inline' | 'modal' | null = null;
sourceEditorNode: EmailNode | null = null;
sourceEditorValue = '';
sourceEditorWarning = '';
```

Suggested methods:

```ts
openRichTextSource(scope: 'inline' | 'modal'): void {
  const node = scope === 'modal' ? this.expandedRichTextNode : this.selectedNode;
  if (!node || node.type !== 'text') return;
  this.sourceEditorScope = scope;
  this.sourceEditorNode = node;
  this.sourceEditorValue = String(node.attrs['content'] || '');
  this.sourceEditorWarning = '';
}

applyRichTextSource(): void {
  if (!this.sourceEditorNode) return;
  const sanitized = this.sanitizeRichTextContent(this.sourceEditorValue);
  this.sourceEditorWarning = sanitized !== this.sourceEditorValue ? 'Unsafe markup was removed.' : '';
  this.updateAttr(this.sourceEditorNode, 'content', sanitized);
  const editor = this.sourceEditorScope ? this.getTiptapEditor(this.sourceEditorScope) : null;
  editor?.commands.setContent(sanitized || '<p></p>', { emitUpdate: false });
  this.closeRichTextSource();
}
```

**Important:** Do not skip sanitization just because this is an internal source editor. Source view is explicitly user-editable HTML.

**Test cases:**

1. Source button opens modal with selected text block HTML.
2. Applying `<h1>Title</h1><p>Body</p>` updates stored rich-text content and Tiptap editor DOM.
3. Applying unsafe HTML such as `<script>alert(1)</script><p onclick="x()">Safe</p>` strips unsafe content/attrs.
4. Cancel closes without changing content.
5. Source dialog works from both inline editor and large modal editor.

**Smoke:**

Update `scripts/tiptap-smoke.mjs` to click `Source`, apply a harmless snippet, and assert the rendered editor/canvas updates while no legacy editor appears.

**Verify:**

```bash
npm run build:lib
npm test -- --watch=false
npm run smoke:tiptap
npm run smoke:tiptap-cursor
```

---

## Task 12: Export and sanitizer regression hardening

**Objective:** Ensure new formatting survives the full email output pipeline safely.

**Files:**
- Modify: `projects/ngx-email-studio/src/lib/ngx-email-studio.spec.ts`

**Test cases to add:**

1. H1-H6 stored content exports to MJML/HTML.
2. Lists preserve `<ul>`, `<ol>`, `<li>`.
3. Font size and line-height inline styles survive sanitization where Angular allows them.
4. Tables preserve `<table>`, `<tr>`, `<th>`, `<td>`.
5. Unsupported/unsafe styles are still stripped.

**Verify:**

```bash
npm run build:lib
npm test -- --watch=false
```

---

## Task 13: Final verification, docs, deploy

**Objective:** Ship the editor function upgrade with full validation and updated docs.

**Files:**
- Modify: `README.md`
- Modify: `projects/ngx-email-studio/README.md`
- Modify: `scripts/tiptap-smoke.mjs`
- Modify: `scripts/tiptap-cursor-smoke.mjs` if focus/cursor behavior changes

**Steps:**

1. Update docs with supported rich-text features:
   - H1-H6
   - lists
   - font size
   - line height
   - undo/redo
   - inline formatting
   - links
   - alignment
   - tables
   - view/edit source code

2. Run full local verification:

```bash
npm run build
npm test -- --watch=false
npm run pack:lib
npm run smoke:tiptap
npm run smoke:tiptap-cursor
rm -f ngx-email-studio-0.0.1.tgz
```

3. Commit and push:

```bash
git status --short
git diff --check
git add .
git commit -m "feat: upgrade tiptap editor controls"
git push
```

4. Deploy Pages:

```bash
npm run deploy:pages
```

5. Poll live bundle and run browser verification:

```bash
curl -fsSL https://edward124689.github.io/ngx-email-studio/ | grep -o 'main-[A-Z0-9]*\.js' | head -1
```

Expected live behavior:

- Tiptap editor visible.
- No TinyMCE/legacy editor shell.
- Focus outline remains removed.
- New toolbar controls visible.
- H1-H6/list/table/font-size/line-height commands update content.
- Source code dialog can inspect/apply sanitized selected-block HTML.

---

## Suggested Delivery Order

1. Block format H1-H6 + undo/redo + active states.
2. Underline/strike/link/unlink/clear formatting.
3. Font size + line height.
4. Table picker/management.
5. Source code view/edit dialog.
6. Toolbar polish and docs.

This order gets useful editor functions quickly while keeping cursor/table regressions easy to isolate.
