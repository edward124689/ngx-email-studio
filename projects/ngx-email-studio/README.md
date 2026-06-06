# ngx-email-studio

[![npm version](https://badge.fury.io/js/ngx-email-studio.svg)](https://www.npmjs.com/package/ngx-email-studio) [![npm downloads](https://img.shields.io/npm/dm/ngx-email-studio.svg)](https://www.npmjs.com/package/ngx-email-studio) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

`ngx-email-studio` is an Angular 21 frontend email builder for composing, importing, editing, previewing, and exporting responsive email templates.

It provides a polished visual builder shell, MJML import/export for a practical editable subset, clean browser-side HTML export, drag-and-drop content blocks, Tiptap rich text editing, and a responsive preview workflow — all as a standalone Angular component.

Live demo: <https://edward124689.github.io/ngx-email-studio/>

<p align="center">
  <img src="https://raw.githubusercontent.com/edward124689/ngx-email-studio/main/docs/images/email-studio-demo.png" alt="Email Studio visual builder with content modules, email canvas, responsive preview controls, and properties inspector" width="100%" />
</p>

## Table of Contents

- [Features](#features)
- [Version Support](#version-support)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Using an MJML Template](#using-an-mjml-template)
- [Component API](#component-api)
  - [Inputs](#inputs)
  - [Outputs](#outputs)
  - [Configuration](#configuration)
- [Supported Content Blocks](#supported-content-blocks)
- [MJML Import and Export](#mjml-import-and-export)
- [HTML Export](#html-export)
- [Rich Text Editing](#rich-text-editing)
- [Document Model](#document-model)
- [Security Notes](#security-notes)
- [Development](#development)
- [Publishing](#publishing)
- [License](#license)

## Features

- **Angular 21 standalone component**: import `NgxEmailStudio` directly into standalone Angular apps.
- **Frontend-only builder**: no backend renderer or server-side MJML service required for editing and supported HTML export.
- **MJML import/export**: import existing MJML templates into an editable document model and export edited content back to MJML.
- **Clean HTML export**: generate a frontend HTML email export for the supported subset, including email-client friendly tables/resets.
- **Drag-and-drop layout**: Angular CDK powered content palette, canvas, sections, rows, columns, and nested blocks.
- **Builder shell**: module library, searchable palette, nested outline, preview size chips, selected-block controls, and tabbed inspector.
- **Tiptap rich text editor**: headings, lists, inline formatting, links, tables, font size, line height, text alignment, undo/redo, and sanitized source editing.
- **Responsive preview**: switch between desktop/tablet/mobile/custom preview widths.
- **Editable social links**: import/export `<mj-social>` with multiple `<mj-social-element>` entries.
- **Safe import boundaries**: sanitizes rich text, URLs, class/id values, colors, and imported attributes before preview/export.
- **MIT licensed**.

## Version Support

`ngx-email-studio` follows Angular-major aligned versions.

| ngx-email-studio version | Supported Angular version |
| --- | --- |
| `21.x` | Angular `21.x` |

The first public npm release is `21.0.0`.

## Installation

Install the package and peer dependencies:

```bash
npm install ngx-email-studio
npm install @angular/cdk @tiptap/core @tiptap/starter-kit @tiptap/extension-link @tiptap/extension-text-align @tiptap/extension-text-style @tiptap/extension-table @tiptap/extension-table-row @tiptap/extension-table-cell @tiptap/extension-table-header
```

Angular peer dependencies:

```bash
npm install @angular/core@^21 @angular/common@^21 @angular/forms@^21 @angular/cdk@^21
```

## Quick Start

Import the standalone component and render it:

```ts
import { Component } from '@angular/core';
import { NgxEmailStudio, EmailStudioResult } from 'ngx-email-studio';

@Component({
  selector: 'app-email-builder-page',
  standalone: true,
  imports: [NgxEmailStudio],
  template: `
    <ngx-email-studio
      [mjml]="initialMjml"
      [showSave]="true"
      (change)="onChange($event)"
      (save)="onSave($event)"
    />
  `,
})
export class EmailBuilderPage {
  initialMjml = `
    <mjml>
      <mj-body>
        <mj-section>
          <mj-column>
            <mj-text>
              <h1>Launch a polished campaign in minutes</h1>
              <p>Compose responsive emails with reusable content modules.</p>
            </mj-text>
            <mj-button href="https://example.com">Get started</mj-button>
          </mj-column>
        </mj-section>
      </mj-body>
    </mjml>
  `;

  onChange(result: EmailStudioResult): void {
    // Emits after builder edits/imports.
    console.log(result.mjml);
    console.log(result.html.html);
  }

  onSave(result: EmailStudioResult): void {
    // Emits only when the Save button is clicked.
    console.log(result);
  }
}
```

## Using an MJML Template

`[mjml]` accepts an MJML string and imports it into the editable builder model:

```html
<ngx-email-studio
  [mjml]="campaignMjml"
  [previewSize]="600"
  (change)="draft = $event"
/>
```

Example with social links:

```xml
<mj-social font-size="15px" icon-size="30px" mode="horizontal" padding="0" align="center">
  <mj-social-element name="facebook" href="https://example.com/facebook" background-color="#A1A0A0"></mj-social-element>
  <mj-social-element name="twitter" href="https://example.com/twitter" background-color="#A1A0A0"></mj-social-element>
  <mj-social-element name="linkedin" href="https://example.com/linkedin" background-color="#A1A0A0"></mj-social-element>
</mj-social>
```

The editor stores social links as one editable Social block containing multiple icon/name, href, and background color rows, then exports them back to `<mj-social>` / `<mj-social-element>`.

## Component API

### Inputs

| Input | Type | Description |
| --- | --- | --- |
| `mjml` | `string` | Initial MJML source to import into the builder. |
| `document` | `EmailDocument` | Optional internal JSON document model for apps that persist builder state directly. |
| `previewSize` | `'desktop' \| 'tablet' \| 'mobile' \| number` | Preview width preset or custom pixel width. |
| `readonly` | `boolean` | Disables editing controls when true. |
| `showSave` | `boolean` | Shows or hides the top Save button. Can also be controlled by `config.showSave`. |
| `config` | `EmailStudioConfig` | Optional builder configuration. |

### Outputs

| Output | Type | Description |
| --- | --- | --- |
| `change` | `EventEmitter<EmailStudioResult>` | Emits after edits/imports. Payload includes MJML and HTML export. |
| `save` | `EventEmitter<EmailStudioResult>` | Emits when the Save button is clicked. |
| `mjmlChange` | `EventEmitter<string>` | MJML-only change output. |
| `documentChange` | `EventEmitter<EmailDocument>` | Emits the internal JSON document model. |
| `htmlExport` | `EventEmitter<string>` | HTML-only export output. |
| `error` | `EventEmitter<EmailStudioError>` | Emits import/export errors. |

`EmailStudioResult`:

```ts
export interface EmailStudioResult {
  mjml: string;
  html: {
    html: string;
  };
}
```

### Configuration

```ts
import { EmailStudioConfig } from 'ngx-email-studio';

config: EmailStudioConfig = {
  richTextEditor: 'tiptap',
  showHtmlPreview: true,
  showSave: true,
  title: 'Email Studio',
  fromLabel: 'hello@example.com',
};
```

```html
<ngx-email-studio [config]="config" />
```

| Config | Type | Default | Description |
| --- | --- | --- | --- |
| `richTextEditor` | `'tiptap' \| 'plain'` | `'tiptap'` | Rich text provider. Use `'plain'` for textarea-only editing. |
| `showHtmlPreview` | `boolean` | `true` | Enables HTML preview actions in the export modal. |
| `showSave` | `boolean` | `true` | Shows the Save button. |
| `title` | `string` | — | Optional builder title text. |
| `breadcrumb` | `string` | — | Optional breadcrumb/status text for host apps. |
| `brandLabel` | `string` | — | Optional brand label. |
| `statusLabel` | `string` | — | Optional status label. |
| `fromLabel` | `string` | — | Optional campaign sender/from label. |

## Supported Content Blocks

The public `21.0.0` release focuses on a practical editable MJML subset:

- Body settings
- Section
- Row / columns (`<mj-section>` with multiple `<mj-column>` children)
- Text (`<mj-text>`) with rich HTML content
- Image (`<mj-image>`)
- Button (`<mj-button>`)
- Social links (`<mj-social>` / `<mj-social-element>`)
- Divider (`<mj-divider>`)
- Spacer (`<mj-spacer>`)

The importer also handles common real-template structure such as `<mj-wrapper>` flattening and `<mj-group>` column width calculation where possible.

Unsupported MJML tags are reported in the document `unsupported` list instead of being silently treated as fully editable blocks.

## MJML Import and Export

The editor uses this flow:

```text
MJML string
  -> frontend parser
  -> EmailDocument JSON model
  -> visual editor
  -> MJML export
  -> HTML export
```

Import/export is designed for the supported editable subset, not as a full replacement for every MJML feature. For complex templates, unsupported nodes are surfaced so host apps can decide whether to warn users or preserve the original source elsewhere.

Notable import behavior:

- Preserves safe `class` and `id` attributes in rich text.
- Sanitizes unsafe URLs such as `javascript:` and protocol-relative URLs.
- Preserves safe rich-text inline styles needed for email templates.
- Parses wrapper, section, column, image, button, text, divider, spacer, and social content.
- Keeps social elements editable as a single Social block with multiple items.

## HTML Export

`ngx-email-studio` generates browser-side HTML for the supported subset. The export includes:

- HTML email document shell
- table-based layout structure
- reset styles for common email-client behavior
- responsive column stacking
- sanitized inline styles and links
- sandboxed preview inside the builder UI

For maximum production compatibility with every email client, test exported HTML with your own email QA stack before sending campaigns.

## Rich Text Editing

The default rich text editor is Tiptap/ProseMirror. It supports:

- paragraph and H1-H6 blocks
- bold, italic, underline, strike
- links
- bullet and ordered lists
- text alignment
- font size and line height controls
- table insertion/editing
- undo/redo
- selected-text-block source HTML editing with sanitizer feedback

Use plain mode if you want a lightweight textarea fallback:

```html
<ngx-email-studio [config]="{ richTextEditor: 'plain' }" />
```

## Document Model

Apps can persist either the exported MJML or the internal JSON model.

```ts
export interface EmailDocument {
  version: string;
  attrs?: Record<string, string | number | boolean>;
  body: EmailNode[];
  unsupported?: string[];
}

export interface EmailNode {
  id: string;
  type: 'row' | 'column' | 'section' | 'text' | 'image' | 'button' | 'social' | 'divider' | 'spacer';
  attrs: Record<string, string | number | boolean>;
  children?: EmailNode[];
}
```

Listen to `(documentChange)` if your application wants to store drafts as structured JSON and rehydrate them later with `[document]`.

## Security Notes

The builder treats imported MJML and rich text as untrusted input.

Current safeguards include:

- removes scripts, iframes, event handlers, and unsupported rich-text attributes;
- sanitizes link/button/social `href` values;
- rejects unsafe URL protocols such as `javascript:` and protocol-relative `//example.com`;
- normalizes safe HTML `class` and `id` values;
- normalizes colors, sizes, alignments, and selected style attributes before preview/export;
- uses a sandboxed iframe for exported HTML preview.

Still, email sending is an application responsibility. Validate campaigns, links, and final HTML in your own workflow before production delivery.

## Development

```bash
npm install
npm run build:lib
npm run build:demo
npm test -- --watch=false
npm run smoke:tiptap
npm run pack:lib
```

Run the demo locally:

```bash
npm start
```

Build and deploy the GitHub Pages demo:

```bash
npm run deploy:pages
```

## Publishing

Build and pack the library:

```bash
npm run build:lib
npm run pack:lib
```

Publish from the generated library package:

```bash
cd dist/ngx-email-studio
npm publish --access public
```

The workspace root is private; the publishable package is `projects/ngx-email-studio` built into `dist/ngx-email-studio`.

## License

MIT © Edward
