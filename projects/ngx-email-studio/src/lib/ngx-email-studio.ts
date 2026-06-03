import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { EditorModule } from '@tinymce/tinymce-angular';

export type EmailBlockType = 'section' | 'text' | 'image' | 'button' | 'divider' | 'spacer';
export type EmailPreviewSize = 'desktop' | 'tablet' | 'mobile' | number;

export interface EmailStudioConfig {
  useTinyMce?: boolean;
  showHtmlPreview?: boolean;
}

export interface EmailStudioError {
  code: string;
  message: string;
  details?: unknown;
}

export interface EmailNode {
  id: string;
  type: EmailBlockType;
  attrs: Record<string, string | number | boolean>;
  children?: EmailNode[];
}

export interface EmailDocument {
  version: string;
  body: EmailNode[];
  unsupported?: string[];
}

interface PaletteItem {
  type: EmailBlockType;
  label: string;
  icon: string;
  description: string;
}

@Component({
  selector: 'ngx-email-studio',
  standalone: true,
  imports: [CommonModule, FormsModule, DragDropModule, EditorModule],
  template: `
    <section class="nes-shell">
      <header class="nes-toolbar">
        <div>
          <p class="nes-kicker">ngx-email-studio</p>
          <h2>Email Builder</h2>
        </div>
        <div class="nes-actions">
          <label class="nes-import">
            <i class="fa fa-upload" aria-hidden="true"></i>
            Import MJML
            <textarea [ngModel]="mjmlDraft" (ngModelChange)="mjmlDraft = $event" placeholder="Paste MJML here"></textarea>
            <button type="button" (click)="importMjml()">Apply</button>
          </label>
          <button type="button" (click)="copyMjml()"><i class="fa fa-code" aria-hidden="true"></i> Export MJML</button>
          <button type="button" (click)="exportHtml()"><i class="fa fa-file-code-o" aria-hidden="true"></i> Export HTML</button>
          <select [ngModel]="previewSize" (ngModelChange)="setPreviewSize($event)" aria-label="Preview size">
            <option value="desktop">Desktop</option>
            <option value="tablet">Tablet</option>
            <option value="mobile">Mobile</option>
          </select>
        </div>
      </header>

      <main class="nes-builder">
        <aside class="nes-panel nes-palette">
          <h3>Blocks</h3>
          <div
            cdkDropList
            #paletteList="cdkDropList"
            [cdkDropListData]="palette"
            [cdkDropListConnectedTo]="[canvasList]"
            class="nes-block-list"
          >
            <article class="nes-block" *ngFor="let item of palette" cdkDrag [cdkDragData]="item">
              <i class="fa" [class]="'fa ' + item.icon" aria-hidden="true"></i>
              <span>
                <strong>{{ item.label }}</strong>
                <small>{{ item.description }}</small>
              </span>
            </article>
          </div>
        </aside>

        <section class="nes-stage">
          <div class="nes-preview-meta">
            <span>{{ previewLabel }}</span>
            <span>{{ previewWidth }}px</span>
          </div>
          <div class="nes-device" [style.width.px]="previewWidth">
            <div
              cdkDropList
              #canvasList="cdkDropList"
              [cdkDropListData]="emailDocument.body"
              [cdkDropListConnectedTo]="[paletteList]"
              (cdkDropListDropped)="drop($event)"
              class="nes-canvas"
            >
              <button
                type="button"
                class="nes-node"
                [class.is-selected]="node.id === selectedNodeId"
                *ngFor="let node of emailDocument.body; trackBy: trackNode"
                cdkDrag
                [cdkDragData]="node"
                (click)="selectNode(node.id)"
              >
                <ng-container [ngSwitch]="node.type">
                  <section *ngSwitchCase="'section'" class="nes-render-section">Section container</section>
                  <div *ngSwitchCase="'text'" class="nes-render-text" [innerHTML]="node.attrs['content']"></div>
                  <img *ngSwitchCase="'image'" class="nes-render-image" [src]="node.attrs['src']" [alt]="node.attrs['alt'] || ''" />
                  <a *ngSwitchCase="'button'" class="nes-render-button">{{ node.attrs['label'] }}</a>
                  <hr *ngSwitchCase="'divider'" class="nes-render-divider" />
                  <div *ngSwitchCase="'spacer'" [style.height.px]="node.attrs['height'] || 24"></div>
                </ng-container>
              </button>
              <div class="nes-empty" *ngIf="emailDocument.body.length === 0">
                <i class="fa fa-magic" aria-hidden="true"></i>
                Drag blocks here to start building your email.
              </div>
            </div>
          </div>
        </section>

        <aside class="nes-panel nes-properties">
          <h3>Properties</h3>
          <ng-container *ngIf="selectedNode as node; else noSelection">
            <div class="nes-property-head">
              <strong>{{ node.type | titlecase }}</strong>
              <div>
                <button type="button" (click)="duplicateSelected()"><i class="fa fa-clone"></i></button>
                <button type="button" class="danger" (click)="deleteSelected()"><i class="fa fa-trash"></i></button>
              </div>
            </div>

            <label *ngIf="node.type === 'text'">
              Rich text
              <editor
                *ngIf="resolvedUseTinyMce; else plainTextEditor"
                [ngModel]="node.attrs['content']"
                (ngModelChange)="updateAttr(node, 'content', $event)"
                [init]="tinyMceInit"
              />
              <ng-template #plainTextEditor>
                <textarea [ngModel]="node.attrs['content']" (ngModelChange)="updateAttr(node, 'content', $event)"></textarea>
              </ng-template>
            </label>

            <label *ngIf="node.type === 'image'">
              Image URL
              <input [ngModel]="node.attrs['src']" (ngModelChange)="updateAttr(node, 'src', $event)" />
            </label>
            <label *ngIf="node.type === 'image'">
              Alt text
              <input [ngModel]="node.attrs['alt']" (ngModelChange)="updateAttr(node, 'alt', $event)" />
            </label>

            <label *ngIf="node.type === 'button'">
              Label
              <input [ngModel]="node.attrs['label']" (ngModelChange)="updateAttr(node, 'label', $event)" />
            </label>
            <label *ngIf="node.type === 'button'">
              URL
              <input [ngModel]="node.attrs['href']" (ngModelChange)="updateAttr(node, 'href', $event)" />
            </label>

            <label *ngIf="node.type === 'spacer'">
              Height
              <input type="number" [ngModel]="node.attrs['height']" (ngModelChange)="updateAttr(node, 'height', +$event)" />
            </label>

            <label>
              Background color
              <input [ngModel]="node.attrs['backgroundColor']" (ngModelChange)="updateAttr(node, 'backgroundColor', $event)" placeholder="#ffffff" />
            </label>
          </ng-container>
          <ng-template #noSelection>
            <p class="nes-muted">Select a block to edit its properties.</p>
          </ng-template>
        </aside>
      </main>

      <footer class="nes-output" *ngIf="lastMjml || lastHtml || emailDocument.unsupported?.length">
        <div *ngIf="emailDocument.unsupported?.length" class="nes-warning">
          Unsupported MJML preserved as warning: {{ emailDocument.unsupported?.join(', ') }}
        </div>
        <details *ngIf="lastMjml" open>
          <summary>MJML Output</summary>
          <pre>{{ lastMjml }}</pre>
        </details>
        <details *ngIf="lastHtml">
          <summary>HTML Output</summary>
          <pre>{{ lastHtml }}</pre>
        </details>
      </footer>
    </section>
  `,
  styles: `
    :host { display: block; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #172033; }
    .nes-shell { border: 1px solid #dce3ef; border-radius: 20px; background: #f6f8fb; overflow: hidden; min-height: 720px; }
    .nes-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 18px 22px; background: #fff; border-bottom: 1px solid #dce3ef; }
    .nes-kicker { margin: 0 0 2px; text-transform: uppercase; letter-spacing: .12em; font-size: 11px; color: #667085; }
    h2, h3 { margin: 0; }
    h2 { font-size: 22px; }
    h3 { font-size: 14px; color: #344054; }
    .nes-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
    button, select { border: 1px solid #cfd8e6; background: #fff; color: #172033; border-radius: 10px; padding: 9px 12px; font: inherit; cursor: pointer; }
    button:hover, select:hover { border-color: #7c3aed; }
    .nes-actions button:nth-of-type(2) { background: #7c3aed; color: #fff; border-color: #7c3aed; }
    .nes-import { position: relative; display: flex; align-items: center; gap: 6px; border: 1px dashed #cfd8e6; border-radius: 10px; padding: 8px 10px; background: #fbfcff; cursor: pointer; }
    .nes-import textarea { position: absolute; top: 42px; right: 0; width: 300px; height: 120px; z-index: 5; opacity: 0; pointer-events: none; }
    .nes-import:focus-within textarea, .nes-import:hover textarea { opacity: 1; pointer-events: auto; }
    .nes-import button { padding: 4px 8px; }
    .nes-builder { display: grid; grid-template-columns: 260px minmax(360px, 1fr) 320px; min-height: 600px; }
    .nes-panel { background: #fff; padding: 18px; border-right: 1px solid #dce3ef; }
    .nes-properties { border-right: 0; border-left: 1px solid #dce3ef; }
    .nes-block-list { display: grid; gap: 10px; margin-top: 16px; }
    .nes-block { display: flex; align-items: center; gap: 12px; border: 1px solid #e1e7f0; border-radius: 14px; padding: 12px; background: #fff; box-shadow: 0 1px 2px rgba(16, 24, 40, .04); cursor: grab; }
    .nes-block i { width: 24px; color: #7c3aed; text-align: center; }
    .nes-block strong, .nes-block small { display: block; }
    .nes-block small { color: #667085; margin-top: 2px; }
    .nes-stage { overflow: auto; padding: 24px; background: linear-gradient(135deg, #eef2ff, #f8fafc); }
    .nes-preview-meta { display: flex; justify-content: center; gap: 12px; color: #667085; font-size: 12px; margin-bottom: 12px; }
    .nes-device { max-width: 100%; margin: 0 auto; transition: width .2s ease; }
    .nes-canvas { min-height: 520px; background: #fff; border-radius: 18px; padding: 22px; box-shadow: 0 24px 70px rgba(28, 37, 65, .16); outline: 1px solid #e5e7eb; }
    .nes-node { display: block; width: 100%; text-align: initial; border: 1px dashed transparent; border-radius: 12px; padding: 8px; margin-bottom: 10px; background: transparent; }
    .nes-node.is-selected { border-color: #7c3aed; box-shadow: 0 0 0 3px rgba(124, 58, 237, .12); }
    .nes-render-section { padding: 18px; background: #f8fafc; border-radius: 12px; color: #667085; text-align: center; }
    .nes-render-text { line-height: 1.55; color: #1f2937; }
    .nes-render-image { display: block; width: 100%; max-height: 220px; object-fit: cover; border-radius: 12px; background: #eef2ff; }
    .nes-render-button { display: inline-block; background: #7c3aed; color: white; padding: 12px 18px; border-radius: 999px; text-decoration: none; font-weight: 700; }
    .nes-render-divider { border: 0; border-top: 1px solid #d0d5dd; }
    .nes-empty { min-height: 440px; display: grid; place-items: center; color: #667085; border: 2px dashed #d0d5dd; border-radius: 16px; text-align: center; }
    .nes-property-head { display: flex; justify-content: space-between; align-items: center; margin: 14px 0; }
    .nes-property-head button { padding: 7px 9px; }
    .danger { color: #b42318; }
    label { display: grid; gap: 7px; margin: 14px 0; font-size: 13px; color: #475467; }
    input, textarea { width: 100%; box-sizing: border-box; border: 1px solid #cfd8e6; border-radius: 10px; padding: 10px 12px; font: inherit; }
    textarea { min-height: 120px; }
    .nes-muted { color: #667085; }
    .nes-output { border-top: 1px solid #dce3ef; background: #101828; color: #e5e7eb; padding: 18px; }
    .nes-output pre { white-space: pre-wrap; overflow: auto; max-height: 260px; background: #0b1220; padding: 12px; border-radius: 10px; }
    .nes-warning { background: #fff7ed; color: #9a3412; padding: 10px 12px; border-radius: 10px; margin-bottom: 12px; }
    .cdk-drag-preview { box-sizing: border-box; border-radius: 14px; box-shadow: 0 8px 24px rgba(16, 24, 40, .18); }
    .cdk-drag-placeholder { opacity: .35; }
    @media (max-width: 1100px) { .nes-builder { grid-template-columns: 1fr; } .nes-properties { border-left: 0; border-top: 1px solid #dce3ef; } .nes-panel { border-right: 0; border-bottom: 1px solid #dce3ef; } }
  `,
})
export class NgxEmailStudio implements OnChanges {
  @Input() mjml?: string;
  @Input() document?: EmailDocument;
  @Input() previewSize: EmailPreviewSize = 'desktop';
  @Input() readonly = false;
  @Input() config: EmailStudioConfig = { useTinyMce: true, showHtmlPreview: true };

  @Output() mjmlChange = new EventEmitter<string>();
  @Output() documentChange = new EventEmitter<EmailDocument>();
  @Output() htmlExport = new EventEmitter<string>();
  @Output() error = new EventEmitter<EmailStudioError>();

  palette: PaletteItem[] = [
    { type: 'section', label: 'Section', icon: 'fa-columns', description: 'MJML section shell' },
    { type: 'text', label: 'Text', icon: 'fa-font', description: 'Rich text content' },
    { type: 'image', label: 'Image', icon: 'fa-picture-o', description: 'Responsive image' },
    { type: 'button', label: 'Button', icon: 'fa-hand-pointer-o', description: 'CTA button' },
    { type: 'divider', label: 'Divider', icon: 'fa-minus', description: 'Horizontal rule' },
    { type: 'spacer', label: 'Spacer', icon: 'fa-arrows-v', description: 'Vertical space' },
  ];

  emailDocument: EmailDocument = this.createStarterDocument();
  selectedNodeId?: string;
  mjmlDraft = '';
  lastMjml = '';
  lastHtml = '';

  tinyMceInit = {
    base_url: '/tinymce',
    suffix: '.min',
    license_key: 'gpl',
    menubar: false,
    branding: false,
    height: 240,
    plugins: 'link lists',
    toolbar: 'bold italic underline | forecolor backcolor | alignleft aligncenter alignright | bullist numlist | link | removeformat',
  };

  get selectedNode(): EmailNode | undefined {
    return this.emailDocument.body.find((node) => node.id === this.selectedNodeId);
  }

  get resolvedUseTinyMce(): boolean {
    return this.config?.useTinyMce !== false;
  }

  get previewWidth(): number {
    if (typeof this.previewSize === 'number') return this.previewSize;
    return { desktop: 900, tablet: 768, mobile: 375 }[this.previewSize] ?? 900;
  }

  get previewLabel(): string {
    return typeof this.previewSize === 'number' ? 'Custom' : this.previewSize[0].toUpperCase() + this.previewSize.slice(1);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['document'] && this.document) {
      this.emailDocument = structuredClone(this.document);
      this.selectedNodeId = this.emailDocument.body[0]?.id;
      this.refreshOutputs(false);
    }

    if (changes['mjml'] && this.mjml) {
      this.mjmlDraft = this.mjml;
      this.emailDocument = this.parseMjml(this.mjml);
      this.selectedNodeId = this.emailDocument.body[0]?.id;
      this.refreshOutputs(false);
    }
  }

  drop(event: CdkDragDrop<EmailNode[], EmailNode[] | PaletteItem[]>): void {
    if (this.readonly) return;
    if (event.previousContainer === event.container) {
      moveItemInArray(this.emailDocument.body, event.previousIndex, event.currentIndex);
      this.emitDocument();
      return;
    }

    const paletteItem = event.item.data as PaletteItem;
    const node = this.createNode(paletteItem.type);
    this.emailDocument.body.splice(event.currentIndex, 0, node);
    this.selectedNodeId = node.id;
    this.emitDocument();
  }

  trackNode(_: number, node: EmailNode): string {
    return node.id;
  }

  selectNode(id: string): void {
    this.selectedNodeId = id;
  }

  setPreviewSize(size: EmailPreviewSize): void {
    this.previewSize = size;
  }

  updateAttr(node: EmailNode, key: string, value: string | number | boolean): void {
    node.attrs = { ...node.attrs, [key]: value };
    this.emitDocument();
  }

  duplicateSelected(): void {
    if (!this.selectedNode) return;
    const clone = structuredClone(this.selectedNode);
    clone.id = this.nextId(clone.type);
    const index = this.emailDocument.body.findIndex((node) => node.id === this.selectedNodeId);
    this.emailDocument.body.splice(index + 1, 0, clone);
    this.selectedNodeId = clone.id;
    this.emitDocument();
  }

  deleteSelected(): void {
    if (!this.selectedNodeId) return;
    this.emailDocument.body = this.emailDocument.body.filter((node) => node.id !== this.selectedNodeId);
    this.selectedNodeId = this.emailDocument.body[0]?.id;
    this.emitDocument();
  }

  importMjml(): void {
    try {
      this.emailDocument = this.parseMjml(this.mjmlDraft);
      this.selectedNodeId = this.emailDocument.body[0]?.id;
      this.emitDocument();
    } catch (details) {
      this.error.emit({ code: 'mjml_import_failed', message: 'Unable to import MJML.', details });
    }
  }

  copyMjml(): void {
    this.lastMjml = this.compileMjml(this.emailDocument);
    this.mjmlChange.emit(this.lastMjml);
  }

  exportHtml(): void {
    this.lastMjml = this.compileMjml(this.emailDocument);
    this.lastHtml = this.renderHtml(this.emailDocument);
    this.htmlExport.emit(this.lastHtml);
  }

  private emitDocument(): void {
    this.emailDocument = { ...this.emailDocument, body: [...this.emailDocument.body] };
    this.refreshOutputs(true);
  }

  private refreshOutputs(emit: boolean): void {
    this.lastMjml = this.compileMjml(this.emailDocument);
    if (this.config?.showHtmlPreview) this.lastHtml = this.renderHtml(this.emailDocument);
    if (emit) {
      this.documentChange.emit(this.emailDocument);
      this.mjmlChange.emit(this.lastMjml);
    }
  }

  private createStarterDocument(): EmailDocument {
    return {
      version: '0.0.1',
      body: [
        this.createNode('text', { content: '<h1>Welcome to ngx-email-studio</h1><p>Drag, edit, preview, and export MJML from Angular.</p>' }),
        this.createNode('button', { label: 'Get started', href: 'https://www.npmjs.com/package/ngx-email-studio' }),
      ],
    };
  }

  private createNode(type: EmailBlockType, attrs: Record<string, string | number | boolean> = {}): EmailNode {
    const defaults: Record<EmailBlockType, Record<string, string | number | boolean>> = {
      section: { backgroundColor: '#ffffff' },
      text: { content: '<p>New text block</p>', backgroundColor: '#ffffff' },
      image: { src: 'https://placehold.co/640x260?text=Email+Image', alt: 'Email image', backgroundColor: '#ffffff' },
      button: { label: 'Button', href: '#', backgroundColor: '#7c3aed' },
      divider: { borderColor: '#d0d5dd' },
      spacer: { height: 24 },
    };
    return { id: this.nextId(type), type, attrs: { ...defaults[type], ...attrs } };
  }

  private nextId(type: string): string {
    return `${type}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }

  private compileMjml(document: EmailDocument): string {
    const body = document.body.map((node) => this.nodeToMjml(node)).join('\n');
    return `<mjml>\n  <mj-body>\n${body}\n  </mj-body>\n</mjml>`;
  }

  private nodeToMjml(node: EmailNode): string {
    const bg = node.attrs['backgroundColor'] ? ` background-color="${this.escapeAttr(String(node.attrs['backgroundColor']))}"` : '';
    switch (node.type) {
      case 'section':
        return `    <mj-section${bg}><mj-column><mj-text>Section container</mj-text></mj-column></mj-section>`;
      case 'text':
        return `    <mj-section${bg}><mj-column><mj-text>${node.attrs['content'] || ''}</mj-text></mj-column></mj-section>`;
      case 'image':
        return `    <mj-section${bg}><mj-column><mj-image src="${this.escapeAttr(String(node.attrs['src'] || ''))}" alt="${this.escapeAttr(String(node.attrs['alt'] || ''))}" /></mj-column></mj-section>`;
      case 'button':
        return `    <mj-section><mj-column><mj-button href="${this.escapeAttr(String(node.attrs['href'] || '#'))}" background-color="${this.escapeAttr(String(node.attrs['backgroundColor'] || '#7c3aed'))}">${this.escapeHtml(String(node.attrs['label'] || 'Button'))}</mj-button></mj-column></mj-section>`;
      case 'divider':
        return `    <mj-section><mj-column><mj-divider border-color="${this.escapeAttr(String(node.attrs['borderColor'] || '#d0d5dd'))}" /></mj-column></mj-section>`;
      case 'spacer':
        return `    <mj-section><mj-column><mj-spacer height="${Number(node.attrs['height'] || 24)}px" /></mj-column></mj-section>`;
    }
  }

  private parseMjml(mjml: string): EmailDocument {
    if (typeof DOMParser === 'undefined') {
      return { version: '0.0.1', body: [this.createNode('text', { content: mjml })], unsupported: ['DOMParser unavailable'] };
    }
    const xml = new DOMParser().parseFromString(mjml, 'text/xml');
    const unsupported: string[] = [];
    const nodes: EmailNode[] = [];
    Array.from(xml.getElementsByTagName('*')).forEach((element) => {
      switch (element.tagName.toLowerCase()) {
        case 'mj-text':
          nodes.push(this.createNode('text', { content: element.innerHTML || element.textContent || '<p></p>' }));
          break;
        case 'mj-image':
          nodes.push(this.createNode('image', { src: element.getAttribute('src') || '', alt: element.getAttribute('alt') || '' }));
          break;
        case 'mj-button':
          nodes.push(this.createNode('button', { label: element.textContent || 'Button', href: element.getAttribute('href') || '#' }));
          break;
        case 'mj-divider':
          nodes.push(this.createNode('divider', { borderColor: element.getAttribute('border-color') || '#d0d5dd' }));
          break;
        case 'mj-spacer':
          nodes.push(this.createNode('spacer', { height: Number.parseInt(element.getAttribute('height') || '24', 10) }));
          break;
        case 'mjml':
        case 'mj-body':
        case 'mj-section':
        case 'mj-column':
          break;
        default:
          if (element.tagName.startsWith('mj-') && !unsupported.includes(element.tagName)) unsupported.push(element.tagName);
      }
    });
    return { version: '0.0.1', body: nodes.length ? nodes : [this.createNode('text')], unsupported };
  }

  private renderHtml(document: EmailDocument): string {
    const rows = document.body.map((node) => this.nodeToHtml(node)).join('\n');
    return `<!doctype html><html><body style="margin:0;background:#f3f4f6;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f4f6;padding:24px 0;"><tr><td align="center"><table role="presentation" width="640" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border-radius:16px;overflow:hidden;font-family:Arial,sans-serif;">${rows}</table></td></tr></table></body></html>`;
  }

  private nodeToHtml(node: EmailNode): string {
    switch (node.type) {
      case 'section':
        return `<tr><td style="padding:24px;background:${node.attrs['backgroundColor'] || '#ffffff'};color:#667085;text-align:center;">Section container</td></tr>`;
      case 'text':
        return `<tr><td style="padding:20px;background:${node.attrs['backgroundColor'] || '#ffffff'};line-height:1.6;color:#1f2937;">${node.attrs['content'] || ''}</td></tr>`;
      case 'image':
        return `<tr><td style="padding:0;"><img src="${this.escapeAttr(String(node.attrs['src'] || ''))}" alt="${this.escapeAttr(String(node.attrs['alt'] || ''))}" style="display:block;width:100%;height:auto;border:0;" /></td></tr>`;
      case 'button':
        return `<tr><td align="center" style="padding:24px;"><a href="${this.escapeAttr(String(node.attrs['href'] || '#'))}" style="display:inline-block;background:${this.escapeAttr(String(node.attrs['backgroundColor'] || '#7c3aed'))};color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:999px;font-weight:bold;">${this.escapeHtml(String(node.attrs['label'] || 'Button'))}</a></td></tr>`;
      case 'divider':
        return `<tr><td style="padding:12px 24px;"><hr style="border:0;border-top:1px solid ${this.escapeAttr(String(node.attrs['borderColor'] || '#d0d5dd'))};" /></td></tr>`;
      case 'spacer':
        return `<tr><td style="height:${Number(node.attrs['height'] || 24)}px;line-height:${Number(node.attrs['height'] || 24)}px;font-size:0;">&nbsp;</td></tr>`;
    }
  }

  private escapeAttr(value: string): string {
    return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  }

  private escapeHtml(value: string): string {
    return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}
