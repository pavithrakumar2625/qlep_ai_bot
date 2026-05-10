import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { API_BASE_URL, AUTH_COOKIE_NAME } from "../../../../lib/server-config";

async function authHeader(): Promise<Record<string, string>> {
  const token = (await cookies()).get(AUTH_COOKIE_NAME)?.value;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ feedbackId: string }> },
) {
  const { feedbackId } = await context.params;
  const upstream = await fetch(`${API_BASE_URL}/feedback/${encodeURIComponent(feedbackId)}`, {
    method: "GET",
    headers: { ...(await authHeader()) },
    cache: "no-store",
  });
  const body = await upstream.text();
  return new NextResponse(body, {
    status: upstream.status,
    headers: { "Content-Type": upstream.headers.get("content-type") ?? "application/json" },
  });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ feedbackId: string }> },
) {
  const { feedbackId } = await context.params;
  const payload = await request.text();
  const upstream = await fetch(`${API_BASE_URL}/feedback/${encodeURIComponent(feedbackId)}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...(await authHeader()),
    },
    body: payload,
    cache: "no-store",
  });
  const body = await upstream.text();
  return new NextResponse(body, {
    status: upstream.status,
    headers: { "Content-Type": upstream.headers.get("content-type") ?? "application/json" },
  });
}
