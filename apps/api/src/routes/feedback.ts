import { Router } from "express";
import { z } from "zod";
import type { FeedbackStatus } from "@qelp/shared/contracts";
import { requireAuth, requireRole } from "../auth/middleware.js";
import { repository } from "../repositories/mysqlRepository.js";
import { aiTriager } from "../services/aiTriager.js";

const statusSchema = z.enum(["new", "triaged", "in_progress", "resolved", "archived"]);

const feedbackPayloadSchema = z.object({
  workspaceId: z.string(),
  projectId: z.string(),
  source: z.enum(["widget", "admin", "api"]),
  reporter: z.object({
    id: z.string().optional(),
    email: z.string().email().optional(),
    name: z.string().optional()
  }),
  content: z.object({
    message: z.string().min(10),
    stepsToReproduce: z.array(z.string()).default([]),
    expectedBehavior: z.string().optional(),
    actualBehavior: z.string().optional(),
    affectedUsers: z.number().int().positive().optional()
  }),
  attachments: z.array(
    z.object({
      id: z.string(),
      type: z.enum(["image", "audio", "video", "file"]),
      url: z.string().url(),
      mimeType: z.string(),
      createdAt: z.string()
    }),
  ).default([]),
  environment: z.object({
    url: z.string().url(),
    route: z.string().optional(),
    browser: z.string().optional(),
    os: z.string().optional(),
    locale: z.string().optional(),
    userAgent: z.string().optional(),
    viewport: z.object({
      width: z.number(),
      height: z.number()
    })
  }),
  voiceTranscript: z.object({
    transcript: z.string(),
    durationSeconds: z.number().nonnegative()
  }).nullable().default(null)
});

const feedbackUpdateSchema = z.object({
  status: statusSchema.optional(),
  assignedTo: z.string().nullable().optional(),
  labels: z.array(z.string()).optional()
});

export const feedbackRouter = Router();

function paramValue(value: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

feedbackRouter.get("/", requireAuth, async (request, response) => {
  const status = typeof request.query.status === "string" ? statusSchema.safeParse(request.query.status).data as FeedbackStatus | undefined : undefined;
  const workspaceId = typeof request.query.workspaceId === "string" ? request.query.workspaceId : undefined;
  const projectId = typeof request.query.projectId === "string" ? request.query.projectId : undefined;
  if (workspaceId && workspaceId !== request.authUser?.workspaceId) {
    response.status(403).json({ error: "Workspace access denied" });
    return;
  }

  response.json({
    items: await repository.listFeedback({
      status,
      workspaceId: workspaceId ?? request.authUser?.workspaceId,
      projectId
    })
  });
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

feedbackRouter.post("/", async (request, response) => {
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
  const aiAnalysis = await aiTriager.analyze(created);
  const updated = await repository.updateFeedback(created.id, {
    aiAnalysis,
    priority: aiAnalysis.priorityScore,
    labels: [aiAnalysis.category]
  });

  response.status(201).json({ item: updated });
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

  const updated = await repository.updateFeedback(feedbackId, parsed.data);

  response.json({ item: updated });
});
