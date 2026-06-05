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

export const TIPTAP_EXTENSIONS = [
  StarterKit.configure({ heading: { levels: [1, 2, 3, 4, 5, 6] }, link: false }),
  TextStyle,
  FontSize,
  LineHeight,
  Link.configure({ openOnClick: false, autolink: true, defaultProtocol: 'https' }),
  Table.configure({ resizable: false }),
  TableRow,
  TableHeader,
  TableCell,
  TextAlign.configure({ types: ['heading', 'paragraph'] }),
];
