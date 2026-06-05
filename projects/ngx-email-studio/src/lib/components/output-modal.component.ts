import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, ViewEncapsulation } from '@angular/core';

@Component({
  selector: 'ngx-email-studio-output-modal',
  standalone: true,
  imports: [CommonModule],
  encapsulation: ViewEncapsulation.None,
  template: `
    <div class="nes-modal-backdrop" (click)="close.emit()">
      <section class="nes-output-modal" role="dialog" aria-modal="true" [attr.aria-label]="title" (click)="$event.stopPropagation()">
        <header>
          <div class="nes-modal-heading">
            <span class="nes-modal-icon"><i class="nes-icon fa fa-download" aria-hidden="true"></i></span>
            <div>
              <p>Export output</p>
              <h3>{{ title }}</h3>
            </div>
          </div>
          <div class="nes-modal-actions">
            <button type="button" class="nes-preview-btn" *ngIf="type === 'html'" (click)="preview.emit()"><i class="nes-icon fa fa-external-link" aria-hidden="true"></i> Preview</button>
            <button type="button" class="nes-copy-btn" (click)="copy.emit()"><i class="nes-icon fa fa-copy" aria-hidden="true"></i> {{ copyState || 'Copy' }}</button>
            <button type="button" aria-label="Close export modal" (click)="close.emit()"><i class="nes-icon fa fa-times" aria-hidden="true"></i></button>
          </div>
        </header>
        <div *ngIf="unsupported.length" class="nes-warning">
          Unsupported MJML preserved as warning: {{ unsupported.join(', ') }}
        </div>
        <div class="nes-code-shell nes-output-code">
          <div class="nes-code-toolbar">
            <span><i class="nes-icon fa fa-code" aria-hidden="true"></i> {{ type === 'html' ? 'Generated HTML' : 'Generated MJML' }}</span>
            <small>Read-only</small>
          </div>
          <pre>{{ content }}</pre>
        </div>
      </section>
    </div>
  `,
})
export class NgxEmailStudioOutputModal {
  @Input() type: 'mjml' | 'html' = 'mjml';
  @Input() title = 'MJML Output';
  @Input() content = '';
  @Input() copyState = '';
  @Input() unsupported: string[] = [];

  @Output() close = new EventEmitter<void>();
  @Output() preview = new EventEmitter<void>();
  @Output() copy = new EventEmitter<void>();
}
