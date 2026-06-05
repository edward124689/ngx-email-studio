import { defaultDocumentAttrs } from '../tree/block-factory';
import { EmailDocument, EmailNode, EmailSizeUnit } from '../models';
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
  sectionMaxWidthCss,
  sectionPaddingCss,
  sectionWidthCss,
} from './export-utils';

export function renderHtml(document: EmailDocument): string {
  const attrs = { ...defaultDocumentAttrs(), ...(document.attrs || {}) };
  const bodyBackgroundStyle = backgroundStyle(attrs['backgroundColor']);
  const emailBackgroundStyle = backgroundStyle(attrs['contentBackgroundColor']);
  const emailWidth = dimensionCss(attrs, 'width', 100, '%');
  const emailMaxWidth = dimensionCss(attrs, 'maxWidth', 600, 'px');
  const emailWidthAttr = dimensionHtmlWidthAttr(attrs, 'width', 100, '%');
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
    '    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">',
    '    <meta name="viewport" content="width=device-width, initial-scale=1">',
    '    <style type="text/css">',
    '      #outlook a { padding:0; }',
    '      body { margin:0; padding:0; -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }',
    '      table, td { border-collapse:collapse; mso-table-lspace:0pt; mso-table-rspace:0pt; }',
    '      img { border:0; height:auto; line-height:100%; outline:none; text-decoration:none; -ms-interpolation-mode:bicubic; }',
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
    `          <table role="presentation" border="0" width="${emailWidthAttr}" cellspacing="0" cellpadding="0" style="width:${emailWidth};max-width:${emailMaxWidth};${emailBackgroundStyle}border-radius:16px;overflow:hidden;font-family:Arial,sans-serif;border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;">`,
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
      return indent(`<div style="padding:20px;${backgroundStyle(node.attrs['backgroundColor'])}line-height:1.6;color:#1f2937;text-align:${escapeAttr(contentAlign(node))};">${sanitizeRichTextContent(node.attrs['content'])}</div>`, depth);
    case 'image':
      return indent(`<div style="text-align:${escapeAttr(contentAlign(node))};"><img src="${escapeAttr(String(node.attrs['src'] || ''))}" alt="${escapeAttr(String(node.attrs['alt'] || ''))}" width="${escapeAttr(dimensionHtmlWidthAttr(node.attrs, 'width', 100, '%'))}" style="display:inline-block;max-width:100%;width:${escapeAttr(imageWidthCss(node))};height:auto;border:0;" /></div>`, depth);
    case 'button': {
      const radius = escapeAttr(buttonBorderRadiusCss(node));
      return indent(`<div style="padding:24px;text-align:${escapeAttr(contentAlign(node))};"><a href="${escapeAttr(String(node.attrs['href'] || '#'))}" style="display:inline-block;background:${escapeAttr(colorAttrValue(node.attrs['backgroundColor']) || '#7c3aed')};color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:${radius};font-weight:bold;">${escapeHtml(String(node.attrs['label'] || 'Button'))}</a></div>`, depth);
    }
    case 'divider':
      return indent(`<div style="padding:12px 24px;"><hr style="border:0;border-top:1px solid ${escapeAttr(String(node.attrs['borderColor'] || '#d0d5dd'))};" /></div>`, depth);
    case 'spacer': {
      const height = Number(node.attrs['height'] || 24);
      return indent(`<div style="height:${height}px;line-height:${height}px;font-size:0;">&nbsp;</div>`, depth);
    }
    default:
      return '';
  }
}

function buttonBorderRadiusCss(node: EmailNode): string {
  const raw = node.attrs['borderRadius'];
  if (typeof raw === 'number' && Number.isFinite(raw)) return `${Math.max(0, raw)}px`;
  const parsed = Number.parseFloat(String(raw ?? '10').replace(/px$/i, ''));
  return `${Number.isFinite(parsed) ? Math.max(0, parsed) : 10}px`;
}

function autoColumnWidth(row: EmailNode): string {
  const count = Math.max(1, row.children?.length || 1);
  return `${Math.floor(100 / count)}%`;
}

function outlookHtmlWidth(attrs: Record<string, string | number | boolean>): string {
  if (dimensionUnit(attrs, 'maxWidth', 'px') === 'px') return String(dimensionValue(attrs, 'maxWidth', 600));
  if (dimensionUnit(attrs, 'width', '%') === 'px') return String(dimensionValue(attrs, 'width', 600));
  return '600';
}
