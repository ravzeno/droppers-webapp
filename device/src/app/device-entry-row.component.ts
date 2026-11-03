import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'device-entry-row',
  standalone: true,
  template: `
    <div class="file-row">
      <span class="file-type">{{ icon }}</span>
      <button class="file-title" type="button" (click)="open.emit()">
        <b>{{ title }}</b>
        <small>{{ details }}</small>
      </button>
      <button
        class="more-button"
        type="button"
        [attr.aria-label]="actionLabel + ' ' + title"
        (click)="action.emit()"
      >
        {{ actionLabel }}
      </button>
    </div>
  `,
})
export class DeviceEntryRowComponent {
  @Input({ required: true }) icon = '';
  @Input({ required: true }) title = '';
  @Input({ required: true }) details = '';
  @Input({ required: true }) actionLabel = '';

  @Output() open = new EventEmitter<void>();
  @Output() action = new EventEmitter<void>();
}
