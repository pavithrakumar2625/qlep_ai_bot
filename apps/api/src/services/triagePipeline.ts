import { eq } from "drizzle-orm";
import { logger } from "../logger.js";
import { db } from "../db/postgres.js";
import { feedbackItems } from "../db/schema.js";
import { repository } from "../repositories/postgresRepository.js";
import { aiTriager } from "./aiTriager.js";
import { transcribeAttachment } from "./stt.js";

async function maybeTranscribeAudio(feedbackId: string): Promise<void> {
  const item = await repository.getFeedback(feedbackId);
  if (!item || item.voiceTranscript) return;

  const audio = item.attachments.find((attachment) => attachment.type === "audio");
  if (!audio) return;

  const result = await transcribeAttachment(audio.id);
  if (!result) return;

  await db
    .update(feedbackItems)
    .set({
      voiceTranscript: result,
      updatedAt: new Date(),
    })
    .where(eq(feedbackItems.id, feedbackId));

  logger.info({ feedbackId, attachmentId: audio.id }, "triage: voice transcribed");
}

export async function runTriage(feedbackId: string): Promise<void> {
  const initial = await repository.getFeedback(feedbackId);
  if (!initial) {
    logger.warn({ feedbackId }, "triage: feedback not found");
    return;
  }

  try {
    await maybeTranscribeAudio(feedbackId);

    const refreshed = await repository.getFeedback(feedbackId);
    if (!refreshed) return;

    const aiAnalysis = await aiTriager.analyze(refreshed);

    // The AI call can take many seconds; re-read the row so we don't clobber
    // changes a curator made via PATCH /feedback/:id while we were waiting.
    // We only set priority when triage hasn't already completed/failed (avoids
    // double-runs racing each other), and we *merge* the AI category into
    // existing labels rather than replacing them, so curator-set labels stick.
    const latest = await repository.getFeedback(feedbackId);
    if (!latest) return;

    const latestStatusRow = await db.query.feedbackItems.findFirst({
      where: eq(feedbackItems.id, feedbackId),
      columns: { triageStatus: true },
    });

    const mergedLabels = Array.from(new Set([...latest.labels, aiAnalysis.category]));
    const update: Parameters<typeof repository.updateFeedback>[1] = {
      aiAnalysis,
      labels: mergedLabels,
    };
    if (latestStatusRow?.triageStatus === "pending") {
      update.priority = aiAnalysis.priorityScore;
    }

    await repository.updateFeedback(feedbackId, update);
    await db
      .update(feedbackItems)
      .set({ triageStatus: "completed" })
      .where(eq(feedbackItems.id, feedbackId));

    logger.info(
      {
        feedbackId,
        provider: aiAnalysis.provider,
        model: aiAnalysis.model,
        priority: aiAnalysis.priorityScore.label,
      },
      "triage: completed",
    );
  } catch (error) {
    await db
      .update(feedbackItems)
      .set({ triageStatus: "failed" })
      .where(eq(feedbackItems.id, feedbackId));
    logger.error({ feedbackId, err: error }, "triage: failed");
  }
}

export function dispatchTriage(feedbackId: string) {
  setImmediate(() => {
    runTriage(feedbackId).catch((error) => {
      logger.error({ feedbackId, err: error }, "triage: dispatcher caught error");
    });
  });
}
