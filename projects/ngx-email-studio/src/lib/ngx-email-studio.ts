import { CDK_DRAG_CONFIG, CdkDragDrop, DragDropModule, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { CommonModule } from '@angular/common';
import { AfterViewChecked, AfterViewInit, Component, ElementRef, EventEmitter, HostListener, Input, OnChanges, OnDestroy, Output, SimpleChanges, ViewEncapsulation } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Editor as TiptapEditor } from '@tiptap/core';

import { DEFAULT_EMAIL_STUDIO_CONFIG } from './config';
import { BODY_NODE_ID } from './constants';
import { compileMjml as compileMjmlDocument } from './export/mjml-export';
import { parseMjml as parseMjmlDocument } from './import/mjml-import';
import {
  CanvasMode,
  EmailBlockType,
  EmailDocument,
  EmailNode,
  EmailPreviewSize,
  EmailSizeUnit,
  EmailStudioConfig,
  EmailStudioError,
  PaletteBlockType,
  PaletteItem,
  RichTextEditorMode,
  TiptapCommand,
  TiptapHeadingValue,
  TiptapScope,
  TiptapTextAlignValue,
} from './models';
import { sanitizeRichTextContent as sanitizeRichTextHtml } from './tiptap/rich-text-sanitizer';
import { TIPTAP_EXTENSIONS } from './tiptap/tiptap-extensions';
import { TIPTAP_BLOCK_OPTIONS, TIPTAP_FONT_SIZE_OPTIONS, TIPTAP_LINE_HEIGHT_OPTIONS } from './tiptap/tiptap-options';
import { createColumn as createTreeColumn, createNode as createTreeNode, createSectionWithChildren as createTreeSectionWithChildren, createStarterDocument as createTreeStarterDocument, defaultDocumentAttrs as getDefaultDocumentAttrs } from './tree/block-factory';
import { elementChildren as getElementChildren, findNode as findTreeNode, findNodeLocation as findTreeNodeLocation, nodeContainsId as treeNodeContainsId, reseedIds as reseedTreeIds } from './tree/node-utils';

export type {
  CanvasMode,
  EmailBlockType,
  EmailDocument,
  EmailNode,
  EmailPreviewSize,
  EmailSizeUnit,
  EmailStudioConfig,
  EmailStudioError,
  PaletteBlockType,
  PaletteItem,
  RichTextEditorMode,
  TiptapCommand,
  TiptapHeadingValue,
  TiptapScope,
  TiptapTextAlignValue,
} from './models';
export { DEFAULT_EMAIL_STUDIO_CONFIG } from './config';

let nextEmailStudioInstanceId = 0;

function createEmailStudioInstanceId(): string {
  nextEmailStudioInstanceId += 1;
  return `nes-${nextEmailStudioInstanceId}`;
}

@Component({
  selector: 'ngx-email-studio',
  standalone: true,
  encapsulation: ViewEncapsulation.None,
  imports: [CommonModule, FormsModule, DragDropModule],
  providers: [
    { provide: CDK_DRAG_CONFIG, useValue: { dragStartThreshold: 1, pointerDirectionChangeThreshold: 2, previewContainer: 'parent' } },
  ],
  template: `
    <section class="nes-shell" [class.is-dragging]="dragInProgress" (click)="closeTransientMenus()">
      <header class="nes-toolbar">
        <div class="nes-brand">
          <div class="nes-logo" aria-hidden="true"><i class="nes-icon fa fa-envelope-open-o"></i></div>
          <div>
            <h2>{{ effectiveConfig.title || 'Email Studio' }}</h2>
          </div>
        </div>
        <div class="nes-actions">
          <button type="button" class="nes-import-trigger" [disabled]="readonly" (click)="openImportModal()"><i class="nes-icon fa fa-upload" aria-hidden="true"></i> Import</button>
          <button type="button" class="nes-primary" (click)="exportHtml()"><i class="nes-icon fa fa-floppy-o" aria-hidden="true"></i> Save</button>
          <div class="nes-export" [class.is-open]="exportMenuOpen" (click)="$event.stopPropagation()">
            <button type="button" class="nes-export-trigger" (click)="toggleExportMenu(); $event.stopPropagation()" aria-haspopup="menu" [attr.aria-expanded]="exportMenuOpen">
              <i class="nes-icon fa fa-download" aria-hidden="true"></i>
              <span>Export</span>
              <i class="nes-icon fa fa-angle-down" aria-hidden="true"></i>
            </button>
            <div class="nes-export-menu" role="menu" *ngIf="exportMenuOpen">
              <button type="button" role="menuitem" (click)="openOutputModal('mjml')"><i class="nes-icon fa fa-code" aria-hidden="true"></i><span>MJML output</span></button>
              <button type="button" role="menuitem" (click)="openOutputModal('html')"><i class="nes-icon fa fa-external-link" aria-hidden="true"></i><span>HTML output</span></button>
            </div>
          </div>
        </div>
      </header>

      <main class="nes-builder">
        <aside class="nes-panel nes-palette">
          <div class="nes-left-tabs" role="tablist" aria-label="Builder side panel">
            <button type="button" role="tab" [attr.aria-selected]="activeLeftTab === 'modules'" [class.is-active]="activeLeftTab === 'modules'" (click)="activeLeftTab = 'modules'">Content modules</button>
            <button type="button" role="tab" [attr.aria-selected]="activeLeftTab === 'outline'" [class.is-active]="activeLeftTab === 'outline'" (click)="activeLeftTab = 'outline'">Outline</button>
          </div>

          <ng-container *ngIf="activeLeftTab === 'modules'; else outlinePanel">
            <div class="nes-panel-head">
              <h3>Content modules</h3>
              <p>Drag modules into the canvas, sections, or columns</p>
            </div>
            <label class="nes-search">
              <i class="nes-icon fa fa-search" aria-hidden="true"></i>
              <input [ngModel]="paletteSearch" (ngModelChange)="paletteSearch = $event" placeholder="Search modules" />
            </label>
            <div
              cdkDropList
              #paletteList="cdkDropList"
              [id]="paletteDropListId"
              [cdkDropListData]="palette"
              [cdkDropListConnectedTo]="connectedDropListIds"
              [cdkDropListSortingDisabled]="true"
              [cdkDropListEnterPredicate]="rejectPaletteDrop"
              class="nes-block-list"
            >
              <article class="nes-block" *ngFor="let item of filteredPalette" cdkDrag [cdkDragData]="item" [cdkDragPreviewContainer]="'parent'" [cdkDragStartDelay]="0" (cdkDragStarted)="beginDrag()" (cdkDragEnded)="endDrag()" [attr.title]="item.description">
                <span class="nes-block-icon"><i class="nes-icon fa" [class]="'nes-icon fa ' + item.icon" aria-hidden="true"></i></span>
                <span class="nes-block-copy">
                  <strong>{{ item.label }}</strong>
                  <small class="nes-block-description">{{ item.description }}</small>
                </span>
              </article>
            </div>
          </ng-container>

          <ng-template #outlinePanel>
            <div class="nes-panel-head nes-outline-head">
              <div>
                <h3>Outline</h3>
                <p>Tree view of sections, rows, columns and nested blocks</p>
              </div>
              <span>{{ totalOutlineNodes }}</span>
            </div>
            <div class="nes-outline-tree" role="tree" *ngIf="emailDocument.body.length; else emptyOutline">
              <button
                type="button"
                class="nes-outline-node nes-outline-body"
                role="treeitem"
                [attr.aria-selected]="selectedNodeId === bodyNodeId"
                [class.is-active]="selectedNodeId === bodyNodeId"
                (click)="selectBodyFromOutline()"
              >
                <span class="nes-outline-rail" aria-hidden="true"></span>
                <span class="nes-outline-icon"><i class="nes-icon fa fa-envelope-o" aria-hidden="true"></i></span>
                <span class="nes-outline-copy">
                  <strong>Body</strong>
                  <small>{{ emailWidthCss }} email canvas</small>
                </span>
                <span class="nes-outline-index">BODY</span>
              </button>
              <div class="nes-outline-children" role="group">
                <ng-container *ngFor="let node of emailDocument.body; let i = index; trackBy: trackNode">
                  <ng-container [ngTemplateOutlet]="outlineTreeNode" [ngTemplateOutletContext]="{ node: node, depth: 1, indexPath: (i + 1).toString().padStart(2, '0') }"></ng-container>
                </ng-container>
              </div>
            </div>
            <ng-template #emptyOutline>
              <div class="nes-outline-empty"><i class="nes-icon fa fa-sitemap" aria-hidden="true"></i>No blocks yet. Add a module to build the tree.</div>
            </ng-template>
          </ng-template>
        </aside>

        <section class="nes-stage">
          <div class="nes-stage-head">
            <div>
              <h3>Email canvas</h3>
              <p>{{ previewWidth }}px viewport · {{ emailWidthCss }} email width · {{ emailDocument.body.length }} blocks</p>
            </div>
            <div class="nes-stage-actions">
              <button type="button" class="danger" (click)="clearDocument()"><i class="nes-icon fa fa-trash" aria-hidden="true"></i> Clear</button>
            </div>
          </div>

          <div class="nes-device" [style.width.px]="previewWidth">
            <div class="nes-size-bar">
              <div class="nes-mode-toggle" role="group" aria-label="Canvas mode">
                <button type="button" [class.is-active]="canvasMode === 'edit'" (click)="setCanvasMode('edit')">Edit</button>
                <button type="button" [class.is-active]="canvasMode === 'preview'" (click)="setCanvasMode('preview')">Preview</button>
              </div>
              <span>Size</span>
              <button
                type="button"
                *ngFor="let option of previewSizeOptions"
                [class.is-active]="previewWidth === option"
                (click)="setPreviewSize(option)"
              >{{ option }}</button>
            </div>
            <div class="nes-mail-meta"><span>From: {{ effectiveConfig.fromLabel || 'cms@brand.test' }}</span><span>Preview</span></div>
            <div class="nes-canvas-shell" [class.is-preview]="canvasMode === 'preview'" [style.background]="bodyBackgroundColor">
              <ng-container *ngIf="canvasMode === 'edit'; else iframePreview">
                <div
                  cdkDropList
                  #canvasList="cdkDropList"
                  [id]="rootDropListId"
                  [cdkDropListData]="emailDocument.body"
                  [cdkDropListConnectedTo]="connectedDropListIds"
                  [cdkDropListEnterPredicate]="canEnterContainerDropList"
                  [cdkDropListAutoScrollStep]="18"
                  (cdkDropListDropped)="drop($event)"
                  class="nes-canvas"
                  [style.width]="emailCanvasWidthCss"
                  [style.max-width]="emailCanvasMaxWidthCss"
                  [style.background]="emailBackgroundColor"
                >
                  <article
                    role="button"
                    tabindex="0"
                    class="nes-node"
                    [class.is-selected]="node.id === selectedNodeId"
                    [attr.data-node-id]="node.id"
                    *ngFor="let node of emailDocument.body; trackBy: trackNode"
                    cdkDrag
                    [cdkDragData]="node"
                    [cdkDragPreviewContainer]="'parent'"
                    [cdkDragStartDelay]="0"
                    (cdkDragStarted)="beginDrag()"
                    (cdkDragEnded)="endDrag()"
                    (click)="selectNode(node.id); $event.stopPropagation()"
                    (keydown.enter)="selectNode(node.id)"
                  >
                    <div class="nes-floating-tools" *ngIf="node.id === selectedNodeId && !readonly">
                      <button type="button" (click)="duplicateSelected(); $event.stopPropagation()"><i class="nes-icon fa fa-clone"></i></button>
                      <button type="button" (click)="deleteSelected(); $event.stopPropagation()"><i class="nes-icon fa fa-trash"></i></button>
                    </div>
                    <ng-container [ngTemplateOutlet]="nodePreview" [ngTemplateOutletContext]="{ node: node, nested: false }"></ng-container>
                  </article>
                  <div class="nes-empty" *ngIf="emailDocument.body.length === 0">
                    <i class="nes-icon fa fa-magic" aria-hidden="true"></i>
                    Drag blocks here to start building your email.
                  </div>
                  <div class="nes-root-drop-space" aria-hidden="true"></div>
                </div>
              </ng-container>
              <ng-template #iframePreview>
                <p class="nes-preview-help">Preview mode renders the exported HTML in an isolated iframe. Switch to Edit to change content.</p>
                <iframe
                  class="nes-preview-frame"
                  title="Email preview"
                  sandbox=""
                  [style.width.px]="previewWidth"
                  [srcdoc]="previewSrcdoc"
                ></iframe>
              </ng-template>
            </div>
          </div>
        </section>

        <aside class="nes-panel nes-properties">
          <div class="nes-panel-head">
            <h3>Properties Inspector</h3>
            <p>{{ selectedNodeId === bodyNodeId ? 'Body / Email canvas' : selectedNode ? outlineLabel(selectedNode) : 'No block selected' }}</p>
          </div>
          <ng-container *ngIf="selectedNodeId === bodyNodeId; else blockSelection">
            <div class="nes-tabs">
              <button type="button" class="is-active">Style</button>
            </div>
            <div class="nes-tab-panel">
              <label>
                Body background
                <span class="nes-color-control">
                  <input type="color" [ngModel]="colorPickerValue(bodyBackgroundColor)" (ngModelChange)="updateDocumentAttr('backgroundColor', $event)" />
                  <input [ngModel]="bodyBackgroundColor" (ngModelChange)="updateDocumentAttr('backgroundColor', $event)" placeholder="#f3f4f6" />
                </span>
              </label>
              <label>
                Email background
                <span class="nes-color-control">
                  <input type="color" [ngModel]="colorPickerValue(emailBackgroundColor)" (ngModelChange)="updateDocumentAttr('contentBackgroundColor', $event)" />
                  <input [ngModel]="emailBackgroundColor" (ngModelChange)="updateDocumentAttr('contentBackgroundColor', $event)" placeholder="#ffffff" />
                </span>
              </label>
              <div class="nes-control-row">
                <label>
                  Email width
                  <span class="nes-unit-field">
                    <input type="number" min="1" [ngModel]="dimensionValue(documentAttrs, 'width', 600)" (ngModelChange)="updateDocumentAttr('width', +$event)" />
                    <select [ngModel]="dimensionUnit(documentAttrs, 'width', 'px')" (ngModelChange)="updateDocumentAttr('widthUnit', $event)">
                      <option *ngFor="let unit of unitOptions" [value]="unit">{{ unit }}</option>
                    </select>
                  </span>
                </label>
                <label>
                  Email max width
                  <span class="nes-unit-field">
                    <input type="number" min="1" [ngModel]="dimensionValue(documentAttrs, 'maxWidth', 100)" (ngModelChange)="updateDocumentAttr('maxWidth', +$event)" />
                    <select [ngModel]="dimensionUnit(documentAttrs, 'maxWidth', '%')" (ngModelChange)="updateDocumentAttr('maxWidthUnit', $event)">
                      <option *ngFor="let unit of unitOptions" [value]="unit">{{ unit }}</option>
                    </select>
                  </span>
                </label>
              </div>
              <p class="nes-muted">Controls the exported <code>&lt;mj-body&gt;</code>, HTML table width, and max-width separately.</p>
            </div>
          </ng-container>
          <ng-template #blockSelection>
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

              <p *ngIf="node.type === 'row' || node.type === 'column' || node.type === 'section'" class="nes-muted">Drag Content modules from the left into this container; the red insertion line shows the exact position.</p>

              <div *ngIf="node.type === 'text'" class="nes-rich-text-field">
                <span class="nes-field-heading">
                  Rich text
                  <button type="button" class="nes-expand-editor" (click)="openRichTextModal(node); $event.stopPropagation()">
                    <i class="nes-icon fa fa-expand" aria-hidden="true"></i> Open editor
                  </button>
                </span>
                <ng-container [ngSwitch]="resolvedRichTextEditor">
                  <div *ngSwitchCase="'tiptap'" class="nes-tiptap-shell" [attr.data-tiptap-host]="node.id">
                    <div class="nes-tiptap-toolbar" role="toolbar" aria-label="Rich text formatting">
                      <div class="nes-tiptap-group">
                        <select aria-label="Block format" [ngModel]="currentTiptapBlockFormat('inline')" (mousedown)="$event.stopPropagation()" (ngModelChange)="setTiptapBlockFormat('inline', $event)">
                          <option *ngFor="let option of tiptapBlockOptions" [value]="option.value">{{ option.label }}</option>
                        </select>
                        <button type="button" (mousedown)="$event.preventDefault()" class="nes-tiptap-icon-btn" aria-label="Undo" title="Undo" [disabled]="!canRunTiptapCommand('inline', 'undo')" (click)="runTiptapCommand('inline', 'undo')"><i class="nes-icon fa fa-undo" aria-hidden="true"></i></button>
                        <button type="button" class="nes-tiptap-icon-btn" aria-label="Redo" title="Redo" (mousedown)="$event.preventDefault()" [disabled]="!canRunTiptapCommand('inline', 'redo')" (click)="runTiptapCommand('inline', 'redo')"><i class="nes-icon fa fa-repeat" aria-hidden="true"></i></button>
                      </div>
                      <div class="nes-tiptap-group">
                        <button type="button" class="nes-tiptap-icon-btn" aria-label="Bold" title="Bold" (mousedown)="$event.preventDefault()" [class.is-active]="isTiptapActive('inline', 'bold')" (click)="runTiptapCommand('inline', 'bold')"><i class="nes-icon fa fa-bold" aria-hidden="true"></i></button>
                        <button type="button" class="nes-tiptap-icon-btn" aria-label="Italic" title="Italic" (mousedown)="$event.preventDefault()" [class.is-active]="isTiptapActive('inline', 'italic')" (click)="runTiptapCommand('inline', 'italic')"><i class="nes-icon fa fa-italic" aria-hidden="true"></i></button>
                        <button type="button" class="nes-tiptap-icon-btn" aria-label="Underline" title="Underline" (mousedown)="$event.preventDefault()" [class.is-active]="isTiptapActive('inline', 'underline')" (click)="runTiptapCommand('inline', 'underline')"><i class="nes-icon fa fa-underline" aria-hidden="true"></i></button>
                        <button type="button" class="nes-tiptap-icon-btn" aria-label="Strikethrough" title="Strikethrough" (mousedown)="$event.preventDefault()" [class.is-active]="isTiptapActive('inline', 'strike')" (click)="runTiptapCommand('inline', 'strike')"><i class="nes-icon fa fa-strikethrough" aria-hidden="true"></i></button>
                        <button type="button" class="nes-tiptap-icon-btn" aria-label="Clear formatting" title="Clear formatting" (mousedown)="$event.preventDefault()" (click)="runTiptapCommand('inline', 'clearFormatting')"><i class="nes-icon fa fa-eraser" aria-hidden="true"></i></button>
                      </div>
                      <span class="nes-tiptap-row-break" aria-hidden="true"></span>
                      <div class="nes-tiptap-group">
                        <select aria-label="Font size" [ngModel]="currentTiptapFontSize('inline')" (mousedown)="$event.stopPropagation()" (ngModelChange)="setTiptapFontSize('inline', $event)">
                          <option value="">Size</option>
                          <option *ngFor="let size of tiptapFontSizeOptions" [value]="size">{{ size }}</option>
                        </select>
                        <select aria-label="Line height" [ngModel]="currentTiptapLineHeight('inline')" (mousedown)="$event.stopPropagation()" (ngModelChange)="setTiptapLineHeight('inline', $event)">
                          <option value="">Line</option>
                          <option *ngFor="let lineHeight of tiptapLineHeightOptions" [value]="lineHeight">{{ lineHeight }}</option>
                        </select>
                      </div>
                      <div class="nes-tiptap-group">
                        <button type="button" class="nes-tiptap-icon-btn" aria-label="Bullet list" title="Bullet list" (mousedown)="$event.preventDefault()" [class.is-active]="isTiptapActive('inline', 'bulletList')" (click)="runTiptapCommand('inline', 'bulletList')"><i class="nes-icon fa fa-list-ul" aria-hidden="true"></i></button>
                        <button type="button" class="nes-tiptap-icon-btn" aria-label="Ordered list" title="Ordered list" (mousedown)="$event.preventDefault()" [class.is-active]="isTiptapActive('inline', 'orderedList')" (click)="runTiptapCommand('inline', 'orderedList')"><i class="nes-icon fa fa-list-ol" aria-hidden="true"></i></button>
                        <button type="button" class="nes-tiptap-icon-btn" aria-label="Outdent" title="Outdent" (mousedown)="$event.preventDefault()" (click)="runTiptapCommand('inline', 'liftListItem')"><i class="nes-icon fa fa-outdent" aria-hidden="true"></i></button>
                        <button type="button" class="nes-tiptap-icon-btn" aria-label="Indent" title="Indent" (mousedown)="$event.preventDefault()" (click)="runTiptapCommand('inline', 'sinkListItem')"><i class="nes-icon fa fa-indent" aria-hidden="true"></i></button>
                      </div>
                      <div class="nes-tiptap-group">
                        <button type="button" class="nes-tiptap-icon-btn" aria-label="Align left" title="Align left" (mousedown)="$event.preventDefault()" [class.is-active]="isTiptapTextAlignActive('inline', 'left')" (click)="setTiptapTextAlign('inline', 'left')"><i class="nes-icon fa fa-align-left" aria-hidden="true"></i></button>
                        <button type="button" class="nes-tiptap-icon-btn" aria-label="Align center" title="Align center" (mousedown)="$event.preventDefault()" [class.is-active]="isTiptapTextAlignActive('inline', 'center')" (click)="setTiptapTextAlign('inline', 'center')"><i class="nes-icon fa fa-align-center" aria-hidden="true"></i></button>
                        <button type="button" class="nes-tiptap-icon-btn" aria-label="Align right" title="Align right" (mousedown)="$event.preventDefault()" [class.is-active]="isTiptapTextAlignActive('inline', 'right')" (click)="setTiptapTextAlign('inline', 'right')"><i class="nes-icon fa fa-align-right" aria-hidden="true"></i></button>
                        <button type="button" class="nes-tiptap-icon-btn" aria-label="Justify" title="Justify" (mousedown)="$event.preventDefault()" [class.is-active]="isTiptapTextAlignActive('inline', 'justify')" (click)="setTiptapTextAlign('inline', 'justify')"><i class="nes-icon fa fa-align-justify" aria-hidden="true"></i></button>
                      </div>
                      <div class="nes-tiptap-group">
                        <button type="button" class="nes-tiptap-icon-btn" aria-label="Add link" title="Add link" (mousedown)="$event.preventDefault()" (click)="runTiptapCommand('inline', 'link')"><i class="nes-icon fa fa-link" aria-hidden="true"></i></button>
                        <button type="button" class="nes-tiptap-icon-btn" aria-label="Remove link" title="Remove link" (mousedown)="$event.preventDefault()" (click)="runTiptapCommand('inline', 'unlink')"><i class="nes-icon fa fa-unlink" aria-hidden="true"></i></button>
                        <button type="button" class="nes-tiptap-icon-btn nes-tiptap-source-btn" aria-label="Edit HTML source" title="Edit HTML source" (mousedown)="$event.preventDefault()" (click)="openRichTextSource('inline')"><i class="nes-icon fa fa-code" aria-hidden="true"></i></button>
                      </div>
                      <span class="nes-tiptap-row-break" aria-hidden="true"></span>
                      <div class="nes-tiptap-group nes-tiptap-table-group">
                        <button type="button" class="nes-tiptap-table-btn" (mousedown)="$event.preventDefault()" (click)="insertTiptapTable('inline', 3, 3)"><i class="nes-icon fa fa-table" aria-hidden="true"></i><span>Table</span></button>
                        <button type="button" class="nes-tiptap-chip-btn" aria-label="Insert 2 by 2 table" (mousedown)="$event.preventDefault()" (click)="insertTiptapTable('inline', 2, 2)">2×2</button>
                        <button type="button" class="nes-tiptap-chip-btn" aria-label="Insert 3 by 3 table" (mousedown)="$event.preventDefault()" (click)="insertTiptapTable('inline', 3, 3)">3×3</button>
                        <button type="button" class="nes-tiptap-chip-btn" aria-label="Insert 4 by 4 table" (mousedown)="$event.preventDefault()" (click)="insertTiptapTable('inline', 4, 4)">4×4</button>
                        <button type="button" class="nes-tiptap-chip-btn" aria-label="Add column" title="Add column" (mousedown)="$event.preventDefault()" (click)="runTiptapCommand('inline', 'addColumnAfter')">+ Col</button>
                        <button type="button" class="nes-tiptap-chip-btn" aria-label="Add row" title="Add row" (mousedown)="$event.preventDefault()" (click)="runTiptapCommand('inline', 'addRowAfter')">+ Row</button>
                        <button type="button" class="nes-tiptap-chip-btn nes-tiptap-danger-btn" aria-label="Delete column" title="Delete column" (mousedown)="$event.preventDefault()" (click)="runTiptapCommand('inline', 'deleteColumn')">− Col</button>
                        <button type="button" class="nes-tiptap-chip-btn nes-tiptap-danger-btn" aria-label="Delete row" title="Delete row" (mousedown)="$event.preventDefault()" (click)="runTiptapCommand('inline', 'deleteRow')">− Row</button>
                        <button type="button" class="nes-tiptap-icon-btn nes-tiptap-danger-btn" aria-label="Delete table" title="Delete table" (mousedown)="$event.preventDefault()" (click)="runTiptapCommand('inline', 'deleteTable')"><i class="nes-icon fa fa-trash" aria-hidden="true"></i></button>
                      </div>
                    </div>
                    <div class="nes-tiptap-editor" [attr.data-tiptap-editor]="node.id" (mousedown)="guardTiptapBlankMouseDown($event, 'inline')" (click)="$event.stopPropagation()"></div>
                  </div>
                  <textarea *ngSwitchDefault [ngModel]="node.attrs['content']" (ngModelChange)="updateAttr(node, 'content', $event)"></textarea>
                </ng-container>
              </div>

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
              <ng-container *ngIf="node.type === 'column'">
                <div class="nes-control-row">
                  <label>
                    Column width
                    <span class="nes-unit-field">
                      <input type="number" min="1" [ngModel]="dimensionValue(node.attrs, 'width', 100)" (ngModelChange)="updateAttr(node, 'width', +$event)" />
                      <select [ngModel]="dimensionUnit(node.attrs, 'width', '%')" (ngModelChange)="updateAttr(node, 'widthUnit', $event)">
                        <option *ngFor="let unit of unitOptions" [value]="unit">{{ unit }}</option>
                      </select>
                    </span>
                  </label>
                  <label>
                    Column max width
                    <span class="nes-unit-field">
                      <input type="number" min="1" [ngModel]="dimensionValue(node.attrs, 'maxWidth', 600)" (ngModelChange)="updateAttr(node, 'maxWidth', +$event)" />
                      <select [ngModel]="dimensionUnit(node.attrs, 'maxWidth', 'px')" (ngModelChange)="updateAttr(node, 'maxWidthUnit', $event)">
                        <option *ngFor="let unit of unitOptions" [value]="unit">{{ unit }}</option>
                      </select>
                    </span>
                  </label>
                </div>
              </ng-container>
              <ng-container *ngIf="node.type === 'section'">
                <div class="nes-control-row">
                  <label>
                    Section width
                    <span class="nes-unit-field">
                      <input type="number" min="1" [ngModel]="dimensionValue(node.attrs, 'width', 100)" (ngModelChange)="updateAttr(node, 'width', +$event)" />
                      <select [ngModel]="dimensionUnit(node.attrs, 'width', '%')" (ngModelChange)="updateAttr(node, 'widthUnit', $event)">
                        <option *ngFor="let unit of unitOptions" [value]="unit">{{ unit }}</option>
                      </select>
                    </span>
                  </label>
                  <label>
                    Section max width
                    <span class="nes-unit-field">
                      <input type="number" min="1" [ngModel]="dimensionValue(node.attrs, 'maxWidth', 600)" (ngModelChange)="updateAttr(node, 'maxWidth', +$event)" />
                      <select [ngModel]="dimensionUnit(node.attrs, 'maxWidth', 'px')" (ngModelChange)="updateAttr(node, 'maxWidthUnit', $event)">
                        <option *ngFor="let unit of unitOptions" [value]="unit">{{ unit }}</option>
                      </select>
                    </span>
                  </label>
                </div>
                <div class="nes-padding-control">
                  <div class="nes-control-heading">Section padding</div>
                  <div class="nes-control-row">
                    <label>
                      All
                      <span class="nes-unit-field">
                        <input type="number" min="0" [ngModel]="paddingValue(node, 'padding')" (ngModelChange)="updateSectionPaddingAll(node, +$event)" />
                        <select [ngModel]="paddingUnit(node)" (ngModelChange)="updateAttr(node, 'paddingUnit', $event)">
                          <option *ngFor="let unit of unitOptions" [value]="unit">{{ unit }}</option>
                        </select>
                      </span>
                    </label>
                  </div>
                  <div class="nes-padding-grid">
                    <label>Top<input type="number" min="0" [ngModel]="paddingValue(node, 'paddingTop')" (ngModelChange)="updateSectionPaddingSide(node, 'paddingTop', +$event)" /></label>
                    <label>Right<input type="number" min="0" [ngModel]="paddingValue(node, 'paddingRight')" (ngModelChange)="updateSectionPaddingSide(node, 'paddingRight', +$event)" /></label>
                    <label>Bottom<input type="number" min="0" [ngModel]="paddingValue(node, 'paddingBottom')" (ngModelChange)="updateSectionPaddingSide(node, 'paddingBottom', +$event)" /></label>
                    <label>Left<input type="number" min="0" [ngModel]="paddingValue(node, 'paddingLeft')" (ngModelChange)="updateSectionPaddingSide(node, 'paddingLeft', +$event)" /></label>
                  </div>
                </div>
              </ng-container>
              <div class="nes-field-block" *ngIf="isAlignableContent(node)">
                <div class="nes-control-heading">Content alignment</div>
                <div class="nes-align-group" role="group" aria-label="Content alignment">
                  <button type="button" [class.is-active]="contentAlign(node) === 'left'" (click)="updateAttr(node, 'align', 'left')">Left</button>
                  <button type="button" [class.is-active]="contentAlign(node) === 'center'" (click)="updateAttr(node, 'align', 'center')">Center</button>
                  <button type="button" [class.is-active]="contentAlign(node) === 'right'" (click)="updateAttr(node, 'align', 'right')">Right</button>
                </div>
              </div>
              <label *ngIf="node.type !== 'divider' && node.type !== 'spacer'">
                Background color
                <span class="nes-color-control">
                  <input type="color" [ngModel]="colorPickerValue(node.attrs['backgroundColor'] || '#ffffff')" (ngModelChange)="updateAttr(node, 'backgroundColor', $event)" />
                  <input [ngModel]="node.attrs['backgroundColor']" (ngModelChange)="updateAttr(node, 'backgroundColor', $event)" placeholder="#ffffff" />
                </span>
              </label>
              <label *ngIf="node.type === 'divider'">
                Border color
                <span class="nes-color-control">
                  <input type="color" [ngModel]="colorPickerValue(node.attrs['borderColor'] || '#d0d5dd')" (ngModelChange)="updateAttr(node, 'borderColor', $event)" />
                  <input [ngModel]="node.attrs['borderColor']" (ngModelChange)="updateAttr(node, 'borderColor', $event)" placeholder="#d0d5dd" />
                </span>
              </label>
            </div>

            <div class="nes-tab-panel" *ngIf="activeInspectorTab === 'check'">
              <div class="nes-check-card" *ngIf="emailDocument.unsupported?.length; else checksOk">
                Unsupported MJML: {{ emailDocument.unsupported?.join(', ') }}
              </div>
              <ng-template #checksOk>
                <div class="nes-check-card is-ok"><i class="nes-icon fa fa-check-circle"></i> No blocking issues for this supported subset.</div>
              </ng-template>
            </div>
          </ng-container>
          </ng-template>
          <ng-template #noSelection>
            <p class="nes-muted">Select a block to edit its properties.</p>
          </ng-template>
        </aside>
      </main>

      <div class="nes-modal-backdrop" *ngIf="importModalOpen" (click)="closeImportModal()">
        <section class="nes-import-modal" role="dialog" aria-modal="true" aria-label="Import MJML" (click)="$event.stopPropagation()">
          <header>
            <div class="nes-modal-heading">
              <span class="nes-modal-icon"><i class="nes-icon fa fa-upload" aria-hidden="true"></i></span>
              <div>
                <p>Import MJML</p>
                <h3>Paste MJML to import</h3>
              </div>
            </div>
            <button type="button" aria-label="Close import modal" (click)="closeImportModal()"><i class="nes-icon fa fa-times" aria-hidden="true"></i></button>
          </header>
          <div class="nes-import-body">
            <div class="nes-modal-intro">
              <strong>Supported import subset</strong>
              <p class="nes-muted">Rows, columns, text, images, buttons, dividers, and spacers will be converted into editable blocks.</p>
            </div>
            <div class="nes-code-shell">
              <div class="nes-code-toolbar">
                <span><i class="nes-icon fa fa-code" aria-hidden="true"></i> MJML source</span>
                <small>Editable</small>
              </div>
              <textarea [ngModel]="mjmlDraft" (ngModelChange)="mjmlDraft = $event" spellcheck="false" placeholder="<mjml>...</mjml>"></textarea>
            </div>
            <div class="nes-import-error" *ngIf="importErrorMessage"><i class="nes-icon fa fa-exclamation-triangle" aria-hidden="true"></i> {{ importErrorMessage }}</div>
          </div>
          <footer class="nes-modal-footer">
            <button type="button" (click)="closeImportModal()">Cancel</button>
            <button type="button" class="nes-primary" (click)="importMjml()"><i class="nes-icon fa fa-check" aria-hidden="true"></i> Import MJML</button>
          </footer>
        </section>
      </div>

      <div class="nes-modal-backdrop" *ngIf="expandedRichTextNode" (click)="closeRichTextModal()">
        <section class="nes-rich-text-modal" role="dialog" aria-modal="true" aria-label="Rich text editor" (click)="$event.stopPropagation()">
          <header>
            <div class="nes-modal-heading">
              <span class="nes-modal-icon"><i class="nes-icon fa fa-pencil-square-o" aria-hidden="true"></i></span>
              <div>
                <p>Rich text</p>
                <h3>Large editing canvas</h3>
              </div>
            </div>
            <button type="button" aria-label="Close rich text editor" (click)="closeRichTextModal()"><i class="nes-icon fa fa-times" aria-hidden="true"></i></button>
          </header>
          <div class="nes-rich-text-modal-body" *ngIf="expandedRichTextNode as richTextNode">
            <ng-container [ngSwitch]="resolvedRichTextEditor">
              <div *ngSwitchCase="'tiptap'" class="nes-tiptap-shell nes-tiptap-shell-large" [attr.data-tiptap-modal-host]="richTextNode.id">
                <div class="nes-tiptap-toolbar" role="toolbar" aria-label="Rich text formatting">
                  <div class="nes-tiptap-group">
                    <select aria-label="Block format" [ngModel]="currentTiptapBlockFormat('modal')" (mousedown)="$event.stopPropagation()" (ngModelChange)="setTiptapBlockFormat('modal', $event)">
                      <option *ngFor="let option of tiptapBlockOptions" [value]="option.value">{{ option.label }}</option>
                    </select>
                    <button type="button" class="nes-tiptap-icon-btn" aria-label="Undo" title="Undo" (mousedown)="$event.preventDefault()" [disabled]="!canRunTiptapCommand('modal', 'undo')" (click)="runTiptapCommand('modal', 'undo')"><i class="nes-icon fa fa-undo" aria-hidden="true"></i></button>
                    <button type="button" class="nes-tiptap-icon-btn" aria-label="Redo" title="Redo" (mousedown)="$event.preventDefault()" [disabled]="!canRunTiptapCommand('modal', 'redo')" (click)="runTiptapCommand('modal', 'redo')"><i class="nes-icon fa fa-repeat" aria-hidden="true"></i></button>
                  </div>
                  <div class="nes-tiptap-group">
                    <button type="button" class="nes-tiptap-icon-btn" aria-label="Bold" title="Bold" (mousedown)="$event.preventDefault()" [class.is-active]="isTiptapActive('modal', 'bold')" (click)="runTiptapCommand('modal', 'bold')"><i class="nes-icon fa fa-bold" aria-hidden="true"></i></button>
                    <button type="button" class="nes-tiptap-icon-btn" aria-label="Italic" title="Italic" (mousedown)="$event.preventDefault()" [class.is-active]="isTiptapActive('modal', 'italic')" (click)="runTiptapCommand('modal', 'italic')"><i class="nes-icon fa fa-italic" aria-hidden="true"></i></button>
                    <button type="button" class="nes-tiptap-icon-btn" aria-label="Underline" title="Underline" (mousedown)="$event.preventDefault()" [class.is-active]="isTiptapActive('modal', 'underline')" (click)="runTiptapCommand('modal', 'underline')"><i class="nes-icon fa fa-underline" aria-hidden="true"></i></button>
                    <button type="button" class="nes-tiptap-icon-btn" aria-label="Strikethrough" title="Strikethrough" (mousedown)="$event.preventDefault()" [class.is-active]="isTiptapActive('modal', 'strike')" (click)="runTiptapCommand('modal', 'strike')"><i class="nes-icon fa fa-strikethrough" aria-hidden="true"></i></button>
                    <button type="button" class="nes-tiptap-icon-btn" aria-label="Clear formatting" title="Clear formatting" (mousedown)="$event.preventDefault()" (click)="runTiptapCommand('modal', 'clearFormatting')"><i class="nes-icon fa fa-eraser" aria-hidden="true"></i></button>
                  </div>
                  <span class="nes-tiptap-row-break" aria-hidden="true"></span>
                  <div class="nes-tiptap-group">
                    <select aria-label="Font size" [ngModel]="currentTiptapFontSize('modal')" (mousedown)="$event.stopPropagation()" (ngModelChange)="setTiptapFontSize('modal', $event)">
                      <option value="">Size</option>
                      <option *ngFor="let size of tiptapFontSizeOptions" [value]="size">{{ size }}</option>
                    </select>
                    <select aria-label="Line height" [ngModel]="currentTiptapLineHeight('modal')" (mousedown)="$event.stopPropagation()" (ngModelChange)="setTiptapLineHeight('modal', $event)">
                      <option value="">Line</option>
                      <option *ngFor="let lineHeight of tiptapLineHeightOptions" [value]="lineHeight">{{ lineHeight }}</option>
                    </select>
                  </div>
                  <div class="nes-tiptap-group">
                    <button type="button" class="nes-tiptap-icon-btn" aria-label="Bullet list" title="Bullet list" (mousedown)="$event.preventDefault()" [class.is-active]="isTiptapActive('modal', 'bulletList')" (click)="runTiptapCommand('modal', 'bulletList')"><i class="nes-icon fa fa-list-ul" aria-hidden="true"></i></button>
                    <button type="button" class="nes-tiptap-icon-btn" aria-label="Ordered list" title="Ordered list" (mousedown)="$event.preventDefault()" [class.is-active]="isTiptapActive('modal', 'orderedList')" (click)="runTiptapCommand('modal', 'orderedList')"><i class="nes-icon fa fa-list-ol" aria-hidden="true"></i></button>
                    <button type="button" class="nes-tiptap-icon-btn" aria-label="Outdent" title="Outdent" (mousedown)="$event.preventDefault()" (click)="runTiptapCommand('modal', 'liftListItem')"><i class="nes-icon fa fa-outdent" aria-hidden="true"></i></button>
                    <button type="button" class="nes-tiptap-icon-btn" aria-label="Indent" title="Indent" (mousedown)="$event.preventDefault()" (click)="runTiptapCommand('modal', 'sinkListItem')"><i class="nes-icon fa fa-indent" aria-hidden="true"></i></button>
                  </div>
                  <div class="nes-tiptap-group">
                    <button type="button" class="nes-tiptap-icon-btn" aria-label="Align left" title="Align left" (mousedown)="$event.preventDefault()" [class.is-active]="isTiptapTextAlignActive('modal', 'left')" (click)="setTiptapTextAlign('modal', 'left')"><i class="nes-icon fa fa-align-left" aria-hidden="true"></i></button>
                    <button type="button" class="nes-tiptap-icon-btn" aria-label="Align center" title="Align center" (mousedown)="$event.preventDefault()" [class.is-active]="isTiptapTextAlignActive('modal', 'center')" (click)="setTiptapTextAlign('modal', 'center')"><i class="nes-icon fa fa-align-center" aria-hidden="true"></i></button>
                    <button type="button" class="nes-tiptap-icon-btn" aria-label="Align right" title="Align right" (mousedown)="$event.preventDefault()" [class.is-active]="isTiptapTextAlignActive('modal', 'right')" (click)="setTiptapTextAlign('modal', 'right')"><i class="nes-icon fa fa-align-right" aria-hidden="true"></i></button>
                    <button type="button" class="nes-tiptap-icon-btn" aria-label="Justify" title="Justify" (mousedown)="$event.preventDefault()" [class.is-active]="isTiptapTextAlignActive('modal', 'justify')" (click)="setTiptapTextAlign('modal', 'justify')"><i class="nes-icon fa fa-align-justify" aria-hidden="true"></i></button>
                  </div>
                  <div class="nes-tiptap-group">
                    <button type="button" class="nes-tiptap-icon-btn" aria-label="Add link" title="Add link" (mousedown)="$event.preventDefault()" (click)="runTiptapCommand('modal', 'link')"><i class="nes-icon fa fa-link" aria-hidden="true"></i></button>
                    <button type="button" class="nes-tiptap-icon-btn" aria-label="Remove link" title="Remove link" (mousedown)="$event.preventDefault()" (click)="runTiptapCommand('modal', 'unlink')"><i class="nes-icon fa fa-unlink" aria-hidden="true"></i></button>
                    <button type="button" class="nes-tiptap-icon-btn nes-tiptap-source-btn" aria-label="Edit HTML source" title="Edit HTML source" (mousedown)="$event.preventDefault()" (click)="openRichTextSource('modal')"><i class="nes-icon fa fa-code" aria-hidden="true"></i></button>
                  </div>
                  <span class="nes-tiptap-row-break" aria-hidden="true"></span>
                  <div class="nes-tiptap-group nes-tiptap-table-group">
                    <button type="button" class="nes-tiptap-table-btn" (mousedown)="$event.preventDefault()" (click)="insertTiptapTable('modal', 3, 3)"><i class="nes-icon fa fa-table" aria-hidden="true"></i><span>Table</span></button>
                    <button type="button" class="nes-tiptap-chip-btn" aria-label="Insert 2 by 2 table" (mousedown)="$event.preventDefault()" (click)="insertTiptapTable('modal', 2, 2)">2×2</button>
                    <button type="button" class="nes-tiptap-chip-btn" aria-label="Insert 3 by 3 table" (mousedown)="$event.preventDefault()" (click)="insertTiptapTable('modal', 3, 3)">3×3</button>
                    <button type="button" class="nes-tiptap-chip-btn" aria-label="Insert 4 by 4 table" (mousedown)="$event.preventDefault()" (click)="insertTiptapTable('modal', 4, 4)">4×4</button>
                    <button type="button" class="nes-tiptap-chip-btn" aria-label="Add column" title="Add column" (mousedown)="$event.preventDefault()" (click)="runTiptapCommand('modal', 'addColumnAfter')">+ Col</button>
                    <button type="button" class="nes-tiptap-chip-btn" aria-label="Add row" title="Add row" (mousedown)="$event.preventDefault()" (click)="runTiptapCommand('modal', 'addRowAfter')">+ Row</button>
                    <button type="button" class="nes-tiptap-chip-btn nes-tiptap-danger-btn" aria-label="Delete column" title="Delete column" (mousedown)="$event.preventDefault()" (click)="runTiptapCommand('modal', 'deleteColumn')">− Col</button>
                    <button type="button" class="nes-tiptap-chip-btn nes-tiptap-danger-btn" aria-label="Delete row" title="Delete row" (mousedown)="$event.preventDefault()" (click)="runTiptapCommand('modal', 'deleteRow')">− Row</button>
                    <button type="button" class="nes-tiptap-icon-btn nes-tiptap-danger-btn" aria-label="Delete table" title="Delete table" (mousedown)="$event.preventDefault()" (click)="runTiptapCommand('modal', 'deleteTable')"><i class="nes-icon fa fa-trash" aria-hidden="true"></i></button>
                  </div>
                </div>
                <div class="nes-tiptap-editor nes-tiptap-editor-large" [attr.data-tiptap-modal-editor]="richTextNode.id" (mousedown)="guardTiptapBlankMouseDown($event, 'modal')" (click)="$event.stopPropagation()"></div>
              </div>
              <textarea *ngSwitchDefault [ngModel]="richTextNode.attrs['content']" (ngModelChange)="updateExpandedRichText($event)"></textarea>
            </ng-container>
          </div>
        </section>
      </div>

      <div class="nes-modal-backdrop" *ngIf="sourceEditorScope" (click)="closeRichTextSource()">
        <section class="nes-source-modal" role="dialog" aria-modal="true" aria-label="Rich text source code" (click)="$event.stopPropagation()">
          <header>
            <div class="nes-modal-heading">
              <span class="nes-modal-icon"><i class="nes-icon fa fa-code" aria-hidden="true"></i></span>
              <div>
                <p>Source code</p>
                <h3>Edit rich text HTML</h3>
              </div>
            </div>
            <button type="button" aria-label="Close source editor" (click)="closeRichTextSource()"><i class="nes-icon fa fa-times" aria-hidden="true"></i></button>
          </header>
          <div class="nes-source-body">
            <p class="nes-muted">Edit the selected text block HTML. Unsafe or unsupported markup is removed when applied.</p>
            <div class="nes-code-shell">
              <div class="nes-code-toolbar">
                <span><i class="nes-icon fa fa-code" aria-hidden="true"></i> HTML source</span>
                <small>Editable</small>
              </div>
              <textarea [ngModel]="sourceEditorValue" (ngModelChange)="sourceEditorValue = $event" spellcheck="false" placeholder="<p>Your content...</p>"></textarea>
            </div>
            <div class="nes-import-error" *ngIf="sourceEditorWarning"><i class="nes-icon fa fa-exclamation-triangle" aria-hidden="true"></i> {{ sourceEditorWarning }}</div>
          </div>
          <footer class="nes-modal-footer">
            <button type="button" (click)="closeRichTextSource()">Cancel</button>
            <button type="button" class="nes-primary" (click)="applyRichTextSource()"><i class="nes-icon fa fa-check" aria-hidden="true"></i> Apply source</button>
          </footer>
        </section>
      </div>

      <div class="nes-modal-backdrop" *ngIf="outputModalType" (click)="closeOutputModal()">
        <section class="nes-output-modal" role="dialog" aria-modal="true" [attr.aria-label]="outputModalTitle" (click)="$event.stopPropagation()">
          <header>
            <div class="nes-modal-heading">
              <span class="nes-modal-icon"><i class="nes-icon fa fa-download" aria-hidden="true"></i></span>
              <div>
                <p>Export output</p>
                <h3>{{ outputModalTitle }}</h3>
              </div>
            </div>
            <div class="nes-modal-actions">
              <button type="button" class="nes-preview-btn" *ngIf="outputModalType === 'html'" (click)="previewHtmlOutput()"><i class="nes-icon fa fa-external-link" aria-hidden="true"></i> Preview</button>
              <button type="button" class="nes-copy-btn" (click)="copyOutputToClipboard()"><i class="nes-icon fa fa-copy" aria-hidden="true"></i> {{ copyState || 'Copy' }}</button>
              <button type="button" aria-label="Close export modal" (click)="closeOutputModal()"><i class="nes-icon fa fa-times" aria-hidden="true"></i></button>
            </div>
          </header>
          <div *ngIf="emailDocument.unsupported?.length" class="nes-warning">
            Unsupported MJML preserved as warning: {{ emailDocument.unsupported?.join(', ') }}
          </div>
          <div class="nes-code-shell nes-output-code">
            <div class="nes-code-toolbar">
              <span><i class="nes-icon fa fa-code" aria-hidden="true"></i> {{ outputModalType === 'html' ? 'Generated HTML' : 'Generated MJML' }}</span>
              <small>Read-only</small>
            </div>
            <pre>{{ outputModalContent }}</pre>
          </div>
        </section>
      </div>
    </section>

    <ng-template #outlineTreeNode let-node="node" let-depth="depth" let-indexPath="indexPath">
      <div class="nes-outline-item">
        <button
          type="button"
          class="nes-outline-node"
          role="treeitem"
          [attr.aria-selected]="node.id === selectedNodeId"
          [class.is-active]="node.id === selectedNodeId"
          [style.padding-left.px]="12 + depth * 18"
          (click)="selectNodeFromOutline(node.id)"
        >
          <span class="nes-outline-rail" aria-hidden="true"></span>
          <span class="nes-outline-icon"><i class="nes-icon fa" [class]="'nes-icon fa ' + outlineIcon(node)" aria-hidden="true"></i></span>
          <span class="nes-outline-copy">
            <strong>{{ outlineLabel(node) }}</strong>
            <small>{{ outlineMeta(node) }}</small>
          </span>
          <span class="nes-outline-index">{{ indexPath }}</span>
        </button>
        <div class="nes-outline-children" role="group" *ngIf="node.children?.length">
          <ng-container *ngFor="let child of node.children; let childIndex = index; trackBy: trackNode">
            <ng-container [ngTemplateOutlet]="outlineTreeNode" [ngTemplateOutletContext]="{ node: child, depth: depth + 1, indexPath: indexPath + '.' + (childIndex + 1) }"></ng-container>
          </ng-container>
        </div>
      </div>
    </ng-template>

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
            [cdkDropListEnterPredicate]="canEnterContainerDropList"
            [cdkDropListAutoScrollStep]="18"
            (cdkDropListDropped)="drop($event)"
            [style.width]="columnWidthCss(column, dimensionValueFromCss(autoColumnWidth(node)), dimensionUnitFromCss(autoColumnWidth(node)))"
            [style.max-width]="columnMaxWidthCss(column)"
            [attr.data-node-id]="column.id"
            [class.is-selected]="column.id === selectedNodeId"
            [class.is-empty]="childrenOf(column).length === 0"
            (click)="selectNode(column.id); $event.stopPropagation()"
          >
            <div class="nes-column-label">Column {{ columnIndex + 1 }}</div>
            <div class="nes-drop-hit-pad" aria-hidden="true"></div>
            <article
              role="button"
              tabindex="0"
              class="nes-child-node"
              [class.is-selected]="child.id === selectedNodeId"
              [attr.data-node-id]="child.id"
              *ngFor="let child of childrenOf(column); trackBy: trackNode"
              cdkDrag
              [cdkDragData]="child"
              [cdkDragPreviewContainer]="'parent'"
              [cdkDragStartDelay]="0"
              (cdkDragStarted)="beginDrag()"
              (cdkDragEnded)="endDrag()"
              (click)="selectNode(child.id); $event.stopPropagation()"
              (keydown.enter)="selectNode(child.id)"
            >
              <div class="nes-floating-tools" *ngIf="child.id === selectedNodeId && !readonly">
                <button type="button" (click)="duplicateSelected(); $event.stopPropagation()"><i class="nes-icon fa fa-clone"></i></button>
                <button type="button" (click)="deleteSelected(); $event.stopPropagation()"><i class="nes-icon fa fa-trash"></i></button>
              </div>
              <ng-container [ngTemplateOutlet]="nodePreview" [ngTemplateOutletContext]="{ node: child, nested: true }"></ng-container>
            </article>
            <div class="nes-drop-hit-pad" aria-hidden="true"></div>
            <div class="nes-empty-container-note" *ngIf="childrenOf(column).length === 0">Empty column</div>
          </div>
        </section>
        <div *ngSwitchCase="'column'" class="nes-render-column-alone">Column</div>
        <section
          *ngSwitchCase="'section'"
          cdkDropList
          class="nes-render-section"
          [id]="dropListIdFor(node)"
          [style.background]="node.attrs['backgroundColor'] || '#ffffff'"
          [style.width]="sectionWidthCss(node)"
          [style.max-width]="sectionMaxWidthCss(node)"
          [style.padding]="sectionPaddingCss(node)"
          [attr.data-node-id]="node.id"
          [cdkDropListData]="childrenOf(node)"
          [cdkDropListConnectedTo]="connectedDropListIds"
          [cdkDropListEnterPredicate]="canEnterContainerDropList"
          [cdkDropListAutoScrollStep]="18"
          (cdkDropListDropped)="drop($event)"
          [class.is-empty]="childrenOf(node).length === 0"
        >
          <div class="nes-column-label">Section</div>
          <div class="nes-drop-hit-pad" aria-hidden="true"></div>
          <article
            role="button"
            tabindex="0"
            class="nes-child-node"
            [class.is-selected]="child.id === selectedNodeId"
            [attr.data-node-id]="child.id"
            *ngFor="let child of childrenOf(node); trackBy: trackNode"
            cdkDrag
            [cdkDragData]="child"
            [cdkDragStartDelay]="0"
            (cdkDragStarted)="beginDrag()"
            (cdkDragEnded)="endDrag()"
            (click)="selectNode(child.id); $event.stopPropagation()"
            (keydown.enter)="selectNode(child.id)"
          >
            <div class="nes-floating-tools" *ngIf="child.id === selectedNodeId && !readonly">
              <button type="button" (click)="duplicateSelected(); $event.stopPropagation()"><i class="nes-icon fa fa-clone"></i></button>
              <button type="button" (click)="deleteSelected(); $event.stopPropagation()"><i class="nes-icon fa fa-trash"></i></button>
            </div>
            <ng-container [ngTemplateOutlet]="nodePreview" [ngTemplateOutletContext]="{ node: child, nested: true }"></ng-container>
          </article>
          <div class="nes-drop-hit-pad" aria-hidden="true"></div>
          <div class="nes-empty-container-note" *ngIf="childrenOf(node).length === 0">Empty section</div>
        </section>
        <div *ngSwitchCase="'text'" class="nes-render-text" [style.text-align]="contentAlign(node)" [style.background]="backgroundFor(node)" [innerHTML]="sanitizedRichText(node.attrs['content'])"></div>
        <div *ngSwitchCase="'image'" class="nes-render-image-wrap" [style.text-align]="contentAlign(node)" [style.background]="backgroundFor(node)">
          <img class="nes-render-image" [src]="node.attrs['src']" [alt]="node.attrs['alt'] || ''" />
        </div>
        <div *ngSwitchCase="'button'" class="nes-render-button-wrap" [style.text-align]="contentAlign(node)" [style.background]="backgroundFor(node)">
          <a class="nes-render-button">{{ node.attrs['label'] }}</a>
        </div>
        <hr *ngSwitchCase="'divider'" class="nes-render-divider" />
        <div *ngSwitchCase="'spacer'" [style.height.px]="node.attrs['height'] || 24"></div>
      </ng-container>
    </ng-template>
  `,
  styleUrl: './ngx-email-studio.css',
})
export class NgxEmailStudio implements OnChanges, AfterViewInit, AfterViewChecked, OnDestroy {
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
  selectedNodeId?: string = this.emailDocument.body[0]?.children?.[0]?.id || this.emailDocument.body[0]?.id;
  mjmlDraft = '';
  paletteSearch = '';
  activeLeftTab: 'modules' | 'outline' = 'modules';
  activeInspectorTab: 'content' | 'style' | 'check' = 'content';
  canvasMode: CanvasMode = 'edit';
  exportMenuOpen = false;
  dragInProgress = false;
  importModalOpen = false;
  importErrorMessage = '';
  outputModalType: 'mjml' | 'html' | null = null;
  expandedRichTextNode?: EmailNode;
  sourceEditorScope: TiptapScope | null = null;
  sourceEditorNode: EmailNode | null = null;
  sourceEditorValue = '';
  sourceEditorWarning = '';
  copyState = '';
  private tiptapInlineEditor?: TiptapEditor;
  private tiptapInlineNodeId?: string;
  private tiptapModalEditor?: TiptapEditor;
  private tiptapModalNodeId?: string;
  private copyStateTimer: ReturnType<typeof setTimeout> | undefined;
  readonly previewSizeOptions = [1200, 800, 600, 400];
  readonly unitOptions: EmailSizeUnit[] = ['px', '%'];
  readonly tiptapBlockOptions: Array<{ label: string; value: TiptapHeadingValue }> = TIPTAP_BLOCK_OPTIONS;
  readonly tiptapFontSizeOptions = TIPTAP_FONT_SIZE_OPTIONS;
  readonly tiptapLineHeightOptions = TIPTAP_LINE_HEIGHT_OPTIONS;
  lastMjml = '';
  lastHtml = '';
  previewSrcdoc: SafeHtml | string = '';

  private readonly dropListIdPrefix = createEmailStudioInstanceId();
  readonly rootDropListId = `${this.dropListIdPrefix}-root-drop-list`;
  readonly paletteDropListId = `${this.dropListIdPrefix}-palette-drop-list`;
  readonly bodyNodeId = BODY_NODE_ID;
  readonly rejectPaletteDrop = (): boolean => false;
  readonly canEnterContainerDropList = (drag: { data: unknown }, drop: { id?: string }): boolean => this.canDropIntoContainer(drag.data, drop.id);

  constructor(private readonly hostRef: ElementRef<HTMLElement>, private readonly sanitizer: DomSanitizer) {}

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const path = event.composedPath?.() || [];
    if (!path.includes(this.hostRef.nativeElement)) this.closeTransientMenus();
  }

  @HostListener('document:keydown.escape')
  onDocumentEscape(): void {
    this.closeTransientMenus();
    if (this.outputModalType) this.closeOutputModal();
    if (this.sourceEditorScope) this.closeRichTextSource();
    if (this.importModalOpen) this.closeImportModal();
    if (this.expandedRichTextNode) this.closeRichTextModal();
  }

  ngAfterViewInit(): void {
    this.syncTiptapEditors();
  }

  ngAfterViewChecked(): void {
    this.syncTiptapEditors();
  }

  ngOnDestroy(): void {
    this.destroyTiptapEditors();
    if (this.copyStateTimer) clearTimeout(this.copyStateTimer);
  }

  get connectedDropListIds(): string[] {
    return [this.paletteDropListId, this.rootDropListId, ...this.collectContainerDropListIds(this.emailDocument.body)];
  }

  get filteredPalette(): PaletteItem[] {
    const query = this.paletteSearch.trim().toLowerCase();
    if (!query) return this.palette;
    return this.palette.filter((item) => `${item.label} ${item.description} ${item.type}`.toLowerCase().includes(query));
  }

  get selectedNode(): EmailNode | undefined {
    if (this.selectedNodeId === BODY_NODE_ID) return undefined;
    return this.findNode(this.selectedNodeId);
  }

  get documentAttrs(): Record<string, string | number | boolean> {
    this.emailDocument.attrs ??= this.defaultDocumentAttrs();
    return this.emailDocument.attrs;
  }

  get bodyBackgroundColor(): string {
    return String(this.documentAttrs['backgroundColor'] || '#f3f4f6');
  }

  get emailBackgroundColor(): string {
    return String(this.documentAttrs['contentBackgroundColor'] || '#ffffff');
  }

  get emailWidth(): number {
    return this.dimensionValue(this.documentAttrs, 'width', 100);
  }

  get emailWidthCss(): string {
    return this.dimensionCss(this.documentAttrs, 'width', 100, '%');
  }

  get emailMaxWidthCss(): string {
    return this.dimensionCss(this.documentAttrs, 'maxWidth', 600, 'px');
  }

  get emailCanvasWidthCss(): string {
    return this.containedCssSize(this.emailWidthCss);
  }

  get emailCanvasMaxWidthCss(): string {
    return this.containedCssSize(this.emailMaxWidthCss);
  }

  get effectiveConfig(): EmailStudioConfig {
    return { ...DEFAULT_EMAIL_STUDIO_CONFIG, ...(this.config || {}) };
  }

  get resolvedRichTextEditor(): RichTextEditorMode {
    return this.effectiveConfig.richTextEditor === 'plain' ? 'plain' : 'tiptap';
  }

  get resolvedUseTiptap(): boolean {
    return this.resolvedRichTextEditor === 'tiptap';
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
      this.destroyTiptapEditors();
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
    if ((event.container as { id?: string }).id === this.paletteDropListId) return;
    if (!this.canDropIntoContainer(event.item.data, (event.container as { id?: string }).id)) return;
    if (event.previousContainer === event.container) {
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
      this.emitDocument();
      return;
    }

    if (this.isPaletteItem(event.item.data)) {
      const node = this.createNodeForDrop(event.item.data, (event.container as { id?: string }).id);
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
    return `${this.dropListIdPrefix}-drop-${node.id}`;
  }

  childrenOf(node: EmailNode): EmailNode[] {
    node.children ??= [];
    return node.children;
  }

  selectNode(id: string): void {
    this.selectedNodeId = id;
  }

  beginDrag(): void {
    this.dragInProgress = true;
    this.clearNativeSelection();
  }

  endDrag(): void {
    this.dragInProgress = false;
    this.clearNativeSelection();
  }

  clearNativeSelection(): void {
    globalThis.getSelection?.()?.removeAllRanges();
  }

  closeTransientMenus(): void {
    this.exportMenuOpen = false;
  }

  sanitizedRichText(value: unknown): string {
    return this.sanitizeRichTextContent(value);
  }

  selectNodeFromOutline(id: string): void {
    this.selectNode(id);
    this.scrollNodeIntoStage(id);
  }

  selectBody(): void {
    this.selectedNodeId = BODY_NODE_ID;
  }

  selectBodyFromOutline(): void {
    this.selectBody();
    this.scrollStageToTop();
  }

  addBlock(item: PaletteItem): void {
    if (this.readonly) return;
    const node = this.wrapForRootDrop(this.createNodeFromPalette(item), this.rootDropListId);
    this.emailDocument.body = [...this.emailDocument.body, node];
    this.selectedNodeId = node.id;
    this.emitDocument();
  }

  addBlockByType(type: PaletteBlockType): void {
    if (this.readonly) return;
    const node = this.wrapForRootDrop(this.createNode(type), this.rootDropListId);
    this.emailDocument.body = [...this.emailDocument.body, node];
    this.selectedNodeId = node.id;
    this.emitDocument();
  }

  private createNodeFromPalette(item: PaletteItem): EmailNode {
    if (item.preset === 'hero') {
      return this.createSectionWithChildren([
        this.createNode('text', {
          content: '<p class="kicker">Campaign update</p><h1>Your weekly newsletter is ready to edit</h1><p>Create polished, responsive email campaigns with editable MJML blocks and a visual Angular builder.</p>',
          backgroundColor: '#ffffff',
        }),
      ]);
    }

    if (item.preset === 'footer') {
      return this.createSectionWithChildren([
        this.createNode('text', {
          content: '<p>You are receiving this email because you subscribed to product updates. Manage preferences or unsubscribe from your account settings.</p>',
          backgroundColor: '#f1f5f9',
        }),
      ], { backgroundColor: '#f1f5f9' });
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
    if (node.type === 'section') return 'Section';
    if (node.type === 'row') return `MJML ${node.children?.length || 1} columns`;
    if (node.type === 'text') return this.plainText(String(node.attrs['content'] || 'Text')).slice(0, 28) || 'Text paragraph';
    if (node.type === 'image') return 'Image placeholder';
    if (node.type === 'button') return String(node.attrs['label'] || 'CTA button');
    if (node.type === 'divider') return 'Divider';
    if (node.type === 'spacer') return 'Spacer';
    return node.type;
  }

  outlineMeta(node: EmailNode): string {
    const childCount = node.children?.length || 0;
    if (node.type === 'row') return `${childCount || 1} column${(childCount || 1) === 1 ? '' : 's'}`;
    if (node.type === 'column') return `${childCount} nested block${childCount === 1 ? '' : 's'}`;
    if (node.type === 'section') return childCount ? `${childCount} nested block${childCount === 1 ? '' : 's'}` : 'container';
    return node.type;
  }

  outlineIcon(node: EmailNode): string {
    if (node.type === 'row') return 'fa-columns';
    if (node.type === 'column') return 'fa-window-maximize';
    if (node.type === 'section') return 'fa-object-group';
    if (node.type === 'text') return 'fa-font';
    if (node.type === 'image') return 'fa-picture-o';
    if (node.type === 'button') return 'fa-mouse-pointer';
    if (node.type === 'divider') return 'fa-minus';
    if (node.type === 'spacer') return 'fa-arrows-v';
    return 'fa-square-o';
  }

  get totalOutlineNodes(): number {
    return 1 + this.countOutlineNodes(this.emailDocument.body);
  }

  private countOutlineNodes(nodes: EmailNode[]): number {
    return nodes.reduce((count, node) => count + 1 + this.countOutlineNodes(node.children || []), 0);
  }

  setPreviewSize(size: EmailPreviewSize): void {
    this.previewSize = size;
  }

  setCanvasMode(mode: CanvasMode): void {
    if (mode === 'preview' && !this.lastHtml) {
      this.refreshOutputs(false);
    }
    this.canvasMode = mode;
  }

  updateAttr(node: EmailNode, key: string, value: string | number | boolean): void {
    if (this.readonly) return;
    if (key === 'content') value = this.sanitizeRichTextContent(value);
    node.attrs = { ...node.attrs, [key]: value };
    this.emitDocument();
  }

  updateDocumentAttr(key: string, value: string | number | boolean): void {
    if (this.readonly) return;
    this.emailDocument = {
      ...this.emailDocument,
      attrs: { ...this.defaultDocumentAttrs(), ...(this.emailDocument.attrs || {}), [key]: value },
    };
    this.emitDocument();
  }

  colorPickerValue(value: unknown): string {
    const color = String(value || '').trim();
    return /^#[0-9a-fA-F]{6}$/.test(color) ? color : '#ffffff';
  }

  dimensionValue(attrs: Record<string, string | number | boolean>, key: string, fallback: number): number {
    const raw = attrs[key];
    if (typeof raw === 'number') return Number.isFinite(raw) ? raw : fallback;
    const parsed = Number.parseFloat(String(raw || ''));
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  dimensionUnit(attrs: Record<string, string | number | boolean>, key: string, fallback: EmailSizeUnit): EmailSizeUnit {
    const unitValue = attrs[`${key}Unit`];
    if (unitValue === 'px' || unitValue === '%') return unitValue;
    const raw = String(attrs[key] || '');
    if (raw.trim().endsWith('%')) return '%';
    if (raw.trim().endsWith('px')) return 'px';
    return fallback;
  }

  sectionWidthCss(section: EmailNode): string {
    return this.dimensionCss(section.attrs, 'width', 100, '%');
  }

  sectionMaxWidthCss(section: EmailNode): string {
    return this.dimensionCss(section.attrs, 'maxWidth', 600, 'px');
  }

  columnWidthCss(column: EmailNode, fallback = 100, fallbackUnit: EmailSizeUnit = '%'): string {
    return this.dimensionCss(column.attrs, 'width', fallback, fallbackUnit);
  }

  columnMaxWidthCss(column: EmailNode): string {
    return this.dimensionCss(column.attrs, 'maxWidth', 600, 'px');
  }

  dimensionValueFromCss(value: string): number {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 100;
  }

  dimensionUnitFromCss(value: string): EmailSizeUnit {
    return value.trim().endsWith('%') ? '%' : 'px';
  }

  paddingUnit(section: EmailNode): EmailSizeUnit {
    return section.attrs['paddingUnit'] === '%' ? '%' : 'px';
  }

  paddingValue(section: EmailNode, key: 'padding' | 'paddingTop' | 'paddingRight' | 'paddingBottom' | 'paddingLeft'): number {
    return this.dimensionValue(section.attrs, key, this.dimensionValue(section.attrs, 'padding', 16));
  }

  updateSectionPaddingAll(section: EmailNode, value: number): void {
    if (this.readonly) return;
    section.attrs = {
      ...section.attrs,
      padding: value,
      paddingTop: value,
      paddingRight: value,
      paddingBottom: value,
      paddingLeft: value,
    };
    this.emitDocument();
  }

  updateSectionPaddingSide(section: EmailNode, key: 'paddingTop' | 'paddingRight' | 'paddingBottom' | 'paddingLeft', value: number): void {
    if (this.readonly) return;
    section.attrs = { ...section.attrs, [key]: value };
    this.emitDocument();
  }

  sectionPaddingCss(section: EmailNode): string {
    const unit = this.paddingUnit(section);
    const top = this.paddingValue(section, 'paddingTop');
    const right = this.paddingValue(section, 'paddingRight');
    const bottom = this.paddingValue(section, 'paddingBottom');
    const left = this.paddingValue(section, 'paddingLeft');
    return `${top}${unit} ${right}${unit} ${bottom}${unit} ${left}${unit}`;
  }

  isAlignableContent(node: EmailNode): boolean {
    return node.type === 'text' || node.type === 'image' || node.type === 'button';
  }

  contentAlign(node: EmailNode): 'left' | 'center' | 'right' {
    const align = String(node.attrs['align'] || 'left').toLowerCase();
    return align === 'center' || align === 'right' ? align : 'left';
  }

  backgroundFor(node: EmailNode): string {
    return String(node.attrs['backgroundColor'] || '#ffffff');
  }

  setRowColumns(row: EmailNode, count: number): void {
    if (this.readonly) return;
    if (row.type !== 'row') return;
    const safeCount = Math.max(1, Math.min(4, Number.isFinite(count) ? Math.floor(count) : 1));
    const columns = [...(row.children || [])];
    while (columns.length < safeCount) columns.push(this.createColumn([this.createNode('text', { content: '<p>New column text</p>' })]));
    row.children = columns.slice(0, safeCount).map((column) => ({
      ...column,
      attrs: { ...column.attrs, width: Math.floor(100 / safeCount), widthUnit: '%', maxWidth: column.attrs['maxWidth'] || 600, maxWidthUnit: column.attrs['maxWidthUnit'] || 'px' },
    }));
    this.emitDocument();
  }

  addChildBlock(parent: EmailNode, type: PaletteBlockType): void {
    if (this.readonly) return;
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
    if (this.readonly || !this.selectedNodeId) return;
    const location = this.findNodeLocation(this.selectedNodeId);
    if (!location) return;
    const clone = structuredClone(location.node);
    this.reseedIds(clone);
    location.siblings.splice(location.index + 1, 0, clone);
    this.selectedNodeId = clone.id;
    this.emitDocument();
  }

  deleteSelected(): void {
    if (this.readonly || !this.selectedNodeId) return;
    const location = this.findNodeLocation(this.selectedNodeId);
    if (!location) return;
    location.siblings.splice(location.index, 1);
    this.selectedNodeId = this.emailDocument.body[0]?.id;
    this.emitDocument();
  }

  openImportModal(): void {
    if (this.readonly) return;
    this.mjmlDraft = this.lastMjml || this.compileMjml(this.emailDocument);
    this.importErrorMessage = '';
    this.importModalOpen = true;
  }

  closeImportModal(): void {
    this.importModalOpen = false;
    this.importErrorMessage = '';
  }

  importMjml(): void {
    if (this.readonly) return;
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

  openRichTextModal(node: EmailNode): void {
    if (this.readonly) return;
    if (node.type !== 'text') return;
    this.expandedRichTextNode = node;
  }

  closeRichTextModal(): void {
    this.expandedRichTextNode = undefined;
    this.destroyTiptapModalEditor();
  }

  updateExpandedRichText(value: string): void {
    if (this.readonly) return;
    const node = this.expandedRichTextNode;
    if (!node) return;
    this.updateAttr(node, 'content', this.sanitizeRichTextContent(value));
  }

  private tiptapEditor(scope: TiptapScope): TiptapEditor | undefined {
    return scope === 'modal' ? this.tiptapModalEditor : this.tiptapInlineEditor;
  }

  runTiptapCommand(scope: TiptapScope, command: TiptapCommand): void {
    if (this.readonly) return;
    const editor = this.tiptapEditor(scope);
    if (!editor) return;
    const chain = editor.chain().focus();
    if (command === 'bold') chain.toggleBold().run();
    if (command === 'italic') chain.toggleItalic().run();
    if (command === 'underline') chain.toggleUnderline().run();
    if (command === 'strike') chain.toggleStrike().run();
    if (command === 'clearFormatting') chain.unsetAllMarks().clearNodes().run();
    if (command === 'bulletList') chain.toggleBulletList().run();
    if (command === 'orderedList') chain.toggleOrderedList().run();
    if (command === 'sinkListItem') chain.sinkListItem('listItem').run();
    if (command === 'liftListItem') chain.liftListItem('listItem').run();
    if (command === 'insertTable') this.insertTiptapTable(scope, 3, 3);
    if (command === 'addColumnAfter') chain.addColumnAfter().run();
    if (command === 'addRowAfter') chain.addRowAfter().run();
    if (command === 'deleteColumn') chain.deleteColumn().run();
    if (command === 'deleteRow') chain.deleteRow().run();
    if (command === 'deleteTable') chain.deleteTable().run();
    if (command === 'undo') chain.undo().run();
    if (command === 'redo') chain.redo().run();
    if (command === 'unlink') chain.extendMarkRange('link').unsetLink().run();
    if (command === 'link') {
      const currentHref = String(editor.getAttributes('link')['href'] || '');
      const href = globalThis.prompt?.('Link URL', currentHref || 'https://') ?? null;
      if (href === null) return;
      if (!href.trim()) {
        chain.extendMarkRange('link').unsetLink().run();
      } else {
        chain.extendMarkRange('link').setLink({ href: href.trim() }).run();
      }
    }
  }

  canRunTiptapCommand(scope: TiptapScope, command: TiptapCommand): boolean {
    const editor = this.tiptapEditor(scope);
    if (!editor || this.readonly) return false;
    if (command === 'undo') return editor.can().undo();
    if (command === 'redo') return editor.can().redo();
    return true;
  }

  isTiptapActive(scope: TiptapScope, name: string, attrs?: Record<string, unknown>): boolean {
    return this.tiptapEditor(scope)?.isActive(name, attrs) ?? false;
  }

  currentTiptapBlockFormat(scope: TiptapScope): TiptapHeadingValue {
    const editor = this.tiptapEditor(scope);
    if (!editor) return 'paragraph';
    for (const level of [1, 2, 3, 4, 5, 6] as const) {
      if (editor.isActive('heading', { level })) return String(level) as TiptapHeadingValue;
    }
    return 'paragraph';
  }

  setTiptapBlockFormat(scope: TiptapScope, value: TiptapHeadingValue | string): void {
    if (this.readonly) return;
    const editor = this.tiptapEditor(scope);
    if (!editor) return;
    const chain = editor.chain().focus();
    if (value === 'paragraph') {
      chain.setParagraph().run();
      return;
    }
    const level = Number(value);
    if ([1, 2, 3, 4, 5, 6].includes(level)) {
      chain.toggleHeading({ level: level as 1 | 2 | 3 | 4 | 5 | 6 }).run();
    }
  }

  currentTiptapFontSize(scope: TiptapScope): string {
    const fontSize = this.tiptapEditor(scope)?.getAttributes('textStyle')['fontSize'];
    return typeof fontSize === 'string' ? fontSize : '';
  }

  setTiptapFontSize(scope: TiptapScope, size: string): void {
    if (this.readonly) return;
    const editor = this.tiptapEditor(scope);
    if (!editor) return;
    const safeSize = this.tiptapFontSizeOptions.includes(size as (typeof this.tiptapFontSizeOptions)[number]) ? size : '';
    const chain = editor.chain().focus();
    if (!safeSize) {
      chain.setMark('textStyle', { fontSize: null }).removeEmptyTextStyle().run();
      return;
    }
    chain.setMark('textStyle', { fontSize: safeSize }).run();
  }

  currentTiptapLineHeight(scope: TiptapScope): string {
    const editor = this.tiptapEditor(scope);
    if (!editor) return '';
    const heading = editor.getAttributes('heading')['lineHeight'];
    const paragraph = editor.getAttributes('paragraph')['lineHeight'];
    return typeof heading === 'string' ? heading : typeof paragraph === 'string' ? paragraph : '';
  }

  setTiptapLineHeight(scope: TiptapScope, lineHeight: string): void {
    if (this.readonly) return;
    const editor = this.tiptapEditor(scope);
    if (!editor) return;
    const safeLineHeight = this.tiptapLineHeightOptions.includes(lineHeight as (typeof this.tiptapLineHeightOptions)[number]) ? lineHeight : null;
    const target = editor.isActive('heading') ? 'heading' : 'paragraph';
    editor.chain().focus().updateAttributes(target, { lineHeight: safeLineHeight }).run();
  }

  isTiptapTextAlignActive(scope: TiptapScope, align: TiptapTextAlignValue): boolean {
    const editor = this.tiptapEditor(scope);
    return !!editor && (editor.isActive({ textAlign: align }) || (align === 'left' && !editor.isActive({ textAlign: 'center' }) && !editor.isActive({ textAlign: 'right' }) && !editor.isActive({ textAlign: 'justify' })));
  }

  setTiptapTextAlign(scope: TiptapScope, align: TiptapTextAlignValue): void {
    if (this.readonly) return;
    this.tiptapEditor(scope)?.chain().focus().setTextAlign(align).run();
  }

  insertTiptapTable(scope: TiptapScope, rows: number, cols: number): void {
    if (this.readonly) return;
    const safeRows = Math.min(6, Math.max(1, Math.floor(rows)));
    const safeCols = Math.min(6, Math.max(1, Math.floor(cols)));
    this.tiptapEditor(scope)?.chain().focus().insertTable({ rows: safeRows, cols: safeCols, withHeaderRow: true }).run();
  }

  openRichTextSource(scope: TiptapScope): void {
    if (this.readonly) return;
    const node = scope === 'modal' ? this.expandedRichTextNode : this.selectedNode;
    if (!node || node.type !== 'text') return;
    this.sourceEditorScope = scope;
    this.sourceEditorNode = node;
    this.sourceEditorValue = String(node.attrs['content'] || '');
    this.sourceEditorWarning = '';
  }

  closeRichTextSource(): void {
    this.sourceEditorScope = null;
    this.sourceEditorNode = null;
    this.sourceEditorValue = '';
  }

  applyRichTextSource(): void {
    if (this.readonly || !this.sourceEditorNode) return;
    const sanitized = this.sanitizeRichTextContent(this.sourceEditorValue);
    this.sourceEditorWarning = sanitized !== this.sourceEditorValue ? 'Unsafe or unsupported markup was removed.' : '';
    this.updateAttr(this.sourceEditorNode, 'content', sanitized);
    const editor = this.sourceEditorScope ? this.tiptapEditor(this.sourceEditorScope) : undefined;
    editor?.commands.setContent(sanitized || '<p></p>', { emitUpdate: false });
    this.closeRichTextSource();
  }

  guardTiptapBlankMouseDown(event: MouseEvent, scope: 'inline' | 'modal'): void {
    if (event.target !== event.currentTarget) return;
    event.preventDefault();
    event.stopPropagation();
    const editor = scope === 'modal' ? this.tiptapModalEditor : this.tiptapInlineEditor;
    editor?.view.focus();
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
    try {
      previewWindow.opener = null;
    } catch {
      // Some browsers expose opener as readonly; sandboxed iframe preview remains the primary protection.
    }
    const html = this.lastHtml || this.renderHtml(this.emailDocument);
    previewWindow.document.open();
    previewWindow.document.write(this.buildSandboxedPreviewShell(html));
    previewWindow.document.close();
  }

  copyMjml(): void {
    this.openOutputModal('mjml');
  }

  exportHtml(): void {
    this.lastMjml = this.compileMjml(this.emailDocument);
    this.lastHtml = this.renderHtml(this.emailDocument);
    this.htmlExport.emit(this.lastHtml);
  }

  private buildSandboxedPreviewShell(html: string): string {
    return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Email preview</title>
    <style>html,body{margin:0;width:100%;height:100%;background:#f3f4f6;}iframe{display:block;width:100%;height:100%;border:0;background:#fff;}</style>
  </head>
  <body>
    <iframe title="Email preview" sandbox="" srcdoc="${this.escapeAttr(html)}"></iframe>
  </body>
</html>`;
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

  private isEmailNode(value: unknown): value is EmailNode {
    return !!value && typeof value === 'object' && 'id' in value && 'type' in value && 'attrs' in value;
  }

  private canDropIntoContainer(data: unknown, containerId?: string): boolean {
    if (containerId === this.paletteDropListId) return false;
    if (!containerId) return true;
    if (this.isPaletteItem(data)) return true;
    if (!this.isEmailNode(data)) return false;
    if (containerId === this.rootDropListId) return true;

    const targetContainer = this.findNodeByDropListId(containerId);
    if (!targetContainer || (targetContainer.type !== 'section' && targetContainer.type !== 'column')) return false;
    if (data.id === targetContainer.id || this.nodeContainsId(data, targetContainer.id)) return false;
    return this.isContentModule(data);
  }

  private findNodeByDropListId(dropListId: string): EmailNode | undefined {
    const prefix = `${this.dropListIdPrefix}-drop-`;
    if (!dropListId.startsWith(prefix)) return undefined;
    return this.findNode(dropListId.slice(prefix.length));
  }

  private nodeContainsId(node: EmailNode, id: string): boolean {
    return treeNodeContainsId(node, id);
  }

  private isContentModule(node: EmailNode): boolean {
    return node.type === 'text' || node.type === 'image' || node.type === 'button' || node.type === 'divider' || node.type === 'spacer';
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

  private containedCssSize(value: string): string {
    return value.endsWith('%') ? value : `min(100%, ${value})`;
  }

  private scrollNodeIntoStage(id: string): void {
    const selector = `[data-node-id="${this.escapeCssIdentifier(id)}"]`;
    setTimeout(() => {
      const root = this.componentRoot();
      const stage = root.querySelector('.nes-stage') as HTMLElement | null;
      const target = root.querySelector(selector) as HTMLElement | null;
      if (!stage || !target) return;
      const stageBox = stage.getBoundingClientRect();
      const targetBox = target.getBoundingClientRect();
      const top = Math.max(0, stage.scrollTop + targetBox.top - stageBox.top - 72);
      this.scrollStageToPosition(stage, top);
    }, 0);
  }

  private scrollStageToTop(): void {
    setTimeout(() => {
      const stage = this.componentRoot().querySelector('.nes-stage') as HTMLElement | null;
      if (stage) this.scrollStageToPosition(stage, 0);
    }, 0);
  }

  private scrollStageToPosition(stage: HTMLElement, top: number): void {
    if (typeof stage.scrollTo === 'function') {
      stage.scrollTo({ top, behavior: 'smooth' });
    } else {
      stage.scrollTop = top;
    }
  }

  private escapeCssIdentifier(value: string): string {
    const css = (globalThis as typeof globalThis & { CSS?: { escape?: (text: string) => string } }).CSS;
    if (css?.escape) return css.escape(value);
    return value.replace(/[^a-zA-Z0-9_-]/g, '\$&');
  }

  private refreshOutputs(emit: boolean): void {
    this.lastMjml = this.compileMjml(this.emailDocument);
    if (this.effectiveConfig.showHtmlPreview !== false) {
      this.lastHtml = this.renderHtml(this.emailDocument);
      this.previewSrcdoc = this.sanitizer.bypassSecurityTrustHtml(this.lastHtml);
    }
    if (emit) {
      this.documentChange.emit(this.emailDocument);
      this.mjmlChange.emit(this.lastMjml);
    }
  }

  private createStarterDocument(): EmailDocument {
    return createTreeStarterDocument((type) => this.nextId(type));
  }

  private defaultDocumentAttrs(): Record<string, string | number | boolean> {
    return getDefaultDocumentAttrs();
  }


  private syncTiptapEditors(): void {
    if (!this.resolvedUseTiptap) {
      this.destroyTiptapEditors();
      return;
    }
    this.syncInlineTiptapEditor();
    this.syncModalTiptapEditor();
  }

  private syncInlineTiptapEditor(): void {
    const node = this.selectedNode;
    const root = this.componentRoot();
    const host = node?.type === 'text' ? root.querySelector(`[data-tiptap-editor="${this.escapeCssIdentifier(node.id)}"]`) as HTMLElement | null : null;
    if (!node || node.type !== 'text' || !host) {
      this.destroyTiptapInlineEditor();
      return;
    }
    if (!this.tiptapInlineEditor || this.tiptapInlineNodeId !== node.id || !host.contains(this.tiptapInlineEditor.view.dom)) {
      this.destroyTiptapInlineEditor();
      this.tiptapInlineNodeId = node.id;
      this.tiptapInlineEditor = this.createTiptapEditor(host, node, 'inline');
      return;
    }
    this.syncTiptapContent(this.tiptapInlineEditor, node);
  }

  private syncModalTiptapEditor(): void {
    const node = this.expandedRichTextNode;
    const root = this.componentRoot();
    const host = node?.type === 'text' ? root.querySelector(`[data-tiptap-modal-editor="${this.escapeCssIdentifier(node.id)}"]`) as HTMLElement | null : null;
    if (!node || node.type !== 'text' || !host) {
      this.destroyTiptapModalEditor();
      return;
    }
    if (!this.tiptapModalEditor || this.tiptapModalNodeId !== node.id || !host.contains(this.tiptapModalEditor.view.dom)) {
      this.destroyTiptapModalEditor();
      this.tiptapModalNodeId = node.id;
      this.tiptapModalEditor = this.createTiptapEditor(host, node, 'modal');
      return;
    }
    this.syncTiptapContent(this.tiptapModalEditor, node);
  }

  private createTiptapEditor(element: HTMLElement, node: EmailNode, scope: 'inline' | 'modal'): TiptapEditor {
    const editor = new TiptapEditor({
      element,
      content: this.sanitizeRichTextContent(node.attrs['content']),
      editable: !this.readonly,
      extensions: TIPTAP_EXTENSIONS,
      onUpdate: ({ editor }) => {
        const currentNode = scope === 'modal' ? this.expandedRichTextNode : this.findNode(this.tiptapInlineNodeId);
        if (!currentNode || currentNode.type !== 'text') return;
        this.updateAttr(currentNode, 'content', editor.getHTML());
      },
    });
    this.installTiptapBlankClickGuard(element, editor);
    return editor;
  }

  private installTiptapBlankClickGuard(element: HTMLElement, editor: TiptapEditor): void {
    let pendingTextClick: { x: number; y: number; pos: number } | undefined;
    const guardPointer = (event: MouseEvent) => {
      if (event.button !== 0) return;
      const proseMirror = element.querySelector<HTMLElement>('.ProseMirror');
      if (!proseMirror) return;
      const isStructuredTarget = this.isTiptapStructuredEditorTarget(event.target);
      pendingTextClick = isStructuredTarget ? undefined : this.tiptapTextSelectionFromPoint(proseMirror, editor, event.clientX, event.clientY);
      if (pendingTextClick) {
        event.preventDefault();
        event.stopPropagation();
        editor.view.focus();
        editor.commands.setTextSelection(pendingTextClick.pos);
        return;
      }
      const contentBottom = this.tiptapContentBottom(proseMirror);
      const isBlankPanelClick = event.target === element || event.clientY > contentBottom + 4;
      const isWhitespaceInsideEditorClick =
        proseMirror.contains(event.target as Node) &&
        !isStructuredTarget &&
        !this.isPointInTiptapTextRect(proseMirror, event.clientX, event.clientY);
      if (isBlankPanelClick || isWhitespaceInsideEditorClick) {
        pendingTextClick = undefined;
        event.preventDefault();
        event.stopPropagation();
        editor.view.focus();
      }
    };
    const restoreTextClick = (event: MouseEvent) => {
      if (!pendingTextClick) return;
      const textClick = pendingTextClick;
      const movement = Math.hypot(event.clientX - textClick.x, event.clientY - textClick.y);
      const restore = () => {
        editor.view.focus();
        editor.commands.setTextSelection(textClick.pos);
      };
      if (movement <= 4) {
        restore();
        requestAnimationFrame(restore);
        setTimeout(restore, 0);
      }
      pendingTextClick = undefined;
    };
    element.addEventListener('pointerdown', guardPointer, true);
    element.addEventListener('mousedown', guardPointer, true);
    element.addEventListener('click', restoreTextClick, false);
  }

  private isTiptapStructuredEditorTarget(target: EventTarget | null): boolean {
    if (!(target instanceof Element)) return false;
    return Boolean(target.closest('table, td, th, img, hr, a'));
  }

  private isPointInTiptapTextRect(proseMirror: HTMLElement, clientX: number, clientY: number): boolean {
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

  private tiptapTextSelectionFromPoint(proseMirror: HTMLElement, editor: TiptapEditor, clientX: number, clientY: number): { x: number; y: number; pos: number } | undefined {
    if (!this.isPointInTiptapTextRect(proseMirror, clientX, clientY)) return undefined;
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
            if (clientX <= rect.left + rect.width / 2) return this.tiptapSelectionAtDomOffset(editor, node, index, clientX, clientY);
            if (clientX <= rect.right + 3) return this.tiptapSelectionAtDomOffset(editor, node, index + 1, clientX, clientY);
          }
        }
      }
      const caretRange = documentRef.caretRangeFromPoint?.(clientX, clientY);
      if (caretRange?.startContainer && proseMirror.contains(caretRange.startContainer)) {
        return this.tiptapSelectionAtDomOffset(editor, caretRange.startContainer, caretRange.startOffset, clientX, clientY);
      }
      return undefined;
    } finally {
      range.detach();
    }
  }

  private tiptapSelectionAtDomOffset(editor: TiptapEditor, node: Node, offset: number, x: number, y: number): { x: number; y: number; pos: number } | undefined {
    try {
      return { x, y, pos: editor.view.posAtDOM(node, offset) };
    } catch {
      return undefined;
    }
  }

  private tiptapContentBottom(proseMirror: HTMLElement): number {
    const children = Array.from(proseMirror.children) as HTMLElement[];
    const visibleChildren = children.filter((child) => child.getClientRects().length > 0);
    if (!visibleChildren.length) return proseMirror.getBoundingClientRect().top;
    return Math.max(...visibleChildren.map((child) => child.getBoundingClientRect().bottom));
  }

  private syncTiptapContent(editor: TiptapEditor, node: EmailNode): void {
    const nextContent = this.sanitizeRichTextContent(node.attrs['content']);
    const currentContent = this.sanitizeRichTextContent(editor.getHTML());
    if (currentContent !== nextContent) editor.commands.setContent(nextContent, { emitUpdate: false });
    editor.setEditable(!this.readonly, false);
  }

  private destroyTiptapEditors(): void {
    this.destroyTiptapInlineEditor();
    this.destroyTiptapModalEditor();
  }

  private destroyTiptapInlineEditor(): void {
    this.tiptapInlineEditor?.destroy();
    this.tiptapInlineEditor = undefined;
    this.tiptapInlineNodeId = undefined;
  }

  private destroyTiptapModalEditor(): void {
    this.tiptapModalEditor?.destroy();
    this.tiptapModalEditor = undefined;
    this.tiptapModalNodeId = undefined;
  }


  private componentRoot(): ParentNode {
    return this.hostRef.nativeElement;
  }


  private createNodeForDrop(item: PaletteItem, containerId?: string): EmailNode {
    const node = this.createNodeFromPalette(item);
    if (containerId === this.rootDropListId) return this.wrapForRootDrop(node, containerId);
    return this.normalizeNestedDropNode(node);
  }

  private wrapForRootDrop(node: EmailNode, containerId?: string): EmailNode {
    if (containerId !== this.rootDropListId) return node;
    if (node.type === 'row' || node.type === 'section') return node;
    return this.createSectionWithChildren([node]);
  }

  private normalizeNestedDropNode(node: EmailNode): EmailNode {
    if (node.type === 'section') {
      const child = node.children?.[0];
      return child ? structuredClone(child) : this.createNode('text');
    }
    if (node.type === 'row') return this.createNode('text');
    return node;
  }

  private createSectionWithChildren(children: EmailNode[], attrs: Record<string, string | number | boolean> = {}): EmailNode {
    return createTreeSectionWithChildren((type) => this.nextId(type), children, attrs);
  }

  private createNode(type: EmailBlockType, attrs: Record<string, string | number | boolean> = {}): EmailNode {
    return createTreeNode((nodeType) => this.nextId(nodeType), type, attrs);
  }

  private createColumn(children: EmailNode[] = [], width = '100%', attrs: Record<string, string | number | boolean> = {}): EmailNode {
    return createTreeColumn((type) => this.nextId(type), children, width, attrs);
  }

  private nextId(type: string): string {
    return `${type}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }

  private compileMjml(document: EmailDocument): string {
    return compileMjmlDocument(document, (type) => this.nextId(type));
  }

  private parseMjml(mjml: string): EmailDocument {
    return parseMjmlDocument(mjml, (type) => this.nextId(type));
  }

  private renderHtml(document: EmailDocument): string {
    const attrs = { ...this.defaultDocumentAttrs(), ...(document.attrs || {}) };
    const bodyBackground = this.escapeAttr(String(attrs['backgroundColor'] || '#f3f4f6'));
    const emailBackground = this.escapeAttr(String(attrs['contentBackgroundColor'] || '#ffffff'));
    const emailWidth = this.dimensionCss(attrs, 'width', 100, '%');
    const emailMaxWidth = this.dimensionCss(attrs, 'maxWidth', 600, 'px');
    const emailWidthAttr = this.dimensionHtmlWidthAttr(attrs, 'width', 100, '%');
    const outlookWidth = this.escapeAttr(this.outlookHtmlWidth(attrs));
    const rows = document.body.map((node) => this.nodeToHtml(node, 6)).join('\n');
    return [
      '<!doctype html>',
      '<html xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">',
      '  <head>',
      '    <title>Email Export</title>',
      '    <!--[if !mso]><!-->',
      '    <meta http-equiv="X-UA-Compatible" content="IE=edge">',
      '    <!--<![endif]-->',
      '    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">',
      '    <meta name="viewport" content="width=device-width, initial-scale=1">',
      '    <style type="text/css">',
      '      #outlook a { padding:0; }',
      '      body { margin:0; padding:0; -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }',
      '      table, td { border-collapse:collapse; mso-table-lspace:0pt; mso-table-rspace:0pt; }',
      '      img { border:0; height:auto; line-height:100%; outline:none; text-decoration:none; -ms-interpolation-mode:bicubic; }',
      '      p { display:block; margin:13px 0; }',
      '    </style>',
      '    <!--[if mso]>',
      '    <noscript>',
      '      <xml>',
      '        <o:OfficeDocumentSettings>',
      '          <o:AllowPNG/>',
      '          <o:PixelsPerInch>96</o:PixelsPerInch>',
      '        </o:OfficeDocumentSettings>',
      '      </xml>',
      '    </noscript>',
      '    <![endif]-->',
      '    <!--[if lte mso 11]>',
      '    <style type="text/css">',
      '      .nes-email-outlook-fix { width:100% !important; }',
      '    </style>',
      '    <![endif]-->',
      '    <style type="text/css">',
      '      @media only screen and (max-width:480px) {',
      '        .nes-email-column { display:block !important; width:100% !important; max-width:100% !important; }',
      '      }',
      '      @media only screen and (min-width:480px) {',
      '        .nes-email-column { display:table-cell !important; }',
      '      }',
      '    </style>',
      '  </head>',
      `  <body style="margin:0;padding:0;background:${bodyBackground};word-spacing:normal;">`,
      `    <table role="presentation" border="0" width="100%" cellspacing="0" cellpadding="0" style="background:${bodyBackground};padding:24px 0;border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;">`,
      '      <tr>',
      '        <td align="center">',
      `          <!--[if mso | IE]><table role="presentation" align="center" border="0" cellpadding="0" cellspacing="0" width="${outlookWidth}"><tr><td><![endif]-->`,
      `          <table role="presentation" border="0" width="${emailWidthAttr}" cellspacing="0" cellpadding="0" style="width:${emailWidth};max-width:${emailMaxWidth};background:${emailBackground};border-radius:16px;overflow:hidden;font-family:Arial,sans-serif;border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;">`,
      rows,
      '          </table>',
      '          <!--[if mso | IE]></td></tr></table><![endif]-->',
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
      this.indent('<table role="presentation" border="0" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;">', depth + 2),
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
      this.indent(`<td align="center" style="padding:0;background:${this.escapeAttr(String(section.attrs['backgroundColor'] || '#ffffff'))};">`, depth + 1),
      this.indent(`<table role="presentation" border="0" width="${this.escapeAttr(this.dimensionHtmlWidthAttr(section.attrs, 'width', 100, '%'))}" cellspacing="0" cellpadding="0" style="width:${this.escapeAttr(this.sectionWidthCss(section))};max-width:${this.escapeAttr(this.sectionMaxWidthCss(section))};background:${this.escapeAttr(String(section.attrs['backgroundColor'] || '#ffffff'))};border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;">`, depth + 2),
      this.indent('<tr>', depth + 3),
      this.indent(`<td style="padding:${this.escapeAttr(this.sectionPaddingCss(section))};">`, depth + 4),
      content,
      this.indent('</td>', depth + 4),
      this.indent('</tr>', depth + 3),
      this.indent('</table>', depth + 2),
      this.indent('</td>', depth + 1),
      this.indent('</tr>', depth),
    ].join('\n');
  }

  private columnToHtml(column: EmailNode, fallbackWidth: string, depth = 0): string {
    const fallbackValue = Number.parseFloat(fallbackWidth);
    const fallbackUnit: EmailSizeUnit = fallbackWidth.trim().endsWith('%') ? '%' : 'px';
    const width = this.columnWidthCss(column, Number.isFinite(fallbackValue) ? fallbackValue : 100, fallbackUnit);
    const maxWidth = this.columnMaxWidthCss(column);
    const content = (column.children || []).map((child) => this.blockToHtmlCellContent(child, depth + 1)).join('\n');
    return [
      this.indent(`<td class="nes-email-column nes-email-outlook-fix" width="${this.escapeAttr(this.dimensionHtmlWidthAttr(column.attrs, 'width', Number.isFinite(fallbackValue) ? fallbackValue : 100, fallbackUnit))}" valign="top" style="width:${this.escapeAttr(width)};max-width:${this.escapeAttr(maxWidth)};padding:16px;background:${this.escapeAttr(String(column.attrs['backgroundColor'] || '#ffffff'))};border-collapse:collapse;">`, depth),
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
        return [this.indent('<table role="presentation" border="0" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;">', depth), this.rowToHtml(node, depth + 1), this.indent('</table>', depth)].join('\n');
      case 'column':
        return [this.indent('<table role="presentation" border="0" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;">', depth), this.indent('<tr>', depth + 1), this.columnToHtml(node, '100%', depth + 2), this.indent('</tr>', depth + 1), this.indent('</table>', depth)].join('\n');
      case 'section':
        return [this.indent('<table role="presentation" border="0" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;">', depth), this.sectionToHtml(node, depth + 1), this.indent('</table>', depth)].join('\n');
      case 'text':
        return this.indent(`<div style="padding:20px;background:${this.escapeAttr(String(node.attrs['backgroundColor'] || '#ffffff'))};line-height:1.6;color:#1f2937;text-align:${this.escapeAttr(this.contentAlign(node))};">${this.sanitizeRichTextContent(node.attrs['content'])}</div>`, depth);
      case 'image':
        return this.indent(`<div style="text-align:${this.escapeAttr(this.contentAlign(node))};"><img src="${this.escapeAttr(String(node.attrs['src'] || ''))}" alt="${this.escapeAttr(String(node.attrs['alt'] || ''))}" style="display:inline-block;max-width:100%;width:100%;height:auto;border:0;" /></div>`, depth);
      case 'button':
        return this.indent(`<div style="padding:24px;text-align:${this.escapeAttr(this.contentAlign(node))};"><a href="${this.escapeAttr(String(node.attrs['href'] || '#'))}" style="display:inline-block;background:${this.escapeAttr(String(node.attrs['backgroundColor'] || '#7c3aed'))};color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:999px;font-weight:bold;">${this.escapeHtml(String(node.attrs['label'] || 'Button'))}</a></div>`, depth);
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

  private dimensionCss(attrs: Record<string, string | number | boolean>, key: string, fallback: number, fallbackUnit: EmailSizeUnit): string {
    return `${this.dimensionValue(attrs, key, fallback)}${this.dimensionUnit(attrs, key, fallbackUnit)}`;
  }

  private dimensionHtmlWidthAttr(attrs: Record<string, string | number | boolean>, key: string, fallback: number, fallbackUnit: EmailSizeUnit): string {
    const value = this.dimensionValue(attrs, key, fallback);
    const unit = this.dimensionUnit(attrs, key, fallbackUnit);
    return unit === 'px' ? String(value) : `${value}%`;
  }

  private outlookHtmlWidth(attrs: Record<string, string | number | boolean>): string {
    if (this.dimensionUnit(attrs, 'maxWidth', 'px') === 'px') return String(this.dimensionValue(attrs, 'maxWidth', 600));
    if (this.dimensionUnit(attrs, 'width', '%') === 'px') return String(this.dimensionValue(attrs, 'width', 600));
    return '600';
  }

  private indent(value: string, depth: number): string {
    return `${'  '.repeat(depth)}${value}`;
  }

  private findNode(id?: string): EmailNode | undefined {
    return findTreeNode(id, this.emailDocument.body);
  }

  private findNodeLocation(id: string, siblings = this.emailDocument.body): { node: EmailNode; siblings: EmailNode[]; index: number } | undefined {
    return findTreeNodeLocation(id, siblings);
  }

  private reseedIds(node: EmailNode): void {
    reseedTreeIds(node, (type) => this.nextId(type));
  }

  private elementChildren(element: Element): Element[] {
    return getElementChildren(element);
  }

  private backgroundAttr(node: EmailNode): string {
    return node.attrs['backgroundColor'] ? ` background-color="${this.escapeAttr(String(node.attrs['backgroundColor']))}"` : '';
  }

  private alignAttr(node: EmailNode): string {
    return this.isAlignableContent(node) && node.attrs['align'] ? ` align="${this.escapeAttr(this.contentAlign(node))}"` : '';
  }

  private safeAlign(value: string | null): 'left' | 'center' | 'right' {
    const align = String(value || 'left').toLowerCase();
    return align === 'center' || align === 'right' ? align : 'left';
  }

  private sectionMjmlAttrs(section: EmailNode): string {
    const padding = ` padding="${this.escapeAttr(this.sectionPaddingCss(section))}"`;
    return `${this.backgroundAttr(section)}${padding}`;
  }

  private bodyMjmlAttrs(document: EmailDocument): string {
    const attrs = { ...this.defaultDocumentAttrs(), ...(document.attrs || {}) };
    const background = attrs['backgroundColor'] ? ` background-color="${this.escapeAttr(String(attrs['backgroundColor']))}"` : '';
    const width = attrs['width'] ? ` width="${this.escapeAttr(this.dimensionCss(attrs, 'width', 100, '%'))}"` : '';
    return `${background}${width}`;
  }

  private readonly supportedMjmlTags = new Set(['mjml', 'mj-body', 'mj-section', 'mj-column', 'mj-text', 'mj-image', 'mj-button', 'mj-divider', 'mj-spacer']);

  private sanitizeRichTextContent(value: unknown): string {
    return sanitizeRichTextHtml(value);
  }

  private escapeAttr(value: string): string {
    return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  }

  private escapeHtml(value: string): string {
    return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}
