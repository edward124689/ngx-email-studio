# ngx-email-studio StackBlitz demo

This is a minimal Angular 21 StackBlitz project that consumes the published `ngx-email-studio` npm package.

[Open in StackBlitz](https://stackblitz.com/github/edward124689/ngx-email-studio/tree/main/examples/stackblitz?file=src%2Fapp%2Fapp.ts)

## What it demonstrates

- Standalone `NgxEmailStudio` import from `ngx-email-studio`
- MJML seed template
- `dataSet` / merge-tag helper
- `config.uploadImage` with a demo-only simulated upload URL
- `change` and `save` outputs

## Local check

```bash
cd examples/stackblitz
npm install
npm run build
npm start
```

The upload hook is intentionally demo-only. Real host apps should upload the selected `File` to their own API/storage provider and return the persisted public URL.
