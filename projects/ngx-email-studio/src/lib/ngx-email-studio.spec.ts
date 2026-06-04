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

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should compile body width/background and row columns to MJML columns', () => {
    const document: EmailDocument = {
      version: '0.0.1',
      attrs: { backgroundColor: '#eef2ff', contentBackgroundColor: '#ffffff', width: 720 },
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
    component.updateDocumentAttr('maxWidth', 720);
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
    expect(fixture.nativeElement.textContent).toContain('Drag modules into the canvas or into a column drop zone');

    cards[0].click();
    fixture.detectChanges();

    expect(component.emailDocument.body.length).toBe(before);
  });

  it('should expose canvas column drop zones instead of inspector add-content buttons', () => {
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).not.toContain('Add content inside this column');
    expect(fixture.nativeElement.querySelector('.nes-add-grid')).toBeFalsy();
    expect(fixture.nativeElement.querySelector('.nes-add-column-block')).toBeFalsy();
    expect(fixture.nativeElement.querySelectorAll('.nes-column-drop-zone').length).toBeGreaterThan(0);
    expect(fixture.nativeElement.textContent).toContain('Drag another module into this column');
    expect(fixture.nativeElement.textContent).not.toContain('Add text');
  });


  it('should keep the 600 preview contained while preserving exported email width', () => {
    component.setPreviewSize(600);
    component.updateDocumentAttr('width', 640);
    component.updateDocumentAttr('widthUnit', 'px');

    expect(component.previewWidth).toBe(600);
    expect(component.emailWidthCss).toBe('640px');
    expect(component.emailCanvasWidthCss).toBe('min(100%, 640px)');
    expect(component.emailCanvasMaxWidthCss).toBe('min(100%, 640px)');
    expect(component.lastHtml).toContain('width="640"');
  });

  it('should allow multiple content modules in a section and expose a section drop zone', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.nes-section-drop-zone')).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('Drag another module into this section');

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
