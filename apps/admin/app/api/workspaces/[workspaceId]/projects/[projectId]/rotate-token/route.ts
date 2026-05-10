import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { API_BASE_URL, AUTH_COOKIE_NAME } from "../../../../../../../lib/server-config";

async function authHeaders(): Promise<Record<string, string>> {
  const token = (await cookies()).get(AUTH_COOKIE_NAME)?.value;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function POST(
  _request: Request,
  context: { params: Promise<{ workspaceId: string; projectId: string }> },
) {
  const { workspaceId, projectId } = await context.params;
  const upstream = await fetch(
    `${API_BASE_URL}/workspaces/${encodeURIComponent(workspaceId)}/projects/${encodeURIComponent(projectId)}/rotate-token`,
    { method: "POST", headers: { ...(await authHeaders()) }, cache: "no-store" },
  );
  const body = await upstream.text();
  return new NextResponse(body, {
    status: upstream.status,
    headers: { "Content-Type": upstream.headers.get("content-type") ?? "application/json" },
  });
}
