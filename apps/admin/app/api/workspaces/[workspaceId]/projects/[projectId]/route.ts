import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { API_BASE_URL, AUTH_COOKIE_NAME } from "../../../../../../lib/server-config";

async function authHeaders(): Promise<Record<string, string>> {
  const token = (await cookies()).get(AUTH_COOKIE_NAME)?.value;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function proxy(
  method: "PATCH" | "DELETE",
  request: Request,
  workspaceId: string,
  projectId: string,
) {
  const payload = method === "DELETE" ? undefined : await request.text();
  const upstream = await fetch(
    `${API_BASE_URL}/workspaces/${encodeURIComponent(workspaceId)}/projects/${encodeURIComponent(projectId)}`,
    {
      method,
      headers: {
        ...(payload ? { "Content-Type": "application/json" } : {}),
        ...(await authHeaders()),
      },
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

export async function PATCH(
  request: Request,
  context: { params: Promise<{ workspaceId: string; projectId: string }> },
) {
  const { workspaceId, projectId } = await context.params;
  return proxy("PATCH", request, workspaceId, projectId);
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ workspaceId: string; projectId: string }> },
) {
  const { workspaceId, projectId } = await context.params;
  return proxy("DELETE", request, workspaceId, projectId);
}
