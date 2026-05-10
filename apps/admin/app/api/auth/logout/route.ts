import { NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, isProduction } from "../../../../lib/server-config";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction(),
    path: "/",
    maxAge: 0,
  });
  return response;
}
