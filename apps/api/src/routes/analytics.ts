import { and, eq, gte, sql } from "drizzle-orm";
import { Router } from "express";
import { requireAuth } from "../auth/middleware.js";
import { db } from "../db/postgres.js";
import { feedbackItems } from "../db/schema.js";

export const analyticsRouter = Router();

analyticsRouter.use(requireAuth);

analyticsRouter.get("/:workspaceId/analytics", async (request, response) => {
  const workspaceId = String(request.params.workspaceId);
  if (request.authUser?.workspaceId !== workspaceId) {
    response.status(403).json({ error: "Workspace access denied" });
    return;
  }

  const days = Math.max(1, Math.min(Number(request.query.days ?? 30), 365));
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const baseConditions = and(
    eq(feedbackItems.workspaceId, workspaceId),
    gte(feedbackItems.createdAt, since),
  );

  const volumeRows = await db
    .select({
      day: sql<string>`to_char(date_trunc('day', ${feedbackItems.createdAt}), 'YYYY-MM-DD')`,
      count: sql<number>`count(*)::int`,
    })
    .from(feedbackItems)
    .where(baseConditions)
    .groupBy(sql`date_trunc('day', ${feedbackItems.createdAt})`)
    .orderBy(sql`date_trunc('day', ${feedbackItems.createdAt})`);

  const byPriorityRows = await db
    .select({
      label: sql<string>`coalesce(${feedbackItems.priority} ->> 'label', 'unknown')`,
      count: sql<number>`count(*)::int`,
    })
    .from(feedbackItems)
    .where(baseConditions)
    .groupBy(sql`${feedbackItems.priority} ->> 'label'`);

  const byCategoryRows = await db
    .select({
      category: sql<string>`coalesce(${feedbackItems.aiAnalysis} ->> 'category', 'pending')`,
      count: sql<number>`count(*)::int`,
    })
    .from(feedbackItems)
    .where(baseConditions)
    .groupBy(sql`${feedbackItems.aiAnalysis} ->> 'category'`);

  const byStatusRows = await db
    .select({
      status: feedbackItems.status,
      count: sql<number>`count(*)::int`,
    })
    .from(feedbackItems)
    .where(baseConditions)
    .groupBy(feedbackItems.status);

  const meansRow = await db
    .select({
      meanPriority: sql<number | null>`avg((${feedbackItems.priority} ->> 'value')::numeric)`,
      meanConfidence: sql<number | null>`avg((${feedbackItems.aiAnalysis} ->> 'confidence')::numeric)`,
      total: sql<number>`count(*)::int`,
    })
    .from(feedbackItems)
    .where(baseConditions);

  const means = meansRow[0];

  // The dashboard KPI tiles describe the workspace as a whole, not just the
  // analytics window — compute these against every feedback row for this
  // workspace so they don't shrink as the page size shrinks.
  const summaryRow = await db
    .select({
      openCount: sql<number>`count(*) filter (where ${feedbackItems.status} not in ('resolved', 'archived'))::int`,
      urgentCount: sql<number>`count(*) filter (where ${feedbackItems.priority} ->> 'label' = 'urgent')::int`,
      negativeEmotionCount: sql<number>`count(*) filter (where ${feedbackItems.aiAnalysis} -> 'emotion' ->> 'primary' = 'negative')::int`,
      averageConfidence: sql<number | null>`avg((${feedbackItems.aiAnalysis} ->> 'confidence')::numeric) filter (where ${feedbackItems.aiAnalysis} is not null)`,
    })
    .from(feedbackItems)
    .where(eq(feedbackItems.workspaceId, workspaceId));

  const summary = summaryRow[0];

  response.json({
    days,
    total: means?.total ?? 0,
    meanPriority: means?.meanPriority ? Number(means.meanPriority) : 0,
    meanConfidence: means?.meanConfidence ? Number(means.meanConfidence) : 0,
    volumeByDay: volumeRows,
    byPriority: byPriorityRows,
    byCategory: byCategoryRows,
    byStatus: byStatusRows,
    summary: {
      openCount: summary?.openCount ?? 0,
      urgentCount: summary?.urgentCount ?? 0,
      negativeEmotionCount: summary?.negativeEmotionCount ?? 0,
      averageConfidence: summary?.averageConfidence
        ? Math.round(Number(summary.averageConfidence) * 100)
        : 0,
    },
  });
});
