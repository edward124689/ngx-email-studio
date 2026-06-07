import { EmailDocument, EmailNode, EmailStudioTransformAction, EmailStudioTransformScope } from '../models';

const MERGE_TAG_PATTERN = /{%[^{}%]+%}/g;
const PREVIEW_MAX_LENGTH = 1200;

type TextConverter = (value: string) => string;

export interface EmailStudioTransformResult {
  document: EmailDocument;
  before: string;
  after: string;
  changedCount: number;
}

export async function transformEmailDocumentText(
  document: EmailDocument,
  action: EmailStudioTransformAction,
  _scope: EmailStudioTransformScope = 'document',
): Promise<EmailStudioTransformResult> {
  const converter = await createTextConverter(action);
  const nextDocument = structuredClone(document);
  const targets = collectTransformTargets(nextDocument.body);
  const beforeParts: string[] = [];
  const afterParts: string[] = [];
  let changedCount = 0;

  for (const node of targets) {
    if (node.type === 'text') {
      const beforeHtml = String(node.attrs['content'] ?? '');
      const afterHtml = transformRichTextHtml(beforeHtml, converter);
      beforeParts.push(extractHtmlText(beforeHtml));
      afterParts.push(extractHtmlText(afterHtml));
      if (afterHtml !== beforeHtml) {
        node.attrs = { ...node.attrs, content: afterHtml };
        changedCount += 1;
      }
    }

    if (node.type === 'button') {
      const beforeLabel = String(node.attrs['label'] ?? '');
      const afterLabel = transformTextPreservingMergeTags(beforeLabel, converter);
      beforeParts.push(beforeLabel);
      afterParts.push(afterLabel);
      if (afterLabel !== beforeLabel) {
        node.attrs = { ...node.attrs, label: afterLabel };
        changedCount += 1;
      }
    }
  }

  return {
    document: nextDocument,
    before: truncatePreview(joinPreviewParts(beforeParts)),
    after: truncatePreview(joinPreviewParts(afterParts)),
    changedCount,
  };
}

async function createTextConverter(action: EmailStudioTransformAction): Promise<TextConverter> {
  if (action === 'normalize-spaces') return normalizeTextSpaces;

  const opencc = await import('opencc-js');
  if (action === 'simplified-to-traditional') {
    return opencc.Converter({ from: 'cn', to: 'tw' });
  }
  return opencc.Converter({ from: 'tw', to: 'cn' });
}

function collectTransformTargets(nodes: EmailNode[]): EmailNode[] {
  const targets: EmailNode[] = [];

  const visit = (node: EmailNode): void => {
    if (isTransformableNode(node)) targets.push(node);
    (node.children || []).forEach(visit);
  };

  nodes.forEach(visit);
  return targets;
}

function isTransformableNode(node: EmailNode | undefined): node is EmailNode {
  return !!node && (node.type === 'text' || node.type === 'button');
}

function transformRichTextHtml(html: string, converter: TextConverter): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html');
  const root = doc.body.firstElementChild;
  if (!root) return html;

  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode as Text);
  for (const textNode of textNodes) {
    textNode.nodeValue = transformTextPreservingMergeTags(textNode.nodeValue || '', converter);
  }
  return root.innerHTML;
}

function extractHtmlText(html: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html');
  return doc.body.firstElementChild?.textContent || '';
}

function transformTextPreservingMergeTags(value: string, converter: TextConverter): string {
  const masks: string[] = [];
  const masked = value.replace(MERGE_TAG_PATTERN, (match) => {
    const token = `__NES_MERGE_TAG_${masks.length}__`;
    masks.push(match);
    return token;
  });
  let transformed = converter(masked);
  masks.forEach((tag, index) => {
    transformed = transformed.replaceAll(`__NES_MERGE_TAG_${index}__`, tag);
  });
  return transformed;
}

function normalizeTextSpaces(value: string): string {
  return value.replace(/[\t\n\r ]+/g, ' ').replace(/\s+([,.;:!?，。；：！？])/g, '$1').replace(/([（(])\s+/g, '$1').replace(/\s+([）)])/g, '$1');
}

function joinPreviewParts(parts: string[]): string {
  return parts.map((part) => part.trim()).filter(Boolean).join('\n\n');
}

function truncatePreview(value: string): string {
  if (value.length <= PREVIEW_MAX_LENGTH) return value;
  return `${value.slice(0, PREVIEW_MAX_LENGTH).trimEnd()}…`;
}
