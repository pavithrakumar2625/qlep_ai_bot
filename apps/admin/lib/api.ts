import {
  getDashboardSummary,
  mockFeedbackItems,
  mockProjects,
  mockUsers,
  mockWorkspaces,
  type AgencyWorkspace,
  type ClientProject,
  type FeedbackItem,
  type User
} from "@qelp/shared/contracts";
import { cookies } from "next/headers";
import { API_BASE_URL, AUTH_COOKIE_NAME } from "./server-config";

interface ListResponse<T> {
  items: T[];
}

interface PagedResponse<T> {
  items: T[];
  nextCursor: string | null;
}

interface ItemResponse<T> {
  item: T;
}

export interface AgencyDashboardData {
  workspace: AgencyWorkspace;
  projects: ClientProject[];
  items: FeedbackItem[];
  nextCursor: string | null;
  summary: ReturnType<typeof getDashboardSummary>;
  analytics: WorkspaceAnalytics | null;
  usingFallback: boolean;
  authenticated: boolean;
}

export interface DashboardFilters {
  status?: string;
  projectId?: string;
  priorityLabel?: string;
  q?: string;
  cursor?: string;
}

export interface WorkspaceAnalytics {
  days: number;
  total: number;
  meanPriority: number;
  meanConfidence: number;
  volumeByDay: { day: string; count: number }[];
  byPriority: { label: string; count: number }[];
  byCategory: { category: string; count: number }[];
  byStatus: { status: string; count: number }[];
  summary: {
    openCount: number;
    urgentCount: number;
    negativeEmotionCount: number;
    averageConfidence: number;
  };
}

export interface WorkspaceSettingsData {
  workspace: AgencyWorkspace;
  projects: ClientProject[];
  users: User[];
  currentUser: User | null;
  authenticated: boolean;
}

export async function getWorkspaceSettingsData(): Promise<WorkspaceSettingsData | null> {
  try {
    const workspaces = await fetchJson<ListResponse<AgencyWorkspace>>("/workspaces");
    const workspace = workspaces.items[0];
    if (!workspace) return null;
    const [projects, users, me] = await Promise.all([
      fetchJson<ListResponse<ClientProject>>(`/workspaces/${workspace.id}/projects`),
      fetchJson<ListResponse<User>>(`/workspaces/${workspace.id}/users`),
      fetchJson<{ user: User }>("/auth/me").catch(() => null),
    ]);
    return {
      workspace,
      projects: projects.items,
      users: users.items,
      currentUser: me?.user ?? null,
      authenticated: true,
    };
  } catch {
    return null;
  }
}

export async function getWorkspaceAnalytics(workspaceId: string, days = 30): Promise<WorkspaceAnalytics | null> {
  try {
    return await fetchJson<WorkspaceAnalytics>(`/workspaces/${workspaceId}/analytics?days=${days}`);
  } catch {
    return null;
  }
}

export interface FeedbackDetailData {
  workspace: AgencyWorkspace;
  project: ClientProject;
  feedback: FeedbackItem;
  users: User[];
  owner: User | null;
  currentUser: User | null;
  usingFallback: boolean;
  authenticated: boolean;
}

async function fetchJson<T>(path: string): Promise<T> {
  const token = (await cookies()).get(AUTH_COOKIE_NAME)?.value;
  const response = await fetch(`${API_BASE_URL}${path}`, {
    next: { revalidate: 0 },
    cache: "no-store",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined
  });
  if (!response.ok) throw new Error(`API request failed for ${path}: ${response.status}`);
  return response.json() as Promise<T>;
}

function fallbackDashboard(filters: DashboardFilters = {}): AgencyDashboardData {
  const workspace = mockWorkspaces[0];
  const projects = mockProjects.filter((item) => item.workspaceId === workspace.id);
  const allItems = mockFeedbackItems.filter((item) => item.workspaceId === workspace.id);
  const items = applyMockFilters(allItems, filters);
  return {
    workspace,
    projects,
    items,
    nextCursor: null,
    summary: getDashboardSummary(allItems),
    analytics: null,
    usingFallback: true,
    authenticated: false
  };
}

function applyMockFilters(items: FeedbackItem[], filters: DashboardFilters) {
  return items.filter((item) => {
    if (filters.status && item.status !== filters.status) return false;
    if (filters.projectId && item.projectId !== filters.projectId) return false;
    if (filters.priorityLabel && item.priority.label !== filters.priorityLabel) return false;
    if (filters.q) {
      const needle = filters.q.toLowerCase();
      const haystack = `${item.content.message} ${item.aiAnalysis?.title ?? ""}`.toLowerCase();
      if (!haystack.includes(needle)) return false;
    }
    return true;
  });
}

function buildQuery(filters: DashboardFilters) {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.projectId) params.set("projectId", filters.projectId);
  if (filters.priorityLabel) params.set("priorityLabel", filters.priorityLabel);
  if (filters.q) params.set("q", filters.q);
  if (filters.cursor) params.set("cursor", filters.cursor);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export async function getAgencyDashboardData(
  filters: DashboardFilters = {},
): Promise<AgencyDashboardData> {
  try {
    const workspaces = await fetchJson<ListResponse<AgencyWorkspace>>("/workspaces");
    const workspace = workspaces.items[0];
    if (!workspace) return fallbackDashboard(filters);

    const [projects, feedback, analytics] = await Promise.all([
      fetchJson<ListResponse<ClientProject>>(`/workspaces/${workspace.id}/projects`),
      fetchJson<PagedResponse<FeedbackItem>>(
        `/feedback${buildQuery({ ...filters, projectId: filters.projectId })}`,
      ),
      fetchJson<WorkspaceAnalytics>(`/workspaces/${workspace.id}/analytics?days=30`).catch(
        () => null,
      ),
    ]);

    // KPIs come from the analytics endpoint, which aggregates server-side
    // across the entire workspace. Computing them client-side from the
    // paginated /feedback response would shrink the counts to whatever fit
    // on the current page (default 25 items).
    const summary =
      analytics?.summary ?? getDashboardSummary(feedback.items);

    return {
      workspace,
      projects: projects.items,
      items: feedback.items,
      nextCursor: feedback.nextCursor,
      summary,
      analytics,
      usingFallback: false,
      authenticated: true
    };
  } catch {
    return fallbackDashboard(filters);
  }
}

export async function getFeedbackDetailData(projectId: string, feedbackId: string): Promise<FeedbackDetailData | null> {
  try {
    const workspaces = await fetchJson<ListResponse<AgencyWorkspace>>("/workspaces");
    const workspace = workspaces.items[0];
    if (!workspace) return fallbackDetail(projectId, feedbackId);

    const [projects, users, feedbackResponse, me] = await Promise.all([
      fetchJson<ListResponse<ClientProject>>(`/workspaces/${workspace.id}/projects`),
      fetchJson<ListResponse<User>>(`/workspaces/${workspace.id}/users`),
      fetchJson<ItemResponse<FeedbackItem>>(`/feedback/${feedbackId}`),
      fetchJson<{ user: User }>("/auth/me").catch(() => null),
    ]);

    const project = projects.items.find((item) => item.id === projectId);
    const feedback = feedbackResponse.item;
    if (!project || feedback.projectId !== projectId) return fallbackDetail(projectId, feedbackId);

    return {
      workspace,
      project,
      feedback,
      users: users.items,
      owner: feedback.assignedTo ? users.items.find((item) => item.id === feedback.assignedTo) ?? null : null,
      currentUser: me?.user ?? null,
      usingFallback: false,
      authenticated: true
    };
  } catch {
    return fallbackDetail(projectId, feedbackId);
  }
}

function fallbackDetail(projectId: string, feedbackId: string): FeedbackDetailData | null {
  const workspace = mockWorkspaces[0];
  const project = mockProjects.find((item) => item.id === projectId);
  const feedback = mockFeedbackItems.find((item) => item.id === feedbackId && item.projectId === projectId);
  if (!project || !feedback) return null;

  return {
    workspace,
    project,
    feedback,
    users: mockUsers.filter((item) => item.workspaceId === workspace.id),
    owner: feedback.assignedTo ? mockUsers.find((item) => item.id === feedback.assignedTo) ?? null : null,
    currentUser: null,
    usingFallback: true,
    authenticated: false
  };
}
