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

  it('should seed the demo document with 600px width and 100% max-width', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;

    expect(app.initialDocument.attrs?.['width']).toBe(600);
    expect(app.initialDocument.attrs?.['widthUnit']).toBe('px');
    expect(app.initialDocument.attrs?.['maxWidth']).toBe(100);
    expect(app.initialDocument.attrs?.['maxWidthUnit']).toBe('%');
  });
});
