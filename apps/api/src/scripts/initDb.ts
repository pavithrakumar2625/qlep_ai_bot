import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { mockFeedbackItems, mockProjects, mockUsers, mockWorkspaces } from "@qelp/shared/contracts";
import { pool } from "../db/mysql.js";
import { hashPassword } from "../services/passwords.js";

async function main() {
  const schemaPath = resolve(process.cwd(), "src/db/schema.sql");
  const schema = await readFile(schemaPath, "utf8");

  const connection = await pool.getConnection();
  try {
    await connection.query(schema);
    await seedDatabase(connection);
    console.log("Database schema and seed data initialized.");
  } finally {
    connection.release();
    await pool.end();
  }
}

function toMysqlDateTime(value: string) {
  return value.replace("T", " ").replace("Z", "");
}

async function seedDatabase(connection: Awaited<ReturnType<typeof pool.getConnection>>) {
  for (const workspace of mockWorkspaces) {
    await connection.execute(
      `INSERT INTO agency_workspaces (id, name, slug, created_at)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE name = VALUES(name), slug = VALUES(slug)`,
      [workspace.id, workspace.name, workspace.slug, toMysqlDateTime(workspace.createdAt)],
    );
  }

  for (const project of mockProjects) {
    await connection.execute(
      `INSERT INTO client_projects (id, workspace_id, name, \`key\`, client_name, description, widget_token)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE name = VALUES(name), client_name = VALUES(client_name), description = VALUES(description), widget_token = VALUES(widget_token)`,
      [project.id, project.workspaceId, project.name, project.key, project.clientName, project.description, project.widgetToken],
    );
  }

  const defaultPasswordHash = await hashPassword("Password123!");
  for (const user of mockUsers) {
    await connection.execute(
      `INSERT INTO users (id, workspace_id, email, name, password_hash, role)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE email = VALUES(email), name = VALUES(name), password_hash = VALUES(password_hash), role = VALUES(role)`,
      [user.id, user.workspaceId, user.email, user.name, defaultPasswordHash, user.role],
    );
  }

  for (const item of mockFeedbackItems) {
    await connection.execute(
      `INSERT INTO feedback_items
        (id, workspace_id, project_id, source, status, assigned_to, reporter_json, content_json, attachments_json, environment_json, labels_json, priority_json, voice_transcript_json, ai_analysis_json, comments_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         status = VALUES(status),
         assigned_to = VALUES(assigned_to),
         reporter_json = VALUES(reporter_json),
         content_json = VALUES(content_json),
         attachments_json = VALUES(attachments_json),
         environment_json = VALUES(environment_json),
         labels_json = VALUES(labels_json),
         priority_json = VALUES(priority_json),
         voice_transcript_json = VALUES(voice_transcript_json),
         ai_analysis_json = VALUES(ai_analysis_json),
         comments_json = VALUES(comments_json),
         updated_at = VALUES(updated_at)`,
      [
        item.id,
        item.workspaceId,
        item.projectId,
        item.source,
        item.status,
        item.assignedTo,
        JSON.stringify(item.reporter),
        JSON.stringify(item.content),
        JSON.stringify(item.attachments),
        JSON.stringify(item.environment),
        JSON.stringify(item.labels),
        JSON.stringify(item.priority),
        item.voiceTranscript ? JSON.stringify(item.voiceTranscript) : null,
        item.aiAnalysis ? JSON.stringify(item.aiAnalysis) : null,
        JSON.stringify(item.comments),
        toMysqlDateTime(item.createdAt),
        toMysqlDateTime(item.updatedAt)
      ],
    );
  }
}

main().catch(async (error) => {
  console.error("Failed to initialize database.", error);
  try {
    await pool.end();
  } catch {}
  process.exit(1);
});
