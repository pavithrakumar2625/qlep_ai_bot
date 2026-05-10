import { randomBytes } from "node:crypto";
import { and, desc, eq, ilike, inArray, lt, or, sql } from "drizzle-orm";
import {
  createId,
  scorePriority,
  type AgencyWorkspace,
  type Attachment,
  type ClientProject,
  type Comment,
  type FeedbackItem,
  type FeedbackStatus,
  type User,
} from "@qelp/shared/contracts";
import { hashPassword } from "../services/passwords.js";
import { db } from "../db/postgres.js";
import {
  agencyWorkspaces,
  attachments as attachmentsTable,
  clientProjects,
  comments as commentsTable,
  feedbackItems,
  users,
} from "../db/schema.js";
import type { FeedbackRepository, ProjectInput, UserInput } from "./types.js";

type AttachmentRow = typeof attachmentsTable.$inferSelect;
type CommentRow = typeof commentsTable.$inferSelect;
type FeedbackRow = typeof feedbackItems.$inferSelect & {
  attachments?: AttachmentRow[];
  comments?: CommentRow[];
};

function attachmentRowToContract(row: AttachmentRow): Attachment {
  return {
    id: row.id,
    type: row.type,
    url: `/uploads/${row.id}`,
    mimeType: row.mimeType,
    createdAt: row.createdAt.toISOString(),
  };
}

function commentRowToContract(row: CommentRow): Comment {
  return {
    id: row.id,
    authorId: row.authorId,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
  };
}

function encodeCursor(input: { createdAt: Date; id: string }) {
  return Buffer.from(`${input.createdAt.toISOString()}|${input.id}`, "utf8").toString("base64url");
}

function parseCursor(value: string | undefined): { createdAt: Date; id: string } | null {
  if (!value) return null;
  try {
    const decoded = Buffer.from(value, "base64url").toString("utf8");
    const [iso, id] = decoded.split("|");
    if (!iso || !id) return null;
    const createdAt = new Date(iso);
    if (Number.isNaN(createdAt.getTime())) return null;
    return { createdAt, id };
  } catch {
    return null;
  }
}

function mapFeedback(row: FeedbackRow): FeedbackItem {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    projectId: row.projectId,
    source: row.source,
    status: row.status,
    assignedTo: row.assignedTo,
    reporter: row.reporter,
    content: row.content,
    attachments: (row.attachments ?? []).map(attachmentRowToContract),
    environment: row.environment,
    labels: row.labels ?? [],
    priority: row.priority,
    voiceTranscript: row.voiceTranscript ?? null,
    aiAnalysis: row.aiAnalysis ?? null,
    comments: (row.comments ?? []).map(commentRowToContract),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export class PostgresRepository implements FeedbackRepository {
  async listWorkspaces(): Promise<AgencyWorkspace[]> {
    const rows = await db
      .select()
      .from(agencyWorkspaces)
      .orderBy(desc(agencyWorkspaces.createdAt));
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  async listProjects(workspaceId?: string): Promise<ClientProject[]> {
    const rows = workspaceId
      ? await db.select().from(clientProjects).where(eq(clientProjects.workspaceId, workspaceId))
      : await db.select().from(clientProjects);

    return rows
      .map((row) => ({
        id: row.id,
        workspaceId: row.workspaceId,
        name: row.name,
        key: row.key,
        clientName: row.clientName,
        description: row.description,
        widgetToken: row.widgetToken,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async createProject(workspaceId: string, input: ProjectInput): Promise<ClientProject> {
    const id = createId("proj");
    const key = id.replace(/^proj_/, "");
    const widgetToken = `widget_${randomBytes(16).toString("hex")}`;
    await db.insert(clientProjects).values({
      id,
      workspaceId,
      name: input.name,
      key,
      clientName: input.clientName,
      description: input.description ?? "",
      widgetToken,
    });
    const project = await this.getProjectById(id);
    if (!project) throw new Error("Failed to read created project");
    return project;
  }

  async updateProject(projectId: string, input: Partial<ProjectInput>): Promise<ClientProject | null> {
    const patch: Partial<typeof clientProjects.$inferInsert> = {};
    if (input.name !== undefined) patch.name = input.name;
    if (input.clientName !== undefined) patch.clientName = input.clientName;
    if (input.description !== undefined) patch.description = input.description;
    if (Object.keys(patch).length === 0) return this.getProjectById(projectId);
    await db.update(clientProjects).set(patch).where(eq(clientProjects.id, projectId));
    return this.getProjectById(projectId);
  }

  async deleteProject(projectId: string): Promise<boolean> {
    const result = await db.delete(clientProjects).where(eq(clientProjects.id, projectId)).returning();
    return result.length > 0;
  }

  async rotateProjectToken(projectId: string): Promise<ClientProject | null> {
    const widgetToken = `widget_${randomBytes(16).toString("hex")}`;
    await db.update(clientProjects).set({ widgetToken }).where(eq(clientProjects.id, projectId));
    return this.getProjectById(projectId);
  }

  async getProjectById(projectId: string): Promise<ClientProject | null> {
    const row = await db.query.clientProjects.findFirst({
      where: eq(clientProjects.id, projectId),
    });
    return row
      ? {
          id: row.id,
          workspaceId: row.workspaceId,
          name: row.name,
          key: row.key,
          clientName: row.clientName,
          description: row.description,
          widgetToken: row.widgetToken,
        }
      : null;
  }

  async listUsers(workspaceId?: string): Promise<User[]> {
    const rows = workspaceId
      ? await db.select().from(users).where(eq(users.workspaceId, workspaceId))
      : await db.select().from(users);

    return rows
      .map((row) => ({
        id: row.id,
        workspaceId: row.workspaceId,
        email: row.email,
        name: row.name,
        role: row.role,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async countOwners(workspaceId: string): Promise<number> {
    const rows = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .where(and(eq(users.workspaceId, workspaceId), eq(users.role, "owner")));
    return rows[0]?.count ?? 0;
  }

  async createUser(workspaceId: string, input: UserInput): Promise<User> {
    const id = createId("usr");
    const passwordHash = await hashPassword(input.password);
    await db.insert(users).values({
      id,
      workspaceId,
      email: input.email.trim().toLowerCase(),
      name: input.name,
      passwordHash,
      role: input.role,
    });
    const user = await this.getUserById(id);
    if (!user) throw new Error("Failed to read created user");
    return user;
  }

  async updateUser(
    userId: string,
    input: Partial<Omit<UserInput, "password">> & { password?: string },
  ): Promise<User | null> {
    const patch: Partial<typeof users.$inferInsert> = {};
    if (input.email !== undefined) patch.email = input.email.trim().toLowerCase();
    if (input.name !== undefined) patch.name = input.name;
    if (input.role !== undefined) patch.role = input.role;
    if (input.password) patch.passwordHash = await hashPassword(input.password);
    if (Object.keys(patch).length === 0) return this.getUserById(userId);
    await db.update(users).set(patch).where(eq(users.id, userId));
    return this.getUserById(userId);
  }

  async deleteUser(userId: string): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, userId)).returning();
    return result.length > 0;
  }

  async getUserById(userId: string): Promise<User | null> {
    const row = await db.query.users.findFirst({ where: eq(users.id, userId) });
    return row
      ? {
          id: row.id,
          workspaceId: row.workspaceId,
          email: row.email,
          name: row.name,
          role: row.role,
        }
      : null;
  }

  async getUserAuthByEmail(
    email: string,
  ): Promise<{ user: User; passwordHash: string } | null> {
    const normalized = email.trim().toLowerCase();
    const row = await db.query.users.findFirst({ where: eq(users.email, normalized) });
    if (!row) return null;
    return {
      user: {
        id: row.id,
        workspaceId: row.workspaceId,
        email: row.email,
        name: row.name,
        role: row.role,
      },
      passwordHash: row.passwordHash,
    };
  }

  async listFeedback(filters?: {
    workspaceId?: string;
    projectId?: string;
    status?: FeedbackStatus;
    priorityLabel?: "low" | "medium" | "high" | "urgent";
    query?: string;
    cursor?: string;
    limit?: number;
  }): Promise<{ items: FeedbackItem[]; nextCursor: string | null }> {
    const limit = Math.max(1, Math.min(filters?.limit ?? 25, 100));
    const cursor = parseCursor(filters?.cursor);

    const conditions = [
      filters?.workspaceId ? eq(feedbackItems.workspaceId, filters.workspaceId) : undefined,
      filters?.projectId ? eq(feedbackItems.projectId, filters.projectId) : undefined,
      filters?.status ? eq(feedbackItems.status, filters.status) : undefined,
      filters?.priorityLabel
        ? sql`${feedbackItems.priority} ->> 'label' = ${filters.priorityLabel}`
        : undefined,
      filters?.query
        ? or(
            ilike(sql`${feedbackItems.content} ->> 'message'`, `%${filters.query}%`),
            ilike(sql`coalesce(${feedbackItems.aiAnalysis} ->> 'title', '')`, `%${filters.query}%`),
          )
        : undefined,
      cursor
        ? or(
            lt(feedbackItems.createdAt, cursor.createdAt),
            and(eq(feedbackItems.createdAt, cursor.createdAt), lt(feedbackItems.id, cursor.id)),
          )
        : undefined,
    ].filter((expr): expr is NonNullable<typeof expr> => expr !== undefined);

    const rows = await db.query.feedbackItems.findMany({
      where: conditions.length === 0 ? undefined : and(...conditions),
      with: { attachments: true, comments: true },
      orderBy: (table, { desc: sortDesc }) => [sortDesc(table.createdAt), sortDesc(table.id)],
      limit: limit + 1,
    });

    let nextCursor: string | null = null;
    if (rows.length > limit) {
      const last = rows[limit - 1];
      nextCursor = encodeCursor({ createdAt: last.createdAt, id: last.id });
      rows.length = limit;
    }

    return { items: rows.map(mapFeedback), nextCursor };
  }

  async getFeedback(feedbackId: string): Promise<FeedbackItem | null> {
    const row = await db.query.feedbackItems.findFirst({
      where: eq(feedbackItems.id, feedbackId),
      with: { attachments: true, comments: true },
    });
    return row ? mapFeedback(row) : null;
  }

  async createFeedback(
    payload: Pick<
      FeedbackItem,
      "workspaceId" | "projectId" | "reporter" | "content" | "environment" | "source" | "voiceTranscript"
    > & { attachments: { id: string }[] },
  ): Promise<FeedbackItem> {
    const id = createId("fb");
    const now = new Date();
    const priority = scorePriority({
      severity: "medium",
      emotion: "neutral",
      affectedUsers: payload.content.affectedUsers ?? 1,
      reproducibility: payload.content.stepsToReproduce.length ? "high" : "unclear",
    });

    await db.insert(feedbackItems).values({
      id,
      workspaceId: payload.workspaceId,
      projectId: payload.projectId,
      source: payload.source,
      status: "new",
      triageStatus: "pending",
      assignedTo: null,
      reporter: payload.reporter,
      content: payload.content,
      environment: payload.environment,
      labels: [],
      priority,
      voiceTranscript: payload.voiceTranscript,
      aiAnalysis: null,
      createdAt: now,
      updatedAt: now,
    });

    if (payload.attachments.length) {
      const attachmentIds = payload.attachments.map((a) => a.id);
      await db
        .update(attachmentsTable)
        .set({ feedbackId: id })
        .where(
          and(
            inArray(attachmentsTable.id, attachmentIds),
            eq(attachmentsTable.workspaceId, payload.workspaceId),
            eq(attachmentsTable.projectId, payload.projectId),
          ),
        );
    }

    const created = await this.getFeedback(id);
    if (!created) {
      throw new Error("Failed to read back created feedback");
    }
    return created;
  }

  async updateFeedback(
    feedbackId: string,
    update: Partial<FeedbackItem>,
  ): Promise<FeedbackItem | null> {
    const existing = await db.query.feedbackItems.findFirst({
      where: eq(feedbackItems.id, feedbackId),
    });
    if (!existing) return null;

    const patch: Partial<typeof feedbackItems.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (update.status !== undefined) patch.status = update.status;
    if (update.assignedTo !== undefined) patch.assignedTo = update.assignedTo;
    if (update.labels !== undefined) patch.labels = update.labels;
    if (update.priority !== undefined) patch.priority = update.priority;
    if (update.voiceTranscript !== undefined) patch.voiceTranscript = update.voiceTranscript;
    if (update.aiAnalysis !== undefined) patch.aiAnalysis = update.aiAnalysis;

    await db.update(feedbackItems).set(patch).where(eq(feedbackItems.id, feedbackId));
    return this.getFeedback(feedbackId);
  }
}

export const repository: FeedbackRepository = new PostgresRepository();
