import { Extension } from '@tiptap/core';
import Link from '@tiptap/extension-link';
import { Table } from '@tiptap/extension-table';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableRow } from '@tiptap/extension-table-row';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import StarterKit from '@tiptap/starter-kit';

const FontSize = Extension.create({
  name: 'fontSize',
  addGlobalAttributes() {
    return [
      {
        types: ['textStyle'],
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element: HTMLElement) => element.style.fontSize || null,
            renderHTML: (attributes: Record<string, unknown>) => {
              const fontSize = typeof attributes['fontSize'] === 'string' ? attributes['fontSize'] : '';
              return fontSize ? { style: `font-size: ${fontSize}` } : {};
            },
          },
        },
      },
    ];
  },
});

const LineHeight = Extension.create({
  name: 'lineHeight',
  addGlobalAttributes() {
    return [
      {
        types: ['paragraph', 'heading'],
        attributes: {
          lineHeight: {
            default: null,
            parseHTML: (element: HTMLElement) => element.style.lineHeight || null,
            renderHTML: (attributes: Record<string, unknown>) => {
              const lineHeight = typeof attributes['lineHeight'] === 'string' ? attributes['lineHeight'] : '';
              return lineHeight ? { style: `line-height: ${lineHeight}` } : {};
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
  FontSize,
  LineHeight,
  Link.configure({ openOnClick: false, autolink: true, defaultProtocol: 'https' }),
  Table.configure({ resizable: true, cellMinWidth: 48 }),
  TableRow,
  StyledTableHeader,
  StyledTableCell,
  TextAlign.configure({ types: ['heading', 'paragraph'] }),
];
