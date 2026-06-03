# ngx-email-studio

Angular 21 frontend email builder library for browser-side MJML template editing and HTML export.

`ngx-email-studio` is designed to be installed from npm and imported directly into Angular applications.

## Status

Initial development version: `0.0.1`.

This release focuses on a frontend-only builder experience:

- drag-and-drop block palette with Angular CDK;
- builder-style UI: toolbar, left palette, center canvas, right properties panel;
- MJML import/export for a supported subset;
- frontend HTML export for the supported subset;
- responsive preview widths: desktop, tablet, mobile;
- Font Awesome 4.7-compatible icon classes;
- TinyMCE community rich text editor integration for text blocks.

## Install

```bash
npm install ngx-email-studio
```

Peer dependencies:

```bash
npm install @angular/cdk @tinymce/tinymce-angular tinymce
```

Optional Font Awesome 4.7 CSS for icons:

```html
<link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/font-awesome/4.7.0/css/font-awesome.min.css" />
```

TinyMCE is self-hosted by default. Copy TinyMCE assets to `/tinymce` in your Angular app:

```json
{
  "glob": "**/*",
  "input": "node_modules/tinymce",
  "output": "tinymce"
}
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
| `config` | `EmailStudioConfig` | Editor options, including `useTinyMce`. |

### Outputs

| Output | Type | Description |
| --- | --- | --- |
| `mjmlChange` | `string` | Emits the current MJML output. |
| `documentChange` | `EmailDocument` | Emits the internal document model after edits. |
| `htmlExport` | `string` | Emits generated frontend HTML output. |
| `error` | `EmailStudioError` | Emits import/export errors. |

## Supported Blocks in 0.0.1

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
npm start
```

## Planning Docs

See:

```bash
docs/plans/2026-06-03-initial-product-plan.md
```

## License

MIT
