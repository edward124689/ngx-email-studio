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
  title?: string;
  breadcrumb?: string;
  brandLabel?: string;
  statusLabel?: string;
  fromLabel?: string;
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
  preset?: 'hero' | 'footer';
}

const DEFAULT_EMAIL_STUDIO_CONFIG: EmailStudioConfig = {
  useTinyMce: true,
  showHtmlPreview: true,
};

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
        <div class="nes-brand">
          <div class="nes-logo">EB</div>
          <div>
            <p class="nes-breadcrumb">{{ effectiveConfig.breadcrumb || 'CMS / Email Campaign / Draft' }}</p>
            <h2>{{ effectiveConfig.title || 'Membership Email · Email Builder' }}</h2>
          </div>
        </div>
        <div class="nes-actions">
          <span class="nes-save-state"><i class="fa fa-circle" aria-hidden="true"></i>{{ effectiveConfig.statusLabel || 'Draft saved' }}</span>
          <button type="button" class="nes-import-trigger" (click)="openImportModal()"><i class="fa fa-upload" aria-hidden="true"></i> Import</button>
          <div class="nes-export" [class.is-open]="exportMenuOpen">
            <button type="button" (click)="toggleExportMenu(); $event.stopPropagation()" aria-haspopup="menu" [attr.aria-expanded]="exportMenuOpen">
              <i class="fa fa-download" aria-hidden="true"></i> Export <i class="fa fa-angle-down" aria-hidden="true"></i>
            </button>
            <div class="nes-export-menu" role="menu" *ngIf="exportMenuOpen">
              <button type="button" role="menuitem" (click)="openOutputModal('mjml')">MJML output</button>
              <button type="button" role="menuitem" (click)="openOutputModal('html')">HTML output</button>
            </div>
          </div>
          <button type="button" class="nes-primary" (click)="exportHtml()"><i class="fa fa-floppy-o" aria-hidden="true"></i> Save</button>
        </div>
      </header>

      <main class="nes-builder">
        <aside class="nes-panel nes-palette">
          <div class="nes-panel-head">
            <h3>Content modules</h3>
            <p>Drag into the canvas or click to add</p>
          </div>
          <label class="nes-search">
            <i class="fa fa-search" aria-hidden="true"></i>
            <input [ngModel]="paletteSearch" (ngModelChange)="paletteSearch = $event" placeholder="Search modules" />
          </label>
          <div
            cdkDropList
            #paletteList="cdkDropList"
            [cdkDropListData]="palette"
            [cdkDropListConnectedTo]="connectedDropListIds"
            class="nes-block-list"
          >
            <article class="nes-block" *ngFor="let item of filteredPalette" cdkDrag [cdkDragData]="item" (click)="addBlock(item)">
              <span class="nes-block-icon"><i class="fa" [class]="'fa ' + item.icon" aria-hidden="true"></i></span>
              <span>
                <strong>{{ item.label }}</strong>
                <small>{{ item.description }}</small>
              </span>
            </article>
          </div>

          <div class="nes-outline">
            <div class="nes-outline-title"><strong>Outline</strong><span>{{ emailDocument.body.length }}</span></div>
            <button
              type="button"
              class="nes-outline-item"
              *ngFor="let node of emailDocument.body; let i = index; trackBy: trackNode"
              [class.is-active]="node.id === selectedNodeId"
              (click)="selectNode(node.id)"
            >
              <span>{{ (i + 1).toString().padStart(2, '0') }}</span>
              {{ outlineLabel(node) }}
            </button>
          </div>
        </aside>

        <section class="nes-stage">
          <div class="nes-stage-head">
            <div>
              <h3>Email canvas</h3>
              <p>{{ previewWidth }}px preview · {{ emailDocument.body.length }} blocks</p>
            </div>
            <div class="nes-stage-actions">
              <button type="button" (click)="addBlockByType('text')"><i class="fa fa-font" aria-hidden="true"></i> Add text</button>
              <button type="button" class="danger" (click)="clearDocument()"><i class="fa fa-trash" aria-hidden="true"></i> Clear</button>
            </div>
          </div>

          <div class="nes-device" [style.width.px]="previewWidth">
            <div class="nes-size-bar">
              <span>Size</span>
              <button
                type="button"
                *ngFor="let option of previewSizeOptions"
                [class.is-active]="previewWidth === option"
                (click)="setPreviewSize(option)"
              >{{ option }}</button>
            </div>
            <div class="nes-mail-meta"><span>From: {{ effectiveConfig.fromLabel || 'cms@brand.test' }}</span><span>Preview</span></div>
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
                <div class="nes-floating-tools" *ngIf="node.id === selectedNodeId">
                  <button type="button" (click)="duplicateSelected(); $event.stopPropagation()"><i class="fa fa-clone"></i></button>
                  <button type="button" (click)="deleteSelected(); $event.stopPropagation()"><i class="fa fa-trash"></i></button>
                </div>
                <ng-container [ngTemplateOutlet]="nodePreview" [ngTemplateOutletContext]="{ node: node, nested: false }"></ng-container>
              </article>
              <div class="nes-empty" *ngIf="emailDocument.body.length === 0">
                <i class="fa fa-magic" aria-hidden="true"></i>
                Drag blocks here to start building your email.
              </div>
              <div class="nes-bottom-drop">Drop here to append to the end</div>
            </div>
          </div>
        </section>

        <aside class="nes-panel nes-properties">
          <div class="nes-panel-head">
            <h3>Properties Inspector</h3>
            <p>{{ selectedNode ? outlineLabel(selectedNode) : 'No block selected' }}</p>
          </div>
          <ng-container *ngIf="selectedNode as node; else noSelection">
            <div class="nes-tabs">
              <button type="button" [class.is-active]="activeInspectorTab === 'content'" (click)="activeInspectorTab = 'content'">Content</button>
              <button type="button" [class.is-active]="activeInspectorTab === 'style'" (click)="activeInspectorTab = 'style'">Style</button>
              <button type="button" [class.is-active]="activeInspectorTab === 'check'" (click)="activeInspectorTab = 'check'">Check</button>
            </div>

            <div class="nes-tab-panel" *ngIf="activeInspectorTab === 'content'">
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
            </div>

            <div class="nes-tab-panel" *ngIf="activeInspectorTab === 'style'">
              <label *ngIf="node.type === 'column'">
                Column width
                <input [ngModel]="node.attrs['width']" (ngModelChange)="updateAttr(node, 'width', $event)" placeholder="50%" />
              </label>
              <label *ngIf="node.type !== 'divider' && node.type !== 'spacer'">
                Background color
                <input [ngModel]="node.attrs['backgroundColor']" (ngModelChange)="updateAttr(node, 'backgroundColor', $event)" placeholder="#ffffff" />
              </label>
              <label *ngIf="node.type === 'divider'">
                Border color
                <input [ngModel]="node.attrs['borderColor']" (ngModelChange)="updateAttr(node, 'borderColor', $event)" placeholder="#d0d5dd" />
              </label>
            </div>

            <div class="nes-tab-panel" *ngIf="activeInspectorTab === 'check'">
              <div class="nes-check-card" *ngIf="emailDocument.unsupported?.length; else checksOk">
                Unsupported MJML: {{ emailDocument.unsupported?.join(', ') }}
              </div>
              <ng-template #checksOk>
                <div class="nes-check-card is-ok"><i class="fa fa-check-circle"></i> No blocking issues for this supported subset.</div>
              </ng-template>
            </div>
          </ng-container>
          <ng-template #noSelection>
            <p class="nes-muted">Select a block to edit its properties.</p>
          </ng-template>
        </aside>
      </main>

      <div class="nes-modal-backdrop" *ngIf="importModalOpen" (click)="closeImportModal()">
        <section class="nes-import-modal" role="dialog" aria-modal="true" aria-label="Import MJML" (click)="$event.stopPropagation()">
          <header>
            <div class="nes-modal-heading">
              <span class="nes-modal-icon"><i class="fa fa-upload" aria-hidden="true"></i></span>
              <div>
                <p>Import MJML</p>
                <h3>Paste MJML to import</h3>
              </div>
            </div>
            <button type="button" aria-label="Close import modal" (click)="closeImportModal()"><i class="fa fa-times" aria-hidden="true"></i></button>
          </header>
          <div class="nes-import-body">
            <div class="nes-modal-intro">
              <strong>Supported import subset</strong>
              <p class="nes-muted">Rows, columns, text, images, buttons, dividers, and spacers will be converted into editable blocks.</p>
            </div>
            <div class="nes-code-shell">
              <div class="nes-code-toolbar">
                <span><i class="fa fa-code" aria-hidden="true"></i> MJML source</span>
                <small>Editable</small>
              </div>
              <textarea [ngModel]="mjmlDraft" (ngModelChange)="mjmlDraft = $event" spellcheck="false" placeholder="<mjml>...</mjml>"></textarea>
            </div>
            <div class="nes-import-error" *ngIf="importErrorMessage"><i class="fa fa-exclamation-triangle" aria-hidden="true"></i> {{ importErrorMessage }}</div>
          </div>
          <footer class="nes-modal-footer">
            <button type="button" (click)="closeImportModal()">Cancel</button>
            <button type="button" class="nes-primary" (click)="importMjml()"><i class="fa fa-check" aria-hidden="true"></i> Import MJML</button>
          </footer>
        </section>
      </div>

      <div class="nes-modal-backdrop" *ngIf="outputModalType" (click)="closeOutputModal()">
        <section class="nes-output-modal" role="dialog" aria-modal="true" [attr.aria-label]="outputModalTitle" (click)="$event.stopPropagation()">
          <header>
            <div class="nes-modal-heading">
              <span class="nes-modal-icon"><i class="fa fa-download" aria-hidden="true"></i></span>
              <div>
                <p>Export output</p>
                <h3>{{ outputModalTitle }}</h3>
              </div>
            </div>
            <div class="nes-modal-actions">
              <button type="button" class="nes-preview-btn" *ngIf="outputModalType === 'html'" (click)="previewHtmlOutput()"><i class="fa fa-external-link" aria-hidden="true"></i> Preview</button>
              <button type="button" class="nes-copy-btn" (click)="copyOutputToClipboard()"><i class="fa fa-copy" aria-hidden="true"></i> {{ copyState || 'Copy' }}</button>
              <button type="button" aria-label="Close export modal" (click)="closeOutputModal()"><i class="fa fa-times" aria-hidden="true"></i></button>
            </div>
          </header>
          <div *ngIf="emailDocument.unsupported?.length" class="nes-warning">
            Unsupported MJML preserved as warning: {{ emailDocument.unsupported?.join(', ') }}
          </div>
          <div class="nes-code-shell nes-output-code">
            <div class="nes-code-toolbar">
              <span><i class="fa fa-code" aria-hidden="true"></i> {{ outputModalType === 'html' ? 'Generated HTML' : 'Generated MJML' }}</span>
              <small>Read-only</small>
            </div>
            <pre>{{ outputModalContent }}</pre>
          </div>
        </section>
      </div>
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
    :host {
      --nes-accent: #2563eb;
      --nes-success: #16a34a;
      --nes-ink: #0f172a;
      --nes-muted: #64748b;
      --nes-border: #d9e2ec;
      --nes-panel: #ffffff;
      --nes-soft: #f8fafc;
      --nes-grid: rgba(148, 163, 184, .18);
      display: block;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      color: var(--nes-ink);
    }
    .nes-shell { border: 1px solid var(--nes-border); border-radius: 22px; background: #f1f5f9; overflow: hidden; min-height: 780px; box-shadow: 0 24px 80px rgba(15, 23, 42, .08); }
    .nes-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 18px; padding: 16px 22px; background: #fff; border-bottom: 1px solid var(--nes-border); }
    .nes-brand { display: flex; align-items: center; gap: 14px; min-width: 0; }
    .nes-logo { width: 42px; height: 42px; border-radius: 13px; display: grid; place-items: center; color: #fff; font-weight: 900; letter-spacing: -.04em; background: linear-gradient(135deg, #14b8a6, #22c55e); box-shadow: 0 10px 24px rgba(20, 184, 166, .28); }
    .nes-breadcrumb { margin: 0 0 4px; color: var(--nes-muted); font-size: 12px; }
    h2, h3 { margin: 0; }
    h2 { font-size: 20px; letter-spacing: -.02em; }
    h3 { font-size: 14px; color: #172033; }
    .nes-actions { display: flex; align-items: center; gap: 9px; flex-wrap: wrap; }
    button { border: 1px solid var(--nes-border); background: #fff; color: #172033; border-radius: 10px; padding: 9px 12px; font: inherit; cursor: pointer; transition: .15s ease; }
    button:hover { border-color: var(--nes-accent); color: var(--nes-accent); }
    .nes-primary { background: var(--nes-success); color: #fff; border-color: var(--nes-success); }
    .nes-primary:hover { background: #15803d; color: #fff; border-color: #15803d; }
    .nes-save-state { display: inline-flex; align-items: center; gap: 7px; padding: 8px 11px; border-radius: 999px; background: #ecfdf3; color: #15803d; font-size: 13px; font-weight: 700; }
    .nes-save-state i { font-size: 8px; }
    .nes-export { position: relative; }
    .nes-export > button { display: inline-flex; align-items: center; gap: 6px; }
    .nes-export-menu { position: absolute; right: 0; top: calc(100% + 8px); z-index: 30; width: 180px; padding: 6px; border: 1px solid var(--nes-border); border-radius: 12px; background: #fff; box-shadow: 0 18px 40px rgba(15, 23, 42, .16); }
    .nes-export-menu button { width: 100%; justify-content: flex-start; border: 0; background: transparent; text-align: left; }
    .nes-export-menu button:hover { background: #eff6ff; }
    .nes-builder { display: grid; grid-template-columns: 285px minmax(430px, 1fr) 340px; min-height: 660px; }
    .nes-panel { background: var(--nes-panel); padding: 18px; border-right: 1px solid var(--nes-border); }
    .nes-properties { border-right: 0; border-left: 1px solid var(--nes-border); }
    .nes-panel-head p { margin: 5px 0 0; color: var(--nes-muted); font-size: 12px; line-height: 1.45; }
    .nes-search { position: relative; display: block; margin: 16px 0; }
    .nes-search i { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #94a3b8; }
    .nes-search input { padding-left: 34px; background: #f8fafc; }
    .nes-block-list { display: grid; gap: 10px; max-height: 430px; overflow: auto; padding-right: 2px; }
    .nes-block { display: flex; align-items: center; gap: 12px; border: 1px solid #e2e8f0; border-radius: 14px; padding: 12px; background: #fff; box-shadow: 0 1px 2px rgba(15, 23, 42, .04); cursor: grab; }
    .nes-block:hover { border-color: #bfdbfe; box-shadow: 0 8px 20px rgba(37, 99, 235, .09); }
    .nes-block-icon { width: 34px; height: 34px; display: grid; place-items: center; border-radius: 10px; color: var(--nes-accent); background: #eff6ff; flex: 0 0 auto; }
    .nes-block strong, .nes-block small { display: block; }
    .nes-block small { color: var(--nes-muted); margin-top: 2px; font-size: 11px; line-height: 1.3; }
    .nes-outline { margin-top: 22px; padding-top: 16px; border-top: 1px solid #e2e8f0; }
    .nes-outline-title { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; font-size: 13px; }
    .nes-outline-title span { background: #e0f2fe; color: #0369a1; border-radius: 999px; padding: 2px 8px; font-weight: 800; }
    .nes-outline-item { width: 100%; display: flex; gap: 8px; align-items: center; border: 0; background: transparent; color: #475569; padding: 8px 10px; text-align: left; }
    .nes-outline-item span { color: #94a3b8; font-variant-numeric: tabular-nums; }
    .nes-outline-item.is-active { background: #eff6ff; color: #1d4ed8; font-weight: 800; }
    .nes-stage { overflow: auto; padding: 18px 22px 28px; background-color: #f8fafc; background-image: linear-gradient(var(--nes-grid) 1px, transparent 1px), linear-gradient(90deg, var(--nes-grid) 1px, transparent 1px); background-size: 24px 24px; }
    .nes-stage::-webkit-scrollbar { height: 10px; }
    .nes-stage-head { display: flex; justify-content: space-between; align-items: center; gap: 16px; margin-bottom: 18px; }
    .nes-stage-head p { margin: 4px 0 0; color: var(--nes-muted); font-size: 12px; }
    .nes-stage-actions { display: flex; gap: 8px; }
    .danger { color: #b42318; }
    .nes-device { max-width: 100%; margin: 0 auto; transition: width .2s ease; background: #fff; border-radius: 16px; box-shadow: 0 24px 80px rgba(15, 23, 42, .14); overflow: hidden; border: 1px solid #e2e8f0; }
    .nes-size-bar { display: flex; align-items: center; justify-content: flex-end; gap: 7px; padding: 10px 12px; border-bottom: 1px solid #e2e8f0; background: #fff; }
    .nes-size-bar span { margin-right: auto; color: var(--nes-muted); font-size: 12px; font-weight: 800; }
    .nes-size-bar button { padding: 5px 9px; border-radius: 8px; font-size: 12px; }
    .nes-size-bar button.is-active { background: #0f172a; color: #fff; border-color: #0f172a; }
    .nes-mail-meta { display: flex; justify-content: space-between; gap: 12px; padding: 10px 16px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; color: #64748b; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; }
    .nes-canvas { min-height: 520px; background: #fff; padding: 0; }
    .nes-node, .nes-child-node { position: relative; display: block; width: 100%; text-align: initial; border: 2px solid transparent; padding: 0; margin: 0; background: transparent; box-sizing: border-box; }
    .nes-child-node { margin-bottom: 10px; border-width: 1px; border-style: dashed; border-radius: 10px; }
    .nes-node.is-selected, .nes-child-node.is-selected, .nes-render-column.is-selected { border-color: var(--nes-accent); box-shadow: inset 0 0 0 1px var(--nes-accent); }
    .nes-floating-tools { position: absolute; right: 10px; top: 10px; z-index: 5; display: flex; gap: 4px; padding: 4px; background: #0f172a; border-radius: 10px; }
    .nes-floating-tools button { padding: 5px 7px; border: 0; background: transparent; color: #fff; }
    .nes-render-row { display: flex; align-items: stretch; gap: 14px; padding: 24px; }
    .nes-render-column { min-width: 0; flex: 1 1 0; border: 1px solid #e2e8f0; border-radius: 14px; padding: 14px; background: #fff; box-sizing: border-box; }
    .nes-render-column.is-empty, .nes-render-section.is-empty { min-height: 110px; }
    .nes-column-label { font-size: 11px; color: var(--nes-muted); margin-bottom: 8px; text-transform: uppercase; letter-spacing: .08em; }
    .nes-render-column-alone, .nes-render-section { padding: 24px; border: 1px dashed #cbd5e1; color: var(--nes-muted); }
    .nes-render-section { background: #fff; }
    .nes-drop-hint { display: grid; place-items: center; min-height: 64px; margin: 8px 0; border: 1px dashed #cbd5e1; border-radius: 10px; color: #94a3b8; font-size: 12px; }
    .nes-add-column-block { width: 100%; padding: 7px 9px; color: var(--nes-muted); border-style: dashed; }
    .nes-render-text { padding: 28px 32px; line-height: 1.6; color: #172033; }
    .nes-render-text :first-child { margin-top: 0; }
    .nes-render-text :last-child { margin-bottom: 0; }
    .nes-render-text h1 { font-size: 32px; line-height: 1.12; margin: 8px 0 14px; letter-spacing: -.03em; }
    .nes-render-text h2 { font-size: 22px; margin: 0 0 10px; }
    .nes-render-text .kicker { color: var(--nes-accent); font-size: 13px; font-weight: 900; letter-spacing: .04em; }
    .nes-render-image { display: block; width: 100%; max-height: 260px; object-fit: cover; background: #ecfeff; }
    .nes-render-button { display: inline-block; margin: 22px 32px 30px; background: #0f172a; color: white; padding: 13px 20px; border-radius: 10px; text-decoration: none; font-weight: 800; }
    .nes-render-divider { border: 0; border-top: 1px solid #d0d5dd; margin: 16px 24px; }
    .nes-empty { min-height: 380px; display: grid; place-items: center; color: var(--nes-muted); border: 2px dashed #d0d5dd; text-align: center; }
    .nes-bottom-drop { margin: 16px 24px 24px; padding: 15px; text-align: center; border: 1px dashed #86efac; border-radius: 12px; background: #f0fdf4; color: #15803d; font-weight: 800; font-size: 13px; }
    .nes-tabs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; padding: 4px; margin: 16px 0; border-radius: 12px; background: #f1f5f9; }
    .nes-tabs button { border: 0; background: transparent; padding: 8px; font-size: 13px; color: var(--nes-muted); }
    .nes-tabs button.is-active { background: #fff; color: #0f172a; box-shadow: 0 1px 2px rgba(15, 23, 42, .08); }
    .nes-tab-panel { margin-top: 14px; }
    .nes-inline-tools, .nes-add-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin: 12px 0; }
    .nes-add-grid button { padding: 8px; }
    label { display: grid; gap: 7px; margin: 14px 0; font-size: 13px; color: #475467; }
    input, textarea { width: 100%; box-sizing: border-box; border: 1px solid #cbd5e1; border-radius: 10px; padding: 10px 12px; font: inherit; background: #fff; }
    textarea { min-height: 120px; }
    .nes-muted { color: var(--nes-muted); font-size: 13px; }
    .nes-check-card { padding: 12px; border-radius: 12px; background: #fff7ed; color: #9a3412; border: 1px solid #fed7aa; font-size: 13px; }
    .nes-check-card.is-ok { background: #f0fdf4; color: #15803d; border-color: #bbf7d0; }
    .nes-modal-backdrop { position: fixed; inset: 0; z-index: 1000; display: grid; place-items: center; padding: 24px; background: radial-gradient(circle at 50% 10%, rgba(37, 99, 235, .16), transparent 32%), rgba(15, 23, 42, .58); backdrop-filter: blur(10px); }
    .nes-output-modal, .nes-import-modal { width: min(980px, 100%); max-height: min(760px, calc(100vh - 48px)); display: grid; overflow: hidden; border: 1px solid rgba(226, 232, 240, .98); border-radius: 22px; box-shadow: 0 32px 110px rgba(15, 23, 42, .34), 0 0 0 1px rgba(255, 255, 255, .44) inset; animation: nes-modal-pop .18s ease-out both; }
    .nes-output-modal { grid-template-rows: auto auto minmax(0, 1fr); background: #fff; }
    .nes-import-modal { grid-template-rows: auto minmax(0, 1fr) auto; background: var(--nes-soft); }
    .nes-output-modal header, .nes-import-modal header { display: flex; justify-content: space-between; align-items: center; gap: 16px; padding: 18px 20px; border-bottom: 1px solid var(--nes-border); background: linear-gradient(135deg, #ffffff 0%, #f8fafc 58%, #eefdf5 100%); }
    .nes-modal-heading { display: flex; align-items: center; gap: 12px; min-width: 0; }
    .nes-modal-icon { width: 40px; height: 40px; display: grid; place-items: center; border: 1px solid #bbf7d0; border-radius: 13px; background: linear-gradient(135deg, #ecfdf3, #eff6ff); color: var(--nes-success); box-shadow: 0 10px 22px rgba(22, 163, 74, .12); flex: 0 0 auto; }
    .nes-output-modal header p, .nes-import-modal header p { margin: 0 0 4px; color: var(--nes-success); font-size: 11px; font-weight: 900; letter-spacing: .075em; text-transform: uppercase; }
    .nes-output-modal header h3, .nes-import-modal header h3 { color: var(--nes-ink); font-size: 16px; letter-spacing: -.015em; text-wrap: pretty; }
    .nes-modal-actions { display: flex; align-items: center; gap: 8px; }
    .nes-modal-actions button, .nes-import-modal header > button { display: inline-flex; align-items: center; gap: 6px; background: #fff; color: var(--nes-muted); box-shadow: 0 1px 2px rgba(15, 23, 42, .05); }
    .nes-modal-actions button:hover, .nes-import-modal header > button:hover { border-color: var(--nes-accent); color: var(--nes-accent); transform: translateY(-1px); box-shadow: 0 8px 18px rgba(37, 99, 235, .10); }
    .nes-copy-btn, .nes-import-trigger { display: inline-flex; align-items: center; gap: 6px; }
    .nes-preview-btn { background: #ecfdf3 !important; color: var(--nes-success) !important; border-color: #bbf7d0 !important; font-weight: 800; }
    .nes-copy-btn { background: #eff6ff !important; color: var(--nes-accent) !important; border-color: #bfdbfe !important; font-weight: 800; }
    .nes-modal-intro { margin-bottom: 14px; padding: 12px 14px; border: 1px solid #e2e8f0; border-radius: 14px; background: #fff; box-shadow: 0 1px 2px rgba(15, 23, 42, .04); }
    .nes-modal-intro strong { display: block; margin-bottom: 3px; color: var(--nes-ink); font-size: 13px; }
    .nes-modal-intro .nes-muted { margin: 0; color: #475569; }
    .nes-code-shell { overflow: hidden; border: 1px solid #1e293b; border-radius: 16px; background: #0f172a; box-shadow: 0 18px 44px rgba(15, 23, 42, .18); }
    .nes-output-code { min-height: 0; margin: 16px 20px 20px; }
    .nes-code-toolbar { display: flex; justify-content: space-between; align-items: center; gap: 14px; padding: 10px 12px; border-bottom: 1px solid rgba(148, 163, 184, .18); background: linear-gradient(180deg, #172033, #0f172a); color: #cbd5e1; font: 11px/1.3 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; letter-spacing: .02em; text-transform: uppercase; }
    .nes-code-toolbar span { display: inline-flex; align-items: center; gap: 7px; min-width: 0; }
    .nes-code-toolbar small { color: #94a3b8; font: inherit; text-transform: none; letter-spacing: 0; }
    .nes-output-modal pre { margin: 0; min-height: 360px; max-height: 566px; overflow: auto; white-space: pre-wrap; background: #0f172a; color: #e5e7eb; padding: 18px; font: 12px/1.55 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
    .nes-output-modal pre::-webkit-scrollbar, .nes-import-body textarea::-webkit-scrollbar { width: 10px; height: 10px; }
    .nes-output-modal pre::-webkit-scrollbar-thumb, .nes-import-body textarea::-webkit-scrollbar-thumb { background: #334155; border-radius: 999px; border: 2px solid #0f172a; }
    .nes-import-body { padding: 20px; overflow: auto; background: linear-gradient(180deg, #f8fafc, #f1f5f9); }
    .nes-import-body textarea { min-height: 386px; resize: vertical; border: 0; border-radius: 0; font: 12px/1.55 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; background: #0f172a; color: #e5e7eb; box-shadow: inset 0 0 0 1px rgba(255, 255, 255, .03); }
    .nes-import-body textarea:focus { outline: 2px solid rgba(37, 99, 235, .24); outline-offset: -2px; }
    .nes-import-error { display: flex; align-items: center; gap: 8px; margin-top: 12px; padding: 10px 12px; border: 1px solid #fecaca; border-radius: 10px; background: #fef2f2; color: #b42318; font-size: 13px; }
    .nes-modal-footer { display: flex; justify-content: flex-end; gap: 10px; padding: 16px 20px; border-top: 1px solid var(--nes-border); background: #fff; }
    .nes-warning { background: #fff7ed; color: #9a3412; padding: 10px 12px; border: 1px solid #fed7aa; border-radius: 10px; margin: 12px 20px; }
    @keyframes nes-modal-pop { from { opacity: 0; transform: translateY(10px) scale(.985); } to { opacity: 1; transform: translateY(0) scale(1); } }
    .cdk-drag-preview { box-sizing: border-box; border-radius: 14px; box-shadow: 0 8px 24px rgba(16, 24, 40, .18); }
    .cdk-drag-placeholder { opacity: .35; }
    @media (max-width: 700px) { .nes-builder { grid-template-columns: 1fr; } .nes-properties { border-left: 0; border-top: 1px solid var(--nes-border); } .nes-panel { border-right: 0; border-bottom: 1px solid var(--nes-border); } }
    @media (max-width: 520px) { .nes-render-row { flex-direction: column; } .nes-render-column { width: 100% !important; } .nes-toolbar, .nes-stage-head { align-items: flex-start; flex-direction: column; } }
  `,
})
export class NgxEmailStudio implements OnChanges {
  @Input() mjml?: string;
  @Input() document?: EmailDocument;
  @Input() previewSize: EmailPreviewSize = 'desktop';
  @Input() readonly = false;
  @Input() config?: EmailStudioConfig | null = DEFAULT_EMAIL_STUDIO_CONFIG;

  @Output() mjmlChange = new EventEmitter<string>();
  @Output() documentChange = new EventEmitter<EmailDocument>();
  @Output() htmlExport = new EventEmitter<string>();
  @Output() error = new EventEmitter<EmailStudioError>();

  palette: PaletteItem[] = [
    { type: 'section', label: 'Hero title', icon: 'fa-header', description: 'Campaign headline, kicker, summary', preset: 'hero' },
    { type: 'text', label: 'Text paragraph', icon: 'fa-align-left', description: 'Rich text body or CMS summary' },
    { type: 'button', label: 'CTA button', icon: 'fa-mouse-pointer', description: 'Link, registration, or purchase action' },
    { type: 'image', label: 'Image placeholder', icon: 'fa-picture-o', description: 'Hero image or product visual' },
    { type: 'row', label: 'MJML columns', icon: 'fa-columns', description: '1-4 columns exported as mj-column' },
    { type: 'divider', label: 'Divider', icon: 'fa-minus', description: 'Separate content rhythm' },
    { type: 'spacer', label: 'Spacer', icon: 'fa-arrows-v', description: 'Vertical breathing room' },
    { type: 'section', label: 'Footer info', icon: 'fa-envelope-o', description: 'Unsubscribe and compliance copy', preset: 'footer' },
  ];

  emailDocument: EmailDocument = this.createStarterDocument();
  selectedNodeId?: string;
  mjmlDraft = '';
  paletteSearch = '';
  activeInspectorTab: 'content' | 'style' | 'check' = 'content';
  exportMenuOpen = false;
  importModalOpen = false;
  importErrorMessage = '';
  outputModalType: 'mjml' | 'html' | null = null;
  copyState = '';
  private copyStateTimer: ReturnType<typeof setTimeout> | undefined;
  readonly previewSizeOptions = [1200, 800, 600, 400];
  lastMjml = '';
  lastHtml = '';

  tinyMceInit = this.createTinyMceInit();
  readonly rootDropListId = 'nes-root-drop-list';

  get connectedDropListIds(): string[] {
    return [this.rootDropListId, ...this.collectContainerDropListIds(this.emailDocument.body)];
  }

  get filteredPalette(): PaletteItem[] {
    const query = this.paletteSearch.trim().toLowerCase();
    if (!query) return this.palette;
    return this.palette.filter((item) => `${item.label} ${item.description} ${item.type}`.toLowerCase().includes(query));
  }

  get selectedNode(): EmailNode | undefined {
    return this.findNode(this.selectedNodeId);
  }

  get effectiveConfig(): EmailStudioConfig {
    return { ...DEFAULT_EMAIL_STUDIO_CONFIG, ...(this.config || {}) };
  }

  get resolvedUseTinyMce(): boolean {
    return this.effectiveConfig.useTinyMce !== false;
  }

  get previewWidth(): number {
    if (typeof this.previewSize === 'number') return this.previewSize;
    return { desktop: 900, tablet: 768, mobile: 375 }[this.previewSize] ?? 900;
  }

  get previewLabel(): string {
    return typeof this.previewSize === 'number' ? 'Custom' : this.previewSize[0].toUpperCase() + this.previewSize.slice(1);
  }

  get outputModalTitle(): string {
    return this.outputModalType === 'html' ? 'HTML Output' : 'MJML Output';
  }

  get outputModalContent(): string {
    return this.outputModalType === 'html' ? this.lastHtml : this.lastMjml;
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
      const node = this.createNodeFromPalette(event.item.data);
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

  addBlock(item: PaletteItem): void {
    if (this.readonly) return;
    const node = this.createNodeFromPalette(item);
    this.emailDocument.body = [...this.emailDocument.body, node];
    this.selectedNodeId = node.id;
    this.emitDocument();
  }

  addBlockByType(type: PaletteBlockType): void {
    if (this.readonly) return;
    const node = this.createNode(type);
    this.emailDocument.body = [...this.emailDocument.body, node];
    this.selectedNodeId = node.id;
    this.emitDocument();
  }

  private createNodeFromPalette(item: PaletteItem): EmailNode {
    if (item.preset === 'hero') {
      return this.createNode('text', {
        content: '<p class="kicker">會員專屬更新</p><h1>今週精選內容已為你整理好</h1><p>用一封清晰、可編輯的 EDM，將 CMS 最新文章、商品與優惠同步發送給會員。</p>',
        backgroundColor: '#ffffff',
      });
    }

    if (item.preset === 'footer') {
      return this.createNode('text', {
        content: '<p>你收到此電郵是因為你訂閱了 CMS 會員更新。可於會員中心調整通知偏好或取消訂閱。</p>',
        backgroundColor: '#f1f5f9',
      });
    }

    return this.createNode(item.type);
  }

  clearDocument(): void {
    if (this.readonly) return;
    this.emailDocument = { ...this.emailDocument, body: [] };
    this.selectedNodeId = undefined;
    this.emitDocument();
  }

  outlineLabel(node: EmailNode): string {
    if (node.type === 'section') return 'Hero / Section';
    if (node.type === 'row') return `MJML ${node.children?.length || 1} columns`;
    if (node.type === 'text') return this.plainText(String(node.attrs['content'] || 'Text')).slice(0, 28) || 'Text paragraph';
    if (node.type === 'image') return 'Image placeholder';
    if (node.type === 'button') return String(node.attrs['label'] || 'CTA button');
    if (node.type === 'divider') return 'Divider';
    if (node.type === 'spacer') return 'Spacer';
    return node.type;
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

  openImportModal(): void {
    this.mjmlDraft = this.lastMjml || this.compileMjml(this.emailDocument);
    this.importErrorMessage = '';
    this.importModalOpen = true;
  }

  closeImportModal(): void {
    this.importModalOpen = false;
    this.importErrorMessage = '';
  }

  importMjml(): void {
    try {
      this.emailDocument = this.parseMjml(this.mjmlDraft);
      this.selectedNodeId = this.emailDocument.body[0]?.id;
      this.importModalOpen = false;
      this.importErrorMessage = '';
      this.emitDocument();
    } catch (details) {
      this.importErrorMessage = 'Unable to import MJML. Please check the markup and try again.';
      this.error.emit({ code: 'mjml_import_failed', message: 'Unable to import MJML.', details });
    }
  }

  toggleExportMenu(): void {
    this.exportMenuOpen = !this.exportMenuOpen;
  }

  openOutputModal(type: 'mjml' | 'html'): void {
    this.lastMjml = this.compileMjml(this.emailDocument);
    this.lastHtml = this.renderHtml(this.emailDocument);
    this.outputModalType = type;
    this.exportMenuOpen = false;
    if (type === 'mjml') {
      this.mjmlChange.emit(this.lastMjml);
    } else {
      this.htmlExport.emit(this.lastHtml);
    }
  }

  closeOutputModal(): void {
    this.outputModalType = null;
    this.copyState = '';
  }

  async copyOutputToClipboard(): Promise<void> {
    const content = this.outputModalContent;
    if (!content) return;
    try {
      if (globalThis.navigator?.clipboard?.writeText) {
        await globalThis.navigator.clipboard.writeText(content);
        this.setCopyState('Copied');
        return;
      }
      if (this.fallbackCopyToClipboard(content)) {
        this.setCopyState('Copied');
        return;
      }
    } catch {
      if (this.fallbackCopyToClipboard(content)) {
        this.setCopyState('Copied');
        return;
      }
    }
    this.setCopyState('Copy failed');
  }

  previewHtmlOutput(): void {
    if (this.outputModalType !== 'html') return;
    const previewWindow = globalThis.window?.open?.('', '_blank');
    if (!previewWindow) {
      this.error.emit({ code: 'html_preview_failed', message: 'Unable to open HTML preview window.' });
      return;
    }
    previewWindow.document.open();
    previewWindow.document.write(this.lastHtml || this.renderHtml(this.emailDocument));
    previewWindow.document.close();
    previewWindow.opener = null;
  }

  copyMjml(): void {
    this.openOutputModal('mjml');
  }

  exportHtml(): void {
    this.lastMjml = this.compileMjml(this.emailDocument);
    this.lastHtml = this.renderHtml(this.emailDocument);
    this.htmlExport.emit(this.lastHtml);
  }

  private setCopyState(state: string): void {
    this.copyState = state;
    if (this.copyStateTimer) clearTimeout(this.copyStateTimer);
    this.copyStateTimer = setTimeout(() => (this.copyState = ''), 1800);
  }

  private fallbackCopyToClipboard(content: string): boolean {
    const doc = globalThis.document;
    if (!doc?.body || !doc.execCommand) return false;
    const textarea = doc.createElement('textarea');
    textarea.value = content;
    textarea.setAttribute('readonly', 'true');
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    doc.body.appendChild(textarea);
    try {
      textarea.select();
      return doc.execCommand('copy');
    } finally {
      doc.body.removeChild(textarea);
    }
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

  private plainText(value: string): string {
    return value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  private refreshOutputs(emit: boolean): void {
    this.lastMjml = this.compileMjml(this.emailDocument);
    if (this.effectiveConfig.showHtmlPreview !== false) this.lastHtml = this.renderHtml(this.emailDocument);
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
      base_url: this.effectiveConfig.tinyMceBaseUrl || this.resolveTinyMceBaseUrl(),
      suffix: '.min',
      license_key: 'gpl',
      menubar: false,
      branding: false,
      promotion: false,
      height: 240,
      plugins: 'link lists',
      toolbar: 'undo redo | blocks | bold italic underline | alignleft aligncenter alignright | bullist numlist | link | removeformat',
      skin: 'oxide',
      content_css: 'default',
      content_style: 'body{font-family:Arial,sans-serif;font-size:14px;line-height:1.55;color:#1f2937;margin:12px;} a{color:#7c3aed;}',
      setup: (editor: { on: (event: string, callback: () => void) => void; getContainer?: () => HTMLElement | null }) => {
        const reveal = () => {
          const run = () => editor.getContainer?.()?.style.removeProperty('visibility');
          if (typeof globalThis.requestAnimationFrame === 'function') {
            globalThis.requestAnimationFrame(run);
          } else {
            setTimeout(run, 0);
          }
        };
        editor.on('init', reveal);
        editor.on('SkinLoaded', reveal);
        editor.on('PostRender', reveal);
      },
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
    const parserError = xml.querySelector('parsererror');
    if (parserError) {
      throw new Error(parserError.textContent || 'Invalid MJML markup.');
    }
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
    const rows = document.body.map((node) => this.nodeToHtml(node, 6)).join('\n');
    return [
      '<!doctype html>',
      '<html>',
      '  <head>',
      '    <meta charset="utf-8">',
      '    <meta name="viewport" content="width=device-width, initial-scale=1">',
      '    <title>Email Export</title>',
      '  </head>',
      '  <body style="margin:0;background:#f3f4f6;">',
      '    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f4f6;padding:24px 0;">',
      '      <tr>',
      '        <td align="center">',
      '          <table role="presentation" width="640" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border-radius:16px;overflow:hidden;font-family:Arial,sans-serif;">',
      rows,
      '          </table>',
      '        </td>',
      '      </tr>',
      '    </table>',
      '  </body>',
      '</html>',
    ].join('\n');
  }

  private nodeToHtml(node: EmailNode, depth = 0): string {
    if (node.type === 'row') return this.rowToHtml(node, depth);
    if (node.type === 'column') return [this.indent('<tr>', depth), this.columnToHtml(node, this.autoColumnWidth(node), depth + 1), this.indent('</tr>', depth)].join('\n');
    if (node.type === 'section') return this.sectionToHtml(node, depth);
    return this.blockToHtmlRow(node, depth);
  }

  private rowToHtml(row: EmailNode, depth = 0): string {
    const columns = (row.children || []).filter((child) => child.type === 'column');
    const width = this.autoColumnWidth(row);
    const cells = columns.map((column) => this.columnToHtml(column, width, depth + 4)).join('\n');
    return [
      this.indent('<tr>', depth),
      this.indent(`<td style="padding:0;background:${this.escapeAttr(String(row.attrs['backgroundColor'] || '#ffffff'))};">`, depth + 1),
      this.indent('<table role="presentation" width="100%" cellspacing="0" cellpadding="0">', depth + 2),
      this.indent('<tr>', depth + 3),
      cells,
      this.indent('</tr>', depth + 3),
      this.indent('</table>', depth + 2),
      this.indent('</td>', depth + 1),
      this.indent('</tr>', depth),
    ].join('\n');
  }

  private sectionToHtml(section: EmailNode, depth = 0): string {
    const content = (section.children || []).map((child) => this.blockToHtmlCellContent(child, depth + 2)).join('\n');
    return [
      this.indent('<tr>', depth),
      this.indent(`<td style="padding:16px;background:${this.escapeAttr(String(section.attrs['backgroundColor'] || '#ffffff'))};">`, depth + 1),
      content,
      this.indent('</td>', depth + 1),
      this.indent('</tr>', depth),
    ].join('\n');
  }

  private columnToHtml(column: EmailNode, fallbackWidth: string, depth = 0): string {
    const width = String(column.attrs['width'] || fallbackWidth);
    const content = (column.children || []).map((child) => this.blockToHtmlCellContent(child, depth + 1)).join('\n');
    return [
      this.indent(`<td width="${this.escapeAttr(width)}" valign="top" style="width:${this.escapeAttr(width)};padding:16px;background:${this.escapeAttr(String(column.attrs['backgroundColor'] || '#ffffff'))};">`, depth),
      content,
      this.indent('</td>', depth),
    ].join('\n');
  }

  private blockToHtmlRow(node: EmailNode, depth = 0): string {
    switch (node.type) {
      case 'row':
        return this.rowToHtml(node, depth);
      case 'column':
        return [this.indent('<tr>', depth), this.columnToHtml(node, '100%', depth + 1), this.indent('</tr>', depth)].join('\n');
      default:
        return [this.indent('<tr>', depth), this.indent('<td>', depth + 1), this.blockToHtmlCellContent(node, depth + 2), this.indent('</td>', depth + 1), this.indent('</tr>', depth)].join('\n');
    }
  }

  private blockToHtmlCellContent(node: EmailNode, depth = 0): string {
    switch (node.type) {
      case 'row':
        return [this.indent('<table role="presentation" width="100%" cellspacing="0" cellpadding="0">', depth), this.rowToHtml(node, depth + 1), this.indent('</table>', depth)].join('\n');
      case 'column':
        return [this.indent('<table role="presentation" width="100%" cellspacing="0" cellpadding="0">', depth), this.indent('<tr>', depth + 1), this.columnToHtml(node, '100%', depth + 2), this.indent('</tr>', depth + 1), this.indent('</table>', depth)].join('\n');
      case 'section':
        return [this.indent('<table role="presentation" width="100%" cellspacing="0" cellpadding="0">', depth), this.sectionToHtml(node, depth + 1), this.indent('</table>', depth)].join('\n');
      case 'text':
        return this.indent(`<div style="padding:20px;background:${this.escapeAttr(String(node.attrs['backgroundColor'] || '#ffffff'))};line-height:1.6;color:#1f2937;">${node.attrs['content'] || ''}</div>`, depth);
      case 'image':
        return this.indent(`<img src="${this.escapeAttr(String(node.attrs['src'] || ''))}" alt="${this.escapeAttr(String(node.attrs['alt'] || ''))}" style="display:block;width:100%;height:auto;border:0;" />`, depth);
      case 'button':
        return this.indent(`<div style="padding:24px;text-align:center;"><a href="${this.escapeAttr(String(node.attrs['href'] || '#'))}" style="display:inline-block;background:${this.escapeAttr(String(node.attrs['backgroundColor'] || '#7c3aed'))};color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:999px;font-weight:bold;">${this.escapeHtml(String(node.attrs['label'] || 'Button'))}</a></div>`, depth);
      case 'divider':
        return this.indent(`<div style="padding:12px 24px;"><hr style="border:0;border-top:1px solid ${this.escapeAttr(String(node.attrs['borderColor'] || '#d0d5dd'))};" /></div>`, depth);
      case 'spacer': {
        const height = Number(node.attrs['height'] || 24);
        return this.indent(`<div style="height:${height}px;line-height:${height}px;font-size:0;">&nbsp;</div>`, depth);
      }
      default:
        return '';
    }
  }

  private indent(value: string, depth: number): string {
    return `${'  '.repeat(depth)}${value}`;
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
