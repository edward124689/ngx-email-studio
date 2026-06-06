import { Extension, Node } from '@tiptap/core';
import Link from '@tiptap/extension-link';
import { Table } from '@tiptap/extension-table';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableRow } from '@tiptap/extension-table-row';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import StarterKit from '@tiptap/starter-kit';

import { normalizeColorValue, normalizeCssSizeValue, normalizeFontFamilyValue, normalizeFontWeightValue, normalizeHtmlClassValue, normalizeHtmlIdValue, normalizeLineHeightValue } from '../export/export-utils';

function inlineTypographyStyle(attributes: Record<string, unknown>): string {
  const style: string[] = [];
  const fontSize = normalizeCssSizeValue(attributes['fontSize']);
  const color = normalizeColorValue(attributes['color']);
  const fontFamily = normalizeFontFamilyValue(attributes['fontFamily']);
  const fontWeight = normalizeFontWeightValue(attributes['fontWeight']);
  const backgroundColor = normalizeColorValue(attributes['backgroundColor']);
  if (fontSize) style.push(`font-size: ${fontSize}`);
  if (color) style.push(`color: ${color}`);
  if (fontFamily) style.push(`font-family: ${fontFamily}`);
  if (fontWeight) style.push(`font-weight: ${fontWeight}`);
  if (backgroundColor) style.push(`background-color: ${backgroundColor}`);
  return style.join('; ');
}

function normalizeBlockSpacingValue(value: unknown): string {
  const raw = String(value ?? '').trim();
  const parts = raw.split(/\s+/).filter(Boolean);
  if (parts.length < 1 || parts.length > 4) return '';
  return parts.every((part) => part === '0' || /^-?([1-9]|[1-9][0-9])px$/.test(part) || part === 'auto') ? raw : '';
}

function blockTypographyStyle(attributes: Record<string, unknown>): string {
  const style: string[] = [];
  const lineHeight = normalizeLineHeightValue(attributes['lineHeight']);
  const fontSize = normalizeCssSizeValue(attributes['fontSize']);
  const color = normalizeColorValue(attributes['color']);
  const fontFamily = normalizeFontFamilyValue(attributes['fontFamily']);
  const fontWeight = normalizeFontWeightValue(attributes['fontWeight']);
  const backgroundColor = normalizeColorValue(attributes['backgroundColor']);
  const margin = normalizeBlockSpacingValue(attributes['margin']);
  const marginTop = normalizeBlockSpacingValue(attributes['marginTop']);
  const marginRight = normalizeBlockSpacingValue(attributes['marginRight']);
  const marginBottom = normalizeBlockSpacingValue(attributes['marginBottom']);
  const marginLeft = normalizeBlockSpacingValue(attributes['marginLeft']);
  if (lineHeight) style.push(`line-height: ${lineHeight}`);
  if (fontSize) style.push(`font-size: ${fontSize}`);
  if (color) style.push(`color: ${color}`);
  if (fontFamily) style.push(`font-family: ${fontFamily}`);
  if (fontWeight) style.push(`font-weight: ${fontWeight}`);
  if (backgroundColor) style.push(`background-color: ${backgroundColor}`);
  if (margin) style.push(`margin: ${margin}`);
  if (marginTop) style.push(`margin-top: ${marginTop}`);
  if (marginRight) style.push(`margin-right: ${marginRight}`);
  if (marginBottom) style.push(`margin-bottom: ${marginBottom}`);
  if (marginLeft) style.push(`margin-left: ${marginLeft}`);
  return style.join('; ');
}

const InlineTypography = Extension.create({
  name: 'inlineTypography',
  addGlobalAttributes() {
    return [
      {
        types: ['textStyle'],
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element: HTMLElement) => normalizeCssSizeValue(element.style.fontSize) || null,
            renderHTML: (attributes: Record<string, unknown>) => {
              const style = inlineTypographyStyle(attributes);
              return style ? { style } : {};
            },
          },
          color: {
            default: null,
            parseHTML: (element: HTMLElement) => normalizeColorValue(element.style.color) || null,
            renderHTML: () => ({}),
          },
          fontFamily: {
            default: null,
            parseHTML: (element: HTMLElement) => normalizeFontFamilyValue(element.style.fontFamily) || null,
            renderHTML: () => ({}),
          },
          fontWeight: {
            default: null,
            parseHTML: (element: HTMLElement) => normalizeFontWeightValue(element.style.fontWeight) || null,
            renderHTML: () => ({}),
          },
          backgroundColor: {
            default: null,
            parseHTML: (element: HTMLElement) => normalizeColorValue(element.style.backgroundColor) || null,
            renderHTML: () => ({}),
          },
        },
      },
    ];
  },
});

const BlockTypography = Extension.create({
  name: 'blockTypography',
  addGlobalAttributes() {
    return [
      {
        types: ['paragraph', 'heading'],
        attributes: {
          lineHeight: {
            default: null,
            parseHTML: (element: HTMLElement) => normalizeLineHeightValue(element.style.lineHeight) || null,
            renderHTML: (attributes: Record<string, unknown>) => {
              const style = blockTypographyStyle(attributes);
              return style ? { style } : {};
            },
          },
          fontSize: {
            default: null,
            parseHTML: (element: HTMLElement) => normalizeCssSizeValue(element.style.fontSize) || null,
            renderHTML: () => ({}),
          },
          color: {
            default: null,
            parseHTML: (element: HTMLElement) => normalizeColorValue(element.style.color) || null,
            renderHTML: () => ({}),
          },
          fontFamily: {
            default: null,
            parseHTML: (element: HTMLElement) => normalizeFontFamilyValue(element.style.fontFamily) || null,
            renderHTML: () => ({}),
          },
          fontWeight: {
            default: null,
            parseHTML: (element: HTMLElement) => normalizeFontWeightValue(element.style.fontWeight) || null,
            renderHTML: () => ({}),
          },
          backgroundColor: {
            default: null,
            parseHTML: (element: HTMLElement) => normalizeColorValue(element.style.backgroundColor) || null,
            renderHTML: () => ({}),
          },
          margin: {
            default: null,
            parseHTML: (element: HTMLElement) => normalizeBlockSpacingValue(element.style.margin) || null,
            renderHTML: () => ({}),
          },
          marginTop: {
            default: null,
            parseHTML: (element: HTMLElement) => normalizeBlockSpacingValue(element.style.marginTop) || null,
            renderHTML: () => ({}),
          },
          marginRight: {
            default: null,
            parseHTML: (element: HTMLElement) => normalizeBlockSpacingValue(element.style.marginRight) || null,
            renderHTML: () => ({}),
          },
          marginBottom: {
            default: null,
            parseHTML: (element: HTMLElement) => normalizeBlockSpacingValue(element.style.marginBottom) || null,
            renderHTML: () => ({}),
          },
          marginLeft: {
            default: null,
            parseHTML: (element: HTMLElement) => normalizeBlockSpacingValue(element.style.marginLeft) || null,
            renderHTML: () => ({}),
          },
        },
      },
    ];
  },
});

const RichParagraph = Node.create({
  name: 'paragraph',
  priority: 1000,
  group: 'block',
  content: 'inline*',
  addAttributes() {
    return {
      blockTag: {
        default: 'p',
        rendered: false,
        parseHTML: (element: HTMLElement) => element.tagName === 'DIV' ? 'div' : 'p',
      },
    };
  },
  parseHTML() {
    return [
      { tag: 'div', priority: 1000, getAttrs: (element) => element instanceof HTMLElement && !hasBlockChildren(element) ? { blockTag: 'div' } : false },
      { tag: 'p', priority: 1000, getAttrs: () => ({ blockTag: 'p' }) },
    ];
  },
  renderHTML({ node, HTMLAttributes }) {
    return [node.attrs['blockTag'] === 'div' ? 'div' : 'p', HTMLAttributes, 0];
  },
  addCommands() {
    return {
      setParagraph: () => ({ commands }) => commands.setNode(this.name, { blockTag: 'p' }),
    };
  },
});

function hasBlockChildren(element: HTMLElement): boolean {
  return Array.from(element.children).some((child) => isRichTextBlockTag(child.tagName));
}

function isRichTextBlockTag(tagName: string): boolean {
  return tagName === 'P' || tagName === 'DIV' || /^H[1-6]$/.test(tagName) || tagName === 'UL' || tagName === 'OL' || tagName === 'TABLE';
}

const HtmlIdentityAttributes = Extension.create({
  name: 'htmlIdentityAttributes',
  addGlobalAttributes() {
    return [
      {
        types: ['paragraph', 'heading', 'textStyle', 'bold', 'italic', 'underline', 'strike', 'bulletList', 'orderedList', 'listItem', 'link', 'table', 'tableRow', 'tableHeader', 'tableCell'],
        attributes: {
          htmlId: {
            default: null,
            parseHTML: (element: HTMLElement) => normalizeHtmlIdValue(element.getAttribute('id')) || null,
            renderHTML: (attributes: Record<string, unknown>) => {
              const id = normalizeHtmlIdValue(attributes['htmlId']);
              return id ? { id } : {};
            },
          },
          htmlClass: {
            default: null,
            parseHTML: (element: HTMLElement) => normalizeHtmlClassValue(element.getAttribute('class')) || null,
            renderHTML: (attributes: Record<string, unknown>) => {
              const className = normalizeHtmlClassValue(attributes['htmlClass']);
              return className ? { class: className } : {};
            },
          },
        },
      },
    ];
  },
});

function tableCellStyle(attributes: Record<string, unknown>): string {
  const style: string[] = [];
  for (const property of ['backgroundColor', 'borderColor', 'borderWidth', 'borderStyle', 'width', 'height', 'padding']) {
    const value = typeof attributes[property] === 'string' ? attributes[property] : '';
    if (!value) continue;
    const cssProperty = property.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
    style.push(`${cssProperty}: ${value}`);
  }
  return style.join('; ');
}

function tableCellAttributes() {
  return {
    backgroundColor: {
      default: null,
      parseHTML: (element: HTMLElement) => element.style.backgroundColor || null,
    },
    borderColor: {
      default: null,
      parseHTML: (element: HTMLElement) => element.style.borderColor || null,
    },
    borderWidth: {
      default: null,
      parseHTML: (element: HTMLElement) => element.style.borderWidth || null,
    },
    borderStyle: {
      default: null,
      parseHTML: (element: HTMLElement) => element.style.borderStyle || null,
    },
    width: {
      default: null,
      parseHTML: (element: HTMLElement) => element.style.width || element.getAttribute('width') || null,
    },
    height: {
      default: null,
      parseHTML: (element: HTMLElement) => element.style.height || element.getAttribute('height') || null,
    },
    padding: {
      default: null,
      parseHTML: (element: HTMLElement) => element.style.padding || null,
    },
  };
}

const StyledTableCell = TableCell.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      ...tableCellAttributes(),
    };
  },
  renderHTML({ HTMLAttributes }) {
    const style = tableCellStyle(HTMLAttributes);
    return ['td', { ...HTMLAttributes, ...(style ? { style } : {}) }, 0];
  },
});

const StyledTableHeader = TableHeader.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      ...tableCellAttributes(),
    };
  },
  renderHTML({ HTMLAttributes }) {
    const style = tableCellStyle(HTMLAttributes);
    return ['th', { ...HTMLAttributes, ...(style ? { style } : {}) }, 0];
  },
});

export const TIPTAP_EXTENSIONS = [
  StarterKit.configure({ heading: { levels: [1, 2, 3, 4, 5, 6] }, link: false, paragraph: false }),
  RichParagraph,
  TextStyle,
  InlineTypography,
  BlockTypography,
  HtmlIdentityAttributes,
  Link.configure({ openOnClick: false, autolink: true, defaultProtocol: 'https' }),
  Table.configure({ resizable: true, cellMinWidth: 48 }),
  TableRow,
  StyledTableHeader,
  StyledTableCell,
  TextAlign.configure({ types: ['heading', 'paragraph'] }),
];
