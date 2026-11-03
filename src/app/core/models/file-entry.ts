export type FileType = 'FILE' | 'DIRECTORY';

export interface FileEntry {
  name: string;
  path: string;
  type: FileType;
  size: number;
  mimeType: string | null;
  modifiedAt: string;
}

export interface FileListResponse {
  path: string;
  parentPath: string;
  items: FileEntry[];
}
