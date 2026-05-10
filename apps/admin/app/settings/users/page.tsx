import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getWorkspaceSettingsData } from "../../../lib/api";
import { UsersManager } from "./users-manager";

export const metadata: Metadata = {
  title: "Users",
  robots: { index: false, follow: false },
};

export default async function UsersSettingsPage() {
  const data = await getWorkspaceSettingsData();
  if (!data) redirect("/login");

  const role = data.currentUser?.role ?? null;
  const canManage = role === "owner";

  return (
    <UsersManager
      workspaceId={data.workspace.id}
      initialUsers={data.users}
      canManage={canManage}
    />
  );
}
