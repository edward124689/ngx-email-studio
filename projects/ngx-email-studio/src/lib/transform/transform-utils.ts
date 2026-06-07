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
      const { html: afterHtml, changed } = transformRichTextHtml(beforeHtml, converter);
      beforeParts.push(extractHtmlText(beforeHtml));
      afterParts.push(extractHtmlText(afterHtml));
      if (changed) {
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

function transformRichTextHtml(html: string, converter: TextConverter): { html: string; changed: boolean } {
  const parser = new DOMParser();
  const doc = parser.parseFromString('', 'text/html');
  const template = doc.createElement('template');
  template.innerHTML = html;

  const walker = doc.createTreeWalker(template.content, 4);
  const textNodes: Text[] = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode as Text);
  let changed = false;
  for (const textNode of textNodes) {
    if (isIgnoredTextNode(textNode)) continue;
    const before = textNode.nodeValue || '';
    const after = transformTextPreservingMergeTags(before, converter);
    if (after !== before) {
      textNode.nodeValue = after;
      changed = true;
    }
  }
  return { html: changed ? template.innerHTML : html, changed };
}

function extractHtmlText(html: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString('', 'text/html');
  const template = doc.createElement('template');
  template.innerHTML = html;
  return template.content.textContent || '';
}

function isIgnoredTextNode(textNode: Text): boolean {
  const parent = textNode.parentElement;
  if (!parent) return false;
  return ['SCRIPT', 'STYLE', 'TEXTAREA', 'TITLE'].includes(parent.tagName);
}

function transformTextPreservingMergeTags(value: string, converter: TextConverter): string {
  let result = '';
  let lastIndex = 0;
  MERGE_TAG_PATTERN.lastIndex = 0;
  for (const match of value.matchAll(MERGE_TAG_PATTERN)) {
    const index = match.index ?? 0;
    result += converter(value.slice(lastIndex, index));
    result += match[0];
    lastIndex = index + match[0].length;
  }
  result += converter(value.slice(lastIndex));
  return result;
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
