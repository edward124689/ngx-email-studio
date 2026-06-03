# OpenDesign UI Integration Plan

## Goal

Bring the OpenDesign email-builder mockup into `ngx-email-studio` while keeping the package reusable, frontend-only, and MJML-compatible.

## Recommended Integration Strategy

Use the OpenDesign mockup as the default polished shell/theme for the library component, not as a separate demo-only page.

The current implementation already has the right functional core:

- internal `EmailDocument` model;
- Angular CDK drag/drop;
- TinyMCE editor;
- MJML import/export;
- row/column support;
- preview width controls;
- property panel.

The integration should mostly reshape UI/UX around that core.

## Component Mapping

### 1. Header Bar

OpenDesign:

- EB logo;
- breadcrumb: CMS / Email Campaign / Draft;
- title: campaign name + Email Builder;
- saved/import/export/save actions.

Library mapping:

- Add optional config/document metadata:
  - `projectLabel`
  - `breadcrumb`
  - `title`
  - `statusLabel`
  - `fromLabel`
- Keep default generic English labels for npm users.
- Demo can pass Chinese CMS copy.

### 2. Left Sidebar

OpenDesign:

- module library with search;
- icon cards;
- outline list with selected block highlight.

Library mapping:

- Replace simple palette with:
  - searchable `palette` list;
  - richer labels/descriptions/icons;
  - `addBlock(type)` click-to-add support;
  - outline generated from `emailDocument.body`.

New block presets to add:

- `hero`
- `productList`
- `coupon`
- `footer`
- `row` variants: 2-col / 3-col presets.

Keep MJML compilation by mapping these presets to supported MJML:

- `hero` -> `mj-section` + `mj-text`
- `productList` -> `mj-section` + 2 `mj-column`
- `coupon` -> `mj-text`/`mj-button`
- `footer` -> `mj-text`
- `row` -> `mj-section` + N `mj-column`

### 3. Center Canvas

OpenDesign:

- grid workspace background;
- canvas header: preview size + block count;
- 600px email preview card;
- size chips: 1200 / 800 / 600 / 400;
- metadata row: From + Preview;
- selected block blue outline;
- floating duplicate/delete controls;
- bottom drop zone.

Library mapping:

- Change current stage to grid background.
- Replace select dropdown with size chips.
- Use width presets `[1200, 800, 600, 400]` while retaining existing `desktop/tablet/mobile` API compatibility.
- Add root bottom drop zone label.
- Move duplicate/delete controls from right panel into selected block overlay; keep buttons in inspector as backup if useful.

### 4. Right Inspector

OpenDesign:

- inspector title;
- selected block type;
- tabs: Content / Style / Check;
- contextual fields.

Library mapping:

- Add `activeInspectorTab: 'content' | 'style' | 'check'`.
- Split current properties:
  - Content: text, title, summary, image URL, button label/href.
  - Style: background, text color, spacing, alignment, column width.
  - Check: MJML validation warnings, unsupported tags, empty link/image warnings.

### 5. Visual Tokens

Adopt OpenDesign as the default theme tokens:

- accent blue: selected outlines/icons;
- save green: positive status/actions;
- grid background: pale grey grid;
- panel border: light grey;
- rounded cards and subtle shadow.

Use CSS custom properties so consumers can theme:

```css
:host {
  --nes-accent: #2563eb;
  --nes-success: #16a34a;
  --nes-panel: #ffffff;
  --nes-border: #d9e2ec;
  --nes-canvas-grid: rgba(148, 163, 184, 0.18);
}
```

## Model Changes

Extend block types cautiously:

```ts
export type EmailBlockType =
  | 'hero'
  | 'row'
  | 'column'
  | 'section'
  | 'text'
  | 'image'
  | 'button'
  | 'productList'
  | 'coupon'
  | 'divider'
  | 'spacer'
  | 'footer';
```

Recommended `hero` attrs:

```ts
{
  kicker: string;
  title: string;
  summary: string;
  backgroundColor: string;
}
```

Recommended `footer` attrs:

```ts
{
  content: string;
  backgroundColor: string;
}
```

## Implementation Phases

### Phase 1 — UI Shell and Theme

- Header bar
- Left searchable palette
- Outline
- Grid stage
- Preview size chips
- Inspector tabs

No major data model changes except UI state.

### Phase 2 — OpenDesign Block Presets

- Add `hero`, `footer`, `coupon`, `productList` block types.
- Add 2-col / 3-col palette presets using existing row/column model.
- Add contextual inspector fields.
- Compile new block types to MJML/HTML.

### Phase 3 — Interaction Polish

- Floating block controls on selected block.
- Bottom drop target.
- Click-to-add from palette.
- Outline click selection.
- Drag hover state and selected-state refinement.

### Phase 4 — Demo Content

Use the exact OpenDesign-like CMS Chinese sample in `projects/demo/src/app/app.ts` so Pages clearly shows the intended product direction.

## Acceptance Checks

- `npm run build`
- `npm test -- --watch=false`
- `npm run pack:lib`
- clean Angular consumer build
- `npm run deploy:pages`
- verify GitHub Pages:
  - index HTTP 200
  - JS/CSS HTTP 200
  - TinyMCE asset HTTP 200

## Recommended First PR/Commit

Start with Phase 1 + enough demo content to match the mockup. This gives visible value without risking the MJML compiler too much.

Suggested commit message:

```text
feat: apply OpenDesign builder shell
```
