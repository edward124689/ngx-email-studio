import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, ViewEncapsulation } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { EmailStudioTransformAction, EmailStudioTransformPreview, EmailStudioTransformScope } from '../models';

@Component({
  selector: 'ngx-email-studio-transform-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  encapsulation: ViewEncapsulation.None,
  template: `
    <div class="nes-modal-backdrop" (click)="close.emit()">
      <section class="nes-transform-modal" role="dialog" aria-modal="true" aria-label="Transform content" (click)="$event.stopPropagation()">
        <header>
          <div class="nes-modal-heading">
            <span class="nes-modal-icon"><i class="nes-icon fa fa-language" aria-hidden="true"></i></span>
            <div>
              <p>Transform</p>
              <h3>Transform content</h3>
            </div>
          </div>
          <button type="button" aria-label="Close transform modal" (click)="close.emit()"><i class="nes-icon fa fa-times" aria-hidden="true"></i></button>
        </header>

        <div class="nes-transform-body">
          <div class="nes-modal-intro">
            <strong>Preview before applying</strong>
            <p class="nes-muted">Convert Chinese text or normalize spacing without changing links, styles, or merge tags.</p>
          </div>

          <div class="nes-transform-controls">
            <fieldset>
              <legend>Scope</legend>
              <label class="nes-radio-card">
                <input type="radio" name="transformScope" value="document" [ngModel]="scope" disabled />
                <span>
                  <strong>Whole email</strong>
                  <small>Transform all text blocks and button labels.</small>
                </span>
              </label>
            </fieldset>

            <label>
              Action
              <select [ngModel]="action" (ngModelChange)="actionChange.emit($event)">
                <option value="simplified-to-traditional">Simplified Chinese → Traditional Chinese</option>
                <option value="traditional-to-simplified">Traditional Chinese → Simplified Chinese</option>
                <option value="normalize-spaces">Normalize spaces</option>
              </select>
            </label>
          </div>

          <div class="nes-transform-error" *ngIf="errorMessage">
            <i class="nes-icon fa fa-exclamation-triangle" aria-hidden="true"></i>
            <span>{{ errorMessage }}</span>
          </div>

          <section class="nes-transform-preview" aria-live="polite">
            <div class="nes-transform-preview-head">
              <h4>Preview</h4>
              <span *ngIf="loading">Preparing…</span>
              <span *ngIf="!loading && preview">{{ preview.changedCount }} block{{ preview.changedCount === 1 ? '' : 's' }} will change</span>
            </div>
            <div class="nes-transform-preview-grid" *ngIf="preview && !loading; else transformPreviewLoading">
              <article>
                <strong>Before</strong>
                <pre>{{ preview.before || 'No transformable text found' }}</pre>
              </article>
              <article>
                <strong>After</strong>
                <pre>{{ preview.after || 'No transformable text found' }}</pre>
              </article>
            </div>
            <ng-template #transformPreviewLoading>
              <div class="nes-transform-loading">{{ loading ? 'Preparing preview…' : 'No preview available' }}</div>
            </ng-template>
          </section>
        </div>

        <footer class="nes-modal-footer">
          <button type="button" (click)="close.emit()">Cancel</button>
          <button type="button" class="nes-primary" [disabled]="loading || readonly || !preview || preview.changedCount === 0" (click)="apply.emit()">
            <i class="nes-icon fa fa-check" aria-hidden="true"></i>
            Apply transform
          </button>
        </footer>
      </section>
    </div>
  `,
})
export class NgxEmailStudioTransformModal {
  @Input() action: EmailStudioTransformAction = 'simplified-to-traditional';
  @Input() scope: EmailStudioTransformScope = 'document';
  @Input() preview: EmailStudioTransformPreview | null = null;
  @Input() loading = false;
  @Input() readonly = false;
  @Input() errorMessage = '';

  @Output() close = new EventEmitter<void>();
  @Output() actionChange = new EventEmitter<EmailStudioTransformAction>();
  @Output() apply = new EventEmitter<void>();
}
