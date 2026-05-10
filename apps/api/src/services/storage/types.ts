import type { Readable } from "node:stream";

export interface StoragePutInput {
  key: string;
  body: Buffer | Uint8Array | Readable;
  mimeType: string;
  size: number;
}

export interface StoragePutResult {
  key: string;
  mimeType: string;
  size: number;
}

export interface StorageProvider {
  put(input: StoragePutInput): Promise<StoragePutResult>;
  get(key: string): Promise<Readable>;
  delete(key: string): Promise<void>;
  /**
   * Returns a URL or local path the caller can use to retrieve the blob.
   * For the local provider this is a relative path the API serves itself.
   */
  presignDownload(key: string, ttlSeconds?: number): Promise<string>;
}
