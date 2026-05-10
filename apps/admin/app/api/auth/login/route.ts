import { NextResponse } from "next/server";
import {
  API_BASE_URL,
  AUTH_COOKIE_MAX_AGE_SECONDS,
  AUTH_COOKIE_NAME,
  isProduction,
} from "../../../../lib/server-config";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const upstream = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const data = (await upstream.json().catch(() => ({}))) as {
    token?: string;
    user?: unknown;
    expiresInSeconds?: number;
    error?: string;
    issues?: unknown;
  };

  if (!upstream.ok || !data.token) {
    return NextResponse.json(
      { error: data.error ?? "Sign-in failed", issues: data.issues },
      { status: upstream.status === 0 ? 502 : upstream.status },
    );
  }

  const response = NextResponse.json({ user: data.user });
  response.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: data.token,
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction(),
    path: "/",
    maxAge: data.expiresInSeconds ?? AUTH_COOKIE_MAX_AGE_SECONDS,
  });
  return response;
}
