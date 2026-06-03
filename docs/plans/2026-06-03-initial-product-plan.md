# ngx-email-studio Initial Product Plan

> **Project:** Angular email builder library for Angular 21 projects
> **Target package:** `ngx-email-studio`
> **Initial version:** `0.0.1`
> **Primary language:** English UI/docs/API names

## Goal

Build an Angular 21 library that can be installed from npm, imported into an Angular project, and used as a visual email builder with drag-and-drop editing, MJML import/export, HTML export, responsive preview sizes, Font Awesome 4.7 icons, and TinyMCE free/community rich-text editing.

## Product Direction

`ngx-email-studio` should be a reusable Angular library, not just an app. The repo should contain:

- an Angular library package for npm publishing under the unscoped package name `ngx-email-studio`;
- a demo/playground app for development and manual testing;
- documentation and examples showing how Angular users install and integrate it.

Recommended npm usage target:

```bash
npm install ngx-email-studio
```

The product should feel like a real visual builder, not a bare developer demo. The first release can stay functionally small, but the UI should already include builder-style layout: left block palette, central email canvas, right property panel, top toolbar, preview controls, and export actions.

Example Angular usage:

```ts
import { NgxEmailStudioComponent } from 'ngx-email-studio';
```

```html
<ngx-email-studio
  [mjml]="initialMjml"
  [previewWidth]="previewWidth"
  (mjmlChange)="onMjmlChange($event)"
  (htmlExport)="onHtmlExport($event)"
/>
```

## Core Requirements

### 1. Drag and Drop

Use Angular CDK drag-drop as the first choice.

Recommended features for `0.0.1`:

- block palette;
- canvas/drop zone;
- reorder blocks;
- select block;
- delete block;
- duplicate block;
- edit block properties.

Initial block types:

- Section;
- Column;
- Text;
- Image;
- Button;
- Divider;
- Spacer.

Avoid overbuilding nested layout logic in `0.0.1`; support a simple MJML-compatible tree first.

### 2. MJML Import / Export / HTML Export

Recommended architecture:

```text
MJML string
  -> parser
  -> internal document model
  -> visual editor
  -> internal document model
  -> MJML compiler
  -> MJML string
  -> HTML exporter
  -> HTML string
```

Important recommendation: do not edit raw MJML directly in the canvas. Use a stable internal JSON document model, then compile to MJML. This makes drag/drop and property editing much easier.

Example internal model:

```ts
export interface EmailDocument {
  version: string;
  body: EmailNode[];
}

export interface EmailNode {
  id: string;
  type: 'section' | 'column' | 'text' | 'image' | 'button' | 'divider' | 'spacer';
  attrs: Record<string, unknown>;
  children?: EmailNode[];
}
```

For `0.0.1`, MJML import can support a controlled subset instead of every MJML tag. Unsupported MJML nodes should be preserved where possible or reported clearly.

HTML export direction:

- frontend-only; do not require or bundle any server-side service;
- investigate browser-side MJML compiler compatibility first;
- if full MJML browser compilation is too heavy, ship a supported-subset HTML renderer for `0.0.1`;
- keep the export method async to avoid future public API changes.

### 3. Preview Screen Sizes

Support preview presets:

- Desktop: `1200px`;
- Tablet: `768px`;
- Mobile: `375px`;
- Custom width.

Component API suggestion:

```ts
export type EmailPreviewSize = 'desktop' | 'tablet' | 'mobile' | number;
```

The preview should render inside a constrained iframe or sandboxed preview container to avoid CSS leaking between host app and email preview.

### 4. Font Awesome 4.7 Icons

Use Font Awesome 4.7 for toolbar/block icons.

Recommendation:

- do not force global CSS silently;
- document that users can include FA 4.7 CSS;
- optionally ship a small icon abstraction so icons can be replaced later.

Possible config:

```ts
provideNgxEmailStudio({
  iconSet: 'fontawesome-4.7'
});
```

### 5. TinyMCE Free Version

Use TinyMCE community/free edition for rich text editing.

Recommendation:

- integrate TinyMCE as an optional dependency or peer dependency;
- lazy-load editor where possible;
- expose minimal rich text toolbar first;
- sanitize/normalize output HTML before converting to MJML text content.

Suggested initial toolbar:

```text
bold italic underline | forecolor backcolor | alignleft aligncenter alignright | link | removeformat
```

Avoid premium-only TinyMCE plugins.

### 6. Versioning

Start at:

```json
"version": "0.0.1"
```

Use semantic versioning from the beginning.

Recommended early policy:

- `0.0.x`: internal experiments / unstable API;
- `0.1.x`: usable alpha;
- `1.0.0`: stable public API and docs.

## Recommended Public API for 0.0.1

### Component Inputs

```ts
@Input() mjml?: string;
@Input() document?: EmailDocument;
@Input() previewSize?: EmailPreviewSize;
@Input() readonly?: boolean;
@Input() config?: EmailStudioConfig;
```

### Component Outputs

```ts
@Output() mjmlChange = new EventEmitter<string>();
@Output() documentChange = new EventEmitter<EmailDocument>();
@Output() htmlExport = new EventEmitter<string>();
@Output() error = new EventEmitter<EmailStudioError>();
```

### Public Services

```ts
EmailMjmlParserService
EmailMjmlCompilerService
EmailHtmlExportService
EmailDocumentFactoryService
```

## Suggested Repo Structure

```text
ngx-email-studio/
  projects/
    ngx-email-studio/
      src/
        lib/
          components/
            email-studio/
            block-palette/
            canvas/
            property-panel/
            preview/
          models/
          services/
          utils/
        public-api.ts
      ng-package.json
      package.json
  demo/
    src/app/
  docs/
    plans/
    api/
    examples/
  README.md
  package.json
  angular.json
  tsconfig.json
```

## Suggested Development Phases

### Phase 0 — Workspace Setup

- Create Angular 21 workspace.
- Create Angular library project.
- Create demo app.
- Configure build/test/lint.
- Set package version to `0.0.1`.

### Phase 1 — Internal Document Model

- Define `EmailDocument` and `EmailNode` models.
- Add document factory.
- Add ID generation.
- Add basic validation.

### Phase 2 — MJML Compiler

- Compile internal model to MJML.
- Support section, column, text, image, button, divider, spacer.
- Add unit tests for generated MJML.

### Phase 3 — Basic Visual Builder

- Add main standalone component.
- Add block palette.
- Add canvas renderer.
- Add selection state.
- Add add/delete/reorder block actions.

### Phase 4 — Property Editing

- Add property panel.
- Edit text/image/button/divider/spacer attributes.
- Emit `documentChange` and `mjmlChange`.

### Phase 5 — TinyMCE Integration

- Add rich text editor wrapper.
- Integrate it only for text blocks.
- Keep TinyMCE config minimal and free-plugin only.

### Phase 6 — MJML Import

- Parse supported MJML subset into internal model.
- Show clear warnings for unsupported tags/attributes.
- Add import tests.

### Phase 7 — HTML Export

Frontend-only focus. Do not introduce a server-side dependency or server-side conversion path for the core package.

Recommended approach for `0.0.1`:

- keep MJML-to-HTML export inside the frontend library/demo;
- investigate browser-compatible MJML compilation or a lightweight client-side supported-subset renderer;
- make export async so future implementations can still be swapped without changing the public component API;
- document browser limitations clearly.

Avoid requiring users to deploy a backend service just to use the builder.

### Phase 8 — Preview Sizes

- Add desktop/tablet/mobile/custom preview controls.
- Use iframe or isolated preview container.
- Verify layout behavior.

### Phase 9 — npm Readiness

- Verify library build output.
- Add README install/import examples.
- Add `peerDependencies`.
- Add npm package metadata.
- Run `npm pack` locally and test install into a clean Angular 21 demo app.

## Important Technical Recommendations

### A. Keep an Internal JSON Model

This is the most important architecture decision. MJML is the interchange format, but the editor should use JSON internally.

Benefits:

- easier drag/drop;
- easier property editing;
- easier undo/redo later;
- easier validation;
- easier tests.

### B. Keep HTML Export Frontend-Only

The project focus is frontend. Avoid server-side conversion requirements. MJML-to-HTML in browser may create bundle-size or compatibility issues, so design the service API as async while keeping the implementation inside the frontend package:

```ts
export interface EmailHtmlExportService {
  exportHtml(mjml: string): Promise<string>;
}
```

For `0.0.1`, prefer a browser-compatible MJML compiler if it is practical. If not, ship a lightweight HTML renderer for the supported MJML subset and document the limitation.

### C. Add Undo / Redo Early if Possible

Not required for the first build, but the document model should make it easy. Keep all edits as immutable document updates.

### D. Use iframe Preview if CSS Leakage Appears

Email HTML has special CSS needs. A host Angular app can accidentally affect preview rendering. iframe preview is safer.

### E. Treat TinyMCE as Optional/Peer Dependency

Do not make the whole library impossible to use if the user does not need rich text. A lazy wrapper is better.

### F. Keep Public API Small in 0.0.1

Avoid exposing too many internals before the design stabilizes.

## Minimum Acceptance Criteria for 0.0.1

- Angular 21 library builds successfully.
- Demo app runs locally.
- User can drag text/image/button/divider/spacer blocks into an email.
- User can reorder blocks.
- User can edit text block content with TinyMCE free edition.
- User can export MJML string.
- User can export HTML string.
- User can preview desktop/tablet/mobile widths.
- npm package can be packed with `npm pack`.
- A clean Angular 21 app can install the packed package and import the main component.

## Decisions Confirmed

1. npm package name: `ngx-email-studio`.
2. Project focus: frontend Angular library; do not require server-side conversion.
3. UI direction: polished builder feel from the beginning, not a plain demo UI.

## Remaining Open Questions

1. Should MJML unsupported tags be dropped, preserved as raw nodes, or shown as locked/read-only blocks?
2. Should there be a no-TinyMCE mode for users who want a smaller bundle?
