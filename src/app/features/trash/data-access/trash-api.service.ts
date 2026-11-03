import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map } from 'rxjs';

export interface TrashEntry {
  id: string;
  name: string;
  originalPath: string;
  type: string;
  size: number;
  deletedAt: string;
}

interface TrashPage {
  items: TrashEntry[];
  totalPages: number;
  totalElement: number;
}

@Injectable({ providedIn: 'root' })
export class TrashApiService {
  private readonly http = inject(HttpClient);

  list() {
    return this.http
      .get<TrashPage>('/api/v1/trash', { params: { page: 1, pageSize: 500 } })
      .pipe(map((page) => page.items));
  }

  restore(id: string) {
    return this.http.post<void>(`/api/v1/trash/${encodeURIComponent(id)}/restore`, {});
  }

  permanentlyDelete(id: string) {
    return this.http.delete<void>(`/api/v1/trash/${encodeURIComponent(id)}`);
  }
}
