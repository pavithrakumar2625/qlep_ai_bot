import { describe, expect, it } from "vitest";
import type { User } from "@qelp/shared/contracts";
import { createAuthToken, verifyAuthToken } from "./authTokens.js";

const user: User = {
  id: "usr_test",
  workspaceId: "ws_test",
  email: "test@example.com",
  name: "Test User",
  role: "owner",
};

describe("authTokens", () => {
  it("round-trips a valid token", () => {
    const token = createAuthToken(user);
    const payload = verifyAuthToken(token);
    expect(payload?.userId).toBe("usr_test");
    expect(payload?.workspaceId).toBe("ws_test");
    expect(payload?.role).toBe("owner");
  });

  it("rejects a tampered signature", () => {
    const token = createAuthToken(user);
    const [body] = token.split(".");
    const tampered = `${body}.totally-bogus-signature`;
    expect(verifyAuthToken(tampered)).toBeNull();
  });

  it("rejects malformed tokens", () => {
    expect(verifyAuthToken("not-a-token")).toBeNull();
    expect(verifyAuthToken(".")).toBeNull();
    expect(verifyAuthToken("")).toBeNull();
  });
});
