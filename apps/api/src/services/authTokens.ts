import { createHmac } from "node:crypto";
import { env } from "../config/env.js";
import type { User } from "@qelp/shared/contracts";

interface AuthPayload {
  userId: string;
  workspaceId: string;
  role: User["role"];
  exp: number;
}

function sign(input: string) {
  return createHmac("sha256", env.AUTH_SECRET).update(input).digest("base64url");
}

export function createAuthToken(user: User) {
  const payload: AuthPayload = {
    userId: user.id,
    workspaceId: user.workspaceId,
    role: user.role,
    exp: Date.now() + 1000 * 60 * 60 * 12
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = sign(encoded);
  return `${encoded}.${signature}`;
}

export function verifyAuthToken(token: string): AuthPayload | null {
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;
  if (sign(encoded) !== signature) return null;

  const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as AuthPayload;
  if (payload.exp < Date.now()) return null;
  return payload;
}
