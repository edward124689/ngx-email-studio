# ngx-email-studio

Angular 21 frontend email builder library for browser-side MJML template editing and HTML export.

`ngx-email-studio` is designed to be installed from npm and imported directly into Angular applications.

## Status

Initial development version: `0.0.1`.

This release focuses on a frontend-only builder experience:

- drag-and-drop block palette with Angular CDK;
- OpenDesign-inspired builder shell: campaign header, searchable module library, outline, grid canvas, preview size chips, floating block controls, and tabbed inspector;
- MJML import/export for a supported subset;
- row layouts with 1-4 MJML columns via `<mj-section><mj-column>`;
- frontend HTML export for the supported subset;
- responsive preview widths: desktop, tablet, mobile;
- Font Awesome 4.7-compatible icon classes;
- Tiptap rich text editor integration for text blocks.

## Install

```bash
npm install ngx-email-studio
```

Peer dependencies:

```bash
npm install @angular/cdk @tiptap/core @tiptap/starter-kit @tiptap/extension-link @tiptap/extension-text-align @tiptap/extension-table @tiptap/extension-table-row @tiptap/extension-table-cell @tiptap/extension-table-header
```

Optional Font Awesome 4.7 CSS for icons:

```html
<link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/font-awesome/4.7.0/css/font-awesome.min.css" />
```


## Basic Usage

```ts
import { Component } from '@angular/core';
import { NgxEmailStudio, EmailDocument } from 'ngx-email-studio';

@Component({
  selector: 'app-email-builder',
  standalone: true,
  imports: [NgxEmailStudio],
  template: `
    <ngx-email-studio
      [document]="document"
      [previewSize]="'desktop'"
      (mjmlChange)="onMjmlChange($event)"
      (htmlExport)="onHtmlExport($event)"
    />
  `,
})
export class EmailBuilderPage {
  document: EmailDocument = {
    version: '0.0.1',
    body: [],
  };

  onMjmlChange(mjml: string): void {
    console.log(mjml);
  }

  onHtmlExport(html: string): void {
    console.log(html);
  }
}
```

## Component API

### Inputs

| Input | Type | Description |
| --- | --- | --- |
| `mjml` | `string` | MJML string to import into the editor. |
| `document` | `EmailDocument` | Internal document model. Recommended for app state. |
| `previewSize` | `'desktop' \| 'tablet' \| 'mobile' \| number` | Preview width preset or custom pixel width. |
| `readonly` | `boolean` | Disables drag/drop edits when true. |
| `config` | `EmailStudioConfig` | Editor options, including `richTextEditor: 'tiptap' | 'plain'`. |

### Outputs

| Output | Type | Description |
| --- | --- | --- |
| `mjmlChange` | `string` | Emits the current MJML output. |
| `documentChange` | `EmailDocument` | Emits the internal document model after edits. |
| `htmlExport` | `string` | Emits generated frontend HTML output. |
| `error` | `EmailStudioError` | Emits import/export errors. |

## Supported Blocks in 0.0.1

- Row / column layout block for 1-4 `<mj-column>` layouts
- Section
- Text
- Image
- Button
- Divider
- Spacer

The MJML importer intentionally supports a controlled subset first. Unsupported MJML tags are reported as warnings instead of silently pretending they were handled.

## Development

```bash
npm install
npm run build:lib
npm run build:demo
npm test -- --watch=false
npm run pack:lib
npm run deploy:pages
npm start
```

## GitHub Pages Demo

After each completed change, push `main`, then deploy the demo:

```bash
npm run deploy:pages
```

The deploy script builds the Angular demo with:

```bash
--base-href /ngx-email-studio/
```

Then publishes `dist/demo/browser` to the `gh-pages` branch.

## Planning Docs

See:

```bash
docs/plans/2026-06-03-initial-product-plan.md
```

## License

MIT
