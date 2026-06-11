import { CDK_DRAG_CONFIG, CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { CommonModule } from '@angular/common';
import { AfterViewChecked, AfterViewInit, ChangeDetectorRef, Component, DoCheck, ElementRef, EventEmitter, HostListener, Input, OnChanges, OnDestroy, Output, SimpleChanges, ViewEncapsulation } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Editor as TiptapEditor } from '@tiptap/core';

import { NgxEmailStudioDataSetModal } from './components/data-set-modal.component';
import { NgxEmailStudioTransformModal } from './components/transform-modal.component';
import { NgxEmailStudioImportModal } from './components/import-modal.component';
import { NgxEmailStudioOutputModal } from './components/output-modal.component';
import { DEFAULT_EMAIL_FONT_FAMILY_OPTIONS, DEFAULT_EMAIL_STUDIO_CONFIG } from './config';
import { BODY_NODE_ID } from './constants';
import { dimensionCss, dimensionUnit, dimensionValue, imageWidthCss as getImageWidthCss, isAlignableContent as isAlignableEmailContent, paddingCss as nodePaddingToCss, paddingUnit as sectionPaddingUnit, paddingValue as sectionPaddingValue, sectionPaddingCss as sectionPaddingToCss, contentAlign as getContentAlign, normalizeColorValue, normalizeCssSizeValue, normalizeFontCssUrlValue, normalizeFontFamilyValue, normalizeFontWeightValue, normalizeHrefValue, normalizeImageSrcValue, normalizeLineHeightValue } from './export/export-utils';
import { renderHtml as renderHtmlDocument } from './export/html-export';
import { compileMjml as compileMjmlDocument } from './export/mjml-export';
import { parseMjml as parseMjmlDocument } from './import/mjml-import';
import { parseSocialDraftItems, parseSocialItems, serializeSocialDraftItems, SocialItem, socialCssSize, socialIconLabel as getSocialIconLabel, socialMode, updateSocialItem } from './social/social-utils';
import {
  CanvasMode,
  EmailBlockType,
  EmailDocument,
  EmailNode,
  EmailPreviewSize,
  EmailSizeUnit,
  EmailStudioConfig,
  EmailStudioDataSetItem,
  EmailStudioError,
  EmailStudioImageUploadContext,
  EmailStudioImageUploadHandler,
  EmailStudioImageUploadResult,
  EmailStudioResult,
  EmailStudioFontFamilyOption,
  EmailStudioTemplateModule,
  EmailStudioTransformAction,
  EmailStudioTransformPreview,
  EmailStudioTransformScope,
  PaletteBlockType,
  PaletteItem,
  RichTextEditorMode,
  TiptapCommand,
  TiptapHeadingValue,
  TiptapScope,
  TiptapTextAlignValue,
} from './models';
import { buildSandboxedPreviewShell, fallbackCopyToClipboard as fallbackCopyOutputToClipboard } from './output/output-utils';
import { transformEmailDocumentText } from './transform/transform-utils';
import { sanitizeRichTextContent as sanitizeRichTextHtml } from './tiptap/rich-text-sanitizer';
import { createTiptapEditor as createManagedTiptapEditor, syncTiptapContent as syncManagedTiptapContent } from './tiptap/tiptap-controller';
import { TIPTAP_BLOCK_OPTIONS, TIPTAP_FONT_SIZE_OPTIONS, TIPTAP_LINE_HEIGHT_OPTIONS } from './tiptap/tiptap-options';
import { colorPickerValue as getColorPickerValue, dimensionUnitFromCss as parseDimensionUnitFromCss, dimensionValueFromCss as parseDimensionValueFromCss, backgroundFor as getBackgroundFor, containedCssSize as getContainedCssSize, plainText as toPlainText } from './view/document-view';
import { countOutlineNodes, outlineIcon as getOutlineIcon, outlineLabel as getOutlineLabel, outlineMeta as getOutlineMeta } from './view/outline-view';
import { createColumn as createTreeColumn, createNode as createTreeNode, createSectionWithChildren as createTreeSectionWithChildren, createStarterDocument as createTreeStarterDocument, defaultDocumentAttrs as getDefaultDocumentAttrs } from './tree/block-factory';
import { canDropIntoContainer as canDropIntoTreeContainer, collectContainerDropListIds as collectTreeContainerDropListIds, isContentModule as isTreeContentModule, isEmailNode as isTreeEmailNode, isPaletteItem as isTreePaletteItem, normalizeNestedDropNode as normalizeTreeNestedDropNode, wrapForRootDrop as wrapTreeForRootDrop } from './tree/drop-utils';
import { elementChildren as getElementChildren, findNode as findTreeNode, findNodeLocation as findTreeNodeLocation, nodeContainsId as treeNodeContainsId, reseedIds as reseedTreeIds } from './tree/node-utils';

export type {
  CanvasMode,
  EmailBlockType,
  EmailDocument,
  EmailNode,
  EmailPreviewSize,
  EmailSizeUnit,
  EmailStudioConfig,
  EmailStudioDataSetItem,
  EmailStudioError,
  EmailStudioImageUploadContext,
  EmailStudioImageUploadHandler,
  EmailStudioImageUploadResult,
  EmailStudioResult,
  EmailStudioFontFamilyOption,
  EmailStudioTemplateModule,
  EmailStudioTransformAction,
  EmailStudioTransformPreview,
  EmailStudioTransformScope,
  PaletteBlockType,
  PaletteItem,
  RichTextEditorMode,
  TiptapCommand,
  TiptapHeadingValue,
  TiptapScope,
  TiptapTextAlignValue,
} from './models';
export { DEFAULT_EMAIL_FONT_FAMILY_OPTIONS, DEFAULT_EMAIL_STUDIO_CONFIG } from './config';

let nextEmailStudioInstanceId = 0;

function createEmailStudioInstanceId(): string {
  nextEmailStudioInstanceId += 1;
  return `nes-${nextEmailStudioInstanceId}`;
}

interface TiptapToolbarState {
  blockFormat: TiptapHeadingValue;
  fontSize: string;
  lineHeight: string;
  activeMarks: Record<string, boolean>;
  activeBlocks: Record<string, boolean>;
  textAlign: TiptapTextAlignValue;
  cellStyles: Record<string, string>;
}

interface EmailHistorySnapshot {
  document: EmailDocument;
  selectedNodeId?: string;
}

type TiptapPromptKind = 'link' | 'image' | 'cell-style';

interface TiptapPromptConfig {
  kind: TiptapPromptKind;
  scope: TiptapScope;
  name?: string;
  title: string;
  eyebrow: string;
  label: string;
  description: string;
  placeholder: string;
  icon: string;
  value: string;
}

const MAX_DOCUMENT_HISTORY = 80;

function defaultTiptapToolbarState(): TiptapToolbarState {
  return {
    blockFormat: 'paragraph',
    fontSize: '',
    lineHeight: '',
    activeMarks: {},
    activeBlocks: {},
    textAlign: 'left',
    cellStyles: {},
  };
}

@Component({
  selector: 'ngx-email-studio',
  standalone: true,
  encapsulation: ViewEncapsulation.None,
  imports: [CommonModule, FormsModule, DragDropModule, NgxEmailStudioImportModal, NgxEmailStudioDataSetModal, NgxEmailStudioTransformModal, NgxEmailStudioOutputModal],
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
          <div class="nes-history-actions" role="group" aria-label="Document history">
            <button type="button" class="nes-history-btn" data-history-action="undo" aria-label="Undo" title="Undo (⌘Z / Ctrl+Z)" (click)="undoDocumentFromToolbar(); $event.stopPropagation()"><i class="nes-icon fa fa-undo" aria-hidden="true"></i></button>
            <button type="button" class="nes-history-btn" data-history-action="redo" aria-label="Redo" title="Redo (⌘⇧Z / Ctrl+Y)" (click)="redoDocumentFromToolbar(); $event.stopPropagation()"><i class="nes-icon fa fa-repeat" aria-hidden="true"></i></button>
          </div>
          <button type="button" class="nes-data-set-trigger" *ngIf="hasDataSetItems" (click)="openDataSetModal()"><i class="nes-icon fa fa-database" aria-hidden="true"></i> Data set</button>
          <button type="button" class="nes-transform-trigger" [disabled]="readonly" (click)="openTransformModal()"><i class="nes-icon fa fa-language" aria-hidden="true"></i> Transform</button>
          <button type="button" class="nes-import-trigger" [disabled]="readonly" (click)="openImportModal()"><i class="nes-icon fa fa-upload" aria-hidden="true"></i> Import</button>
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
          <button type="button" class="nes-primary nes-save-trigger" *ngIf="resolvedShowSave" (click)="saveDocument()"><i class="nes-icon fa fa-floppy-o" aria-hidden="true"></i> Save</button>
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
              [cdkDropListDisabled]="readonly"
              [cdkDropListSortingDisabled]="true"
              [cdkDropListEnterPredicate]="rejectPaletteDrop"
              class="nes-block-list"
            >
              <article class="nes-block" *ngFor="let item of filteredPalette" cdkDrag [cdkDragDisabled]="readonly" [cdkDragData]="item" [cdkDragPreviewContainer]="'parent'" [cdkDragStartDelay]="0" (cdkDragStarted)="beginDrag()" (cdkDragEnded)="endDrag()" [attr.title]="item.description">
                <span class="nes-block-icon">
                  <img *ngIf="item.templateIconUrl; else faPaletteIcon" [src]="item.templateIconUrl" [alt]="item.label" />
                  <ng-template #faPaletteIcon>
                    <i *ngIf="item.templateMjml; else builtInPaletteIcon" [class]="'fa nes-fa-template-icon ' + item.icon" aria-hidden="true"></i>
                    <ng-template #builtInPaletteIcon><i class="nes-icon fa" [class]="'nes-icon fa ' + item.icon" aria-hidden="true"></i></ng-template>
                  </ng-template>
                </span>
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
                  [cdkDropListDisabled]="readonly"
                  [cdkDropListEnterPredicate]="canEnterContainerDropList"
                  [cdkDropListAutoScrollStep]="18"
                  (cdkDropListDropped)="drop($event)"
                  class="nes-canvas"
                  [style.width]="emailCanvasWidthCss"
                  [style.max-width]="emailCanvasMaxWidthCss"
                  [style.background]="emailBackgroundColor"
                  [style.border-radius]="emailBorderRadiusCss"
                  [style.border]="emailBorderStyle"
                  [style.font-size]="emailFontSizeCss"
                  [style.font-family]="emailFontFamilyCss"
                >
                  <article
                    role="button"
                    tabindex="0"
                    class="nes-node"
                    [class.is-selected]="node.id === selectedNodeId"
                    [attr.data-node-id]="node.id"
                    *ngFor="let node of emailDocument.body; trackBy: trackNode"
                    cdkDrag
                    [cdkDragDisabled]="isCanvasNodeDragDisabled(node)"
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
                  <input type="color" [ngModel]="colorPickerValue(documentAttrs['backgroundColor'], '#ffffff')" (ngModelChange)="updateDocumentColorAttr('backgroundColor', $event)" />
                  <input [ngModel]="documentColorText('backgroundColor')" (ngModelChange)="updateDocumentColorAttr('backgroundColor', $event)" placeholder="transparent" />
                </span>
              </label>
              <label>
                Email background
                <span class="nes-color-control">
                  <input type="color" [ngModel]="colorPickerValue(documentAttrs['contentBackgroundColor'], '#ffffff')" (ngModelChange)="updateDocumentColorAttr('contentBackgroundColor', $event)" />
                  <input [ngModel]="documentColorText('contentBackgroundColor')" (ngModelChange)="updateDocumentColorAttr('contentBackgroundColor', $event)" placeholder="transparent" />
                </span>
              </label>
              <div class="nes-control-row">
                <label>
                  Email border radius
                  <span class="nes-unit-field">
                    <input type="number" min="0" [ngModel]="dimensionValue(documentAttrs, 'contentBorderRadius', 16)" (ngModelChange)="updateDocumentAttr('contentBorderRadius', +$event)" />
                    <span class="nes-static-unit">px</span>
                  </span>
                </label>
                <label>
                  Email border width
                  <span class="nes-unit-field">
                    <input type="number" min="0" [ngModel]="dimensionValue(documentAttrs, 'contentBorderWidth', 0)" (ngModelChange)="updateDocumentAttr('contentBorderWidth', +$event)" />
                    <span class="nes-static-unit">px</span>
                  </span>
                </label>
              </div>
              <div class="nes-control-row">
                <label>
                  Email font size
                  <span class="nes-unit-field">
                    <input type="number" min="1" [ngModel]="dimensionValue(documentAttrs, 'contentFontSize', 13)" (ngModelChange)="updateDocumentAttr('contentFontSize', +$event)" />
                    <span class="nes-static-unit">px</span>
                  </span>
                </label>
              </div>
              <div class="nes-field">
                <label [attr.for]="fontFamilyInputId">Email font family</label>
                <div class="nes-font-family-autocomplete" (click)="$event.stopPropagation()">
                  <input
                    [id]="fontFamilyInputId"
                    class="nes-font-family-input"
                    role="combobox"
                    aria-autocomplete="list"
                    [attr.aria-controls]="fontFamilyOptionsListId"
                    [attr.aria-expanded]="fontFamilyAutocompleteOpen && filteredEmailFontFamilyOptions.length > 0"
                    [value]="fontFamilyInputValue"
                    (focusin)="openFontFamilyAutocomplete()"
                    (input)="onFontFamilyInput($any($event.target).value)"
                    placeholder="Ubuntu, Helvetica, Arial, sans-serif"
                  />
                  <div class="nes-font-family-panel" *ngIf="fontFamilyAutocompleteOpen && filteredEmailFontFamilyOptions.length" [id]="fontFamilyOptionsListId" role="listbox">
                    <button
                      type="button"
                      class="nes-font-family-option"
                      role="option"
                      *ngFor="let option of filteredEmailFontFamilyOptions"
                      [attr.data-value]="option.value"
                      (mousedown)="selectFontFamilyOption(option.value); $event.preventDefault()"
                      (click)="selectFontFamilyOption(option.value)"
                    >
                      <span class="nes-font-family-label">{{ option.label }}</span>
                      <span class="nes-font-family-value">{{ option.value }}</span>
                    </button>
                  </div>
                </div>
                <span class="nes-field-hint">Choose a preset or type a custom font stack.</span>
              </div>
              <div class="nes-field">
                <label [attr.for]="fontCssUrlInputId">Import font CSS URL</label>
                <input
                  [id]="fontCssUrlInputId"
                  class="nes-font-css-url-input"
                  [value]="fontCssUrlInputValue"
                  (focusin)="openFontCssUrlInput()"
                  (input)="onFontCssUrlInput($any($event.target).value)"
                  (focusout)="closeFontCssUrlInput()"
                  placeholder="https://fonts.googleapis.com/css?family=Ubuntu:300,400,500,700"
                />
                <span class="nes-field-hint">Imported into exported HTML as a safe HTTPS stylesheet URL.</span>
              </div>
              <label>
                Email border color
                <span class="nes-color-control">
                  <input type="color" [ngModel]="colorPickerValue(documentAttrs['contentBorderColor'], '#d9e2ec')" (ngModelChange)="updateDocumentColorAttr('contentBorderColor', $event)" />
                  <input [ngModel]="documentColorText('contentBorderColor')" (ngModelChange)="updateDocumentColorAttr('contentBorderColor', $event)" placeholder="#d9e2ec" />
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
              <p class="nes-muted">Controls the exported <code>&lt;mj-body&gt;</code>, HTML wrapper width, font size, border, and rounded corners separately.</p>
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

              <div *ngIf="node.type === 'row' && (node.children?.length || 0) === 2" class="nes-field-block">
                <div class="nes-control-heading">Column ratio</div>
                <div class="nes-ratio-group" role="group" aria-label="Two column ratio presets">
                  <button type="button" *ngFor="let ratio of twoColumnRatios" [class.is-active]="rowRatioLabel(node) === ratio.label" (click)="setTwoColumnRatio(node, ratio.left, ratio.right)">{{ ratio.label }}</button>
                </div>
              </div>

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
                        <button type="button" (mousedown)="$event.preventDefault()" class="nes-tiptap-icon-btn" aria-label="Undo" title="Undo" [disabled]="readonly" (click)="runTiptapCommand('inline', 'undo')"><i class="nes-icon fa fa-undo" aria-hidden="true"></i></button>
                        <button type="button" class="nes-tiptap-icon-btn" aria-label="Redo" title="Redo" (mousedown)="$event.preventDefault()" [disabled]="readonly" (click)="runTiptapCommand('inline', 'redo')"><i class="nes-icon fa fa-repeat" aria-hidden="true"></i></button>
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
                        <button type="button" class="nes-tiptap-icon-btn" aria-label="Insert image" title="Insert image" (mousedown)="$event.preventDefault()" (click)="runTiptapCommand('inline', 'image')"><i class="nes-icon fa fa-picture-o" aria-hidden="true"></i></button>
                        <button type="button" class="nes-tiptap-icon-btn nes-tiptap-source-btn" aria-label="Edit HTML source" title="Edit HTML source" (mousedown)="$event.preventDefault()" (click)="openRichTextSource('inline')"><i class="nes-icon fa fa-code" aria-hidden="true"></i></button>
                      </div>
                      <span class="nes-tiptap-row-break" aria-hidden="true"></span>
                      <div class="nes-tiptap-group nes-tiptap-table-group">
                        <button type="button" class="nes-tiptap-table-btn" (mousedown)="$event.preventDefault()" (click)="insertTiptapTable('inline', 3, 3)"><i class="nes-icon fa fa-table" aria-hidden="true"></i><span>Table</span></button>
                        <button type="button" class="nes-tiptap-chip-btn" aria-label="Insert 2 by 2 table" (mousedown)="$event.preventDefault()" (click)="insertTiptapTable('inline', 2, 2)">2×2</button>
                      </div>
                      <details class="nes-tiptap-table-tools">
                        <summary title="Show table tools"><span>Table tools</span></summary>
                        <div class="nes-tiptap-table-tools-panel">
                          <div class="nes-tiptap-group nes-tiptap-table-group">
                            <button type="button" class="nes-tiptap-chip-btn" aria-label="Insert 3 by 3 table" (mousedown)="$event.preventDefault()" (click)="insertTiptapTable('inline', 3, 3)">3×3</button>
                            <button type="button" class="nes-tiptap-chip-btn" aria-label="Insert 4 by 4 table" (mousedown)="$event.preventDefault()" (click)="insertTiptapTable('inline', 4, 4)">4×4</button>
                          </div>
                          <div class="nes-tiptap-group nes-tiptap-table-group">
                            <button type="button" class="nes-tiptap-chip-btn" aria-label="Add column" title="Add column" (mousedown)="$event.preventDefault()" (click)="runTiptapCommand('inline', 'addColumnAfter')">+ Col</button>
                            <button type="button" class="nes-tiptap-chip-btn" aria-label="Add row" title="Add row" (mousedown)="$event.preventDefault()" (click)="runTiptapCommand('inline', 'addRowAfter')">+ Row</button>
                          </div>
                          <div class="nes-tiptap-group nes-tiptap-table-group">
                            <button type="button" class="nes-tiptap-chip-btn nes-tiptap-danger-btn" aria-label="Delete column" title="Delete column" (mousedown)="$event.preventDefault()" (click)="runTiptapCommand('inline', 'deleteColumn')">− Col</button>
                            <button type="button" class="nes-tiptap-chip-btn nes-tiptap-danger-btn" aria-label="Delete row" title="Delete row" (mousedown)="$event.preventDefault()" (click)="runTiptapCommand('inline', 'deleteRow')">− Row</button>
                            <button type="button" class="nes-tiptap-icon-btn nes-tiptap-danger-btn" aria-label="Delete table" title="Delete table" (mousedown)="$event.preventDefault()" (click)="runTiptapCommand('inline', 'deleteTable')"><i class="nes-icon fa fa-trash" aria-hidden="true"></i></button>
                          </div>
                          <div class="nes-tiptap-group nes-tiptap-table-group">
                            <button type="button" class="nes-tiptap-chip-btn" aria-label="Merge cells" title="Merge cells" (mousedown)="$event.preventDefault()" (click)="runTiptapCommand('inline', 'mergeCells')">Merge</button>
                            <button type="button" class="nes-tiptap-chip-btn" aria-label="Split cell" title="Split cell" (mousedown)="$event.preventDefault()" (click)="runTiptapCommand('inline', 'splitCell')">Split</button>
                            <button type="button" class="nes-tiptap-chip-btn" aria-label="Toggle header row" title="Toggle header row" (mousedown)="$event.preventDefault()" (click)="runTiptapCommand('inline', 'toggleHeaderRow')">Head row</button>
                          </div>
                          <div class="nes-tiptap-group nes-tiptap-table-group nes-tiptap-style-group">
                            <label class="nes-tiptap-color-control" title="Cell background"><span>Bg</span><input type="color" aria-label="Cell background color" [value]="currentTiptapCellStyle('inline', 'backgroundColor') || '#ffffff'" (mousedown)="$event.stopPropagation()" (change)="setTiptapCellStyle('inline', 'backgroundColor', $any($event.target).value)" /></label>
                            <label class="nes-tiptap-color-control" title="Cell border color"><span>Border</span><input type="color" aria-label="Cell border color" [value]="currentTiptapCellStyle('inline', 'borderColor') || '#cbd5e1'" (mousedown)="$event.stopPropagation()" (change)="setTiptapCellStyle('inline', 'borderColor', $any($event.target).value)" /></label>
                          </div>
                          <div class="nes-tiptap-group nes-tiptap-table-group nes-tiptap-style-group">
                            <button type="button" class="nes-tiptap-chip-btn" aria-label="Set cell width" title="Set cell width" (mousedown)="$event.preventDefault()" (click)="openTiptapCellStyleModal('inline', 'width', 'Cell width (px, %, auto)', '100%')">W</button>
                            <button type="button" class="nes-tiptap-chip-btn" aria-label="Set cell height" title="Set cell height" (mousedown)="$event.preventDefault()" (click)="openTiptapCellStyleModal('inline', 'height', 'Cell height (px, auto)', '48px')">H</button>
                            <button type="button" class="nes-tiptap-chip-btn" aria-label="Set cell padding" title="Set cell padding" (mousedown)="$event.preventDefault()" (click)="openTiptapCellStyleModal('inline', 'padding', 'Cell padding (px)', '8px')">Pad</button>
                            <button type="button" class="nes-tiptap-chip-btn" aria-label="Set border width" title="Set border width" (mousedown)="$event.preventDefault()" (click)="openTiptapCellStyleModal('inline', 'borderWidth', 'Border width (px)', '1px')">Bdr</button>
                          </div>
                        </div>
                      </details>
                    </div>
                    <div class="nes-tiptap-editor" [attr.data-tiptap-editor]="node.id" (mousedown)="guardTiptapBlankMouseDown($event, 'inline')" (click)="$event.stopPropagation()"></div>
                  </div>
                  <textarea *ngSwitchDefault [ngModel]="node.attrs['content']" (ngModelChange)="updateAttr(node, 'content', $event)"></textarea>
                </ng-container>
              </div>

              <div *ngIf="node.type === 'image'" class="nes-image-source-panel">
                <label>
                  Image URL
                  <input [ngModel]="node.attrs['src']" (ngModelChange)="updateAttr(node, 'src', $event)" />
                </label>
                <div class="nes-image-upload-helper" *ngIf="hasImageUploadHelper">
                  <input
                    #imageUploadInput
                    class="nes-file-input"
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    tabindex="-1"
                    [disabled]="readonly || isAnyImageUploading()"
                    (change)="uploadImageForNode(node, $event)"
                  />
                  <button type="button" class="nes-secondary-action nes-image-upload-btn" [disabled]="readonly || isAnyImageUploading()" (click)="imageUploadInput.click()">
                    <i class="nes-icon fa fa-upload" aria-hidden="true"></i>
                    {{ isImageUploading(node) ? 'Uploading image…' : 'Upload image' }}
                  </button>
                  <p class="nes-muted">Choose a local image. The host app uploads it and returns the final URL.</p>
                </div>
                <div class="nes-image-upload-error" role="alert" *ngIf="imageUploadErrorFor(node)">{{ imageUploadErrorFor(node) }}</div>
                <div class="nes-image-preview" *ngIf="imagePreviewSrc(node) as previewSrc">
                  <div class="nes-image-preview-frame">
                    <img [src]="previewSrc" [alt]="node.attrs['alt'] || 'Image preview'" />
                  </div>
                  <div class="nes-image-preview-meta" role="status" aria-live="polite">
                    <span>{{ imagePreviewLabel(node) }}</span>
                    <span *ngIf="isImageUploading(node)">Uploading…</span>
                  </div>
                </div>
              </div>
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

              <div *ngIf="node.type === 'social'" class="nes-field-block nes-social-editor">
                <div class="nes-control-heading">Social links</div>
                <div class="nes-social-item-editor" *ngFor="let item of socialEditorItems(node); let i = index; trackBy: trackSocialItem">
                  <span class="nes-social-editor-preview" [class.has-logo]="!!socialLogoSrc(item)" [style.background]="item.backgroundColor">
                    <img *ngIf="socialLogoSrc(item) as logoSrc" [src]="logoSrc" [alt]="item.name || 'Social logo'" />
                    <ng-container *ngIf="!socialLogoSrc(item)">{{ socialIconLabel(item.name) }}</ng-container>
                  </span>
                  <label>
                    Icon
                    <input [ngModel]="item.name" (ngModelChange)="updateSocialItemAttr(node, i, 'name', $event)" placeholder="facebook" />
                  </label>
                  <label>
                    Href
                    <input [ngModel]="item.href" (ngModelChange)="updateSocialItemAttr(node, i, 'href', $event)" placeholder="https://" />
                  </label>
                  <label>
                    Logo URL
                    <input [ngModel]="item.logoUrl || ''" (ngModelChange)="updateSocialItemAttr(node, i, 'logoUrl', $event)" placeholder="https://cdn.example.com/icon.png" />
                  </label>
                  <div class="nes-social-logo-upload" *ngIf="hasImageUploadHelper">
                    <input
                      #socialLogoUploadInput
                      class="nes-file-input nes-social-logo-upload-input"
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      tabindex="-1"
                      [disabled]="readonly || isAnyImageUploading()"
                      (change)="uploadSocialLogoForItem(node, i, $event)"
                    />
                    <button type="button" class="nes-secondary-action nes-image-upload-btn" [disabled]="readonly || isAnyImageUploading()" (click)="socialLogoUploadInput.click()">
                      <i class="nes-icon fa fa-upload" aria-hidden="true"></i>
                      {{ isSocialLogoUploading(node, i) ? 'Uploading logo…' : 'Upload logo' }}
                    </button>
                    <div class="nes-image-upload-error" role="alert" *ngIf="socialLogoUploadErrorFor(node, i)">{{ socialLogoUploadErrorFor(node, i) }}</div>
                  </div>
                  <label>
                    Icon bg
                    <span class="nes-color-control">
                      <input type="color" [ngModel]="colorPickerValue(item.backgroundColor, '#A1A0A0')" (ngModelChange)="updateSocialItemAttr(node, i, 'backgroundColor', $event)" />
                      <input [ngModel]="item.backgroundColor" (ngModelChange)="updateSocialItemAttr(node, i, 'backgroundColor', $event)" />
                    </span>
                  </label>
                  <button type="button" class="nes-small-danger" [disabled]="socialEditorItems(node).length <= 1" (click)="removeSocialItem(node, i)">Remove</button>
                </div>
                <button type="button" (click)="addSocialItem(node)"><i class="nes-icon fa fa-plus" aria-hidden="true"></i> Add social icon</button>
              </div>

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
              <div class="nes-field-block" *ngIf="node.type === 'image'">
                <div class="nes-control-heading">Image size</div>
                <label>
                  Image width
                  <span class="nes-unit-field">
                    <input type="number" min="1" [ngModel]="dimensionValue(node.attrs, 'width', 100)" (ngModelChange)="updateAttr(node, 'width', +$event)" />
                    <select [ngModel]="dimensionUnit(node.attrs, 'width', '%')" (ngModelChange)="updateAttr(node, 'widthUnit', $event)">
                      <option *ngFor="let unit of unitOptions" [value]="unit">{{ unit }}</option>
                    </select>
                  </span>
                </label>
              </div>
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
                  <input type="color" [ngModel]="colorPickerValue(node.attrs['backgroundColor'], node.type === 'button' ? '#7c3aed' : '#ffffff')" (ngModelChange)="updateColorAttr(node, 'backgroundColor', $event)" />
                  <input [ngModel]="colorText(node, 'backgroundColor')" (ngModelChange)="updateColorAttr(node, 'backgroundColor', $event)" placeholder="transparent" />
                </span>
              </label>
              <label *ngIf="node.type === 'button'">
                Border radius
                <span class="nes-unit-field">
                  <input type="number" min="0" [ngModel]="buttonBorderRadiusValue(node)" (ngModelChange)="updateAttr(node, 'borderRadius', +$event)" />
                  <span class="nes-static-unit">px</span>
                </span>
              </label>
              <div class="nes-field-block" *ngIf="node.type === 'social'">
                <div class="nes-control-heading">Social style</div>
                <div class="nes-control-row">
                  <label>
                    Icon size
                    <input [ngModel]="node.attrs['iconSize'] || '30px'" (ngModelChange)="updateAttr(node, 'iconSize', $event)" />
                  </label>
                  <label>
                    Font size
                    <input [ngModel]="node.attrs['fontSize'] || '15px'" (ngModelChange)="updateAttr(node, 'fontSize', $event)" />
                  </label>
                  <label>
                    Mode
                    <select [ngModel]="node.attrs['mode'] || 'horizontal'" (ngModelChange)="updateAttr(node, 'mode', $event)">
                      <option value="horizontal">horizontal</option>
                      <option value="vertical">vertical</option>
                    </select>
                  </label>
                </div>
              </div>
              <label *ngIf="node.type === 'divider'">
                Border color
                <span class="nes-color-control">
                  <input type="color" [ngModel]="colorPickerValue(node.attrs['borderColor'], '#d0d5dd')" (ngModelChange)="updateColorAttr(node, 'borderColor', $event)" />
                  <input [ngModel]="colorText(node, 'borderColor')" (ngModelChange)="updateColorAttr(node, 'borderColor', $event)" placeholder="#d0d5dd" />
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

      <ngx-email-studio-import-modal
        *ngIf="importModalOpen"
        [draft]="mjmlDraft"
        [errorMessage]="importErrorMessage"
        (draftChange)="mjmlDraft = $event"
        (close)="closeImportModal()"
        (importMjml)="importMjml()"
      />

      <ngx-email-studio-data-set-modal
        *ngIf="dataSetModalOpen"
        [items]="normalizedDataSet"
        [copiedKey]="dataSetCopiedKey"
        [copyState]="dataSetCopyState"
        (close)="closeDataSetModal()"
        (copy)="copyDataSetKey($event)"
      />

      <ngx-email-studio-transform-modal
        *ngIf="transformModalOpen"
        [action]="transformAction"
        [scope]="transformScope"
        [preview]="transformPreview"
        [loading]="transformPreviewLoading"
        [applying]="transformApplyLoading"
        [readonly]="readonly"
        [errorMessage]="transformErrorMessage"
        (close)="closeTransformModal()"
        (actionChange)="setTransformAction($event)"
        (apply)="applyTransform()"
      />

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
                    <button type="button" class="nes-tiptap-icon-btn" aria-label="Undo" title="Undo" (mousedown)="$event.preventDefault()" [disabled]="readonly" (click)="runTiptapCommand('modal', 'undo')"><i class="nes-icon fa fa-undo" aria-hidden="true"></i></button>
                    <button type="button" class="nes-tiptap-icon-btn" aria-label="Redo" title="Redo" (mousedown)="$event.preventDefault()" [disabled]="readonly" (click)="runTiptapCommand('modal', 'redo')"><i class="nes-icon fa fa-repeat" aria-hidden="true"></i></button>
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
                    <button type="button" class="nes-tiptap-icon-btn" aria-label="Insert image" title="Insert image" (mousedown)="$event.preventDefault()" (click)="runTiptapCommand('modal', 'image')"><i class="nes-icon fa fa-picture-o" aria-hidden="true"></i></button>
                    <button type="button" class="nes-tiptap-icon-btn nes-tiptap-source-btn" aria-label="Edit HTML source" title="Edit HTML source" (mousedown)="$event.preventDefault()" (click)="openRichTextSource('modal')"><i class="nes-icon fa fa-code" aria-hidden="true"></i></button>
                  </div>
                  <span class="nes-tiptap-row-break" aria-hidden="true"></span>
                  <div class="nes-tiptap-group nes-tiptap-table-group">
                    <button type="button" class="nes-tiptap-table-btn" (mousedown)="$event.preventDefault()" (click)="insertTiptapTable('modal', 3, 3)"><i class="nes-icon fa fa-table" aria-hidden="true"></i><span>Table</span></button>
                    <button type="button" class="nes-tiptap-chip-btn" aria-label="Insert 2 by 2 table" (mousedown)="$event.preventDefault()" (click)="insertTiptapTable('modal', 2, 2)">2×2</button>
                  </div>
                  <details class="nes-tiptap-table-tools">
                    <summary title="Show table tools"><span>Table tools</span></summary>
                    <div class="nes-tiptap-table-tools-panel">
                      <div class="nes-tiptap-group nes-tiptap-table-group">
                        <button type="button" class="nes-tiptap-chip-btn" aria-label="Insert 3 by 3 table" (mousedown)="$event.preventDefault()" (click)="insertTiptapTable('modal', 3, 3)">3×3</button>
                        <button type="button" class="nes-tiptap-chip-btn" aria-label="Insert 4 by 4 table" (mousedown)="$event.preventDefault()" (click)="insertTiptapTable('modal', 4, 4)">4×4</button>
                      </div>
                      <div class="nes-tiptap-group nes-tiptap-table-group">
                        <button type="button" class="nes-tiptap-chip-btn" aria-label="Add column" title="Add column" (mousedown)="$event.preventDefault()" (click)="runTiptapCommand('modal', 'addColumnAfter')">+ Col</button>
                        <button type="button" class="nes-tiptap-chip-btn" aria-label="Add row" title="Add row" (mousedown)="$event.preventDefault()" (click)="runTiptapCommand('modal', 'addRowAfter')">+ Row</button>
                      </div>
                      <div class="nes-tiptap-group nes-tiptap-table-group">
                        <button type="button" class="nes-tiptap-chip-btn nes-tiptap-danger-btn" aria-label="Delete column" title="Delete column" (mousedown)="$event.preventDefault()" (click)="runTiptapCommand('modal', 'deleteColumn')">− Col</button>
                        <button type="button" class="nes-tiptap-chip-btn nes-tiptap-danger-btn" aria-label="Delete row" title="Delete row" (mousedown)="$event.preventDefault()" (click)="runTiptapCommand('modal', 'deleteRow')">− Row</button>
                        <button type="button" class="nes-tiptap-icon-btn nes-tiptap-danger-btn" aria-label="Delete table" title="Delete table" (mousedown)="$event.preventDefault()" (click)="runTiptapCommand('modal', 'deleteTable')"><i class="nes-icon fa fa-trash" aria-hidden="true"></i></button>
                      </div>
                      <div class="nes-tiptap-group nes-tiptap-table-group">
                        <button type="button" class="nes-tiptap-chip-btn" aria-label="Merge cells" title="Merge cells" (mousedown)="$event.preventDefault()" (click)="runTiptapCommand('modal', 'mergeCells')">Merge</button>
                        <button type="button" class="nes-tiptap-chip-btn" aria-label="Split cell" title="Split cell" (mousedown)="$event.preventDefault()" (click)="runTiptapCommand('modal', 'splitCell')">Split</button>
                        <button type="button" class="nes-tiptap-chip-btn" aria-label="Toggle header row" title="Toggle header row" (mousedown)="$event.preventDefault()" (click)="runTiptapCommand('modal', 'toggleHeaderRow')">Head row</button>
                      </div>
                      <div class="nes-tiptap-group nes-tiptap-table-group nes-tiptap-style-group">
                        <label class="nes-tiptap-color-control" title="Cell background"><span>Bg</span><input type="color" aria-label="Cell background color" [value]="currentTiptapCellStyle('modal', 'backgroundColor') || '#ffffff'" (mousedown)="$event.stopPropagation()" (change)="setTiptapCellStyle('modal', 'backgroundColor', $any($event.target).value)" /></label>
                        <label class="nes-tiptap-color-control" title="Cell border color"><span>Border</span><input type="color" aria-label="Cell border color" [value]="currentTiptapCellStyle('modal', 'borderColor') || '#cbd5e1'" (mousedown)="$event.stopPropagation()" (change)="setTiptapCellStyle('modal', 'borderColor', $any($event.target).value)" /></label>
                      </div>
                      <div class="nes-tiptap-group nes-tiptap-table-group nes-tiptap-style-group">
                        <button type="button" class="nes-tiptap-chip-btn" aria-label="Set cell width" title="Set cell width" (mousedown)="$event.preventDefault()" (click)="openTiptapCellStyleModal('modal', 'width', 'Cell width (px, %, auto)', '100%')">W</button>
                        <button type="button" class="nes-tiptap-chip-btn" aria-label="Set cell height" title="Set cell height" (mousedown)="$event.preventDefault()" (click)="openTiptapCellStyleModal('modal', 'height', 'Cell height (px, auto)', '48px')">H</button>
                        <button type="button" class="nes-tiptap-chip-btn" aria-label="Set cell padding" title="Set cell padding" (mousedown)="$event.preventDefault()" (click)="openTiptapCellStyleModal('modal', 'padding', 'Cell padding (px)', '8px')">Pad</button>
                        <button type="button" class="nes-tiptap-chip-btn" aria-label="Set border width" title="Set border width" (mousedown)="$event.preventDefault()" (click)="openTiptapCellStyleModal('modal', 'borderWidth', 'Border width (px)', '1px')">Bdr</button>
                      </div>
                    </div>
                  </details>
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

      <div class="nes-modal-backdrop" *ngIf="tiptapPrompt as prompt" (click)="closeTiptapPrompt()">
        <section class="nes-tiptap-prompt-modal" role="dialog" aria-modal="true" [attr.aria-label]="prompt.title" (click)="$event.stopPropagation()">
          <header>
            <div class="nes-modal-heading">
              <span class="nes-modal-icon"><i class="nes-icon fa" [class]="'nes-icon fa ' + prompt.icon" aria-hidden="true"></i></span>
              <div>
                <p>{{ prompt.eyebrow }}</p>
                <h3>{{ prompt.title }}</h3>
              </div>
            </div>
            <button type="button" aria-label="Close editor tool modal" (click)="closeTiptapPrompt()"><i class="nes-icon fa fa-times" aria-hidden="true"></i></button>
          </header>
          <div class="nes-tiptap-prompt-body">
            <div class="nes-modal-intro">
              <strong>{{ prompt.label }}</strong>
              <p class="nes-muted">{{ prompt.description }}</p>
            </div>
            <label class="nes-tiptap-prompt-field">
              <span>{{ prompt.label }}</span>
              <input
                name="tiptapPromptValue"
                [ngModel]="tiptapPromptValue"
                (ngModelChange)="tiptapPromptValue = $event; tiptapPromptError = ''"
                [placeholder]="prompt.placeholder"
                (keydown.enter)="applyTiptapPrompt(); $event.preventDefault()"
              />
            </label>
            <div class="nes-tiptap-prompt-hint" *ngIf="prompt.kind === 'link'">
              <i class="nes-icon fa fa-shield" aria-hidden="true"></i> Supports https, mailto, tel, anchors, and root-relative URLs. Leave blank to remove the link.
            </div>
            <div class="nes-tiptap-prompt-hint" *ngIf="prompt.kind === 'image'">
              <i class="nes-icon fa fa-shield" aria-hidden="true"></i> Supports safe image URLs: http(s), cid attachments, or root-relative paths.
            </div>
            <div class="nes-tiptap-image-upload" *ngIf="prompt.kind === 'image' && hasImageUploadHelper">
              <input
                #tiptapImageUploadInput
                class="nes-file-input"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                tabindex="-1"
                [disabled]="readonly || isTiptapPromptUploading()"
                (change)="uploadTiptapImageFromPromptEvent($event)"
              />
              <button type="button" class="nes-secondary-action nes-image-upload-btn" [disabled]="readonly || isTiptapPromptUploading()" (click)="tiptapImageUploadInput.click()">
                <i class="nes-icon fa fa-upload" aria-hidden="true"></i>
                {{ isTiptapPromptUploading() ? 'Uploading image…' : 'Upload image' }}
              </button>
              <p class="nes-muted">Choose a local image. The host upload helper returns the final image URL.</p>
            </div>
            <div class="nes-import-error" role="alert" *ngIf="tiptapPromptError"><i class="nes-icon fa fa-exclamation-triangle" aria-hidden="true"></i> {{ tiptapPromptError }}</div>
          </div>
          <footer class="nes-modal-footer">
            <button type="button" (click)="closeTiptapPrompt()">Cancel</button>
            <button type="button" class="nes-primary" (click)="applyTiptapPrompt()"><i class="nes-icon fa fa-check" aria-hidden="true"></i> Apply</button>
          </footer>
        </section>
      </div>

      <ngx-email-studio-output-modal
        *ngIf="outputModalType"
        [type]="outputModalType"
        [title]="outputModalTitle"
        [content]="outputModalContent"
        [copyState]="copyState"
        [unsupported]="emailDocument.unsupported || []"
        (close)="closeOutputModal()"
        (preview)="previewHtmlOutput()"
        (copy)="copyOutputToClipboard()"
      />
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
        <section *ngSwitchCase="'row'" class="nes-render-row" [style.background]="backgroundFor(node)">
          <div
            cdkDropList
            class="nes-render-column"
            *ngFor="let column of node.children || []; let columnIndex = index; trackBy: trackNode"
            [id]="dropListIdFor(column)"
            [cdkDropListData]="childrenOf(column)"
            [cdkDropListConnectedTo]="connectedDropListIds"
            [cdkDropListDisabled]="readonly"
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
              [cdkDragDisabled]="isCanvasNodeDragDisabled(child)"
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
          [style.background]="backgroundFor(node)"
          [style.width]="sectionWidthCss(node)"
          [style.max-width]="sectionMaxWidthCss(node)"
          [style.padding]="sectionPaddingCss(node)"
          [attr.data-node-id]="node.id"
          [cdkDropListData]="childrenOf(node)"
          [cdkDropListConnectedTo]="connectedDropListIds"
          [cdkDropListDisabled]="readonly"
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
            [cdkDragDisabled]="isCanvasNodeDragDisabled(child)"
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
        <div *ngSwitchCase="'text'" class="nes-render-text" [style.text-align]="contentAlign(node)" [style.background]="backgroundFor(node)" [style.padding]="contentPaddingCss(node, 28)" [style.color]="textColorCss(node)" [style.font-family]="textFontFamilyCss(node)" [style.font-weight]="textFontWeightCss(node)" [style.font-size]="textFontSizeCss(node)" [style.line-height]="textLineHeightCss(node)" [innerHTML]="trustedRichText(node.attrs['content'])"></div>
        <div *ngSwitchCase="'image'" class="nes-render-image-wrap" [style.text-align]="contentAlign(node)" [style.background]="backgroundFor(node)" [style.padding]="contentPaddingCss(node, 0)">
          <img class="nes-render-image" [src]="node.attrs['src']" [alt]="node.attrs['alt'] || ''" [style.width]="imageWidthCss(node)" />
        </div>
        <div *ngSwitchCase="'button'" class="nes-render-button-wrap" [style.text-align]="contentAlign(node)" [style.padding]="contentPaddingCss(node, 24)">
          <a class="nes-render-button" [style.background]="backgroundFor(node)" [style.color]="buttonTextColorCss(node)" [style.border-radius]="buttonBorderRadiusCss(node)">{{ node.attrs['label'] }}</a>
        </div>
        <div *ngSwitchCase="'social'" class="nes-render-social-wrap" [class.is-vertical]="socialModeValue(node) === 'vertical'" [class.is-align-center]="contentAlign(node) === 'center'" [class.is-align-right]="contentAlign(node) === 'right'" [style.text-align]="contentAlign(node)" [style.background]="backgroundFor(node)" [style.padding]="contentPaddingCss(node, 0)">
          <button type="button" class="nes-render-social-icon" *ngFor="let item of socialItems(node); trackBy: trackSocialItem" [attr.data-href]="item.href" [attr.aria-label]="socialPreviewLabel(item.name)" [class.has-logo]="!!socialLogoSrc(item)" [style.background]="item.backgroundColor" [style.width]="socialIconSizeCss(node)" [style.height]="socialIconSizeCss(node)" [style.line-height]="socialIconSizeCss(node)" [style.font-size]="socialFontSizeCss(node)" (click)="handleSocialIconPreviewClick($event, node.id)">
            <img *ngIf="socialLogoSrc(item) as logoSrc" [src]="logoSrc" [alt]="item.name || 'Social logo'" />
            <ng-container *ngIf="!socialLogoSrc(item)">{{ socialIconLabel(item.name) }}</ng-container>
          </button>
        </div>
        <hr *ngSwitchCase="'divider'" class="nes-render-divider" />
        <div *ngSwitchCase="'spacer'" [style.height.px]="node.attrs['height'] || 24"></div>
      </ng-container>
    </ng-template>
  `,
  styleUrl: './ngx-email-studio.css',
})
export class NgxEmailStudio implements OnChanges, DoCheck, AfterViewInit, AfterViewChecked, OnDestroy {
  @Input() mjml?: string;
  @Input() document?: EmailDocument;
  @Input() previewSize: EmailPreviewSize = 'desktop';
  @Input() readonly = false;
  @Input() showSave?: boolean;
  @Input() config?: EmailStudioConfig | null = DEFAULT_EMAIL_STUDIO_CONFIG;
  @Input() dataSet: EmailStudioDataSetItem[] = [];

  @Output() mjmlChange = new EventEmitter<string>();
  @Output() documentChange = new EventEmitter<EmailDocument>();
  @Output() htmlExport = new EventEmitter<string>();
  @Output() save = new EventEmitter<EmailStudioResult>();
  @Output() change = new EventEmitter<EmailStudioResult>();
  @Output() error = new EventEmitter<EmailStudioError>();

  palette: PaletteItem[] = [
    { type: 'section', label: 'Hero title', icon: 'fa-header', description: 'Campaign headline, kicker, summary', preset: 'hero' },
    { type: 'text', label: 'Text paragraph', icon: 'fa-align-left', description: 'Rich text body or CMS summary' },
    { type: 'button', label: 'CTA button', icon: 'fa-mouse-pointer', description: 'Link, registration, or purchase action' },
    { type: 'image', label: 'Image placeholder', icon: 'fa-picture-o', description: 'Hero image or product visual' },
    { type: 'social', label: 'Social icons', icon: 'fa-share-alt', description: 'MJML social links with icons and hrefs' },
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
  dataSetModalOpen = false;
  dataSetCopiedKey = '';
  dataSetCopyState = '';
  transformModalOpen = false;
  transformAction: EmailStudioTransformAction = 'simplified-to-traditional';
  transformScope: EmailStudioTransformScope = 'document';
  transformPreview: EmailStudioTransformPreview | null = null;
  transformPreviewLoading = false;
  transformApplyLoading = false;
  transformErrorMessage = '';
  imageUploadLoadingNodeId = '';
  imageUploadPreviewNodeId = '';
  imageUploadPreviewUrl = '';
  imageUploadPreviewName = '';
  imageUploadErrorNodeId = '';
  imageUploadErrorMessage = '';
  outputModalType: 'mjml' | 'html' | null = null;
  expandedRichTextNode?: EmailNode;
  sourceEditorScope: TiptapScope | null = null;
  sourceEditorNode: EmailNode | null = null;
  sourceEditorValue = '';
  sourceEditorWarning = '';
  tiptapPrompt: TiptapPromptConfig | null = null;
  tiptapPromptValue = '';
  tiptapPromptError = '';
  copyState = '';
  private tiptapInlineEditor?: TiptapEditor;
  private tiptapInlineNodeId?: string;
  private tiptapModalEditor?: TiptapEditor;
  private tiptapModalNodeId?: string;
  private tiptapToolbarState: Record<TiptapScope, TiptapToolbarState> = {
    inline: defaultTiptapToolbarState(),
    modal: defaultTiptapToolbarState(),
  };
  private tiptapToolbarStateTimers: Partial<Record<TiptapScope, ReturnType<typeof setTimeout>>> = {};
  private copyStateTimer: ReturnType<typeof setTimeout> | undefined;
  private dataSetCopyStateTimer: ReturnType<typeof setTimeout> | undefined;
  private transformPreviewRequestId = 0;
  private transformApplyRequestId = 0;
  private transformDestroyed = false;
  private imageUploadRequestId = 0;
  private imageUploadObjectUrl = '';
  private imageUploadHandlerSnapshot: EmailStudioImageUploadHandler | undefined;
  private imageUploadInvalidateScheduled = false;
  private templatePaletteCacheSource: EmailStudioTemplateModule[] | null = null;
  private templatePaletteCache: PaletteItem[] = [];
  private paletteItemsCache: PaletteItem[] = this.palette;
  private undoStack: EmailHistorySnapshot[] = [];
  private redoStack: EmailHistorySnapshot[] = [];
  private historySnapshot: EmailHistorySnapshot = this.createHistorySnapshot();
  private readonly socialItemsCache = new Map<string, { raw: unknown; parsed: SocialItem[] }>();
  private readonly socialDraftItemsCache = new Map<string, { raw: unknown; parsed: SocialItem[] }>();
  private activePointedDropListId?: string;
  readonly previewSizeOptions = [1200, 800, 600, 400];
  readonly unitOptions: EmailSizeUnit[] = ['px', '%'];
  readonly twoColumnRatios = [
    { label: '3:7', left: 30, right: 70 },
    { label: '4:6', left: 40, right: 60 },
    { label: '5:5', left: 50, right: 50 },
    { label: '6:4', left: 60, right: 40 },
    { label: '7:3', left: 70, right: 30 },
  ] as const;
  readonly tiptapBlockOptions: Array<{ label: string; value: TiptapHeadingValue }> = TIPTAP_BLOCK_OPTIONS;
  readonly tiptapFontSizeOptions = TIPTAP_FONT_SIZE_OPTIONS;
  readonly tiptapLineHeightOptions = TIPTAP_LINE_HEIGHT_OPTIONS;
  lastMjml = '';
  lastHtml = '';
  previewSrcdoc: SafeHtml | string = '';
  fontFamilyAutocompleteOpen = false;
  private fontFamilyAutocompleteQuery = '';
  private fontFamilyInputText = '';
  private fontCssUrlInputActive = false;
  private fontCssUrlInputText = '';

  private readonly dropListIdPrefix = createEmailStudioInstanceId();
  readonly rootDropListId = `${this.dropListIdPrefix}-root-drop-list`;
  readonly paletteDropListId = `${this.dropListIdPrefix}-palette-drop-list`;
  readonly fontFamilyInputId = `${this.dropListIdPrefix}-font-family-input`;
  readonly fontCssUrlInputId = `${this.dropListIdPrefix}-font-css-url-input`;
  readonly fontFamilyOptionsListId = `${this.dropListIdPrefix}-font-family-options`;
  readonly bodyNodeId = BODY_NODE_ID;
  readonly rejectPaletteDrop = (): boolean => false;
  readonly canEnterContainerDropList = (drag: { data: unknown }, drop: { id?: string }): boolean => {
    if (!this.canDropIntoContainer(drag.data, drop.id)) return false;
    const pointedDropListId = this.activePointedDropListId;
    if (!pointedDropListId || !this.shouldPreferPointedDropTarget(drag.data, drop.id)) return true;

    const pointedTarget = this.findNodeByDropListId(pointedDropListId);
    if (!pointedTarget || !this.canDropIntoContainer(drag.data, pointedDropListId)) return true;
    return false;
  };

  constructor(private readonly hostRef: ElementRef<HTMLElement>, private readonly sanitizer: DomSanitizer, private readonly changeDetector: ChangeDetectorRef) {}

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const path = event.composedPath?.() || [];
    if (!path.includes(this.hostRef.nativeElement)) this.closeTransientMenus();
  }

  @HostListener('document:pointermove', ['$event'])
  onDocumentPointerMove(event: PointerEvent): void {
    if (!this.dragInProgress) return;
    this.activePointedDropListId = this.findDeepestContainerDropListIdAtPoint(event.clientX, event.clientY);
  }

  @HostListener('document:keydown.escape')
  onDocumentEscape(): void {
    this.closeTransientMenus();
    if (this.outputModalType) this.closeOutputModal();
    if (this.tiptapPrompt) this.closeTiptapPrompt();
    if (this.sourceEditorScope) this.closeRichTextSource();
    if (this.importModalOpen) this.closeImportModal();
    if (this.dataSetModalOpen) this.closeDataSetModal();
    if (this.transformModalOpen) this.closeTransformModal();
    if (this.expandedRichTextNode) this.closeRichTextModal();
  }

  @HostListener('document:keydown', ['$event'])
  onDocumentKeydown(event: KeyboardEvent): void {
    if (!this.isHistoryShortcut(event)) return;
    event.preventDefault();
    if (this.isRedoShortcut(event)) {
      this.redoDocument();
      return;
    }
    this.undoDocument();
  }

  ngAfterViewInit(): void {
    this.syncTiptapEditors();
  }

  ngAfterViewChecked(): void {
    this.syncTiptapEditors();
    this.syncHistoryControls();
  }

  ngOnDestroy(): void {
    this.transformDestroyed = true;
    this.transformPreviewRequestId += 1;
    this.transformApplyRequestId += 1;
    this.imageUploadRequestId += 1;
    this.revokeImageUploadObjectUrl();
    this.destroyTiptapEditors();
    if (this.copyStateTimer) clearTimeout(this.copyStateTimer);
    if (this.dataSetCopyStateTimer) clearTimeout(this.dataSetCopyStateTimer);
  }

  get connectedDropListIds(): string[] {
    return [this.paletteDropListId, this.rootDropListId, ...this.collectContainerDropListIds(this.emailDocument.body)];
  }

  get filteredPalette(): PaletteItem[] {
    const query = this.paletteSearch.trim().toLowerCase();
    const items = this.paletteItems;
    if (!query) return items;
    return items.filter((item) => `${item.label} ${item.description}`.toLowerCase().includes(query));
  }

  get paletteItems(): PaletteItem[] {
    return this.paletteItemsCache;
  }

  get customTemplatePaletteItems(): PaletteItem[] {
    return this.templatePaletteCache;
  }

  private refreshTemplatePaletteCache(): void {
    const templates = Array.isArray(this.effectiveConfig.templates) ? this.effectiveConfig.templates : [];
    if (templates === this.templatePaletteCacheSource) return;
    this.templatePaletteCacheSource = templates;
    this.templatePaletteCache = templates.map((template) => this.templateToPaletteItem(template)).filter((item): item is PaletteItem => !!item);
    this.paletteItemsCache = this.templatePaletteCache.length ? [...this.palette, ...this.templatePaletteCache] : this.palette;
  }

  get normalizedDataSet(): EmailStudioDataSetItem[] {
    return (this.dataSet || [])
      .map((item) => ({ key: String(item?.key || '').trim(), desc: String(item?.desc || '').trim() }))
      .filter((item) => !!item.key);
  }

  get hasDataSetItems(): boolean {
    return this.normalizedDataSet.length > 0;
  }

  get selectedNode(): EmailNode | undefined {
    if (this.selectedNodeId === BODY_NODE_ID) return undefined;
    return this.findNode(this.selectedNodeId);
  }

  get documentAttrs(): Record<string, string | number | boolean> {
    return { ...this.defaultDocumentAttrs(), ...(this.emailDocument.attrs || {}) };
  }

  get bodyBackgroundColor(): string {
    return normalizeColorValue(this.documentAttrs['backgroundColor']) || String(this.documentAttrs['backgroundColor'] ?? '').trim() || 'transparent';
  }

  get emailBackgroundColor(): string {
    return normalizeColorValue(this.documentAttrs['contentBackgroundColor']) || String(this.documentAttrs['contentBackgroundColor'] ?? '').trim() || 'transparent';
  }

  get emailWidth(): number {
    return this.dimensionValue(this.documentAttrs, 'width', 100);
  }

  get emailWidthCss(): string {
    return dimensionCss(this.documentAttrs, 'width', 100, '%');
  }

  get emailMaxWidthCss(): string {
    return dimensionCss(this.documentAttrs, 'maxWidth', 600, 'px');
  }

  get emailCanvasWidthCss(): string {
    return this.containedCssSize(this.emailWidthCss);
  }

  get emailCanvasMaxWidthCss(): string {
    return this.containedCssSize(this.emailMaxWidthCss);
  }

  get emailBorderRadiusCss(): string {
    return `${this.nonNegativeNumber(this.documentAttrs['contentBorderRadius'], 16)}px`;
  }

  get emailBorderStyle(): string {
    const width = this.nonNegativeNumber(this.documentAttrs['contentBorderWidth'], 0);
    if (width <= 0) return 'none';
    const color = normalizeColorValue(this.documentAttrs['contentBorderColor']) || '#d9e2ec';
    return `${width}px solid ${color}`;
  }

  get emailFontSizeCss(): string {
    return `${this.nonNegativeNumber(this.documentAttrs['contentFontSize'], 13)}px`;
  }

  get emailFontFamilyCss(): string {
    return normalizeFontFamilyValue(this.documentAttrs['contentFontFamily']) || 'Ubuntu, Helvetica, Arial, sans-serif';
  }

  get emailFontCssUrl(): string {
    const attrs = this.emailDocument.attrs || {};
    if (Object.prototype.hasOwnProperty.call(attrs, 'contentFontCssUrl')) {
      const raw = String(attrs['contentFontCssUrl'] ?? '').trim();
      return raw === '' ? '' : normalizeFontCssUrlValue(raw);
    }
    return normalizeFontCssUrlValue(this.defaultDocumentAttrs()['contentFontCssUrl']) || 'https://fonts.googleapis.com/css?family=Ubuntu:300,400,500,700';
  }

  get fontCssUrlInputValue(): string {
    return this.fontCssUrlInputActive ? this.fontCssUrlInputText : this.emailFontCssUrl;
  }

  get fontFamilyInputValue(): string {
    return this.fontFamilyAutocompleteOpen ? this.fontFamilyInputText : this.emailFontFamilyCss;
  }

  get emailFontFamilyOptions(): EmailStudioFontFamilyOption[] {
    const seen = new Set<string>();
    return [...DEFAULT_EMAIL_FONT_FAMILY_OPTIONS, ...this.hostFontFamilyOptions]
      .filter((option): option is EmailStudioFontFamilyOption => !!option && typeof option === 'object')
      .map((option) => ({ label: String(option.label ?? '').trim(), value: normalizeFontFamilyValue(option.value) }))
      .filter((option): option is EmailStudioFontFamilyOption => {
        if (!option.label || !option.value || seen.has(option.value)) return false;
        seen.add(option.value);
        return true;
      });
  }

  get filteredEmailFontFamilyOptions(): EmailStudioFontFamilyOption[] {
    const query = this.fontFamilyAutocompleteQuery.trim().toLowerCase();
    if (!query) return this.emailFontFamilyOptions;
    return this.emailFontFamilyOptions.filter((option) => `${option.label} ${option.value}`.toLowerCase().includes(query));
  }

  private get hostFontFamilyOptions(): EmailStudioFontFamilyOption[] {
    const options = this.config?.fontFamilyOptions;
    return Array.isArray(options) ? options : [];
  }

  get effectiveConfig(): EmailStudioConfig {
    return { ...DEFAULT_EMAIL_STUDIO_CONFIG, ...(this.config || {}) };
  }

  get hasImageUploadHelper(): boolean {
    return typeof this.effectiveConfig.uploadImage === 'function';
  }

  get resolvedRichTextEditor(): RichTextEditorMode {
    return this.effectiveConfig.richTextEditor === 'plain' ? 'plain' : 'tiptap';
  }

  get resolvedUseTiptap(): boolean {
    return this.resolvedRichTextEditor === 'tiptap';
  }

  get resolvedShowSave(): boolean {
    return this.showSave ?? this.effectiveConfig.showSave !== false;
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

  get canRedoDocument(): boolean {
    return !this.readonly && this.redoStack.length > 0;
  }

  get canUndoDocument(): boolean {
    return !this.readonly && this.undoStack.length > 0;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['config'] || changes['readonly']) {
      this.invalidateImageUpload();
      this.imageUploadHandlerSnapshot = this.effectiveConfig.uploadImage;
    }

    if (changes['config']) {
      this.refreshTemplatePaletteCache();
      this.destroyTiptapEditors();
    }

    if (changes['document'] || changes['mjml']) {
      this.mjmlDraft = this.mjml || '';
      const nextDocument = this.mjml
        ? this.parseMjml(this.mjml)
        : this.document
          ? structuredClone(this.document)
          : this.createStarterDocument();
      this.replaceEmailDocument(nextDocument, false);
    }
  }

  ngDoCheck(): void {
    this.refreshTemplatePaletteCache();
    const currentUploadHandler = this.effectiveConfig.uploadImage;
    if (this.imageUploadHandlerSnapshot !== currentUploadHandler) {
      this.imageUploadHandlerSnapshot = currentUploadHandler;
      this.scheduleImageUploadInvalidation();
    }
  }

  drop(event: CdkDragDrop<EmailNode[], EmailNode[] | PaletteItem[]>): void {
    if (this.readonly) return;
    const target = this.resolveDropTarget(event);
    if (target.id === this.paletteDropListId) return;
    if (!this.canDropIntoContainer(event.item.data, target.id)) return;
    if (event.previousContainer === event.container && target.data === event.container.data) {
      moveItemInArray(target.data, event.previousIndex, target.index);
      this.emitDocument();
      return;
    }

    if (this.isPaletteItem(event.item.data)) {
      const nodes = this.createNodesForDrop(event.item.data, target.id);
      target.data.splice(target.index, 0, ...nodes);
      this.selectedNodeId = nodes[0]?.id;
    } else {
      const [movedNode] = (event.previousContainer.data as EmailNode[]).splice(event.previousIndex, 1);
      const node = this.wrapForRootDrop(movedNode, target.id);
      target.data.splice(target.index, 0, node);
      this.selectedNodeId = node.id;
    }
    this.emitDocument();
  }

  private resolveDropTarget(event: CdkDragDrop<EmailNode[], EmailNode[] | PaletteItem[]>): { id?: string; data: EmailNode[]; index: number } {
    const containerId = (event.container as { id?: string }).id;
    if (containerId === this.rootDropListId && this.shouldRerouteRootDropFromPoint(event.item.data)) {
      const nestedTarget = this.resolveNestedDropTargetFromPoint(event);
      if (nestedTarget && this.canDropIntoContainer(event.item.data, nestedTarget.id)) return nestedTarget;
    }
    return { id: containerId, data: event.container.data as EmailNode[], index: event.currentIndex };
  }

  private shouldRerouteRootDropFromPoint(data: unknown): boolean {
    if (this.isPaletteItem(data) && (data.type === 'section' || data.type === 'row')) return false;
    return true;
  }

  private shouldPreferPointedDropTarget(data: unknown, dropId?: string): boolean {
    if (!this.activePointedDropListId || dropId === this.activePointedDropListId) return false;
    if (!this.shouldRerouteRootDropFromPoint(data)) return false;
    return true;
  }

  private resolveNestedDropTargetFromPoint(event: CdkDragDrop<EmailNode[], EmailNode[] | PaletteItem[]>): { id: string; data: EmailNode[]; index: number } | null {
    const point = (event as CdkDragDrop<EmailNode[], EmailNode[] | PaletteItem[]> & { dropPoint?: { x: number; y: number } }).dropPoint;
    if (!point) return null;

    const target = this.findDeepestContainerAtPoint(point.x, point.y);
    if (!target) return null;
    return {
      id: this.dropListIdFor(target.node),
      data: this.childrenOf(target.node),
      index: this.dropInsertionIndex(target.element, point.y),
    };
  }

  private findDeepestContainerDropListIdAtPoint(x: number, y: number): string | undefined {
    const target = this.findDeepestContainerAtPoint(x, y);
    return target ? this.dropListIdFor(target.node) : undefined;
  }

  private findDeepestContainerAtPoint(x: number, y: number): { element: HTMLElement; node: EmailNode } | null {
    const doc = this.hostRef.nativeElement.ownerDocument;
    const elements = typeof doc.elementsFromPoint === 'function'
      ? doc.elementsFromPoint(x, y)
      : [doc.elementFromPoint(x, y)].filter((element): element is Element => !!element);
    const seen = new Set<HTMLElement>();
    for (const element of elements) {
      const container = element.closest?.('.nes-render-column[data-node-id], .nes-render-section[data-node-id]') as HTMLElement | null;
      if (!container || seen.has(container) || !this.hostRef.nativeElement.contains(container)) continue;
      seen.add(container);
      const nodeId = container.getAttribute('data-node-id') || '';
      const node = this.findNode(nodeId);
      if (!node || (node.type !== 'column' && node.type !== 'section')) continue;
      return { element: container, node };
    }
    return null;
  }

  private dropInsertionIndex(container: HTMLElement, y: number): number {
    const children = Array.from(container.querySelectorAll<HTMLElement>(':scope > .nes-child-node[data-node-id]'));
    const index = children.findIndex((child) => {
      const box = child.getBoundingClientRect();
      return y < box.top + box.height / 2;
    });
    return index < 0 ? children.length : index;
  }

  trackNode(_: number, node: EmailNode): string {
    return node.id;
  }

  trackSocialItem(index: number, item: SocialItem): string {
    return `${index}:${item.name}:${item.href}:${item.backgroundColor}`;
  }

  handleSocialIconPreviewClick(event: MouseEvent, nodeId: string): void {
    event.preventDefault();
    event.stopPropagation();
    this.selectNode(nodeId);
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
    if (this.readonly) return;
    this.dragInProgress = true;
    this.activePointedDropListId = undefined;
    this.clearNativeSelection();
  }

  isCanvasNodeDragDisabled(node: EmailNode): boolean {
    return this.readonly;
  }

  endDrag(): void {
    this.dragInProgress = false;
    this.activePointedDropListId = undefined;
    this.clearNativeSelection();
  }

  clearNativeSelection(): void {
    globalThis.getSelection?.()?.removeAllRanges();
  }

  closeTransientMenus(): void {
    this.exportMenuOpen = false;
    this.fontFamilyAutocompleteOpen = false;
    this.fontFamilyAutocompleteQuery = '';
    this.fontFamilyInputText = '';
    this.fontCssUrlInputActive = false;
    this.fontCssUrlInputText = '';
  }

  openFontFamilyAutocomplete(): void {
    this.fontFamilyAutocompleteOpen = true;
    this.fontFamilyAutocompleteQuery = '';
    this.fontFamilyInputText = this.emailFontFamilyCss;
  }

  onFontFamilyInput(value: unknown): void {
    const text = String(value ?? '');
    this.fontFamilyAutocompleteOpen = true;
    this.fontFamilyAutocompleteQuery = text;
    this.fontFamilyInputText = text;
    this.updateDocumentFontFamilyAttr('contentFontFamily', text);
  }

  selectFontFamilyOption(value: string): void {
    this.updateDocumentFontFamilyAttr('contentFontFamily', value);
    this.fontFamilyInputText = value;
    this.fontFamilyAutocompleteOpen = false;
    this.fontFamilyAutocompleteQuery = '';
  }

  sanitizedRichText(value: unknown): string {
    return this.sanitizeRichTextContent(value);
  }

  trustedRichText(value: unknown): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(this.sanitizeRichTextContent(value));
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
    const nodes = this.createNodesForDrop(item, this.rootDropListId);
    this.emailDocument.body = [...this.emailDocument.body, ...nodes];
    this.selectedNodeId = nodes[0]?.id;
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
    if (item.templateMjml) return this.createNodesFromTemplateMjml(item.templateMjml)[0] || this.createNode('text');

    if (item.preset === 'hero') {
      return this.createSectionWithChildren([
        this.createNode('text', {
          content: '<p class="kicker">Campaign update</p><h1>Your weekly newsletter is ready to edit</h1><p>Create polished, responsive email campaigns with editable MJML blocks and a visual Angular builder.</p>',
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

  private templateToPaletteItem(template: EmailStudioTemplateModule): PaletteItem | null {
    const name = String(template?.name || '').trim();
    const mjml = String(template?.mjml || '').trim();
    if (!name || !mjml) return null;
    const icon = String(template.icon || '').trim();
    const iconUrl = this.safeTemplateIconUrl(icon);
    return {
      type: 'section',
      label: name.slice(0, 80),
      icon: iconUrl ? 'fa-th-large' : this.safeFontAwesomeIcon(icon) || 'fa-th-large',
      description: String(template.desc || 'Custom MJML template').trim().slice(0, 140),
      templateMjml: mjml,
      templateIconUrl: iconUrl,
    };
  }

  private safeFontAwesomeIcon(value: string): string {
    const normalized = value.trim().replace(/^fa\s+/, '').split(/\s+/)[0] || '';
    return /^fa-[a-z0-9-]{1,48}$/i.test(normalized) ? normalized : '';
  }

  private safeTemplateIconUrl(value: string): string {
    const raw = value.trim();
    if (!raw) return '';
    if (/^https?:\/\//i.test(raw)) return raw;
    if (/^\/(?!\/)/.test(raw)) return raw;
    if (/^data:image\/(png|jpe?g|gif|webp);base64,[a-z0-9+/=]+$/i.test(raw)) return raw;
    return '';
  }

  clearDocument(): void {
    if (this.readonly) return;
    this.emailDocument = { ...this.emailDocument, body: [] };
    this.selectedNodeId = undefined;
    this.emitDocument();
  }

  undoDocument(): void {
    if (!this.canUndoDocument) return;
    const previous = this.undoStack.pop();
    if (!previous) return;
    this.redoStack.push(this.createHistorySnapshot());
    this.trimRedoStack();
    this.applyHistorySnapshot(previous);
  }

  redoDocument(): void {
    if (!this.canRedoDocument) return;
    const next = this.redoStack.pop();
    if (!next) return;
    this.undoStack.push(this.createHistorySnapshot());
    this.trimUndoStack();
    this.applyHistorySnapshot(next);
  }

  undoDocumentFromToolbar(): void {
    this.undoDocument();
    this.changeDetector.detectChanges();
  }

  redoDocumentFromToolbar(): void {
    this.redoDocument();
    this.changeDetector.detectChanges();
  }

  outlineLabel(node: EmailNode): string {
    return getOutlineLabel(node);
  }

  outlineMeta(node: EmailNode): string {
    return getOutlineMeta(node);
  }

  outlineIcon(node: EmailNode): string {
    return getOutlineIcon(node);
  }

  get totalOutlineNodes(): number {
    return 1 + countOutlineNodes(this.emailDocument.body);
  }

  private countOutlineNodes(nodes: EmailNode[]): number {
    return countOutlineNodes(nodes);
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

  imagePreviewSrc(node: EmailNode): string {
    if (node.type !== 'image') return '';
    if (this.imageUploadPreviewNodeId === node.id && this.imageUploadPreviewUrl) return this.imageUploadPreviewUrl;
    return String(node.attrs['src'] || '').trim();
  }

  imagePreviewLabel(node: EmailNode): string {
    if (this.imageUploadPreviewNodeId === node.id && this.imageUploadPreviewName) return `Selected file: ${this.imageUploadPreviewName}`;
    return String(node.attrs['src'] || '').trim() ? 'Current image preview' : 'Image preview';
  }

  isImageUploading(node: EmailNode): boolean {
    return this.imageUploadLoadingNodeId === node.id;
  }

  isAnyImageUploading(): boolean {
    return !!this.imageUploadLoadingNodeId;
  }

  imageUploadErrorFor(node: EmailNode): string {
    return this.imageUploadErrorNodeId === node.id ? this.imageUploadErrorMessage : '';
  }

  async uploadImageForNode(node: EmailNode, event: Event): Promise<void> {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0];
    if (input) input.value = '';
    const uploadImage = this.effectiveConfig.uploadImage;
    if (!file || node.type !== 'image' || this.readonly || !uploadImage) return;
    const runUploadImage = uploadImage;
    if (this.imageUploadLoadingNodeId) return;

    const nodeId = node.id;
    const requestId = ++this.imageUploadRequestId;
    this.imageUploadLoadingNodeId = nodeId;
    this.imageUploadErrorNodeId = '';
    this.imageUploadErrorMessage = '';

    try {
      if (!this.isSupportedImageUploadFile(file)) {
        throw new Error('Please choose a PNG, JPEG, WebP, or GIF image file.');
      }
      this.imageUploadPreviewNodeId = nodeId;
      this.imageUploadPreviewName = file.name || 'Selected image';
      this.setImageUploadPreviewUrl(file);
      const result = await runUploadImage(file, {
        nodeId,
        currentUrl: String(node.attrs['src'] || ''),
        currentAlt: String(node.attrs['alt'] || ''),
      });
      if (requestId !== this.imageUploadRequestId || this.readonly || this.effectiveConfig.uploadImage !== runUploadImage) {
        this.clearImageUploadPreview();
        return;
      }
      const liveNode = this.findNode(nodeId);
      if (!liveNode || liveNode.type !== 'image') {
        this.clearImageUploadPreview();
        return;
      }
      const uploadResult = this.normalizeImageUploadResult(result);
      const url = normalizeImageSrcValue(uploadResult.url);
      if (!url) throw new Error('The upload helper did not return a safe image URL.');
      const nextAttrs: Record<string, string | number | boolean> = { ...liveNode.attrs, src: url };
      if (typeof uploadResult.alt === 'string' && uploadResult.alt.trim()) nextAttrs['alt'] = uploadResult.alt.trim();
      liveNode.attrs = nextAttrs;
      this.clearImageUploadPreview();
      this.emitDocument();
    } catch (details) {
      if (requestId !== this.imageUploadRequestId) return;
      this.clearImageUploadPreview();
      const message = details instanceof Error && details.message ? details.message : 'Unable to upload image. Please try again.';
      this.imageUploadErrorNodeId = nodeId;
      this.imageUploadErrorMessage = message;
      this.error.emit({ code: 'image_upload_failed', message, details });
    } finally {
      if (requestId === this.imageUploadRequestId) this.imageUploadLoadingNodeId = '';
    }
  }

  private normalizeImageUploadResult(result: string | EmailStudioImageUploadResult): EmailStudioImageUploadResult {
    return typeof result === 'string' ? { url: result } : result;
  }

  private isSupportedImageUploadFile(file: File): boolean {
    const supportedTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
    if (file.type) return supportedTypes.includes(file.type);
    return /\.(png|jpe?g|webp|gif)$/i.test(file.name || '');
  }

  private setImageUploadPreviewUrl(file: File): void {
    this.revokeImageUploadObjectUrl();
    if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
      this.imageUploadPreviewUrl = '';
      return;
    }
    this.imageUploadObjectUrl = URL.createObjectURL(file);
    this.imageUploadPreviewUrl = this.imageUploadObjectUrl;
  }

  private clearImageUploadPreview(revoke = true): void {
    if (revoke) this.revokeImageUploadObjectUrl();
    this.imageUploadPreviewNodeId = '';
    this.imageUploadPreviewUrl = '';
    this.imageUploadPreviewName = '';
  }

  private scheduleImageUploadInvalidation(): void {
    if (this.imageUploadInvalidateScheduled) return;
    this.imageUploadInvalidateScheduled = true;
    queueMicrotask(() => {
      this.imageUploadInvalidateScheduled = false;
      if (this.transformDestroyed) return;
      this.invalidateImageUpload();
    });
  }

  private invalidateImageUpload(): void {
    if (!this.imageUploadLoadingNodeId && !this.imageUploadPreviewUrl && !this.imageUploadErrorMessage) return;
    this.imageUploadRequestId += 1;
    this.imageUploadLoadingNodeId = '';
    this.imageUploadErrorNodeId = '';
    this.imageUploadErrorMessage = '';
    this.clearImageUploadPreview();
  }

  private revokeImageUploadObjectUrl(): void {
    if (!this.imageUploadObjectUrl || typeof URL === 'undefined' || typeof URL.revokeObjectURL !== 'function') return;
    URL.revokeObjectURL(this.imageUploadObjectUrl);
    this.imageUploadObjectUrl = '';
  }

  updateColorAttr(node: EmailNode, key: string, value: string): void {
    if (this.readonly) return;
    const normalized = normalizeColorValue(value);
    const nextAttrs = { ...node.attrs };
    if (String(value ?? '').trim() === '') {
      delete nextAttrs[key];
    } else {
      nextAttrs[key] = normalized || String(value).trim();
    }
    node.attrs = nextAttrs;
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
  updateDocumentColorAttr(key: string, value: string): void {
    if (this.readonly) return;
    const trimmed = String(value ?? '').trim();
    const normalized = normalizeColorValue(trimmed);
    const attrs = { ...this.defaultDocumentAttrs(), ...(this.emailDocument.attrs || {}) };
    if (trimmed === '') {
      attrs[key] = '';
    } else {
      attrs[key] = normalized || trimmed;
    }
    this.emailDocument = { ...this.emailDocument, attrs };
    this.emitDocument();
  }

  updateDocumentFontFamilyAttr(key: string, value: string): void {
    if (this.readonly) return;
    const normalized = normalizeFontFamilyValue(value);
    const attrs = { ...this.defaultDocumentAttrs(), ...(this.emailDocument.attrs || {}) };
    if (String(value ?? '').trim() === '') {
      attrs[key] = '';
    } else if (normalized) {
      attrs[key] = normalized;
    } else {
      return;
    }
    this.emailDocument = { ...this.emailDocument, attrs };
    this.emitDocument();
  }

  updateDocumentFontCssUrlAttr(value: string): void {
    if (this.readonly) return;
    const trimmed = String(value ?? '').trim();
    const normalized = normalizeFontCssUrlValue(trimmed);
    const attrs = { ...this.defaultDocumentAttrs(), ...(this.emailDocument.attrs || {}) };
    if (trimmed === '') {
      attrs['contentFontCssUrl'] = '';
    } else if (normalized) {
      attrs['contentFontCssUrl'] = normalized;
    } else {
      delete attrs['contentFontCssUrl'];
    }
    this.emailDocument = { ...this.emailDocument, attrs };
    this.emitDocument();
  }

  openFontCssUrlInput(): void {
    this.fontCssUrlInputActive = true;
    this.fontCssUrlInputText = this.emailFontCssUrl;
  }

  onFontCssUrlInput(value: unknown): void {
    const text = String(value ?? '');
    this.fontCssUrlInputActive = true;
    this.fontCssUrlInputText = text;
    if (text.trim() === '' || normalizeFontCssUrlValue(text)) {
      this.updateDocumentFontCssUrlAttr(text);
    }
  }

  closeFontCssUrlInput(): void {
    this.fontCssUrlInputActive = false;
    this.fontCssUrlInputText = '';
  }

  colorPickerValue(value: unknown, fallback = '#ffffff'): string {
    return getColorPickerValue(value, fallback);
  }

  colorText(node: EmailNode, key: string): string {
    return normalizeColorValue(node.attrs[key]) || String(node.attrs[key] ?? '').trim();
  }

  documentColorText(key: string): string {
    return normalizeColorValue(this.documentAttrs[key]) || String(this.documentAttrs[key] ?? '').trim();
  }

  dimensionValue(attrs: Record<string, string | number | boolean>, key: string, fallback: number): number {
    return dimensionValue(attrs, key, fallback);
  }

  dimensionUnit(attrs: Record<string, string | number | boolean>, key: string, fallback: EmailSizeUnit): EmailSizeUnit {
    return dimensionUnit(attrs, key, fallback);
  }

  private nonNegativeNumber(value: unknown, fallback: number): number {
    const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value ?? ''));
    return Number.isFinite(parsed) ? Math.max(0, parsed) : fallback;
  }

  sectionWidthCss(section: EmailNode): string {
    return dimensionCss(section.attrs, 'width', 100, '%');
  }

  sectionMaxWidthCss(section: EmailNode): string {
    return dimensionCss(section.attrs, 'maxWidth', 600, 'px');
  }

  columnWidthCss(column: EmailNode, fallback = 100, fallbackUnit: EmailSizeUnit = '%'): string {
    return dimensionCss(column.attrs, 'width', fallback, fallbackUnit);
  }

  columnMaxWidthCss(column: EmailNode): string {
    return dimensionCss(column.attrs, 'maxWidth', 600, 'px');
  }

  imageWidthCss(image: EmailNode): string {
    return getImageWidthCss(image);
  }

  dimensionValueFromCss(value: string): number {
    return parseDimensionValueFromCss(value);
  }

  dimensionUnitFromCss(value: string): EmailSizeUnit {
    return parseDimensionUnitFromCss(value);
  }

  paddingUnit(section: EmailNode): EmailSizeUnit {
    return sectionPaddingUnit(section);
  }

  paddingValue(section: EmailNode, key: 'padding' | 'paddingTop' | 'paddingRight' | 'paddingBottom' | 'paddingLeft'): number {
    return sectionPaddingValue(section, key);
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
    return sectionPaddingToCss(section);
  }

  contentPaddingCss(node: EmailNode, fallback: number): string {
    return nodePaddingToCss(node, fallback);
  }

  textColorCss(node: EmailNode): string | null {
    return normalizeColorValue(node.attrs['color']) || null;
  }

  textFontFamilyCss(node: EmailNode): string | null {
    return normalizeFontFamilyValue(node.attrs['fontFamily']) || null;
  }

  textFontWeightCss(node: EmailNode): string | null {
    return normalizeFontWeightValue(node.attrs['fontWeight']) || null;
  }

  textFontSizeCss(node: EmailNode): string | null {
    return normalizeCssSizeValue(node.attrs['fontSize']) || null;
  }

  textLineHeightCss(node: EmailNode): string | null {
    return normalizeLineHeightValue(node.attrs['lineHeight']) || null;
  }

  isAlignableContent(node: EmailNode): boolean {
    return isAlignableEmailContent(node);
  }

  contentAlign(node: EmailNode): 'left' | 'center' | 'right' {
    return getContentAlign(node);
  }

  backgroundFor(node: EmailNode): string {
    return getBackgroundFor(node.attrs);
  }

  buttonBorderRadiusValue(node: EmailNode): number {
    const raw = node.attrs['borderRadius'];
    if (typeof raw === 'number' && Number.isFinite(raw)) return Math.max(0, raw);
    const parsed = Number.parseFloat(String(raw ?? '10').replace(/px$/i, ''));
    return Number.isFinite(parsed) ? Math.max(0, parsed) : 10;
  }

  buttonBorderRadiusCss(node: EmailNode): string {
    return `${this.buttonBorderRadiusValue(node)}px`;
  }

  buttonTextColorCss(node: EmailNode): string {
    return normalizeColorValue(node.attrs['color']) || '#ffffff';
  }

  socialItems(node: EmailNode): SocialItem[] {
    return this.cachedSocialItems(this.socialItemsCache, node, parseSocialItems);
  }

  socialEditorItems(node: EmailNode): SocialItem[] {
    return this.cachedSocialItems(this.socialDraftItemsCache, node, parseSocialDraftItems);
  }

  private cachedSocialItems(cache: Map<string, { raw: unknown; parsed: SocialItem[] }>, node: EmailNode, parser: (value: unknown) => SocialItem[]): SocialItem[] {
    const raw = node.attrs['items'];
    const cached = cache.get(node.id);
    if (cached && cached.raw === raw) return cached.parsed;
    const parsed = parser(raw);
    cache.set(node.id, { raw, parsed });
    return parsed;
  }

  socialIconLabel(name: string): string {
    return getSocialIconLabel(name);
  }

  socialLogoSrc(item: SocialItem): string {
    return normalizeImageSrcValue(item.logoUrl);
  }

  socialUploadNodeId(node: EmailNode, index: number): string {
    return `${node.id}:${index}`;
  }

  isSocialLogoUploading(node: EmailNode, index: number): boolean {
    return this.imageUploadLoadingNodeId === this.socialUploadNodeId(node, index);
  }

  socialLogoUploadErrorFor(node: EmailNode, index: number): string {
    return this.imageUploadErrorNodeId === this.socialUploadNodeId(node, index) ? this.imageUploadErrorMessage : '';
  }

  async uploadSocialLogoForItem(node: EmailNode, index: number, event: Event): Promise<void> {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0];
    if (input) input.value = '';
    const uploadImage = this.effectiveConfig.uploadImage;
    if (!file || node.type !== 'social' || this.readonly || !uploadImage) return;
    if (this.imageUploadLoadingNodeId) return;
    const items = this.socialEditorItems(node);
    const item = items[index];
    if (!item) return;

    const uploadNodeId = this.socialUploadNodeId(node, index);
    const requestId = ++this.imageUploadRequestId;
    const runUploadImage = uploadImage;
    this.imageUploadLoadingNodeId = uploadNodeId;
    this.imageUploadErrorNodeId = '';
    this.imageUploadErrorMessage = '';

    try {
      if (!this.isSupportedImageUploadFile(file)) {
        throw new Error('Please choose a PNG, JPEG, WebP, or GIF image file.');
      }
      this.imageUploadPreviewNodeId = uploadNodeId;
      this.imageUploadPreviewName = file.name || 'Selected logo';
      this.setImageUploadPreviewUrl(file);
      const result = await runUploadImage(file, {
        nodeId: uploadNodeId,
        currentUrl: String(item.logoUrl || ''),
        currentAlt: String(item.name || ''),
      });
      if (requestId !== this.imageUploadRequestId || this.readonly || this.effectiveConfig.uploadImage !== runUploadImage) {
        this.clearImageUploadPreview();
        return;
      }
      const liveNode = this.findNode(node.id);
      if (!liveNode || liveNode.type !== 'social') {
        this.clearImageUploadPreview();
        return;
      }
      const uploadResult = this.normalizeImageUploadResult(result);
      const url = normalizeImageSrcValue(uploadResult.url);
      if (!url) throw new Error('The upload helper did not return a safe image URL.');
      const liveItems = this.socialEditorItems(liveNode).map((socialItem) => ({ ...socialItem }));
      if (!liveItems[index]) {
        this.clearImageUploadPreview();
        return;
      }
      liveItems[index].logoUrl = url;
      if (typeof uploadResult.alt === 'string' && uploadResult.alt.trim()) liveItems[index].name = uploadResult.alt.trim();
      liveNode.attrs = { ...liveNode.attrs, items: serializeSocialDraftItems(liveItems) };
      this.clearImageUploadPreview();
      this.emitDocument();
    } catch (details) {
      if (requestId !== this.imageUploadRequestId) return;
      this.clearImageUploadPreview();
      const message = details instanceof Error && details.message ? details.message : 'Unable to upload image. Please try again.';
      this.imageUploadErrorNodeId = uploadNodeId;
      this.imageUploadErrorMessage = message;
      this.error.emit({ code: 'image_upload_failed', message, details });
    } finally {
      if (requestId === this.imageUploadRequestId) this.imageUploadLoadingNodeId = '';
    }
  }

  socialPreviewLabel(name: string): string {
    return `Select ${name || 'social'} social link`;
  }

  socialModeValue(node: EmailNode): 'horizontal' | 'vertical' {
    return socialMode(node.attrs['mode']);
  }

  socialIconSizeCss(node: EmailNode): string {
    return socialCssSize(node.attrs['iconSize'], '30px');
  }

  socialFontSizeCss(node: EmailNode): string {
    return socialCssSize(node.attrs['fontSize'], '15px');
  }

  updateSocialItemAttr(node: EmailNode, index: number, key: keyof SocialItem, value: string): void {
    if (this.readonly || node.type !== 'social') return;
    const next = updateSocialItem(this.socialEditorItems(node), index, key, value);
    node.attrs = { ...node.attrs, items: serializeSocialDraftItems(next) };
    this.emitDocument();
  }

  addSocialItem(node: EmailNode): void {
    if (this.readonly || node.type !== 'social') return;
    const next = [...this.socialEditorItems(node), { name: 'social', href: '#', backgroundColor: '#A1A0A0' }];
    node.attrs = { ...node.attrs, items: serializeSocialDraftItems(next) };
    this.emitDocument();
  }

  removeSocialItem(node: EmailNode, index: number): void {
    if (this.readonly || node.type !== 'social') return;
    const next = this.socialEditorItems(node).filter((_, itemIndex) => itemIndex !== index);
    node.attrs = { ...node.attrs, items: serializeSocialDraftItems(next) };
    this.emitDocument();
  }

  sectionPaddingValue(section: EmailNode, key: 'padding' | 'paddingTop' | 'paddingRight' | 'paddingBottom' | 'paddingLeft', fallback = 0): number {
    return sectionPaddingValue(section, key);
  }

  rowRatioLabel(row: EmailNode): string {
    const columns = row.children || [];
    if (row.type !== 'row' || columns.length !== 2) return '';
    const left = Math.round(dimensionValue(columns[0].attrs, 'width', 50));
    const right = Math.round(dimensionValue(columns[1].attrs, 'width', 50));
    return `${left / 10}:${right / 10}`;
  }

  setTwoColumnRatio(row: EmailNode, left: number, right: number): void {
    if (this.readonly) return;
    if (row.type !== 'row') return;
    if ((row.children || []).length !== 2) this.setRowColumns(row, 2);
    const [first, second] = row.children || [];
    if (!first || !second) return;
    first.attrs = { ...first.attrs, width: left, widthUnit: '%' };
    second.attrs = { ...second.attrs, width: right, widthUnit: '%' };
    this.emitDocument();
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

  openDataSetModal(): void {
    if (!this.hasDataSetItems) return;
    this.closeTransientMenus();
    this.dataSetCopyState = '';
    this.dataSetCopiedKey = '';
    this.dataSetModalOpen = true;
  }

  closeDataSetModal(): void {
    this.dataSetModalOpen = false;
    this.dataSetCopyState = '';
    this.dataSetCopiedKey = '';
  }

  async copyDataSetKey(key: string): Promise<void> {
    const content = String(key || '').trim();
    if (!content) return;
    this.dataSetCopiedKey = content;
    try {
      if (globalThis.navigator?.clipboard?.writeText) {
        await globalThis.navigator.clipboard.writeText(content);
        this.setDataSetCopyState('Copied');
        return;
      }
      if (this.fallbackCopyToClipboard(content)) {
        this.setDataSetCopyState('Copied');
        return;
      }
    } catch {
      if (this.fallbackCopyToClipboard(content)) {
        this.setDataSetCopyState('Copied');
        return;
      }
    }
    this.setDataSetCopyState('Copy failed');
  }

  openTransformModal(): void {
    if (this.readonly) return;
    this.closeTransientMenus();
    this.transformScope = 'document';
    this.transformErrorMessage = '';
    this.transformModalOpen = true;
    void this.refreshTransformPreview();
  }

  closeTransformModal(): void {
    this.transformModalOpen = false;
    this.transformPreview = null;
    this.transformPreviewLoading = false;
    this.transformApplyLoading = false;
    this.transformErrorMessage = '';
    this.transformPreviewRequestId += 1;
    this.transformApplyRequestId += 1;
  }

  setTransformAction(action: EmailStudioTransformAction): void {
    if (this.readonly) return;
    this.transformAction = action;
    void this.refreshTransformPreview();
  }

  setTransformScope(_scope: EmailStudioTransformScope): void {
    this.transformScope = 'document';
    void this.refreshTransformPreview();
  }

  async applyTransform(): Promise<void> {
    if (this.readonly || this.transformPreviewLoading || this.transformApplyLoading) return;
    const requestId = ++this.transformApplyRequestId;
    this.transformApplyLoading = true;
    this.transformErrorMessage = '';
    try {
      const result = await transformEmailDocumentText(this.emailDocument, this.transformAction, this.transformScope);
      if (this.transformDestroyed || requestId !== this.transformApplyRequestId || !this.transformModalOpen) return;
      if (result.changedCount === 0) {
        this.transformPreview = { before: result.before, after: result.after, changedCount: result.changedCount };
        return;
      }
      this.emailDocument = result.document;
      this.closeTransformModal();
      this.emitDocument();
    } catch (details) {
      if (this.transformDestroyed || requestId !== this.transformApplyRequestId) return;
      this.transformErrorMessage = 'Unable to transform content. Please try again.';
      this.error.emit({ code: 'text_transform_failed', message: 'Unable to transform content.', details });
    } finally {
      if (!this.transformDestroyed && requestId === this.transformApplyRequestId) this.transformApplyLoading = false;
    }
  }

  private async refreshTransformPreview(): Promise<void> {
    if (!this.transformModalOpen) return;
    const requestId = ++this.transformPreviewRequestId;
    this.transformPreviewLoading = true;
    this.transformErrorMessage = '';
    try {
      const result = await transformEmailDocumentText(this.emailDocument, this.transformAction, this.transformScope);
      if (this.transformDestroyed || requestId !== this.transformPreviewRequestId) return;
      this.transformPreview = { before: result.before, after: result.after, changedCount: result.changedCount };
    } catch (details) {
      if (this.transformDestroyed || requestId !== this.transformPreviewRequestId) return;
      this.transformPreview = null;
      this.transformErrorMessage = 'Unable to prepare transform preview.';
      this.error.emit({ code: 'text_transform_preview_failed', message: 'Unable to prepare transform preview.', details });
    } finally {
      if (!this.transformDestroyed && requestId === this.transformPreviewRequestId) {
        this.transformPreviewLoading = false;
        this.changeDetector.detectChanges();
      }
    }
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
    this.closeTiptapPrompt();
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
    if (command === 'mergeCells') chain.mergeCells().run();
    if (command === 'splitCell') chain.splitCell().run();
    if (command === 'toggleHeaderRow') chain.toggleHeaderRow().run();
    if (command === 'toggleHeaderColumn') chain.toggleHeaderColumn().run();
    if (command === 'toggleHeaderCell') chain.toggleHeaderCell().run();
    if (command === 'undo') chain.undo().run();
    if (command === 'redo') chain.redo().run();
    if (command === 'unlink') chain.extendMarkRange('link').unsetLink().run();
    if (command === 'link') this.openTiptapLinkModal(scope);
    if (command === 'image') this.openTiptapImageModal(scope);
  }

  openTiptapImageModal(scope: TiptapScope): void {
    if (this.readonly) return;
    if (!this.tiptapEditor(scope)) return;
    this.tiptapPrompt = {
      kind: 'image',
      scope,
      title: 'Insert image',
      eyebrow: 'Rich text tool',
      label: 'Image URL',
      description: 'Insert an inline image into this rich text block from a safe URL or host upload helper.',
      placeholder: 'https://example.com/image.png',
      icon: 'fa-picture-o',
      value: '',
    };
    this.tiptapPromptValue = '';
    this.tiptapPromptError = '';
  }

  isTiptapPromptUploading(): boolean {
    return !!this.tiptapPrompt && this.tiptapPrompt.kind === 'image' && !!this.imageUploadLoadingNodeId;
  }

  uploadTiptapImageFromPromptEvent(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0];
    if (input) input.value = '';
    if (file) void this.uploadTiptapImageFromPrompt(file);
  }

  async uploadTiptapImageFromPrompt(file: File): Promise<void> {
    const prompt = this.tiptapPrompt;
    const uploadImage = this.effectiveConfig.uploadImage;
    if (!prompt || prompt.kind !== 'image' || this.readonly || !uploadImage || this.imageUploadLoadingNodeId) return;
    const node = prompt.scope === 'modal' ? this.expandedRichTextNode : this.selectedNode;
    if (!node || node.type !== 'text') return;
    const runUploadImage = uploadImage;
    const nodeId = node.id;
    const requestId = ++this.imageUploadRequestId;
    this.imageUploadLoadingNodeId = nodeId;
    this.tiptapPromptError = '';
    try {
      if (!this.isSupportedImageUploadFile(file)) {
        throw new Error('Please choose a PNG, JPEG, WebP, or GIF image file.');
      }
      const result = await runUploadImage(file, {
        nodeId,
        currentUrl: this.tiptapPromptValue.trim(),
        currentAlt: '',
      });
      if (requestId !== this.imageUploadRequestId || this.readonly || this.effectiveConfig.uploadImage !== runUploadImage) return;
      const uploadResult = this.normalizeImageUploadResult(result);
      const url = normalizeImageSrcValue(uploadResult.url);
      if (!url) throw new Error('The upload helper did not return a safe image URL.');
      this.insertTiptapImage(prompt.scope, url, typeof uploadResult.alt === 'string' ? uploadResult.alt.trim() : '');
      this.closeTiptapPrompt();
    } catch (details) {
      if (requestId !== this.imageUploadRequestId) return;
      const message = details instanceof Error && details.message ? details.message : 'Unable to upload image. Please try again.';
      this.tiptapPromptError = message;
      this.error.emit({ code: 'image_upload_failed', message, details });
    } finally {
      if (requestId === this.imageUploadRequestId) this.imageUploadLoadingNodeId = '';
    }
  }

  private insertTiptapImage(scope: TiptapScope, src: string, alt = ''): void {
    const editor = this.tiptapEditor(scope);
    if (!editor) return;
    this.ensureTiptapToolbarSelection(editor);
    editor.chain().focus().setImage({ src, alt }).run();
  }

  openTiptapLinkModal(scope: TiptapScope): void {
    if (this.readonly) return;
    const editor = this.tiptapEditor(scope);
    if (!editor) return;
    const currentHref = String(editor.getAttributes('link')['href'] || '');
    this.tiptapPrompt = {
      kind: 'link',
      scope,
      title: 'Edit link URL',
      eyebrow: 'Rich text tool',
      label: 'Link URL',
      description: 'Update the selected link target without leaving the editor flow.',
      placeholder: 'https://example.com',
      icon: 'fa-link',
      value: currentHref || 'https://',
    };
    this.tiptapPromptValue = this.tiptapPrompt.value;
    this.tiptapPromptError = '';
  }

  openTiptapCellStyleModal(scope: TiptapScope, name: string, label: string, fallback: string): void {
    if (this.readonly) return;
    if (!this.tiptapEditor(scope)) return;
    const currentValue = this.currentTiptapCellStyle(scope, name) || fallback;
    const shortLabel = label.replace(/\s*\([^)]*\)\s*/g, '').trim();
    this.tiptapPrompt = {
      kind: 'cell-style',
      scope,
      name,
      title: shortLabel,
      eyebrow: 'Table cell style',
      label: shortLabel,
      description: `Set ${shortLabel.toLowerCase()} for the current table cell selection. Invalid values are ignored.`,
      placeholder: fallback,
      icon: 'fa-table',
      value: currentValue,
    };
    this.tiptapPromptValue = currentValue;
    this.tiptapPromptError = '';
  }

  closeTiptapPrompt(): void {
    this.tiptapPrompt = null;
    this.tiptapPromptValue = '';
    this.tiptapPromptError = '';
  }

  applyTiptapPrompt(): void {
    const prompt = this.tiptapPrompt;
    if (!prompt || this.readonly) return;
    const editor = this.tiptapEditor(prompt.scope);
    if (!editor) {
      this.closeTiptapPrompt();
      return;
    }
    const value = this.tiptapPromptValue.trim();
    if (prompt.kind === 'link') {
      const chain = editor.chain().focus().extendMarkRange('link');
      if (!value) {
        chain.unsetLink().run();
        this.closeTiptapPrompt();
        return;
      }
      const safeHref = normalizeHrefValue(value);
      if (!safeHref) {
        this.tiptapPromptError = 'Enter a safe URL: https, mailto, tel, #anchor, or /relative-path.';
        return;
      }
      chain.setLink({ href: safeHref }).run();
      this.closeTiptapPrompt();
      return;
    }
    if (prompt.kind === 'image') {
      const safeSrc = normalizeImageSrcValue(value);
      if (!safeSrc) {
        this.tiptapPromptError = 'Enter a safe image URL: http(s), cid attachment, or /relative-path.';
        return;
      }
      this.insertTiptapImage(prompt.scope, safeSrc);
      this.closeTiptapPrompt();
      return;
    }
    if (prompt.kind === 'cell-style' && prompt.name) {
      const safeValue = this.sanitizeTiptapCellStyleValue(prompt.name, value);
      if (value && !safeValue) {
        this.tiptapPromptError = 'Enter a supported email-safe CSS value for this table cell.';
        return;
      }
      this.setTiptapCellStyle(prompt.scope, prompt.name, value);
      this.closeTiptapPrompt();
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
    const state = this.tiptapToolbarState[scope];
    if (attrs?.['textAlign']) return state.textAlign === attrs['textAlign'];
    return !!(state.activeMarks[name] || state.activeBlocks[name]);
  }

  currentTiptapBlockFormat(scope: TiptapScope): TiptapHeadingValue {
    return this.tiptapToolbarState[scope].blockFormat;
  }

  setTiptapBlockFormat(scope: TiptapScope, value: TiptapHeadingValue | string): void {
    if (this.readonly) return;
    const editor = this.tiptapEditor(scope);
    if (!editor) return;
    const chain = editor.chain().focus();
    if (value === 'paragraph') {
      this.setSelectedTiptapParagraphTag(editor, 'p');
      this.tiptapToolbarState[scope] = this.collectTiptapToolbarState(editor);
      return;
    }
    if (value === 'div') {
      this.setSelectedTiptapParagraphTag(editor, 'div');
      this.tiptapToolbarState[scope] = this.collectTiptapToolbarState(editor);
      return;
    }
    const level = Number(value);
    if ([1, 2, 3, 4, 5, 6].includes(level)) {
      chain.toggleHeading({ level: level as 1 | 2 | 3 | 4 | 5 | 6 }).run();
      this.tiptapToolbarState[scope] = this.collectTiptapToolbarState(editor);
    }
  }

  private setSelectedTiptapParagraphTag(editor: TiptapEditor, blockTag: 'p' | 'div'): void {
    editor.commands.focus();
    const paragraphType = editor.state.schema.nodes['paragraph'];
    if (!paragraphType) return;
    let transaction = editor.state.tr;
    let changed = false;
    editor.state.doc.nodesBetween(editor.state.selection.from, editor.state.selection.to, (node, pos) => {
      if (!node.isTextblock) return true;
      if (node.type.name === 'paragraph') {
        transaction = transaction.setNodeMarkup(pos, undefined, { ...node.attrs, blockTag });
        changed = true;
        return false;
      }
      if (node.type.name === 'heading') {
        const { level: _level, ...attrs } = node.attrs;
        transaction = transaction.setNodeMarkup(pos, paragraphType, { ...attrs, blockTag });
        changed = true;
        return false;
      }
      return false;
    });
    if (changed) {
      editor.view.dispatch(transaction.scrollIntoView());
      return;
    }
    editor.chain().focus().setNode('paragraph', { ...editor.getAttributes('paragraph'), blockTag }).run();
  }

  currentTiptapFontSize(scope: TiptapScope): string {
    return this.tiptapToolbarState[scope].fontSize;
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
    return this.tiptapToolbarState[scope].lineHeight;
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
    return this.tiptapToolbarState[scope].textAlign === align;
  }

  setTiptapTextAlign(scope: TiptapScope, align: TiptapTextAlignValue): void {
    if (this.readonly) return;
    this.tiptapEditor(scope)?.chain().focus().setTextAlign(align).run();
  }

  insertTiptapTable(scope: TiptapScope, rows: number, cols: number): void {
    if (this.readonly) return;
    const safeRows = Math.min(6, Math.max(1, Math.floor(rows)));
    const safeCols = Math.min(6, Math.max(1, Math.floor(cols)));
    const editor = this.tiptapEditor(scope);
    if (!editor) return;
    this.ensureTiptapToolbarSelection(editor);
    editor.chain().focus().insertTable({ rows: safeRows, cols: safeCols, withHeaderRow: true }).run();
  }

  private ensureTiptapToolbarSelection(editor: TiptapEditor): void {
    const selection = editor.state.selection;
    const docEnd = editor.state.doc.content.size;
    if (editor.isFocused || !selection.empty || selection.from < docEnd - 2) return;
    editor.commands.focus('start');
  }

  currentTiptapCellStyle(scope: TiptapScope, name: string): string {
    return this.tiptapToolbarState[scope].cellStyles[name] || '';
  }

  setTiptapCellStyle(scope: TiptapScope, name: string, value: string): void {
    if (this.readonly) return;
    const editor = this.tiptapEditor(scope);
    if (!editor) return;
    const safeValue = this.sanitizeTiptapCellStyleValue(name, value);
    editor.chain().focus().setCellAttribute(name, safeValue || null).run();
  }

  private sanitizeTiptapCellStyleValue(name: string, rawValue: string): string {
    const value = rawValue.trim();
    if (!value) return '';
    if ((name === 'backgroundColor' || name === 'borderColor') && /^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(value)) return value;
    if (name === 'borderWidth' && /^(0|[1-9][0-9]?)px$/.test(value)) return value;
    if (name === 'borderStyle' && /^(solid|dashed|dotted|double|none)$/.test(value)) return value;
    if (name === 'width' && /^(auto|100%|[1-9][0-9]{0,2}px|[1-9][0-9]?%)$/.test(value)) return value;
    if (name === 'height' && /^(auto|[1-9][0-9]{0,2}px)$/.test(value)) return value;
    if (name === 'padding' && /^(0|[1-9][0-9]?px)$/.test(value)) return value;
    return '';
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
    previewWindow.document.write(buildSandboxedPreviewShell(html));
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

  saveDocument(): void {
    this.save.emit(this.currentResult());
  }

  private currentResult(): EmailStudioResult {
    this.lastMjml = this.compileMjml(this.emailDocument);
    this.lastHtml = this.renderHtml(this.emailDocument);
    return { mjml: this.lastMjml, html: { html: this.lastHtml } };
  }

  private setCopyState(state: string): void {
    this.copyState = state;
    if (this.copyStateTimer) clearTimeout(this.copyStateTimer);
    this.copyStateTimer = setTimeout(() => (this.copyState = ''), 1800);
  }

  private setDataSetCopyState(state: string): void {
    this.dataSetCopyState = state;
    if (this.dataSetCopyStateTimer) clearTimeout(this.dataSetCopyStateTimer);
    this.dataSetCopyStateTimer = setTimeout(() => {
      this.dataSetCopyState = '';
      this.dataSetCopiedKey = '';
    }, 1800);
  }

  private fallbackCopyToClipboard(content: string): boolean {
    return fallbackCopyOutputToClipboard(content);
  }

  private emitDocument(): void {
    this.emailDocument = { ...this.emailDocument, body: [...this.emailDocument.body] };
    this.recordHistoryBeforeEmit();
    this.refreshOutputs(true);
  }

  private recordHistoryBeforeEmit(): void {
    const nextSnapshot = this.createHistorySnapshot();
    if (this.serializeHistorySnapshot(nextSnapshot) === this.serializeHistorySnapshot(this.historySnapshot)) return;
    this.undoStack.push(this.cloneHistorySnapshot(this.historySnapshot));
    this.trimUndoStack();
    this.redoStack = [];
    this.historySnapshot = nextSnapshot;
  }

  private applyHistorySnapshot(snapshot: EmailHistorySnapshot): void {
    this.closeTransientMenus();
    this.closeImportModal();
    this.closeDataSetModal();
    this.closeTransformModal();
    this.closeOutputModal();
    this.closeRichTextSource();
    this.closeRichTextModal();
    this.destroyTiptapEditors();
    this.emailDocument = structuredClone(snapshot.document);
    this.selectedNodeId = this.resolveHistorySelection(snapshot.selectedNodeId);
    this.historySnapshot = this.createHistorySnapshot();
    this.refreshOutputs(true);
  }

  private createHistorySnapshot(): EmailHistorySnapshot {
    return {
      document: structuredClone(this.emailDocument),
      selectedNodeId: this.selectedNodeId,
    };
  }

  private cloneHistorySnapshot(snapshot: EmailHistorySnapshot): EmailHistorySnapshot {
    return {
      document: structuredClone(snapshot.document),
      selectedNodeId: snapshot.selectedNodeId,
    };
  }

  private serializeHistorySnapshot(snapshot: EmailHistorySnapshot): string {
    return JSON.stringify(snapshot.document);
  }

  private resetDocumentHistory(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.historySnapshot = this.createHistorySnapshot();
  }

  private trimUndoStack(): void {
    if (this.undoStack.length > MAX_DOCUMENT_HISTORY) this.undoStack.splice(0, this.undoStack.length - MAX_DOCUMENT_HISTORY);
  }

  private trimRedoStack(): void {
    if (this.redoStack.length > MAX_DOCUMENT_HISTORY) this.redoStack.splice(0, this.redoStack.length - MAX_DOCUMENT_HISTORY);
  }

  private resolveHistorySelection(selectedNodeId?: string): string | undefined {
    if (selectedNodeId === BODY_NODE_ID || this.findNode(selectedNodeId)) return selectedNodeId;
    return this.emailDocument.body[0]?.children?.[0]?.id || this.emailDocument.body[0]?.id || BODY_NODE_ID;
  }

  private isHistoryShortcut(event: KeyboardEvent): boolean {
    if (this.readonly || this.isEditableKeyboardTarget(event.target)) return false;
    const key = event.key.toLowerCase();
    return (event.metaKey || event.ctrlKey) && (key === 'z' || key === 'y');
  }

  private isRedoShortcut(event: KeyboardEvent): boolean {
    const key = event.key.toLowerCase();
    return (event.metaKey || event.ctrlKey) && (key === 'y' || (key === 'z' && event.shiftKey));
  }

  private isEditableKeyboardTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    const tagName = target.tagName.toLowerCase();
    return target.isContentEditable || tagName === 'input' || tagName === 'textarea' || tagName === 'select';
  }

  private syncHistoryControls(): void {
    const root = this.componentRoot();
    this.syncHistoryButton(root.querySelector('[data-history-action="undo"]'), this.canUndoDocument);
    this.syncHistoryButton(root.querySelector('[data-history-action="redo"]'), this.canRedoDocument);
  }

  private syncHistoryButton(element: Element | null, enabled: boolean): void {
    if (!(element instanceof HTMLButtonElement)) return;
    element.disabled = !enabled;
    element.setAttribute('aria-disabled', enabled ? 'false' : 'true');
    element.classList.toggle('is-disabled', !enabled);
  }

  private isPaletteItem(value: unknown): value is PaletteItem {
    return isTreePaletteItem(value);
  }

  private isEmailNode(value: unknown): value is EmailNode {
    return isTreeEmailNode(value);
  }

  private canDropIntoContainer(data: unknown, containerId?: string): boolean {
    if (this.readonly) return false;
    return canDropIntoTreeContainer({
      data,
      containerId,
      paletteDropListId: this.paletteDropListId,
      rootDropListId: this.rootDropListId,
      findTargetContainer: (dropListId) => this.findNodeByDropListId(dropListId),
    });
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
    return isTreeContentModule(node);
  }

  private collectContainerDropListIds(nodes: EmailNode[]): string[] {
    return collectTreeContainerDropListIds(nodes, (node) => this.dropListIdFor(node));
  }

  private plainText(value: string): string {
    return toPlainText(value);
  }

  private containedCssSize(value: string): string {
    return getContainedCssSize(value);
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
    this.lastHtml = this.renderHtml(this.emailDocument);
    if (this.effectiveConfig.showHtmlPreview !== false) {
      this.previewSrcdoc = this.sanitizer.bypassSecurityTrustHtml(this.lastHtml);
    }
    if (emit) {
      this.documentChange.emit(this.emailDocument);
      this.mjmlChange.emit(this.lastMjml);
      this.change.emit({ mjml: this.lastMjml, html: { html: this.lastHtml } });
    }
  }

  private createStarterDocument(): EmailDocument {
    return createTreeStarterDocument((type) => this.nextId(type));
  }

  private replaceEmailDocument(document: EmailDocument, emitChange: boolean): void {
    this.closeTransientMenus();
    this.closeImportModal();
    this.closeDataSetModal();
    this.closeTransformModal();
    this.closeOutputModal();
    this.closeTiptapPrompt();
    this.closeRichTextSource();
    this.closeRichTextModal();
    this.invalidateImageUpload();
    this.destroyTiptapEditors();
    this.emailDocument = document;
    this.selectedNodeId = this.emailDocument.body[0]?.children?.[0]?.id || this.emailDocument.body[0]?.id || BODY_NODE_ID;
    this.resetDocumentHistory();
    this.refreshOutputs(emitChange);
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
    const editor = createManagedTiptapEditor({
      element,
      node,
      editable: !this.readonly,
      onUpdate: (editor) => {
        const currentNode = scope === 'modal' ? this.expandedRichTextNode : this.findNode(this.tiptapInlineNodeId);
        if (!currentNode || currentNode.type !== 'text') return;
        const rawHtml = editor.getHTML();
        const sanitizedHtml = this.sanitizeRichTextContent(rawHtml);
        this.updateAttr(currentNode, 'content', sanitizedHtml);
        if (sanitizedHtml !== rawHtml && /<img\b/i.test(rawHtml)) {
          editor.commands.setContent(sanitizedHtml || '<p></p>', { emitUpdate: false });
        }
        this.scheduleTiptapToolbarState(scope);
      },
    });
    editor.on('selectionUpdate', () => this.scheduleTiptapToolbarState(scope));
    editor.on('transaction', () => this.scheduleTiptapToolbarState(scope));
    this.scheduleTiptapToolbarState(scope);
    return editor;
  }

  private syncTiptapContent(editor: TiptapEditor, node: EmailNode): void {
    syncManagedTiptapContent(editor, node, !this.readonly);
  }

  private scheduleTiptapToolbarState(scope: TiptapScope): void {
    if (this.tiptapToolbarStateTimers[scope]) return;
    this.tiptapToolbarStateTimers[scope] = setTimeout(() => {
      this.tiptapToolbarStateTimers[scope] = undefined;
      const editor = this.tiptapEditor(scope);
      this.tiptapToolbarState[scope] = editor ? this.collectTiptapToolbarState(editor) : defaultTiptapToolbarState();
    }, 0);
  }

  private collectTiptapToolbarState(editor: TiptapEditor): TiptapToolbarState {
    const blockFormat = ([1, 2, 3, 4, 5, 6] as const).find((level) => editor.isActive('heading', { level }));
    const headingLineHeight = editor.getAttributes('heading')['lineHeight'];
    const paragraphAttrs = editor.getAttributes('paragraph');
    const paragraphLineHeight = paragraphAttrs['lineHeight'];
    const textStyleFontSize = editor.getAttributes('textStyle')['fontSize'];
    const headingFontSize = editor.getAttributes('heading')['fontSize'];
    const paragraphFontSize = editor.getAttributes('paragraph')['fontSize'];
    const tableCellAttrs = editor.getAttributes('tableCell');
    const tableHeaderAttrs = editor.getAttributes('tableHeader');
    const textAlign = (['center', 'right', 'justify'] as const).find((align) => editor.isActive({ textAlign: align })) || 'left';
    return {
      blockFormat: blockFormat ? String(blockFormat) as TiptapHeadingValue : paragraphAttrs['blockTag'] === 'div' ? 'div' : 'paragraph',
      fontSize: typeof textStyleFontSize === 'string' ? textStyleFontSize : typeof headingFontSize === 'string' ? headingFontSize : typeof paragraphFontSize === 'string' ? paragraphFontSize : '',
      lineHeight: typeof headingLineHeight === 'string' ? headingLineHeight : typeof paragraphLineHeight === 'string' ? paragraphLineHeight : '',
      activeMarks: {
        bold: editor.isActive('bold'),
        italic: editor.isActive('italic'),
        underline: editor.isActive('underline'),
        strike: editor.isActive('strike'),
      },
      activeBlocks: {
        bulletList: editor.isActive('bulletList'),
        orderedList: editor.isActive('orderedList'),
      },
      textAlign,
      cellStyles: {
        backgroundColor: this.stringAttr(tableCellAttrs['backgroundColor'] || tableHeaderAttrs['backgroundColor']),
        borderColor: this.stringAttr(tableCellAttrs['borderColor'] || tableHeaderAttrs['borderColor']),
        borderWidth: this.stringAttr(tableCellAttrs['borderWidth'] || tableHeaderAttrs['borderWidth']),
        borderStyle: this.stringAttr(tableCellAttrs['borderStyle'] || tableHeaderAttrs['borderStyle']),
        width: this.stringAttr(tableCellAttrs['width'] || tableHeaderAttrs['width']),
        height: this.stringAttr(tableCellAttrs['height'] || tableHeaderAttrs['height']),
        padding: this.stringAttr(tableCellAttrs['padding'] || tableHeaderAttrs['padding']),
      },
    };
  }

  private stringAttr(value: unknown): string {
    return typeof value === 'string' ? value : '';
  }

  private destroyTiptapEditors(): void {
    this.destroyTiptapInlineEditor();
    this.destroyTiptapModalEditor();
    this.clearTiptapToolbarStateTimer('inline');
    this.clearTiptapToolbarStateTimer('modal');
  }

  private clearTiptapToolbarStateTimer(scope: TiptapScope): void {
    const timer = this.tiptapToolbarStateTimers[scope];
    if (timer) clearTimeout(timer);
    this.tiptapToolbarStateTimers[scope] = undefined;
    this.tiptapToolbarState[scope] = defaultTiptapToolbarState();
  }

  private destroyTiptapInlineEditor(): void {
    this.tiptapInlineEditor?.destroy();
    this.tiptapInlineEditor = undefined;
    this.tiptapInlineNodeId = undefined;
    this.clearTiptapToolbarStateTimer('inline');
  }

  private destroyTiptapModalEditor(): void {
    this.tiptapModalEditor?.destroy();
    this.tiptapModalEditor = undefined;
    this.tiptapModalNodeId = undefined;
    this.clearTiptapToolbarStateTimer('modal');
  }


  private componentRoot(): ParentNode {
    return this.hostRef.nativeElement;
  }


  private createNodesForDrop(item: PaletteItem, containerId?: string): EmailNode[] {
    if (item.templateMjml) {
      const nodes = this.createNodesFromTemplateMjml(item.templateMjml);
      if (containerId === this.rootDropListId) return nodes.map((node) => this.wrapForRootDrop(node, containerId));
      return nodes.flatMap((node) => this.normalizeTemplateNodesForNestedDrop(node));
    }

    const node = this.createNodeFromPalette(item);
    if (containerId === this.rootDropListId) return [this.wrapForRootDrop(node, containerId)];
    return [this.normalizeNestedDropNode(node)];
  }

  private normalizeTemplateNodesForNestedDrop(node: EmailNode): EmailNode[] {
    if (node.type === 'section' || node.type === 'row' || node.type === 'column') {
      const children = node.children || [];
      const normalized = children.flatMap((child) => this.normalizeTemplateNodesForNestedDrop(child));
      return normalized.length ? normalized : [this.createNode('text')];
    }
    return [node];
  }

  private createNodesFromTemplateMjml(mjml: string): EmailNode[] {
    try {
      return this.parseMjml(this.normalizeTemplateMjml(mjml)).body;
    } catch (error) {
      this.error.emit({ code: 'template_parse_failed', message: 'Unable to parse custom template MJML.', details: error });
      return [this.createNode('text', { content: '<p>Template import failed. Check the MJML template markup.</p>' })];
    }
  }

  private normalizeTemplateMjml(mjml: string): string {
    const value = String(mjml || '').trim();
    if (/^<mjml[\s>]/i.test(value)) return value;
    if (/^<mj-body[\s>]/i.test(value)) return `<mjml>${value}</mjml>`;
    return `<mjml><mj-body>${value}</mj-body></mjml>`;
  }

  private wrapForRootDrop(node: EmailNode, containerId?: string): EmailNode {
    return wrapTreeForRootDrop(node, containerId === this.rootDropListId, (children) => this.createSectionWithChildren(children));
  }

  private normalizeNestedDropNode(node: EmailNode): EmailNode {
    return normalizeTreeNestedDropNode(node, () => this.createNode('text'));
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
    return renderHtmlDocument(document);
  }

  private findNode(id?: string): EmailNode | undefined {
    return findTreeNode(id, this.emailDocument.body);
  }

  private nodeContains(node: EmailNode, id: string): boolean {
    if (node.id === id) return true;
    return (node.children || []).some((child) => this.nodeContains(child, id));
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
    const width = attrs['width'] ? ` width="${this.escapeAttr(dimensionCss(attrs, 'width', 100, '%'))}"` : '';
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
