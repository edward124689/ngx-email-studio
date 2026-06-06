import { EmailDocument, EmailNode } from '../models';
import { createColumn, createNode, createSectionWithChildren, defaultDocumentAttrs, EmailNodeIdFactory } from '../tree/block-factory';
import { elementChildren } from '../tree/node-utils';
import { sanitizeRichTextContent } from '../tiptap/rich-text-sanitizer';
import { safeAlign, normalizeColorValue, normalizeCssSizeValue, normalizeFontFamilyValue, normalizeFontWeightValue, normalizeHrefValue, normalizeImageSrcValue, normalizeLineHeightValue } from '../export/export-utils';
import { serializeSocialItems, socialCssSize, socialMode, SocialItem } from '../social/social-utils';

const SUPPORTED_MJML_TAGS = new Set(['mjml', 'mj-body', 'mj-wrapper', 'mj-section', 'mj-group', 'mj-column', 'mj-text', 'mj-image', 'mj-button', 'mj-divider', 'mj-spacer', 'mj-social', 'mj-social-element']);
const XML_SAFE_ENTITIES = new Set(['amp', 'lt', 'gt', 'quot', 'apos']);
const HTML_ENTITY_CODEPOINTS: Record<string, number> = {
  nbsp: 160,
  copy: 169,
  reg: 174,
  trade: 8482,
  ndash: 8211,
  mdash: 8212,
  lsquo: 8216,
  rsquo: 8217,
  ldquo: 8220,
  rdquo: 8221,
  bull: 8226,
  middot: 183,
  hellip: 8230,
  euro: 8364,
  pound: 163,
  yen: 165,
  cent: 162,
};

export function parseMjml(mjml: string, idFactory: EmailNodeIdFactory): EmailDocument {
  if (typeof DOMParser === 'undefined') {
    return { version: '0.0.1', body: [createNode(idFactory, 'text', { content: mjml })], unsupported: ['DOMParser unavailable'] };
  }
  const xml = new DOMParser().parseFromString(normalizeMjmlForXmlParser(mjml), 'text/xml');
  const parserError = xml.querySelector('parsererror');
  if (parserError) {
    throw new Error(parserError.textContent || 'Invalid MJML markup.');
  }
  const unsupported: string[] = [];
  const body = xml.getElementsByTagName('mj-body')[0] || xml.documentElement;
  const documentAttrs = defaultDocumentAttrs();
  const bodyBackgroundColor = importedColor(body.getAttribute('background-color'));
  if (bodyBackgroundColor) documentAttrs['backgroundColor'] = bodyBackgroundColor;
  if (body.getAttribute('width')) {
    const bodyWidth = body.getAttribute('width') || '640px';
    documentAttrs['width'] = Number.parseFloat(bodyWidth);
    documentAttrs['widthUnit'] = bodyWidth.trim().endsWith('%') ? '%' : 'px';
  }
  const nodes: EmailNode[] = [];

  elementChildren(body).forEach((element) => {
    nodes.push(...parseTopLevelMjmlElement(element, unsupported, idFactory));
  });

  Array.from(xml.getElementsByTagName('*')).forEach((element) => {
    const tag = element.tagName.toLowerCase();
    if (tag.startsWith('mj-') && !SUPPORTED_MJML_TAGS.has(tag) && !unsupported.includes(element.tagName)) unsupported.push(element.tagName);
  });

  return { version: '0.0.1', attrs: documentAttrs, body: nodes.length ? nodes : [createNode(idFactory, 'text')], unsupported };
}

function parseTopLevelMjmlElement(element: Element, unsupported: string[], idFactory: EmailNodeIdFactory, inheritedAttrs: Record<string, string | number | boolean> = {}): EmailNode[] {
  switch (element.tagName.toLowerCase()) {
    case 'mj-section': {
      const section = parseSection(element, unsupported, idFactory, inheritedAttrs);
      return section ? [section] : [];
    }
    case 'mj-wrapper':
      return elementChildren(element).flatMap((child) => parseTopLevelMjmlElement(child, unsupported, idFactory, { ...inheritedAttrs, ...importedContainerAttrs(element) }));
    default:
      if (element.tagName.startsWith('mj-') && !unsupported.includes(element.tagName)) unsupported.push(element.tagName);
      return [];
  }
}

function parseSection(section: Element, unsupported: string[], idFactory: EmailNodeIdFactory, inheritedAttrs: Record<string, string | number | boolean> = {}): EmailNode | undefined {
  const columns = elementChildren(section).flatMap((element) => sectionColumns(element, unsupported));
  if (columns.length === 0) return undefined;

  const parsedColumns = columns.map((column) => parseColumn(column.element, unsupported, idFactory, column.width)).filter((column): column is EmailNode => !!column);
  const sectionAttrs = { ...inheritedAttrs, ...importedContainerAttrs(section) };
  if (parsedColumns.length === 1) {
    const children = parsedColumns[0].children || [];
    return children.length ? createSectionWithChildren(idFactory, children, sectionAttrs) : undefined;
  }

  const row = createNode(idFactory, 'row', sectionAttrs);
  row.children = parsedColumns;
  return row;
}

function sectionColumns(element: Element, unsupported: string[]): Array<{ element: Element; width?: string }> {
  switch (element.tagName.toLowerCase()) {
    case 'mj-column':
      return [{ element }];
    case 'mj-group':
      return elementChildren(element)
        .filter((child) => child.tagName.toLowerCase() === 'mj-column')
        .map((child) => ({ element: child, width: effectiveGroupColumnWidth(element, child) }));
    default:
      if (element.tagName.startsWith('mj-') && !unsupported.includes(element.tagName)) unsupported.push(element.tagName);
      return [];
  }
}

function effectiveGroupColumnWidth(group: Element, column: Element): string | undefined {
  const groupWidth = percentWidth(group.getAttribute('width'));
  const columnWidth = percentWidth(column.getAttribute('width'));
  if (groupWidth !== undefined && columnWidth !== undefined) return `${roundWidth((groupWidth * columnWidth) / 100)}%`;
  if (groupWidth !== undefined && !column.getAttribute('width')) {
    const columns = elementChildren(group).filter((child) => child.tagName.toLowerCase() === 'mj-column').length || 1;
    return `${roundWidth(groupWidth / columns)}%`;
  }
  return undefined;
}

function percentWidth(value: string | null): number | undefined {
  const raw = String(value || '').trim();
  if (!raw.endsWith('%')) return undefined;
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function roundWidth(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function normalizeMjmlForXmlParser(mjml: string): string {
  return mjml.replace(/&([a-zA-Z][a-zA-Z0-9]+);/g, (match, entity: string) => {
    const name = entity.toLowerCase();
    if (XML_SAFE_ENTITIES.has(name)) return match;
    const codepoint = HTML_ENTITY_CODEPOINTS[name];
    return codepoint ? `&#${codepoint};` : `&amp;${entity};`;
  });
}

function parseColumn(column: Element, unsupported: string[], idFactory: EmailNodeIdFactory, widthOverride?: string): EmailNode | undefined {
  const children = elementChildren(column)
    .map((element) => parseMjmlBlock(element, unsupported, idFactory))
    .filter((node): node is EmailNode => !!node);

  return createColumn(idFactory, children, widthOverride || column.getAttribute('width') || '50%', {
    ...importedContainerAttrs(column),
  });
}

function importedContainerAttrs(element: Element): Record<string, string | number | boolean> {
  return {
    ...importedBackgroundColorAttrs(element),
    ...importedPaddingAttrs(element),
  };
}

function importedBackgroundColorAttrs(element: Element): { backgroundColor?: string } {
  const color = importedColor(element.getAttribute('background-color'));
  return color ? { backgroundColor: color } : {};
}

function importedColor(value: string | null): string {
  return normalizeColorValue(value);
}

function parseButtonBorderRadius(value: string | null): number {
  const parsed = Number.parseFloat(String(value || '10').replace(/px$/i, ''));
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 10;
}

function importedDimensionAttrs(value: string | null, key: string): Record<string, string | number | boolean> {
  const raw = String(value || '').trim();
  if (!raw) return {};
  const parsed = Number.parseFloat(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return {};
  return { [key]: parsed, [`${key}Unit`]: raw.endsWith('%') ? '%' : 'px' };
}

function importedPaddingAttrs(element: Element): Record<string, string | number | boolean> {
  const shorthand = parsePaddingParts(element.getAttribute('padding'));
  const unit = shorthand.unit || paddingUnitFromValue(element.getAttribute('padding-top')) || paddingUnitFromValue(element.getAttribute('padding-right')) || paddingUnitFromValue(element.getAttribute('padding-bottom')) || paddingUnitFromValue(element.getAttribute('padding-left')) || 'px';
  const attrs: Record<string, string | number | boolean> = {};
  if (shorthand.parts.length) {
    const [top, right, bottom, left] = expandPaddingParts(shorthand.parts);
    attrs['paddingTop'] = top;
    attrs['paddingRight'] = right;
    attrs['paddingBottom'] = bottom;
    attrs['paddingLeft'] = left;
    attrs['paddingUnit'] = unit;
  }
  (['top', 'right', 'bottom', 'left'] as const).forEach((side) => {
    const value = parseDimensionPart(element.getAttribute(`padding-${side}`));
    if (!value) return;
    attrs[`padding${side[0].toUpperCase()}${side.slice(1)}`] = value.value;
    attrs['paddingUnit'] = value.unit;
  });
  return attrs;
}

function parsePaddingParts(value: string | null): { parts: number[]; unit: '%' | 'px' | '' } {
  const raw = String(value || '').trim();
  if (!raw) return { parts: [], unit: '' };
  const values = raw.split(/\s+/).map((part) => parseDimensionPart(part)).filter((part): part is { value: number; unit: '%' | 'px' } => !!part);
  if (!values.length) return { parts: [], unit: '' };
  return { parts: values.map((part) => part.value), unit: values.some((part) => part.unit === '%') ? '%' : 'px' };
}

function expandPaddingParts(parts: number[]): [number, number, number, number] {
  const [top = 0, right = top, bottom = top, left = right] = parts;
  return [top, right, bottom, left];
}

function parseDimensionPart(value: string | null): { value: number; unit: '%' | 'px' } | undefined {
  const raw = String(value || '').trim();
  if (!raw) return undefined;
  const parsed = Number.parseFloat(raw);
  if (!Number.isFinite(parsed) || parsed < 0) return undefined;
  return { value: parsed, unit: raw.endsWith('%') ? '%' : 'px' };
}

function paddingUnitFromValue(value: string | null): '%' | 'px' | '' {
  const raw = String(value || '').trim();
  if (!raw) return '';
  return raw.endsWith('%') ? '%' : 'px';
}

function importedTextStyleAttrs(element: Element): Record<string, string> {
  const color = normalizeColorValue(element.getAttribute('color'));
  const fontFamily = normalizeFontFamilyValue(element.getAttribute('font-family'));
  const fontWeight = normalizeFontWeightValue(element.getAttribute('font-weight'));
  const fontSize = normalizeCssSizeValue(element.getAttribute('font-size'));
  const lineHeight = normalizeLineHeightValue(element.getAttribute('line-height'));
  return {
    ...(color ? { color } : {}),
    ...(fontFamily ? { fontFamily } : {}),
    ...(fontWeight ? { fontWeight } : {}),
    ...(fontSize ? { fontSize } : {}),
    ...(lineHeight ? { lineHeight } : {}),
  };
}

function importedButtonColor(element: Element): string {
  const direct = importedColor(element.getAttribute('color'));
  if (direct) return direct;
  const styledChild = Array.from(element.querySelectorAll('[style]')).find((child) => /(^|;)\s*color\s*:/i.test(child.getAttribute('style') || ''));
  const match = styledChild?.getAttribute('style')?.match(/(^|;)\s*color\s*:\s*([^;]+)/i);
  return importedColor(match?.[2] || '') || '#ffffff';
}

function parseMjmlBlock(element: Element, unsupported: string[], idFactory: EmailNodeIdFactory): EmailNode | undefined {
  switch (element.tagName.toLowerCase()) {
    case 'mj-text':
      return createNode(idFactory, 'text', { content: sanitizeRichTextContent(element.innerHTML || element.textContent || '<p></p>'), align: safeAlign(element.getAttribute('align')), ...importedTextStyleAttrs(element), ...importedPaddingAttrs(element) });
    case 'mj-image':
      return createNode(idFactory, 'image', {
        src: normalizeImageSrcValue(element.getAttribute('src')),
        alt: element.getAttribute('alt') || '',
        align: safeAlign(element.getAttribute('align')),
        ...importedPaddingAttrs(element),
        ...importedDimensionAttrs(element.getAttribute('width'), 'width'),
      });
    case 'mj-button':
      return createNode(idFactory, 'button', {
        label: element.textContent || 'Button',
        href: normalizeHrefValue(element.getAttribute('href')) || '#',
        backgroundColor: importedColor(element.getAttribute('background-color')) || '#7c3aed',
        color: importedButtonColor(element),
        borderRadius: parseButtonBorderRadius(element.getAttribute('border-radius')),
        align: element.hasAttribute('align') ? safeAlign(element.getAttribute('align')) : 'center',
        ...importedPaddingAttrs(element),
      });
    case 'mj-divider':
      return createNode(idFactory, 'divider', { borderColor: importedColor(element.getAttribute('border-color')) || '#d0d5dd' });
    case 'mj-spacer':
      return createNode(idFactory, 'spacer', { height: Number.parseInt(element.getAttribute('height') || '24', 10) });
    case 'mj-social':
      return parseSocialBlock(element, unsupported, idFactory);
    default:
      if (element.tagName.startsWith('mj-') && !unsupported.includes(element.tagName)) unsupported.push(element.tagName);
      return undefined;
  }
}

function parseSocialBlock(element: Element, unsupported: string[], idFactory: EmailNodeIdFactory): EmailNode | undefined {
  const children = elementChildren(element);
  children.forEach((child) => {
    if (child.tagName.toLowerCase() !== 'mj-social-element' && child.tagName.startsWith('mj-') && !unsupported.includes(child.tagName)) unsupported.push(child.tagName);
  });
  const items: SocialItem[] = children
    .filter((child) => child.tagName.toLowerCase() === 'mj-social-element')
    .map((child) => {
      const name = child.getAttribute('name') || child.textContent?.trim() || 'social';
      const href = normalizeHrefValue(child.getAttribute('href')) || '#';
      const backgroundColor = importedColor(child.getAttribute('background-color')) || importedColor(element.getAttribute('background-color')) || '#A1A0A0';
      return { name, href, backgroundColor };
    });
  if (!items.length) return undefined;
  const containerBackground = importedColor(element.getAttribute('container-background-color'));
  return createNode(idFactory, 'social', {
    items: serializeSocialItems(items),
    align: element.hasAttribute('align') ? safeAlign(element.getAttribute('align')) : 'center',
    ...(containerBackground ? { backgroundColor: containerBackground } : {}),
    mode: socialMode(element.getAttribute('mode')),
    iconSize: socialCssSize(element.getAttribute('icon-size'), '30px'),
    fontSize: socialCssSize(element.getAttribute('font-size'), '15px'),
    ...importedPaddingAttrs(element),
  });
}
