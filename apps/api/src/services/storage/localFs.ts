import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, rename, rm, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { randomBytes } from "node:crypto";
import type { StoragePutInput, StoragePutResult, StorageProvider } from "./types.js";

export class LocalFsStorageProvider implements StorageProvider {
  constructor(private readonly rootDir: string) {}

  private resolveAbs(key: string) {
    if (key.includes("..")) {
      throw new Error("Invalid storage key");
    }
    return resolve(this.rootDir, key);
  }

  async put(input: StoragePutInput): Promise<StoragePutResult> {
    const target = this.resolveAbs(input.key);
    const dir = dirname(target);
    await mkdir(dir, { recursive: true });

    const tmpPath = join(dir, `.${randomBytes(6).toString("hex")}.tmp`);
    const writable = createWriteStream(tmpPath);

    if (input.body instanceof Readable) {
      await pipeline(input.body, writable);
    } else {
      await new Promise<void>((resolveWrite, rejectWrite) => {
        writable.on("error", rejectWrite);
        writable.on("finish", () => resolveWrite());
        writable.end(input.body);
      });
    }

    await rename(tmpPath, target);
    const stats = await stat(target);

    return { key: input.key, mimeType: input.mimeType, size: stats.size };
  }

  async get(key: string): Promise<Readable> {
    const target = this.resolveAbs(key);
    await stat(target);
    return createReadStream(target);
  }

  async delete(key: string): Promise<void> {
    const target = this.resolveAbs(key);
    await rm(target, { force: true });
  }

  async presignDownload(key: string): Promise<string> {
    return `/uploads/${key}`;
  }
}
