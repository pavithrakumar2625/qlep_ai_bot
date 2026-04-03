import {
  createId,
  scorePriority,
  type AgencyWorkspace,
  type ClientProject,
  type FeedbackItem,
  type FeedbackStatus,
  type User
} from "@qelp/shared/contracts";
import type { Pool, RowDataPacket } from "mysql2/promise";
import { pool } from "../db/mysql.js";
import type { FeedbackRepository } from "./types.js";

type JsonRecordRow = RowDataPacket & {
  id: string;
  workspace_id: string;
  project_id: string;
  source: FeedbackItem["source"];
  status: FeedbackStatus;
  assigned_to: string | null;
  reporter_json: string;
  content_json: string;
  attachments_json: string;
  environment_json: string;
  labels_json: string;
  priority_json: string;
  voice_transcript_json: string | null;
  ai_analysis_json: string | null;
  comments_json: string;
  created_at: Date | string;
  updated_at: Date | string;
};

function parseJson<T>(value: unknown): T {
  if (typeof value === "string") return JSON.parse(value) as T;
  return value as T;
}

function toIsoString(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function mapFeedbackRow(row: JsonRecordRow): FeedbackItem {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    projectId: row.project_id,
    source: row.source,
    status: row.status,
    assignedTo: row.assigned_to,
    reporter: parseJson(row.reporter_json),
    content: parseJson(row.content_json),
    attachments: parseJson(row.attachments_json),
    environment: parseJson(row.environment_json),
    labels: parseJson(row.labels_json),
    priority: parseJson(row.priority_json),
    voiceTranscript: row.voice_transcript_json ? parseJson(row.voice_transcript_json) : null,
    aiAnalysis: row.ai_analysis_json ? parseJson(row.ai_analysis_json) : null,
    comments: parseJson(row.comments_json),
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at)
  };
}

export class MySqlRepository implements FeedbackRepository {
  constructor(private readonly db: Pool) {}

  async listWorkspaces(): Promise<AgencyWorkspace[]> {
    const [rows] = await this.db.query<(RowDataPacket & { id: string; name: string; slug: string; created_at: Date | string })[]>(
      "SELECT id, name, slug, created_at FROM agency_workspaces ORDER BY created_at DESC",
    );
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      createdAt: toIsoString(row.created_at)
    }));
  }

  async listProjects(workspaceId?: string): Promise<ClientProject[]> {
    const [rows] = workspaceId
      ? await this.db.query<
          (RowDataPacket & {
            id: string;
            workspace_id: string;
            name: string;
            key: string;
            client_name: string;
            description: string;
            widget_token: string;
          })[]
        >(
          "SELECT id, workspace_id, name, `key`, client_name, description, widget_token FROM client_projects WHERE workspace_id = ? ORDER BY name ASC",
          [workspaceId],
        )
      : await this.db.query<
          (RowDataPacket & {
            id: string;
            workspace_id: string;
            name: string;
            key: string;
            client_name: string;
            description: string;
            widget_token: string;
          })[]
        >("SELECT id, workspace_id, name, `key`, client_name, description, widget_token FROM client_projects ORDER BY name ASC");

    return rows.map((row) => ({
      id: row.id,
      workspaceId: row.workspace_id,
      name: row.name,
      key: row.key,
      clientName: row.client_name,
      description: row.description,
      widgetToken: row.widget_token
    }));
  }

  async getProjectById(projectId: string): Promise<ClientProject | null> {
    const [rows] = await this.db.query<
      (RowDataPacket & {
        id: string;
        workspace_id: string;
        name: string;
        key: string;
        client_name: string;
        description: string;
        widget_token: string;
      })[]
    >(
      "SELECT id, workspace_id, name, `key`, client_name, description, widget_token FROM client_projects WHERE id = ? LIMIT 1",
      [projectId],
    );

    const row = rows[0];
    return row
      ? {
          id: row.id,
          workspaceId: row.workspace_id,
          name: row.name,
          key: row.key,
          clientName: row.client_name,
          description: row.description,
          widgetToken: row.widget_token
        }
      : null;
  }

  async listUsers(workspaceId?: string): Promise<User[]> {
    const [rows] = workspaceId
      ? await this.db.query<(RowDataPacket & { id: string; workspace_id: string; email: string; name: string; role: User["role"] })[]>(
          "SELECT id, workspace_id, email, name, role FROM users WHERE workspace_id = ? ORDER BY name ASC",
          [workspaceId],
        )
      : await this.db.query<(RowDataPacket & { id: string; workspace_id: string; email: string; name: string; role: User["role"] })[]>(
          "SELECT id, workspace_id, email, name, role FROM users ORDER BY name ASC",
        );

    return rows.map((row) => ({
      id: row.id,
      workspaceId: row.workspace_id,
      email: row.email,
      name: row.name,
      role: row.role
    }));
  }

  async getUserById(userId: string): Promise<User | null> {
    const [rows] = await this.db.query<(RowDataPacket & { id: string; workspace_id: string; email: string; name: string; role: User["role"] })[]>(
      "SELECT id, workspace_id, email, name, role FROM users WHERE id = ? LIMIT 1",
      [userId],
    );
    const row = rows[0];
    return row
      ? { id: row.id, workspaceId: row.workspace_id, email: row.email, name: row.name, role: row.role }
      : null;
  }

  async getUserAuthByEmail(email: string): Promise<{ user: User; passwordHash: string } | null> {
    const [rows] = await this.db.query<
      (RowDataPacket & { id: string; workspace_id: string; email: string; name: string; role: User["role"]; password_hash: string })[]
    >("SELECT id, workspace_id, email, name, role, password_hash FROM users WHERE email = ? LIMIT 1", [email]);
    const row = rows[0];
    if (!row) return null;

    return {
      user: {
        id: row.id,
        workspaceId: row.workspace_id,
        email: row.email,
        name: row.name,
        role: row.role
      },
      passwordHash: row.password_hash
    };
  }

  async listFeedback(filters?: { workspaceId?: string; projectId?: string; status?: FeedbackStatus }): Promise<FeedbackItem[]> {
    const where: string[] = [];
    const values: unknown[] = [];

    if (filters?.workspaceId) {
      where.push("workspace_id = ?");
      values.push(filters.workspaceId);
    }
    if (filters?.projectId) {
      where.push("project_id = ?");
      values.push(filters.projectId);
    }
    if (filters?.status) {
      where.push("status = ?");
      values.push(filters.status);
    }

    const sql = `SELECT * FROM feedback_items${where.length ? ` WHERE ${where.join(" AND ")}` : ""} ORDER BY created_at DESC`;
    const [rows] = await this.db.query<JsonRecordRow[]>(sql, values);
    return rows.map(mapFeedbackRow);
  }

  async getFeedback(feedbackId: string): Promise<FeedbackItem | null> {
    const [rows] = await this.db.query<JsonRecordRow[]>("SELECT * FROM feedback_items WHERE id = ? LIMIT 1", [feedbackId]);
    return rows[0] ? mapFeedbackRow(rows[0]) : null;
  }

  async createFeedback(
    payload: Pick<
      FeedbackItem,
      "workspaceId" | "projectId" | "reporter" | "content" | "attachments" | "environment" | "source" | "voiceTranscript"
    >,
  ): Promise<FeedbackItem> {
    const now = new Date().toISOString();
    const item: FeedbackItem = {
      id: createId("fb"),
      workspaceId: payload.workspaceId,
      projectId: payload.projectId,
      reporter: payload.reporter,
      content: payload.content,
      attachments: payload.attachments,
      environment: payload.environment,
      source: payload.source,
      status: "new",
      labels: [],
      assignedTo: null,
      priority: scorePriority({
        severity: "medium",
        emotion: "neutral",
        affectedUsers: payload.content.affectedUsers ?? 1,
        reproducibility: payload.content.stepsToReproduce.length ? "high" : "unclear"
      }),
      voiceTranscript: payload.voiceTranscript,
      aiAnalysis: null,
      comments: [],
      createdAt: now,
      updatedAt: now
    };

    await this.db.execute(
      `INSERT INTO feedback_items
        (id, workspace_id, project_id, source, status, assigned_to, reporter_json, content_json, attachments_json, environment_json, labels_json, priority_json, voice_transcript_json, ai_analysis_json, comments_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        null,
        JSON.stringify(item.comments),
        item.createdAt,
        item.updatedAt
      ],
    );

    return item;
  }

  async updateFeedback(feedbackId: string, update: Partial<FeedbackItem>): Promise<FeedbackItem | null> {
    const existing = await this.getFeedback(feedbackId);
    if (!existing) return null;

    const next: FeedbackItem = {
      ...existing,
      ...update,
      updatedAt: new Date().toISOString()
    };

    await this.db.execute(
      `UPDATE feedback_items
       SET status = ?, assigned_to = ?, labels_json = ?, priority_json = ?, voice_transcript_json = ?, ai_analysis_json = ?, comments_json = ?, updated_at = ?
       WHERE id = ?`,
      [
        next.status,
        next.assignedTo,
        JSON.stringify(next.labels),
        JSON.stringify(next.priority),
        next.voiceTranscript ? JSON.stringify(next.voiceTranscript) : null,
        next.aiAnalysis ? JSON.stringify(next.aiAnalysis) : null,
        JSON.stringify(next.comments),
        next.updatedAt,
        feedbackId
      ],
    );

    return next;
  }
}

export const repository: FeedbackRepository = new MySqlRepository(pool);
