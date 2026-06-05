import { EmailSizeUnit } from '../models';

export function colorPickerValue(value: unknown): string {
  const color = String(value || '').trim();
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color : '#ffffff';
}

export function dimensionValueFromCss(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 100;
}

export function dimensionUnitFromCss(value: string): EmailSizeUnit {
  return value.trim().endsWith('%') ? '%' : 'px';
}

export function backgroundFor(attrs: Record<string, string | number | boolean>): string {
  return String(attrs['backgroundColor'] || '#ffffff');
}

export function plainText(value: string): string {
  return value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

export function containedCssSize(value: string): string {
  return value.endsWith('%') ? value : `min(100%, ${value})`;
}
