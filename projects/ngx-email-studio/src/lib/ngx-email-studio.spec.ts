import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { EmailDocument, EmailNode, EmailStudioConfig, NgxEmailStudio } from './ngx-email-studio';
import { sanitizeRichTextContent } from './tiptap/rich-text-sanitizer';
import { installTiptapBlankClickGuard } from './tiptap/tiptap-controller';


function studioRoot<T>(fixture: ComponentFixture<T>): ParentNode {
  const host = fixture.nativeElement as HTMLElement;
  return host;
}

function query<T extends Element = Element>(fixture: ComponentFixture<unknown>, selector: string): T | null {
  return studioRoot(fixture).querySelector(selector) as T | null;
}

function queryAll<T extends Element = Element>(fixture: ComponentFixture<unknown>, selector: string): NodeListOf<T> {
  return studioRoot(fixture).querySelectorAll(selector) as NodeListOf<T>;
}

function studioText<T>(fixture: ComponentFixture<T>): string {
  return (studioRoot(fixture) as HTMLElement | ShadowRoot).textContent || '';
}

function findImportedNode(nodes: any[], type: string): any | undefined {
  for (const node of nodes) {
    if (node.type === type) return node;
    const child = findImportedNode(node.children || [], type);
    if (child) return child;
  }
  return undefined;
}

function componentStyleText(): string {
  const styles = ((NgxEmailStudio as any).ɵcmp?.styles || []) as string[];
  return styles
    .join('\n')
    .replace(/\[_ng(?:content|host)-%COMP%\]/g, '')
    .replace(/@keyframes _ngcontent-%COMP%_/g, '@keyframes ');
}

@Component({
  standalone: true,
  imports: [NgxEmailStudio],
  template: `<ngx-email-studio />`,
})
class HostileCssHostComponent {}

@Component({
  standalone: true,
  imports: [NgxEmailStudio],
  template: `<ngx-email-studio /><ngx-email-studio />`,
})
class MultiStudioHostComponent {}

describe('NgxEmailStudio', () => {
  let component: NgxEmailStudio;
  let fixture: ComponentFixture<NgxEmailStudio>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NgxEmailStudio],
    }).compileComponents();

    fixture = TestBed.createComponent(NgxEmailStudio);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should cancel deferred Tiptap click restore callbacks when the editor is destroyed', () => {
    vi.useFakeTimers();
    const element = document.createElement('div');
    element.innerHTML = '<div class="ProseMirror">Hello</div>';
    document.body.appendChild(element);
    const proseMirror = element.querySelector('.ProseMirror')!;
    const originalGetClientRects = Range.prototype.getClientRects;
    const originalRequestAnimationFrame = globalThis.requestAnimationFrame;
    const originalCancelAnimationFrame = globalThis.cancelAnimationFrame;
    const animationCallbacks = new Map<number, FrameRequestCallback>();
    let animationId = 0;
    const fakeEditor = {
      isDestroyed: false,
      view: {
        focus: vi.fn(() => {
          if (fakeEditor.isDestroyed) throw new Error('destroyed focus');
        }),
        posAtDOM: vi.fn(() => 1),
      },
      commands: {
        setTextSelection: vi.fn(() => {
          if (fakeEditor.isDestroyed) throw new Error('destroyed selection');
        }),
      },
    };

    Range.prototype.getClientRects = () => [{ top: 0, bottom: 20, left: 0, right: 50, width: 50, height: 20 } as DOMRect] as unknown as DOMRectList;
    globalThis.requestAnimationFrame = ((callback: FrameRequestCallback) => {
      animationId += 1;
      animationCallbacks.set(animationId, callback);
      return animationId;
    }) as typeof globalThis.requestAnimationFrame;
    globalThis.cancelAnimationFrame = ((id: number) => {
      animationCallbacks.delete(id);
    }) as typeof globalThis.cancelAnimationFrame;

    try {
      const cleanup = installTiptapBlankClickGuard(element, fakeEditor as any);
      proseMirror.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0, clientX: 5, clientY: 5 }));
      proseMirror.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, clientX: 5, clientY: 5 }));

      expect(fakeEditor.view.focus).toHaveBeenCalledTimes(1);
      expect(fakeEditor.commands.setTextSelection).toHaveBeenCalledTimes(1);
      cleanup();
      fakeEditor.isDestroyed = true;
      expect(() => {
        for (const callback of animationCallbacks.values()) callback(0);
        vi.runAllTimers();
      }).not.toThrow();
      expect(fakeEditor.view.focus).toHaveBeenCalledTimes(1);
      expect(fakeEditor.commands.setTextSelection).toHaveBeenCalledTimes(1);
    } finally {
      Range.prototype.getClientRects = originalGetClientRects;
      globalThis.requestAnimationFrame = originalRequestAnimationFrame;
      globalThis.cancelAnimationFrame = originalCancelAnimationFrame;
      element.remove();
      vi.useRealTimers();
    }
  });

  it('should clear pending Tiptap drag state after aborted text drags', () => {
    const element = document.createElement('div');
    element.innerHTML = '<div class="ProseMirror">Hello</div>';
    document.body.appendChild(element);
    const proseMirror = element.querySelector('.ProseMirror')!;
    const originalGetClientRects = Range.prototype.getClientRects;
    const fakeEditor = {
      isDestroyed: false,
      view: {
        focus: vi.fn(),
        posAtDOM: vi.fn(() => 1),
      },
      commands: {
        setTextSelection: vi.fn(),
      },
    };

    Range.prototype.getClientRects = () => [{ top: 0, bottom: 20, left: 0, right: 50, width: 50, height: 20 } as DOMRect] as unknown as DOMRectList;
    try {
      const cleanup = installTiptapBlankClickGuard(element, fakeEditor as any);
      proseMirror.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0, clientX: 5, clientY: 5 }));
      document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, cancelable: true, buttons: 1, clientX: 200, clientY: 200 }));
      document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, button: 0, clientX: 200, clientY: 200 }));
      document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, cancelable: true, buttons: 0, clientX: 10, clientY: 10 }));

      expect(fakeEditor.commands.setTextSelection).not.toHaveBeenCalled();
      cleanup();
    } finally {
      Range.prototype.getClientRects = originalGetClientRects;
      element.remove();
    }
  });

  it('should not collapse Tiptap native multi-click selections with deferred single-click restores', () => {
    vi.useFakeTimers();
    const element = document.createElement('div');
    element.innerHTML = '<div class="ProseMirror">Hello</div>';
    document.body.appendChild(element);
    const proseMirror = element.querySelector('.ProseMirror')!;
    const originalGetClientRects = Range.prototype.getClientRects;
    const fakeEditor = {
      isDestroyed: false,
      view: {
        focus: vi.fn(),
        posAtDOM: vi.fn(() => 1),
      },
      commands: {
        setTextSelection: vi.fn(),
      },
    };

    Range.prototype.getClientRects = () => [{ top: 0, bottom: 20, left: 0, right: 50, width: 50, height: 20 } as DOMRect] as unknown as DOMRectList;
    try {
      const cleanup = installTiptapBlankClickGuard(element, fakeEditor as any);
      proseMirror.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0, clientX: 5, clientY: 5 }));
      proseMirror.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, clientX: 5, clientY: 5, detail: 1 }));
      expect(fakeEditor.commands.setTextSelection).toHaveBeenCalledTimes(1);

      proseMirror.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0, clientX: 5, clientY: 5 }));
      proseMirror.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, clientX: 5, clientY: 5, detail: 2 }));
      vi.runAllTimers();

      expect(fakeEditor.commands.setTextSelection).toHaveBeenCalledTimes(1);
      cleanup();
    } finally {
      Range.prototype.getClientRects = originalGetClientRects;
      element.remove();
      vi.useRealTimers();
    }
  });

  it('should put Save at the right side and allow hosts to hide it', () => {
    fixture.detectChanges();
    const actions = Array.from(queryAll<HTMLButtonElement>(fixture, '.nes-actions > button, .nes-actions > .nes-export > button'));
    expect(actions.map((button) => button.textContent?.trim().replace(/\s+/g, ' '))).toEqual(['Transform', 'Import', 'Export', 'Save']);
    expect(actions.at(-1)?.classList.contains('nes-save-trigger')).toBe(true);

    const hiddenFixture = TestBed.createComponent(NgxEmailStudio);
    hiddenFixture.componentRef.setInput('showSave', false);
    hiddenFixture.detectChanges();
    expect(query(hiddenFixture, '.nes-save-trigger')).toBeNull();

    const configHiddenFixture = TestBed.createComponent(NgxEmailStudio);
    configHiddenFixture.componentRef.setInput('config', { showSave: false });
    configHiddenFixture.detectChanges();
    expect(query(configHiddenFixture, '.nes-save-trigger')).toBeNull();
  });


  it('should show a data set action only when merge tags are provided', () => {
    fixture.detectChanges();
    expect(query(fixture, '.nes-data-set-trigger')).toBeNull();

    fixture.componentRef.setInput('dataSet', [
      { key: '  {%CLIENT_NAME%}  ', desc: 'Client name' },
      { key: '', desc: 'Ignored empty key' },
    ]);
    fixture.detectChanges();

    const actions = Array.from(queryAll<HTMLButtonElement>(fixture, '.nes-actions > button, .nes-actions > .nes-export > button'));
    expect(actions.map((button) => button.textContent?.trim().replace(/\s+/g, ' '))).toEqual(['Data set', 'Transform', 'Import', 'Export', 'Save']);
    expect(component.normalizedDataSet).toEqual([{ key: '{%CLIENT_NAME%}', desc: 'Client name' }]);
  });

  it('should open the data set modal and filter by key or description', async () => {
    fixture.componentRef.setInput('dataSet', [
      { key: '{%CLIENT_NAME%}', desc: 'Client name' },
      { key: '{%ORDER_ID%}', desc: 'Order ID' },
    ]);
    fixture.detectChanges();

    query<HTMLButtonElement>(fixture, '.nes-data-set-trigger')?.click();
    fixture.detectChanges();
    expect(query(fixture, '.nes-data-set-modal')).toBeTruthy();
    expect(studioText(fixture)).toContain('{%CLIENT_NAME%}');
    expect(studioText(fixture)).toContain('{%ORDER_ID%}');

    const search = query<HTMLInputElement>(fixture, '.nes-data-set-search input');
    search!.value = 'client';
    search!.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(studioText(fixture)).toContain('{%CLIENT_NAME%}');
    expect(studioText(fixture)).not.toContain('{%ORDER_ID%}');
  });

  it('should copy a data set key only after clipboard success', async () => {
    const originalClipboard = globalThis.navigator.clipboard;
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(globalThis.navigator, 'clipboard', { configurable: true, value: { writeText } });

    try {
      fixture.componentRef.setInput('dataSet', [{ key: '{%CLIENT_NAME%}', desc: 'Client name' }]);
      fixture.detectChanges();
      query<HTMLButtonElement>(fixture, '.nes-data-set-trigger')?.click();
      fixture.detectChanges();

      query<HTMLButtonElement>(fixture, '.nes-copy-btn')?.click();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(writeText).toHaveBeenCalledWith('{%CLIENT_NAME%}');
      expect(studioText(fixture)).toContain('Copied');
    } finally {
      Object.defineProperty(globalThis.navigator, 'clipboard', { configurable: true, value: originalClipboard });
    }
  });

  it('should show data set copy failure when clipboard and fallback copy fail', async () => {
    const originalClipboard = globalThis.navigator.clipboard;
    const originalExecCommand = document.execCommand;
    Object.defineProperty(globalThis.navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } });
    Object.defineProperty(document, 'execCommand', { configurable: true, value: vi.fn(() => false) });

    try {
      fixture.componentRef.setInput('dataSet', [{ key: '{%CLIENT_NAME%}', desc: 'Client name' }]);
      fixture.detectChanges();
      query<HTMLButtonElement>(fixture, '.nes-data-set-trigger')?.click();
      fixture.detectChanges();

      query<HTMLButtonElement>(fixture, '.nes-copy-btn')?.click();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(studioText(fixture)).toContain('Copy failed');
    } finally {
      Object.defineProperty(globalThis.navigator, 'clipboard', { configurable: true, value: originalClipboard });
      Object.defineProperty(document, 'execCommand', { configurable: true, value: originalExecCommand });
    }
  });


  it('should default transform to whole email while preserving merge tags and attributes', async () => {
    const document: EmailDocument = {
      version: '1',
      body: [
        { id: 'text1', type: 'text', attrs: { content: '<p>简体发票 {%CLIENT_NAME%}<a href="/汉">链接</a></p>' } },
        { id: 'button1', type: 'button', attrs: { label: '查看发票', href: '/checkout' } },
      ],
    };
    fixture.componentRef.setInput('document', document);
    fixture.detectChanges();
    component.selectedNodeId = 'text1';
    (component as any).resetDocumentHistory();
    fixture.detectChanges();

    component.openTransformModal();
    await (component as any).refreshTransformPreview();
    fixture.detectChanges();

    expect(component.transformModalOpen).toBe(true);
    expect(component.transformScope).toBe('document');
    expect(studioText(fixture)).toContain('Whole email');
    expect(studioText(fixture)).not.toContain('Selected text/button block');
    expect(component.transformPreview?.before).toContain('简体发票');
    expect(component.transformPreview?.before).toContain('查看发票');
    expect(component.transformPreview?.after).toContain('簡體發票');
    expect(component.transformPreview?.after).toContain('查看發票');
    expect(component.transformPreview?.after).toContain('{%CLIENT_NAME%}');

    await component.applyTransform();
    await fixture.whenStable();

    const textNode = component.emailDocument.body[0];
    const buttonNode = component.emailDocument.body[1];
    expect(textNode.attrs['content']).toContain('簡體發票');
    expect(textNode.attrs['content']).toContain('{%CLIENT_NAME%}');
    expect(textNode.attrs['content']).toContain('href="/汉"');
    expect(buttonNode.attrs['label']).toBe('查看發票');

    component.undoDocument();
    expect(component.emailDocument.body[0].attrs['content']).toContain('简体发票');
  });

  it('should transform whole email text blocks and button labels', async () => {
    const document: EmailDocument = {
      version: '1',
      body: [
        { id: 'text1', type: 'text', attrs: { content: '<p>优惠发票</p>' } },
        { id: 'button1', type: 'button', attrs: { label: '查看发票', href: '/发票' } },
      ],
    };
    fixture.componentRef.setInput('document', document);
    fixture.detectChanges();
    component.selectedNodeId = 'text1';
    (component as any).resetDocumentHistory();

    component.transformModalOpen = true;
    component.transformScope = 'document';
    await (component as any).refreshTransformPreview();
    await component.applyTransform();
    await fixture.whenStable();

    expect(component.emailDocument.body[0].attrs['content']).toContain('優惠發票');
    expect(component.emailDocument.body[1].attrs['label']).toBe('查看發票');
    expect(component.emailDocument.body[1].attrs['href']).toBe('/发票');
  });

  it('should normalize spacing and block transform apply in readonly mode', async () => {
    const document: EmailDocument = {
      version: '1',
      body: [{ id: 'text1', type: 'text', attrs: { content: '<p>Hello   ,   world</p>' } }],
    };
    fixture.componentRef.setInput('document', document);
    fixture.detectChanges();
    component.selectedNodeId = 'text1';
    (component as any).resetDocumentHistory();

    component.transformModalOpen = true;
    component.transformAction = 'normalize-spaces';
    await (component as any).refreshTransformPreview();
    await component.applyTransform();
    expect(component.emailDocument.body[0].attrs['content']).toContain('Hello, world');

    fixture.componentRef.setInput('readonly', true);
    fixture.detectChanges();
    component.openTransformModal();
    expect(component.transformModalOpen).toBe(false);
    expect(query<HTMLButtonElement>(fixture, '.nes-transform-trigger')?.disabled).toBe(true);
  });

  it('should avoid merge-token collisions and preserve malformed or ignored HTML text safely', async () => {
    const document: EmailDocument = {
      version: '1',
      body: [
        { id: 'text1', type: 'text', attrs: { content: '<p>literal __NES_MERGE_TAG_0__ plus {%CLIENT_NAME%}</p>' } },
        { id: 'text2', type: 'text', attrs: { content: '</div><p>汉语 outside</p><script>汉语 script</script><style>.x{font-family:"汉"}</style>' } },
      ],
    };
    fixture.componentRef.setInput('document', document);
    fixture.detectChanges();
    component.transformModalOpen = true;
    component.transformAction = 'simplified-to-traditional';

    await (component as any).refreshTransformPreview();
    await component.applyTransform();

    const first = String(component.emailDocument.body[0].attrs['content']);
    const second = String(component.emailDocument.body[1].attrs['content']);
    expect(first).toContain('literal __NES_MERGE_TAG_0__ plus {%CLIENT_NAME%}');
    expect(first.match(/\{%CLIENT_NAME%\}/g)?.length).toBe(1);
    expect(second).toContain('漢語 outside');
    expect(second).toContain('汉语 script');
    expect(second).toContain('font-family:"汉"');
  });

  it('should emit structured save and change payloads', () => {
    fixture.detectChanges();
    const saveSpy = vi.fn();
    const changeSpy = vi.fn();
    component.save.subscribe(saveSpy);
    component.change.subscribe(changeSpy);

    query<HTMLButtonElement>(fixture, '.nes-save-trigger')?.click();
    expect(saveSpy).toHaveBeenCalledTimes(1);
    expect(saveSpy.mock.calls[0][0]).toEqual({ mjml: expect.stringContaining('<mjml>'), html: { html: expect.stringContaining('<!doctype html>') } });
    expect(changeSpy).not.toHaveBeenCalled();

    const textNode = component.emailDocument.body[0]?.children?.[0] || component.emailDocument.body[0];
    component.updateAttr(textNode, 'content', '<p>Callback copy</p>');
    expect(changeSpy).toHaveBeenCalledTimes(1);
    expect(changeSpy.mock.calls[0][0]).toEqual({ mjml: expect.stringContaining('Callback copy'), html: { html: expect.stringContaining('Callback copy') } });
  });

  it('should expose global undo and redo icon controls with hover labels', () => {
    fixture.detectChanges();
    const undoButton = query<HTMLButtonElement>(fixture, '.nes-history-btn[aria-label="Undo"]');
    const redoButton = query<HTMLButtonElement>(fixture, '.nes-history-btn[aria-label="Redo"]');
    expect(undoButton).toBeTruthy();
    expect(redoButton).toBeTruthy();
    expect(undoButton?.querySelector('.nes-icon.fa-undo')).toBeTruthy();
    expect(redoButton?.querySelector('.nes-icon.fa-repeat')).toBeTruthy();
    expect(undoButton?.disabled).toBe(true);
    expect(redoButton?.disabled).toBe(true);

    const styles = componentStyleText();
    expect(styles).toContain('.nes-history-btn::after');
    expect(styles).toContain('content: attr(aria-label)');
    expect(styles).toContain('.nes-history-btn:hover:not(:disabled)');
    expect(styles).toContain('width: 34px');
    expect(styles).toContain('height: 34px');
  });

  it('should undo and redo document-level edits from the header controls', () => {
    fixture.detectChanges();
    const initialBodyCount = component.emailDocument.body.length;
    fixture.ngZone?.run(() => component.addBlockByType('divider'));
    (component as any).syncHistoryControls();
    expect(component.emailDocument.body.length).toBe(initialBodyCount + 1);
    expect(component.canUndoDocument).toBe(true);

    query<HTMLButtonElement>(fixture, '.nes-history-btn[aria-label="Undo"]')?.click();
    expect(component.emailDocument.body.length).toBe(initialBodyCount);
    expect(component.canRedoDocument).toBe(true);
    (component as any).syncHistoryControls();

    query<HTMLButtonElement>(fixture, '.nes-history-btn[aria-label="Redo"]')?.click();
    expect(component.emailDocument.body.length).toBe(initialBodyCount + 1);
  });

  it('should clear redo history after a new document edit', () => {
    component.addBlockByType('text');
    component.undoDocument();
    expect(component.canRedoDocument).toBe(true);

    component.addBlockByType('button');
    expect(component.canRedoDocument).toBe(false);
    expect(component.canUndoDocument).toBe(true);
  });

  it('should support global keyboard undo and redo without hijacking editable fields', () => {
    const initialBodyCount = component.emailDocument.body.length;
    component.addBlockByType('text');
    expect(component.emailDocument.body.length).toBe(initialBodyCount + 1);

    const undoEvent = new KeyboardEvent('keydown', { key: 'z', metaKey: true, bubbles: true, cancelable: true });
    component.onDocumentKeydown(undoEvent);
    expect(undoEvent.defaultPrevented).toBe(true);
    expect(component.emailDocument.body.length).toBe(initialBodyCount);

    const redoEvent = new KeyboardEvent('keydown', { key: 'Z', metaKey: true, shiftKey: true, bubbles: true, cancelable: true });
    component.onDocumentKeydown(redoEvent);
    expect(redoEvent.defaultPrevented).toBe(true);
    expect(component.emailDocument.body.length).toBe(initialBodyCount + 1);

    component.undoDocument();
    const input = document.createElement('input');
    const editableUndo = new KeyboardEvent('keydown', { key: 'z', metaKey: true, bubbles: true, cancelable: true });
    Object.defineProperty(editableUndo, 'target', { value: input });
    component.onDocumentKeydown(editableUndo);
    expect(editableUndo.defaultPrevented).toBe(false);
    expect(component.canRedoDocument).toBe(true);
  });

  it('should use an input MJML default value as the initial editable document', () => {
    const localFixture = TestBed.createComponent(NgxEmailStudio);
    const inputMjml = '<mjml><mj-body background-color="#101827" width="720px"><mj-section background-color="#ffffff"><mj-column><mj-text align="center"><h1>Input MJML hero</h1><p>Loaded from host input.</p></mj-text></mj-column></mj-section></mj-body></mjml>';
    localFixture.componentRef.setInput('mjml', inputMjml);
    localFixture.detectChanges();
    const localComponent = localFixture.componentInstance;

    expect(studioText(localFixture)).toContain('Input MJML hero');
    expect(localComponent.emailDocument.attrs?.['backgroundColor']).toBe('#101827');
    expect(localComponent.emailWidthCss).toBe('720px');
    expect(localComponent.lastMjml).toContain('Input MJML hero');
    expect(localComponent.lastHtml).toContain('Input MJML hero');
  });

  it('should reset stale host-provided MJML and document inputs when they are cleared', () => {
    const localFixture = TestBed.createComponent(NgxEmailStudio);
    localFixture.componentRef.setInput('mjml', '<mjml><mj-body><mj-section><mj-column><mj-text><p>Host MJML</p></mj-text></mj-column></mj-section></mj-body></mjml>');
    localFixture.detectChanges();
    const localComponent = localFixture.componentInstance;
    expect(localComponent.lastMjml).toContain('Host MJML');

    localFixture.componentRef.setInput('mjml', '');
    localFixture.detectChanges();
    expect(localComponent.lastMjml).not.toContain('Host MJML');
    expect(localComponent.emailDocument.body.length).toBeGreaterThan(0);

    localFixture.componentRef.setInput('document', { version: '0.0.1', body: [{ id: 'host_text', type: 'text', attrs: { content: '<p>Host document</p>' } }] } satisfies EmailDocument);
    localFixture.detectChanges();
    expect(localComponent.lastMjml).toContain('Host document');

    localFixture.componentRef.setInput('document', undefined);
    localFixture.detectChanges();
    expect(localComponent.lastMjml).not.toContain('Host document');
    expect(localComponent.emailDocument.body.length).toBeGreaterThan(0);
  });

  it('should fall back to the still-active host input when either MJML or document is cleared', () => {
    const localFixture = TestBed.createComponent(NgxEmailStudio);
    const inputDocument: EmailDocument = { version: '0.0.1', body: [{ id: 'host_doc_text', type: 'text', attrs: { content: '<p>Still active document</p>' } }] };
    const inputMjml = '<mjml><mj-body><mj-section><mj-column><mj-text><p>Still active MJML</p></mj-text></mj-column></mj-section></mj-body></mjml>';

    localFixture.componentRef.setInput('document', inputDocument);
    localFixture.componentRef.setInput('mjml', inputMjml);
    localFixture.detectChanges();
    const localComponent = localFixture.componentInstance;
    expect(localComponent.lastMjml).toContain('Still active MJML');
    expect(localComponent.lastMjml).not.toContain('Still active document');

    localFixture.componentRef.setInput('document', undefined);
    localFixture.detectChanges();
    expect(localComponent.lastMjml).toContain('Still active MJML');

    localFixture.componentRef.setInput('document', inputDocument);
    localFixture.componentRef.setInput('mjml', '');
    localFixture.detectChanges();
    expect(localComponent.lastMjml).toContain('Still active document');
    expect(localComponent.lastMjml).not.toContain('Still active MJML');
  });

  it('should close transient modals and editors when host input replaces the document', () => {
    const localFixture = TestBed.createComponent(NgxEmailStudio);
    localFixture.detectChanges();
    const localComponent = localFixture.componentInstance;
    const textNode = localComponent.emailDocument.body[0].children?.[0] || localComponent.emailDocument.body[0];

    localComponent.openImportModal();
    localComponent.openOutputModal('mjml');
    localComponent.openRichTextModal(textNode);
    localComponent.selectNode(textNode.id);
    localComponent.openRichTextSource('inline');
    localComponent.exportMenuOpen = true;
    localComponent.copyState = 'Copied';

    expect(localComponent.importModalOpen).toBe(true);
    expect(localComponent.outputModalType).toBe('mjml');
    expect(localComponent.expandedRichTextNode).toBeTruthy();
    expect(localComponent.sourceEditorScope).toBe('inline');

    localFixture.componentRef.setInput('document', {
      version: '0.0.1',
      body: [{ id: 'replacement_text', type: 'text', attrs: { content: '<p>Replacement</p>' } }],
    } satisfies EmailDocument);
    localFixture.detectChanges();

    expect(localComponent.importModalOpen).toBe(false);
    expect(localComponent.outputModalType).toBeNull();
    expect(localComponent.expandedRichTextNode).toBeUndefined();
    expect(localComponent.sourceEditorScope).toBeNull();
    expect(localComponent.exportMenuOpen).toBe(false);
    expect(localComponent.copyState).toBe('');
    expect(localComponent.lastMjml).toContain('Replacement');
  });

  it('should render the builder in the light DOM host', () => {
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).shadowRoot).toBeNull();
    expect(query(fixture, '.nes-shell')).toBeTruthy();
  });

  it('should keep CDK drop-list ids unique across component instances', () => {
    const hostFixture = TestBed.createComponent(MultiStudioHostComponent);
    hostFixture.detectChanges();

    const hosts = hostFixture.nativeElement.querySelectorAll('ngx-email-studio') as NodeListOf<HTMLElement>;
    expect(hosts.length).toBe(2);
    const firstPaletteId = hosts[0].querySelector('.nes-block-list')?.id || '';
    const secondPaletteId = hosts[1].querySelector('.nes-block-list')?.id || '';
    const firstCanvasId = hosts[0].querySelector('.nes-canvas')?.id || '';
    const secondCanvasId = hosts[1].querySelector('.nes-canvas')?.id || '';

    expect(firstPaletteId).toMatch(/^nes-\d+-palette-drop-list$/);
    expect(secondPaletteId).toMatch(/^nes-\d+-palette-drop-list$/);
    expect(firstPaletteId).not.toBe(secondPaletteId);
    expect(firstCanvasId).not.toBe(secondCanvasId);
  });

  it('should default email width to 100% and max-width to 600px', () => {
    fixture.detectChanges();
    (component as any).refreshOutputs(false);

    expect(component.emailWidth).toBe(100);
    expect(component.emailWidthCss).toBe('100%');
    expect(component.emailMaxWidthCss).toBe('600px');
    expect(component.emailCanvasWidthCss).toBe('100%');
    expect(component.emailCanvasMaxWidthCss).toBe('min(100%, 600px)');
    expect(component.lastMjml).toContain('<mj-body background-color="#ffffff" width="100%">');
    expect(component.lastHtml).toContain('background:#ffffff;');
    expect(component.documentColorText('backgroundColor')).toBe('#ffffff');
    expect(component.lastHtml).toContain('width="100%"');
    expect(component.lastHtml).toContain('style="width:100%;max-width:600px;');
    expect(component.lastHtml).toContain('border-radius:16px;overflow:hidden;');
    expect(component.emailBorderRadiusCss).toBe('16px');
    expect(component.emailBorderStyle).toBe('none');
  });

  it('should let body settings control email wrapper border and radius', () => {
    fixture.detectChanges();

    component.updateDocumentAttr('contentBorderRadius', 0);
    component.updateDocumentAttr('contentBorderWidth', 2);
    component.updateDocumentColorAttr('contentBorderColor', '#ABCDEF');
    (component as any).refreshOutputs(false);

    expect(component.emailBorderRadiusCss).toBe('0px');
    expect(component.emailBorderStyle).toBe('2px solid #abcdef');
    expect(component.emailDocument.attrs?.['contentBorderRadius']).toBe(0);
    expect(component.emailDocument.attrs?.['contentBorderWidth']).toBe(2);
    expect(component.emailDocument.attrs?.['contentBorderColor']).toBe('#abcdef');
    expect(component.lastHtml).toContain('border-radius:0px;border:2px solid #abcdef;overflow:hidden;');
  });

  it('should let body settings control the email typography with Ubuntu 13px defaults', () => {
    fixture.detectChanges();
    (component as any).refreshOutputs(false);

    expect(component.emailFontSizeCss).toBe('13px');
    expect(component.emailFontFamilyCss).toBe('Ubuntu, Helvetica, Arial, sans-serif');
    const canvas = fixture.nativeElement.querySelector('.nes-canvas') as HTMLElement;
    expect(canvas.style.fontSize).toBe('13px');
    expect(canvas.style.fontFamily).toBe('Ubuntu, Helvetica, Arial, sans-serif');
    expect(component.lastHtml).toContain('<!--[if !mso]><!-->');
    expect(component.lastHtml).toContain('<link href="https://fonts.googleapis.com/css?family=Ubuntu:300,400,500,700" rel="stylesheet" type="text/css">');
    expect(component.lastHtml).toContain('@import url(https://fonts.googleapis.com/css?family=Ubuntu:300,400,500,700);');
    expect(component.lastHtml).toContain('font-family:Ubuntu, Helvetica, Arial, sans-serif;font-size:13px;');

    component.updateDocumentAttr('contentFontSize', 16);
    component.updateDocumentFontFamilyAttr('contentFontFamily', 'Georgia, serif');
    (component as any).refreshOutputs(false);

    expect(component.emailFontSizeCss).toBe('16px');
    expect(component.emailFontFamilyCss).toBe('Georgia, serif');
    expect(component.emailDocument.attrs?.['contentFontSize']).toBe(16);
    expect(component.emailDocument.attrs?.['contentFontFamily']).toBe('Georgia, serif');
    expect(component.lastHtml).not.toContain('fonts.googleapis.com/css?family=Ubuntu');
    expect(component.lastHtml).toContain('font-family:Georgia, serif;font-size:16px;');
  });

  it('should default body background to lowercase white while blocks stay transparent until set', () => {
    const document: EmailDocument = {
      version: '0.0.1',
      body: [
        {
          id: 'row_transparent',
          type: 'row',
          attrs: {},
          children: [
            {
              id: 'column_transparent',
              type: 'column',
              attrs: { width: '100%' },
              children: [{ id: 'text_transparent', type: 'text', attrs: { content: '<p>Transparent</p>' } }],
            },
          ],
        },
      ],
    };

    const mjml = (component as any).compileMjml(document) as string;
    const html = (component as any).renderHtml(document) as string;

    expect(mjml).toContain('<mj-body background-color="#ffffff" width="100%">');
    expect(mjml).not.toContain('<mj-section background-color=');
    expect(mjml).not.toContain('<mj-column background-color=');
    expect(mjml).not.toContain('<mj-text background-color=');
    expect(mjml).not.toContain('background-color="#FFFFFF"');
    expect(html).toContain('<body style="margin:0;padding:0;background:#ffffff;word-spacing:normal;">');
    expect(html).not.toContain('background:#FFFFFF');
  });

  it('should normalize hex colors to lowercase and let color text inputs clear backgrounds', () => {
    const textNode: EmailNode = { id: 'text_color', type: 'text', attrs: { content: '<p>Color</p>' } };

    component.updateColorAttr(textNode, 'backgroundColor', '#FFFFFF');
    expect(textNode.attrs['backgroundColor']).toBe('#ffffff');
    expect(component.backgroundFor(textNode)).toBe('#ffffff');
    expect((component as any).compileMjml({ version: '0.0.1', body: [textNode] })).toContain('background-color="#ffffff"');
    expect((component as any).renderHtml({ version: '0.0.1', body: [textNode] })).toContain('background:#ffffff;');

    component.updateColorAttr(textNode, 'backgroundColor', '');
    expect(textNode.attrs['backgroundColor']).toBeUndefined();
    expect(component.backgroundFor(textNode)).toBe('transparent');
    expect(component.colorText(textNode, 'backgroundColor')).toBe('');
    expect((component as any).compileMjml({ version: '0.0.1', body: [textNode] })).toContain('<mj-body background-color="#ffffff" width="100%">');
    expect((component as any).compileMjml({ version: '0.0.1', body: [textNode] })).not.toContain('<mj-text background-color=');
  });

  it('should let document color inputs override body defaults with explicit transparent values', () => {
    component.emailDocument = { version: '0.0.1', attrs: {}, body: [] };

    expect(component.documentColorText('backgroundColor')).toBe('#ffffff');
    expect((component as any).compileMjml(component.emailDocument)).toContain('<mj-body background-color="#ffffff" width="100%">');

    component.updateDocumentColorAttr('backgroundColor', '');

    expect(component.emailDocument.attrs?.['backgroundColor']).toBe('');
    expect(component.documentColorText('backgroundColor')).toBe('');
    expect((component as any).compileMjml(component.emailDocument)).toContain('<mj-body width="100%">');
    expect((component as any).compileMjml(component.emailDocument)).not.toContain('<mj-body background-color=');
    expect((component as any).renderHtml(component.emailDocument)).toContain('<body style="margin:0;padding:0;word-spacing:normal;">');
  });

  it('should merge body defaults for host-provided documents without mutating transparent block defaults', () => {
    component.document = {
      version: '0.0.1',
      attrs: { width: 100, widthUnit: '%' },
      body: [{ id: 'host_section', type: 'section', attrs: {}, children: [] }],
    };

    component.ngOnChanges({ document: { currentValue: component.document, previousValue: undefined, firstChange: true, isFirstChange: () => true } });

    expect(component.documentColorText('backgroundColor')).toBe('#ffffff');
    expect(component.bodyBackgroundColor).toBe('#ffffff');
    expect(component.backgroundFor(component.emailDocument.body[0])).toBe('transparent');
    expect(component.lastMjml).toContain('<mj-body background-color="#ffffff" width="100%">');
    expect(component.lastMjml).not.toContain('<mj-section background-color=');
  });

  it('should preserve explicit transparent body background on host-provided documents', () => {
    component.document = {
      version: '0.0.1',
      attrs: { backgroundColor: '', width: 100, widthUnit: '%' },
      body: [],
    };

    component.ngOnChanges({ document: { currentValue: component.document, previousValue: undefined, firstChange: true, isFirstChange: () => true } });

    expect(component.documentColorText('backgroundColor')).toBe('');
    expect(component.bodyBackgroundColor).toBe('transparent');
    expect(component.lastMjml).toContain('<mj-body width="100%">');
    expect(component.lastMjml).not.toContain('<mj-body background-color=');
  });

  it('should omit unsafe or unsupported color text values from exports', () => {
    const textNode: EmailNode = { id: 'text_unsafe_color', type: 'text', attrs: { content: '<p>Unsafe</p>' } };
    component.updateColorAttr(textNode, 'backgroundColor', 'red;background:url(javascript:alert(1))');

    expect(textNode.attrs['backgroundColor']).toBe('red;background:url(javascript:alert(1))');
    expect((component as any).compileMjml({ version: '0.0.1', body: [textNode] })).not.toContain('red;background');
    expect((component as any).compileMjml({ version: '0.0.1', body: [textNode] })).not.toContain('<mj-text background-color=');
    expect((component as any).renderHtml({ version: '0.0.1', body: [textNode] })).not.toContain('red;background');

    component.updateDocumentColorAttr('backgroundColor', 'red;background:url(javascript:alert(1))');
    expect(component.emailDocument.attrs?.['backgroundColor']).toBe('red;background:url(javascript:alert(1))');
    expect((component as any).compileMjml(component.emailDocument)).not.toContain('<mj-body background-color=');
    expect((component as any).renderHtml(component.emailDocument)).not.toContain('red;background');
  });

  it('should sanitize unsafe image sources and divider border colors in import and export', () => {
    const document: EmailDocument = {
      version: '0.0.1',
      body: [
        { id: 'image_unsafe', type: 'image', attrs: { src: 'javascript:alert(1)', alt: 'Unsafe image' } },
        { id: 'divider_unsafe', type: 'divider', attrs: { borderColor: 'red;background:url(javascript:alert(1))' } },
      ],
    };
    const mjml = (component as any).compileMjml(document) as string;
    const html = (component as any).renderHtml(document) as string;

    expect(mjml).toContain('<mj-image src=""');
    expect(html).toContain('<img src=""');
    expect(mjml).toContain('<mj-divider border-color="#d0d5dd" />');
    expect(html).toContain('border-top:1px solid #d0d5dd');
    expect(`${mjml}\n${html}`).not.toContain('javascript:');
    expect(`${mjml}\n${html}`).not.toContain('red;background');

    const imported = (component as any).parseMjml('<mjml><mj-body><mj-section><mj-column><mj-image src="javascript:alert(1)" alt="Bad" /><mj-divider border-color="red;background:url(javascript:alert(1))" /></mj-column></mj-section></mj-body></mjml>') as EmailDocument;
    const image = findImportedNode(imported.body, 'image');
    const divider = findImportedNode(imported.body, 'divider');
    expect(image?.attrs['src']).toBe('');
    expect(divider?.attrs['borderColor']).toBe('#d0d5dd');
  });

  it('should keep rich-text cell box styles but strip non-round-tripped box styles from normal text', () => {
    const sanitized = sanitizeRichTextContent('<p style="padding: 8px; border-color: #ff0000; border-width: 2px; margin: 10px 0; color: #123456">Text <span style="margin: 20px; color: #654321">Inline</span></p><h2 style="margin-top: 12px">Heading</h2><table><tbody><tr><td style="padding: 8px; border-color: #ff0000; border-width: 2px; border-style: solid; width: 120px; height: 30px; background-color: #00ff00">Cell</td></tr></tbody></table>');

    expect(sanitized).toContain('<p style="margin: 10px 0; color: #123456">Text <span style="color: #654321">Inline</span></p>');
    expect(sanitized).toContain('<h2 style="margin-top: 12px">Heading</h2>');
    expect(sanitized).not.toContain('<p style="padding');
    expect(sanitized).not.toContain('span style="margin');
    expect(sanitized).toContain('padding: 8px');
    expect(sanitized).toContain('border-color: #ff0000');
    expect(sanitized).toContain('border-width: 2px');
    expect(sanitized).toContain('border-style: solid');
    expect(sanitized).toContain('width: 120px');
    expect(sanitized).toContain('height: 30px');
    expect(sanitized).toContain('background-color: #00ff00');
  });

  it('should sanitize children unwrapped from disallowed rich-text containers', () => {
    expect(sanitizeRichTextContent('<div><script>alert(1)</script><p onclick="x()">ok</p></div>')).toBe('<p>ok</p>');
    expect(sanitizeRichTextContent('<foo><img src="x" onerror="evil()"><span onclick="x()">ok</span></foo>')).toBe('<span>ok</span>');
  });

  it('should support pasted rich-text div paragraphs without changing their tag name', () => {
    const sanitized = sanitizeRichTextContent('<div style="margin: 10px 0; color: #123456" onclick="evil()">Line <strong>one</strong></div><div>Line two<br>next</div><div><p>Nested paragraph</p></div>');

    expect(sanitized).toContain('<div style="margin: 10px 0; color: #123456">Line <strong>one</strong></div>');
    expect(sanitized).toContain('<div>Line two<br>next</div>');
    expect(sanitized).toContain('<p>Nested paragraph</p>');
    expect(sanitized).not.toContain('onclick');
  });

  it('should unwrap rich-text divs and inline wrappers that contain indirect block descendants', () => {
    expect(sanitizeRichTextContent('<div><span class="wrapper"><p>Nested paragraph</p></span></div>')).toBe('<p>Nested paragraph</p>');
    expect(sanitizeRichTextContent('<div><span><ul><li>Nested item</li></ul></span></div>')).toBe('<ul><li>Nested item</li></ul>');
  });

  it('should ignore unsupported imported MJML color values while preserving lowercase hex imports', () => {
    const imported = (component as any).parseMjml('<mjml><mj-body background-color="red;background:url(javascript:alert(1))"><mj-section background-color="red;background:url(javascript:alert(1))"><mj-column background-color="#ABCDEF"><mj-text><p>Safe</p></mj-text></mj-column><mj-column background-color="red;background:url(javascript:alert(1))"><mj-text><p>Unsafe column</p></mj-text></mj-column></mj-section></mj-body></mjml>') as EmailDocument;
    const row = imported.body[0];
    const column = row.children?.[0];
    const unsafeColumn = row.children?.[1];

    expect(imported.attrs?.['backgroundColor']).toBe('#ffffff');
    expect(row.attrs['backgroundColor']).toBeUndefined();
    expect(column?.attrs['backgroundColor']).toBe('#abcdef');
    expect(unsafeColumn?.attrs['backgroundColor']).toBeUndefined();
    expect((component as any).compileMjml(imported)).not.toContain('red;background');
    expect((component as any).renderHtml(imported)).not.toContain('red;background');
  });

  it('should import uppercase MJML background colors as lowercase hex values', () => {
    const imported = (component as any).parseMjml('<mjml><mj-body background-color="#FFFFFF"><mj-section background-color="#ABCDEF"><mj-column background-color="#FEDCBA"><mj-button background-color="#123ABC">Go</mj-button></mj-column><mj-column background-color="#AABBCC"><mj-text><p>Side</p></mj-text></mj-column></mj-section></mj-body></mjml>') as EmailDocument;
    const row = imported.body[0];
    const column = row.children?.[0];
    const button = column?.children?.[0];

    expect(imported.attrs?.['backgroundColor']).toBe('#ffffff');
    expect(row.attrs['backgroundColor']).toBe('#abcdef');
    expect(column?.attrs['backgroundColor']).toBe('#fedcba');
    expect(button?.attrs['backgroundColor']).toBe('#123abc');
    expect((component as any).compileMjml(imported)).toContain('background-color="#ffffff"');
    expect((component as any).compileMjml(imported)).toContain('background-color="#abcdef"');
    expect((component as any).compileMjml(imported)).not.toContain('#FFFFFF');
  });

  it('should compile body width/background and row columns to MJML columns', () => {
    const document: EmailDocument = {
      version: '0.0.1',
      attrs: { backgroundColor: '#eef2ff', contentBackgroundColor: '#ffffff', width: 720, widthUnit: 'px' },
      body: [
        {
          id: 'row_1',
          type: 'row',
          attrs: { backgroundColor: '#ffffff' },
          children: [
            {
              id: 'column_1',
              type: 'column',
              attrs: { width: '50%' },
              children: [{ id: 'text_1', type: 'text', attrs: { content: '<p>Left</p>' } }],
            },
            {
              id: 'column_2',
              type: 'column',
              attrs: { width: '50%' },
              children: [{ id: 'button_1', type: 'button', attrs: { label: 'Right', href: '#', backgroundColor: '#7c3aed' } }],
            },
          ],
        },
      ],
    };

    const mjml = (component as any).compileMjml(document) as string;

    expect(mjml).toContain('<mj-body background-color="#eef2ff" width="720px">');
    expect(mjml).toContain('<mj-section background-color="#ffffff">');
    expect(mjml).toContain('<mj-column width="50%"');
    expect(mjml).toContain('<mj-text><p>Left</p></mj-text>');
    expect(mjml).toContain('<mj-button href="#" background-color="#7c3aed" border-radius="10px">Right</mj-button>');
  });

  it('should compile, render, and import left/center/right content alignment', () => {
    const document: EmailDocument = {
      version: '0.0.1',
      body: [
        {
          id: 'section_1',
          type: 'section',
          attrs: { backgroundColor: '#ffffff' },
          children: [
            { id: 'text_1', type: 'text', attrs: { content: '<p>Centered copy</p>', align: 'center' } },
            { id: 'image_1', type: 'image', attrs: { src: 'https://example.com/hero.jpg', alt: 'Hero', align: 'right' } },
            { id: 'button_1', type: 'button', attrs: { label: 'CTA', href: '#', backgroundColor: '#7c3aed', align: 'left' } },
          ],
        },
      ],
    };

    const mjml = (component as any).compileMjml(document) as string;
    const html = (component as any).renderHtml(document) as string;
    const imported = (component as any).parseMjml('<mjml><mj-body><mj-section><mj-column><mj-text align="right"><p>Right text</p></mj-text><mj-image align="center" src="https://example.com/a.jpg" alt="A" /><mj-button align="left" href="#">Go</mj-button></mj-column></mj-section></mj-body></mjml>') as EmailDocument;

    expect(mjml).toContain('<mj-text align="center"><p>Centered copy</p></mj-text>');
    expect(mjml).toContain('<mj-image src="https://example.com/hero.jpg" alt="Hero" align="right" />');
    expect(mjml).toContain('<mj-button href="#" background-color="#7c3aed" border-radius="10px" align="left">CTA</mj-button>');
    expect(html).toContain('text-align:center;');
    expect(html).toContain('text-align:right;');
    expect(html).toContain('text-align:left;');
    const importedSection = imported.body[0];
    expect(importedSection?.type).toBe('section');
    expect(importedSection?.children?.[0].attrs['align']).toBe('right');
    expect(importedSection?.children?.[1].attrs['align']).toBe('center');
    expect(importedSection?.children?.[2].attrs['align']).toBe('left');
  });

  it('should preserve MJML text typography attrs and safe inline email styles', () => {
    const source = '<mjml><mj-body><mj-section><mj-column><mj-text align="left" color="#55575d" font-family="Arial, sans-serif" font-weight="bold" font-size="13px" line-height="22px" padding-bottom="0px" padding-top="0px" padding="10px 25px"><p style="line-height: 18px; margin: 10px 0; text-align: center;font-size:14px;color:#ffffff;font-family:\'Times New Roman\',Helvetica,Arial,sans-serif;font-weight:700">WOMEN&nbsp; | MEN</p></mj-text></mj-column></mj-section></mj-body></mjml>';

    const document = (component as any).parseMjml(source) as EmailDocument;
    const text = document.body[0].children?.[0];
    const mjml = (component as any).compileMjml(document) as string;
    const html = (component as any).renderHtml(document) as string;

    expect(text?.attrs['color']).toBe('#55575d');
    expect(text?.attrs['fontFamily']).toBe('Arial, sans-serif');
    expect(text?.attrs['fontWeight']).toBe('bold');
    expect(text?.attrs['fontSize']).toBe('13px');
    expect(text?.attrs['lineHeight']).toBe('22px');
    expect(String(text?.attrs['content'])).toContain('line-height: 18px');
    expect(String(text?.attrs['content'])).toContain('margin: 10px 0');
    expect(String(text?.attrs['content'])).toContain('color: #ffffff');
    expect(String(text?.attrs['content'])).toContain("font-family: 'Times New Roman',Helvetica,Arial,sans-serif");
    expect(String(text?.attrs['content'])).toContain('font-weight: 700');
    expect(mjml).toContain('color="#55575d"');
    expect(mjml).toContain('font-family="Arial, sans-serif"');
    expect(mjml).toContain('font-weight="bold"');
    expect(mjml).toContain('font-size="13px"');
    expect(mjml).toContain('line-height="22px"');
    expect(mjml).toContain('style="line-height: 18px; margin: 10px 0; text-align: center; font-size: 14px; color: #ffffff; font-family: \'Times New Roman\',Helvetica,Arial,sans-serif; font-weight: 700"');
    expect(html).toContain('font-family:Arial, sans-serif;');
    expect(html).toContain('font-weight:bold;');
    expect(html).toContain('font-size:13px;');
    expect(html).toContain('line-height:22px;');
  });

  it('should import MJML single-column stacked sections without a visible row/column wrapper', () => {
    const mjml = '<mjml><mj-body><mj-section background-color="#000000" padding="0 0 0 0"><mj-column><mj-image src="https://example.com/logo.png" width="180px" padding="10px 25px" /><mj-text padding-bottom="0px" padding-top="0px" padding="10px 25px"><p>WOMEN&nbsp; | MEN</p></mj-text></mj-column></mj-section></mj-body></mjml>';

    const document = (component as any).parseMjml(mjml) as EmailDocument;
    const section = document.body[0];
    const image = section.children?.[0];
    const text = section.children?.[1];

    expect(section.type).toBe('section');
    expect(section.children?.map((child) => child.type)).toEqual(['image', 'text']);
    expect(document.body.some((node) => node.type === 'row')).toBe(false);
    expect(section.attrs['paddingTop']).toBe(0);
    expect(image?.attrs['width']).toBe(180);
    expect(image?.attrs['paddingRight']).toBe(25);
    expect(text?.attrs['paddingBottom']).toBe(0);
    expect((component as any).compileMjml(document)).toContain('padding="0px 25px 0px 25px"');
  });

  it('should import MJML text that contains common HTML named entities', () => {
    const mjml = '<mjml><mj-body><mj-section><mj-column><mj-text><p>WOMEN&nbsp; | &copy; 2026 &unknown;</p></mj-text></mj-column></mj-section></mj-body></mjml>';

    const document = (component as any).parseMjml(mjml) as EmailDocument;
    const text = findImportedNode(document.body, 'text');

    expect(text?.type).toBe('text');
    expect(String(text?.attrs['content'])).toContain('WOMEN');
    expect(String(text?.attrs['content'])).toContain('©');
    expect(String(text?.attrs['content'])).toContain('&amp;unknown;');
  });

  it('should tolerate HTML void tags inside imported MJML text content', () => {
    const document = (component as any).parseMjml('<mjml><mj-body><mj-section><mj-column><mj-text>Hi<br>There</mj-text></mj-column></mj-section></mj-body></mjml>') as EmailDocument;
    const text = findImportedNode(document.body, 'text');

    expect(String(text?.attrs['content'])).toContain('Hi');
    expect(String(text?.attrs['content'])).toContain('There');
    expect(String(text?.attrs['content'])).toContain('<br');
  });

  it('should not treat literal parsererror tags in MJML text as parser failures', () => {
    const document = (component as any).parseMjml('<mjml><mj-body><mj-section><mj-column><mj-text><parsererror>not parser error</parsererror></mj-text></mj-column></mj-section></mj-body></mjml>') as EmailDocument;
    const text = findImportedNode(document.body, 'text');

    expect(String(text?.attrs['content'])).toContain('not parser error');
  });

  it('should compile, render, and import image width settings', () => {
    const imageNode: EmailNode = {
      id: 'image_width',
      type: 'image',
      attrs: { src: 'https://example.com/hero.jpg', alt: 'Hero', align: 'center', width: 320, widthUnit: 'px' },
    };
    const document: EmailDocument = {
      version: '0.0.1',
      body: [{ id: 'section_image', type: 'section', attrs: {}, children: [imageNode] }],
    };

    const localFixture = TestBed.createComponent(NgxEmailStudio);
    const localComponent = localFixture.componentInstance;
    localComponent.emailDocument = document;
    localComponent.selectedNodeId = imageNode.id;
    localFixture.detectChanges();

    const previewImage = query<HTMLImageElement>(localFixture, '.nes-render-image');
    expect(previewImage?.style.width).toBe('320px');
    expect(localComponent.imageWidthCss(imageNode)).toBe('320px');
    expect((localComponent as any).compileMjml(document)).toContain('<mj-image src="https://example.com/hero.jpg" alt="Hero" align="center" width="320px" />');
    expect((localComponent as any).renderHtml(document)).toContain('width="320" style="display:inline-block;max-width:100%;width:320px;');

    const imported = (localComponent as any).parseMjml('<mjml><mj-body><mj-section><mj-column><mj-image src="https://example.com/a.jpg" alt="A" width="45%" /></mj-column></mj-section></mj-body></mjml>') as EmailDocument;
    const importedImage = findImportedNode(imported.body, 'image');
    expect(importedImage?.attrs['width']).toBe(45);
    expect(importedImage?.attrs['widthUnit']).toBe('%');
  });

  it('should hide the image upload helper when config.uploadImage is not provided', () => {
    const imageNode: EmailNode = { id: 'image_upload_hidden', type: 'image', attrs: { src: 'https://example.com/hero.jpg', alt: 'Hero' } };
    fixture.componentRef.setInput('document', { version: '0.0.1', body: [imageNode] } satisfies EmailDocument);
    component.selectedNodeId = imageNode.id;
    fixture.detectChanges();

    expect(studioText(fixture)).not.toContain('Upload image');
    expect(query(fixture, '.nes-image-upload-helper')).toBeNull();
  });

  it('should call config.uploadImage and write the returned URL and alt text to the image block', async () => {
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:local-preview') });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
    const imageNode: EmailNode = { id: 'image_upload', type: 'image', attrs: { src: 'https://example.com/old.jpg', alt: 'Old alt' } };
    const handler = vi.fn(async (file: File, context: { nodeId: string; currentUrl?: string; currentAlt?: string }) => {
      expect(file.name).toBe('hero.png');
      expect(context).toEqual({ nodeId: 'image_upload', currentUrl: 'https://example.com/old.jpg', currentAlt: 'Old alt' });
      return { url: 'https://cdn.example.com/hero.png', alt: 'Uploaded hero' };
    });
    fixture.componentRef.setInput('document', { version: '0.0.1', body: [imageNode] } satisfies EmailDocument);
    fixture.componentRef.setInput('config', { uploadImage: handler });
    component.selectedNodeId = imageNode.id;
    fixture.detectChanges();
    const activeImage = component.emailDocument.body[0];
    (component as any).resetDocumentHistory();
    fixture.detectChanges();

    expect(studioText(fixture)).toContain('Upload image');
    expect(query<HTMLInputElement>(fixture, '.nes-file-input')?.getAttribute('accept')).toBe('image/png,image/jpeg,image/webp,image/gif');
    expect(query<HTMLInputElement>(fixture, '.nes-file-input')?.getAttribute('tabindex')).toBe('-1');
    const file = new File(['image-bytes'], 'hero.png', { type: 'image/png' });
    await component.uploadImageForNode(activeImage, { target: { files: { 0: file, length: 1, item: (index: number) => (index === 0 ? file : null) }, value: 'hero.png' } } as unknown as Event);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(activeImage.attrs['src']).toBe('https://cdn.example.com/hero.png');
    expect(activeImage.attrs['alt']).toBe('Uploaded hero');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:local-preview');
    expect(component.imagePreviewSrc(activeImage)).toBe('https://cdn.example.com/hero.png');
    expect(component.canUndoDocument).toBe(true);
    component.undoDocument();
    expect(component.emailDocument.body[0].attrs['src']).toBe('https://example.com/old.jpg');
  });

  it('should upload custom logos for social links and export them as social images', async () => {
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:social-logo-preview') });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
    const socialNode: EmailNode = {
      id: 'social_upload',
      type: 'social',
      attrs: {
        items: JSON.stringify([{ name: 'facebook', href: 'https://example.com/fb', backgroundColor: '#A1A0A0' }]),
      },
    };
    const handler = vi.fn(async (file: File, context: { nodeId: string; currentUrl?: string; currentAlt?: string }) => {
      expect(file.name).toBe('facebook.png');
      expect(context).toEqual({ nodeId: 'social_upload:0', currentUrl: '', currentAlt: 'facebook' });
      return { url: 'https://cdn.example.com/facebook.png', alt: 'Facebook logo' };
    });
    fixture.componentRef.setInput('document', { version: '0.0.1', body: [socialNode] } satisfies EmailDocument);
    fixture.componentRef.setInput('config', { uploadImage: handler });
    component.selectedNodeId = socialNode.id;
    fixture.detectChanges();
    const activeSocial = component.emailDocument.body[0];

    expect(studioText(fixture)).toContain('Upload logo');
    const input = query<HTMLInputElement>(fixture, '.nes-social-logo-upload-input');
    expect(input?.getAttribute('accept')).toBe('image/png,image/jpeg,image/webp,image/gif');
    expect(input?.getAttribute('tabindex')).toBe('-1');

    const file = new File(['image-bytes'], 'facebook.png', { type: 'image/png' });
    await component.uploadSocialLogoForItem(activeSocial, 0, { target: { files: { 0: file, length: 1, item: (index: number) => (index === 0 ? file : null) }, value: 'facebook.png' } } as unknown as Event);

    expect(handler).toHaveBeenCalledTimes(1);
    const item = JSON.parse(String(activeSocial.attrs['items']))[0];
    expect(item.logoUrl).toBe('https://cdn.example.com/facebook.png');
    expect(item.name).toBe('Facebook logo');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:social-logo-preview');
    expect((component as any).compileMjml({ version: '0.0.1', body: [activeSocial] })).toContain('src="https://cdn.example.com/facebook.png"');
    const html = (component as any).renderHtml({ version: '0.0.1', body: [activeSocial] });
    const imgTag = html.match(/<img[^>]+src="https:\/\/cdn\.example\.com\/facebook\.png"[^>]*>/)?.[0] || '';
    expect(imgTag).toContain('<img src="https://cdn.example.com/facebook.png"');
    expect(imgTag).not.toContain('border-radius');
  });

  it('should keep the existing image URL when upload fails or the helper returns an unsafe URL', async () => {
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:unsafe-preview') });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
    const imageNode: EmailNode = { id: 'image_upload_fail', type: 'image', attrs: { src: 'https://example.com/original.jpg', alt: 'Original' } };
    const errorSpy = vi.spyOn(component.error, 'emit');
    fixture.componentRef.setInput('document', { version: '0.0.1', body: [imageNode] } satisfies EmailDocument);
    fixture.componentRef.setInput('config', { uploadImage: async () => 'javascript:alert(1)' });
    component.selectedNodeId = imageNode.id;
    fixture.detectChanges();
    const activeImage = component.emailDocument.body[0];

    const file = new File(['image-bytes'], 'bad.png', { type: 'image/png' });
    await component.uploadImageForNode(activeImage, { target: { files: { 0: file, length: 1, item: (index: number) => (index === 0 ? file : null) }, value: 'bad.png' } } as unknown as Event);

    expect(activeImage.attrs['src']).toBe('https://example.com/original.jpg');
    expect(component.imageUploadErrorFor(activeImage)).toContain('safe image URL');
    expect(component.imagePreviewSrc(activeImage)).toBe('https://example.com/original.jpg');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:unsafe-preview');
    expect(errorSpy).toHaveBeenCalledWith(expect.objectContaining({ code: 'image_upload_failed' }));
  });

  it('should clear local previews and keep the existing image URL when the upload hook rejects', async () => {
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:reject-preview') });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
    const imageNode: EmailNode = { id: 'image_upload_reject', type: 'image', attrs: { src: 'https://example.com/original.jpg', alt: 'Original' } };
    const errorSpy = vi.spyOn(component.error, 'emit');
    fixture.componentRef.setInput('document', { version: '0.0.1', body: [imageNode] } satisfies EmailDocument);
    fixture.componentRef.setInput('config', { uploadImage: async () => { throw new Error('Upload API failed.'); } });
    component.selectedNodeId = imageNode.id;
    fixture.detectChanges();
    const activeImage = component.emailDocument.body[0];

    const file = new File(['image-bytes'], 'broken.png', { type: 'image/png' });
    await component.uploadImageForNode(activeImage, { target: { files: { 0: file, length: 1, item: (index: number) => (index === 0 ? file : null) }, value: 'broken.png' } } as unknown as Event);

    expect(activeImage.attrs['src']).toBe('https://example.com/original.jpg');
    expect(component.imageUploadErrorFor(activeImage)).toBe('Upload API failed.');
    expect(component.imagePreviewSrc(activeImage)).toBe('https://example.com/original.jpg');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:reject-preview');
    expect(errorSpy).toHaveBeenCalledWith(expect.objectContaining({ code: 'image_upload_failed', message: 'Upload API failed.' }));
  });

  it('should ignore stale upload completions when the image node is no longer in the current document', async () => {
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:stale-preview') });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
    let resolveUpload!: (value: string) => void;
    const handler = vi.fn(() => new Promise<string>((resolve) => { resolveUpload = resolve; }));
    const imageNode: EmailNode = { id: 'image_upload_stale', type: 'image', attrs: { src: 'https://example.com/original.jpg', alt: 'Original' } };
    fixture.componentRef.setInput('document', { version: '0.0.1', body: [imageNode] } satisfies EmailDocument);
    fixture.componentRef.setInput('config', { uploadImage: handler });
    component.selectedNodeId = imageNode.id;
    fixture.detectChanges();
    const activeImage = component.emailDocument.body[0];

    const file = new File(['image-bytes'], 'stale.png', { type: 'image/png' });
    const pending = component.uploadImageForNode(activeImage, { target: { files: { 0: file, length: 1, item: (index: number) => (index === 0 ? file : null) }, value: 'stale.png' } } as unknown as Event);
    component.emailDocument = { version: '0.0.1', body: [{ id: 'replacement_image', type: 'image', attrs: { src: 'https://example.com/replacement.jpg' } }] };
    component.selectedNodeId = 'replacement_image';
    resolveUpload('https://cdn.example.com/stale.png');
    await pending;

    expect(handler).toHaveBeenCalledTimes(1);
    expect(component.emailDocument.body[0].id).toBe('replacement_image');
    expect(component.emailDocument.body[0].attrs['src']).toBe('https://example.com/replacement.jpg');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:stale-preview');
  });

  it('should invalidate pending uploads when the host replaces the document even if node ids are reused', async () => {
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:reuse-preview') });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
    let resolveUpload!: (value: string) => void;
    const handler = vi.fn(() => new Promise<string>((resolve) => { resolveUpload = resolve; }));
    const imageNode: EmailNode = { id: 'image_upload_reused', type: 'image', attrs: { src: 'https://example.com/original.jpg' } };
    fixture.componentRef.setInput('document', { version: '0.0.1', body: [imageNode] } satisfies EmailDocument);
    fixture.componentRef.setInput('config', { uploadImage: handler });
    component.selectedNodeId = imageNode.id;
    fixture.detectChanges();
    const activeImage = component.emailDocument.body[0];

    const file = new File(['image-bytes'], 'reuse.png', { type: 'image/png' });
    const pending = component.uploadImageForNode(activeImage, { target: { files: { 0: file, length: 1, item: (index: number) => (index === 0 ? file : null) }, value: 'reuse.png' } } as unknown as Event);
    fixture.componentRef.setInput('document', { version: '0.0.1', body: [{ id: 'image_upload_reused', type: 'image', attrs: { src: 'https://example.com/reused-new.jpg' } }] } satisfies EmailDocument);
    fixture.detectChanges();
    resolveUpload('https://cdn.example.com/old-upload.png');
    await pending;

    expect(component.emailDocument.body[0].id).toBe('image_upload_reused');
    expect(component.emailDocument.body[0].attrs['src']).toBe('https://example.com/reused-new.jpg');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:reuse-preview');
  });

  it('should ignore pending upload completions when readonly or upload config changes before completion', async () => {
    let resolveUpload!: (value: string) => void;
    const handler = vi.fn(() => new Promise<string>((resolve) => { resolveUpload = resolve; }));
    const imageNode: EmailNode = { id: 'image_upload_cancel', type: 'image', attrs: { src: 'https://example.com/original.jpg' } };
    fixture.componentRef.setInput('document', { version: '0.0.1', body: [imageNode] } satisfies EmailDocument);
    fixture.componentRef.setInput('config', { uploadImage: handler });
    component.selectedNodeId = imageNode.id;
    fixture.detectChanges();
    const activeImage = component.emailDocument.body[0];

    const file = new File(['image-bytes'], 'cancel.png', { type: 'image/png' });
    const pending = component.uploadImageForNode(activeImage, { target: { files: { 0: file, length: 1, item: (index: number) => (index === 0 ? file : null) }, value: 'cancel.png' } } as unknown as Event);
    fixture.componentRef.setInput('readonly', true);
    fixture.detectChanges();
    resolveUpload('https://cdn.example.com/ignored.png');
    await pending;

    expect(activeImage.attrs['src']).toBe('https://example.com/original.jpg');
    expect(component.isAnyImageUploading()).toBe(false);
  });

  it('should ignore pending upload completions when uploadImage is mutated in-place', async () => {
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:mutated-config-preview') });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
    let resolveUpload!: (value: string) => void;
    const handler = vi.fn(() => new Promise<string>((resolve) => { resolveUpload = resolve; }));
    const config: EmailStudioConfig = { uploadImage: handler };
    const imageNode: EmailNode = { id: 'image_upload_mutated_config', type: 'image', attrs: { src: 'https://example.com/original.jpg' } };
    fixture.componentRef.setInput('document', { version: '0.0.1', body: [imageNode] } satisfies EmailDocument);
    fixture.componentRef.setInput('config', config);
    component.selectedNodeId = imageNode.id;
    fixture.detectChanges();
    const activeImage = component.emailDocument.body[0];

    const pending = component.uploadImageForNode(activeImage, { target: { files: { 0: new File(['image-bytes'], 'mutated.png', { type: 'image/png' }), length: 1, item: () => null }, value: 'mutated.png' } } as unknown as Event);
    config.uploadImage = undefined;
    resolveUpload('https://cdn.example.com/ignored.png');
    await pending;

    expect(activeImage.attrs['src']).toBe('https://example.com/original.jpg');
    expect(component.isAnyImageUploading()).toBe(false);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mutated-config-preview');
  });

  it('should invalidate pending uploads when uploadImage handler is mutated in-place during change detection', async () => {
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:mutated-handler-preview') });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
    let resolveUpload!: (value: string) => void;
    const oldHandler = vi.fn(() => new Promise<string>((resolve) => { resolveUpload = resolve; }));
    const newHandler = vi.fn(async () => 'https://cdn.example.com/new.png');
    const config: EmailStudioConfig = { uploadImage: oldHandler };
    const imageNode: EmailNode = { id: 'image_upload_mutated_handler', type: 'image', attrs: { src: 'https://example.com/original.jpg' } };
    fixture.componentRef.setInput('document', { version: '0.0.1', body: [imageNode] } satisfies EmailDocument);
    fixture.componentRef.setInput('config', config);
    component.selectedNodeId = imageNode.id;
    fixture.detectChanges();
    const activeImage = component.emailDocument.body[0];

    const pending = component.uploadImageForNode(activeImage, { target: { files: { 0: new File(['image-bytes'], 'old.png', { type: 'image/png' }), length: 1, item: () => null }, value: 'old.png' } } as unknown as Event);
    config.uploadImage = newHandler;
    component.ngDoCheck();
    await Promise.resolve();
    resolveUpload('https://cdn.example.com/old.png');
    await pending;

    expect(oldHandler).toHaveBeenCalledTimes(1);
    expect(newHandler).not.toHaveBeenCalled();
    expect(activeImage.attrs['src']).toBe('https://example.com/original.jpg');
    expect(component.isAnyImageUploading()).toBe(false);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mutated-handler-preview');
  });

  it('should block a second image upload while one upload is pending', async () => {
    let resolveUpload!: (value: string) => void;
    const handler = vi.fn(() => new Promise<string>((resolve) => { resolveUpload = resolve; }));
    const imageA: EmailNode = { id: 'image_upload_a', type: 'image', attrs: { src: 'https://example.com/a.jpg' } };
    const imageB: EmailNode = { id: 'image_upload_b', type: 'image', attrs: { src: 'https://example.com/b.jpg' } };
    fixture.componentRef.setInput('document', { version: '0.0.1', body: [imageA, imageB] } satisfies EmailDocument);
    fixture.componentRef.setInput('config', { uploadImage: handler });
    component.selectedNodeId = imageA.id;
    fixture.detectChanges();
    const activeA = component.emailDocument.body[0];
    const activeB = component.emailDocument.body[1];

    const pending = component.uploadImageForNode(activeA, { target: { files: { 0: new File(['a'], 'a.png', { type: 'image/png' }), length: 1, item: () => null }, value: 'a.png' } } as unknown as Event);
    expect(component.isAnyImageUploading()).toBe(true);
    await component.uploadImageForNode(activeB, { target: { files: { 0: new File(['b'], 'b.png', { type: 'image/png' }), length: 1, item: () => null }, value: 'b.png' } } as unknown as Event);
    expect(handler).toHaveBeenCalledTimes(1);
    resolveUpload('https://cdn.example.com/a.png');
    await pending;
  });

  it('should reject unsupported image upload file types before calling the upload hook', async () => {
    const imageNode: EmailNode = { id: 'image_upload_svg', type: 'image', attrs: { src: 'https://example.com/original.jpg' } };
    const handler = vi.fn(async () => 'https://cdn.example.com/ignored.svg');
    const errorSpy = vi.spyOn(component.error, 'emit');
    fixture.componentRef.setInput('document', { version: '0.0.1', body: [imageNode] } satisfies EmailDocument);
    fixture.componentRef.setInput('config', { uploadImage: handler });
    component.selectedNodeId = imageNode.id;
    fixture.detectChanges();
    const activeImage = component.emailDocument.body[0];

    const file = new File(['<svg></svg>'], 'bad.svg', { type: 'image/svg+xml' });
    await component.uploadImageForNode(activeImage, { target: { files: { 0: file, length: 1, item: (index: number) => (index === 0 ? file : null) }, value: 'bad.svg' } } as unknown as Event);

    expect(handler).not.toHaveBeenCalled();
    expect(activeImage.attrs['src']).toBe('https://example.com/original.jpg');
    expect(component.imageUploadErrorFor(activeImage)).toContain('PNG, JPEG, WebP, or GIF');
    expect(errorSpy).toHaveBeenCalledWith(expect.objectContaining({ code: 'image_upload_failed' }));

    const emptyMimeHandler = vi.fn(async () => 'https://cdn.example.com/ignored.txt');
    fixture.componentRef.setInput('config', { uploadImage: emptyMimeHandler });
    fixture.detectChanges();
    await component.uploadImageForNode(activeImage, { target: { files: { 0: new File(['not-image'], 'bad.txt', { type: '' }), length: 1, item: (index: number) => (index === 0 ? file : null) }, value: 'bad.txt' } } as unknown as Event);
    expect(emptyMimeHandler).not.toHaveBeenCalled();
  });

  it('should not upload images in readonly mode', async () => {
    const imageNode: EmailNode = { id: 'image_upload_readonly', type: 'image', attrs: { src: 'https://example.com/original.jpg' } };
    const handler = vi.fn(async () => 'https://cdn.example.com/ignored.png');
    fixture.componentRef.setInput('document', { version: '0.0.1', body: [imageNode] } satisfies EmailDocument);
    fixture.componentRef.setInput('config', { uploadImage: handler });
    fixture.componentRef.setInput('readonly', true);
    component.selectedNodeId = imageNode.id;
    fixture.detectChanges();

    const file = new File(['image-bytes'], 'hero.png', { type: 'image/png' });
    await component.uploadImageForNode(imageNode, { target: { files: { 0: file, length: 1, item: (index: number) => (index === 0 ? file : null) }, value: 'hero.png' } } as unknown as Event);

    expect(handler).not.toHaveBeenCalled();
    expect(imageNode.attrs['src']).toBe('https://example.com/original.jpg');
    expect(query<HTMLButtonElement>(fixture, '.nes-image-upload-btn')?.disabled).toBe(true);
  });

  it('should expose content alignment controls and update alignable content modules', () => {
    const textNode = component.emailDocument.body[0].children?.[0];
    expect(textNode?.type).toBe('text');
    expect(component.isAlignableContent(textNode!)).toBe(true);
    expect(component.contentAlign(textNode!)).toBe('left');
    component.updateAttr(textNode!, 'align', 'center');
    expect(textNode!.attrs['align']).toBe('center');
    expect(component.contentAlign(textNode!)).toBe('center');
    expect(component.isAlignableContent({ id: 'divider_1', type: 'divider', attrs: {} })).toBe(false);
  });
  it('should apply content module background colors to the editable canvas preview', () => {
    fixture.detectChanges();
    const textNode = component.emailDocument.body[0].children?.[0];
    expect(textNode?.type).toBe('text');

    component.updateAttr(textNode!, 'backgroundColor', '#7d5454');
    expect(component.backgroundFor(textNode!)).toBe('#7d5454');
    expect(component.lastHtml).toContain('background:#7d5454');
  });

  it('should preserve large rich text font sizes used by email hero headings', () => {
    const source = '<mjml><mj-body><mj-section><mj-column><mj-text color="#55575d" font-family="Arial, sans-serif" font-size="13px" line-height="22px" padding-bottom="5px" padding-top="25px" padding="10px 25px"><p style="line-height: 60px; text-align: center; margin: 10px 0;font-size:55px;color:#fcfcfc;font-family:\'Times New Roman\',Helvetica,Arial,sans-serif"><b>Black Friday</b></p></mj-text></mj-column></mj-section></mj-body></mjml>';
    const imported = (component as any).parseMjml(source) as EmailDocument;
    const text = findImportedNode(imported.body, 'text');
    expect(String(text?.attrs['content'])).toContain('font-size: 55px');
    const mjml = (component as any).compileMjml(imported) as string;
    expect(mjml).toContain('font-size: 55px');
    expect(mjml).toContain('padding="25px 25px 5px 25px"');
  });

  it('should import, render, and export MJML button font color and center alignment', () => {
    const imported = (component as any).parseMjml('<mjml><mj-body><mj-section><mj-column><mj-button align="center" color="#000000" background-color="#ffffff" border-radius="3px" href="https://example.com" padding="20px 25px">Shop Now</mj-button></mj-column></mj-section></mj-body></mjml>') as EmailDocument;
    const button = findImportedNode(imported.body, 'button');
    expect(button?.attrs['align']).toBe('center');
    expect(button?.attrs['color']).toBe('#000000');
    expect(button?.attrs['backgroundColor']).toBe('#ffffff');
    expect((component as any).compileMjml(imported)).toContain('<mj-button href="https://example.com" background-color="#ffffff" color="#000000" border-radius="3px" align="center" padding="20px 25px 20px 25px">Shop Now</mj-button>');
    const html = (component as any).renderHtml(imported) as string;
    expect(html).toContain('text-align:center;');
    expect(html).toContain('color:#000000;');
  });

  it('should apply button background color to the button element, not the outer block background', () => {
    const localFixture = TestBed.createComponent(NgxEmailStudio);
    const localComponent = localFixture.componentInstance;
    const buttonNode = { id: 'button_target', type: 'button' as const, attrs: { label: 'Target CTA', href: '#', backgroundColor: '#ff5500', borderRadius: 18 } };
    localComponent.emailDocument = {
      version: '0.0.1',
      attrs: { backgroundColor: '#f3f4f6', contentBackgroundColor: '#ffffff', width: 100, widthUnit: '%', maxWidth: 600, maxWidthUnit: 'px' },
      body: [{ id: 'section_target', type: 'section', attrs: { backgroundColor: '#ffffff' }, children: [buttonNode] }],
    };
    localFixture.detectChanges();

    const wrapper = query<HTMLElement>(localFixture, '.nes-render-button-wrap');
    const button = query<HTMLElement>(localFixture, '.nes-render-button');
    expect(wrapper?.getAttribute('style') || '').not.toContain('#ff5500');
    expect(wrapper?.style.background).toBe('');
    expect(button?.getAttribute('style') || '').toContain('background');
    expect(button?.style.background).toBe('rgb(255, 85, 0)');
    expect(button?.style.borderRadius).toBe('18px');
    expect((localComponent as any).compileMjml(localComponent.emailDocument)).toContain('<mj-button href="#" background-color="#ff5500" border-radius="18px">Target CTA</mj-button>');
    expect((localComponent as any).renderHtml(localComponent.emailDocument)).toContain('display:inline-block;background:#ff5500;');
    expect((localComponent as any).renderHtml(localComponent.emailDocument)).toContain('border-radius:18px;');
  });

  it('should import button border radius and keep preview/export radius consistent', () => {
    const imported = (component as any).parseMjml('<mjml><mj-body><mj-section><mj-column><mj-button href="https://example.com" background-color="#123456" border-radius="22px">Rounded</mj-button></mj-column></mj-section></mj-body></mjml>') as EmailDocument;
    const button = findImportedNode(imported.body, 'button');
    expect(button?.type).toBe('button');
    expect(button?.attrs['borderRadius']).toBe(22);
    expect((component as any).compileMjml(imported)).toContain('border-radius="22px"');
    expect((component as any).renderHtml(imported)).toContain('border-radius:22px;');
  });

  it('should apply two-column ratio presets to preview and exports', () => {
    const row = component.emailDocument.body.find((node) => node.type === 'row')!;
    expect(row?.children?.length).toBe(2);

    component.setTwoColumnRatio(row, 30, 70);

    expect(row.children?.[0].attrs['width']).toBe(30);
    expect(row.children?.[1].attrs['width']).toBe(70);
    expect(row.children?.[0].attrs['widthUnit']).toBe('%');
    expect(component.rowRatioLabel(row)).toBe('3:7');
    expect(component.columnWidthCss(row.children![0], 50, '%')).toBe('30%');
    expect(component.columnWidthCss(row.children![1], 50, '%')).toBe('70%');
    expect(component.lastMjml).toContain('<mj-column width="30%"');
    expect(component.lastMjml).toContain('<mj-column width="70%"');
    expect(component.lastHtml).toContain('width="30%"');
    expect(component.lastHtml).toContain('width="70%"');
  });

  it('should keep the sidebar, canvas, and inspector in one equal-height scroll frame', () => {
    fixture.detectChanges();
    const styles = componentStyleText();
    const compactStyles = styles.replace(/\s+/g, ' ');

    expect(compactStyles).toContain('.nes-shell { display: grid; grid-template-rows: auto minmax(0, 1fr); height: min(980px, 95vh); min-height: min(780px, 95vh);');
    expect(compactStyles).toContain('.nes-builder { min-height: 0; display: grid; grid-template-columns: 285px minmax(0, 1fr) clamp(360px, 26vw, 420px); align-items: stretch; overflow: hidden; }');
    expect(compactStyles).toContain('.nes-panel { min-width: 0; min-height: 0; overflow: auto; overscroll-behavior: contain;');
    expect(compactStyles).toContain('.nes-stage { min-width: 0; min-height: 0; overflow: auto;');
    expect(compactStyles).toContain('.nes-device { max-width: 100%; margin: 0 auto; transition: width .2s ease; background: #fff; border-radius: 16px; box-shadow: 0 24px 80px rgba(15, 23, 42, .14); overflow: visible;');
    expect(compactStyles).toContain('.nes-render-column { min-width: 0; min-height: 150px; flex: 0 1 auto;');
    expect(compactStyles).toContain('.nes-size-bar { position: sticky; top: -18px; z-index: 12;');
    expect(compactStyles).toContain('@media (max-width: 700px) { .nes-builder { grid-template-columns: 1fr; height: auto; min-height: 0; overflow: visible; }');
  });

  it('should keep inspector controls readable without horizontal clipping', () => {
    fixture.detectChanges();
    const styles = componentStyleText().replace(/\s+/g, ' ');

    expect(styles).toContain('clamp(360px, 26vw, 420px)');
    expect(styles).toContain('.nes-properties { border-right: 0; border-left: 1px solid var(--nes-border); overflow-x: hidden; container: nes-inspector / inline-size; }');
    expect(styles).toContain('.nes-unit-field { grid-template-columns: minmax(72px, 1fr) minmax(58px, 68px); }');
    expect(styles).toContain('.nes-control-row { min-width: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(145px, 1fr)); gap: 12px; }');
    expect(styles).toContain('.nes-padding-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }');
    expect(styles).toContain('@container nes-inspector (max-width: 370px) { .nes-control-row, .nes-padding-grid { grid-template-columns: 1fr; }');
  });

  it('should import MJML sections with multiple columns as row nodes', () => {
    const mjml = `<mjml><mj-body><mj-section background-color="#f8fafc"><mj-column width="40%"><mj-text><p>Left</p></mj-text></mj-column><mj-column width="60%"><mj-image src="https://example.com/image.jpg" alt="Hero" /></mj-column></mj-section></mj-body></mjml>`;

    const document = (component as any).parseMjml(mjml) as EmailDocument;

    expect(document.body[0].type).toBe('row');
    expect(document.body[0].children?.length).toBe(2);
    expect(document.body[0].children?.[0].attrs['width']).toBe('40%');
    expect(document.body[0].children?.[0].children?.[0].type).toBe('text');
    expect(document.body[0].children?.[1].children?.[0].type).toBe('image');
  });

  it('should import content nested inside MJML wrappers and groups', () => {
    const mjml = `<mjml><mj-body background-color="#E7E7E7" width="600px"><mj-section background-color="#040B4F"><mj-column><mj-image src="https://example.com/header.png" width="600px" /></mj-column></mj-section><mj-wrapper padding-top="0" padding-bottom="0" css-class="body-section"><mj-section background-color="#ffffff" padding-left="15px" padding-right="15px"><mj-column><mj-text color="#212b35" font-weight="bold" font-size="20px">Croft's in Austin is opening December 20th</mj-text><mj-button background-color="#5e6ebf" color="#ffffff" href="https://google.com" width="300px">RSVP Today</mj-button></mj-column></mj-section><mj-section background-color="#ffffff" padding-top="0"><mj-column width="50%"><mj-image src="https://example.com/austin-image-1.png" /></mj-column><mj-column width="50%"><mj-image src="https://example.com/austin-image-2.png" /></mj-column></mj-section></mj-wrapper><mj-wrapper full-width="full-width"><mj-section><mj-column width="100%"><mj-social align="center"><mj-social-element name="facebook" href="https://mjml.io/"></mj-social-element><mj-social-element name="linkedin" href="https://mjml.io/"></mj-social-element></mj-social></mj-column></mj-section><mj-section padding-top="0"><mj-group><mj-column width="100%"><mj-text align="center"><a class="footer-link" href="https://www.google.com">Privacy</a></mj-text></mj-column></mj-group></mj-section></mj-wrapper></mj-body></mjml>`;

    const document = (component as any).parseMjml(mjml) as EmailDocument;
    const allText = JSON.stringify(document.body);
    const social = findImportedNode(document.body, 'social');
    const socialItems = JSON.parse(String(social?.attrs['items'] || '[]'));

    expect(document.attrs?.['backgroundColor']).toBe('#e7e7e7');
    expect(document.attrs?.['width']).toBe(600);
    expect(document.body.length).toBe(5);
    expect(allText).toContain('Croft\'s in Austin is opening December 20th');
    expect(allText).toContain('RSVP Today');
    expect(allText).toContain('austin-image-1.png');
    expect(allText).toContain('austin-image-2.png');
    expect(social?.type).toBe('social');
    expect(socialItems.map((item: any) => item.name)).toEqual(['facebook', 'linkedin']);
    expect(socialItems.map((item: any) => item.href)).toEqual(['https://mjml.io/', 'https://mjml.io/']);
    expect(allText).toContain('Privacy');
    expect(document.unsupported || []).not.toContain('mj-wrapper');
    expect(document.unsupported || []).not.toContain('mj-group');
    expect(document.unsupported || []).not.toContain('mj-social');
  });

  it('should import MJML social as editable social content modules and export MJML social elements', () => {
    const mjml = `<mjml><mj-body><mj-section><mj-column><mj-social font-size="15px" icon-size="30px" mode="horizontal" padding="0" align="center" container-background-color="#112233"><mj-social-element name="facebook" href="https://mjml.io/" background-color="#A1A0A0"></mj-social-element><mj-social-element name="google" href="https://example.com/google" background-color="#A1A0A0"></mj-social-element><mj-social-element name="twitter" href="javascript:alert(1)" background-color="#222222"></mj-social-element><mj-social-element name="linkedin" href="https://example.com/linkedin" background-color="#A1A0A0"></mj-social-element></mj-social></mj-column></mj-section></mj-body></mjml>`;

    const document = (component as any).parseMjml(mjml) as EmailDocument;
    const social = findImportedNode(document.body, 'social');
    const items = JSON.parse(String(social?.attrs['items'] || '[]'));
    const exportedMjml = (component as any).compileMjml(document) as string;
    const exportedHtml = (component as any).renderHtml(document) as string;

    expect(social?.attrs['align']).toBe('center');
    expect(social?.attrs['mode']).toBe('horizontal');
    expect(social?.attrs['iconSize']).toBe('30px');
    expect(social?.attrs['fontSize']).toBe('15px');
    expect(social?.attrs['backgroundColor']).toBe('#112233');
    expect(items.map((item: any) => item.name)).toEqual(['facebook', 'google', 'twitter', 'linkedin']);
    expect(items.map((item: any) => item.href)).toEqual(['https://mjml.io/', 'https://example.com/google', '#', 'https://example.com/linkedin']);
    expect(items[0].backgroundColor).toBe('#a1a0a0');
    expect(exportedMjml).toContain('<mj-social');
    expect(exportedMjml).toContain('name="facebook"');
    expect(exportedMjml).toContain('href="https://example.com/linkedin"');
    expect(exportedMjml).not.toContain('javascript:');
    expect(exportedHtml).not.toContain('javascript:');
    expect(exportedHtml).toContain('aria-label="facebook"');
  });

  it('should keep social editor draft values while normalizing only preview/export values', () => {
    const social: EmailNode = {
      id: 'social-test',
      type: 'social',
      attrs: {
        backgroundColor: '#112233',
        items: JSON.stringify([{ name: 'facebook', href: '#', backgroundColor: '#A1A0A0' }]),
      },
    };

    component.updateSocialItemAttr(social, 0, 'href', 'https');
    component.updateSocialItemAttr(social, 0, 'name', '');
    component.updateSocialItemAttr(social, 0, 'backgroundColor', '#12');

    expect(component.socialEditorItems(social)[0]).toEqual({ name: '', href: 'https', backgroundColor: '#12' });
    expect(component.socialItems(social)[0]).toEqual({ name: 'social', href: '#', backgroundColor: '#A1A0A0' });

    component.updateSocialItemAttr(social, 0, 'href', 'https://example.com/social');
    component.updateSocialItemAttr(social, 0, 'name', 'Linked In!');
    component.updateSocialItemAttr(social, 0, 'backgroundColor', '#445566');

    const exportedMjml = (component as any).compileMjml({ attrs: {}, body: [social] } as EmailDocument) as string;
    const exportedHtml = (component as any).renderHtml({ attrs: {}, body: [social] } as EmailDocument) as string;

    expect(component.socialEditorItems(social)[0].href).toBe('https://example.com/social');
    expect(exportedMjml).toContain('name="linkedin"');
    expect(exportedMjml).toContain('href="https://example.com/social"');
    expect(exportedMjml).toContain('background-color="#445566"');
    expect(exportedMjml).toContain('container-background-color="#112233"');
    expect(exportedHtml).toContain('background:#112233;');
  });

  it('should reuse parsed social item arrays between unchanged change-detection passes', () => {
    const social: EmailNode = {
      id: 'social-cache-test',
      type: 'social',
      attrs: {
        items: JSON.stringify([{ name: 'facebook', href: 'https://example.com', backgroundColor: '#A1A0A0' }]),
      },
    };

    expect(component.socialItems(social)).toBe(component.socialItems(social));
    expect(component.socialEditorItems(social)).toBe(component.socialEditorItems(social));

    component.updateSocialItemAttr(social, 0, 'href', 'https://example.com/updated');

    expect(component.socialItems(social)[0].href).toBe('https://example.com/updated');
    expect(component.socialEditorItems(social)[0].href).toBe('https://example.com/updated');
  });

  it('should default imported MJML social alignment to center when align is omitted', () => {
    const mjml = `<mjml><mj-body><mj-section><mj-column><mj-social><mj-social-element name="facebook" href="https://mjml.io/"></mj-social-element></mj-social></mj-column></mj-section></mj-body></mjml>`;

    const document = (component as any).parseMjml(mjml) as EmailDocument;
    const social = findImportedNode(document.body, 'social');

    expect(social?.attrs['align']).toBe('center');
    expect((component as any).compileMjml(document)).toContain('align="center"');
  });

  it('should track unsupported MJML nested inside social modules', () => {
    const mjml = `<mjml><mj-body><mj-section><mj-column><mj-social><mj-social-element name="facebook" href="https://mjml.io/"></mj-social-element><mj-text>Unsupported here</mj-text></mj-social></mj-column></mj-section></mj-body></mjml>`;

    const document = (component as any).parseMjml(mjml) as EmailDocument;
    const social = findImportedNode(document.body, 'social');

    expect(social?.type).toBe('social');
    expect(document.unsupported || []).toContain('mj-text');
  });

  it('should sanitize imported and exported button hrefs', () => {
    const mjml = `<mjml><mj-body><mj-wrapper><mj-section><mj-column><mj-button href="javascript:alert(1)">Unsafe</mj-button><mj-button href="//evil.example/path">Protocol relative</mj-button><mj-button href="https://example.com/safe">Safe</mj-button></mj-column></mj-section></mj-wrapper></mj-body></mjml>`;

    const document = (component as any).parseMjml(mjml) as EmailDocument;
    const buttons = JSON.stringify(document.body);
    const exportedMjml = (component as any).compileMjml(document) as string;
    const exportedHtml = (component as any).renderHtml(document) as string;

    expect(buttons).not.toContain('javascript:');
    expect(buttons).not.toContain('//evil.example');
    expect(exportedMjml).not.toContain('javascript:');
    expect(exportedMjml).not.toContain('//evil.example');
    expect(exportedHtml).not.toContain('javascript:');
    expect(exportedHtml).not.toContain('//evil.example');
    expect(exportedMjml).toContain('href="https://example.com/safe"');
  });

  it('should carry safe wrapper attrs to flattened sections and preserve effective MJML group widths', () => {
    const mjml = `<mjml><mj-body><mj-wrapper background-color="#eef2ff" padding="4px 8px 12px 16px"><mj-section><mj-column><mj-text>Wrapped</mj-text></mj-column></mj-section></mj-wrapper><mj-section><mj-group width="50%"><mj-column width="50%"><mj-text>A</mj-text></mj-column><mj-column><mj-text>B</mj-text></mj-column></mj-group><mj-column width="50%"><mj-text>C</mj-text></mj-column></mj-section></mj-body></mjml>`;

    const document = (component as any).parseMjml(mjml) as EmailDocument;
    const wrapped = document.body[0];
    const row = document.body[1];

    expect(wrapped.attrs['backgroundColor']).toBe('#eef2ff');
    expect(wrapped.attrs['paddingTop']).toBe(4);
    expect(wrapped.attrs['paddingRight']).toBe(8);
    expect(wrapped.attrs['paddingBottom']).toBe(12);
    expect(wrapped.attrs['paddingLeft']).toBe(16);
    expect(row.type).toBe('row');
    expect(row.children?.map((column) => column.attrs['width'])).toEqual(['25%', '25%', '50%']);
  });


  it('should drop palette blocks into a row column', () => {
    const row = component.emailDocument.body.find((node) => node.type === 'row');
    const column = row?.children?.[0];
    expect(column).toBeTruthy();
    const before = column?.children?.length || 0;

    component.drop({
      previousContainer: { data: component.palette } as any,
      container: { id: component.dropListIdFor(column!), data: column?.children || [] } as any,
      previousIndex: 0,
      currentIndex: before,
      item: { data: { type: 'text', label: 'Text', icon: 'fa-font', description: 'Rich text content' } } as any,
    } as any);

    expect(column?.children?.length).toBe(before + 1);
    expect(column?.children?.[before].type).toBe('text');
    expect(component.connectedDropListIds).toContain(component.dropListIdFor(column!));
    expect(component.connectedDropListIds).toContain(component.paletteDropListId);
  });

  it('should reroute root drops into the nested column under the pointer', () => {
    fixture.detectChanges();
    const row = component.emailDocument.body.find((node) => node.type === 'row');
    const column = row?.children?.[0];
    expect(column).toBeTruthy();
    const columnElement = query<HTMLElement>(fixture, `[data-node-id="${column!.id}"]`)!;
    const ownerDocument = columnElement.ownerDocument as Document & { elementsFromPoint?: (x: number, y: number) => Element[] };
    const originalElementsFromPoint = ownerDocument.elementsFromPoint;
    Object.defineProperty(ownerDocument, 'elementsFromPoint', {
      configurable: true,
      value: () => [columnElement],
    });
    const bodyBefore = component.emailDocument.body.length;
    const columnBefore = column!.children?.length || 0;

    try {
      component.drop({
        previousContainer: { data: component.palette } as any,
        container: { id: component.rootDropListId, data: component.emailDocument.body } as any,
        previousIndex: 0,
        currentIndex: bodyBefore,
        dropPoint: { x: 10, y: 10 },
        item: { data: { type: 'text', label: 'Text', icon: 'fa-font', description: 'Rich text content' } } as any,
      } as any);
    } finally {
      Object.defineProperty(ownerDocument, 'elementsFromPoint', { configurable: true, value: originalElementsFromPoint });
    }

    expect(component.emailDocument.body.length).toBe(bodyBefore);
    expect(column!.children?.length).toBe(columnBefore + 1);
    expect(column!.children?.[columnBefore].type).toBe('text');
  });

  it('should keep structural palette drops at the root even when the pointer is over a column', () => {
    fixture.detectChanges();
    const row = component.emailDocument.body.find((node) => node.type === 'row');
    const column = row?.children?.[0];
    expect(column).toBeTruthy();
    const columnElement = query<HTMLElement>(fixture, `[data-node-id="${column!.id}"]`)!;
    const ownerDocument = columnElement.ownerDocument as Document & { elementsFromPoint?: (x: number, y: number) => Element[] };
    const originalElementsFromPoint = ownerDocument.elementsFromPoint;
    Object.defineProperty(ownerDocument, 'elementsFromPoint', {
      configurable: true,
      value: () => [columnElement],
    });
    const rowPaletteItem = component.palette.find((item) => item.type === 'row')!;
    const sectionPaletteItem = component.palette.find((item) => item.type === 'section')!;
    const bodyBefore = component.emailDocument.body.length;
    const columnBefore = column!.children?.length || 0;

    try {
      component.drop({
        previousContainer: { data: component.palette } as any,
        container: { id: component.rootDropListId, data: component.emailDocument.body } as any,
        previousIndex: component.palette.indexOf(sectionPaletteItem),
        currentIndex: bodyBefore,
        dropPoint: { x: 10, y: 10 },
        item: { data: sectionPaletteItem } as any,
      } as any);
      component.drop({
        previousContainer: { data: component.palette } as any,
        container: { id: component.rootDropListId, data: component.emailDocument.body } as any,
        previousIndex: component.palette.indexOf(rowPaletteItem),
        currentIndex: bodyBefore + 1,
        dropPoint: { x: 10, y: 10 },
        item: { data: rowPaletteItem } as any,
      } as any);
    } finally {
      Object.defineProperty(ownerDocument, 'elementsFromPoint', { configurable: true, value: originalElementsFromPoint });
    }

    expect(component.emailDocument.body.length).toBe(bodyBefore + 2);
    expect(component.emailDocument.body[bodyBefore].type).toBe('section');
    expect(component.emailDocument.body[bodyBefore + 1].type).toBe('row');
    expect(column!.children?.length).toBe(columnBefore);
  });

  it('should prefer the deepest pointed column when CDK chooses an active drop-list indicator', () => {
    fixture.detectChanges();
    const row = component.emailDocument.body.find((node) => node.type === 'row');
    const column = row?.children?.[0];
    const section = component.emailDocument.body.find((node) => node.type === 'section');
    expect(column).toBeTruthy();
    expect(section).toBeTruthy();
    const columnElement = query<HTMLElement>(fixture, `[data-node-id="${column!.id}"]`)!;
    const columnChild = columnElement.querySelector<HTMLElement>('.nes-child-node') || columnElement;
    const ownerDocument = columnElement.ownerDocument as Document & { elementsFromPoint?: (x: number, y: number) => Element[] };
    const originalElementsFromPoint = ownerDocument.elementsFromPoint;
    Object.defineProperty(ownerDocument, 'elementsFromPoint', {
      configurable: true,
      value: () => [columnChild, columnElement],
    });

    const paletteText = { type: 'text', label: 'Text', icon: 'fa-font', description: 'Rich text content' };
    const paletteSection = { type: 'section', label: 'Hero', icon: 'fa-header', description: 'Root section preset' };
    const paletteRow = { type: 'row', label: 'Columns', icon: 'fa-columns', description: 'Root column row preset' };
    try {
      component.beginDrag();
      component.onDocumentPointerMove({ clientX: 10, clientY: 10 } as PointerEvent);

      expect(component.canEnterContainerDropList({ data: paletteText }, { id: component.dropListIdFor(column!) })).toBe(true);
      expect(component.canEnterContainerDropList({ data: paletteText }, { id: component.rootDropListId })).toBe(false);
      expect(component.canEnterContainerDropList({ data: paletteText }, { id: component.dropListIdFor(section!) })).toBe(false);
      expect(component.canEnterContainerDropList({ data: paletteSection }, { id: component.rootDropListId })).toBe(true);
      expect(component.canEnterContainerDropList({ data: paletteRow }, { id: component.rootDropListId })).toBe(true);
    } finally {
      component.endDrag();
      Object.defineProperty(ownerDocument, 'elementsFromPoint', { configurable: true, value: originalElementsFromPoint });
    }

    expect(component.canEnterContainerDropList({ data: paletteText }, { id: component.rootDropListId })).toBe(true);
  });

  it('should keep selected text blocks draggable on the canvas', () => {
    const selectedText = component.selectedNode;
    expect(selectedText?.type).toBe('text');
    expect(component.isCanvasNodeDragDisabled(selectedText!)).toBe(false);
    const parentSection = component.emailDocument.body[0];
    expect(component.isCanvasNodeDragDisabled(parentSection)).toBe(false);
  });

  it('should disable drag/drop affordances in readonly mode', () => {
    const readonlyFixture = TestBed.createComponent(NgxEmailStudio);
    readonlyFixture.componentRef.setInput('readonly', true);
    readonlyFixture.detectChanges();
    const readonlyComponent = readonlyFixture.componentInstance;

    expect(readonlyComponent.canEnterContainerDropList({ data: readonlyComponent.palette[0] }, { id: readonlyComponent.rootDropListId })).toBe(false);
    readonlyComponent.beginDrag();
    expect(readonlyComponent.dragInProgress).toBe(false);
    expect(queryAll(readonlyFixture, '.cdk-drag-disabled, .cdk-drop-list-disabled').length).toBeGreaterThan(0);
  });

  it('should wrap existing content modules moved back to the root canvas', () => {
    const section = (component as any).createSectionWithChildren([{ id: 'text_nested_root_move', type: 'text', attrs: { content: '<p>Nested root move</p>' } }]);
    const nestedText = section.children![0];
    component.emailDocument = { ...component.emailDocument, body: [section] };

    component.drop({
      previousContainer: { data: section.children } as any,
      container: { id: component.rootDropListId, data: component.emailDocument.body } as any,
      previousIndex: 0,
      currentIndex: 1,
      item: { data: nestedText } as any,
    } as any);

    expect(component.emailDocument.body[1].type).toBe('section');
    expect(component.emailDocument.body[1].children?.[0].type).toBe('text');
    expect(component.emailDocument.body[1].children?.[0].attrs['content']).toContain('Nested root move');
  });

  it('should reject drops into the palette so canvas nodes cannot corrupt module cards', () => {
    fixture.detectChanges();
    const paletteBefore = [...component.palette];
    const bodyBefore = [...component.emailDocument.body];
    const firstNode = component.emailDocument.body[0];

    expect(component.rejectPaletteDrop()).toBe(false);
    expect(query(fixture, '.nes-block-list')).toBeTruthy();

    component.drop({
      previousContainer: { data: component.emailDocument.body } as any,
      container: { id: component.paletteDropListId, data: component.palette } as any,
      previousIndex: 0,
      currentIndex: 0,
      item: { data: firstNode } as any,
    } as any);

    expect(component.palette).toEqual(paletteBefore);
    expect(component.emailDocument.body).toEqual(bodyBefore);
  });

  it('should reject cyclic or structural existing-node drops into nested containers', () => {
    const nested = (component as any).createSectionWithChildren([{ id: 'text_nested', type: 'text', attrs: { content: '<p>Nested</p>' } }]);
    const parent = (component as any).createSectionWithChildren([nested]);
    component.emailDocument = { ...component.emailDocument, body: [parent] };
    const bodyBefore = structuredClone(component.emailDocument.body);

    expect(component.canEnterContainerDropList({ data: parent }, { id: component.dropListIdFor(nested) })).toBe(false);
    component.drop({
      previousContainer: { data: component.emailDocument.body } as any,
      container: { id: component.dropListIdFor(nested), data: nested.children || [] } as any,
      previousIndex: 0,
      currentIndex: 0,
      item: { data: parent } as any,
    } as any);
    expect(component.emailDocument.body).toEqual(bodyBefore);

    const row = (component as any).createNode('row');
    component.emailDocument = { ...component.emailDocument, body: [parent, row] };
    const rowBodyBefore = structuredClone(component.emailDocument.body);
    expect(component.canEnterContainerDropList({ data: row }, { id: component.dropListIdFor(parent) })).toBe(false);
    component.drop({
      previousContainer: { data: component.emailDocument.body } as any,
      container: { id: component.dropListIdFor(parent), data: parent.children || [] } as any,
      previousIndex: 1,
      currentIndex: 0,
      item: { data: row } as any,
    } as any);
    expect(component.emailDocument.body).toEqual(rowBodyBefore);
  });

  it('should compile section children instead of placeholder text', () => {
    const document: EmailDocument = {
      version: '0.0.1',
      body: [
        {
          id: 'section_1',
          type: 'section',
          attrs: { backgroundColor: '#ffffff' },
          children: [{ id: 'text_1', type: 'text', attrs: { content: '<p>Inside section</p>' } }],
        },
      ],
    };

    const mjml = (component as any).compileMjml(document) as string;
    expect(mjml).toContain('<mj-section background-color="#ffffff" padding="16px 16px 16px 16px"><mj-column><mj-text><p>Inside section</p></mj-text></mj-column></mj-section>');
  });

  it('should use document body settings for HTML wrapper width and backgrounds', () => {
    const document: EmailDocument = {
      version: '0.0.1',
      attrs: { backgroundColor: '#111827', contentBackgroundColor: '#fefce8', width: 720, widthUnit: 'px', maxWidth: 720, maxWidthUnit: 'px' },
      body: [{ id: 'text_1', type: 'text', attrs: { content: '<p>Body settings</p>', backgroundColor: '#ffffff' } }],
    };

    const html = (component as any).renderHtml(document) as string;

    expect(html).toContain('<body style="margin:0;padding:0;background:#111827;word-spacing:normal;">');
    expect(html).toContain('style="background:#111827;padding:24px 0;border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;"');
    expect(html).toContain('<table role="presentation" border="0" width="720" cellspacing="0" cellpadding="0" style="width:720px;max-width:720px;background:#fefce8;');
    expect(html).toContain('width="720"><tr><td><![endif]-->');
  });

  it('should include email-client compatibility head and Outlook resets in HTML export', () => {
    const html = (component as any).renderHtml(component.emailDocument) as string;

    expect(html).toContain('<html xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">');
    expect(html).toContain('<!--[if !mso]><!-->');
    expect(html).toContain('<meta http-equiv="X-UA-Compatible" content="IE=edge">');
    expect(html).toContain('<meta http-equiv="Content-Type" content="text/html; charset=UTF-8">');
    expect(html).toContain('<meta name="viewport" content="width=device-width, initial-scale=1">');
    expect(html).toContain('#outlook a { padding:0; }');
    expect(html).toContain('table, td { border-collapse:collapse; mso-table-lspace:0pt; mso-table-rspace:0pt; }');
    expect(html).toContain('img { border:0; height:auto; line-height:100%; outline:none; text-decoration:none; -ms-interpolation-mode:bicubic; }');
    expect(html).toContain('<o:PixelsPerInch>96</o:PixelsPerInch>');
    expect(html).toContain('.nes-email-outlook-fix { width:100% !important; }');
    expect(html).toContain('@media only screen and (max-width:480px)');
    expect(html).toContain('class="nes-email-column nes-email-outlook-fix"');
  });

  it('should expose Body as the outline root and edit exported body settings', () => {
    fixture.detectChanges();
    const tabs = queryAll(fixture, '.nes-left-tabs button') as NodeListOf<HTMLButtonElement>;
    tabs[1].click();
    fixture.detectChanges();

    const outlineNodes = queryAll(fixture, '.nes-outline-node') as NodeListOf<HTMLButtonElement>;
    expect(outlineNodes.length).toBe(component.totalOutlineNodes);
    expect(outlineNodes[0].textContent).toContain('Body');

    outlineNodes[0].click();
    fixture.detectChanges();

    expect(component.selectedNodeId).toBe((component as any).bodyNodeId);
    expect(studioText(fixture)).toContain('Body / Email canvas');
    component.updateDocumentAttr('width', 700);
    component.updateDocumentAttr('widthUnit', 'px');
    component.updateDocumentAttr('maxWidth', 720);
    component.updateDocumentAttr('maxWidthUnit', 'px');
    expect(component.emailWidth).toBe(700);
    expect(component.emailWidthCss).toBe('700px');
    expect(component.emailMaxWidthCss).toBe('720px');
    expect(component.lastHtml).toContain('width="700"');
    expect(component.lastHtml).toContain('max-width:720px');
  });

  it('should render color pickers and separate body width/max-width unit controls', () => {
    component.updateDocumentAttr('width', 100);
    component.updateDocumentAttr('widthUnit', '%');
    component.updateDocumentAttr('maxWidth', 640);
    component.updateDocumentAttr('maxWidthUnit', 'px');

    expect(component.colorPickerValue('#112233')).toBe('#112233');
    expect(component.emailWidthCss).toBe('100%');
    expect(component.emailMaxWidthCss).toBe('640px');
    expect(component.lastMjml).toContain('<mj-body background-color="#ffffff" width="100%">');
    expect(component.lastHtml).toContain('background:#ffffff;');
    expect(component.lastHtml).toContain('width="100%"');
    expect(component.lastHtml).toContain('style="width:100%;max-width:640px;');
  });

  it('should default section width to 100% and max-width to 600px', () => {
    const section = component.emailDocument.body.find((node) => node.type === 'section')!;
    (component as any).refreshOutputs(false);

    expect(section.attrs['width']).toBe(100);
    expect(section.attrs['widthUnit']).toBe('%');
    expect(section.attrs['maxWidth']).toBe(600);
    expect(section.attrs['maxWidthUnit']).toBe('px');
    expect(component.sectionWidthCss(section)).toBe('100%');
    expect(component.sectionMaxWidthCss(section)).toBe('600px');
    expect(component.lastHtml).toContain('width:100%;max-width:600px;');
  });

  it('should support column width and max-width units', () => {
    const row = component.emailDocument.body.find((node) => node.type === 'row')!;
    const column = row.children![0];

    component.updateAttr(column, 'width', 45);
    component.updateAttr(column, 'widthUnit', '%');
    component.updateAttr(column, 'maxWidth', 600);
    component.updateAttr(column, 'maxWidthUnit', 'px');

    expect(component.columnWidthCss(column)).toBe('45%');
    expect(component.columnMaxWidthCss(column)).toBe('600px');
    expect(component.lastMjml).toContain('<mj-column width="45%"');
    expect(component.lastHtml).toContain('class="nes-email-column nes-email-outlook-fix" width="45%"');
    expect(component.lastHtml).toContain('width:45%;max-width:600px;');
  });

  it('should stack columns vertically at 480px and below in preview and exported HTML', () => {
    fixture.detectChanges();
    (component as any).refreshOutputs(false);
    const styleText = studioText(fixture) + componentStyleText();
    const html = component.lastHtml;

    expect(styleText).toContain('@media (max-width: 480px)');
    expect(styleText).toContain('flex-direction: column');
    expect(styleText).toContain('max-width: 100% !important');
    expect(html).toContain('@media only screen and (max-width:480px)');
    expect(html).toContain('.nes-email-column { display:block !important; width:100% !important; max-width:100% !important; }');
  });

  it('should default canvas mode to edit', () => {
    expect(component.canvasMode).toBe('edit');
  });

  it('should toggle between Preview and Edit canvas modes from the header controls', () => {
    fixture.detectChanges();
    const modeButtons = queryAll(fixture, '.nes-mode-toggle button') as NodeListOf<HTMLButtonElement>;

    modeButtons[1].click();
    fixture.detectChanges();
    expect(component.canvasMode).toBe('preview');

    modeButtons[0].click();
    fixture.detectChanges();
    expect(component.canvasMode).toBe('edit');
  });

  it('should render the editable canvas only in edit mode', () => {
    fixture.detectChanges();

    expect(query(fixture, '.nes-canvas')).toBeTruthy();
    expect(query(fixture, '.nes-preview-frame')).toBeFalsy();
  });

  it('should render an isolated iframe preview instead of the editable canvas in preview mode', () => {
    fixture.detectChanges();
    const modeButtons = queryAll(fixture, '.nes-mode-toggle button') as NodeListOf<HTMLButtonElement>;
    modeButtons[1].click();
    fixture.detectChanges();

    const iframe = query(fixture, '.nes-preview-frame') as HTMLIFrameElement;
    expect(iframe).toBeTruthy();
    expect(query(fixture, '.nes-canvas')).toBeFalsy();
    expect(iframe.getAttribute('title')).toBe('Email preview');
    expect(iframe.hasAttribute('sandbox')).toBe(true);
    expect(iframe.getAttribute('sandbox')).not.toContain('allow-scripts');
    expect(iframe.getAttribute('sandbox')).not.toContain('allow-same-origin');
  });

  it('should bind exported HTML with the real 480px media query into the preview iframe srcdoc', () => {
    fixture.detectChanges();
    const modeButtons = queryAll(fixture, '.nes-mode-toggle button') as NodeListOf<HTMLButtonElement>;
    modeButtons[1].click();
    fixture.detectChanges();

    const iframe = query(fixture, '.nes-preview-frame') as HTMLIFrameElement;
    const srcdoc = iframe.getAttribute('srcdoc') || '';

    expect(srcdoc).toContain(component.lastHtml);
    expect(srcdoc).toContain('@media only screen and (max-width:480px)');
  });

  it('should use the shared 400px preview size for the preview iframe width', () => {
    fixture.detectChanges();
    const modeButtons = queryAll(fixture, '.nes-mode-toggle button') as NodeListOf<HTMLButtonElement>;
    modeButtons[1].click();
    fixture.detectChanges();
    const sizeButtons = queryAll(fixture, '.nes-size-bar > button') as NodeListOf<HTMLButtonElement>;
    Array.from(sizeButtons).find((button) => button.textContent?.trim() === '400')?.click();
    fixture.detectChanges();

    const iframe = query(fixture, '.nes-preview-frame') as HTMLIFrameElement;
    expect(component.previewWidth).toBe(400);
    expect(iframe).toBeTruthy();
    expect(iframe.style.width).toBe('400px');
  });

  it('should show the preview mode helper text only in Preview mode', () => {
    const helperText = 'Preview mode renders the exported HTML in an isolated iframe. Switch to Edit to change content.';

    fixture.detectChanges();
    expect(studioText(fixture)).not.toContain(helperText);

    const modeButtons = queryAll(fixture, '.nes-mode-toggle button') as NodeListOf<HTMLButtonElement>;
    modeButtons[1].click();
    fixture.detectChanges();
    expect(studioText(fixture)).toContain(helperText);
  });

  it('should support section width/max-width units and all-or-side padding controls', () => {
    const section = component.emailDocument.body.find((node) => node.type === 'section')!;
    component.updateAttr(section, 'width', 100);
    component.updateAttr(section, 'widthUnit', '%');
    component.updateAttr(section, 'maxWidth', 600);
    component.updateAttr(section, 'maxWidthUnit', 'px');
    component.updateSectionPaddingAll(section, 24);
    component.updateSectionPaddingSide(section, 'paddingTop', 12);

    expect(component.sectionWidthCss(section)).toBe('100%');
    expect(component.sectionMaxWidthCss(section)).toBe('600px');
    expect(component.sectionPaddingCss(section)).toBe('12px 24px 24px 24px');
    expect(component.lastHtml).toContain('width:100%;max-width:600px;');
    expect(component.lastHtml).toContain('padding:12px 24px 24px 24px;');
    expect(component.lastMjml).toContain('padding="12px 24px 24px 24px"');
  });

  it('should keep default config behavior when a host passes only shell labels', () => {
    const localFixture = TestBed.createComponent(NgxEmailStudio);
    localFixture.componentRef.setInput('config', { title: 'Custom Builder' });
    localFixture.detectChanges();
    const localComponent = localFixture.componentInstance;

    expect(localComponent.effectiveConfig.showHtmlPreview).toBe(true);
    expect(localComponent.resolvedRichTextEditor).toBe('tiptap');
    expect(localComponent.resolvedUseTiptap).toBe(true);
    expect(studioText(localFixture)).toContain('Custom Builder');
  });

  it('should default rich text editing to Tiptap and keep plain textarea opt-in', () => {
    fixture.detectChanges();
    expect(component.resolvedRichTextEditor).toBe('tiptap');
    expect(query(fixture, '.nes-tiptap-shell')).toBeTruthy();
    expect(query(fixture, '.nes-tiptap-editor .ProseMirror')).toBeTruthy();
    expect(query(fixture, 'editor')).toBeFalsy();

    const localFixture = TestBed.createComponent(NgxEmailStudio);
    localFixture.componentRef.setInput('config', { richTextEditor: 'plain' });
    localFixture.detectChanges();

    expect(localFixture.componentInstance.resolvedRichTextEditor).toBe('plain');
    expect(localFixture.componentInstance.resolvedUseTiptap).toBe(false);
    expect(query(localFixture, '.nes-tiptap-shell')).toBeFalsy();
    expect(query(localFixture, 'textarea')).toBeTruthy();
  });

  it('should remove Tiptap document-level listeners when editors are destroyed', () => {
    const removeSpy = vi.spyOn(document, 'removeEventListener');
    fixture.detectChanges();
    expect((component as any).tiptapInlineEditor).toBeTruthy();

    component.ngOnDestroy();

    expect(removeSpy).toHaveBeenCalledWith('pointermove', expect.any(Function), true);
    expect(removeSpy).toHaveBeenCalledWith('mousemove', expect.any(Function), true);
    removeSpy.mockRestore();
  });

  it('should update and reset Tiptap toolbar snapshot state outside live editor reads', async () => {
    fixture.detectChanges();
    const editor = (component as any).tiptapInlineEditor;
    expect(editor).toBeTruthy();

    editor.commands.setContent('<p>Snapshot state</p>');
    editor.commands.selectAll();
    component.runTiptapCommand('inline', 'bold');
    await new Promise((resolve) => setTimeout(resolve, 5));

    expect(component.isTiptapActive('inline', 'bold')).toBe(true);

    component.ngOnDestroy();

    expect(component.isTiptapActive('inline', 'bold')).toBe(false);
    expect(component.currentTiptapBlockFormat('inline')).toBe('paragraph');
  });

  it('should keep paragraph font-size color and font-family when editing imported styled MJML text in Tiptap', () => {
    fixture.detectChanges();
    const textNode = component.selectedNode!;
    const editor = (component as any).tiptapInlineEditor;
    expect(editor).toBeTruthy();

    editor.commands.setContent('<p style="line-height: 80px; text-align: center; margin: 10px 0; background-color: #f8fafc; font-size: 55px; color: #fcfcfc; font-family: \'Times New Roman\',Helvetica,Arial,sans-serif"><strong>Black Friday</strong></p>');
    editor.commands.setTextSelection(editor.state.doc.content.size - 1);
    editor.commands.insertContent('1');

    expect(textNode.attrs['content']).toContain('Black Friday1');
    expect(textNode.attrs['content']).toContain('font-size: 55px');
    expect(textNode.attrs['content']).toContain('color: #fcfcfc');
    expect(textNode.attrs['content']).toContain('Times New Roman');
    expect(textNode.attrs['content']).toContain('Helvetica');
    expect(textNode.attrs['content']).toContain('Arial');
    expect(textNode.attrs['content']).toContain('line-height: 80px');
    expect(textNode.attrs['content']).toContain('margin-top: 10px');
    expect(textNode.attrs['content']).toContain('margin-bottom: 10px');
    expect(textNode.attrs['content']).toContain('background-color: #f8fafc');
    expect(component.lastMjml).toContain('font-size: 55px');
    expect(component.lastMjml).toContain('line-height: 80px');
    expect(component.lastMjml).toContain('margin-top: 10px');
    expect(component.lastMjml).toContain('margin-bottom: 10px');
    expect(component.lastMjml).toContain('background-color: #f8fafc');
    expect(component.lastMjml).toContain('color: #fcfcfc');
    expect(component.lastMjml).toContain('Times New Roman');
    expect(component.lastMjml).toContain('Helvetica');
    expect(component.lastMjml).toContain('Arial');
  });

  it('should keep rich-text div blocks through Tiptap edits and exports', () => {
    fixture.detectChanges();
    const textNode = component.selectedNode!;
    const editor = (component as any).tiptapInlineEditor;
    expect(editor).toBeTruthy();

    editor.commands.setContent('<div style="margin: 10px 0; color: #123456" class="lead-div">Line <strong>one</strong></div><p>Line two</p>');
    editor.commands.setTextSelection(editor.state.doc.content.size - 1);
    editor.commands.insertContent('!');

    expect(textNode.attrs['content']).toContain('<div');
    expect(textNode.attrs['content']).toContain('class="lead-div"');
    expect(textNode.attrs['content']).toContain('Line <strong>one</strong>');
    expect(textNode.attrs['content']).toContain('color: #123456');
    expect(textNode.attrs['content']).toContain('margin-top: 10px');
    expect(textNode.attrs['content']).toContain('<p>Line two!</p>');
    expect(component.lastMjml).toContain('<div');
    expect(component.lastMjml).toContain('class="lead-div"');
    expect(component.lastHtml).toContain('<div');
    expect(component.lastHtml).toContain('class="lead-div"');
  });

  it('should keep safe rich-text class and id attributes through Tiptap edits and exports', () => {
    fixture.detectChanges();
    const textNode = component.selectedNode!;
    const editor = (component as any).tiptapInlineEditor;
    expect(editor).toBeTruthy();

    editor.commands.setContent('<p class="kicker product-newsletter" id="hero-kicker">Product newsletter</p><h1 class="hero-title" id="hero-title">Launch a polished campaign in minutes</h1><p class="intro-copy">Compose responsive MJML emails.</p>');
    editor.commands.setTextSelection(editor.state.doc.content.size - 1);
    editor.commands.insertContent('!');

    expect(textNode.attrs['content']).toContain('id="hero-kicker"');
    expect(textNode.attrs['content']).toContain('class="kicker product-newsletter"');
    expect(textNode.attrs['content']).toContain('id="hero-title"');
    expect(textNode.attrs['content']).toContain('class="hero-title"');
    expect(textNode.attrs['content']).toContain('<p class="intro-copy">Compose responsive MJML emails.!</p>');
    expect(component.lastMjml).toContain('id="hero-kicker"');
    expect(component.lastMjml).toContain('class="kicker product-newsletter"');
    expect(component.lastMjml).toContain('id="hero-title"');
    expect(component.lastMjml).toContain('class="hero-title"');
    expect(component.lastHtml).toContain('class="intro-copy"');
  });

  it('should keep safe rich-text class and id attributes on inline marks through Tiptap edits', () => {
    fixture.detectChanges();
    const textNode = component.selectedNode!;
    const editor = (component as any).tiptapInlineEditor;
    expect(editor).toBeTruthy();

    editor.commands.setContent('<p><strong class="brand-bold" id="bold-mark">Bold</strong> <em class="brand-em" id="em-mark">italic</em> <u class="brand-under" id="under-mark">under</u> <s class="brand-strike" id="strike-mark">strike</s> <a class="brand-link" id="link-mark" href="https://example.com">link</a></p>');
    editor.commands.setTextSelection(editor.state.doc.content.size - 1);
    editor.commands.insertContent('!');

    expect(textNode.attrs['content']).toContain('class="brand-bold"');
    expect(textNode.attrs['content']).toContain('id="bold-mark"');
    expect(textNode.attrs['content']).toContain('class="brand-em"');
    expect(textNode.attrs['content']).toContain('id="em-mark"');
    expect(textNode.attrs['content']).toContain('class="brand-under"');
    expect(textNode.attrs['content']).toContain('id="under-mark"');
    expect(textNode.attrs['content']).toContain('class="brand-strike"');
    expect(textNode.attrs['content']).toContain('id="strike-mark"');
    expect(textNode.attrs['content']).toContain('class="brand-link"');
    expect(textNode.attrs['content']).toContain('id="link-mark"');
    expect(component.lastMjml).toContain('class="brand-bold"');
    expect(component.lastMjml).toContain('id="bold-mark"');
    expect(component.lastMjml).toContain('class="brand-em"');
    expect(component.lastMjml).toContain('id="em-mark"');
    expect(component.lastMjml).toContain('class="brand-under"');
    expect(component.lastMjml).toContain('id="under-mark"');
    expect(component.lastMjml).toContain('class="brand-strike"');
    expect(component.lastMjml).toContain('id="strike-mark"');
    expect(component.lastMjml).toContain('class="brand-link"');
    expect(component.lastMjml).toContain('id="link-mark"');
  });

  it('should update text content from the Tiptap editor', () => {
    fixture.detectChanges();
    const textNode = component.selectedNode!;
    const editor = (component as any).tiptapInlineEditor;
    expect(editor).toBeTruthy();

    editor.commands.setContent('<p>Edited in Tiptap</p>');

    expect(textNode.attrs['content']).toContain('Edited in Tiptap');
    expect(component.lastMjml).toContain('Edited in Tiptap');
  });

  it('should apply Tiptap toolbar commands to text content', () => {
    fixture.detectChanges();
    const textNode = component.selectedNode!;
    const editor = (component as any).tiptapInlineEditor;
    expect(editor).toBeTruthy();

    editor.commands.setContent('<p>Make me bold</p>');
    editor.commands.selectAll();
    component.runTiptapCommand('inline', 'bold');

    expect(textNode.attrs['content']).toContain('<strong>Make me bold</strong>');
    expect(component.lastHtml).toContain('<strong>Make me bold</strong>');
  });

  it('should expose DIV as a Tiptap block format and convert between div and paragraph', () => {
    fixture.detectChanges();
    const textNode = component.selectedNode!;
    const editor = (component as any).tiptapInlineEditor;
    expect(editor).toBeTruthy();
    expect(component.tiptapBlockOptions.map((option) => option.value)).toContain('div');

    editor.commands.setContent('<p style="margin: 10px 0; color: #123456" class="tagged-block" id="tagged-block">Block tag</p>');
    editor.commands.selectAll();
    component.setTiptapBlockFormat('inline', 'div');
    expect(component.currentTiptapBlockFormat('inline')).toBe('div');
    expect(textNode.attrs['content']).toContain('<div');
    expect(textNode.attrs['content']).toContain('Block tag</div>');
    expect(textNode.attrs['content']).toContain('class="tagged-block"');
    expect(textNode.attrs['content']).toContain('id="tagged-block"');
    expect(textNode.attrs['content']).toContain('color: #123456');
    expect(textNode.attrs['content']).toContain('margin-top: 10px');
    expect(component.lastMjml).toContain('<div');
    expect(component.lastMjml).toContain('class="tagged-block"');

    editor.commands.selectAll();
    component.setTiptapBlockFormat('inline', 'paragraph');
    expect(component.currentTiptapBlockFormat('inline')).toBe('paragraph');
    expect(textNode.attrs['content']).toContain('<p');
    expect(textNode.attrs['content']).toContain('Block tag</p>');
    expect(textNode.attrs['content']).toContain('class="tagged-block"');
    expect(textNode.attrs['content']).toContain('id="tagged-block"');
    expect(textNode.attrs['content']).toContain('color: #123456');
    expect(textNode.attrs['content']).toContain('margin-top: 10px');
    expect(textNode.attrs['content']).not.toContain('<div');
  });

  it('should preserve per-block attributes when converting multiple Tiptap paragraphs to DIV', () => {
    fixture.detectChanges();
    const textNode = component.selectedNode!;
    const editor = (component as any).tiptapInlineEditor;
    expect(editor).toBeTruthy();

    editor.commands.setContent('<p id="first-block" class="first" style="color: #111111">First</p><p id="second-block" class="second" style="color: #222222">Second</p>');
    editor.commands.selectAll();
    component.setTiptapBlockFormat('inline', 'div');

    expect(textNode.attrs['content']).toContain('<div style="color: #111111" id="first-block" class="first">First</div>');
    expect(textNode.attrs['content']).toContain('<div style="color: #222222" id="second-block" class="second">Second</div>');
    expect(textNode.attrs['content']).not.toContain('id="first-block" class="first">Second');
    expect(textNode.attrs['content']).not.toContain('id="second-block" class="second">First');
  });

  it('should support expanded Tiptap formatting controls for headings, inline styles, lists, sizing, alignment, and undo', () => {
    fixture.detectChanges();
    const textNode = component.selectedNode!;
    const editor = (component as any).tiptapInlineEditor;
    expect(editor).toBeTruthy();

    editor.commands.setContent('<p>Make me fancy</p>');
    editor.commands.selectAll();
    component.setTiptapBlockFormat('inline', '1');
    expect(textNode.attrs['content']).toContain('<h1>Make me fancy</h1>');

    component.setTiptapBlockFormat('inline', 'paragraph');
    editor.commands.selectAll();
    component.runTiptapCommand('inline', 'underline');
    component.runTiptapCommand('inline', 'strike');
    expect(textNode.attrs['content']).toContain('<u>');
    expect(textNode.attrs['content']).toContain('<s>');

    editor.commands.setContent('<p>One</p><p>Two</p>');
    editor.commands.selectAll();
    component.runTiptapCommand('inline', 'bulletList');
    expect(textNode.attrs['content']).toContain('<ul>');
    expect(textNode.attrs['content']).toContain('<li>');

    editor.commands.setContent('<p>Size me</p>');
    editor.commands.selectAll();
    component.setTiptapFontSize('inline', '20px');
    expect(textNode.attrs['content']).toContain('font-size: 20px');

    component.setTiptapLineHeight('inline', '1.5');
    expect(textNode.attrs['content']).toContain('line-height: 1.5');

    component.setTiptapTextAlign('inline', 'center');
    expect(textNode.attrs['content']).toContain('text-align: center');

    component.runTiptapCommand('inline', 'undo');
    expect(textNode.attrs['content']).not.toContain('text-align: center');
  });

  it('should render shared Tiptap toolbar controls with active and disabled states', () => {
    fixture.detectChanges();
    const toolbar = studioRoot(fixture).querySelector('.nes-tiptap-toolbar') as HTMLElement;
    expect(toolbar?.textContent).toContain('Paragraph');
    expect(toolbar?.textContent).toContain('H1');
    expect(toolbar?.textContent).toContain('2×2');
    expect(toolbar?.textContent).toContain('Merge');
    expect(toolbar?.textContent).toContain('Split');
    expect(toolbar?.textContent).toContain('Head row');
    expect(toolbar.querySelector('.nes-tiptap-group')).toBeTruthy();
    expect(toolbar.querySelector('button[aria-label="Undo"] .fa-undo')).toBeTruthy();
    expect(toolbar.querySelector('button[aria-label="Redo"] .fa-repeat')).toBeTruthy();
    expect(toolbar.querySelector('button[aria-label="Bold"] .fa-bold')).toBeTruthy();
    expect(toolbar.querySelector('button[aria-label="Italic"] .fa-italic')).toBeTruthy();
    expect(toolbar.querySelector('button[aria-label="Underline"] .fa-underline')).toBeTruthy();
    expect(toolbar.querySelector('button[aria-label="Edit HTML source"] .fa-code')).toBeTruthy();
    expect(toolbar.querySelector('.nes-tiptap-table-btn .fa-table')).toBeTruthy();
    expect(toolbar.querySelectorAll('.nes-tiptap-row-break').length).toBe(2);
    expect(toolbar.querySelector('.nes-tiptap-table-group')).toBeTruthy();
    expect(toolbar.querySelector('button[aria-label="Undo"]')?.hasAttribute('disabled')).toBe(false);

    const readonlyFixture = TestBed.createComponent(NgxEmailStudio);
    readonlyFixture.componentRef.setInput('readonly', true);
    readonlyFixture.detectChanges();
    const readonlyToolbar = studioRoot(readonlyFixture).querySelector('.nes-tiptap-toolbar')!;
    expect(readonlyToolbar.querySelector('button[aria-label="Undo"]')?.hasAttribute('disabled')).toBe(true);
    expect(readonlyToolbar.querySelector('button[aria-label="Redo"]')?.hasAttribute('disabled')).toBe(true);
  });

  it('should insert safe Tiptap images through URL and upload helper modals', async () => {
    const uploadFile = new File(['png'], 'hero.png', { type: 'image/png' });
    const uploadSpy = vi.fn().mockResolvedValue({ url: 'https://cdn.example.com/hero.png', alt: 'Uploaded hero' });
    fixture.componentRef.setInput('config', { uploadImage: uploadSpy });
    fixture.detectChanges();
    const textNode = component.selectedNode!;
    const editor = (component as any).tiptapInlineEditor;
    expect(editor).toBeTruthy();
    expect(studioRoot(fixture).querySelector('.nes-tiptap-toolbar button[aria-label="Insert image"]')).toBeTruthy();

    (component as any).openTiptapImageModal('inline');
    expect(component.tiptapPrompt?.title).toBe('Insert image');
    component.tiptapPromptValue = 'javascript:alert(1)';
    component.applyTiptapPrompt();
    expect(component.tiptapPromptError).toContain('safe image URL');
    expect(String(textNode.attrs['content'])).not.toContain('javascript');

    component.tiptapPromptValue = 'https://images.example.com/banner.jpg';
    component.applyTiptapPrompt();
    expect(component.tiptapPrompt).toBeNull();
    expect(String(textNode.attrs['content'])).toContain('<img');
    expect(String(textNode.attrs['content'])).toContain('src="https://images.example.com/banner.jpg"');
    expect(component.lastMjml).toContain('src="https://images.example.com/banner.jpg"');

    (component as any).openTiptapImageModal('inline');
    await (component as any).uploadTiptapImageFromPrompt(uploadFile);
    expect(uploadSpy).toHaveBeenCalledWith(uploadFile, expect.objectContaining({ nodeId: textNode.id, currentUrl: '' }));
    expect(String(textNode.attrs['content'])).toContain('src="https://cdn.example.com/hero.png"');
    expect(String(textNode.attrs['content'])).toContain('alt="Uploaded hero"');
  });

  it('should sanitize rich text images at source/import and keep unsafe image URLs out', () => {
    const sanitized = (component as any).sanitizeRichTextContent('<p>Hero</p><img src="https://images.example.com/safe.png" alt="Safe hero" width="320"><img src="javascript:alert(1)" alt="Unsafe"><img alt="No src"><img src="https://" alt="No host">');

    expect(sanitized).toContain('<img');
    expect(sanitized).toContain('src="https://images.example.com/safe.png"');
    expect(sanitized).toContain('alt="Safe hero"');
    expect(sanitized).not.toContain('javascript');
    expect(sanitized).not.toContain('Unsafe');
    expect(sanitized).not.toContain('No src');
    expect(sanitized).not.toContain('No host');
  });

  it('should use polished Tiptap tool modals instead of browser prompts for link and table cell values', () => {
    fixture.detectChanges();
    const textNode = component.selectedNode!;
    const editor = (component as any).tiptapInlineEditor;
    expect(editor).toBeTruthy();
    const promptSpy = vi.spyOn(globalThis, 'prompt').mockReturnValue('https://bad.example');

    try {
      component.openTiptapLinkModal('inline');

      expect(promptSpy).not.toHaveBeenCalled();
      expect(component.tiptapPrompt?.title).toBe('Edit link URL');
      expect(componentStyleText()).toContain('.nes-tiptap-prompt-modal');
      component.closeTiptapPrompt();

      editor.commands.setContent('<p>Link me</p>');
      editor.commands.selectAll();
      component.runTiptapCommand('inline', 'link');
      expect(promptSpy).not.toHaveBeenCalled();

      component.tiptapPromptValue = 'javascript:alert(1)';
      component.applyTiptapPrompt();
      expect(component.tiptapPromptError).toContain('safe URL');
      expect(textNode.attrs['content']).not.toContain('javascript');

      component.tiptapPromptValue = 'https://example.com/newsletter';
      component.applyTiptapPrompt();
      expect(component.tiptapPrompt).toBeNull();
      expect(textNode.attrs['content']).toContain('href="https://example.com/newsletter"');

      component.runTiptapCommand('inline', 'insertTable');
      component.openTiptapCellStyleModal('inline', 'width', 'Cell width (px, %, auto)', '100%');
      expect(component.tiptapPrompt?.eyebrow).toBe('Table cell style');

      component.tiptapPromptValue = '9999px';
      component.applyTiptapPrompt();
      expect(component.tiptapPromptError).toContain('email-safe');

      component.tiptapPromptValue = '180px';
      component.applyTiptapPrompt();
      expect(component.tiptapPrompt).toBeNull();
      expect(textNode.attrs['content']).toContain('width: 180px');
    } finally {
      promptSpy.mockRestore();
    }
  });

  it('should open, apply, sanitize, and cancel rich text source edits', () => {
    fixture.detectChanges();
    const textNode = component.selectedNode!;

    const sourceButton = studioRoot(fixture).querySelector<HTMLButtonElement>('.nes-tiptap-toolbar button[aria-label="Edit HTML source"]');
    sourceButton?.click();
    fixture.detectChanges();
    expect(component.sourceEditorValue).toContain('<p');
    expect(query(fixture, '.nes-source-modal')).toBeTruthy();

    component.sourceEditorValue = '<h1 class="headline" id="headline-1">Edited source</h1><p class="safe-copy" onclick="x()">Safe</p><script>alert(1)</script>';
    component.applyRichTextSource();

    expect(textNode.attrs['content']).toContain('<h1 class="headline" id="headline-1">Edited source</h1>');
    expect(textNode.attrs['content']).toContain('<p class="safe-copy">Safe</p>');
    expect(textNode.attrs['content']).not.toContain('onclick');
    expect(textNode.attrs['content']).not.toContain('<script');
    expect(component.sourceEditorScope).toBeNull();

    const beforeCancel = textNode.attrs['content'];
    component.openRichTextSource('inline');
    component.sourceEditorValue = '<p>Discard me</p>';
    component.closeRichTextSource();

    expect(textNode.attrs['content']).toBe(beforeCancel);
  });

  it('should keep inline Tiptap clicks from opening the large editor modal', () => {
    fixture.detectChanges();
    const editorElement = query<HTMLElement>(fixture, '.nes-tiptap-editor .ProseMirror')!;

    editorElement.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
    fixture.detectChanges();

    expect(component.expandedRichTextNode).toBeUndefined();
    expect(query(fixture, '.nes-modal-backdrop')).toBeFalsy();
  });

  it('should support Tiptap table editing and preserve tables in exports', () => {
    fixture.detectChanges();
    const textNode = component.selectedNode!;

    component.runTiptapCommand('inline', 'insertTable');
    component.runTiptapCommand('inline', 'addColumnAfter');
    component.runTiptapCommand('inline', 'addRowAfter');

    expect(textNode.attrs['content']).toContain('<table');
    expect(textNode.attrs['content']).toContain('<th');
    expect(textNode.attrs['content']).toContain('<td');
    expect(component.lastMjml).toContain('<table');
    expect(component.lastHtml).toContain('<table');
    expect(studioRoot(fixture).querySelector('.nes-tiptap-toolbar')?.textContent).toContain('Table');
  });

  it('should style Tiptap table cells and preserve email-safe table styles', () => {
    fixture.detectChanges();
    const textNode = component.selectedNode!;
    const editor = (component as any).tiptapInlineEditor;
    expect(editor).toBeTruthy();

    component.runTiptapCommand('inline', 'insertTable');
    component.setTiptapCellStyle('inline', 'backgroundColor', '#fef3c7');
    component.setTiptapCellStyle('inline', 'borderColor', '#2563eb');
    component.setTiptapCellStyle('inline', 'borderWidth', '2px');
    component.setTiptapCellStyle('inline', 'borderStyle', 'dashed');
    component.setTiptapCellStyle('inline', 'width', '180px');
    component.setTiptapCellStyle('inline', 'height', '64px');
    component.setTiptapCellStyle('inline', 'padding', '12px');

    expect(textNode.attrs['content']).toContain('background-color: #fef3c7');
    expect(textNode.attrs['content']).toContain('border-color: #2563eb');
    expect(textNode.attrs['content']).toContain('border-width: 2px');
    expect(textNode.attrs['content']).toContain('border-style: dashed');
    expect(textNode.attrs['content']).toContain('width: 180px');
    expect(textNode.attrs['content']).toContain('height: 64px');
    expect(textNode.attrs['content']).toContain('padding: 12px');
    expect(component.lastMjml).toContain('background-color: #fef3c7');
    expect(component.lastHtml).toContain('border-style: dashed');
  });

  it('should keep unsafe table cell styles out of rich text content', () => {
    const sanitized = (component as any).sanitizeRichTextContent('<table><tr><td style="background-color:url(javascript:evil); border-color:#2563eb; width:9999px; padding:12px" onclick="x()">Safe</td></tr></table>');

    expect(sanitized).toContain('<td style="border-color: #2563eb; padding: 12px">Safe</td>');
    expect(sanitized).not.toContain('javascript');
    expect(sanitized).not.toContain('onclick');
    expect(sanitized).not.toContain('9999px');
  });

  it('should not reset active Tiptap content during sanitizer-equivalent sync', () => {
    fixture.detectChanges();
    const textNode = component.selectedNode!;
    const editor = (component as any).tiptapInlineEditor;
    expect(editor).toBeTruthy();

    component.runTiptapCommand('inline', 'insertTable');
    const setContentSpy = vi.spyOn(editor.commands, 'setContent');

    (component as any).syncTiptapContent(editor, textNode);

    expect(setContentSpy).not.toHaveBeenCalled();
  });

  it('should tolerate null config bindings', () => {
    const localFixture = TestBed.createComponent(NgxEmailStudio);
    localFixture.componentRef.setInput('config', null);
    expect(() => localFixture.detectChanges()).not.toThrow();
    expect(localFixture.componentInstance.effectiveConfig.showHtmlPreview).toBe(true);
  });

  it('should create distinct palette preset nodes for hero and footer modules', () => {
    const hero = component.palette.find((item) => item.preset === 'hero');
    const footer = component.palette.find((item) => item.preset === 'footer');

    expect(hero).toBeTruthy();
    expect(footer).toBeTruthy();

    component.clearDocument();
    component.addBlock(hero!);
    component.addBlock(footer!);

    expect(component.emailDocument.body.length).toBe(2);
    expect(component.emailDocument.body[0].type).toBe('section');
    expect(component.emailDocument.body[0].children?.[0].type).toBe('text');
    expect(component.emailDocument.body[0].children?.[0].attrs['content']).toContain('weekly newsletter');
    expect(component.emailDocument.body[1].type).toBe('section');
    expect(component.emailDocument.body[1].children?.[0].attrs['content']).toContain('Manage preferences');
  });

  it('should keep Content modules as drag-only two-column cards with hover descriptions', () => {
    fixture.detectChanges();
    const before = component.emailDocument.body.length;
    const cards = queryAll(fixture, '.nes-block') as NodeListOf<HTMLElement>;

    expect(cards.length).toBeGreaterThan(1);
    expect(query(fixture, '.nes-block-description')).toBeTruthy();
    expect(studioText(fixture)).toContain('Drag modules into the canvas, sections, or columns');

    cards[0].click();
    fixture.detectChanges();

    expect(component.emailDocument.body.length).toBe(before);
  });

  it('should render host-provided config templates and import their MJML as editable modules', () => {
    fixture.componentRef.setInput('config', {
      templates: [
        {
          icon: 'fa-star',
          name: 'Promo template',
          desc: 'Reusable promo MJML from host config',
          mjml: '<mj-section background-color="#ecfdf3"><mj-column><mj-text font-size="20px">Promo headline</mj-text><mj-button href="https://example.com" background-color="#16a34a">Shop now</mj-button></mj-column></mj-section>',
        },
        {
          icon: 'https://placehold.co/48x48/2563eb/ffffff.png?text=T',
          name: 'Image icon template',
          desc: 'Uses image URL icon',
          mjml: '<mj-section><mj-column><mj-text>Image icon body</mj-text></mj-column></mj-section>',
        },
      ],
    });
    fixture.detectChanges();

    expect(component.paletteItems.length).toBe(component.palette.length + 2);
    expect(studioText(fixture)).toContain('Promo template');
    expect(studioText(fixture)).toContain('Image icon template');
    expect(query(fixture, '.nes-fa-template-icon.fa-star')).toBeTruthy();
    expect(query(fixture, '.nes-block-icon img')).toBeTruthy();

    const before = component.emailDocument.body.length;
    const template = component.paletteItems.find((item) => item.label === 'Promo template')!;
    component.addBlock(template);

    expect(component.emailDocument.body.length).toBe(before + 1);
    const added = component.emailDocument.body.at(-1)!;
    expect(added.type).toBe('section');
    expect(added.children?.[0].type).toBe('text');
    expect(String(added.children?.[0].attrs['content'])).toContain('Promo headline');
    expect(component.lastMjml).toContain('Promo headline');
  });

  it('should sanitize template icon choices and wrap MJML snippets before parsing', () => {
    fixture.componentRef.setInput('config', {
      templates: [
        {
          icon: 'javascript:alert(1)',
          name: 'Snippet template',
          desc: 'Wrapped snippet',
          mjml: '<mj-section><mj-column><mj-text>Wrapped snippet body</mj-text></mj-column></mj-section>',
        },
        {
          icon: 'data:image/svg+xml;base64,PHN2Zy8+',
          name: 'SVG icon template',
          desc: 'Unsafe data SVG icon should fall back',
          mjml: '<mj-section><mj-column><mj-text>SVG icon body</mj-text></mj-column></mj-section>',
        },
      ],
    });
    fixture.detectChanges();

    const template = component.paletteItems.find((item) => item.label === 'Snippet template')!;
    const svgTemplate = component.paletteItems.find((item) => item.label === 'SVG icon template')!;

    expect(template.icon).toBe('fa-th-large');
    expect(template.templateIconUrl).toBe('');
    expect(svgTemplate.icon).toBe('fa-th-large');
    expect(svgTemplate.templateIconUrl).toBe('');

    component.addBlock(template);

    expect(component.emailDocument.body.at(-1)?.type).toBe('section');
    expect(component.lastMjml).toContain('Wrapped snippet body');
    expect(component.lastMjml).not.toContain('javascript:alert');
  });

  it('should preserve every content block when dropping a custom template into an existing column', () => {
    fixture.componentRef.setInput('config', {
      templates: [
        {
          icon: 'fa-star',
          name: 'Nested promo template',
          desc: 'Multiple content modules inside one MJML section',
          mjml: '<mj-section><mj-column><mj-text>Nested promo headline</mj-text><mj-button href="https://example.com/nested">Nested CTA</mj-button></mj-column></mj-section>',
        },
      ],
    });
    fixture.detectChanges();

    const row = component.emailDocument.body.find((node) => node.type === 'row');
    const column = row?.children?.[0];
    expect(column).toBeTruthy();
    const before = column?.children?.length || 0;
    const template = component.paletteItems.find((item) => item.label === 'Nested promo template')!;

    component.drop({
      previousContainer: { data: component.paletteItems } as any,
      container: { id: component.dropListIdFor(column!), data: column?.children || [] } as any,
      previousIndex: component.paletteItems.indexOf(template),
      currentIndex: before,
      item: { data: template } as any,
    } as any);

    expect(column?.children?.length).toBe(before + 2);
    expect(String(column?.children?.[before].attrs['content'])).toContain('Nested promo headline');
    expect(column?.children?.[before + 1].type).toBe('button');
    expect(column?.children?.[before + 1].attrs['label']).toBe('Nested CTA');
  });

  it('should remove visible drop zones and use red insertion-line styling', () => {
    fixture.detectChanges();

    expect(studioText(fixture)).not.toContain('Add content inside this column');
    expect(query(fixture, '.nes-add-grid')).toBeFalsy();
    expect(query(fixture, '.nes-add-column-block')).toBeFalsy();
    expect(query(fixture, '.nes-column-drop-zone')).toBeFalsy();
    expect(query(fixture, '.nes-section-drop-zone')).toBeFalsy();
    expect(query(fixture, '.nes-bottom-drop')).toBeFalsy();
    expect(studioText(fixture)).not.toContain('Drag another module into this column');
    expect(studioText(fixture)).not.toContain('Drag another module into this section');
    expect(studioText(fixture)).not.toContain('Drop Content modules here');
    expect(studioText(fixture)).not.toContain('Add text');
    expect((component as any).paletteDropListId).toMatch(/^nes-\d+-palette-drop-list$/);
  });

  it('should make drag targets easier to enter without adding visible drop-zone boxes', () => {
    fixture.detectChanges();

    const hitPads = queryAll(fixture, '.nes-drop-hit-pad') as NodeListOf<HTMLElement>;
    const section = query(fixture, '.nes-render-section') as HTMLElement;
    const column = query(fixture, '.nes-render-column') as HTMLElement;
    const paletteCard = query(fixture, '.nes-block') as HTMLElement;

    expect(hitPads.length).toBeGreaterThan(0);
    expect(section).toBeTruthy();
    expect(column).toBeTruthy();
    expect(paletteCard).toBeTruthy();
    expect(component.connectedDropListIds).toContain(component.paletteDropListId);
    expect(component.connectedDropListIds).toContain(component.rootDropListId);
  });


  it('should keep the 600 preview contained while preserving exported email width', () => {
    component.setPreviewSize(600);
    component.updateDocumentAttr('width', 640);
    component.updateDocumentAttr('widthUnit', 'px');

    expect(component.previewWidth).toBe(600);
    expect(component.emailWidthCss).toBe('640px');
    expect(component.emailCanvasWidthCss).toBe('min(100%, 640px)');
    expect(component.emailCanvasMaxWidthCss).toBe('min(100%, 600px)');
    expect(component.lastHtml).toContain('width="640"');
  });

  it('should allow multiple content modules to be dragged from the palette into a section', () => {
    fixture.detectChanges();
    expect(query(fixture, '.nes-section-drop-zone')).toBeFalsy();
    expect(component.connectedDropListIds).toContain(component.paletteDropListId);

    const paletteList = query(fixture, '.nes-block-list') as HTMLElement;
    expect(paletteList.id).toBe(component.paletteDropListId);

    const section = component.emailDocument.body.find((node) => node.type === 'section')!;
    const before = section.children?.length || 0;

    component.drop({
      previousContainer: { data: component.palette } as any,
      container: { id: component.dropListIdFor(section), data: section.children || [] } as any,
      previousIndex: 1,
      currentIndex: before,
      item: { data: { type: 'text', label: 'Text', icon: 'fa-font', description: 'Rich text content' } } as any,
    } as any);

    expect(section.children?.length).toBe(before + 1);
    expect(section.children?.[before].type).toBe('text');
  });

  it('should show floating tools for nested section content modules', () => {
    const section = component.emailDocument.body.find((node) => node.type === 'section')!;
    const child = section.children?.[0]!;
    component.selectNode(child.id);
    fixture.detectChanges();

    const nestedNode = query(fixture, `[data-node-id="${child.id}"]`) as HTMLElement;
    expect(nestedNode).toBeTruthy();
    expect(nestedNode.querySelector('.nes-floating-tools')).toBeTruthy();
  });


  it('should normalize section presets dropped inside a section so export keeps their content', () => {
    const section = component.emailDocument.body.find((node) => node.type === 'section')!;
    const hero = component.palette.find((item) => item.preset === 'hero')!;
    const before = section.children?.length || 0;

    component.drop({
      previousContainer: { data: component.palette } as any,
      container: { id: component.dropListIdFor(section), data: section.children || [] } as any,
      previousIndex: component.palette.indexOf(hero),
      currentIndex: before,
      item: { data: hero } as any,
    } as any);

    expect(section.children?.[before].type).toBe('text');
    expect(section.children?.[before].attrs['content']).toContain('Campaign update');
    expect(component.lastMjml).toContain('Campaign update');
    expect(component.lastMjml).not.toContain('Section container');
  });


  it('should preserve nested section children if a document provides them programmatically', () => {
    const nestedSection = (component as any).createSectionWithChildren([
      { id: 'text_nested', type: 'text', attrs: { content: '<p>Nested content</p>' } },
    ]);
    const mjml = (component as any).compileMjml({
      version: '0.0.1',
      attrs: (component as any).defaultDocumentAttrs(),
      body: [nestedSection],
    }) as string;

    expect(mjml).toContain('Nested content');
    expect(mjml).not.toContain('Section container');
  });

  it('should guard readonly mode against direct mutation methods', () => {
    const localFixture = TestBed.createComponent(NgxEmailStudio);
    const localComponent = localFixture.componentInstance;
    const original = structuredClone(localComponent.emailDocument);
    const textNode = localComponent.emailDocument.body[0].children?.[0] || localComponent.emailDocument.body[0];
    const row = localComponent.emailDocument.body.find((node) => node.type === 'row');

    localFixture.componentRef.setInput('readonly', true);
    localFixture.detectChanges();

    localComponent.updateAttr(textNode, 'content', '<p>Mutated</p>');
    localComponent.updateDocumentAttr('backgroundColor', '#000000');
    localComponent.updateSectionPaddingAll(localComponent.emailDocument.body[0], 99);
    localComponent.updateSectionPaddingSide(localComponent.emailDocument.body[0], 'paddingTop', 88);
    if (row) localComponent.setRowColumns(row, 4);
    localComponent.addChildBlock(localComponent.emailDocument.body[0], 'text');
    localComponent.openImportModal();
    localComponent.mjmlDraft = '<mjml><mj-body><mj-section><mj-column><mj-text>Readonly import</mj-text></mj-column></mj-section></mj-body></mjml>';
    localComponent.importMjml();
    localComponent.openRichTextModal(textNode);
    localComponent.updateExpandedRichText('<p>Rich mutation</p>');
    localComponent.selectNode(localComponent.emailDocument.body[0].id);
    localComponent.duplicateSelected();
    localComponent.deleteSelected();

    expect(localComponent.emailDocument).toEqual(original);
    expect(localComponent.importModalOpen).toBe(false);
    expect(localComponent.expandedRichTextNode).toBeUndefined();
  });

  it('should render the left panel as Content modules and Outline tabs with a nested tree view', () => {
    fixture.detectChanges();

    const tabs = queryAll(fixture, '.nes-left-tabs button') as NodeListOf<HTMLButtonElement>;
    expect(tabs.length).toBe(2);
    expect(studioText(fixture)).toContain('Content modules');
    expect(query(fixture, '.nes-block-list')).toBeTruthy();

    tabs[1].click();
    fixture.detectChanges();

    const outlineNodes = queryAll(fixture, '.nes-outline-node') as NodeListOf<HTMLButtonElement>;
    expect(query(fixture, '.nes-outline-tree')).toBeTruthy();
    expect(outlineNodes.length).toBe(component.totalOutlineNodes);
    expect(outlineNodes.length).toBeGreaterThan(component.emailDocument.body.length);
    expect(studioText(fixture)).toContain('Tree view of sections, rows, columns and nested blocks');
    expect(studioText(fixture)).toContain('02.1');

    outlineNodes[1].click();
    expect(component.selectedNodeId).toBeTruthy();
  });


  it('should label sections simply and scroll the stage when an outline item is clicked', async () => {
    fixture.detectChanges();
    const tabs = queryAll(fixture, '.nes-left-tabs button') as NodeListOf<HTMLButtonElement>;
    tabs[1].click();
    fixture.detectChanges();

    expect(studioText(fixture)).toContain('Section');
    expect(studioText(fixture)).not.toContain('Hero / Section');

    const stage = query(fixture, '.nes-stage') as HTMLElement;
    const calls: ScrollToOptions[] = [];
    stage.scrollTo = (options?: ScrollToOptions | number, y?: number) => {
      calls.push(typeof options === 'number' ? { top: y } : options || {});
    };

    const outlineNodes = queryAll(fixture, '.nes-outline-node') as NodeListOf<HTMLButtonElement>;
    outlineNodes[1].click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(calls.length).toBeGreaterThan(0);
    expect(calls[0].behavior).toBe('smooth');
  });


  it('should scope outline scrolling to the clicked component instance', async () => {
    const firstFixture = TestBed.createComponent(NgxEmailStudio);
    const secondFixture = TestBed.createComponent(NgxEmailStudio);
    firstFixture.detectChanges();
    secondFixture.detectChanges();

    const firstStage = query(firstFixture, '.nes-stage') as HTMLElement;
    const secondStage = query(secondFixture, '.nes-stage') as HTMLElement;
    const firstCalls: ScrollToOptions[] = [];
    const secondCalls: ScrollToOptions[] = [];
    firstStage.scrollTo = (options?: ScrollToOptions | number, y?: number) => firstCalls.push(typeof options === 'number' ? { top: y } : options || {});
    secondStage.scrollTo = (options?: ScrollToOptions | number, y?: number) => secondCalls.push(typeof options === 'number' ? { top: y } : options || {});

    const secondTabs = queryAll(secondFixture, '.nes-left-tabs button') as NodeListOf<HTMLButtonElement>;
    secondTabs[1].click();
    secondFixture.detectChanges();
    const secondOutlineNodes = queryAll(secondFixture, '.nes-outline-node') as NodeListOf<HTMLButtonElement>;
    secondOutlineNodes[1].click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(firstCalls.length).toBe(0);
    expect(secondCalls.length).toBeGreaterThan(0);
  });

  it('should keep the outline click-only without drag handles or drop targets', () => {
    fixture.detectChanges();
    const tabs = queryAll(fixture, '.nes-left-tabs button') as NodeListOf<HTMLButtonElement>;
    tabs[1].click();
    fixture.detectChanges();

    const first = component.emailDocument.body[0];
    const beforeRootIds = component.emailDocument.body.map((node) => node.id);
    const outlineNodes = queryAll(fixture, '.nes-outline-node') as NodeListOf<HTMLButtonElement>;

    expect(queryAll(fixture, '.nes-outline-handle').length).toBe(0);
    expect(queryAll(fixture, '.nes-outline-drop-list').length).toBe(0);
    expect((component as any).beginOutlineDrag).toBeUndefined();
    expect((component as any).dropOutlineOn).toBeUndefined();

    outlineNodes[1].click();

    expect(component.selectedNodeId).toBe(first.id);
    expect(component.emailDocument.body.map((node) => node.id)).toEqual(beforeRootIds);
  });

  it('should render internal SVG-mask icons without relying on global Font Awesome CSS', () => {
    fixture.detectChanges();

    const paletteIcon = query<HTMLElement>(fixture, '.nes-block-icon .nes-icon');
    const componentStyles = componentStyleText();
    expect(paletteIcon).toBeTruthy();
    expect(paletteIcon?.className).toContain('fa-');
    expect(query(fixture, '.nes-block-icon .fa')).toBeTruthy();
    expect(componentStyles).toContain('mask: var(--nes-icon-mask)');
    expect(componentStyles).toContain('data:image/svg+xml');
  });

  it('should keep the canvas selection frame while preventing native text selection', () => {
    fixture.detectChanges();

    const componentStyles = componentStyleText();
    const compactComponentStyles = componentStyles.replace(/\s+/g, ' ');
    expect(compactComponentStyles).toContain('.nes-block-list.cdk-drop-list-dragging .nes-block:not(.cdk-drag-preview):hover');
    expect(compactComponentStyles).toContain('.nes-render-column.cdk-drop-list-dragging .nes-drop-hit-pad, .nes-render-section.cdk-drop-list-dragging .nes-drop-hit-pad { opacity: 0; background: transparent; }');
    expect(compactComponentStyles).toContain('.nes-node.is-selected, .nes-child-node.is-selected, .nes-render-column.is-selected { border-color: var(--nes-accent); box-shadow: inset 0 0 0 1px var(--nes-accent); }');
    expect(compactComponentStyles).toContain('.nes-canvas { min-height: 520px; max-width: 100%; margin: 0 auto; padding: 0; transition: width .2s ease, max-width .2s ease, background .15s ease, border-radius .15s ease, border-color .15s ease; box-shadow: 0 18px 48px rgba(15, 23, 42, .08); box-sizing: border-box; overflow: hidden; user-select: none; -webkit-user-select: none; }');
    expect(compactComponentStyles).toContain('.nes-shell.is-dragging .nes-floating-tools { display: none; }');
    expect(componentStyles).not.toContain('.nes-canvas.cdk-drop-list-dragging { outline:');
    expect(componentStyles).not.toContain('.nes-render-column.cdk-drop-list-dragging, .nes-render-section.cdk-drop-list-dragging, .nes-canvas.cdk-drop-list-dragging');
  });

  it('should clear any native browser text selection while dragging on the canvas', () => {
    fixture.detectChanges();

    const componentStyles = componentStyleText();
    let cleared = 0;
    const originalGetSelection = globalThis.getSelection;
    Object.defineProperty(globalThis, 'getSelection', {
      configurable: true,
      value: () => ({ removeAllRanges: () => { cleared += 1; } }),
    });

    try {
      expect(component.dragInProgress).toBe(false);
      component.beginDrag();
      expect(component.dragInProgress).toBe(true);
      component.endDrag();
      expect(component.dragInProgress).toBe(false);
    } finally {
      Object.defineProperty(globalThis, 'getSelection', { configurable: true, value: originalGetSelection });
    }

    expect(componentStyles).toMatch(/\.nes-canvas \{[^}]*box-sizing:\s*border-box;[^}]*user-select:\s*none;[^}]*-webkit-user-select:\s*none;/);
    const compactComponentStyles = componentStyles.replace(/\s+/g, ' ');
    expect(compactComponentStyles).toContain('.nes-shell.is-dragging .nes-canvas, .nes-shell.is-dragging .nes-canvas *, .cdk-drag-preview, .cdk-drag-preview * { user-select: none; -webkit-user-select: none; }');
    expect(cleared).toBe(2);
  });


  it('should render CDK drag sources inside the light DOM host for parent-container previews', () => {
    fixture.detectChanges();

    const drags = queryAll<HTMLElement>(fixture, '.cdk-drag');
    expect(drags.length).toBeGreaterThan(0);
    expect(query(fixture, '.nes-block.cdk-drag')).toBeTruthy();
    expect(query(fixture, '.nes-node.cdk-drag')).toBeTruthy();
  });

  it('should render component styles in the light DOM host', () => {
    const hostFixture = TestBed.createComponent(HostileCssHostComponent);
    hostFixture.detectChanges();

    const host = hostFixture.nativeElement.querySelector('ngx-email-studio') as HTMLElement;
    expect(host.shadowRoot).toBeNull();
    const builder = host.querySelector('.nes-builder') as HTMLElement;
    const button = host.querySelector('.nes-toolbar button') as HTMLButtonElement;
    const styles = componentStyleText();

    expect(builder).toBeTruthy();
    expect(button).toBeTruthy();
    expect(styles).toMatch(/ngx-email-studio\s*{[\s\S]*--nes-accent:\s*#2563eb;/);
    expect(styles).not.toContain(':host {');
    expect(styles).toMatch(/\.nes-builder\s*{[\s\S]*display:\s*grid;/);
    expect(styles).toMatch(/ngx-email-studio button\s*{[\s\S]*border:\s*1px solid var\(--nes-border\);/);
    expect(styles).toMatch(/ngx-email-studio input,\s*ngx-email-studio textarea,\s*ngx-email-studio select/);
    expect(styles).toContain('.nes-tiptap-icon-btn');
    expect(styles).toContain('.fa-bold');
    expect(styles).toContain('.fa-table');
    expect(styles).toContain('.nes-tiptap-source-btn');
    expect(styles).toContain('.nes-tiptap-row-break');
    expect(styles).toContain('.nes-tiptap-table-group');
    expect(styles).toContain('content: attr(aria-label)');
    expect(styles).toContain('.nes-tiptap-icon-btn:hover:not(:disabled)::after');
  });

  it('should simplify the header and render an internal logo icon', () => {
    fixture.detectChanges();

    expect(studioText(fixture)).toContain('Email Studio');
    expect(studioText(fixture)).not.toContain('Membership Email');
    expect(query(fixture, '.nes-breadcrumb')).toBeFalsy();
    expect(query(fixture, '.nes-save-state')).toBeFalsy();
    const logoIcon = query<HTMLElement>(fixture, '.nes-logo .nes-icon');
    expect(logoIcon).toBeTruthy();
    expect(logoIcon?.className).toContain('fa-envelope-open-o');
  });

  it('should open a large rich text editor modal from the inspector', () => {
    const textNode = component.emailDocument.body[0].children?.[0];
    expect(textNode?.type).toBe('text');

    component.openRichTextModal(textNode!);

    expect(component.expandedRichTextNode?.id).toBe(textNode!.id);
    component.updateExpandedRichText('<p>Updated from large editor</p>');
    expect(textNode!.attrs['content']).toContain('Updated from large editor');
  });

  it('should sanitize rich text for canvas render, MJML import, and generated exports', () => {
    const textNode = component.emailDocument.body[0].children?.[0];
    expect(textNode?.type).toBe('text');

    const unsafe = '<p onclick="window.evil=true">Safe <strong>copy</strong></p><script>window.evil=true</script><img src="x" onerror="window.evil=true">';
    component.updateAttr(textNode!, 'content', unsafe);
    const sanitized = String(textNode!.attrs['content']);

    expect(sanitized).toContain('<strong>copy</strong>');
    expect(sanitized).not.toContain('<script');
    expect(sanitized).not.toContain('onclick');
    expect(sanitized).not.toContain('onerror');

    expect(component.sanitizedRichText(unsafe)).not.toContain('<script');
    expect(component.sanitizedRichText(unsafe)).not.toContain('onerror');

    const mjml = (component as any).compileMjml(component.emailDocument) as string;
    const html = (component as any).renderHtml(component.emailDocument) as string;
    expect(mjml).not.toContain('<script');
    expect(mjml).not.toContain('onclick');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('onerror');

    const importUnsafe = '<p onclick="window.evil=true">Safe <strong>copy</strong></p><img src="x" onerror="window.evil=true" />';
    const imported = (component as any).parseMjml(`<mjml><mj-body><mj-section><mj-column><mj-text>${importUnsafe}</mj-text></mj-column></mj-section></mj-body></mjml>`) as EmailDocument;
    const importedContent = String(imported.body[0].children?.[0].attrs['content'] || '');
    expect(importedContent).toContain('<strong>copy</strong>');
    expect(importedContent).not.toContain('<script');
    expect(importedContent).not.toContain('onclick');
    expect(importedContent).not.toContain('onerror');
  });

  it('should open export dropdown and show MJML output in a modal instead of bottom output panels', () => {
    fixture.detectChanges();

    const exportButton = query(fixture, '.nes-export > button') as HTMLButtonElement;
    exportButton.click();
    fixture.detectChanges();

    expect(query(fixture, '.nes-export-menu')).toBeTruthy();
    expect(query(fixture, '.nes-output')).toBeFalsy();

    const menuItem = query(fixture, '.nes-export-menu button') as HTMLButtonElement;
    menuItem.click();
    fixture.detectChanges();

    expect(component.outputModalType).toBe('mjml');
    expect(query(fixture, '.nes-output-modal')).toBeTruthy();
    expect(studioText(fixture)).toContain('MJML Output');
    expect(query(fixture, '.nes-output-modal pre')?.textContent).toContain('<mjml>');
  });

  it('should close the export dropdown on outside click and Escape', () => {
    fixture.detectChanges();

    component.toggleExportMenu();
    expect(component.exportMenuOpen).toBe(true);

    component.closeTransientMenus();
    expect(component.exportMenuOpen).toBe(false);

    component.toggleExportMenu();
    expect(component.exportMenuOpen).toBe(true);
    component.onDocumentEscape();
    expect(component.exportMenuOpen).toBe(false);

    component.toggleExportMenu();
    expect(component.exportMenuOpen).toBe(true);
    component.onDocumentClick({ composedPath: () => [document.body] } as unknown as MouseEvent);
    expect(component.exportMenuOpen).toBe(false);
  });

  it('should keep toolbar actions ordered as Import, Export, Save with a decorated export menu', () => {
    fixture.detectChanges();

    const actionButtons = queryAll<HTMLButtonElement>(fixture, '.nes-actions > button, .nes-actions .nes-export-trigger');
    expect(Array.from(actionButtons).map((button) => button.textContent?.trim().replace(/\s+/g, ' '))).toEqual(['Transform', 'Import', 'Export', 'Save']);

    const exportButton = query<HTMLButtonElement>(fixture, '.nes-export-trigger')!;
    exportButton.click();
    fixture.detectChanges();

    expect(query(fixture, '.nes-export-menu .fa-code')).toBeTruthy();
    expect(query(fixture, '.nes-export-menu .fa-external-link')).toBeTruthy();
  });

  it('should show formatted HTML output when selected from the export menu', () => {
    fixture.detectChanges();

    const exportButton = query(fixture, '.nes-export > button') as HTMLButtonElement;
    exportButton.click();
    fixture.detectChanges();

    const menuItems = queryAll(fixture, '.nes-export-menu button') as NodeListOf<HTMLButtonElement>;
    menuItems[1].click();
    fixture.detectChanges();

    const output = query(fixture, '.nes-output-modal pre')?.textContent || '';
    expect(component.outputModalType).toBe('html');
    expect(component.outputModalTitle).toBe('HTML Output');
    expect(query(fixture, '.nes-preview-btn')).toBeTruthy();
    expect(output).toContain('<!doctype html>\n<html xmlns="http://www.w3.org/1999/xhtml"');
    expect(output).toContain('  <head>');
    expect(output).toContain('          <table role="presentation"');
  });

  it('should open the HTML export in a sandboxed preview frame', () => {
    const originalOpen = window.open;
    const writes: string[] = [];
    const previewWindow = {
      document: {
        open: () => undefined,
        write: (value: string) => writes.push(value),
        close: () => undefined,
      },
      opener: window,
    };
    Object.defineProperty(window, 'open', { configurable: true, value: () => previewWindow });

    try {
      component.openOutputModal('html');
      component.lastHtml = '<!doctype html><html><body><script>window.evil=true</script><img src="x" onerror="window.evil=true"></body></html>';
      component.previewHtmlOutput();

      expect(writes[0]).toContain('<iframe title="Email preview" sandbox=""');
      expect(writes[0]).toContain('srcdoc="');
      expect(writes[0]).toContain('&lt;script>window.evil=true');
      expect(writes[0]).toContain('&quot;x&quot; onerror=&quot;window.evil=true&quot;');
      expect(writes[0]).not.toContain('<script>window.evil=true</script>');
      expect(previewWindow.opener).toBeNull();
    } finally {
      Object.defineProperty(window, 'open', { configurable: true, value: originalOpen });
    }
  });

  it('should copy the active export modal output', async () => {
    const originalClipboard = globalThis.navigator.clipboard;
    const writes: string[] = [];
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      configurable: true,
      value: { writeText: async (value: string) => writes.push(value) },
    });

    component.openOutputModal('mjml');
    await component.copyOutputToClipboard();

    expect(writes[0]).toContain('<mjml>');
    expect(component.copyState).toBe('Copied');

    Object.defineProperty(globalThis.navigator, 'clipboard', { configurable: true, value: originalClipboard });
  });

  it('should show copy failure when clipboard and fallback copy fail', async () => {
    const originalClipboard = globalThis.navigator.clipboard;
    const originalExecCommand = document.execCommand;
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      configurable: true,
      value: { writeText: async () => Promise.reject(new Error('denied')) },
    });
    Object.defineProperty(document, 'execCommand', { configurable: true, value: () => false });

    component.openOutputModal('mjml');
    await component.copyOutputToClipboard();

    expect(component.copyState).toBe('Copy failed');

    Object.defineProperty(globalThis.navigator, 'clipboard', { configurable: true, value: originalClipboard });
    Object.defineProperty(document, 'execCommand', { configurable: true, value: originalExecCommand });
  });

  it('should keep the import modal open and show an error for malformed MJML', () => {
    component.openImportModal();
    component.mjmlDraft = '<mjml><mj-body><mj-section><mj-column><mj-text>Broken';
    const existingBody = component.emailDocument.body;

    component.importMjml();

    expect(component.importModalOpen).toBe(true);
    expect(component.importErrorMessage).toContain('Unable to import MJML');
    expect(component.emailDocument.body).toBe(existingBody);
  });

  it('should open import in a modal and close it after a valid import', () => {
    fixture.detectChanges();

    const importButton = query(fixture, '.nes-import-trigger') as HTMLButtonElement;
    importButton.click();
    fixture.detectChanges();

    expect(component.importModalOpen).toBe(true);
    expect(query(fixture, '.nes-import-modal')).toBeTruthy();
    expect(query(fixture, '.nes-import')).toBeFalsy();

    component.mjmlDraft = '<mjml><mj-body><mj-section><mj-column><mj-text>Hello import</mj-text></mj-column></mj-section></mj-body></mjml>';
    component.importMjml();

    expect(component.importModalOpen).toBe(false);
    expect(component.emailDocument.body[0].type).toBe('section');
    expect(component.emailDocument.body[0].children?.[0].type).toBe('text');
    expect(component.emailDocument.body[0].children?.[0].attrs['content']).toContain('Hello import');
  });
});
