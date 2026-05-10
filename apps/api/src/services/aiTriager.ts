import { z } from "zod";
import { createId, scorePriority, type AIAnalysis, type EmotionAnalysis, type FeedbackItem, type PriorityInput } from "@qelp/shared/contracts";
import { env } from "../config/env.js";
import { logger } from "../logger.js";

const MAX_PROMPT_FIELD_CHARS = 8000;

export interface AIProvider {
  analyze(feedback: FeedbackItem): Promise<AIAnalysis>;
}

const aiResponseSchema = z.object({
  title: z.string().min(3).max(120),
  summary: z.string().min(10).max(500),
  emotion: z.object({
    primary: z.enum(["positive", "neutral", "negative"]),
    secondary: z.enum(["frustrated", "urgent", "confused", "calm"]).optional()
  }),
  category: z.string().min(2).max(60),
  severity: z.enum(["low", "medium", "high", "critical"]),
  probableCause: z.string().min(10).max(300),
  suggestedFix: z.string().min(10).max(400),
  duplicateFingerprint: z.string().min(3).max(120),
  confidence: z.number().min(0).max(1)
});

class DeterministicAIProvider implements AIProvider {
  async analyze(feedback: FeedbackItem): Promise<AIAnalysis> {
    return buildFallbackAnalysis(feedback);
  }
}

class OpenAIResponsesProvider implements AIProvider {
  async analyze(feedback: FeedbackItem): Promise<AIAnalysis> {
    const parsed = await callResponsesApi({
      baseUrl: "https://api.openai.com/v1",
      apiKey: env.OPENAI_API_KEY!,
      model: env.OPENAI_MODEL,
      provider: "openai",
      feedback
    });
    return mapParsedAnalysis(parsed, feedback, "openai", env.OPENAI_MODEL);
  }
}

class GroqResponsesProvider implements AIProvider {
  async analyze(feedback: FeedbackItem): Promise<AIAnalysis> {
    const parsed = await callResponsesApi({
      baseUrl: "https://api.groq.com/openai/v1",
      apiKey: env.GROQ_API_KEY!,
      model: env.GROQ_MODEL,
      provider: "groq",
      feedback
    });
    return mapParsedAnalysis(parsed, feedback, "groq", env.GROQ_MODEL);
  }
}

class FailoverAIProvider implements AIProvider {
  private readonly fallback = new DeterministicAIProvider();

  async analyze(feedback: FeedbackItem): Promise<AIAnalysis> {
    const provider = chooseProvider();
    if (!provider) {
      return this.fallback.analyze(feedback);
    }

    const started = Date.now();
    try {
      return await provider.analyze(feedback);
    } catch (error) {
      logger.warn(
        {
          feedbackId: feedback.id,
          durationMs: Date.now() - started,
          err: error instanceof Error ? { message: error.message, name: error.name } : error,
        },
        "ai-triager: provider call failed, using deterministic fallback",
      );
      return this.fallback.analyze(feedback);
    }
  }
}

export const aiTriager: AIProvider = new FailoverAIProvider();

function chooseProvider(): AIProvider | null {
  if (env.AI_PROVIDER === "fallback") return null;
  if (env.AI_PROVIDER === "openai") return env.OPENAI_API_KEY ? new OpenAIResponsesProvider() : null;
  if (env.AI_PROVIDER === "groq") return env.GROQ_API_KEY ? new GroqResponsesProvider() : null;
  if (env.OPENAI_API_KEY) return new OpenAIResponsesProvider();
  if (env.GROQ_API_KEY) return new GroqResponsesProvider();
  return null;
}

async function callResponsesApi(input: {
  baseUrl: string;
  apiKey: string;
  model: string;
  provider: "openai" | "groq";
  feedback: FeedbackItem;
}) {
  const response = await fetch(`${input.baseUrl}/responses`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${input.apiKey}`
    },
    signal: AbortSignal.timeout(env.AI_TIMEOUT_MS),
    body: JSON.stringify({
      model: input.model,
      reasoning: env.AI_REASONING_EFFORT === "none" ? undefined : { effort: env.AI_REASONING_EFFORT },
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text:
                "You classify SaaS bug reports for an agency triage tool. Return only valid JSON matching the requested schema. Be concise, technical, and avoid markdown."
            }
          ]
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: buildPrompt(input.feedback)
            }
          ]
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "qelp_triage_analysis",
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              title: { type: "string" },
              summary: { type: "string" },
              emotion: {
                type: "object",
                additionalProperties: false,
                properties: {
                  primary: { type: "string", enum: ["positive", "neutral", "negative"] },
                  secondary: { type: "string", enum: ["frustrated", "urgent", "confused", "calm"] }
                },
                required: ["primary"]
              },
              category: { type: "string" },
              severity: { type: "string", enum: ["low", "medium", "high", "critical"] },
              probableCause: { type: "string" },
              suggestedFix: { type: "string" },
              duplicateFingerprint: { type: "string" },
              confidence: { type: "number" }
            },
            required: ["title", "summary", "emotion", "category", "severity", "probableCause", "suggestedFix", "duplicateFingerprint", "confidence"]
          }
        }
      }
    })
  });

  if (!response.ok) {
    throw new Error(`AI provider request failed with ${response.status}`);
  }

  const data = (await response.json()) as { output_text?: string };
  const jsonText = typeof data.output_text === "string" ? data.output_text : "";
  return aiResponseSchema.parse(JSON.parse(jsonText));
}

function truncate(value: string | null | undefined, max: number) {
  if (typeof value !== "string") return value ?? null;
  if (value.length <= max) return value;
  return `${value.slice(0, max)}…[truncated ${value.length - max} chars]`;
}

function buildPrompt(feedback: FeedbackItem) {
  return JSON.stringify(
    {
      message: truncate(feedback.content.message, MAX_PROMPT_FIELD_CHARS),
      stepsToReproduce: feedback.content.stepsToReproduce
        .slice(0, 20)
        .map((step) => truncate(step, 1000)),
      expectedBehavior: truncate(feedback.content.expectedBehavior, 2000),
      actualBehavior: truncate(feedback.content.actualBehavior, 2000),
      affectedUsers: feedback.content.affectedUsers ?? 1,
      environment: feedback.environment,
      voiceTranscript: truncate(feedback.voiceTranscript?.transcript ?? null, MAX_PROMPT_FIELD_CHARS),
    },
    null,
    2,
  );
}

function mapParsedAnalysis(
  parsed: z.infer<typeof aiResponseSchema>,
  feedback: FeedbackItem,
  provider: string,
  model: string,
): AIAnalysis {
  const priorityInput: PriorityInput = {
    severity: parsed.severity,
    emotion: parsed.emotion.primary,
    affectedUsers: feedback.content.affectedUsers ?? 1,
    reproducibility: feedback.content.stepsToReproduce.length ? "high" : "unclear"
  };

  return {
    id: createId("ai"),
    provider,
    model,
    generatedAt: new Date().toISOString(),
    title: parsed.title,
    summary: parsed.summary,
    emotion: parsed.emotion,
    category: parsed.category,
    severity: parsed.severity,
    probableCause: parsed.probableCause,
    suggestedFix: parsed.suggestedFix,
    duplicateFingerprint: parsed.duplicateFingerprint,
    priorityScore: scorePriority(priorityInput),
    confidence: parsed.confidence
  };
}

function buildFallbackAnalysis(feedback: FeedbackItem): AIAnalysis {
  const severity = inferSeverity(feedback.content.message);
  const emotion = inferEmotion(feedback.content.message, feedback.voiceTranscript?.transcript);
  const category = inferCategory(feedback.content.message);
  const priorityInput: PriorityInput = {
    severity,
    emotion: emotion.primary,
    affectedUsers: feedback.content.affectedUsers ?? 1,
    reproducibility: feedback.content.stepsToReproduce.length ? "high" : "unclear"
  };

  return {
    id: createId("ai"),
    provider: "deterministic-fallback",
    model: "rules-v1",
    generatedAt: new Date().toISOString(),
    title: summarizeTitle(feedback.content.message),
    summary: `Customer-reported issue: ${feedback.content.message.trim().slice(0, 240)}`,
    emotion,
    category,
    severity,
    probableCause: probableCauseFor(category),
    suggestedFix: suggestedFixFor(category),
    duplicateFingerprint: `${category}:${feedback.environment.route ?? "unknown"}`.toLowerCase(),
    priorityScore: scorePriority(priorityInput),
    confidence: 0.64
  };
}

function inferSeverity(message: string): PriorityInput["severity"] {
  const normalized = message.toLowerCase();
  if (normalized.includes("cannot log in") || normalized.includes("payment") || normalized.includes("crash")) return "critical";
  if (normalized.includes("error") || normalized.includes("broken") || normalized.includes("fail")) return "high";
  if (normalized.includes("slow") || normalized.includes("delay")) return "medium";
  return "low";
}

function inferEmotion(message: string, transcript?: string | null): EmotionAnalysis {
  const normalized = `${message} ${transcript ?? ""}`.toLowerCase();
  if (normalized.includes("frustrat") || normalized.includes("angry") || normalized.includes("stuck")) {
    return { primary: "negative", secondary: "frustrated" };
  }
  if (normalized.includes("urgent") || normalized.includes("asap")) {
    return { primary: "negative", secondary: "urgent" };
  }
  if (normalized.includes("confus")) {
    return { primary: "negative", secondary: "confused" };
  }
  if (normalized.includes("love") || normalized.includes("great")) {
    return { primary: "positive", secondary: "calm" };
  }
  return { primary: "neutral" };
}

function inferCategory(message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes("billing") || normalized.includes("payment")) return "billing";
  if (normalized.includes("login") || normalized.includes("password") || normalized.includes("auth")) return "authentication";
  if (normalized.includes("dashboard") || normalized.includes("page")) return "ui";
  if (normalized.includes("slow") || normalized.includes("latency")) return "performance";
  return "bug";
}

function summarizeTitle(message: string) {
  return message.trim().split(/[.!?]/)[0]?.slice(0, 80) || "User feedback received";
}

function probableCauseFor(category: string) {
  switch (category) {
    case "billing":
      return "Payment state validation or webhook reconciliation may be failing.";
    case "authentication":
      return "Session persistence or token refresh handling is the likely failure point.";
    case "performance":
      return "A slow reporting or aggregation path likely degrades under load.";
    case "ui":
      return "A frontend state, routing, or layout regression is the likely cause.";
    default:
      return "Additional reproduction data is needed before confirming root cause.";
  }
}

function suggestedFixFor(category: string) {
  switch (category) {
    case "billing":
      return "Inspect payment logs, verify webhook delivery, and add customer-facing fallback messaging.";
    case "authentication":
      return "Trace sign-in events, verify token or cookie issuance, and add reset-flow regression tests.";
    case "performance":
      return "Profile the slow route, inspect peak query plans, and cache repeated report paths.";
    case "ui":
      return "Reproduce in the reported browser, review recent UI changes, and add targeted regression coverage.";
    default:
      return "Classify manually and gather more context before choosing a fix path.";
  }
}
