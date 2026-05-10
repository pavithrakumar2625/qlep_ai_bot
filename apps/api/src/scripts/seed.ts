import {
  mockFeedbackItems,
  mockProjects,
  mockUsers,
  mockWorkspaces,
} from "@qelp/shared/contracts";
import { db, sql } from "../db/postgres.js";
import {
  agencyWorkspaces,
  clientProjects,
  feedbackItems,
  users,
} from "../db/schema.js";
import { hashPassword } from "../services/passwords.js";

async function main() {
  console.log("Seeding workspaces...");
  for (const workspace of mockWorkspaces) {
    await db
      .insert(agencyWorkspaces)
      .values({
        id: workspace.id,
        name: workspace.name,
        slug: workspace.slug,
        createdAt: new Date(workspace.createdAt),
      })
      .onConflictDoUpdate({
        target: agencyWorkspaces.id,
        set: { name: workspace.name, slug: workspace.slug },
      });
  }

  console.log("Seeding projects...");
  for (const project of mockProjects) {
    await db
      .insert(clientProjects)
      .values({
        id: project.id,
        workspaceId: project.workspaceId,
        name: project.name,
        key: project.key,
        clientName: project.clientName,
        description: project.description,
        widgetToken: project.widgetToken,
      })
      .onConflictDoUpdate({
        target: clientProjects.id,
        set: {
          name: project.name,
          clientName: project.clientName,
          description: project.description,
          widgetToken: project.widgetToken,
        },
      });
  }

  console.log("Seeding users...");
  const defaultPasswordHash = await hashPassword("Password123!");
  for (const user of mockUsers) {
    await db
      .insert(users)
      .values({
        id: user.id,
        workspaceId: user.workspaceId,
        email: user.email,
        name: user.name,
        passwordHash: defaultPasswordHash,
        role: user.role,
      })
      .onConflictDoUpdate({
        target: users.id,
        set: {
          email: user.email,
          name: user.name,
          passwordHash: defaultPasswordHash,
          role: user.role,
        },
      });
  }

  console.log("Seeding feedback items...");
  for (const item of mockFeedbackItems) {
    await db
      .insert(feedbackItems)
      .values({
        id: item.id,
        workspaceId: item.workspaceId,
        projectId: item.projectId,
        source: item.source,
        status: item.status,
        triageStatus: item.aiAnalysis ? "completed" : "pending",
        assignedTo: item.assignedTo,
        reporter: item.reporter,
        content: item.content,
        environment: item.environment,
        labels: item.labels,
        priority: item.priority,
        voiceTranscript: item.voiceTranscript,
        aiAnalysis: item.aiAnalysis,
        createdAt: new Date(item.createdAt),
        updatedAt: new Date(item.updatedAt),
      })
      .onConflictDoUpdate({
        target: feedbackItems.id,
        set: {
          status: item.status,
          assignedTo: item.assignedTo,
          reporter: item.reporter,
          content: item.content,
          environment: item.environment,
          labels: item.labels,
          priority: item.priority,
          voiceTranscript: item.voiceTranscript,
          aiAnalysis: item.aiAnalysis,
          updatedAt: new Date(item.updatedAt),
        },
      });
  }

  console.log("Seed complete.");
}

main()
  .catch((error) => {
    console.error("Seed failed.", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sql.end({ timeout: 5 });
  });
