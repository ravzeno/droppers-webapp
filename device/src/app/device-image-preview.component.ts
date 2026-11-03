import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Component, ElementRef, Input, OnDestroy, AfterViewInit, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'device-image-preview',
  standalone: true,
  template: `
    @if (src) {
      <img [src]="src" [alt]="alt" loading="lazy">
    } @else {
      <span class="image-placeholder" aria-hidden="true">▧</span>
    }
  `,
  styles: [`
    :host { display: grid; width: 100%; height: 100%; place-items: center; overflow: hidden; background: #edf0e9; }
    img { width: 100%; height: 100%; object-fit: cover; }
    .image-placeholder { color: #9aa394; font-size: 24px; }
  `],
})
export class DeviceImagePreviewComponent implements AfterViewInit, OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly element = inject(ElementRef<HTMLElement>);
  private observer?: IntersectionObserver;
  private objectUrl?: string;
  private started = false;

  @Input({ required: true }) path = '';
  @Input({ required: true }) accessToken = '';
  @Input() alt = '';

  src = '';

  ngAfterViewInit() {
    if (typeof IntersectionObserver === 'undefined') {
      void this.load();
      return;
    }
    this.observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        this.observer?.disconnect();
        void this.load();
      }
    }, { rootMargin: '160px' });
    this.observer.observe(this.element.nativeElement);
  }

  ngOnDestroy() {
    this.observer?.disconnect();
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
  }

  private async load() {
    if (this.started) return;
    this.started = true;
    try {
      const blob = await firstValueFrom(this.http.get('/api/v1/files/download', {
        headers: new HttpHeaders({ 'X-Droppers-Token': this.accessToken }),
        params: new HttpParams().set('path', this.path),
        responseType: 'blob',
      }));
      this.objectUrl = URL.createObjectURL(blob);
      this.src = this.objectUrl;
    } catch {
      // Leave the neutral placeholder visible when a preview cannot be loaded.
    }
  }
}
