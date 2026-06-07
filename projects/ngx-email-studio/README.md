# ngx-email-studio

[![npm version](https://badge.fury.io/js/ngx-email-studio.svg)](https://www.npmjs.com/package/ngx-email-studio) [![npm downloads](https://img.shields.io/npm/dm/ngx-email-studio.svg)](https://www.npmjs.com/package/ngx-email-studio) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

`ngx-email-studio` is an Angular 21 frontend email builder for composing, importing, editing, previewing, and exporting responsive email templates.

It provides a polished visual builder shell, MJML import/export for a practical editable subset, clean browser-side HTML export, drag-and-drop content blocks, Tiptap rich text editing, and a responsive preview workflow — all as a standalone Angular component.

Live demo: <https://edward124689.github.io/ngx-email-studio/>

[![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/edward124689/ngx-email-studio/tree/main/examples/stackblitz?file=src%2Fapp%2Fapp.ts)

<p align="center">
  <img src="https://raw.githubusercontent.com/edward124689/ngx-email-studio/main/docs/images/email-studio-demo.png" alt="Email Studio visual builder with content modules, email canvas, responsive preview controls, and properties inspector" width="100%" />
</p>

## Table of Contents

- [Features](#features)
- [Version Support](#version-support)
- [Try in StackBlitz](#try-in-stackblitz)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Using an MJML Template](#using-an-mjml-template)
- [Merge Tags / Data Set](#merge-tags--data-set)
- [Image Upload Helper](#image-upload-helper)
- [Text Transform](#text-transform)
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
- **Merge-tag helper**: pass a `dataSet` of placeholder keys and descriptions so users can search available merge tags and copy keys into the email content.
- **Image upload helper**: provide `config.uploadImage` so image blocks can pick a local file, preview it, call your upload API, and write the returned URL back into Image URL.
- **Text Transform**: preview and apply Simplified ↔ Traditional Chinese conversion or whitespace normalization to the whole email.
- **Responsive preview**: switch between desktop/tablet/mobile/custom preview widths.
- **Editable social links**: import/export `<mj-social>` with multiple `<mj-social-element>` entries.
- **Safe import boundaries**: sanitizes rich text, URLs, class/id values, colors, and imported attributes before preview/export.
- **MIT licensed**.

## Version Support

`ngx-email-studio` follows Angular-major aligned versions.

| ngx-email-studio version | Supported Angular version |
| --- | --- |
| `21.x` | Angular `21.x` |

The first public npm release is `21.0.0`; the current stable release is tracked on the [npm package page](https://www.npmjs.com/package/ngx-email-studio) and in the [GitHub changelog](https://github.com/edward124689/ngx-email-studio/blob/main/CHANGELOG.md).

## Try in StackBlitz

Open a ready-to-run Angular 21 demo that installs `ngx-email-studio` from npm and shows the builder with MJML seed content, merge tags, Text Transform, and a demo-only image upload hook:

<https://stackblitz.com/github/edward124689/ngx-email-studio/tree/main/examples/stackblitz?file=src%2Fapp%2Fapp.ts>

## Installation

Install the package:

```bash
npm install ngx-email-studio
```

Install Angular and editor peer dependencies if they are not already present in your app:

```bash
npm install @angular/core@^21 @angular/common@^21 @angular/forms@^21 @angular/platform-browser@^21 @angular/cdk@^21
npm install @tiptap/core@^3 @tiptap/starter-kit@^3 @tiptap/extension-link@^3 @tiptap/extension-text-align@^3 @tiptap/extension-text-style@^3 @tiptap/extension-table@^3 @tiptap/extension-table-row@^3 @tiptap/extension-table-cell@^3 @tiptap/extension-table-header@^3
```

`opencc-js` is a runtime dependency of `ngx-email-studio` and is installed automatically with the package.

## Quick Start

Import the standalone component and render it:

```ts
import { Component } from '@angular/core';
import { NgxEmailStudio, EmailStudioDataSetItem, EmailStudioResult } from 'ngx-email-studio';

@Component({
  selector: 'app-email-builder-page',
  standalone: true,
  imports: [NgxEmailStudio],
  template: `
    <ngx-email-studio
      [mjml]="initialMjml"
      [showSave]="true"
      [dataSet]="mergeTags"
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

  mergeTags: EmailStudioDataSetItem[] = [
    { key: '{%CLIENT_NAME%}', desc: 'Client name' },
    { key: '{%ORDER_ID%}', desc: 'Order ID' },
    { key: '{%DELIVERY_DATE%}', desc: 'Estimated delivery date' },
    { key: '{%SUPPORT_EMAIL%}', desc: 'Support contact email' },
  ];

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

## Merge Tags / Data Set

Host apps can provide a list of merge-tag placeholders with optional descriptions. When the list contains at least one valid key, the builder shows a `Data set` button in the top toolbar before `Import`.

```ts
import { EmailStudioDataSetItem } from 'ngx-email-studio';

mergeTags: EmailStudioDataSetItem[] = [
  { key: '{%CLIENT_NAME%}', desc: 'Client name' },
  { key: '{%ORDER_ID%}', desc: 'Order ID' },
  { key: '{%DELIVERY_DATE%}', desc: 'Estimated delivery date' },
  { key: '{%SUPPORT_EMAIL%}', desc: 'Support contact email' },
];
```

```html
<ngx-email-studio
  [dataSet]="mergeTags"
  (change)="draft = $event"
/>
```

The modal is a reference helper only: users can search keys/descriptions and copy a key such as `{%CLIENT_NAME%}` into the email content. It does not render, replace, or preview template data.

```ts
export interface EmailStudioDataSetItem {
  key: string;
  desc?: string;
}
```

## Image Upload Helper

Image blocks can show an `Upload image` helper beside the regular `Image URL` field when the host app provides `config.uploadImage`. The library handles the file picker, local preview, loading/error state, history, and writing the returned URL back to the image block. The host app owns the real upload API, auth, storage provider, and server-side validation.

```ts
import { EmailStudioConfig } from 'ngx-email-studio';

const config: EmailStudioConfig = {
  uploadImage: async (file, context) => {
    const form = new FormData();
    form.append('file', file);
    form.append('nodeId', context.nodeId);

    const res = await fetch('/api/email-assets', {
      method: 'POST',
      body: form,
    });

    if (!res.ok) throw new Error('Image upload failed');
    const data = await res.json();

    return {
      url: data.url,
      alt: data.alt,
    };
  },
};
```

`uploadImage` may return either a string URL or `{ url, alt? }`. If `alt` is returned, it updates the image block alt text. The picker accepts PNG, JPEG, WebP, and GIF files; host apps should still validate uploads server-side. Returned URLs are normalized with the same image URL safety rules used by the editor. When `uploadImage` is omitted, the upload button is hidden and users can still paste an Image URL manually. In `readonly` mode, upload is disabled.

## Text Transform

The top toolbar includes a `Transform` action for content-level text transformations. It opens a preview modal before applying changes, so users can compare the current text with the transformed result.

Supported actions:

- Simplified Chinese → Traditional Chinese
- Traditional Chinese → Simplified Chinese
- Normalize spaces

Scope:

- Whole email, covering rich-text blocks and button labels

Transform only changes user-visible text nodes. It preserves rich-text HTML tags and attributes such as links, styles, and classes. Merge-tag placeholders like `{%CLIENT_NAME%}` are preserved unchanged during conversion.

Apply participates in the normal document history, so users can undo a transform with the global `Undo` control. In `readonly` mode the Transform action is disabled.

Chinese conversion is powered by `opencc-js`, which is declared as a runtime dependency of `ngx-email-studio`. Consumers do not need to install it separately when using npm, pnpm, or yarn.

## Component API

### Inputs

| Input | Type | Description |
| --- | --- | --- |
| `mjml` | `string` | Initial MJML source to import into the builder. |
| `document` | `EmailDocument` | Optional internal JSON document model for apps that persist builder state directly. |
| `previewSize` | `'desktop' \| 'tablet' \| 'mobile' \| number` | Preview width preset or custom pixel width. |
| `readonly` | `boolean` | Disables editing controls when true. |
| `showSave` | `boolean` | Shows or hides the top Save button. Can also be controlled by `config.showSave`. |
| `dataSet` | `EmailStudioDataSetItem[]` | Optional merge-tag list. When valid keys are provided, shows a searchable `Data set` modal for copying placeholder keys. |
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

The `21.x` releases focus on a practical editable MJML subset:

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
