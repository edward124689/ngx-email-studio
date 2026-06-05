import { TiptapHeadingValue } from '../models';

export const TIPTAP_BLOCK_OPTIONS: Array<{ label: string; value: TiptapHeadingValue }> = [
  { label: 'Paragraph', value: 'paragraph' },
  { label: 'H1', value: '1' },
  { label: 'H2', value: '2' },
  { label: 'H3', value: '3' },
  { label: 'H4', value: '4' },
  { label: 'H5', value: '5' },
  { label: 'H6', value: '6' },
];

export const TIPTAP_FONT_SIZE_OPTIONS = Array.from({ length: 61 }, (_, index) => `${index + 12}px`);
export const TIPTAP_LINE_HEIGHT_OPTIONS = ['1', '1.15', '1.3', '1.5', '1.75', '2'] as const;
