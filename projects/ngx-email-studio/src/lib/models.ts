export type EmailBlockType = 'row' | 'column' | 'section' | 'text' | 'image' | 'button' | 'social' | 'divider' | 'spacer';
export type PaletteBlockType = Exclude<EmailBlockType, 'column'>;
export type EmailPreviewSize = 'desktop' | 'tablet' | 'mobile' | number;
export type EmailSizeUnit = 'px' | '%';
export type CanvasMode = 'edit' | 'preview';
export type RichTextEditorMode = 'tiptap' | 'plain';
export type TiptapScope = 'inline' | 'modal';
export type TiptapHeadingValue = 'paragraph' | 'div' | '1' | '2' | '3' | '4' | '5' | '6';
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
  | 'image'
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

export interface EmailStudioResult {
  mjml: string;
  html: {
    html: string;
  };
}

export interface EmailStudioImageUploadContext {
  nodeId: string;
  currentUrl?: string;
  currentAlt?: string;
}

export interface EmailStudioImageUploadResult {
  url: string;
  alt?: string;
}

export type EmailStudioImageUploadHandler = (
  file: File,
  context: EmailStudioImageUploadContext,
) => Promise<string | EmailStudioImageUploadResult> | string | EmailStudioImageUploadResult;

export interface EmailStudioTemplateModule {
  /** Font Awesome 4.7 class (for example `fa-star`) or a safe image URL. */
  icon?: string;
  name: string;
  desc?: string;
  mjml: string;
}

export interface EmailStudioFontFamilyOption {
  /** Short display label shown in the font-family autocomplete. */
  label: string;
  /** Complete email-safe CSS font-family stack written to the document. */
  value: string;
}

export interface EmailStudioConfig {
  /** Rich text editor provider. Defaults to Tiptap; set to 'plain' for textarea-only editing. */
  richTextEditor?: RichTextEditorMode;
  showHtmlPreview?: boolean;
  /** Show the top-right Save button. Defaults to true. */
  showSave?: boolean;
  /** Optional host-provided image upload hook. Return an image URL to write back to the selected image block. */
  uploadImage?: EmailStudioImageUploadHandler;
  /** Host-provided draggable MJML templates shown in the Content modules palette. */
  templates?: EmailStudioTemplateModule[];
  /** Extra email font-family autocomplete options. Defaults stay available and valid custom stacks can still be typed. */
  fontFamilyOptions?: EmailStudioFontFamilyOption[];
  title?: string;
  breadcrumb?: string;
  brandLabel?: string;
  statusLabel?: string;
  fromLabel?: string;
}

export interface EmailStudioDataSetItem {
  key: string;
  desc?: string;
}

export type EmailStudioTransformAction = 'simplified-to-traditional' | 'traditional-to-simplified' | 'normalize-spaces';
export type EmailStudioTransformScope = 'document';

export interface EmailStudioTransformPreview {
  before: string;
  after: string;
  changedCount: number;
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
  templateMjml?: string;
  templateIconUrl?: string;
}
