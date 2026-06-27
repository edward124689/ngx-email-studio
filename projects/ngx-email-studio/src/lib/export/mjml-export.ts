import { EmailDocument, EmailNode } from '../models';
import { parseSocialItems, socialCssSize, socialMode } from '../social/social-utils';
import { createColumn, createNode, defaultDocumentAttrs, EmailNodeIdFactory } from '../tree/block-factory';
import { sanitizeRichTextContent } from '../tiptap/rich-text-sanitizer';
import { columnWidthCss, colorAttrValue, contentAlign, dimensionCss, escapeAttr, escapeHtml, hasExplicitDimension, imageWidthCss, isAlignableContent, normalizeCssSizeValue, normalizeFontFamilyValue, normalizeFontWeightValue, normalizeHrefValue, normalizeImageSrcValue, normalizeLineHeightValue, paddingCss, sectionPaddingCss } from './export-utils';

export function compileMjml(document: EmailDocument, idFactory: EmailNodeIdFactory): string {
  const body = document.body.map((node) => nodeToMjml(node, idFactory)).join('\n');
  return `<mjml>\n  <mj-body${bodyMjmlAttrs(document)}>\n${body}\n  </mj-body>\n</mjml>`;
}

function nodeToMjml(node: EmailNode, idFactory: EmailNodeIdFactory): string {
  if (node.type === 'row') return rowToMjml(node, idFactory);
  if (node.type === 'column') return `    <mj-section>${columnToMjml(node, idFactory)}</mj-section>`;
  if (node.type === 'section') return sectionToMjml(node, idFactory);
  return `    <mj-section${backgroundAttr(node)}><mj-column>${blockToMjml(node, idFactory)}</mj-column></mj-section>`;
}

function rowToMjml(row: EmailNode, idFactory: EmailNodeIdFactory): string {
  const columns = rowChildrenToColumns(row, idFactory);
  const columnMarkup = columns.length
    ? columns.map((column) => columnToMjml(column, idFactory)).join('')
    : columnToMjml(createColumn(idFactory, [createNode(idFactory, 'text')]), idFactory);
  return `    <mj-section${backgroundAttr(row)}>${columnMarkup}</mj-section>`;
}

function rowChildrenToColumns(row: EmailNode, idFactory: EmailNodeIdFactory): EmailNode[] {
  const children = row.children || [];
  const fallbackWidth = `${Math.floor(100 / Math.max(1, children.length || 1))}%`;
  return children.flatMap((child) => {
    if (child.type === 'column') return [child];
    if (child.type === 'row') return rowChildrenToColumns(child, idFactory);
    return [createColumn(idFactory, [child], fallbackWidth)];
  });
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
      return `<mj-image src="${escapeAttr(normalizeImageSrcValue(node.attrs['src']))}" alt="${escapeAttr(String(node.attrs['alt'] || ''))}"${alignAttr(node)}${imageWidthAttr(node)}${paddingAttr(node)} />`;
    case 'button': {
      const radius = escapeAttr(buttonBorderRadiusCss(node));
      return `<mj-button href="${escapeAttr(normalizeHrefValue(node.attrs['href']) || '#')}" background-color="${escapeAttr(colorAttrValue(node.attrs['backgroundColor']) || '#7c3aed')}"${buttonColorAttr(node)} border-radius="${radius}"${alignAttr(node)}${paddingAttr(node)}>${escapeHtml(String(node.attrs['label'] || 'Button'))}</mj-button>`;
    }
    case 'social':
      return socialToMjml(node);
    case 'divider':
      return `<mj-divider border-color="${escapeAttr(colorAttrValue(node.attrs['borderColor']) || '#d0d5dd')}" />`;
    case 'spacer': {
      const height = spacerHeight(node.attrs['height']);
      return `<mj-spacer height="${height}px" />`;
    }
  }
}

function spacerHeight(value: unknown): number {
  const parsed = strictPixelNumber(value);
  if (parsed === undefined) return 24;
  return Math.min(1000, Math.round(parsed));
}

function socialToMjml(node: EmailNode): string {
  const items = parseSocialItems(node.attrs['items']);
  const mode = socialMode(node.attrs['mode']);
  const iconSize = socialCssSize(node.attrs['iconSize'], '30px');
  const fontSize = socialCssSize(node.attrs['fontSize'], '15px');
  const children = items.map((item) => {
    const logoUrl = normalizeImageSrcValue(item.logoUrl);
    const src = logoUrl ? ` src="${escapeAttr(logoUrl)}"` : '';
    const shapeAttrs = logoUrl
      ? ' background-color="transparent" border-radius="0px"'
      : ` background-color="${escapeAttr(colorAttrValue(item.backgroundColor) || '#A1A0A0')}"`;
    return `<mj-social-element name="${escapeAttr(item.name)}" href="${escapeAttr(normalizeHrefValue(item.href) || '#')}"${shapeAttrs}${src}></mj-social-element>`;
  }).join('');
  const containerBackground = colorAttrValue(node.attrs['backgroundColor']);
  const background = containerBackground ? ` container-background-color="${escapeAttr(containerBackground)}"` : '';
  return `<mj-social font-size="${escapeAttr(fontSize)}" icon-size="${escapeAttr(iconSize)}" mode="${escapeAttr(mode)}"${alignAttr(node)}${paddingAttr(node)}${background}>${children}</mj-social>`;
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
  const fontWeight = normalizeFontWeightValue(node.attrs['fontWeight']);
  const fontSize = normalizeCssSizeValue(node.attrs['fontSize']);
  const lineHeight = normalizeLineHeightValue(node.attrs['lineHeight']);
  return `${color ? ` color="${escapeAttr(color)}"` : ''}${fontFamily ? ` font-family="${escapeAttr(fontFamily)}"` : ''}${fontWeight ? ` font-weight="${escapeAttr(fontWeight)}"` : ''}${fontSize ? ` font-size="${escapeAttr(fontSize)}"` : ''}${lineHeight ? ` line-height="${escapeAttr(lineHeight)}"` : ''}`;
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
  const parsed = strictPixelNumber(node.attrs['borderRadius']);
  return `${parsed === undefined ? 10 : parsed}px`;
}

function strictPixelNumber(value: unknown): number | undefined {
  if (typeof value === 'number') return Number.isFinite(value) && value >= 0 ? Math.max(0, value) : undefined;
  const match = String(value ?? '').trim().match(/^(\d+(?:\.\d+)?)(?:px)?$/i);
  if (!match) return undefined;
  const parsed = Number.parseFloat(match[1]);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

function bodyMjmlAttrs(document: EmailDocument): string {
  const attrs = { ...defaultDocumentAttrs(), ...(document.attrs || {}) };
  const backgroundColor = colorAttrValue(attrs['backgroundColor']);
  const background = backgroundColor ? ` background-color="${escapeAttr(backgroundColor)}"` : '';
  const width = attrs['width'] ? ` width="${escapeAttr(dimensionCss(attrs, 'width', 100, '%'))}"` : '';
  return `${background}${width}`;
}
