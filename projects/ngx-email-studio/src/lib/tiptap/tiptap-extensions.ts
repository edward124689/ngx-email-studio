import { Extension } from '@tiptap/core';
import Link from '@tiptap/extension-link';
import { Table } from '@tiptap/extension-table';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableRow } from '@tiptap/extension-table-row';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import StarterKit from '@tiptap/starter-kit';

import { normalizeColorValue, normalizeCssSizeValue, normalizeFontFamilyValue, normalizeHtmlClassValue, normalizeHtmlIdValue, normalizeLineHeightValue } from '../export/export-utils';

function inlineTypographyStyle(attributes: Record<string, unknown>): string {
  const style: string[] = [];
  const fontSize = normalizeCssSizeValue(attributes['fontSize']);
  const color = normalizeColorValue(attributes['color']);
  const fontFamily = normalizeFontFamilyValue(attributes['fontFamily']);
  if (fontSize) style.push(`font-size: ${fontSize}`);
  if (color) style.push(`color: ${color}`);
  if (fontFamily) style.push(`font-family: ${fontFamily}`);
  return style.join('; ');
}

function blockTypographyStyle(attributes: Record<string, unknown>): string {
  const style: string[] = [];
  const lineHeight = normalizeLineHeightValue(attributes['lineHeight']);
  const fontSize = normalizeCssSizeValue(attributes['fontSize']);
  const color = normalizeColorValue(attributes['color']);
  const fontFamily = normalizeFontFamilyValue(attributes['fontFamily']);
  if (lineHeight) style.push(`line-height: ${lineHeight}`);
  if (fontSize) style.push(`font-size: ${fontSize}`);
  if (color) style.push(`color: ${color}`);
  if (fontFamily) style.push(`font-family: ${fontFamily}`);
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
        },
      },
    ];
  },
});

const HtmlIdentityAttributes = Extension.create({
  name: 'htmlIdentityAttributes',
  addGlobalAttributes() {
    return [
      {
        types: ['paragraph', 'heading', 'textStyle', 'bulletList', 'orderedList', 'listItem', 'link', 'table', 'tableRow', 'tableHeader', 'tableCell'],
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
  StarterKit.configure({ heading: { levels: [1, 2, 3, 4, 5, 6] }, link: false }),
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
