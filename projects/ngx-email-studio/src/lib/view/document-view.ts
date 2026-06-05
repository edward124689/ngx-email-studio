import { normalizeColorValue } from '../export/export-utils';
import { EmailSizeUnit } from '../models';

export function colorPickerValue(value: unknown, fallback = '#ffffff'): string {
  return normalizeColorValue(value) || fallback;
}

export function dimensionValueFromCss(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 100;
}

export function dimensionUnitFromCss(value: string): EmailSizeUnit {
  return value.trim().endsWith('%') ? '%' : 'px';
}

export function backgroundFor(attrs: Record<string, string | number | boolean>): string {
  return normalizeColorValue(attrs['backgroundColor']) || String(attrs['backgroundColor'] ?? '').trim() || 'transparent';
}

export function plainText(value: string): string {
  return value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

export function containedCssSize(value: string): string {
  return value.endsWith('%') ? value : `min(100%, ${value})`;
}
