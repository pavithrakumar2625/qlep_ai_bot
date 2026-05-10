import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../config/env.js";
import type { User } from "@qelp/shared/contracts";

interface AuthPayload {
  userId: string;
  workspaceId: string;
  role: User["role"];
  iat: number;
  exp: number;
}

export const AUTH_TOKEN_TTL_SECONDS = 60 * 60 * 12;

function sign(input: string) {
  return createHmac("sha256", env.AUTH_SECRET).update(input).digest("base64url");
}

function constantTimeEquals(a: string, b: string) {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function createAuthToken(user: User) {
  const now = Date.now();
  const payload: AuthPayload = {
    userId: user.id,
    workspaceId: user.workspaceId,
    role: user.role,
    iat: now,
    exp: now + AUTH_TOKEN_TTL_SECONDS * 1000,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = sign(encoded);
  return `${encoded}.${signature}`;
}

export function verifyAuthToken(token: string): AuthPayload | null {
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;
  if (!constantTimeEquals(sign(encoded), signature)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as AuthPayload;
    if (typeof payload.exp !== "number" || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}
