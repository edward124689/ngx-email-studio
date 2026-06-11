import { EmailStudioConfig, EmailStudioFontFamilyOption } from './models';

export const DEFAULT_EMAIL_FONT_FAMILY_OPTIONS: EmailStudioFontFamilyOption[] = [
  { label: 'Ubuntu', value: 'Ubuntu, Helvetica, Arial, sans-serif' },
  { label: 'Arial', value: 'Arial, Helvetica, sans-serif' },
  { label: 'Helvetica', value: 'Helvetica, Arial, sans-serif' },
  { label: 'Segoe UI', value: '"Segoe UI", Arial, sans-serif' },
  { label: 'Georgia', value: 'Georgia, "Times New Roman", serif' },
  { label: 'Times New Roman', value: '"Times New Roman", Times, serif' },
  { label: 'Verdana', value: 'Verdana, Geneva, sans-serif' },
  { label: 'Trebuchet MS', value: '"Trebuchet MS", Arial, sans-serif' },
  { label: 'Courier New', value: '"Courier New", Courier, monospace' },
  { label: 'System Sans', value: '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif' },
];

export const DEFAULT_EMAIL_STUDIO_CONFIG: EmailStudioConfig = {
  richTextEditor: 'tiptap',
  showHtmlPreview: true,
  showSave: true,
};
