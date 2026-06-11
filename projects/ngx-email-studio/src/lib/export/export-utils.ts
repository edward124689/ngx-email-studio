import { EmailNode, EmailSizeUnit } from '../models';

export function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

export function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function normalizeColorValue(value: unknown): string {
  const color = String(value ?? '').trim();
  const hex = color.match(/^#([0-9a-fA-F]{6})$/);
  if (hex) return `#${hex[1].toLowerCase()}`;
  const rgb = color.match(/^rgb\(\s*(25[0-5]|2[0-4]\d|1?\d?\d)\s*,\s*(25[0-5]|2[0-4]\d|1?\d?\d)\s*,\s*(25[0-5]|2[0-4]\d|1?\d?\d)\s*\)$/i);
  if (!rgb) return '';
  return `#${[rgb[1], rgb[2], rgb[3]].map((part) => Number(part).toString(16).padStart(2, '0')).join('')}`;
}

export function normalizeCssSizeValue(value: unknown): string {
  const raw = String(value ?? '').trim();
  return /^(1[2-9]|[2-6][0-9]|7[0-2])px$/.test(raw) ? raw : '';
}

export function normalizeLineHeightValue(value: unknown): string {
  const raw = String(value ?? '').trim();
  return /^([1-9]|[1-8][0-9])px$/.test(raw) || /^(1|1\.15|1\.3|1\.5|1\.75|2)$/.test(raw) ? raw : '';
}

export function normalizeFontFamilyValue(value: unknown): string {
  const raw = String(value ?? '').trim();
  return /^[a-zA-Z0-9\s,'"\-]+$/.test(raw) && /[a-zA-Z]/.test(raw) && raw.length <= 120 ? raw : '';
}

export function normalizeFontCssUrlValue(value: unknown): string {
  const raw = String(value ?? '').trim();
  if (!raw || raw.length > 300 || /[\s"'<>\\()]/.test(raw)) return '';
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' && !!url.hostname ? raw : '';
  } catch {
    return '';
  }
}

export function normalizeFontWeightValue(value: unknown): string {
  const raw = String(value ?? '').trim().toLowerCase();
  return /^(normal|bold|[1-9]00)$/.test(raw) ? raw : '';
}

export function normalizeHtmlIdValue(value: unknown): string {
  const raw = String(value ?? '').trim();
  return /^[A-Za-z][A-Za-z0-9_:\-.]{0,63}$/.test(raw) ? raw : '';
}

export function normalizeHtmlClassValue(value: unknown): string {
  const tokens = String(value ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .filter((token) => /^[A-Za-z_][A-Za-z0-9_:\-]{0,63}$/.test(token));
  return tokens.slice(0, 16).join(' ');
}

export function normalizeHrefValue(value: unknown): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  if (/^(https?:|mailto:|tel:|#)/i.test(raw)) return raw;
  if (/^\/(?!\/)/.test(raw)) return raw;
  return '';
}

export function normalizeImageSrcValue(value: unknown): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  if (/^https?:/i.test(raw)) {
    try {
      const url = new URL(raw);
      return url.hostname ? raw : '';
    } catch {
      return '';
    }
  }
  if (/^\/(?!\/)/.test(raw)) return raw;
  if (/^cid:[A-Za-z0-9._%+\-@]+$/i.test(raw)) return raw;
  return '';
}

export function colorAttrValue(value: unknown): string {
  return normalizeColorValue(value);
}

export function backgroundStyle(value: unknown): string {
  const color = colorAttrValue(value);
  return color ? `background:${escapeAttr(color)};` : '';
}

export function safeAlign(value: string | null | undefined): 'left' | 'center' | 'right' {
  const align = String(value || 'left').toLowerCase();
  return align === 'center' || align === 'right' ? align : 'left';
}

export function contentAlign(node: EmailNode): 'left' | 'center' | 'right' {
  return safeAlign(String(node.attrs['align'] || 'left'));
}

export function isAlignableContent(node: EmailNode): boolean {
  return node.type === 'text' || node.type === 'image' || node.type === 'button' || node.type === 'social';
}

export function dimensionValue(attrs: Record<string, string | number | boolean>, key: string, fallback: number): number {
  const raw = attrs[key];
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : fallback;
  const parsed = Number.parseFloat(String(raw || ''));
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function dimensionUnit(attrs: Record<string, string | number | boolean>, key: string, fallback: EmailSizeUnit): EmailSizeUnit {
  const unitValue = attrs[`${key}Unit`];
  if (unitValue === 'px' || unitValue === '%') return unitValue;
  const raw = String(attrs[key] || '');
  if (raw.trim().endsWith('%')) return '%';
  if (raw.trim().endsWith('px')) return 'px';
  return fallback;
}

export function dimensionCss(attrs: Record<string, string | number | boolean>, key: string, fallback: number, fallbackUnit: EmailSizeUnit): string {
  return `${dimensionValue(attrs, key, fallback)}${dimensionUnit(attrs, key, fallbackUnit)}`;
}

export function dimensionHtmlWidthAttr(attrs: Record<string, string | number | boolean>, key: string, fallback: number, fallbackUnit: EmailSizeUnit): string {
  const value = dimensionValue(attrs, key, fallback);
  const unit = dimensionUnit(attrs, key, fallbackUnit);
  return unit === 'px' ? String(value) : `${value}%`;
}

export function paddingUnit(section: EmailNode): EmailSizeUnit {
  return section.attrs['paddingUnit'] === '%' ? '%' : 'px';
}

export function paddingValue(section: EmailNode, key: 'padding' | 'paddingTop' | 'paddingRight' | 'paddingBottom' | 'paddingLeft'): number {
  return dimensionValue(section.attrs, key, dimensionValue(section.attrs, 'padding', 16));
}

export function paddingCss(node: EmailNode, fallback = 0): string {
  const unit = paddingUnit(node);
  const base = dimensionValue(node.attrs, 'padding', fallback);
  const top = dimensionValue(node.attrs, 'paddingTop', base);
  const right = dimensionValue(node.attrs, 'paddingRight', base);
  const bottom = dimensionValue(node.attrs, 'paddingBottom', base);
  const left = dimensionValue(node.attrs, 'paddingLeft', base);
  return `${top}${unit} ${right}${unit} ${bottom}${unit} ${left}${unit}`;
}

export function sectionPaddingCss(section: EmailNode): string {
  return paddingCss(section, 16);
}

export function sectionWidthCss(section: EmailNode): string {
  return dimensionCss(section.attrs, 'width', 100, '%');
}

export function sectionMaxWidthCss(section: EmailNode): string {
  return dimensionCss(section.attrs, 'maxWidth', 600, 'px');
}

export function columnWidthCss(column: EmailNode, fallback = 100, fallbackUnit: EmailSizeUnit = '%'): string {
  return dimensionCss(column.attrs, 'width', fallback, fallbackUnit);
}

export function columnMaxWidthCss(column: EmailNode): string {
  return dimensionCss(column.attrs, 'maxWidth', 600, 'px');
}

export function imageWidthCss(image: EmailNode): string {
  return dimensionCss(image.attrs, 'width', 100, '%');
}

export function hasExplicitDimension(attrs: Record<string, string | number | boolean>, key: string): boolean {
  return attrs[key] !== undefined && attrs[key] !== null && String(attrs[key]).trim() !== '';
}

export function indent(value: string, depth: number): string {
  return `${'  '.repeat(depth)}${value}`;
}
