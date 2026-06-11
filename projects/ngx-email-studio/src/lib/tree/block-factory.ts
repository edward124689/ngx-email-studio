import { EmailBlockType, EmailDocument, EmailNode } from '../models';
import { serializeSocialItems, DEFAULT_SOCIAL_ITEMS } from '../social/social-utils';

export type EmailNodeIdFactory = (type: string) => string;

export function defaultDocumentAttrs(): Record<string, string | number | boolean> {
  return {
    backgroundColor: '#ffffff',
    width: 100,
    widthUnit: '%',
    maxWidth: 600,
    maxWidthUnit: 'px',
    contentBorderRadius: 16,
    contentBorderWidth: 0,
    contentBorderColor: '#d9e2ec',
    contentFontSize: 13,
    contentFontFamily: 'Ubuntu, Helvetica, Arial, sans-serif',
    contentFontCssUrl: 'https://fonts.googleapis.com/css?family=Ubuntu:300,400,500,700',
  };
}

export function createNode(idFactory: EmailNodeIdFactory, type: EmailBlockType, attrs: Record<string, string | number | boolean> = {}): EmailNode {
  const defaults: Record<EmailBlockType, Record<string, string | number | boolean>> = {
    row: {},
    column: { width: 100, widthUnit: '%', maxWidth: 600, maxWidthUnit: 'px' },
    section: { width: 100, widthUnit: '%', maxWidth: 600, maxWidthUnit: 'px', padding: 16, paddingTop: 16, paddingRight: 16, paddingBottom: 16, paddingLeft: 16, paddingUnit: 'px' },
    text: { content: '<p>New text block</p>' },
    image: { src: 'https://placehold.co/640x260?text=Email+Image', alt: 'Email image' },
    button: { label: 'Button', href: '#', backgroundColor: '#7c3aed', borderRadius: 10 },
    social: { items: serializeSocialItems(DEFAULT_SOCIAL_ITEMS), iconSize: '30px', fontSize: '15px', mode: 'horizontal', align: 'center', padding: 0, paddingUnit: 'px' },
    divider: { borderColor: '#d0d5dd' },
    spacer: { height: 24 },
  };

  if (type === 'row') {
    return {
      id: idFactory(type),
      type,
      attrs: { ...defaults[type], ...attrs },
      children: [
        createColumn(idFactory, [createNode(idFactory, 'text', { content: '<p><strong>Left column</strong><br>Describe your offer.</p>' })], '50%'),
        createColumn(idFactory, [createNode(idFactory, 'button', { label: 'Shop now', href: '#' })], '50%'),
      ],
    };
  }

  if (type === 'section') {
    return {
      id: idFactory(type),
      type,
      attrs: { ...defaults[type], ...attrs },
      children: [createNode(idFactory, 'text', { content: '<p>Drop blocks into this section.</p>' })],
    };
  }

  return { id: idFactory(type), type, attrs: { ...defaults[type], ...attrs } };
}

export function createColumn(idFactory: EmailNodeIdFactory, children: EmailNode[] = [], width = '100%', attrs: Record<string, string | number | boolean> = {}): EmailNode {
  return {
    id: idFactory('column'),
    type: 'column',
    attrs: { width, widthUnit: String(width).trim().endsWith('%') ? '%' : 'px', maxWidth: 600, maxWidthUnit: 'px', ...attrs },
    children,
  };
}

export function createSectionWithChildren(idFactory: EmailNodeIdFactory, children: EmailNode[], attrs: Record<string, string | number | boolean> = {}): EmailNode {
  const section = createNode(idFactory, 'section', attrs);
  section.children = children;
  return section;
}

export function createStarterDocument(idFactory: EmailNodeIdFactory): EmailDocument {
  return {
    version: '0.0.1',
    attrs: defaultDocumentAttrs(),
    body: [
      createSectionWithChildren(idFactory, [createNode(idFactory, 'text', { content: '<h1>Welcome to ngx-email-studio</h1><p>Drag, edit, preview, and export MJML from Angular.</p>' })]),
      createNode(idFactory, 'row', {
        backgroundColor: '#f8fafc',
      }),
      createSectionWithChildren(idFactory, [createNode(idFactory, 'button', { label: 'Get started', href: 'https://www.npmjs.com/package/ngx-email-studio' })]),
    ],
  };
}
