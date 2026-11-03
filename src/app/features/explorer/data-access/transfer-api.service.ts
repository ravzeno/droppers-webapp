import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { HttpEventType } from '@angular/common/http';
import { filter, map, switchMap, tap } from 'rxjs';

export interface UploadTransfer {
  id: string;
  destinationPath: string;
  fileName: string;
  expectedBytes: number | null;
  transferredBytes: number;
  status: string;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
}

@Injectable({ providedIn: 'root' })
export class TransferApiService {
  private readonly http = inject(HttpClient);

  recent() {
    return this.http.get<UploadTransfer[]>('/api/v1/transfers/uploads');
  }

  create(destinationPath: string, fileName: string, expectedBytes: number) {
    return this.http.post<void>('/api/v1/transfers/uploads', {
      destinationPath,
      fileName,
      expectedBytes,
    });
  }

  /** The service currently returns an empty data value from create, so resolve its new ID from recent transfers. */
  createAndFind(destinationPath: string, fileName: string, expectedBytes: number) {
    return this.recent().pipe(
      switchMap((before) =>
        this.create(destinationPath, fileName, expectedBytes).pipe(
          switchMap(() =>
            this.recent().pipe(
              map((after) => {
                const previousIds = new Set(before.map((transfer) => transfer.id));
                const created = after.find(
                  (transfer) =>
                    !previousIds.has(transfer.id) &&
                    transfer.status === 'STAGING' &&
                    transfer.destinationPath === destinationPath &&
                    transfer.fileName === fileName &&
                    transfer.expectedBytes === expectedBytes,
                );
                if (!created) {
                  throw new Error('Upload transfer was created without a retrievable ID');
                }
                return created;
              }),
            ),
          ),
        ),
      ),
    );
  }

  uploadContent(id: string, file: File, onProgress?: (percent: number) => void) {
    return this.http.put<UploadTransfer>(
      `/api/v1/transfers/uploads/${encodeURIComponent(id)}/content`,
      file,
      { headers: { 'Content-Type': 'application/octet-stream' }, observe: 'events', reportProgress: true },
    ).pipe(tap((event) => { if (event.type === HttpEventType.UploadProgress && event.total) onProgress?.(Math.round(event.loaded * 100 / event.total)); }), filter((event) => event.type === HttpEventType.Response));
  }

  cancel(id: string) {
    return this.http.delete<UploadTransfer>(`/api/v1/transfers/uploads/${encodeURIComponent(id)}`);
  }
}
