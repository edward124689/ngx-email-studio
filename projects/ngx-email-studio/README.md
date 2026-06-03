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
- TinyMCE community editor integration

## Install

```bash
npm install ngx-email-studio @angular/cdk @tinymce/tinymce-angular tinymce
```

Copy TinyMCE assets to `/tinymce` in your Angular app assets config. For Angular apps deployed under a subpath, the component resolves TinyMCE relative to the current `<base href>`. You can override the asset location with `config.tinyMceBaseUrl`.

## Usage

```ts
import { NgxEmailStudio } from 'ngx-email-studio';
```

```html
<ngx-email-studio (mjmlChange)="onMjmlChange($event)" (htmlExport)="onHtmlExport($event)" />
```
