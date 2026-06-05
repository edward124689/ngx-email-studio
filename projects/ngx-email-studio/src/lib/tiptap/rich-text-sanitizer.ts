const ALLOWED_RICH_TEXT_TAGS = new Set(['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'STRONG', 'B', 'EM', 'I', 'U', 'S', 'STRIKE', 'A', 'UL', 'OL', 'LI', 'BR', 'SPAN', 'TABLE', 'THEAD', 'TBODY', 'TR', 'TH', 'TD']);

export function sanitizeRichTextContent(value: unknown): string {
  const raw = String(value || '');
  if (!raw.trim()) return '';
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${raw}</div>`, 'text/html');
  const root = doc.body.firstElementChild;
  if (!root) return '';
  sanitizeRichTextNode(root);
  return root.innerHTML;
}

function sanitizeRichTextNode(node: Node): void {
  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) continue;
    if (child.nodeType !== Node.ELEMENT_NODE) {
      child.remove();
      continue;
    }
    const element = child as HTMLElement;
    if (!ALLOWED_RICH_TEXT_TAGS.has(element.tagName)) {
      if (element.tagName === 'SCRIPT' || element.tagName === 'STYLE' || element.tagName === 'IFRAME') {
        element.remove();
      } else {
        const parent = element.parentNode;
        while (element.firstChild) parent?.insertBefore(element.firstChild, element);
        element.remove();
      }
      continue;
    }
    sanitizeRichTextElement(element);
    sanitizeRichTextNode(element);
  }
}

function sanitizeRichTextElement(element: HTMLElement): void {
  for (const attr of Array.from(element.attributes)) {
    const name = attr.name.toLowerCase();
    if (name.startsWith('on')) {
      element.removeAttribute(attr.name);
      continue;
    }
    if (name === 'style') {
      const style = safeRichTextStyle(attr.value);
      if (style) element.setAttribute('style', style);
      else element.removeAttribute('style');
      continue;
    }
    if (element.tagName === 'A' && name === 'href') {
      const href = attr.value.trim();
      if (/^(https?:|mailto:|tel:|#|\/)/i.test(href)) element.setAttribute('href', href);
      else element.removeAttribute('href');
      continue;
    }
    if (element.tagName === 'A' && (name === 'target' || name === 'rel' || name === 'title')) continue;
    if ((element.tagName === 'TD' || element.tagName === 'TH') && (name === 'colspan' || name === 'rowspan')) {
      const safeNumber = Math.max(1, Math.min(12, Number.parseInt(attr.value, 10) || 1));
      element.setAttribute(name, String(safeNumber));
      continue;
    }
    if (name === 'class' && /(^|\s)kicker(\s|$)/.test(attr.value)) {
      element.setAttribute('class', 'kicker');
      continue;
    }
    element.removeAttribute(attr.name);
  }
  if (element.tagName === 'A') {
    element.setAttribute('rel', 'noopener noreferrer');
  }
}

function safeRichTextStyle(value: string): string {
  const safe: string[] = [];
  for (const declaration of value.split(';')) {
    const [rawProperty, ...rawValueParts] = declaration.split(':');
    if (!rawProperty || rawValueParts.length === 0) continue;
    const property = rawProperty.trim().toLowerCase();
    const rawValue = rawValueParts.join(':').trim();
    if (!rawValue || /url\s*\(|expression\s*\(|javascript:/i.test(rawValue)) continue;
    if (property === 'font-size' && /^(1[0-9]|2[0-9]|3[0-9]|4[0-8])px$/.test(rawValue)) safe.push(`font-size: ${rawValue}`);
    if (property === 'line-height' && /^(1|1\.15|1\.3|1\.5|1\.75|2)$/.test(rawValue)) safe.push(`line-height: ${rawValue}`);
    if (property === 'text-align' && /^(left|center|right|justify)$/.test(rawValue)) safe.push(`text-align: ${rawValue}`);
  }
  return safe.join('; ');
}
