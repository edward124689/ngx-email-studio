import { EmailNode } from '../models';

export interface EmailNodeLocation {
  node: EmailNode;
  siblings: EmailNode[];
  index: number;
}

export function findNodeLocation(id: string, siblings: EmailNode[]): EmailNodeLocation | undefined {
  for (let index = 0; index < siblings.length; index += 1) {
    const node = siblings[index];
    if (node.id === id) return { node, siblings, index };
    if (node.children?.length) {
      const nested = findNodeLocation(id, node.children);
      if (nested) return nested;
    }
  }
  return undefined;
}

export function findNode(id: string | undefined, siblings: EmailNode[]): EmailNode | undefined {
  return id ? findNodeLocation(id, siblings)?.node : undefined;
}

export function reseedIds(node: EmailNode, idFactory: (type: string) => string): void {
  node.id = idFactory(node.type);
  node.children?.forEach((child) => reseedIds(child, idFactory));
}

export function nodeContainsId(node: EmailNode, id: string): boolean {
  return (node.children || []).some((child) => child.id === id || nodeContainsId(child, id));
}

export function elementChildren(element: Element): Element[] {
  return Array.from(element.children).filter((child): child is Element => child.nodeType === Node.ELEMENT_NODE);
}
