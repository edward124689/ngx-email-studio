import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, ViewEncapsulation } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'ngx-email-studio-import-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  encapsulation: ViewEncapsulation.None,
  template: `
    <div class="nes-modal-backdrop" (click)="close.emit()">
      <section class="nes-import-modal" role="dialog" aria-modal="true" aria-label="Import MJML" (click)="$event.stopPropagation()">
        <header>
          <div class="nes-modal-heading">
            <span class="nes-modal-icon"><i class="nes-icon fa fa-upload" aria-hidden="true"></i></span>
            <div>
              <p>Import MJML</p>
              <h3>Paste MJML to import</h3>
            </div>
          </div>
          <button type="button" aria-label="Close import modal" (click)="close.emit()"><i class="nes-icon fa fa-times" aria-hidden="true"></i></button>
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
            <textarea [ngModel]="draft" (ngModelChange)="draftChange.emit($event)" spellcheck="false" placeholder="<mjml>...</mjml>"></textarea>
          </div>
          <div class="nes-import-error" *ngIf="errorMessage"><i class="nes-icon fa fa-exclamation-triangle" aria-hidden="true"></i> {{ errorMessage }}</div>
        </div>
        <footer class="nes-modal-footer">
          <button type="button" (click)="close.emit()">Cancel</button>
          <button type="button" class="nes-primary" (click)="importMjml.emit()"><i class="nes-icon fa fa-check" aria-hidden="true"></i> Import MJML</button>
        </footer>
      </section>
    </div>
  `,
})
export class NgxEmailStudioImportModal {
  @Input() draft = '';
  @Input() errorMessage = '';

  @Output() draftChange = new EventEmitter<string>();
  @Output() close = new EventEmitter<void>();
  @Output() importMjml = new EventEmitter<void>();
}
