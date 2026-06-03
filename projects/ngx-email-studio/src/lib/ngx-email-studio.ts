import { CdkDragDrop, DragDropModule, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { EditorModule, TINYMCE_SCRIPT_SRC } from '@tinymce/tinymce-angular';

export type EmailBlockType = 'row' | 'column' | 'section' | 'text' | 'image' | 'button' | 'divider' | 'spacer';
export type PaletteBlockType = Exclude<EmailBlockType, 'column'>;
export type EmailPreviewSize = 'desktop' | 'tablet' | 'mobile' | number;

export interface EmailStudioConfig {
  useTinyMce?: boolean;
  showHtmlPreview?: boolean;
  /** Optional path where TinyMCE assets are hosted. Defaults to `${document.baseURI}/tinymce`. */
  tinyMceBaseUrl?: string;
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
  type: PaletteBlockType;
  label: string;
  icon: string;
  description: string;
}

function resolveTinyMceScriptSrc(): string {
  const base = globalThis.document?.baseURI || '/';
  return new URL('tinymce/tinymce.min.js', base).href;
}

@Component({
  selector: 'ngx-email-studio',
  standalone: true,
  imports: [CommonModule, FormsModule, DragDropModule, EditorModule],
  providers: [{ provide: TINYMCE_SCRIPT_SRC, useFactory: resolveTinyMceScriptSrc }],
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
            [cdkDropListConnectedTo]="connectedDropListIds"
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
              [id]="rootDropListId"
              [cdkDropListData]="emailDocument.body"
              [cdkDropListConnectedTo]="connectedDropListIds"
              (cdkDropListDropped)="drop($event)"
              class="nes-canvas"
            >
              <article
                role="button"
                tabindex="0"
                class="nes-node"
                [class.is-selected]="node.id === selectedNodeId"
                *ngFor="let node of emailDocument.body; trackBy: trackNode"
                cdkDrag
                [cdkDragData]="node"
                (click)="selectNode(node.id); $event.stopPropagation()"
                (keydown.enter)="selectNode(node.id)"
              >
                <ng-container [ngTemplateOutlet]="nodePreview" [ngTemplateOutletContext]="{ node: node, nested: false }"></ng-container>
              </article>
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

            <div *ngIf="node.type === 'row'" class="nes-inline-tools">
              <button type="button" (click)="setRowColumns(node, 1)">1 col</button>
              <button type="button" (click)="setRowColumns(node, 2)">2 cols</button>
              <button type="button" (click)="setRowColumns(node, 3)">3 cols</button>
              <button type="button" (click)="setRowColumns(node, 4)">4 cols</button>
            </div>

            <label *ngIf="node.type === 'row'">
              Columns
              <input type="number" min="1" max="4" [ngModel]="node.children?.length || 1" (ngModelChange)="setRowColumns(node, +$event)" />
            </label>

            <label *ngIf="node.type === 'column'">
              Column width
              <input [ngModel]="node.attrs['width']" (ngModelChange)="updateAttr(node, 'width', $event)" placeholder="50%" />
            </label>

            <ng-container *ngIf="node.type === 'row' || node.type === 'column' || node.type === 'section'">
              <p class="nes-muted">Add content inside this {{ node.type }}:</p>
              <div class="nes-add-grid">
                <button type="button" (click)="addChildBlock(node, 'text')"><i class="fa fa-font"></i> Text</button>
                <button type="button" (click)="addChildBlock(node, 'image')"><i class="fa fa-picture-o"></i> Image</button>
                <button type="button" (click)="addChildBlock(node, 'button')"><i class="fa fa-hand-pointer-o"></i> Button</button>
                <button type="button" (click)="addChildBlock(node, 'divider')"><i class="fa fa-minus"></i> Divider</button>
              </div>
            </ng-container>

            <label *ngIf="node.type === 'text'">
              Rich text
              <editor
                *ngIf="resolvedUseTinyMce; else plainTextEditor"
                [ngModel]="node.attrs['content']"
                (ngModelChange)="updateAttr(node, 'content', $event)"
                [init]="tinyMceInit"
                [licenseKey]="'gpl'"
              ></editor>
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

            <label *ngIf="node.type !== 'divider' && node.type !== 'spacer'">
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

    <ng-template #nodePreview let-node="node" let-nested="nested">
      <ng-container [ngSwitch]="node.type">
        <section *ngSwitchCase="'row'" class="nes-render-row" [style.background]="node.attrs['backgroundColor'] || '#ffffff'">
          <div
            cdkDropList
            class="nes-render-column"
            *ngFor="let column of node.children || []; let columnIndex = index; trackBy: trackNode"
            [id]="dropListIdFor(column)"
            [cdkDropListData]="childrenOf(column)"
            [cdkDropListConnectedTo]="connectedDropListIds"
            (cdkDropListDropped)="drop($event)"
            [style.width]="column.attrs['width'] || autoColumnWidth(node)"
            [class.is-selected]="column.id === selectedNodeId"
            [class.is-empty]="childrenOf(column).length === 0"
            (click)="selectNode(column.id); $event.stopPropagation()"
          >
            <div class="nes-column-label">Column {{ columnIndex + 1 }}</div>
            <article
              role="button"
              tabindex="0"
              class="nes-child-node"
              [class.is-selected]="child.id === selectedNodeId"
              *ngFor="let child of childrenOf(column); trackBy: trackNode"
              cdkDrag
              [cdkDragData]="child"
              (click)="selectNode(child.id); $event.stopPropagation()"
              (keydown.enter)="selectNode(child.id)"
            >
              <ng-container [ngTemplateOutlet]="nodePreview" [ngTemplateOutletContext]="{ node: child, nested: true }"></ng-container>
            </article>
            <div class="nes-drop-hint" *ngIf="childrenOf(column).length === 0">Drop blocks here</div>
            <button type="button" class="nes-add-column-block" (click)="addChildBlock(column, 'text'); $event.stopPropagation()">
              <i class="fa fa-plus"></i> Add text
            </button>
          </div>
        </section>
        <div *ngSwitchCase="'column'" class="nes-render-column-alone">Column</div>
        <section
          *ngSwitchCase="'section'"
          cdkDropList
          class="nes-render-section"
          [id]="dropListIdFor(node)"
          [cdkDropListData]="childrenOf(node)"
          [cdkDropListConnectedTo]="connectedDropListIds"
          (cdkDropListDropped)="drop($event)"
          [class.is-empty]="childrenOf(node).length === 0"
        >
          <div class="nes-column-label">Section</div>
          <article
            role="button"
            tabindex="0"
            class="nes-child-node"
            [class.is-selected]="child.id === selectedNodeId"
            *ngFor="let child of childrenOf(node); trackBy: trackNode"
            cdkDrag
            [cdkDragData]="child"
            (click)="selectNode(child.id); $event.stopPropagation()"
            (keydown.enter)="selectNode(child.id)"
          >
            <ng-container [ngTemplateOutlet]="nodePreview" [ngTemplateOutletContext]="{ node: child, nested: true }"></ng-container>
          </article>
          <div class="nes-drop-hint" *ngIf="childrenOf(node).length === 0">Drop blocks into this section</div>
        </section>
        <div *ngSwitchCase="'text'" class="nes-render-text" [innerHTML]="node.attrs['content']"></div>
        <img *ngSwitchCase="'image'" class="nes-render-image" [src]="node.attrs['src']" [alt]="node.attrs['alt'] || ''" />
        <a *ngSwitchCase="'button'" class="nes-render-button">{{ node.attrs['label'] }}</a>
        <hr *ngSwitchCase="'divider'" class="nes-render-divider" />
        <div *ngSwitchCase="'spacer'" [style.height.px]="node.attrs['height'] || 24"></div>
      </ng-container>
    </ng-template>
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
    .nes-builder { display: grid; grid-template-columns: 260px minmax(360px, 1fr) 340px; min-height: 600px; }
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
    .nes-node, .nes-child-node { display: block; width: 100%; text-align: initial; border: 1px dashed transparent; border-radius: 12px; padding: 8px; margin-bottom: 10px; background: transparent; box-sizing: border-box; }
    .nes-child-node { background: rgba(255,255,255,.72); }
    .nes-node.is-selected, .nes-child-node.is-selected, .nes-render-column.is-selected { border-color: #7c3aed; box-shadow: 0 0 0 3px rgba(124, 58, 237, .12); }
    .nes-render-row { display: flex; align-items: stretch; gap: 12px; padding: 14px; border-radius: 14px; border: 1px solid #e5e7eb; }
    .nes-render-column { min-width: 0; flex: 1 1 0; border: 1px dashed #cfd8e6; border-radius: 12px; padding: 10px; background: #fbfcff; box-sizing: border-box; }
    .nes-render-column.is-empty, .nes-render-section.is-empty { min-height: 110px; }
    .nes-column-label { font-size: 11px; color: #667085; margin-bottom: 8px; text-transform: uppercase; letter-spacing: .08em; }
    .nes-render-column-alone, .nes-render-section { padding: 16px; border: 1px dashed #cfd8e6; border-radius: 12px; color: #667085; }
    .nes-render-section { background: #fbfcff; }
    .nes-drop-hint { display: grid; place-items: center; min-height: 64px; margin: 8px 0; border: 1px dashed #cfd8e6; border-radius: 10px; color: #98a2b3; font-size: 12px; }
    .nes-add-column-block { width: 100%; padding: 7px 9px; color: #667085; border-style: dashed; }
    .nes-render-text { line-height: 1.55; color: #1f2937; }
    .nes-render-text :first-child { margin-top: 0; }
    .nes-render-text :last-child { margin-bottom: 0; }
    .nes-render-image { display: block; width: 100%; max-height: 220px; object-fit: cover; border-radius: 12px; background: #eef2ff; }
    .nes-render-button { display: inline-block; background: #7c3aed; color: white; padding: 12px 18px; border-radius: 999px; text-decoration: none; font-weight: 700; }
    .nes-render-divider { border: 0; border-top: 1px solid #d0d5dd; }
    .nes-empty { min-height: 440px; display: grid; place-items: center; color: #667085; border: 2px dashed #d0d5dd; border-radius: 16px; text-align: center; }
    .nes-property-head { display: flex; justify-content: space-between; align-items: center; margin: 14px 0; }
    .nes-property-head button { padding: 7px 9px; }
    .nes-inline-tools, .nes-add-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin: 12px 0; }
    .nes-add-grid button { padding: 8px; }
    .danger { color: #b42318; }
    label { display: grid; gap: 7px; margin: 14px 0; font-size: 13px; color: #475467; }
    input, textarea { width: 100%; box-sizing: border-box; border: 1px solid #cfd8e6; border-radius: 10px; padding: 10px 12px; font: inherit; }
    textarea { min-height: 120px; }
    .nes-muted { color: #667085; font-size: 13px; }
    .nes-output { border-top: 1px solid #dce3ef; background: #101828; color: #e5e7eb; padding: 18px; }
    .nes-output pre { white-space: pre-wrap; overflow: auto; max-height: 260px; background: #0b1220; padding: 12px; border-radius: 10px; }
    .nes-warning { background: #fff7ed; color: #9a3412; padding: 10px 12px; border-radius: 10px; margin-bottom: 12px; }
    .cdk-drag-preview { box-sizing: border-box; border-radius: 14px; box-shadow: 0 8px 24px rgba(16, 24, 40, .18); }
    .cdk-drag-placeholder { opacity: .35; }
    @media (max-width: 1100px) { .nes-builder { grid-template-columns: 1fr; } .nes-properties { border-left: 0; border-top: 1px solid #dce3ef; } .nes-panel { border-right: 0; border-bottom: 1px solid #dce3ef; } }
    @media (max-width: 640px) { .nes-render-row { flex-direction: column; } .nes-render-column { width: 100% !important; } }
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
    { type: 'row', label: 'Row', icon: 'fa-columns', description: '1-4 MJML columns' },
    { type: 'section', label: 'Section', icon: 'fa-square-o', description: 'Full-width MJML section' },
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

  tinyMceInit = this.createTinyMceInit();
  readonly rootDropListId = 'nes-root-drop-list';

  get connectedDropListIds(): string[] {
    return [this.rootDropListId, ...this.collectContainerDropListIds(this.emailDocument.body)];
  }

  get selectedNode(): EmailNode | undefined {
    return this.findNode(this.selectedNodeId);
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
    if (changes['config']) {
      this.tinyMceInit = this.createTinyMceInit();
    }

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
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
      this.emitDocument();
      return;
    }

    if (this.isPaletteItem(event.item.data)) {
      const node = this.createNode(event.item.data.type);
      event.container.data.splice(event.currentIndex, 0, node);
      this.selectedNodeId = node.id;
    } else {
      transferArrayItem(event.previousContainer.data as EmailNode[], event.container.data, event.previousIndex, event.currentIndex);
      this.selectedNodeId = event.container.data[event.currentIndex]?.id;
    }
    this.emitDocument();
  }

  trackNode(_: number, node: EmailNode): string {
    return node.id;
  }

  dropListIdFor(node: EmailNode): string {
    return `nes-drop-${node.id}`;
  }

  childrenOf(node: EmailNode): EmailNode[] {
    node.children ??= [];
    return node.children;
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

  setRowColumns(row: EmailNode, count: number): void {
    if (row.type !== 'row') return;
    const safeCount = Math.max(1, Math.min(4, Number.isFinite(count) ? Math.floor(count) : 1));
    const columns = [...(row.children || [])];
    while (columns.length < safeCount) columns.push(this.createColumn([this.createNode('text', { content: '<p>New column text</p>' })]));
    row.children = columns.slice(0, safeCount).map((column) => ({
      ...column,
      attrs: { ...column.attrs, width: `${Math.floor(100 / safeCount)}%` },
    }));
    this.emitDocument();
  }

  addChildBlock(parent: EmailNode, type: PaletteBlockType): void {
    if (parent.type === 'row') {
      const firstColumn = parent.children?.[0] || this.createColumn();
      parent.children = parent.children?.length ? parent.children : [firstColumn];
      this.addChildBlock(firstColumn, type);
      return;
    }

    if (parent.type !== 'column' && parent.type !== 'section') return;
    const child = this.createNode(type === 'row' || type === 'section' ? 'text' : type);
    parent.children = [...(parent.children || []), child];
    this.selectedNodeId = child.id;
    this.emitDocument();
  }

  autoColumnWidth(row: EmailNode): string {
    const count = Math.max(1, row.children?.length || 1);
    return `${Math.floor(100 / count)}%`;
  }

  duplicateSelected(): void {
    if (!this.selectedNodeId) return;
    const location = this.findNodeLocation(this.selectedNodeId);
    if (!location) return;
    const clone = structuredClone(location.node);
    this.reseedIds(clone);
    location.siblings.splice(location.index + 1, 0, clone);
    this.selectedNodeId = clone.id;
    this.emitDocument();
  }

  deleteSelected(): void {
    if (!this.selectedNodeId) return;
    const location = this.findNodeLocation(this.selectedNodeId);
    if (!location) return;
    location.siblings.splice(location.index, 1);
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

  private isPaletteItem(value: unknown): value is PaletteItem {
    return !!value && typeof value === 'object' && 'type' in value && 'label' in value && 'description' in value;
  }

  private collectContainerDropListIds(nodes: EmailNode[]): string[] {
    return nodes.flatMap((node) => {
      const ids = node.type === 'column' || node.type === 'section' ? [this.dropListIdFor(node)] : [];
      return [...ids, ...this.collectContainerDropListIds(node.children || [])];
    });
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
        this.createNode('row', {
          backgroundColor: '#f8fafc',
        }),
        this.createNode('button', { label: 'Get started', href: 'https://www.npmjs.com/package/ngx-email-studio' }),
      ],
    };
  }

  private createTinyMceInit(): Record<string, unknown> {
    return {
      base_url: this.config?.tinyMceBaseUrl || this.resolveTinyMceBaseUrl(),
      suffix: '.min',
      license_key: 'gpl',
      menubar: false,
      branding: false,
      promotion: false,
      height: 240,
      plugins: 'link lists',
      toolbar: 'undo redo | blocks | bold italic underline | alignleft aligncenter alignright | bullist numlist | link | removeformat',
      skin: false,
      content_css: false,
      content_style: 'body{font-family:Arial,sans-serif;font-size:14px;line-height:1.55;color:#1f2937;margin:12px;} a{color:#7c3aed;}',
    };
  }

  private resolveTinyMceBaseUrl(): string {
    const base = globalThis.document?.baseURI || '/';
    return new URL('tinymce', base).href.replace(/\/$/, '');
  }

  private createNode(type: EmailBlockType, attrs: Record<string, string | number | boolean> = {}): EmailNode {
    const defaults: Record<EmailBlockType, Record<string, string | number | boolean>> = {
      row: { backgroundColor: '#ffffff' },
      column: { width: '50%', backgroundColor: '#ffffff' },
      section: { backgroundColor: '#ffffff' },
      text: { content: '<p>New text block</p>', backgroundColor: '#ffffff' },
      image: { src: 'https://placehold.co/640x260?text=Email+Image', alt: 'Email image', backgroundColor: '#ffffff' },
      button: { label: 'Button', href: '#', backgroundColor: '#7c3aed' },
      divider: { borderColor: '#d0d5dd' },
      spacer: { height: 24 },
    };

    if (type === 'row') {
      return {
        id: this.nextId(type),
        type,
        attrs: { ...defaults[type], ...attrs },
        children: [
          this.createColumn([this.createNode('text', { content: '<p><strong>Left column</strong><br>Describe your offer.</p>' })], '50%'),
          this.createColumn([this.createNode('button', { label: 'Shop now', href: '#' })], '50%'),
        ],
      };
    }

    if (type === 'section') {
      return {
        id: this.nextId(type),
        type,
        attrs: { ...defaults[type], ...attrs },
        children: [this.createNode('text', { content: '<p>Drop blocks into this section.</p>' })],
      };
    }

    return { id: this.nextId(type), type, attrs: { ...defaults[type], ...attrs } };
  }

  private createColumn(children: EmailNode[] = [], width = '50%', attrs: Record<string, string | number | boolean> = {}): EmailNode {
    return {
      id: this.nextId('column'),
      type: 'column',
      attrs: { width, backgroundColor: '#ffffff', ...attrs },
      children,
    };
  }

  private nextId(type: string): string {
    return `${type}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }

  private compileMjml(document: EmailDocument): string {
    const body = document.body.map((node) => this.nodeToMjml(node)).join('\n');
    return `<mjml>\n  <mj-body>\n${body}\n  </mj-body>\n</mjml>`;
  }

  private nodeToMjml(node: EmailNode): string {
    if (node.type === 'row') return this.rowToMjml(node);
    if (node.type === 'column') return this.columnToMjml(node);
    if (node.type === 'section') return this.sectionToMjml(node);
    return `    <mj-section${this.backgroundAttr(node)}><mj-column>${this.blockToMjml(node)}</mj-column></mj-section>`;
  }

  private rowToMjml(row: EmailNode): string {
    const columns = (row.children || []).filter((child) => child.type === 'column');
    const columnMarkup = columns.length
      ? columns.map((column) => this.columnToMjml(column)).join('')
      : this.columnToMjml(this.createColumn([this.createNode('text')]));
    return `    <mj-section${this.backgroundAttr(row)}>${columnMarkup}</mj-section>`;
  }

  private sectionToMjml(section: EmailNode): string {
    const children = (section.children || []).map((child) => this.blockToMjml(child)).join('');
    return `    <mj-section${this.backgroundAttr(section)}><mj-column>${children || '<mj-text></mj-text>'}</mj-column></mj-section>`;
  }

  private columnToMjml(column: EmailNode): string {
    const width = column.attrs['width'] ? ` width="${this.escapeAttr(String(column.attrs['width']))}"` : '';
    const background = this.backgroundAttr(column);
    const children = (column.children || []).map((child) => this.blockToMjml(child)).join('');
    return `<mj-column${width}${background}>${children || '<mj-text></mj-text>'}</mj-column>`;
  }

  private blockToMjml(node: EmailNode): string {
    switch (node.type) {
      case 'row':
        return this.rowToMjml(node);
      case 'column':
        return this.columnToMjml(node);
      case 'section':
        return `<mj-text${this.backgroundAttr(node)}>Section container</mj-text>`;
      case 'text':
        return `<mj-text${this.backgroundAttr(node)}>${node.attrs['content'] || ''}</mj-text>`;
      case 'image':
        return `<mj-image src="${this.escapeAttr(String(node.attrs['src'] || ''))}" alt="${this.escapeAttr(String(node.attrs['alt'] || ''))}" />`;
      case 'button':
        return `<mj-button href="${this.escapeAttr(String(node.attrs['href'] || '#'))}" background-color="${this.escapeAttr(String(node.attrs['backgroundColor'] || '#7c3aed'))}">${this.escapeHtml(String(node.attrs['label'] || 'Button'))}</mj-button>`;
      case 'divider':
        return `<mj-divider border-color="${this.escapeAttr(String(node.attrs['borderColor'] || '#d0d5dd'))}" />`;
      case 'spacer':
        return `<mj-spacer height="${Number(node.attrs['height'] || 24)}px" />`;
    }
  }

  private parseMjml(mjml: string): EmailDocument {
    if (typeof DOMParser === 'undefined') {
      return { version: '0.0.1', body: [this.createNode('text', { content: mjml })], unsupported: ['DOMParser unavailable'] };
    }
    const xml = new DOMParser().parseFromString(mjml, 'text/xml');
    const unsupported: string[] = [];
    const body = xml.getElementsByTagName('mj-body')[0] || xml.documentElement;
    const nodes: EmailNode[] = [];

    this.elementChildren(body)
      .filter((element) => element.tagName.toLowerCase() === 'mj-section')
      .forEach((section) => {
        const columns = this.elementChildren(section).filter((element) => element.tagName.toLowerCase() === 'mj-column');
        if (columns.length === 0) return;

        const parsedColumns = columns.map((column) => this.parseColumn(column, unsupported)).filter((column): column is EmailNode => !!column);
        if (parsedColumns.length === 1 && (parsedColumns[0].children?.length || 0) === 1) {
          const onlyChild = parsedColumns[0].children?.[0];
          if (onlyChild) {
            if (section.getAttribute('background-color') && !onlyChild.attrs['backgroundColor']) {
              onlyChild.attrs['backgroundColor'] = section.getAttribute('background-color') || '#ffffff';
            }
            nodes.push(onlyChild);
          }
        } else {
          nodes.push(
            this.createNode('row', {
              backgroundColor: section.getAttribute('background-color') || '#ffffff',
            }),
          );
          const row = nodes[nodes.length - 1];
          row.children = parsedColumns;
        }
      });

    Array.from(xml.getElementsByTagName('*')).forEach((element) => {
      const tag = element.tagName.toLowerCase();
      if (tag.startsWith('mj-') && !this.supportedMjmlTags.has(tag) && !unsupported.includes(element.tagName)) unsupported.push(element.tagName);
    });

    return { version: '0.0.1', body: nodes.length ? nodes : [this.createNode('text')], unsupported };
  }

  private parseColumn(column: Element, unsupported: string[]): EmailNode | undefined {
    const children = this.elementChildren(column)
      .map((element) => this.parseMjmlBlock(element, unsupported))
      .filter((node): node is EmailNode => !!node);

    return this.createColumn(children, column.getAttribute('width') || '50%', {
      backgroundColor: column.getAttribute('background-color') || '#ffffff',
    });
  }

  private parseMjmlBlock(element: Element, unsupported: string[]): EmailNode | undefined {
    switch (element.tagName.toLowerCase()) {
      case 'mj-text':
        return this.createNode('text', { content: element.innerHTML || element.textContent || '<p></p>' });
      case 'mj-image':
        return this.createNode('image', { src: element.getAttribute('src') || '', alt: element.getAttribute('alt') || '' });
      case 'mj-button':
        return this.createNode('button', {
          label: element.textContent || 'Button',
          href: element.getAttribute('href') || '#',
          backgroundColor: element.getAttribute('background-color') || '#7c3aed',
        });
      case 'mj-divider':
        return this.createNode('divider', { borderColor: element.getAttribute('border-color') || '#d0d5dd' });
      case 'mj-spacer':
        return this.createNode('spacer', { height: Number.parseInt(element.getAttribute('height') || '24', 10) });
      default:
        if (element.tagName.startsWith('mj-') && !unsupported.includes(element.tagName)) unsupported.push(element.tagName);
        return undefined;
    }
  }

  private renderHtml(document: EmailDocument): string {
    const rows = document.body.map((node) => this.nodeToHtml(node)).join('\n');
    return `<!doctype html><html><body style="margin:0;background:#f3f4f6;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f4f6;padding:24px 0;"><tr><td align="center"><table role="presentation" width="640" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border-radius:16px;overflow:hidden;font-family:Arial,sans-serif;">${rows}</table></td></tr></table></body></html>`;
  }

  private nodeToHtml(node: EmailNode): string {
    if (node.type === 'row') return this.rowToHtml(node);
    if (node.type === 'column') return this.columnToHtml(node, this.autoColumnWidth(node));
    if (node.type === 'section') return this.sectionToHtml(node);
    return this.blockToHtmlRow(node);
  }

  private rowToHtml(row: EmailNode): string {
    const columns = (row.children || []).filter((child) => child.type === 'column');
    const width = this.autoColumnWidth(row);
    const cells = columns.map((column) => this.columnToHtml(column, width)).join('');
    return `<tr><td style="padding:0;background:${this.escapeAttr(String(row.attrs['backgroundColor'] || '#ffffff'))};"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>${cells}</tr></table></td></tr>`;
  }

  private sectionToHtml(section: EmailNode): string {
    const content = (section.children || []).map((child) => this.blockToHtmlCellContent(child)).join('');
    return `<tr><td style="padding:16px;background:${this.escapeAttr(String(section.attrs['backgroundColor'] || '#ffffff'))};">${content}</td></tr>`;
  }

  private columnToHtml(column: EmailNode, fallbackWidth: string): string {
    const width = String(column.attrs['width'] || fallbackWidth);
    const content = (column.children || []).map((child) => this.blockToHtmlCellContent(child)).join('');
    return `<td width="${this.escapeAttr(width)}" valign="top" style="width:${this.escapeAttr(width)};padding:16px;background:${this.escapeAttr(String(column.attrs['backgroundColor'] || '#ffffff'))};">${content}</td>`;
  }

  private blockToHtmlRow(node: EmailNode): string {
    switch (node.type) {
      case 'row':
        return this.rowToHtml(node);
      case 'column':
        return `<tr>${this.columnToHtml(node, '100%')}</tr>`;
      default:
        return `<tr><td>${this.blockToHtmlCellContent(node)}</td></tr>`;
    }
  }

  private blockToHtmlCellContent(node: EmailNode): string {
    switch (node.type) {
      case 'row':
        return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0">${this.rowToHtml(node)}</table>`;
      case 'column':
        return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>${this.columnToHtml(node, '100%')}</tr></table>`;
      case 'section':
        return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0">${this.sectionToHtml(node)}</table>`;
      case 'text':
        return `<div style="padding:20px;background:${this.escapeAttr(String(node.attrs['backgroundColor'] || '#ffffff'))};line-height:1.6;color:#1f2937;">${node.attrs['content'] || ''}</div>`;
      case 'image':
        return `<img src="${this.escapeAttr(String(node.attrs['src'] || ''))}" alt="${this.escapeAttr(String(node.attrs['alt'] || ''))}" style="display:block;width:100%;height:auto;border:0;" />`;
      case 'button':
        return `<div style="padding:24px;text-align:center;"><a href="${this.escapeAttr(String(node.attrs['href'] || '#'))}" style="display:inline-block;background:${this.escapeAttr(String(node.attrs['backgroundColor'] || '#7c3aed'))};color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:999px;font-weight:bold;">${this.escapeHtml(String(node.attrs['label'] || 'Button'))}</a></div>`;
      case 'divider':
        return `<div style="padding:12px 24px;"><hr style="border:0;border-top:1px solid ${this.escapeAttr(String(node.attrs['borderColor'] || '#d0d5dd'))};" /></div>`;
      case 'spacer':
        return `<div style="height:${Number(node.attrs['height'] || 24)}px;line-height:${Number(node.attrs['height'] || 24)}px;font-size:0;">&nbsp;</div>`;
    }
  }

  private findNode(id?: string): EmailNode | undefined {
    if (!id) return undefined;
    return this.findNodeLocation(id)?.node;
  }

  private findNodeLocation(id: string, siblings = this.emailDocument.body): { node: EmailNode; siblings: EmailNode[]; index: number } | undefined {
    for (let index = 0; index < siblings.length; index += 1) {
      const node = siblings[index];
      if (node.id === id) return { node, siblings, index };
      if (node.children?.length) {
        const nested = this.findNodeLocation(id, node.children);
        if (nested) return nested;
      }
    }
    return undefined;
  }

  private reseedIds(node: EmailNode): void {
    node.id = this.nextId(node.type);
    node.children?.forEach((child) => this.reseedIds(child));
  }

  private elementChildren(element: Element): Element[] {
    return Array.from(element.children).filter((child): child is Element => child.nodeType === Node.ELEMENT_NODE);
  }

  private backgroundAttr(node: EmailNode): string {
    return node.attrs['backgroundColor'] ? ` background-color="${this.escapeAttr(String(node.attrs['backgroundColor']))}"` : '';
  }

  private readonly supportedMjmlTags = new Set(['mjml', 'mj-body', 'mj-section', 'mj-column', 'mj-text', 'mj-image', 'mj-button', 'mj-divider', 'mj-spacer']);

  private escapeAttr(value: string): string {
    return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  }

  private escapeHtml(value: string): string {
    return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}
