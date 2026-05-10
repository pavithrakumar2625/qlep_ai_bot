import { eq } from "drizzle-orm";
import type { Readable } from "node:stream";
import { env } from "../config/env.js";
import { db } from "../db/postgres.js";
import { attachments } from "../db/schema.js";
import { logger } from "../logger.js";
import { storage } from "./storage/index.js";

export interface SttResult {
  transcript: string;
  durationSeconds: number;
}

interface ProviderConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

function chooseProvider(): ProviderConfig | null {
  if (env.STT_PROVIDER === "none") return null;
  if (env.STT_PROVIDER === "openai" && env.OPENAI_API_KEY) {
    return {
      baseUrl: "https://api.openai.com/v1",
      apiKey: env.OPENAI_API_KEY,
      model: env.STT_MODEL,
    };
  }
  if (env.STT_PROVIDER === "groq" && env.GROQ_API_KEY) {
    return {
      baseUrl: "https://api.groq.com/openai/v1",
      apiKey: env.GROQ_API_KEY,
      model: env.STT_MODEL,
    };
  }
  return null;
}

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : (chunk as Buffer));
  }
  return Buffer.concat(chunks);
}

export async function transcribeAttachment(attachmentId: string): Promise<SttResult | null> {
  const provider = chooseProvider();
  if (!provider) {
    logger.debug({ attachmentId }, "stt: no provider configured, skipping");
    return null;
  }

  const row = await db.query.attachments.findFirst({ where: eq(attachments.id, attachmentId) });
  if (!row || row.type !== "audio") {
    return null;
  }

  const startedAt = Date.now();
  try {
    const stream = await storage.get(row.storageKey);
    const buffer = await streamToBuffer(stream);
    const arrayBuffer = new ArrayBuffer(buffer.byteLength);
    new Uint8Array(arrayBuffer).set(buffer);
    const blob = new Blob([arrayBuffer], { type: row.mimeType });

    const form = new FormData();
    form.append("file", blob, `audio.${row.mimeType.split("/")[1] ?? "webm"}`);
    form.append("model", provider.model);

    const response = await fetch(`${provider.baseUrl}/audio/transcriptions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${provider.apiKey}` },
      body: form,
      signal: AbortSignal.timeout(env.AI_TIMEOUT_MS),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`STT provider returned ${response.status}: ${errorBody.slice(0, 200)}`);
    }

    const data = (await response.json()) as { text?: string; duration?: number };
    if (!data.text) return null;

    return {
      transcript: data.text,
      durationSeconds: typeof data.duration === "number" ? data.duration : 0,
    };
  } catch (error) {
    logger.warn(
      { attachmentId, durationMs: Date.now() - startedAt, err: error },
      "stt: transcription failed",
    );
    return null;
  }
}
