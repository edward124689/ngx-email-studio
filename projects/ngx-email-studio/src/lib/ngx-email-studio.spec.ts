import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EmailDocument, NgxEmailStudio } from './ngx-email-studio';

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

  function connectIframeForMessages(target: NgxEmailStudio = component): Window {
    target.setCanvasMode('iframe-edit');
    const frameWindow = {} as Window;
    (target as any).canvasIframe = { nativeElement: { contentWindow: frameWindow } };
    return frameWindow;
  }

  function connectIframeForParentPosts(target: NgxEmailStudio = component, rect = { left: 100, top: 50, right: 700, bottom: 650 }): { posts: unknown[]; frameWindow: Window } {
    target.setCanvasMode('iframe-edit');
    const posts: unknown[] = [];
    const frameWindow = { postMessage: (message: unknown) => posts.push(message) } as unknown as Window;
    (target as any).canvasIframe = {
      nativeElement: {
        contentWindow: frameWindow,
        getBoundingClientRect: () => rect,
      },
    };
    return { posts, frameWindow };
  }

  function bridgeMessage(target: NgxEmailStudio, source: Window, data: Record<string, unknown>): MessageEvent {
    return { source, data: { ...data, bridgeToken: (target as any).iframeBridgeToken } } as MessageEvent;
  }

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should default email width to 100% and max-width to 600px', () => {
    fixture.detectChanges();
    (component as any).refreshOutputs(false);

    expect(component.emailWidth).toBe(100);
    expect(component.emailWidthCss).toBe('100%');
    expect(component.emailMaxWidthCss).toBe('600px');
    expect(component.emailCanvasWidthCss).toBe('100%');
    expect(component.emailCanvasMaxWidthCss).toBe('min(100%, 600px)');
    expect(component.lastMjml).toContain('<mj-body background-color="#f3f4f6" width="100%">');
    expect(component.lastHtml).toContain('width="100%"');
    expect(component.lastHtml).toContain('style="width:100%;max-width:600px;');
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
    expect(mjml).toContain('<mj-button href="#" background-color="#7c3aed">Right</mj-button>');
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

  it('should resolve TinyMCE assets relative to the current base URI', () => {
    const baseUrl = (component as any).resolveTinyMceBaseUrl() as string;
    expect(baseUrl.endsWith('/tinymce')).toBe(true);
    expect(baseUrl.startsWith('http')).toBe(true);
    expect((component.tinyMceInit['base_url'] as string).endsWith('/tinymce')).toBe(true);
  });

  it('should drop palette blocks into a row column', () => {
    const row = component.emailDocument.body.find((node) => node.type === 'row');
    const column = row?.children?.[0];
    expect(column).toBeTruthy();
    const before = column?.children?.length || 0;

    component.drop({
      previousContainer: { data: component.palette } as any,
      container: { data: column?.children || [] } as any,
      previousIndex: 0,
      currentIndex: before,
      item: { data: { type: 'text', label: 'Text', icon: 'fa-font', description: 'Rich text content' } } as any,
    } as any);

    expect(column?.children?.length).toBe(before + 1);
    expect(column?.children?.[before].type).toBe('text');
    expect(component.connectedDropListIds).toContain(component.dropListIdFor(column!));
    expect(component.connectedDropListIds).toContain(component.paletteDropListId);
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

    expect(html).toContain('<body style="margin:0;background:#111827;">');
    expect(html).toContain('style="background:#111827;padding:24px 0;"');
    expect(html).toContain('<table role="presentation" width="720" cellspacing="0" cellpadding="0" style="width:720px;max-width:720px;background:#fefce8;');
  });

  it('should expose Body as the outline root and edit exported body settings', () => {
    fixture.detectChanges();
    const tabs = fixture.nativeElement.querySelectorAll('.nes-left-tabs button') as NodeListOf<HTMLButtonElement>;
    tabs[1].click();
    fixture.detectChanges();

    const outlineNodes = fixture.nativeElement.querySelectorAll('.nes-outline-node') as NodeListOf<HTMLButtonElement>;
    expect(outlineNodes.length).toBe(component.totalOutlineNodes);
    expect(outlineNodes[0].textContent).toContain('Body');

    outlineNodes[0].click();
    fixture.detectChanges();

    expect(component.selectedNodeId).toBe((component as any).bodyNodeId);
    expect(fixture.nativeElement.textContent).toContain('Body / Email canvas');
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
    expect(component.lastMjml).toContain('<mj-body background-color="#f3f4f6" width="100%">');
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
    expect(component.lastHtml).toContain('class="nes-email-column" width="45%"');
    expect(component.lastHtml).toContain('width:45%;max-width:600px;');
  });

  it('should stack columns vertically at 480px and below in preview and exported HTML', () => {
    fixture.detectChanges();
    (component as any).refreshOutputs(false);
    const styleText = fixture.nativeElement.textContent + Array.from(document.querySelectorAll('style')).map((style) => style.textContent || '').join('\n');
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
    const modeButtons = fixture.nativeElement.querySelectorAll('.nes-mode-toggle button') as NodeListOf<HTMLButtonElement>;

    modeButtons[1].click();
    fixture.detectChanges();
    expect(component.canvasMode).toBe('preview');

    modeButtons[0].click();
    fixture.detectChanges();
    expect(component.canvasMode).toBe('edit');
  });

  it('should render the iframe editable canvas by default in edit mode', () => {
    fixture.detectChanges();

    expect(component.effectiveConfig.iframeCanvas).toBe(true);
    expect(fixture.nativeElement.querySelector('.nes-editor-frame')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.nes-canvas')).toBeFalsy();
    expect(fixture.nativeElement.querySelector('.nes-preview-frame')).toBeFalsy();
  });

  it('should render an isolated iframe preview instead of the editable canvas in preview mode', () => {
    fixture.detectChanges();
    const modeButtons = fixture.nativeElement.querySelectorAll('.nes-mode-toggle button') as NodeListOf<HTMLButtonElement>;
    modeButtons[1].click();
    fixture.detectChanges();

    const iframe = fixture.nativeElement.querySelector('.nes-preview-frame') as HTMLIFrameElement;
    expect(iframe).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.nes-canvas')).toBeFalsy();
    expect(iframe.getAttribute('title')).toBe('Email preview');
    expect(iframe.hasAttribute('sandbox')).toBe(true);
    expect(iframe.getAttribute('sandbox')).not.toContain('allow-scripts');
    expect(iframe.getAttribute('sandbox')).not.toContain('allow-same-origin');
  });

  it('should bind exported HTML with the real 480px media query into the preview iframe srcdoc', () => {
    fixture.detectChanges();
    const modeButtons = fixture.nativeElement.querySelectorAll('.nes-mode-toggle button') as NodeListOf<HTMLButtonElement>;
    modeButtons[1].click();
    fixture.detectChanges();

    const iframe = fixture.nativeElement.querySelector('.nes-preview-frame') as HTMLIFrameElement;
    const srcdoc = iframe.getAttribute('srcdoc') || '';

    expect(srcdoc).toContain(component.lastHtml);
    expect(srcdoc).toContain('@media only screen and (max-width:480px)');
  });

  it('should use the shared 400px preview size for the preview iframe width', () => {
    fixture.detectChanges();
    const modeButtons = fixture.nativeElement.querySelectorAll('.nes-mode-toggle button') as NodeListOf<HTMLButtonElement>;
    modeButtons[1].click();
    fixture.detectChanges();
    const sizeButtons = fixture.nativeElement.querySelectorAll('.nes-size-bar > button') as NodeListOf<HTMLButtonElement>;
    Array.from(sizeButtons).find((button) => button.textContent?.trim() === '400')?.click();
    fixture.detectChanges();

    const iframe = fixture.nativeElement.querySelector('.nes-preview-frame') as HTMLIFrameElement;
    expect(component.previewWidth).toBe(400);
    expect(iframe).toBeTruthy();
    expect(iframe.style.width).toBe('400px');
  });

  it('should show the preview mode helper text only in Preview mode', () => {
    const helperText = 'Preview mode renders the exported HTML in an isolated iframe. Switch to Edit to change content.';

    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain(helperText);

    const modeButtons = fixture.nativeElement.querySelectorAll('.nes-mode-toggle button') as NodeListOf<HTMLButtonElement>;
    modeButtons[1].click();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(helperText);
  });

  it('should build preview iframe HTML without changing exported lastHtml or adding editor hooks', () => {
    (component as any).refreshOutputs(false);
    const exported = component.lastHtml;
    const built = component.previewIframeHtml;

    expect(built).toContain(exported);
    expect(component.lastHtml).toBe(exported);
    expect(component.lastHtml).not.toContain('data-nes-node-id');
    expect(built).not.toContain('data-nes-node-id');
  });

  it('should track iframe readiness from the frame load event', () => {
    component.iframeReady = false;
    expect(component.iframeReady).toBe(false);
    component.handlePreviewFrameLoad(new Event('load'));
    expect(component.iframeReady).toBe(true);
  });

  it('should keep iframe-edit srcdoc stable across selection changes to avoid reload lag', () => {
    component.setCanvasMode('iframe-edit');
    const first = component.currentIframeSrcdoc;
    const second = component.currentIframeSrcdoc;
    expect(second).toBe(first);

    component.selectNode(component.emailDocument.body[1].id);
    expect(component.currentIframeSrcdoc).toBe(first);
  });

  it('should use a GrapesJS-style parent drag ghost and post iframe hover/commit messages', () => {
    const { posts } = connectIframeForParentPosts();
    const item = component.palette.find((entry) => entry.type === 'text' && !entry.preset)!;

    component.beginIframePalettePointerDrag({ button: 0, clientX: 120, clientY: 70, preventDefault: () => undefined, stopPropagation: () => undefined } as MouseEvent, item);
    expect(component.iframePaletteDrag?.item).toBe(item);
    expect(component.dragGhostTransform).toContain('translate3d(132px, 82px, 0)');
    expect(posts.at(-1)).toEqual({ type: 'nes:palette-hover', paletteType: 'text', preset: undefined, x: 20, y: 20, bridgeToken: (component as any).iframeBridgeToken });

    component.handleWindowMouseMove({ clientX: 99, clientY: 49 } as MouseEvent);
    expect(posts.at(-1)).toEqual({ type: 'nes:palette-cancel', bridgeToken: (component as any).iframeBridgeToken });

    component.handleWindowMouseMove({ clientX: 220, clientY: 180 } as MouseEvent);
    component.handleWindowMouseUp({ clientX: 220, clientY: 180 } as MouseEvent);
    expect(posts.at(-1)).toEqual({ type: 'nes:palette-drop-commit', bridgeToken: (component as any).iframeBridgeToken });
    expect(component.iframePaletteDrag).toBeUndefined();
  });

  it('should include iframe insertion-line hover hooks for parent-controlled palette drops', () => {
    const html = component.editableIframeHtml;
    expect(html).toContain('nes-iframe-insertion-line');
    expect(html).toContain('nes:palette-hover');
    expect(html).toContain('nes:palette-drop-commit');
    expect(html).toContain('showPaletteHover');
    expect(html).toContain('commitPaletteHover');
  });

  it('should render legacy Angular canvas when iframe canvas is explicitly disabled', () => {
    fixture.componentRef.setInput('config', { iframeCanvas: false });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.nes-canvas')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.nes-editor-frame')).toBeFalsy();
  });

  it('should render an internal iframe-edit mode with node hooks', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.nes-editor-frame')).toBeTruthy();

    const localFixture = TestBed.createComponent(NgxEmailStudio);
    const localComponent = localFixture.componentInstance;
    localComponent.setCanvasMode('iframe-edit');
    localFixture.detectChanges();

    const iframe = localFixture.nativeElement.querySelector('.nes-editor-frame') as HTMLIFrameElement;
    expect(iframe).toBeTruthy();
    expect(localFixture.nativeElement.querySelector('.nes-canvas')).toBeFalsy();
    expect(iframe.getAttribute('sandbox')).toBe('allow-scripts');
    const html = localComponent.editableIframeHtml;
    expect(html).toContain('data-nes-node-id');
    expect(html).toContain('data-nes-node-type');
    expect(localComponent.lastHtml).not.toContain('data-nes-node-id');
  });

  it('should handle iframe selection messages and ignore unknown messages', () => {
    const source = connectIframeForMessages();
    const target = component.emailDocument.body[0].id;
    component.handleIframeMessage(bridgeMessage(component, source, { type: 'nes:select', nodeId: target }));
    expect(component.selectedNodeId).toBe(target);

    component.handleIframeMessage(bridgeMessage(component, source, { type: 'nes:unknown', nodeId: component.emailDocument.body[1].id }));
    expect(component.selectedNodeId).toBe(target);
  });

  it('should reject iframe messages outside iframe edit mode, from foreign sources, or without the bridge token', () => {
    const target = component.emailDocument.body[1].id;
    const original = component.selectedNodeId;

    component.handleIframeMessage({ source: {} as Window, data: { type: 'nes:select', nodeId: target, bridgeToken: (component as any).iframeBridgeToken } } as MessageEvent);
    expect(component.selectedNodeId).toBe(original);

    const source = connectIframeForMessages();
    component.handleIframeMessage({ source: {} as Window, data: { type: 'nes:select', nodeId: target, bridgeToken: (component as any).iframeBridgeToken } } as MessageEvent);
    expect(component.selectedNodeId).toBe(original);

    component.handleIframeMessage({ source, data: { type: 'nes:select', nodeId: target } } as MessageEvent);
    expect(component.selectedNodeId).toBe(original);
  });

  it('should include the selected iframe class for the selected node only', () => {
    const selected = component.emailDocument.body[0].id;
    const other = component.emailDocument.body[1].id;
    component.selectNode(selected);

    const html = component.editableIframeHtml;
    expect(html).toContain(`class="nes-iframe-selected" data-nes-node-id="${selected}"`);
    expect(html).toContain(`data-nes-node-id="${other}" data-nes-node-type`);
    expect(html).not.toContain(`class="nes-iframe-selected" data-nes-node-id="${other}"`);
  });

  it('should render duplicate/delete iframe icon tools and hide them in readonly mode', () => {
    component.selectNode(component.emailDocument.body[0].id);
    expect(component.editableIframeHtml).toContain('class="nes-iframe-tools"');
    expect(component.editableIframeHtml).toContain('data-nes-action="duplicate"');
    expect(component.editableIframeHtml).toContain('data-nes-action="delete"');
    expect(component.editableIframeHtml).toContain('fa-copy');
    expect(component.editableIframeHtml).toContain('fa-trash');
    expect(component.editableIframeHtml).not.toContain('>Duplicate<');
    expect(component.editableIframeHtml).not.toContain('>Delete<');

    const localFixture = TestBed.createComponent(NgxEmailStudio);
    localFixture.componentRef.setInput('readonly', true);
    const localComponent = localFixture.componentInstance;
    localComponent.selectNode(localComponent.emailDocument.body[0].id);
    expect(localComponent.editableIframeHtml).not.toContain('data-nes-action="duplicate"');
    expect(localComponent.editableIframeHtml).not.toContain('data-nes-action="delete"');
  });

  it('should apply duplicate and delete effects from iframe messages', () => {
    const source = connectIframeForMessages();
    const first = component.emailDocument.body[0].id;
    const beforeDuplicate = component.emailDocument.body.length;
    component.handleIframeMessage(bridgeMessage(component, source, { type: 'nes:duplicate', nodeId: first }));

    expect(component.emailDocument.body.length).toBe(beforeDuplicate + 1);
    expect(component.selectedNodeId).not.toBe(first);

    const duplicatedId = component.selectedNodeId!;
    component.handleIframeMessage(bridgeMessage(component, source, { type: 'nes:delete', nodeId: duplicatedId }));
    expect(component.emailDocument.body.length).toBe(beforeDuplicate);
    expect(component.emailDocument.body.some((node) => node.id === duplicatedId)).toBe(false);
  });

  it('should post outline scroll messages to the iframe in iframe-edit mode', async () => {
    const posts: unknown[] = [];
    (component as any).canvasIframe = { nativeElement: { contentWindow: { postMessage: (message: unknown) => posts.push(message) } } };
    component.setCanvasMode('iframe-edit');
    const target = component.emailDocument.body[1].id;

    component.selectNodeFromOutline(target);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(posts).toEqual([{ type: 'nes:scroll-to-node', nodeId: target, bridgeToken: (component as any).iframeBridgeToken }]);
    expect(component.selectedNodeId).toBe(target);
  });

  it('should include the iframe scroll-to-node bridge script in editable iframe HTML only', () => {
    expect(component.editableIframeHtml).toContain('nes:scroll-to-node');
    expect(component.previewIframeHtml).not.toContain('nes:scroll-to-node');
  });

  it('should use iframe edit canvas by default and allow legacy Angular canvas opt-out', () => {
    fixture.detectChanges();
    expect(component.effectiveConfig.iframeCanvas).toBe(true);
    expect(component.currentIframeSrcdoc).toBeTruthy();
    expect(component.currentIframeSrcdoc).not.toBe('');
    expect(fixture.nativeElement.querySelector('.nes-canvas')).toBeFalsy();
    expect(fixture.nativeElement.querySelector('.nes-editor-frame')).toBeTruthy();

    const localFixture = TestBed.createComponent(NgxEmailStudio);
    localFixture.componentRef.setInput('config', { iframeCanvas: false });
    localFixture.detectChanges();

    expect(localFixture.componentInstance.canvasMode).toBe('edit');
    expect(localFixture.componentInstance.effectiveConfig.iframeCanvas).toBe(false);
    expect(localFixture.nativeElement.querySelector('.nes-canvas')).toBeTruthy();
    expect(localFixture.nativeElement.querySelector('.nes-editor-frame')).toBeFalsy();
  });

  it('should apply same-parent iframe reorder messages and reject cross-parent reorder messages', () => {
    const source = connectIframeForMessages();
    const first = component.emailDocument.body[0].id;
    const second = component.emailDocument.body[1].id;
    component.handleIframeMessage(bridgeMessage(component, source, { type: 'nes:reorder', sourceId: first, targetId: second, position: 'after' }));

    expect(component.emailDocument.body.map((node) => node.id).slice(0, 2)).toEqual([second, first]);

    const sectionChild = component.emailDocument.body.find((node) => node.type === 'section')?.children?.[0]?.id;
    expect(sectionChild).toBeTruthy();
    const before = component.emailDocument.body.map((node) => node.id);
    component.handleIframeMessage(bridgeMessage(component, source, { type: 'nes:reorder', sourceId: sectionChild, targetId: component.emailDocument.body[0].id, position: 'before' }));

    expect(component.emailDocument.body.map((node) => node.id)).toEqual(before);
    expect((component as any).compileMjml(component.emailDocument)).toContain('<mj-body');
  });

  it('should bridge palette drops into iframe containers and reject invalid targets', () => {
    const source = connectIframeForMessages();
    const section = component.emailDocument.body.find((node) => node.type === 'section')!;
    const beforeSectionChildren = section.children?.length || 0;
    component.beginPaletteDrag({ dataTransfer: { setData: () => undefined, effectAllowed: '' } } as unknown as DragEvent, component.palette.find((item) => item.type === 'text' && !item.preset)!);
    component.handleIframeMessage(bridgeMessage(component, source, { type: 'nes:drop-palette', targetContainerId: section.id, index: beforeSectionChildren, paletteType: 'text' }));

    expect(section.children?.length).toBe(beforeSectionChildren + 1);
    expect(section.children?.[beforeSectionChildren].type).toBe('text');

    const beforeRoot = component.emailDocument.body.length;
    component.beginPaletteDrag({ dataTransfer: { setData: () => undefined, effectAllowed: '' } } as unknown as DragEvent, component.palette.find((item) => item.type === 'row')!);
    component.handleIframeMessage(bridgeMessage(component, source, { type: 'nes:drop-palette', targetContainerId: (component as any).bodyNodeId, index: beforeRoot, paletteType: 'row' }));

    expect(component.emailDocument.body.length).toBe(beforeRoot + 1);
    expect(component.emailDocument.body[beforeRoot].type).toBe('row');

    const invalidTarget = section.children?.find((node) => node.type === 'text')!.id;
    const beforeInvalid = section.children?.length;
    component.beginPaletteDrag({ dataTransfer: { setData: () => undefined, effectAllowed: '' } } as unknown as DragEvent, component.palette.find((item) => item.type === 'button')!);
    component.handleIframeMessage(bridgeMessage(component, source, { type: 'nes:drop-palette', targetContainerId: invalidTarget, index: 0, paletteType: 'button' }));
    expect(section.children?.length).toBe(beforeInvalid);
  });

  it('should reject iframe palette drop messages without an active matching palette drag', () => {
    const source = connectIframeForMessages();
    const section = component.emailDocument.body.find((node) => node.type === 'section')!;
    const before = section.children?.length || 0;

    component.handleIframeMessage(bridgeMessage(component, source, { type: 'nes:drop-palette', targetContainerId: section.id, index: before, paletteType: 'text' }));
    expect(section.children?.length || 0).toBe(before);
  });

  it('should include iframe reorder and palette drop bridge hooks only in editable iframe HTML', () => {
    const editable = component.editableIframeHtml;
    expect(editable).toContain('nes:reorder');
    expect(editable).toContain('nes:drop-palette');
    expect(editable).toContain('data-nes-drop-container-id');
    expect(component.previewIframeHtml).not.toContain('nes:drop-palette');
  });

  it('should strip executable user content from editable iframe while keeping bridge script', () => {
    const section = component.emailDocument.body[0];
    const child = section.children![0];
    component.updateAttr(child, 'content', '<p onclick="alert(1)" data-nes-action="evil-delete" data-nes-node-id="fake" data-nes-drop-container-id="fake-drop" data-nes-draggable="fake" draggable="true">Safe text</p><a href="java&#x73;cript:alert(5)" data-nes-action>Bad link</a><svg/onload=alert(6)><img src="javascript:alert(1)" onerror="alert(2)"><script>alert(3)</script><iframe srcdoc="<script>alert(4)</script>"></iframe>');

    const editable = component.editableIframeHtml;
    expect(editable).toContain('Safe text');
    expect(editable).toContain('Bad link');
    expect(editable).not.toContain('onclick=');
    expect(editable).not.toContain('onerror=');
    expect(editable).not.toContain('onload=');
    expect(editable).not.toContain('javascript:alert');
    expect(editable).not.toContain('java&#x73;cript');
    expect(editable).not.toContain('<svg');
    expect(editable).not.toContain('data-nes-action="evil-delete"');
    expect(editable).not.toContain('data-nes-node-id="fake"');
    expect(editable).not.toContain('data-nes-drop-container-id="fake-drop"');
    expect(editable).not.toContain('draggable="true">Safe text');
    expect(editable).not.toContain('<iframe');
    expect(editable).not.toContain('<script>alert(3)</script>');
    expect(editable).toContain('parent.postMessage');
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
    expect(localComponent.resolvedUseTinyMce).toBe(true);
    expect(localFixture.nativeElement.textContent).toContain('Custom Builder');
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
    const cards = fixture.nativeElement.querySelectorAll('.nes-block') as NodeListOf<HTMLElement>;

    expect(cards.length).toBeGreaterThan(1);
    expect(fixture.nativeElement.querySelector('.nes-block-description')).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('Drag modules into the canvas, sections, or columns');

    cards[0].click();
    fixture.detectChanges();

    expect(component.emailDocument.body.length).toBe(before);
  });

  it('should remove visible drop zones and use red insertion-line styling', () => {
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).not.toContain('Add content inside this column');
    expect(fixture.nativeElement.querySelector('.nes-add-grid')).toBeFalsy();
    expect(fixture.nativeElement.querySelector('.nes-add-column-block')).toBeFalsy();
    expect(fixture.nativeElement.querySelector('.nes-column-drop-zone')).toBeFalsy();
    expect(fixture.nativeElement.querySelector('.nes-section-drop-zone')).toBeFalsy();
    expect(fixture.nativeElement.querySelector('.nes-bottom-drop')).toBeFalsy();
    expect(fixture.nativeElement.textContent).not.toContain('Drag another module into this column');
    expect(fixture.nativeElement.textContent).not.toContain('Drag another module into this section');
    expect(fixture.nativeElement.textContent).not.toContain('Drop Content modules here');
    expect(fixture.nativeElement.textContent).not.toContain('Add text');
    expect((component as any).paletteDropListId).toBe('nes-palette-drop-list');
  });

  it('should make drag targets easier to enter without adding visible drop-zone boxes', () => {
    fixture.componentRef.setInput('config', { iframeCanvas: false });
    fixture.detectChanges();

    const hitPads = fixture.nativeElement.querySelectorAll('.nes-drop-hit-pad') as NodeListOf<HTMLElement>;
    const section = fixture.nativeElement.querySelector('.nes-render-section') as HTMLElement;
    const column = fixture.nativeElement.querySelector('.nes-render-column') as HTMLElement;
    const paletteCard = fixture.nativeElement.querySelector('.nes-block') as HTMLElement;

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
    expect(fixture.nativeElement.querySelector('.nes-section-drop-zone')).toBeFalsy();
    expect(component.connectedDropListIds).toContain(component.paletteDropListId);

    const paletteList = fixture.nativeElement.querySelector('.nes-block-list') as HTMLElement;
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
    fixture.componentRef.setInput('config', { iframeCanvas: false });
    const section = component.emailDocument.body.find((node) => node.type === 'section')!;
    const child = section.children?.[0]!;
    component.selectNode(child.id);
    fixture.detectChanges();

    const nestedNode = fixture.nativeElement.querySelector(`[data-node-id="${child.id}"]`) as HTMLElement;
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
    const mjml = (component as any).blockToMjml(nestedSection) as string;

    expect(mjml).toContain('Nested content');
    expect(mjml).not.toContain('Section container');
  });

  it('should keep duplicate and delete disabled in readonly mode', () => {
    const localFixture = TestBed.createComponent(NgxEmailStudio);
    const localComponent = localFixture.componentInstance;
    const originalLength = localComponent.emailDocument.body.length;
    const selected = localComponent.emailDocument.body[0].id;
    localFixture.componentRef.setInput('readonly', true);
    localComponent.selectNode(selected);

    localComponent.duplicateSelected();
    localComponent.deleteSelected();
    localFixture.detectChanges();

    expect(localComponent.emailDocument.body.length).toBe(originalLength);
    expect(localComponent.emailDocument.body[0].id).toBe(selected);
    expect(localFixture.nativeElement.querySelector('.nes-floating-tools')).toBeFalsy();
  });

  it('should render the left panel as Content modules and Outline tabs with a nested tree view', () => {
    fixture.detectChanges();

    const tabs = fixture.nativeElement.querySelectorAll('.nes-left-tabs button') as NodeListOf<HTMLButtonElement>;
    expect(tabs.length).toBe(2);
    expect(fixture.nativeElement.textContent).toContain('Content modules');
    expect(fixture.nativeElement.querySelector('.nes-block-list')).toBeTruthy();

    tabs[1].click();
    fixture.detectChanges();

    const outlineNodes = fixture.nativeElement.querySelectorAll('.nes-outline-node') as NodeListOf<HTMLButtonElement>;
    expect(fixture.nativeElement.querySelector('.nes-outline-tree')).toBeTruthy();
    expect(outlineNodes.length).toBe(component.totalOutlineNodes);
    expect(outlineNodes.length).toBeGreaterThan(component.emailDocument.body.length);
    expect(fixture.nativeElement.textContent).toContain('Tree view of sections, rows, columns and nested blocks');
    expect(fixture.nativeElement.textContent).toContain('02.1');

    outlineNodes[1].click();
    expect(component.selectedNodeId).toBeTruthy();
  });


  it('should label sections simply and scroll the stage when an outline item is clicked', async () => {
    fixture.componentRef.setInput('config', { iframeCanvas: false });
    fixture.detectChanges();
    const tabs = fixture.nativeElement.querySelectorAll('.nes-left-tabs button') as NodeListOf<HTMLButtonElement>;
    tabs[1].click();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Section');
    expect(fixture.nativeElement.textContent).not.toContain('Hero / Section');

    const stage = fixture.nativeElement.querySelector('.nes-stage') as HTMLElement;
    const calls: ScrollToOptions[] = [];
    stage.scrollTo = (options?: ScrollToOptions | number, y?: number) => {
      calls.push(typeof options === 'number' ? { top: y } : options || {});
    };

    const outlineNodes = fixture.nativeElement.querySelectorAll('.nes-outline-node') as NodeListOf<HTMLButtonElement>;
    outlineNodes[1].click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(calls.length).toBeGreaterThan(0);
    expect(calls[0].behavior).toBe('smooth');
  });


  it('should scope outline scrolling to the clicked component instance', async () => {
    const firstFixture = TestBed.createComponent(NgxEmailStudio);
    const secondFixture = TestBed.createComponent(NgxEmailStudio);
    firstFixture.componentRef.setInput('config', { iframeCanvas: false });
    secondFixture.componentRef.setInput('config', { iframeCanvas: false });
    firstFixture.detectChanges();
    secondFixture.detectChanges();

    const firstStage = firstFixture.nativeElement.querySelector('.nes-stage') as HTMLElement;
    const secondStage = secondFixture.nativeElement.querySelector('.nes-stage') as HTMLElement;
    const firstCalls: ScrollToOptions[] = [];
    const secondCalls: ScrollToOptions[] = [];
    firstStage.scrollTo = (options?: ScrollToOptions | number, y?: number) => firstCalls.push(typeof options === 'number' ? { top: y } : options || {});
    secondStage.scrollTo = (options?: ScrollToOptions | number, y?: number) => secondCalls.push(typeof options === 'number' ? { top: y } : options || {});

    const secondTabs = secondFixture.nativeElement.querySelectorAll('.nes-left-tabs button') as NodeListOf<HTMLButtonElement>;
    secondTabs[1].click();
    secondFixture.detectChanges();
    const secondOutlineNodes = secondFixture.nativeElement.querySelectorAll('.nes-outline-node') as NodeListOf<HTMLButtonElement>;
    secondOutlineNodes[1].click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(firstCalls.length).toBe(0);
    expect(secondCalls.length).toBeGreaterThan(0);
  });

  it('should support same-parent outline reorder with drag handles while keeping row click selection', () => {
    fixture.detectChanges();
    const tabs = fixture.nativeElement.querySelectorAll('.nes-left-tabs button') as NodeListOf<HTMLButtonElement>;
    tabs[1].click();
    fixture.detectChanges();

    const first = component.emailDocument.body[0];
    const second = component.emailDocument.body[1];
    const outlineHandles = fixture.nativeElement.querySelectorAll('.nes-outline-handle') as NodeListOf<HTMLElement>;
    const outlineDropLists = fixture.nativeElement.querySelectorAll('.nes-outline-drop-list') as NodeListOf<HTMLElement>;

    expect(outlineHandles.length).toBeGreaterThan(0);
    expect(outlineDropLists[0].id).toBe(component.outlineRootDropListId);

    outlineHandles[0].click();
    expect(component.selectedNodeId).not.toBe(first.id);

    const outlineNodes = fixture.nativeElement.querySelectorAll('.nes-outline-node') as NodeListOf<HTMLButtonElement>;
    outlineNodes[1].click();
    expect(component.selectedNodeId).toBe(first.id);

    component.beginOutlineDrag({ dataTransfer: { setData: () => undefined } } as any, first.id);
    component.previewOutlineDrop({
      preventDefault: () => undefined,
      dataTransfer: { getData: () => first.id },
      currentTarget: { getBoundingClientRect: () => ({ top: 0, height: 40 }) },
      clientY: 32,
    } as any, second.id);
    component.dropOutlineOn({
      preventDefault: () => undefined,
      dataTransfer: { getData: () => first.id },
    } as any, second.id);

    expect(component.emailDocument.body[0].id).toBe(second.id);
    expect(component.emailDocument.body[1].id).toBe(first.id);
    expect(component.selectedNodeId).toBe(first.id);
    expect(component.lastMjml).toContain('<mjml>');
  });

  it('should keep outline drag phase 1 limited to same-parent reordering', () => {
    const section = component.emailDocument.body.find((node) => node.type === 'section')!;
    const sectionChildren = section.children!;
    sectionChildren.push((component as any).createNode('divider'));
    const beforeRootIds = component.emailDocument.body.map((node) => node.id);
    const beforeChildIds = sectionChildren.map((node) => node.id);

    component.beginOutlineDrag({ dataTransfer: { setData: () => undefined } } as any, beforeChildIds[0]);
    component.dropOutlineOn({
      preventDefault: () => undefined,
      dataTransfer: { getData: () => beforeChildIds[0] },
    } as any, component.emailDocument.body[1].id);

    expect(component.emailDocument.body.map((node) => node.id)).toEqual(beforeRootIds);
    expect(section.children!.map((node) => node.id)).toEqual(beforeChildIds);

    component.beginOutlineDrag({ dataTransfer: { setData: () => undefined } } as any, beforeChildIds[0]);
    component.previewOutlineDrop({
      preventDefault: () => undefined,
      dataTransfer: { getData: () => beforeChildIds[0] },
      currentTarget: { getBoundingClientRect: () => ({ top: 0, height: 40 }) },
      clientY: 32,
    } as any, beforeChildIds[1]);
    component.dropOutlineOn({
      preventDefault: () => undefined,
      dataTransfer: { getData: () => beforeChildIds[0] },
    } as any, beforeChildIds[1]);

    expect(section.children![0].id).toBe(beforeChildIds[1]);
    expect(section.children![1].id).toBe(beforeChildIds[0]);
    expect(component.selectedNodeId).toBe(beforeChildIds[0]);
  });

  it('should keep TinyMCE skin loading enabled so the editor becomes visible after init', () => {
    expect(component.tinyMceInit['skin']).toBe('oxide');
    expect(component.tinyMceInit['content_css']).toBe('default');
    expect(component.tinyMceInit['base_url']).toBeTruthy();
    expect(component.largeTinyMceInit['height']).toBe(620);
  });

  it('should simplify the header and use a Font Awesome logo icon', () => {
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Email Studio');
    expect(fixture.nativeElement.textContent).not.toContain('Membership Email');
    expect(fixture.nativeElement.querySelector('.nes-breadcrumb')).toBeFalsy();
    expect(fixture.nativeElement.querySelector('.nes-save-state')).toBeFalsy();
    expect(fixture.nativeElement.querySelector('.nes-logo .fa-envelope-open-o')).toBeTruthy();
  });

  it('should open a large rich text editor modal from the inspector', () => {
    const textNode = component.emailDocument.body[0].children?.[0];
    expect(textNode?.type).toBe('text');

    component.openRichTextModal(textNode!);

    expect(component.expandedRichTextNode?.id).toBe(textNode!.id);
    component.updateExpandedRichText('<p>Updated from large editor</p>');
    expect(textNode!.attrs['content']).toContain('Updated from large editor');
  });

  it('should open export dropdown and show MJML output in a modal instead of bottom output panels', () => {
    fixture.detectChanges();

    const exportButton = fixture.nativeElement.querySelector('.nes-export > button') as HTMLButtonElement;
    exportButton.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.nes-export-menu')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.nes-output')).toBeFalsy();

    const menuItem = fixture.nativeElement.querySelector('.nes-export-menu button') as HTMLButtonElement;
    menuItem.click();
    fixture.detectChanges();

    expect(component.outputModalType).toBe('mjml');
    expect(fixture.nativeElement.querySelector('.nes-output-modal')).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('MJML Output');
    expect(fixture.nativeElement.querySelector('.nes-output-modal pre').textContent).toContain('<mjml>');
  });

  it('should show formatted HTML output when selected from the export menu', () => {
    fixture.detectChanges();

    const exportButton = fixture.nativeElement.querySelector('.nes-export > button') as HTMLButtonElement;
    exportButton.click();
    fixture.detectChanges();

    const menuItems = fixture.nativeElement.querySelectorAll('.nes-export-menu button') as NodeListOf<HTMLButtonElement>;
    menuItems[1].click();
    fixture.detectChanges();

    const output = fixture.nativeElement.querySelector('.nes-output-modal pre').textContent;
    expect(component.outputModalType).toBe('html');
    expect(component.outputModalTitle).toBe('HTML Output');
    expect(fixture.nativeElement.querySelector('.nes-preview-btn')).toBeTruthy();
    expect(output).toContain('<!doctype html>\n<html>');
    expect(output).toContain('  <head>');
    expect(output).toContain('          <table role="presentation"');
  });

  it('should open the HTML export in a new preview window', () => {
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

    component.openOutputModal('html');
    component.previewHtmlOutput();

    expect(writes[0]).toContain('<!doctype html>\n<html>');
    expect(writes[0]).toContain('<body style="margin:0;background:#f3f4f6;">');
    expect(previewWindow.opener).toBeNull();

    Object.defineProperty(window, 'open', { configurable: true, value: originalOpen });
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

    const importButton = fixture.nativeElement.querySelector('.nes-import-trigger') as HTMLButtonElement;
    importButton.click();
    fixture.detectChanges();

    expect(component.importModalOpen).toBe(true);
    expect(fixture.nativeElement.querySelector('.nes-import-modal')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.nes-import')).toBeFalsy();

    component.mjmlDraft = '<mjml><mj-body><mj-section><mj-column><mj-text>Hello import</mj-text></mj-column></mj-section></mj-body></mjml>';
    component.importMjml();

    expect(component.importModalOpen).toBe(false);
    expect(component.emailDocument.body[0].type).toBe('section');
    expect(component.emailDocument.body[0].children?.[0].type).toBe('text');
    expect(component.emailDocument.body[0].children?.[0].attrs['content']).toContain('Hello import');
  });
});
