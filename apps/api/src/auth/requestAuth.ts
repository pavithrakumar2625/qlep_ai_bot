import type { Request } from "express";

export function extractBearerToken(request: Request) {
  const authorization = request.headers.authorization;
  if (authorization?.startsWith("Bearer ")) {
    return authorization.slice("Bearer ".length);
  }

  const cookieHeader = request.headers.cookie;
  if (!cookieHeader) return null;
  const match = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("qelp_token="));

  return match ? decodeURIComponent(match.slice("qelp_token=".length)) : null;
}
