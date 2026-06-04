import { TestBed } from '@angular/core/testing';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render title', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('ngx-email-studio');
  });

  it('should rely on the library default iframe edit canvas mode', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;

    expect(app.studioConfig.iframeCanvas).toBeUndefined();
  });

  it('should seed the demo document with 100% width and 600px max-width defaults', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;

    expect(app.initialDocument.attrs?.['width']).toBe(100);
    expect(app.initialDocument.attrs?.['widthUnit']).toBe('%');
    expect(app.initialDocument.attrs?.['maxWidth']).toBe(600);
    expect(app.initialDocument.attrs?.['maxWidthUnit']).toBe('px');
    for (const section of app.initialDocument.body.filter((node) => node.type === 'section')) {
      expect(section.attrs['width']).toBe(100);
      expect(section.attrs['widthUnit']).toBe('%');
      expect(section.attrs['maxWidth']).toBe(600);
      expect(section.attrs['maxWidthUnit']).toBe('px');
    }
    const columns = app.initialDocument.body.flatMap((node) => node.children || []).filter((node) => node.type === 'column');
    for (const column of columns) {
      expect(column.attrs['widthUnit']).toBe('%');
      expect(column.attrs['maxWidth']).toBe(600);
      expect(column.attrs['maxWidthUnit']).toBe('px');
    }
  });
});
