import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./passwords.js";

describe("passwords", () => {
  it("hashes and verifies a correct password", async () => {
    const hash = await hashPassword("Password123!");
    await expect(verifyPassword("Password123!", hash)).resolves.toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const hash = await hashPassword("Password123!");
    await expect(verifyPassword("Password123?", hash)).resolves.toBe(false);
  });

  it("rejects a malformed hash", async () => {
    await expect(verifyPassword("anything", "not-a-real-hash")).resolves.toBe(false);
  });

  it("produces a different salt for each call", async () => {
    const a = await hashPassword("same-password");
    const b = await hashPassword("same-password");
    expect(a).not.toBe(b);
  });
});
