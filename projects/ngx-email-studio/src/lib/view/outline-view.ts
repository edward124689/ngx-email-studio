import { EmailNode } from '../models';
import { plainText } from './document-view';

export function outlineLabel(node: EmailNode): string {
  if (node.type === 'section') return 'Section';
  if (node.type === 'row') return `MJML ${node.children?.length || 1} columns`;
  if (node.type === 'text') return plainText(String(node.attrs['content'] || 'Text')).slice(0, 28) || 'Text paragraph';
  if (node.type === 'image') return 'Image placeholder';
  if (node.type === 'button') return String(node.attrs['label'] || 'CTA button');
  if (node.type === 'divider') return 'Divider';
  if (node.type === 'spacer') return 'Spacer';
  return node.type;
}

export function outlineMeta(node: EmailNode): string {
  const childCount = node.children?.length || 0;
  if (node.type === 'row') return `${childCount || 1} column${(childCount || 1) === 1 ? '' : 's'}`;
  if (node.type === 'column') return `${childCount} nested block${childCount === 1 ? '' : 's'}`;
  if (node.type === 'section') return childCount ? `${childCount} nested block${childCount === 1 ? '' : 's'}` : 'container';
  return node.type;
}

export function outlineIcon(node: EmailNode): string {
  if (node.type === 'row') return 'fa-columns';
  if (node.type === 'column') return 'fa-window-maximize';
  if (node.type === 'section') return 'fa-object-group';
  if (node.type === 'text') return 'fa-font';
  if (node.type === 'image') return 'fa-picture-o';
  if (node.type === 'button') return 'fa-mouse-pointer';
  if (node.type === 'divider') return 'fa-minus';
  if (node.type === 'spacer') return 'fa-arrows-v';
  return 'fa-square-o';
}

export function countOutlineNodes(nodes: EmailNode[]): number {
  return nodes.reduce((count, node) => count + 1 + countOutlineNodes(node.children || []), 0);
}
