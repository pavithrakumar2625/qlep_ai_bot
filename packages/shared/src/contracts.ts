export type WorkspaceRole = "owner" | "manager" | "contributor" | "client_viewer";
export type FeedbackSource = "widget" | "admin" | "api";
export type FeedbackStatus = "new" | "triaged" | "in_progress" | "resolved" | "archived";
export type AttachmentType = "image" | "audio" | "video" | "file";

export interface AgencyWorkspace {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
}

export interface ClientProject {
  id: string;
  workspaceId: string;
  name: string;
  key: string;
  clientName: string;
  description: string;
  widgetToken: string;
}

export interface User {
  id: string;
  workspaceId: string;
  email: string;
  name: string;
  role: WorkspaceRole;
}

export interface ReporterIdentity {
  id?: string;
  email?: string;
  name?: string;
}

export interface FeedbackContent {
  message: string;
  stepsToReproduce: string[];
  expectedBehavior?: string;
  actualBehavior?: string;
  affectedUsers?: number;
}

export interface Attachment {
  id: string;
  type: AttachmentType;
  url: string;
  mimeType: string;
  createdAt: string;
}

export interface EnvironmentSnapshot {
  url: string;
  route?: string;
  browser?: string;
  os?: string;
  locale?: string;
  userAgent?: string;
  viewport: {
    width: number;
    height: number;
  };
}

export interface VoiceTranscript {
  transcript: string;
  durationSeconds: number;
}

export interface EmotionAnalysis {
  primary: "positive" | "neutral" | "negative";
  secondary?: "frustrated" | "urgent" | "confused" | "calm";
}

export interface PriorityScore {
  value: number;
  label: "low" | "medium" | "high" | "urgent";
}

export interface PriorityInput {
  severity: "low" | "medium" | "high" | "critical";
  emotion: "positive" | "neutral" | "negative";
  affectedUsers: number;
  reproducibility: "low" | "medium" | "high" | "unclear";
}

export interface AIAnalysis {
  id: string;
  provider: string;
  model: string;
  generatedAt: string;
  title: string;
  summary: string;
  emotion: EmotionAnalysis;
  category: string;
  severity: PriorityInput["severity"];
  probableCause: string;
  suggestedFix: string;
  duplicateFingerprint: string;
  priorityScore: PriorityScore;
  confidence: number;
}

export interface Comment {
  id: string;
  authorId: string;
  body: string;
  createdAt: string;
}

export interface FeedbackItem {
  id: string;
  workspaceId: string;
  projectId: string;
  reporter: ReporterIdentity;
  content: FeedbackContent;
  attachments: Attachment[];
  environment: EnvironmentSnapshot;
  source: FeedbackSource;
  status: FeedbackStatus;
  labels: string[];
  assignedTo: string | null;
  priority: PriorityScore;
  voiceTranscript: VoiceTranscript | null;
  aiAnalysis: AIAnalysis | null;
  comments: Comment[];
  createdAt: string;
  updatedAt: string;
}

export function createId(prefix: string) {
  const bytes = new Uint8Array(8);
  globalThis.crypto.getRandomValues(bytes);
  let hex = "";
  for (const byte of bytes) hex += byte.toString(16).padStart(2, "0");
  return `${prefix}_${hex}`;
}

export function scorePriority(input: PriorityInput): PriorityScore {
  const severityWeight = { low: 15, medium: 35, high: 60, critical: 82 }[input.severity];
  const emotionWeight = { positive: -5, neutral: 0, negative: 10 }[input.emotion];
  const reproducibilityWeight = { low: 3, medium: 7, high: 12, unclear: 4 }[input.reproducibility];
  const userImpact = Math.min(input.affectedUsers * 2, 18);
  const total = Math.max(0, Math.min(100, severityWeight + emotionWeight + reproducibilityWeight + userImpact));

  if (total >= 80) return { value: total, label: "urgent" };
  if (total >= 55) return { value: total, label: "high" };
  if (total >= 30) return { value: total, label: "medium" };
  return { value: total, label: "low" };
}

export function getDashboardSummary(items: FeedbackItem[]) {
  const openCount = items.filter((item) => item.status !== "resolved" && item.status !== "archived").length;
  const urgentCount = items.filter((item) => item.priority.label === "urgent").length;
  const averageConfidence = Math.round(
    (items.reduce((sum, item) => sum + (item.aiAnalysis?.confidence ?? 0), 0) / Math.max(items.length, 1)) * 100,
  );
  const negativeEmotionCount = items.filter((item) => item.aiAnalysis?.emotion.primary === "negative").length;

  return { openCount, urgentCount, averageConfidence, negativeEmotionCount };
}

const now = new Date("2026-04-03T10:00:00.000Z").toISOString();

export const mockWorkspaces: AgencyWorkspace[] = [
  { id: "ws_studio", name: "Northstar Studio", slug: "northstar-studio", createdAt: now },
];

export const mockProjects: ClientProject[] = [
  {
    id: "proj_meteor",
    workspaceId: "ws_studio",
    name: "Meteor Console",
    key: "meteor-console",
    clientName: "Meteor Health",
    description: "Operations portal for staff, patients, and admin teams.",
    widgetToken: "widget_live_meteor",
  },
  {
    id: "proj_orbit",
    workspaceId: "ws_studio",
    name: "Orbit Workspace",
    key: "orbit-workspace",
    clientName: "Orbit Commerce",
    description: "Commerce backoffice used by regional retail teams.",
    widgetToken: "widget_live_orbit",
  },
];

export const mockUsers: User[] = [
  { id: "usr_ana", workspaceId: "ws_studio", email: "ana@northstar.test", name: "Ana Shah", role: "owner" },
  { id: "usr_lee", workspaceId: "ws_studio", email: "lee@northstar.test", name: "Lee Wong", role: "manager" },
  { id: "usr_maya", workspaceId: "ws_studio", email: "maya@meteor.test", name: "Maya Clarke", role: "client_viewer" }
];

export const mockFeedbackItems: FeedbackItem[] = [
  {
    id: "fb_auth_01",
    workspaceId: "ws_studio",
    projectId: "proj_meteor",
    reporter: { email: "ops@meteor.example" },
    content: {
      message: "Users cannot log in after password reset and the dashboard sends them back to the login page.",
      stepsToReproduce: ["Reset password", "Log in with new password", "Observe redirect loop"],
      affectedUsers: 6,
    },
    attachments: [],
    environment: {
      url: "https://meteor.example.com/login",
      route: "/login",
      browser: "Chrome",
      os: "Windows",
      locale: "en-US",
      userAgent: "Mozilla/5.0",
      viewport: { width: 1440, height: 900 }
    },
    source: "widget",
    status: "triaged",
    labels: ["authentication"],
    assignedTo: "usr_lee",
    priority: scorePriority({ severity: "critical", emotion: "negative", affectedUsers: 6, reproducibility: "high" }),
    voiceTranscript: {
      transcript: "Customers say they are stuck in a login loop right after resetting their password.",
      durationSeconds: 12
    },
    aiAnalysis: {
      id: "ai_auth_01",
      provider: "openai",
      model: "gpt-5.4-mini",
      generatedAt: now,
      title: "Password reset flow causes login loop",
      summary: "Users are blocked from accessing the dashboard after password reset because the session does not persist.",
      emotion: { primary: "negative", secondary: "frustrated" },
      category: "authentication",
      severity: "critical",
      probableCause: "Session token or cookie refresh handling likely fails after password reset.",
      suggestedFix: "Audit the reset callback, inspect session issuance, and add regression coverage around post-reset sign-in.",
      duplicateFingerprint: "authentication:/login",
      priorityScore: scorePriority({ severity: "critical", emotion: "negative", affectedUsers: 6, reproducibility: "high" }),
      confidence: 0.88
    },
    comments: [],
    createdAt: now,
    updatedAt: now
  },
  {
    id: "fb_perf_01",
    workspaceId: "ws_studio",
    projectId: "proj_orbit",
    reporter: { name: "Regional manager" },
    content: {
      message: "The analytics page is extremely slow on Monday mornings when teams open weekly reports.",
      stepsToReproduce: ["Open analytics dashboard", "Choose weekly report", "Wait over 10 seconds"],
      affectedUsers: 18
    },
    attachments: [],
    environment: {
      url: "https://orbit.example.com/analytics",
      route: "/analytics",
      browser: "Edge",
      os: "Windows",
      locale: "en-GB",
      userAgent: "Mozilla/5.0",
      viewport: { width: 1536, height: 864 }
    },
    source: "widget",
    status: "new",
    labels: ["performance"],
    assignedTo: null,
    priority: scorePriority({ severity: "high", emotion: "neutral", affectedUsers: 18, reproducibility: "medium" }),
    voiceTranscript: null,
    aiAnalysis: {
      id: "ai_perf_01",
      provider: "openai",
      model: "gpt-5.4-mini",
      generatedAt: now,
      title: "Weekly analytics page slows down during peak usage",
      summary: "Report loading latency spikes for multiple regional teams during a predictable weekly usage window.",
      emotion: { primary: "neutral", secondary: "urgent" },
      category: "performance",
      severity: "high",
      probableCause: "A reporting query or aggregation path likely degrades under concurrent load.",
      suggestedFix: "Profile the report query path, introduce caching for recurring weekly views, and review recent query plan changes.",
      duplicateFingerprint: "performance:/analytics",
      priorityScore: scorePriority({ severity: "high", emotion: "neutral", affectedUsers: 18, reproducibility: "medium" }),
      confidence: 0.79
    },
    comments: [],
    createdAt: now,
    updatedAt: now
  }
];
