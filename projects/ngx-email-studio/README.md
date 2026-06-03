# ngx-email-studio

Angular 21 frontend email builder library.

## Features in 0.0.1

- Standalone `<ngx-email-studio />` component
- Angular CDK drag-and-drop block palette
- Builder-style layout with toolbar, canvas, and property panel
- MJML import/export for supported blocks
- Frontend HTML export for supported blocks
- Responsive preview presets
- Font Awesome 4.7-compatible icon classes
- TinyMCE community editor integration

## Install

```bash
npm install ngx-email-studio @angular/cdk @tinymce/tinymce-angular tinymce
```

Copy TinyMCE assets to `/tinymce` in your Angular app assets config.

## Usage

```ts
import { NgxEmailStudio } from 'ngx-email-studio';
```

```html
<ngx-email-studio (mjmlChange)="onMjmlChange($event)" (htmlExport)="onHtmlExport($event)" />
```
