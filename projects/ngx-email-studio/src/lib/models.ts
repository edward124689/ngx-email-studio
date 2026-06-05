export type EmailBlockType = 'row' | 'column' | 'section' | 'text' | 'image' | 'button' | 'divider' | 'spacer';
export type PaletteBlockType = Exclude<EmailBlockType, 'column'>;
export type EmailPreviewSize = 'desktop' | 'tablet' | 'mobile' | number;
export type EmailSizeUnit = 'px' | '%';
export type CanvasMode = 'edit' | 'preview';
export type RichTextEditorMode = 'tiptap' | 'plain';
export type TiptapScope = 'inline' | 'modal';
export type TiptapHeadingValue = 'paragraph' | '1' | '2' | '3' | '4' | '5' | '6';
export type TiptapTextAlignValue = 'left' | 'center' | 'right' | 'justify';
export type TiptapCommand =
  | 'bold'
  | 'italic'
  | 'underline'
  | 'strike'
  | 'clearFormatting'
  | 'bulletList'
  | 'orderedList'
  | 'sinkListItem'
  | 'liftListItem'
  | 'link'
  | 'unlink'
  | 'undo'
  | 'redo'
  | 'insertTable'
  | 'addColumnAfter'
  | 'addRowAfter'
  | 'deleteColumn'
  | 'deleteRow'
  | 'deleteTable'
  | 'mergeCells'
  | 'splitCell'
  | 'toggleHeaderRow'
  | 'toggleHeaderColumn'
  | 'toggleHeaderCell';

export interface EmailStudioConfig {
  /** Rich text editor provider. Defaults to Tiptap; set to 'plain' for textarea-only editing. */
  richTextEditor?: RichTextEditorMode;
  showHtmlPreview?: boolean;
  title?: string;
  breadcrumb?: string;
  brandLabel?: string;
  statusLabel?: string;
  fromLabel?: string;
}

export interface EmailStudioError {
  code: string;
  message: string;
  details?: unknown;
}

export interface EmailNode {
  id: string;
  type: EmailBlockType;
  attrs: Record<string, string | number | boolean>;
  children?: EmailNode[];
}

export interface EmailDocument {
  version: string;
  attrs?: Record<string, string | number | boolean>;
  body: EmailNode[];
  unsupported?: string[];
}

export interface PaletteItem {
  type: PaletteBlockType;
  label: string;
  icon: string;
  description: string;
  preset?: 'hero' | 'footer';
}
