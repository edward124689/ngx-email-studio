import { defaultDocumentAttrs } from '../tree/block-factory';
import { EmailDocument, EmailNode, EmailSizeUnit } from '../models';
import { parseSocialItems, socialCssSize, socialIconLabel, socialMode } from '../social/social-utils';
import { sanitizeRichTextContent } from '../tiptap/rich-text-sanitizer';
import {
  backgroundStyle,
  colorAttrValue,
  columnMaxWidthCss,
  columnWidthCss,
  contentAlign,
  dimensionCss,
  dimensionHtmlWidthAttr,
  dimensionUnit,
  dimensionValue,
  escapeAttr,
  escapeHtml,
  imageWidthCss,
  indent,
  normalizeCssSizeValue,
  normalizeFontCssUrlValue,
  normalizeFontFamilyValue,
  normalizeFontWeightValue,
  normalizeHrefValue,
  normalizeImageSrcValue,
  normalizeLineHeightValue,
  paddingCss,
  sectionMaxWidthCss,
  sectionPaddingCss,
  sectionWidthCss,
} from './export-utils';

export function renderHtml(document: EmailDocument): string {
  const rawAttrs = document.attrs || {};
  const attrs = { ...defaultDocumentAttrs(), ...rawAttrs };
  const bodyBackgroundStyle = backgroundStyle(attrs['backgroundColor']);
  const emailBackgroundStyle = backgroundStyle(attrs['contentBackgroundColor']);
  const emailWidth = dimensionCss(attrs, 'width', 100, '%');
  const emailMaxWidth = dimensionCss(attrs, 'maxWidth', 600, 'px');
  const emailWidthAttr = dimensionHtmlWidthAttr(attrs, 'width', 100, '%');
  const emailChromeStyle = emailWrapperChromeStyle(attrs);
  const emailFontFamily = emailFontFamilyCss(attrs);
  const emailFontSize = emailFontSizeCss(attrs);
  const emailFontImport = fontCssImportStyle(attrs, rawAttrs);
  const outlookWidth = escapeAttr(outlookHtmlWidth(attrs));
  const rows = document.body.map((node) => nodeToHtml(node, 6)).join('\n');
  return [
    '<!doctype html>',
    '<html xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">',
    '  <head>',
    '    <title>Email Export</title>',
    '    <!--[if !mso]><!-->',
    '    <meta http-equiv="X-UA-Compatible" content="IE=edge">',
    '    <!--<![endif]-->',
    ...emailFontImport,
    '    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">',
    '    <meta name="viewport" content="width=device-width, initial-scale=1">',
    '    <style type="text/css">',
    '      #outlook a { padding:0; }',
    '      body { margin:0; padding:0; -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }',
    '      table, td { border-collapse:collapse; mso-table-lspace:0pt; mso-table-rspace:0pt; }',
    '      img { border:0; height:auto; line-height:100%; outline:none; text-decoration:none; -ms-interpolation-mode:bicubic; max-width:100%; }',
    '      p { display:block; margin:13px 0; }',
    '    </style>',
    '    <!--[if mso]>',
    '    <noscript>',
    '      <xml>',
    '        <o:OfficeDocumentSettings>',
    '          <o:AllowPNG/>',
    '          <o:PixelsPerInch>96</o:PixelsPerInch>',
    '        </o:OfficeDocumentSettings>',
    '      </xml>',
    '    </noscript>',
    '    <![endif]-->',
    '    <!--[if lte mso 11]>',
    '    <style type="text/css">',
    '      .nes-email-outlook-fix { width:100% !important; }',
    '    </style>',
    '    <![endif]-->',
    '    <style type="text/css">',
    '      @media only screen and (max-width:480px) {',
    '        .nes-email-column { display:block !important; width:100% !important; max-width:100% !important; }',
    '      }',
    '      @media only screen and (min-width:480px) {',
    '        .nes-email-column { display:table-cell !important; }',
    '      }',
    '    </style>',
    '  </head>',
    `  <body style="margin:0;padding:0;${bodyBackgroundStyle}word-spacing:normal;">`,
    `    <table role="presentation" border="0" width="100%" cellspacing="0" cellpadding="0" style="${bodyBackgroundStyle}padding:24px 0;border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;">`,
    '      <tr>',
    '        <td align="center">',
    `          <!--[if mso | IE]><table role="presentation" align="center" border="0" cellpadding="0" cellspacing="0" width="${outlookWidth}"><tr><td><![endif]-->`,
    `          <table role="presentation" border="0" width="${emailWidthAttr}" cellspacing="0" cellpadding="0" style="width:${emailWidth};max-width:${emailMaxWidth};${emailBackgroundStyle}${emailChromeStyle}font-family:${escapeAttr(emailFontFamily)};font-size:${emailFontSize};border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;">`,
    rows,
    '          </table>',
    '          <!--[if mso | IE]></td></tr></table><![endif]-->',
    '        </td>',
    '      </tr>',
    '    </table>',
    '  </body>',
    '</html>',
  ].join('\n');
}

function nodeToHtml(node: EmailNode, depth = 0): string {
  if (node.type === 'row') return rowToHtml(node, depth);
  if (node.type === 'column') return [indent('<tr>', depth), columnToHtml(node, autoColumnWidth(node), depth + 1), indent('</tr>', depth)].join('\n');
  if (node.type === 'section') return sectionToHtml(node, depth);
  return blockToHtmlRow(node, depth);
}

function rowToHtml(row: EmailNode, depth = 0): string {
  const columns = (row.children || []).filter((child) => child.type === 'column');
  const width = autoColumnWidth(row);
  const cells = columns.map((column) => columnToHtml(column, width, depth + 4)).join('\n');
  return [
    indent('<tr>', depth),
    indent(`<td style="padding:0;${backgroundStyle(row.attrs['backgroundColor'])}">`, depth + 1),
    indent('<table role="presentation" border="0" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;">', depth + 2),
    indent('<tr>', depth + 3),
    cells,
    indent('</tr>', depth + 3),
    indent('</table>', depth + 2),
    indent('</td>', depth + 1),
    indent('</tr>', depth),
  ].join('\n');
}

function sectionToHtml(section: EmailNode, depth = 0): string {
  const content = (section.children || []).map((child) => blockToHtmlCellContent(child, depth + 2)).join('\n');
  const sectionBackgroundStyle = backgroundStyle(section.attrs['backgroundColor']);
  return [
    indent('<tr>', depth),
    indent(`<td align="center" style="padding:0;${sectionBackgroundStyle}">`, depth + 1),
    indent(`<table role="presentation" border="0" width="${escapeAttr(dimensionHtmlWidthAttr(section.attrs, 'width', 100, '%'))}" cellspacing="0" cellpadding="0" style="width:${escapeAttr(sectionWidthCss(section))};max-width:${escapeAttr(sectionMaxWidthCss(section))};${sectionBackgroundStyle}border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;">`, depth + 2),
    indent('<tr>', depth + 3),
    indent(`<td style="padding:${escapeAttr(sectionPaddingCss(section))};">`, depth + 4),
    content,
    indent('</td>', depth + 4),
    indent('</tr>', depth + 3),
    indent('</table>', depth + 2),
    indent('</td>', depth + 1),
    indent('</tr>', depth),
  ].join('\n');
}

function columnToHtml(column: EmailNode, fallbackWidth: string, depth = 0): string {
  const fallbackValue = Number.parseFloat(fallbackWidth);
  const fallbackUnit: EmailSizeUnit = fallbackWidth.trim().endsWith('%') ? '%' : 'px';
  const width = columnWidthCss(column, Number.isFinite(fallbackValue) ? fallbackValue : 100, fallbackUnit);
  const maxWidth = columnMaxWidthCss(column);
  const content = (column.children || []).map((child) => blockToHtmlCellContent(child, depth + 1)).join('\n');
  return [
    indent(`<td class="nes-email-column nes-email-outlook-fix" width="${escapeAttr(dimensionHtmlWidthAttr(column.attrs, 'width', Number.isFinite(fallbackValue) ? fallbackValue : 100, fallbackUnit))}" valign="top" style="width:${escapeAttr(width)};max-width:${escapeAttr(maxWidth)};padding:16px;${backgroundStyle(column.attrs['backgroundColor'])}border-collapse:collapse;">`, depth),
    content,
    indent('</td>', depth),
  ].join('\n');
}

function blockToHtmlRow(node: EmailNode, depth = 0): string {
  switch (node.type) {
    case 'row':
      return rowToHtml(node, depth);
    case 'column':
      return [indent('<tr>', depth), columnToHtml(node, '100%', depth + 1), indent('</tr>', depth)].join('\n');
    default:
      return [indent('<tr>', depth), indent('<td>', depth + 1), blockToHtmlCellContent(node, depth + 2), indent('</td>', depth + 1), indent('</tr>', depth)].join('\n');
  }
}

function blockToHtmlCellContent(node: EmailNode, depth = 0): string {
  switch (node.type) {
    case 'row':
      return [indent('<table role="presentation" border="0" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;">', depth), rowToHtml(node, depth + 1), indent('</table>', depth)].join('\n');
    case 'column':
      return [indent('<table role="presentation" border="0" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;">', depth), indent('<tr>', depth + 1), columnToHtml(node, '100%', depth + 2), indent('</tr>', depth + 1), indent('</table>', depth)].join('\n');
    case 'section':
      return [indent('<table role="presentation" border="0" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;">', depth), sectionToHtml(node, depth + 1), indent('</table>', depth)].join('\n');
    case 'text':
      return indent(`<div style="padding:${escapeAttr(paddingCss(node, 20))};${backgroundStyle(node.attrs['backgroundColor'])}${textTypographyStyle(node)}text-align:${escapeAttr(contentAlign(node))};">${sanitizeRichTextContent(node.attrs['content'])}</div>`, depth);
    case 'image':
      return indent(`<div style="padding:${escapeAttr(paddingCss(node, 0))};text-align:${escapeAttr(contentAlign(node))};"><img src="${escapeAttr(normalizeImageSrcValue(node.attrs['src']))}" alt="${escapeAttr(String(node.attrs['alt'] || ''))}" width="${escapeAttr(dimensionHtmlWidthAttr(node.attrs, 'width', 100, '%'))}" style="display:inline-block;max-width:100%;width:${escapeAttr(imageWidthCss(node))};height:auto;border:0;" /></div>`, depth);
    case 'button': {
      const radius = escapeAttr(buttonBorderRadiusCss(node));
      return indent(`<div style="padding:${escapeAttr(paddingCss(node, 24))};text-align:${escapeAttr(contentAlign(node))};"><a href="${escapeAttr(normalizeHrefValue(node.attrs['href']) || '#')}" style="display:inline-block;background:${escapeAttr(colorAttrValue(node.attrs['backgroundColor']) || '#7c3aed')};color:${escapeAttr(buttonTextColorCss(node))};text-decoration:none;padding:12px 20px;border-radius:${radius};font-weight:bold;">${escapeHtml(String(node.attrs['label'] || 'Button'))}</a></div>`, depth);
    }
    case 'social':
      return socialToHtml(node, depth);
    case 'divider':
      return indent(`<div style="padding:12px 24px;"><hr style="border:0;border-top:1px solid ${escapeAttr(colorAttrValue(node.attrs['borderColor']) || '#d0d5dd')};" /></div>`, depth);
    case 'spacer': {
      const height = Number(node.attrs['height'] || 24);
      return indent(`<div style="height:${height}px;line-height:${height}px;font-size:0;">&nbsp;</div>`, depth);
    }
    default:
      return '';
  }
}

function socialToHtml(node: EmailNode, depth = 0): string {
  const items = parseSocialItems(node.attrs['items']);
  const gap = socialMode(node.attrs['mode']) === 'vertical' ? '<br>' : '&nbsp;';
  const iconSize = socialCssSize(node.attrs['iconSize'], '30px');
  const fontSize = socialCssSize(node.attrs['fontSize'], '15px');
  const links = items.map((item) => {
    const background = colorAttrValue(item.backgroundColor) || '#A1A0A0';
    const logoUrl = normalizeImageSrcValue(item.logoUrl);
    const content = logoUrl
      ? `<img src="${escapeAttr(logoUrl)}" alt="${escapeAttr(item.name)}" width="${escapeAttr(iconSize)}" height="${escapeAttr(iconSize)}" style="display:block;border:0;width:${escapeAttr(iconSize)};height:${escapeAttr(iconSize)};" />`
      : escapeHtml(socialIconLabel(item.name));
    const shapeStyle = logoUrl
      ? 'border-radius:0;background:transparent;'
      : `border-radius:999px;background:${escapeAttr(background)};`;
    return `<a href="${escapeAttr(normalizeHrefValue(item.href) || '#')}" aria-label="${escapeAttr(item.name)}" style="display:inline-block;width:${escapeAttr(iconSize)};height:${escapeAttr(iconSize)};line-height:${escapeAttr(iconSize)};${shapeStyle}color:#ffffff;text-align:center;text-decoration:none;font-family:Arial,sans-serif;font-size:${escapeAttr(fontSize)};font-weight:bold;">${content}</a>`;
  }).join(gap);
  return indent(`<div style="padding:${escapeAttr(paddingCss(node, 0))};text-align:${escapeAttr(contentAlign(node))};${backgroundStyle(node.attrs['backgroundColor'])}">${links}</div>`, depth);
}

function buttonBorderRadiusCss(node: EmailNode): string {
  const raw = node.attrs['borderRadius'];
  if (typeof raw === 'number' && Number.isFinite(raw)) return `${Math.max(0, raw)}px`;
  const parsed = Number.parseFloat(String(raw ?? '10').replace(/px$/i, ''));
  return `${Number.isFinite(parsed) ? Math.max(0, parsed) : 10}px`;
}

function textTypographyStyle(node: EmailNode): string {
  const color = colorAttrValue(node.attrs['color']) || '#1f2937';
  const fontFamily = normalizeFontFamilyValue(node.attrs['fontFamily']);
  const fontWeight = normalizeFontWeightValue(node.attrs['fontWeight']);
  const fontSize = normalizeCssSizeValue(node.attrs['fontSize']);
  const lineHeight = normalizeLineHeightValue(node.attrs['lineHeight']) || '1.6';
  return `${fontFamily ? `font-family:${escapeAttr(fontFamily)};` : ''}${fontWeight ? `font-weight:${escapeAttr(fontWeight)};` : ''}${fontSize ? `font-size:${escapeAttr(fontSize)};` : ''}line-height:${escapeAttr(lineHeight)};color:${escapeAttr(color)};`;
}

function buttonTextColorCss(node: EmailNode): string {
  return colorAttrValue(node.attrs['color']) || '#ffffff';
}

function autoColumnWidth(row: EmailNode): string {
  const count = Math.max(1, row.children?.length || 1);
  return `${Math.floor(100 / count)}%`;
}

function outlookHtmlWidth(attrs: Record<string, string | number | boolean>): string {
  const maxWidth = dimensionValue(attrs, 'maxWidth', 600);
  if (dimensionUnit(attrs, 'maxWidth', 'px') === 'px' && Number.isFinite(maxWidth) && maxWidth > 0) return String(Math.round(maxWidth));
  const width = dimensionValue(attrs, 'width', 600);
  if (dimensionUnit(attrs, 'width', '%') === 'px' && Number.isFinite(width) && width > 0) return String(Math.round(width));
  return '600';
}

function emailWrapperChromeStyle(attrs: Record<string, string | number | boolean>): string {
  const radius = nonNegativeNumber(attrs['contentBorderRadius'], 16);
  const width = nonNegativeNumber(attrs['contentBorderWidth'], 0);
  const color = colorAttrValue(attrs['contentBorderColor']) || '#d9e2ec';
  const border = width > 0 ? `border:${width}px solid ${escapeAttr(color)};` : '';
  return `border-radius:${radius}px;${border}overflow:hidden;`;
}

function emailFontSizeCss(attrs: Record<string, string | number | boolean>): string {
  const normalized = normalizeCssSizeValue(attrs['contentFontSize']);
  return normalized || `${nonNegativeNumber(attrs['contentFontSize'], 13)}px`;
}

function emailFontFamilyCss(attrs: Record<string, string | number | boolean>): string {
  return normalizeFontFamilyValue(attrs['contentFontFamily']) || 'Ubuntu, Helvetica, Arial, sans-serif';
}

function fontCssUrl(attrs: Record<string, string | number | boolean>, rawAttrs: Record<string, string | number | boolean>): string {
  const hasExplicitUrl = Object.prototype.hasOwnProperty.call(rawAttrs, 'contentFontCssUrl');
  if (hasExplicitUrl && String(rawAttrs['contentFontCssUrl'] ?? '').trim() === '') return '';
  if (hasExplicitUrl) return normalizeFontCssUrlValue(rawAttrs['contentFontCssUrl']);
  return normalizeFontCssUrlValue(attrs['contentFontCssUrl']) || 'https://fonts.googleapis.com/css?family=Ubuntu:300,400,500,700';
}

function fontCssImportStyle(attrs: Record<string, string | number | boolean>, rawAttrs: Record<string, string | number | boolean>): string[] {
  const url = fontCssUrl(attrs, rawAttrs);
  if (!url) return [];
  const escapedAttrUrl = escapeAttr(url);
  return [
    '    <!--[if !mso]><!-->',
    `    <link href="${escapedAttrUrl}" rel="stylesheet" type="text/css">`,
    '    <style type="text/css">',
    `      @import url("${url}");`,
    '    </style>',
    '    <!--<![endif]-->',
  ];
}

function nonNegativeNumber(value: unknown, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value ?? ''));
  return Number.isFinite(parsed) ? Math.max(0, parsed) : fallback;
}
