import { escapeAttr } from '../export/export-utils';

export function buildSandboxedPreviewShell(html: string): string {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Email preview</title>
    <style>html,body{margin:0;width:100%;height:100%;background:#f3f4f6;}iframe{display:block;width:100%;height:100%;border:0;background:#fff;}</style>
  </head>
  <body>
    <iframe title="Email preview" sandbox="" srcdoc="${escapeAttr(html)}"></iframe>
  </body>
</html>`;
}

export function fallbackCopyToClipboard(content: string, doc = globalThis.document): boolean {
  if (!doc?.body || !doc.execCommand) return false;
  const textarea = doc.createElement('textarea');
  textarea.value = content;
  textarea.setAttribute('readonly', 'true');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  doc.body.appendChild(textarea);
  try {
    textarea.select();
    return doc.execCommand('copy');
  } finally {
    doc.body.removeChild(textarea);
  }
}
