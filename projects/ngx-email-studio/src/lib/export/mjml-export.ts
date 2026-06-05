import { EmailDocument, EmailNode } from '../models';
import { createColumn, createNode, defaultDocumentAttrs, EmailNodeIdFactory } from '../tree/block-factory';
import { sanitizeRichTextContent } from '../tiptap/rich-text-sanitizer';
import { columnWidthCss, contentAlign, dimensionCss, escapeAttr, escapeHtml, isAlignableContent, sectionPaddingCss } from './export-utils';

export function compileMjml(document: EmailDocument, idFactory: EmailNodeIdFactory): string {
  const body = document.body.map((node) => nodeToMjml(node, idFactory)).join('\n');
  return `<mjml>\n  <mj-body${bodyMjmlAttrs(document)}>\n${body}\n  </mj-body>\n</mjml>`;
}

function nodeToMjml(node: EmailNode, idFactory: EmailNodeIdFactory): string {
  if (node.type === 'row') return rowToMjml(node, idFactory);
  if (node.type === 'column') return columnToMjml(node, idFactory);
  if (node.type === 'section') return sectionToMjml(node, idFactory);
  return `    <mj-section${backgroundAttr(node)}><mj-column>${blockToMjml(node, idFactory)}</mj-column></mj-section>`;
}

function rowToMjml(row: EmailNode, idFactory: EmailNodeIdFactory): string {
  const columns = (row.children || []).filter((child) => child.type === 'column');
  const columnMarkup = columns.length
    ? columns.map((column) => columnToMjml(column, idFactory)).join('')
    : columnToMjml(createColumn(idFactory, [createNode(idFactory, 'text')]), idFactory);
  return `    <mj-section${backgroundAttr(row)}>${columnMarkup}</mj-section>`;
}

function sectionToMjml(section: EmailNode, idFactory: EmailNodeIdFactory): string {
  const children = (section.children || []).map((child) => blockToMjml(child, idFactory)).join('');
  return `    <mj-section${sectionMjmlAttrs(section)}><mj-column>${children || '<mj-text></mj-text>'}</mj-column></mj-section>`;
}

function columnToMjml(column: EmailNode, idFactory: EmailNodeIdFactory): string {
  const width = column.attrs['width'] ? ` width="${escapeAttr(columnWidthCss(column))}"` : '';
  const background = backgroundAttr(column);
  const children = (column.children || []).map((child) => blockToMjml(child, idFactory)).join('');
  return `<mj-column${width}${background}>${children || '<mj-text></mj-text>'}</mj-column>`;
}

function blockToMjml(node: EmailNode, idFactory: EmailNodeIdFactory): string {
  switch (node.type) {
    case 'row':
      return rowToMjml(node, idFactory);
    case 'column':
      return columnToMjml(node, idFactory);
    case 'section':
      return (node.children || []).map((child) => blockToMjml(child, idFactory)).join('') || '<mj-text></mj-text>';
    case 'text':
      return `<mj-text${backgroundAttr(node)}${alignAttr(node)}>${sanitizeRichTextContent(node.attrs['content'])}</mj-text>`;
    case 'image':
      return `<mj-image src="${escapeAttr(String(node.attrs['src'] || ''))}" alt="${escapeAttr(String(node.attrs['alt'] || ''))}"${alignAttr(node)} />`;
    case 'button':
      return `<mj-button href="${escapeAttr(String(node.attrs['href'] || '#'))}" background-color="${escapeAttr(String(node.attrs['backgroundColor'] || '#7c3aed'))}"${alignAttr(node)}>${escapeHtml(String(node.attrs['label'] || 'Button'))}</mj-button>`;
    case 'divider':
      return `<mj-divider border-color="${escapeAttr(String(node.attrs['borderColor'] || '#d0d5dd'))}" />`;
    case 'spacer':
      return `<mj-spacer height="${Number(node.attrs['height'] || 24)}px" />`;
  }
}

function backgroundAttr(node: EmailNode): string {
  return node.attrs['backgroundColor'] ? ` background-color="${escapeAttr(String(node.attrs['backgroundColor']))}"` : '';
}

function alignAttr(node: EmailNode): string {
  return isAlignableContent(node) && node.attrs['align'] ? ` align="${escapeAttr(contentAlign(node))}"` : '';
}

function sectionMjmlAttrs(section: EmailNode): string {
  const padding = ` padding="${escapeAttr(sectionPaddingCss(section))}"`;
  return `${backgroundAttr(section)}${padding}`;
}

function bodyMjmlAttrs(document: EmailDocument): string {
  const attrs = { ...defaultDocumentAttrs(), ...(document.attrs || {}) };
  const background = attrs['backgroundColor'] ? ` background-color="${escapeAttr(String(attrs['backgroundColor']))}"` : '';
  const width = attrs['width'] ? ` width="${escapeAttr(dimensionCss(attrs, 'width', 100, '%'))}"` : '';
  return `${background}${width}`;
}
