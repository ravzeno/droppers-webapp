import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FileEntry, FileListResponse } from '../../../core/models/file-entry';

@Injectable({ providedIn: 'root' })
export class FileApiService {
  private readonly http = inject(HttpClient);

  list(path: string) {
    return this.http.get<FileListResponse>('/api/v1/files', {
      params: path ? { path } : {},
    });
  }

  createFolder(parentPath: string, name: string) {
    return this.http.post<FileEntry>('/api/v1/folders', { parentPath, name });
  }

  rename(path: string, newName: string) {
    return this.http.patch<FileEntry>('/api/v1/files/rename', { path, newName });
  }

  move(source: string, destinationDirectory: string) {
    return this.http.post<FileEntry>('/api/v1/files/move', {
      source,
      destinationDirectory,
    });
  }

  trash(path: string) {
    return this.http.delete<void>('/api/v1/files', { params: { path } });
  }

  upload(file: File, destinationPath: string) {
    const body = new FormData();
    body.append('file', file);
    return this.http.post<FileEntry>('/api/v1/files/upload', body, {
      params: destinationPath ? { destinationPath } : {},
    });
  }
}
