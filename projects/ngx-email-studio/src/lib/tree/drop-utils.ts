import { EmailNode, PaletteItem } from '../models';
import { nodeContainsId } from './node-utils';

export function isPaletteItem(value: unknown): value is PaletteItem {
  return !!value && typeof value === 'object' && 'label' in value && 'description' in value && ('type' in value || 'templateMjml' in value);
}

export function isEmailNode(value: unknown): value is EmailNode {
  return !!value && typeof value === 'object' && 'id' in value && 'type' in value && 'attrs' in value;
}

export function isContentModule(node: EmailNode): boolean {
  return node.type === 'text' || node.type === 'image' || node.type === 'button' || node.type === 'social' || node.type === 'divider' || node.type === 'spacer';
}

export function canDropIntoContainer(args: {
  data: unknown;
  containerId?: string;
  paletteDropListId: string;
  rootDropListId: string;
  findTargetContainer: (containerId: string) => EmailNode | undefined;
}): boolean {
  const { data, containerId, paletteDropListId, rootDropListId, findTargetContainer } = args;
  if (containerId === paletteDropListId) return false;
  if (!containerId) return true;
  if (isPaletteItem(data)) return true;
  if (!isEmailNode(data)) return false;
  if (containerId === rootDropListId) return true;

  const targetContainer = findTargetContainer(containerId);
  if (!targetContainer || (targetContainer.type !== 'section' && targetContainer.type !== 'column')) return false;
  if (data.id === targetContainer.id || nodeContainsId(data, targetContainer.id)) return false;
  return isContentModule(data);
}

export function normalizeNestedDropNode(node: EmailNode, createFallbackText: () => EmailNode): EmailNode {
  if (node.type === 'section') {
    const child = node.children?.[0];
    return child ? structuredClone(child) : createFallbackText();
  }
  if (node.type === 'row') return createFallbackText();
  return node;
}

export function wrapForRootDrop(node: EmailNode, isRootDrop: boolean, createSection: (children: EmailNode[]) => EmailNode): EmailNode {
  if (!isRootDrop) return node;
  if (node.type === 'row' || node.type === 'section') return node;
  return createSection([node]);
}

export function collectContainerDropListIds(nodes: EmailNode[], dropListIdFor: (node: EmailNode) => string): string[] {
  return nodes.flatMap((node) => {
    const ids = node.type === 'column' || node.type === 'section' ? [dropListIdFor(node)] : [];
    return [...ids, ...collectContainerDropListIds(node.children || [], dropListIdFor)];
  });
}
