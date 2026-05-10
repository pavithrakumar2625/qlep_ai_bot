export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  process.env.PUBLIC_API_BASE_URL ??
  "http://localhost:4000";

export const AUTH_COOKIE_NAME = "qelp_token";
export const AUTH_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 12;

export function isProduction() {
  return process.env.NODE_ENV === "production";
}
