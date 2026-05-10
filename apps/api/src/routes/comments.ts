import { and, asc, eq } from "drizzle-orm";
import { Router, type Request } from "express";
import { z } from "zod";
import { createId } from "@qelp/shared/contracts";
import { requireAuth } from "../auth/middleware.js";
import { db } from "../db/postgres.js";
import { comments as commentsTable, feedbackItems } from "../db/schema.js";

export const commentsRouter = Router({ mergeParams: true });

function paramString(request: Request, key: string): string {
  const value = (request.params as Record<string, string | string[] | undefined>)[key];
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

const bodySchema = z.object({ body: z.string().trim().min(1).max(4000) });

async function loadFeedback(feedbackId: string, workspaceId: string) {
  return db.query.feedbackItems.findFirst({
    where: and(eq(feedbackItems.id, feedbackId), eq(feedbackItems.workspaceId, workspaceId)),
  });
}

commentsRouter.use(requireAuth);

commentsRouter.get("/", async (request, response) => {
  const feedbackId = paramString(request, "feedbackId");
  const workspaceId = request.authUser?.workspaceId;
  if (!workspaceId) {
    response.status(401).json({ error: "Authentication required" });
    return;
  }
  const feedback = await loadFeedback(feedbackId, workspaceId);
  if (!feedback) {
    response.status(404).json({ error: "Feedback not found" });
    return;
  }

  const rows = await db
    .select()
    .from(commentsTable)
    .where(eq(commentsTable.feedbackId, feedbackId))
    .orderBy(asc(commentsTable.createdAt));

  response.json({
    items: rows.map((row) => ({
      id: row.id,
      authorId: row.authorId,
      body: row.body,
      createdAt: row.createdAt.toISOString(),
    })),
  });
});

commentsRouter.post("/", async (request, response) => {
  const feedbackId = paramString(request, "feedbackId");
  const workspaceId = request.authUser?.workspaceId;
  const userId = request.authUser?.id;
  if (!workspaceId || !userId) {
    response.status(401).json({ error: "Authentication required" });
    return;
  }
  const feedback = await loadFeedback(feedbackId, workspaceId);
  if (!feedback) {
    response.status(404).json({ error: "Feedback not found" });
    return;
  }
  const parsed = bodySchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ error: "Invalid comment body", issues: parsed.error.flatten() });
    return;
  }

  const id = createId("cmt");
  const now = new Date();
  await db.insert(commentsTable).values({
    id,
    feedbackId,
    authorId: userId,
    body: parsed.data.body,
    createdAt: now,
  });

  response.status(201).json({
    item: {
      id,
      authorId: userId,
      body: parsed.data.body,
      createdAt: now.toISOString(),
    },
  });
});

commentsRouter.delete("/:commentId", async (request, response) => {
  const feedbackId = paramString(request, "feedbackId");
  const commentId = paramString(request, "commentId");
  const workspaceId = request.authUser?.workspaceId;
  const userId = request.authUser?.id;
  const role = request.authUser?.role;
  if (!workspaceId || !userId) {
    response.status(401).json({ error: "Authentication required" });
    return;
  }
  const feedback = await loadFeedback(feedbackId, workspaceId);
  if (!feedback) {
    response.status(404).json({ error: "Feedback not found" });
    return;
  }

  const existing = await db.query.comments.findFirst({
    where: and(eq(commentsTable.id, commentId), eq(commentsTable.feedbackId, feedbackId)),
  });
  if (!existing) {
    response.status(404).json({ error: "Comment not found" });
    return;
  }
  if (existing.authorId !== userId && role !== "owner") {
    response.status(403).json({ error: "Not allowed to delete this comment" });
    return;
  }

  await db.delete(commentsTable).where(eq(commentsTable.id, commentId));
  response.json({ ok: true });
});
