import { normalizeColorValue, normalizeFontWeightValue, normalizeHrefValue, normalizeHtmlClassValue, normalizeHtmlIdValue } from '../export/export-utils';

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
        sanitizeRichTextNode(element);
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
      const style = safeRichTextStyle(attr.value, element.tagName);
      if (style) element.setAttribute('style', style);
      else element.removeAttribute('style');
      continue;
    }
    if (element.tagName === 'A' && name === 'href') {
      const href = normalizeHrefValue(attr.value);
      if (href) element.setAttribute('href', href);
      else element.removeAttribute('href');
      continue;
    }
    if (element.tagName === 'A' && (name === 'target' || name === 'rel' || name === 'title')) continue;
    if ((element.tagName === 'TD' || element.tagName === 'TH') && (name === 'colspan' || name === 'rowspan')) {
      const safeNumber = Math.max(1, Math.min(12, Number.parseInt(attr.value, 10) || 1));
      element.setAttribute(name, String(safeNumber));
      continue;
    }
    if (name === 'id') {
      const id = normalizeHtmlIdValue(attr.value);
      if (id) element.setAttribute('id', id);
      else element.removeAttribute(attr.name);
      continue;
    }
    if (name === 'class') {
      const className = normalizeHtmlClassValue(attr.value);
      if (className) element.setAttribute('class', className);
      else element.removeAttribute(attr.name);
      continue;
    }
    element.removeAttribute(attr.name);
  }
  if (element.tagName === 'A') {
    element.setAttribute('rel', 'noopener noreferrer');
  }
}

function safeRichTextStyle(value: string, tagName: string): string {
  const safe: string[] = [];
  const isTableCell = tagName === 'TD' || tagName === 'TH';
  const isBlockTypographyNode = tagName === 'P' || /^H[1-6]$/.test(tagName);
  for (const declaration of value.split(';')) {
    const [rawProperty, ...rawValueParts] = declaration.split(':');
    if (!rawProperty || rawValueParts.length === 0) continue;
    const property = rawProperty.trim().toLowerCase();
    const rawValue = rawValueParts.join(':').trim();
    if (!rawValue || /url\s*\(|expression\s*\(|javascript:/i.test(rawValue)) continue;
    if (property === 'font-size' && /^(1[2-9]|[2-6][0-9]|7[0-2])px$/.test(rawValue)) safe.push(`font-size: ${rawValue}`);
    if (property === 'line-height' && (/^(1|1\.15|1\.3|1\.5|1\.75|2)$/.test(rawValue) || /^([1-9]|[1-8][0-9])px$/.test(rawValue))) safe.push(`line-height: ${rawValue}`);
    if (property === 'text-align' && /^(left|center|right|justify)$/.test(rawValue)) safe.push(`text-align: ${rawValue}`);
    const normalizedColor = normalizeColorValue(rawValue);
    if (property === 'color' && normalizedColor) safe.push(`color: ${normalizedColor}`);
    if (property === 'font-family' && safeFontFamily(rawValue)) safe.push(`font-family: ${rawValue}`);
    const normalizedFontWeight = normalizeFontWeightValue(rawValue);
    if (property === 'font-weight' && normalizedFontWeight) safe.push(`font-weight: ${normalizedFontWeight}`);
    if (isBlockTypographyNode && (property === 'margin' || property === 'margin-top' || property === 'margin-right' || property === 'margin-bottom' || property === 'margin-left') && safeBoxSpacing(rawValue)) safe.push(`${property}: ${rawValue}`);
    if (property === 'background-color' && normalizedColor) safe.push(`background-color: ${normalizedColor}`);
    if (isTableCell && property === 'border-color' && normalizedColor) safe.push(`border-color: ${normalizedColor}`);
    if (isTableCell && property === 'border-width' && /^(0|[1-9][0-9]?)px$/.test(rawValue)) safe.push(`border-width: ${rawValue}`);
    if (isTableCell && property === 'border-style' && /^(solid|dashed|dotted|double|none)$/.test(rawValue)) safe.push(`border-style: ${rawValue}`);
    if (isTableCell && property === 'width' && /^(auto|100%|[1-9][0-9]{0,2}px|[1-9][0-9]?%)$/.test(rawValue)) safe.push(`width: ${rawValue}`);
    if (isTableCell && property === 'height' && /^(auto|[1-9][0-9]{0,2}px)$/.test(rawValue)) safe.push(`height: ${rawValue}`);
    if (isTableCell && property === 'padding' && /^(0|[1-9][0-9]?px)$/.test(rawValue)) safe.push(`padding: ${rawValue}`);
  }
  return safe.join('; ');
}


function safeFontFamily(value: string): boolean {
  return /^[a-zA-Z0-9\s,'"\-]+$/.test(value) && /[a-zA-Z]/.test(value) && value.length <= 120;
}

function safeBoxSpacing(value: string): boolean {
  const parts = value.split(/\s+/).filter(Boolean);
  return parts.length >= 1 && parts.length <= 4 && parts.every((part) => part === '0' || /^-?([1-9]|[1-9][0-9])px$/.test(part) || part === 'auto');
}
