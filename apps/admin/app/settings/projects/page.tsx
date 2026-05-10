import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getWorkspaceSettingsData } from "../../../lib/api";
import { ProjectsManager } from "./projects-manager";

export const metadata: Metadata = {
  title: "Projects",
  robots: { index: false, follow: false },
};

export default async function ProjectsSettingsPage() {
  const data = await getWorkspaceSettingsData();
  if (!data) redirect("/login");

  const role = data.currentUser?.role ?? null;
  const canEdit = role === "owner" || role === "manager";
  const canDelete = role === "owner";

  return (
    <ProjectsManager
      workspaceId={data.workspace.id}
      initialProjects={data.projects}
      canEdit={canEdit}
      canDelete={canDelete}
    />
  );
}
