import { EmailDocument, EmailNode } from '../models';
import { createColumn, createNode, defaultDocumentAttrs, EmailNodeIdFactory } from '../tree/block-factory';
import { sanitizeRichTextContent } from '../tiptap/rich-text-sanitizer';
import { columnWidthCss, colorAttrValue, contentAlign, dimensionCss, escapeAttr, escapeHtml, hasExplicitDimension, imageWidthCss, isAlignableContent, normalizeCssSizeValue, normalizeFontFamilyValue, normalizeHrefValue, normalizeLineHeightValue, paddingCss, sectionPaddingCss } from './export-utils';

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
      return `<mj-text${backgroundAttr(node)}${alignAttr(node)}${textTypographyAttrs(node)}${paddingAttr(node)}>${sanitizeRichTextContent(node.attrs['content'])}</mj-text>`;
    case 'image':
      return `<mj-image src="${escapeAttr(String(node.attrs['src'] || ''))}" alt="${escapeAttr(String(node.attrs['alt'] || ''))}"${alignAttr(node)}${imageWidthAttr(node)}${paddingAttr(node)} />`;
    case 'button': {
      const radius = escapeAttr(buttonBorderRadiusCss(node));
      return `<mj-button href="${escapeAttr(normalizeHrefValue(node.attrs['href']) || '#')}" background-color="${escapeAttr(colorAttrValue(node.attrs['backgroundColor']) || '#7c3aed')}"${buttonColorAttr(node)} border-radius="${radius}"${alignAttr(node)}${paddingAttr(node)}>${escapeHtml(String(node.attrs['label'] || 'Button'))}</mj-button>`;
    }
    case 'divider':
      return `<mj-divider border-color="${escapeAttr(String(node.attrs['borderColor'] || '#d0d5dd'))}" />`;
    case 'spacer':
      return `<mj-spacer height="${Number(node.attrs['height'] || 24)}px" />`;
  }
}

function backgroundAttr(node: EmailNode): string {
  const color = colorAttrValue(node.attrs['backgroundColor']);
  return color ? ` background-color="${escapeAttr(color)}"` : '';
}

function alignAttr(node: EmailNode): string {
  return isAlignableContent(node) && node.attrs['align'] ? ` align="${escapeAttr(contentAlign(node))}"` : '';
}

function imageWidthAttr(node: EmailNode): string {
  return hasExplicitDimension(node.attrs, 'width') ? ` width="${escapeAttr(imageWidthCss(node))}"` : '';
}

function textTypographyAttrs(node: EmailNode): string {
  const color = colorAttrValue(node.attrs['color']);
  const fontFamily = normalizeFontFamilyValue(node.attrs['fontFamily']);
  const fontSize = normalizeCssSizeValue(node.attrs['fontSize']);
  const lineHeight = normalizeLineHeightValue(node.attrs['lineHeight']);
  return `${color ? ` color="${escapeAttr(color)}"` : ''}${fontFamily ? ` font-family="${escapeAttr(fontFamily)}"` : ''}${fontSize ? ` font-size="${escapeAttr(fontSize)}"` : ''}${lineHeight ? ` line-height="${escapeAttr(lineHeight)}"` : ''}`;
}

function buttonColorAttr(node: EmailNode): string {
  const color = colorAttrValue(node.attrs['color']);
  return color ? ` color="${escapeAttr(color)}"` : '';
}

function paddingAttr(node: EmailNode): string {
  return ['padding', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'].some((key) => node.attrs[key] !== undefined) ? ` padding="${escapeAttr(paddingCss(node, 0))}"` : '';
}

function sectionMjmlAttrs(section: EmailNode): string {
  const padding = ` padding="${escapeAttr(sectionPaddingCss(section))}"`;
  return `${backgroundAttr(section)}${padding}`;
}

function buttonBorderRadiusCss(node: EmailNode): string {
  const raw = node.attrs['borderRadius'];
  if (typeof raw === 'number' && Number.isFinite(raw)) return `${Math.max(0, raw)}px`;
  const parsed = Number.parseFloat(String(raw ?? '10').replace(/px$/i, ''));
  return `${Number.isFinite(parsed) ? Math.max(0, parsed) : 10}px`;
}

function bodyMjmlAttrs(document: EmailDocument): string {
  const attrs = { ...defaultDocumentAttrs(), ...(document.attrs || {}) };
  const backgroundColor = colorAttrValue(attrs['backgroundColor']);
  const background = backgroundColor ? ` background-color="${escapeAttr(backgroundColor)}"` : '';
  const width = attrs['width'] ? ` width="${escapeAttr(dimensionCss(attrs, 'width', 100, '%'))}"` : '';
  return `${background}${width}`;
}
