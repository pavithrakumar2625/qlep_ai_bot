import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { env } from "../../config/env.js";
import { LocalFsStorageProvider } from "./localFs.js";
import type { StorageProvider } from "./types.js";

function buildProvider(): StorageProvider {
  if (env.STORAGE_PROVIDER === "local") {
    const baseDir = env.STORAGE_LOCAL_DIR;
    const apiRoot = resolve(fileURLToPath(new URL("../../..", import.meta.url)));
    const absoluteRoot = resolve(apiRoot, baseDir);
    return new LocalFsStorageProvider(absoluteRoot);
  }
  throw new Error(`Unsupported STORAGE_PROVIDER: ${env.STORAGE_PROVIDER as string}`);
}

export const storage: StorageProvider = buildProvider();
export type { StorageProvider, StoragePutInput, StoragePutResult } from "./types.js";
