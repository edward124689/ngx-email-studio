# ngx-email-studio

Angular 21 frontend email builder library.

## Features in 0.0.1

- Standalone `<ngx-email-studio />` component
- Angular CDK drag-and-drop block palette
- OpenDesign-inspired builder shell with searchable modules, outline, grid canvas, size chips, floating selected-block controls, and tabbed inspector;
- MJML import/export for a supported subset, including 1-4 column row layouts;
- Frontend HTML export for supported blocks
- Responsive preview presets
- Font Awesome 4.7-compatible icon classes
- Tiptap rich text editor integration

## Install

```bash
npm install ngx-email-studio @angular/cdk @tiptap/core @tiptap/starter-kit @tiptap/extension-link @tiptap/extension-text-align @tiptap/extension-table @tiptap/extension-table-row @tiptap/extension-table-cell @tiptap/extension-table-header
```


## Usage

```ts
import { NgxEmailStudio } from 'ngx-email-studio';
```

```html
<ngx-email-studio (mjmlChange)="onMjmlChange($event)" (htmlExport)="onHtmlExport($event)" />
```
