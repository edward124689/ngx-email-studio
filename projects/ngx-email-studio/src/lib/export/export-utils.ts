import { EmailNode, EmailSizeUnit } from '../models';

export function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

export function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function normalizeColorValue(value: unknown): string {
  const color = String(value ?? '').trim();
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color.toLowerCase() : '';
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
  return node.type === 'text' || node.type === 'image' || node.type === 'button';
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

export function sectionPaddingCss(section: EmailNode): string {
  const unit = paddingUnit(section);
  const top = paddingValue(section, 'paddingTop');
  const right = paddingValue(section, 'paddingRight');
  const bottom = paddingValue(section, 'paddingBottom');
  const left = paddingValue(section, 'paddingLeft');
  return `${top}${unit} ${right}${unit} ${bottom}${unit} ${left}${unit}`;
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

export function indent(value: string, depth: number): string {
  return `${'  '.repeat(depth)}${value}`;
}
