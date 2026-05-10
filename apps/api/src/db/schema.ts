import { relations } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import type {
  AIAnalysis,
  EnvironmentSnapshot,
  FeedbackContent,
  PriorityScore,
  ReporterIdentity,
  VoiceTranscript,
  WorkspaceRole,
} from "@qelp/shared/contracts";

export const workspaceRoleEnum = pgEnum("workspace_role", [
  "owner",
  "manager",
  "contributor",
  "client_viewer",
]);

export const feedbackSourceEnum = pgEnum("feedback_source", ["widget", "admin", "api"]);

export const feedbackStatusEnum = pgEnum("feedback_status", [
  "new",
  "triaged",
  "in_progress",
  "resolved",
  "archived",
]);

export const triageStatusEnum = pgEnum("triage_status", ["pending", "completed", "failed"]);

export const attachmentTypeEnum = pgEnum("attachment_type", ["image", "audio", "video", "file"]);

export const agencyWorkspaces = pgTable("agency_workspaces", {
  id: varchar("id", { length: 64 }).primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true, precision: 3 })
    .notNull()
    .defaultNow(),
});

export const clientProjects = pgTable("client_projects", {
  id: varchar("id", { length: 64 }).primaryKey(),
  workspaceId: varchar("workspace_id", { length: 64 })
    .notNull()
    .references(() => agencyWorkspaces.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  key: varchar("key", { length: 255 }).notNull().unique(),
  clientName: varchar("client_name", { length: 255 }).notNull(),
  description: text("description").notNull().default(""),
  widgetToken: varchar("widget_token", { length: 255 }).notNull().unique(),
});

export const users = pgTable("users", {
  id: varchar("id", { length: 64 }).primaryKey(),
  workspaceId: varchar("workspace_id", { length: 64 })
    .notNull()
    .references(() => agencyWorkspaces.id, { onDelete: "cascade" }),
  email: varchar("email", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  role: workspaceRoleEnum("role").notNull(),
});

export const feedbackItems = pgTable(
  "feedback_items",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    workspaceId: varchar("workspace_id", { length: 64 })
      .notNull()
      .references(() => agencyWorkspaces.id, { onDelete: "cascade" }),
    projectId: varchar("project_id", { length: 64 })
      .notNull()
      .references(() => clientProjects.id, { onDelete: "cascade" }),
    source: feedbackSourceEnum("source").notNull(),
    status: feedbackStatusEnum("status").notNull(),
    triageStatus: triageStatusEnum("triage_status").notNull().default("pending"),
    assignedTo: varchar("assigned_to", { length: 64 }).references(() => users.id, {
      onDelete: "set null",
    }),
    reporter: jsonb("reporter").$type<ReporterIdentity>().notNull(),
    content: jsonb("content").$type<FeedbackContent>().notNull(),
    environment: jsonb("environment").$type<EnvironmentSnapshot>().notNull(),
    labels: jsonb("labels").$type<string[]>().notNull().default([]),
    priority: jsonb("priority").$type<PriorityScore>().notNull(),
    voiceTranscript: jsonb("voice_transcript").$type<VoiceTranscript | null>(),
    aiAnalysis: jsonb("ai_analysis").$type<AIAnalysis | null>(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true, precision: 3 })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true, precision: 3 })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    workspaceIdx: index("feedback_workspace_idx").on(table.workspaceId),
    projectIdx: index("feedback_project_idx").on(table.projectId),
    statusIdx: index("feedback_status_idx").on(table.status),
    createdAtIdx: index("feedback_created_at_idx").on(table.createdAt),
  }),
);

export const attachments = pgTable(
  "attachments",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    workspaceId: varchar("workspace_id", { length: 64 })
      .notNull()
      .references(() => agencyWorkspaces.id, { onDelete: "cascade" }),
    projectId: varchar("project_id", { length: 64 })
      .notNull()
      .references(() => clientProjects.id, { onDelete: "cascade" }),
    feedbackId: varchar("feedback_id", { length: 64 }).references(() => feedbackItems.id, {
      onDelete: "cascade",
    }),
    storageKey: varchar("storage_key", { length: 512 }).notNull(),
    type: attachmentTypeEnum("type").notNull(),
    mimeType: varchar("mime_type", { length: 128 }).notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true, precision: 3 })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    feedbackIdx: index("attachments_feedback_idx").on(table.feedbackId),
  }),
);

export const comments = pgTable(
  "comments",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    feedbackId: varchar("feedback_id", { length: 64 })
      .notNull()
      .references(() => feedbackItems.id, { onDelete: "cascade" }),
    authorId: varchar("author_id", { length: 64 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true, precision: 3 })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    feedbackIdx: index("comments_feedback_idx").on(table.feedbackId),
  }),
);

export const feedbackItemRelations = relations(feedbackItems, ({ many, one }) => ({
  attachments: many(attachments),
  comments: many(comments),
  workspace: one(agencyWorkspaces, {
    fields: [feedbackItems.workspaceId],
    references: [agencyWorkspaces.id],
  }),
  project: one(clientProjects, {
    fields: [feedbackItems.projectId],
    references: [clientProjects.id],
  }),
}));

export const attachmentRelations = relations(attachments, ({ one }) => ({
  feedback: one(feedbackItems, {
    fields: [attachments.feedbackId],
    references: [feedbackItems.id],
  }),
}));

export const commentRelations = relations(comments, ({ one }) => ({
  feedback: one(feedbackItems, { fields: [comments.feedbackId], references: [feedbackItems.id] }),
  author: one(users, { fields: [comments.authorId], references: [users.id] }),
}));

export type WorkspaceRoleValue = WorkspaceRole;
