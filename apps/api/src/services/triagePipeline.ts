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
    await repository.updateFeedback(feedbackId, {
      aiAnalysis,
      priority: aiAnalysis.priorityScore,
      labels: [aiAnalysis.category],
    });
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
