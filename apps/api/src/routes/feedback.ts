import { Router } from "express";
import { z } from "zod";
import type { FeedbackStatus } from "@qelp/shared/contracts";
import { requireAuth, requireRole } from "../auth/middleware.js";
import { feedbackPublicLimiter } from "../middleware/rateLimit.js";
import { repository } from "../repositories/postgresRepository.js";
import { commentsRouter } from "./comments.js";
import { dispatchTriage } from "../services/triagePipeline.js";

const statusSchema = z.enum(["new", "triaged", "in_progress", "resolved", "archived"]);

const feedbackPayloadSchema = z.object({
  workspaceId: z.string(),
  projectId: z.string(),
  source: z.enum(["widget", "admin", "api"]),
  reporter: z.object({
    id: z.string().optional(),
    email: z.string().email().optional(),
    name: z.string().optional(),
  }),
  content: z.object({
    message: z.string().min(10).max(20000),
    stepsToReproduce: z.array(z.string().max(2000)).max(50).default([]),
    expectedBehavior: z.string().max(4000).optional(),
    actualBehavior: z.string().max(4000).optional(),
    affectedUsers: z.number().int().positive().max(1_000_000).optional(),
  }),
  attachments: z
    .array(z.object({ id: z.string() }))
    .max(20)
    .default([]),
  environment: z.object({
    url: z.string().url(),
    route: z.string().optional(),
    browser: z.string().optional(),
    os: z.string().optional(),
    locale: z.string().optional(),
    userAgent: z.string().optional(),
    viewport: z.object({
      width: z.number(),
      height: z.number(),
    }),
  }),
  voiceTranscript: z
    .object({
      transcript: z.string().max(20000),
      durationSeconds: z.number().nonnegative(),
    })
    .nullable()
    .default(null),
});

const feedbackUpdateSchema = z.object({
  status: statusSchema.optional(),
  assignedTo: z.string().nullable().optional(),
  labels: z.array(z.string()).max(50).optional(),
});

export const feedbackRouter = Router();
feedbackRouter.use("/:feedbackId/comments", commentsRouter);

function paramValue(value: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

const priorityLabelSchema = z.enum(["low", "medium", "high", "urgent"]);

feedbackRouter.get("/", requireAuth, async (request, response) => {
  const status =
    typeof request.query.status === "string"
      ? (statusSchema.safeParse(request.query.status).data as FeedbackStatus | undefined)
      : undefined;
  const workspaceId =
    typeof request.query.workspaceId === "string" ? request.query.workspaceId : undefined;
  const projectId =
    typeof request.query.projectId === "string" ? request.query.projectId : undefined;
  const priorityLabel =
    typeof request.query.priorityLabel === "string"
      ? priorityLabelSchema.safeParse(request.query.priorityLabel).data
      : undefined;
  const query =
    typeof request.query.q === "string" ? request.query.q.trim().slice(0, 200) || undefined : undefined;
  const cursor = typeof request.query.cursor === "string" ? request.query.cursor : undefined;
  const limit =
    typeof request.query.limit === "string" ? Number.parseInt(request.query.limit, 10) || undefined : undefined;

  if (workspaceId && workspaceId !== request.authUser?.workspaceId) {
    response.status(403).json({ error: "Workspace access denied" });
    return;
  }

  const result = await repository.listFeedback({
    status,
    workspaceId: workspaceId ?? request.authUser?.workspaceId,
    projectId,
    priorityLabel,
    query,
    cursor,
    limit,
  });

  response.json(result);
});

feedbackRouter.get("/:feedbackId", requireAuth, async (request, response) => {
  const feedbackId = paramValue(request.params.feedbackId);
  const item = await repository.getFeedback(feedbackId);
  if (!item) {
    response.status(404).json({ error: "Feedback item not found" });
    return;
  }
  if (item.workspaceId !== request.authUser?.workspaceId) {
    response.status(403).json({ error: "Workspace access denied" });
    return;
  }
  response.json({ item });
});

feedbackRouter.post("/", feedbackPublicLimiter, async (request, response) => {
  const parsed = feedbackPayloadSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ error: "Invalid payload", issues: parsed.error.flatten() });
    return;
  }

  const submittedProject = await repository.getProjectById(parsed.data.projectId);
  const projectKeyHeader = request.header("x-qelp-project-key");
  if (!submittedProject || submittedProject.workspaceId !== parsed.data.workspaceId) {
    response.status(400).json({ error: "Invalid workspace or project" });
    return;
  }
  if (!projectKeyHeader || submittedProject.widgetToken !== projectKeyHeader) {
    response.status(401).json({ error: "Invalid project widget key" });
    return;
  }

  const created = await repository.createFeedback(parsed.data);
  dispatchTriage(created.id);

  response.status(201).json({ item: created });
});

feedbackRouter.patch(
  "/:feedbackId",
  requireAuth,
  requireRole(["owner", "manager", "contributor"]),
  async (request, response) => {
    const feedbackId = paramValue(request.params.feedbackId);
    const existing = await repository.getFeedback(feedbackId);
    if (!existing) {
      response.status(404).json({ error: "Feedback item not found" });
      return;
    }
    if (existing.workspaceId !== request.authUser?.workspaceId) {
      response.status(403).json({ error: "Workspace access denied" });
      return;
    }

    const parsed = feedbackUpdateSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ error: "Invalid update payload", issues: parsed.error.flatten() });
      return;
    }

    if (parsed.data.assignedTo) {
      const assignee = await repository.getUserById(parsed.data.assignedTo);
      if (!assignee || assignee.workspaceId !== request.authUser?.workspaceId) {
        response.status(400).json({ error: "Cannot assign to a user outside this workspace" });
        return;
      }
    }

    const updated = await repository.updateFeedback(feedbackId, parsed.data);
    response.json({ item: updated });
  },
);
