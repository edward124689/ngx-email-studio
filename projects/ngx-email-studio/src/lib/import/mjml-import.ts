import { EmailDocument, EmailNode } from '../models';
import { createColumn, createNode, createSectionWithChildren, defaultDocumentAttrs, EmailNodeIdFactory } from '../tree/block-factory';
import { elementChildren } from '../tree/node-utils';
import { sanitizeRichTextContent } from '../tiptap/rich-text-sanitizer';
import { safeAlign, normalizeColorValue } from '../export/export-utils';

const SUPPORTED_MJML_TAGS = new Set(['mjml', 'mj-body', 'mj-section', 'mj-column', 'mj-text', 'mj-image', 'mj-button', 'mj-divider', 'mj-spacer']);

export function parseMjml(mjml: string, idFactory: EmailNodeIdFactory): EmailDocument {
  if (typeof DOMParser === 'undefined') {
    return { version: '0.0.1', body: [createNode(idFactory, 'text', { content: mjml })], unsupported: ['DOMParser unavailable'] };
  }
  const xml = new DOMParser().parseFromString(mjml, 'text/xml');
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

  elementChildren(body)
    .filter((element) => element.tagName.toLowerCase() === 'mj-section')
    .forEach((section) => {
      const columns = elementChildren(section).filter((element) => element.tagName.toLowerCase() === 'mj-column');
      if (columns.length === 0) return;

      const parsedColumns = columns.map((column) => parseColumn(column, unsupported, idFactory)).filter((column): column is EmailNode => !!column);
      if (parsedColumns.length === 1 && (parsedColumns[0].children?.length || 0) === 1) {
        const onlyChild = parsedColumns[0].children?.[0];
        if (onlyChild) {
          nodes.push(
            createSectionWithChildren(idFactory, [onlyChild], {
              ...importedBackgroundColorAttrs(section),
            }),
          );
        }
      } else {
        const row = createNode(idFactory, 'row', {
          ...importedBackgroundColorAttrs(section),
        });
        row.children = parsedColumns;
        nodes.push(row);
      }
    });

  Array.from(xml.getElementsByTagName('*')).forEach((element) => {
    const tag = element.tagName.toLowerCase();
    if (tag.startsWith('mj-') && !SUPPORTED_MJML_TAGS.has(tag) && !unsupported.includes(element.tagName)) unsupported.push(element.tagName);
  });

  return { version: '0.0.1', attrs: documentAttrs, body: nodes.length ? nodes : [createNode(idFactory, 'text')], unsupported };
}

function parseColumn(column: Element, unsupported: string[], idFactory: EmailNodeIdFactory): EmailNode | undefined {
  const children = elementChildren(column)
    .map((element) => parseMjmlBlock(element, unsupported, idFactory))
    .filter((node): node is EmailNode => !!node);

  return createColumn(idFactory, children, column.getAttribute('width') || '50%', {
    ...importedBackgroundColorAttrs(column),
  });
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

function parseMjmlBlock(element: Element, unsupported: string[], idFactory: EmailNodeIdFactory): EmailNode | undefined {
  switch (element.tagName.toLowerCase()) {
    case 'mj-text':
      return createNode(idFactory, 'text', { content: sanitizeRichTextContent(element.innerHTML || element.textContent || '<p></p>'), align: safeAlign(element.getAttribute('align')) });
    case 'mj-image':
      return createNode(idFactory, 'image', {
        src: element.getAttribute('src') || '',
        alt: element.getAttribute('alt') || '',
        align: safeAlign(element.getAttribute('align')),
        ...importedDimensionAttrs(element.getAttribute('width'), 'width'),
      });
    case 'mj-button':
      return createNode(idFactory, 'button', {
        label: element.textContent || 'Button',
        href: element.getAttribute('href') || '#',
        backgroundColor: importedColor(element.getAttribute('background-color')) || '#7c3aed',
        borderRadius: parseButtonBorderRadius(element.getAttribute('border-radius')),
        align: safeAlign(element.getAttribute('align')),
      });
    case 'mj-divider':
      return createNode(idFactory, 'divider', { borderColor: element.getAttribute('border-color') || '#d0d5dd' });
    case 'mj-spacer':
      return createNode(idFactory, 'spacer', { height: Number.parseInt(element.getAttribute('height') || '24', 10) });
    default:
      if (element.tagName.startsWith('mj-') && !unsupported.includes(element.tagName)) unsupported.push(element.tagName);
      return undefined;
  }
}
