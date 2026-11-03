import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map } from 'rxjs';

export interface Device {
  id: string;
  name: string;
  pairedAt: string;
  lastSeenAt: string | null;
}

interface DevicePage {
  items: Device[];
  totalPages: number;
  totalElement: number;
}

@Injectable({ providedIn: 'root' })
export class DeviceApiService {
  private readonly http = inject(HttpClient);

  list() {
    return this.http
      .get<DevicePage>('/api/v1/devices', { params: { page: 1, pageSize: 500 } })
      .pipe(map((page) => page.items));
  }

  revoke(id: string) {
    return this.http.delete<void>(`/api/v1/devices/${encodeURIComponent(id)}`);
  }
}
