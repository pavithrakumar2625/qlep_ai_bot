import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { API_BASE_URL, AUTH_COOKIE_NAME } from "../../../../../lib/server-config";

async function authHeaders(): Promise<Record<string, string>> {
  const token = (await cookies()).get(AUTH_COOKIE_NAME)?.value;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ feedbackId: string }> },
) {
  const { feedbackId } = await context.params;
  const upstream = await fetch(
    `${API_BASE_URL}/feedback/${encodeURIComponent(feedbackId)}/comments`,
    { method: "GET", headers: { ...(await authHeaders()) }, cache: "no-store" },
  );
  const body = await upstream.text();
  return new NextResponse(body, {
    status: upstream.status,
    headers: { "Content-Type": upstream.headers.get("content-type") ?? "application/json" },
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ feedbackId: string }> },
) {
  const { feedbackId } = await context.params;
  const payload = await request.text();
  const upstream = await fetch(
    `${API_BASE_URL}/feedback/${encodeURIComponent(feedbackId)}/comments`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await authHeaders()) },
      body: payload,
      cache: "no-store",
    },
  );
  const body = await upstream.text();
  return new NextResponse(body, {
    status: upstream.status,
    headers: { "Content-Type": upstream.headers.get("content-type") ?? "application/json" },
  });
}
