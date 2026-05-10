import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LocalFsStorageProvider } from "./localFs.js";

describe("LocalFsStorageProvider", () => {
  let dir: string;
  let provider: LocalFsStorageProvider;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "qelp-storage-test-"));
    provider = new LocalFsStorageProvider(dir);
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("writes and reads a buffer", async () => {
    const result = await provider.put({
      key: "ws/proj/file.txt",
      body: Buffer.from("hello"),
      mimeType: "text/plain",
      size: 5,
    });
    expect(result.size).toBe(5);
    expect(result.key).toBe("ws/proj/file.txt");

    const onDisk = await readFile(join(dir, "ws/proj/file.txt"), "utf8");
    expect(onDisk).toBe("hello");

    const stream = await provider.get("ws/proj/file.txt");
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : (chunk as Buffer));
    }
    expect(Buffer.concat(chunks).toString("utf8")).toBe("hello");
  });

  it("rejects keys with traversal segments", async () => {
    await expect(
      provider.put({
        key: "../escape.txt",
        body: Buffer.from("nope"),
        mimeType: "text/plain",
        size: 4,
      }),
    ).rejects.toThrow(/Invalid storage key/);
  });

  it("delete is idempotent", async () => {
    await expect(provider.delete("ws/proj/missing.txt")).resolves.toBeUndefined();
  });

  it("presignDownload returns a relative path", async () => {
    const url = await provider.presignDownload("att_abc");
    expect(url).toBe("/uploads/att_abc");
  });
});
