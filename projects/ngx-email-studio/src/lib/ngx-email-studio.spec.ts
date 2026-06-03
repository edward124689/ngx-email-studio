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

  it('should compile a row with multiple columns to MJML columns', () => {
    const document: EmailDocument = {
      version: '0.0.1',
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
    expect(mjml).toContain('<mj-section background-color="#ffffff"><mj-column><mj-text><p>Inside section</p></mj-text></mj-column></mj-section>');
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

  it('should create distinct click-to-add nodes for hero and footer palette presets', () => {
    const hero = component.palette.find((item) => item.preset === 'hero');
    const footer = component.palette.find((item) => item.preset === 'footer');

    expect(hero).toBeTruthy();
    expect(footer).toBeTruthy();

    component.clearDocument();
    component.addBlock(hero!);
    component.addBlock(footer!);

    expect(component.emailDocument.body.length).toBe(2);
    expect(component.emailDocument.body[0].type).toBe('text');
    expect(component.emailDocument.body[0].attrs['content']).toContain('今週精選內容');
    expect(component.emailDocument.body[1].type).toBe('text');
    expect(component.emailDocument.body[1].attrs['content']).toContain('取消訂閱');
  });

  it('should keep TinyMCE skin loading enabled so the editor becomes visible after init', () => {
    expect(component.tinyMceInit['skin']).toBe('oxide');
    expect(component.tinyMceInit['content_css']).toBe('default');
    expect(component.tinyMceInit['base_url']).toBeTruthy();
  });
});
