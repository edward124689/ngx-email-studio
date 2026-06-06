import { normalizeColorValue, normalizeCssSizeValue, normalizeHrefValue, safeAlign } from '../export/export-utils';

export interface SocialItem {
  name: string;
  href: string;
  backgroundColor: string;
}

export const DEFAULT_SOCIAL_ITEMS: SocialItem[] = [
  { name: 'facebook', href: 'https://mjml.io/', backgroundColor: '#A1A0A0' },
  { name: 'twitter', href: 'https://mjml.io/', backgroundColor: '#A1A0A0' },
  { name: 'linkedin', href: 'https://mjml.io/', backgroundColor: '#A1A0A0' },
];

export function serializeSocialItems(items: SocialItem[]): string {
  return JSON.stringify(normalizeSocialItems(items));
}

export function parseSocialItems(value: unknown): SocialItem[] {
  if (Array.isArray(value)) return normalizeSocialItems(value);
  if (typeof value !== 'string') return [...DEFAULT_SOCIAL_ITEMS];
  try {
    const parsed = JSON.parse(value);
    return normalizeSocialItems(parsed);
  } catch {
    return [...DEFAULT_SOCIAL_ITEMS];
  }
}

export function normalizeSocialItems(value: unknown): SocialItem[] {
  if (!Array.isArray(value)) return [...DEFAULT_SOCIAL_ITEMS];
  const items = value
    .map((item) => normalizeSocialItem(item))
    .filter((item): item is SocialItem => !!item);
  return items.length ? items : [...DEFAULT_SOCIAL_ITEMS];
}

export function normalizeSocialItem(value: unknown): SocialItem | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const name = normalizeSocialName(raw['name']);
  const href = normalizeHrefValue(raw['href']) || '#';
  const backgroundColor = normalizeColorValue(raw['backgroundColor']) || '#A1A0A0';
  return { name, href, backgroundColor };
}

export function normalizeSocialName(value: unknown): string {
  const cleaned = String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
  return cleaned || 'social';
}

export function socialAlign(value: unknown): 'left' | 'center' | 'right' {
  return safeAlign(typeof value === 'string' ? value : undefined);
}

export function socialMode(value: unknown): 'horizontal' | 'vertical' {
  return String(value ?? '').trim().toLowerCase() === 'vertical' ? 'vertical' : 'horizontal';
}

export function socialCssSize(value: unknown, fallback: string): string {
  return normalizeCssSizeValue(value) || fallback;
}

export function socialItemsForAttr(value: unknown): SocialItem[] {
  return parseSocialItems(value);
}

export function updateSocialItem(items: SocialItem[], index: number, key: keyof SocialItem, value: string): SocialItem[] {
  const next = normalizeSocialItems(items).map((item) => ({ ...item }));
  const current = next[index] || { name: 'social', href: '#', backgroundColor: '#A1A0A0' };
  current[key] = key === 'name'
    ? normalizeSocialName(value)
    : key === 'href'
      ? (normalizeHrefValue(value) || '#')
      : (normalizeColorValue(value) || String(value || '').trim() || '#A1A0A0');
  next[index] = current;
  return next;
}

export function socialIconLabel(name: string): string {
  const normalized = normalizeSocialName(name);
  if (normalized === 'facebook') return 'f';
  if (normalized === 'google') return 'G';
  if (normalized === 'twitter') return '𝕏';
  if (normalized === 'linkedin') return 'in';
  if (normalized === 'instagram') return '◎';
  if (normalized === 'youtube') return '▶';
  return normalized.slice(0, 2).toUpperCase();
}
