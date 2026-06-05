import { Editor as TiptapEditor } from '@tiptap/core';

import { EmailNode } from '../models';
import { sanitizeRichTextContent } from './rich-text-sanitizer';
import { TIPTAP_EXTENSIONS } from './tiptap-extensions';

export function createTiptapEditor(args: {
  element: HTMLElement;
  node: EmailNode;
  editable: boolean;
  onUpdate: (editor: TiptapEditor) => void;
}): TiptapEditor {
  const editor = new TiptapEditor({
    element: args.element,
    content: sanitizeRichTextContent(args.node.attrs['content']),
    editable: args.editable,
    extensions: TIPTAP_EXTENSIONS,
    onUpdate: ({ editor }) => args.onUpdate(editor),
  });
  installTiptapBlankClickGuard(args.element, editor);
  return editor;
}

export function syncTiptapContent(editor: TiptapEditor, node: EmailNode, editable: boolean): void {
  const nextContent = sanitizeRichTextContent(node.attrs['content']);
  const currentContent = sanitizeRichTextContent(editor.getHTML());
  if (currentContent !== nextContent) editor.commands.setContent(nextContent, { emitUpdate: false });
  editor.setEditable(editable, false);
}

export function installTiptapBlankClickGuard(element: HTMLElement, editor: TiptapEditor): void {
  let pendingTextClick: { x: number; y: number; pos: number; moved: boolean } | undefined;
  const guardPointer = (event: MouseEvent) => {
    if (event.button !== 0) return;
    const proseMirror = element.querySelector<HTMLElement>('.ProseMirror');
    if (!proseMirror) return;
    const isStructuredTarget = isTiptapStructuredEditorTarget(event.target);
    pendingTextClick = isStructuredTarget ? undefined : tiptapTextSelectionFromPoint(proseMirror, editor, event.clientX, event.clientY);
    if (pendingTextClick) return;
    const contentBottom = tiptapContentBottom(proseMirror);
    const isBlankPanelClick = event.target === element || event.clientY > contentBottom + 4;
    const isWhitespaceInsideEditorClick =
      proseMirror.contains(event.target as Node) &&
      !isStructuredTarget &&
      !isPointInTiptapTextRect(proseMirror, event.clientX, event.clientY);
    if (isBlankPanelClick || isWhitespaceInsideEditorClick) {
      pendingTextClick = undefined;
      event.preventDefault();
      event.stopPropagation();
      editor.view.focus();
    }
  };
  const trackTextDrag = (event: MouseEvent) => {
    if (!pendingTextClick) return;
    const movement = Math.hypot(event.clientX - pendingTextClick.x, event.clientY - pendingTextClick.y);
    if (movement <= 4) return;
    const proseMirror = element.querySelector<HTMLElement>('.ProseMirror');
    if (!proseMirror) return;
    const dragTarget = tiptapSelectionFromViewportPoint(proseMirror, editor, event.clientX, event.clientY);
    if (!dragTarget) return;
    pendingTextClick.moved = true;
    editor.view.focus();
    editor.commands.setTextSelection({
      from: Math.min(pendingTextClick.pos, dragTarget.pos),
      to: Math.max(pendingTextClick.pos, dragTarget.pos),
    });
  };
  const restoreTextClick = (event: MouseEvent) => {
    if (!pendingTextClick) return;
    const textClick = pendingTextClick;
    const movement = Math.hypot(event.clientX - textClick.x, event.clientY - textClick.y);
    const restore = () => {
      editor.view.focus();
      editor.commands.setTextSelection(textClick.pos);
    };
    if (!textClick.moved && movement <= 4) {
      restore();
      requestAnimationFrame(restore);
      setTimeout(restore, 0);
    }
    pendingTextClick = undefined;
  };
  element.addEventListener('pointerdown', guardPointer, true);
  element.addEventListener('mousedown', guardPointer, true);
  element.ownerDocument.addEventListener('pointermove', trackTextDrag, true);
  element.ownerDocument.addEventListener('mousemove', trackTextDrag, true);
  element.addEventListener('click', restoreTextClick, false);
}

export function isTiptapStructuredEditorTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest('table, td, th, img, hr, a'));
}

export function isPointInTiptapTextRect(proseMirror: HTMLElement, clientX: number, clientY: number): boolean {
  const documentRef = proseMirror.ownerDocument;
  const walker = documentRef.createTreeWalker(proseMirror, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => (node.textContent?.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT),
  });
  const range = documentRef.createRange();
  try {
    while (walker.nextNode()) {
      const node = walker.currentNode;
      range.selectNodeContents(node);
      const rects = Array.from(range.getClientRects());
      if (rects.some((rect) => clientY >= rect.top - 3 && clientY <= rect.bottom + 3 && clientX >= rect.left - 3 && clientX <= rect.right + 3)) {
        return true;
      }
    }
    return false;
  } finally {
    range.detach();
  }
}

export function tiptapSelectionFromViewportPoint(proseMirror: HTMLElement, editor: TiptapEditor, clientX: number, clientY: number): { x: number; y: number; pos: number; moved: boolean } | undefined {
  const documentRef = proseMirror.ownerDocument;
  const caretRange = documentRef.caretRangeFromPoint?.(clientX, clientY);
  if (caretRange?.startContainer && proseMirror.contains(caretRange.startContainer)) {
    return tiptapSelectionAtDomOffset(editor, caretRange.startContainer, caretRange.startOffset, clientX, clientY);
  }
  const caretPosition = documentRef.caretPositionFromPoint?.(clientX, clientY);
  if (caretPosition?.offsetNode && proseMirror.contains(caretPosition.offsetNode)) {
    return tiptapSelectionAtDomOffset(editor, caretPosition.offsetNode, caretPosition.offset, clientX, clientY);
  }
  return tiptapTextSelectionFromPoint(proseMirror, editor, clientX, clientY);
}

export function tiptapTextSelectionFromPoint(proseMirror: HTMLElement, editor: TiptapEditor, clientX: number, clientY: number): { x: number; y: number; pos: number; moved: boolean } | undefined {
  if (!isPointInTiptapTextRect(proseMirror, clientX, clientY)) return undefined;
  const documentRef = proseMirror.ownerDocument;
  const walker = documentRef.createTreeWalker(proseMirror, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => (node.textContent?.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT),
  });
  const range = documentRef.createRange();
  try {
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const text = node.textContent || '';
      for (let index = 0; index < text.length; index += 1) {
        range.setStart(node, index);
        range.setEnd(node, index + 1);
        const rects = Array.from(range.getClientRects());
        for (const rect of rects) {
          if (clientY < rect.top - 3 || clientY > rect.bottom + 3) continue;
          if (clientX <= rect.left + rect.width / 2) return tiptapSelectionAtDomOffset(editor, node, index, clientX, clientY);
          if (clientX <= rect.right + 3) return tiptapSelectionAtDomOffset(editor, node, index + 1, clientX, clientY);
        }
      }
    }
    const caretRange = documentRef.caretRangeFromPoint?.(clientX, clientY);
    if (caretRange?.startContainer && proseMirror.contains(caretRange.startContainer)) {
      return tiptapSelectionAtDomOffset(editor, caretRange.startContainer, caretRange.startOffset, clientX, clientY);
    }
    return undefined;
  } finally {
    range.detach();
  }
}

export function tiptapSelectionAtDomOffset(editor: TiptapEditor, node: Node, offset: number, x: number, y: number): { x: number; y: number; pos: number; moved: boolean } | undefined {
  try {
    return { x, y, pos: editor.view.posAtDOM(node, offset), moved: false };
  } catch {
    return undefined;
  }
}

export function tiptapContentBottom(proseMirror: HTMLElement): number {
  const children = Array.from(proseMirror.children) as HTMLElement[];
  const visibleChildren = children.filter((child) => child.getClientRects().length > 0);
  if (!visibleChildren.length) return proseMirror.getBoundingClientRect().top;
  return Math.max(...visibleChildren.map((child) => child.getBoundingClientRect().bottom));
}
