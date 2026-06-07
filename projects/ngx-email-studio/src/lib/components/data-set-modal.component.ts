import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, ViewEncapsulation } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { EmailStudioDataSetItem } from '../models';

@Component({
  selector: 'ngx-email-studio-data-set-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  encapsulation: ViewEncapsulation.None,
  template: `
    <div class="nes-modal-backdrop" (click)="close.emit()">
      <section class="nes-data-set-modal" role="dialog" aria-modal="true" aria-label="Available merge tags" (click)="$event.stopPropagation()">
        <header>
          <div class="nes-modal-heading">
            <span class="nes-modal-icon"><i class="nes-icon fa fa-database" aria-hidden="true"></i></span>
            <div>
              <p>Data set</p>
              <h3>Available merge tags</h3>
            </div>
          </div>
          <button type="button" aria-label="Close data set modal" (click)="close.emit()"><i class="nes-icon fa fa-times" aria-hidden="true"></i></button>
        </header>

        <div class="nes-data-set-body">
          <div class="nes-modal-intro">
            <strong>Copy merge tags</strong>
            <p class="nes-muted">Copy a key and paste it into your email content.</p>
          </div>

          <label class="nes-search nes-data-set-search">
            <i class="nes-icon fa fa-search" aria-hidden="true"></i>
            <input [ngModel]="search" (ngModelChange)="search = $event" placeholder="Search keys or descriptions" />
          </label>

          <div class="nes-data-set-list" *ngIf="filteredItems.length; else noDataSetItems">
            <article class="nes-data-set-card" *ngFor="let item of filteredItems; trackBy: trackItem">
              <div class="nes-data-set-copy">
                <code>{{ item.key }}</code>
                <p>{{ item.desc || 'No description' }}</p>
              </div>
              <button type="button" class="nes-copy-btn" (click)="copy.emit(item.key)">
                <i class="nes-icon fa fa-copy" aria-hidden="true"></i>
                {{ copiedKey === item.key ? copyState || 'Copied' : 'Copy' }}
              </button>
            </article>
          </div>

          <ng-template #noDataSetItems>
            <div class="nes-data-set-empty">
              <i class="nes-icon fa fa-info-circle" aria-hidden="true"></i>
              <span>{{ items.length ? 'No matching merge tags' : 'No data set keys available' }}</span>
            </div>
          </ng-template>
        </div>
      </section>
    </div>
  `,
})
export class NgxEmailStudioDataSetModal {
  @Input() items: EmailStudioDataSetItem[] = [];
  @Input() copiedKey = '';
  @Input() copyState = '';

  @Output() close = new EventEmitter<void>();
  @Output() copy = new EventEmitter<string>();

  search = '';

  get filteredItems(): EmailStudioDataSetItem[] {
    const query = this.search.trim().toLowerCase();
    if (!query) return this.items;
    return this.items.filter((item) => `${item.key} ${item.desc || ''}`.toLowerCase().includes(query));
  }

  trackItem(_: number, item: EmailStudioDataSetItem): string {
    return item.key;
  }
}
