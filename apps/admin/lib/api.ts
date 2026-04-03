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

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? process.env.PUBLIC_API_BASE_URL ?? "http://localhost:4000";

interface ListResponse<T> {
  items: T[];
}

interface ItemResponse<T> {
  item: T;
}

export interface AgencyDashboardData {
  workspace: AgencyWorkspace;
  projects: ClientProject[];
  items: FeedbackItem[];
  summary: ReturnType<typeof getDashboardSummary>;
  usingFallback: boolean;
  authenticated: boolean;
}

export interface FeedbackDetailData {
  workspace: AgencyWorkspace;
  project: ClientProject;
  feedback: FeedbackItem;
  users: User[];
  owner: User | null;
  usingFallback: boolean;
  authenticated: boolean;
}

async function fetchJson<T>(path: string): Promise<T> {
  const token = (await cookies()).get("qelp_token")?.value;
  const response = await fetch(`${API_BASE_URL}${path}`, {
    next: { revalidate: 0 },
    cache: "no-store",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined
  });
  if (!response.ok) throw new Error(`API request failed for ${path}: ${response.status}`);
  return response.json() as Promise<T>;
}

function fallbackDashboard(): AgencyDashboardData {
  const workspace = mockWorkspaces[0];
  const projects = mockProjects.filter((item) => item.workspaceId === workspace.id);
  const items = mockFeedbackItems.filter((item) => item.workspaceId === workspace.id);
  return {
    workspace,
    projects,
    items,
    summary: getDashboardSummary(items),
    usingFallback: true,
    authenticated: false
  };
}

export async function getAgencyDashboardData(): Promise<AgencyDashboardData> {
  try {
    const workspaces = await fetchJson<ListResponse<AgencyWorkspace>>("/workspaces");
    const workspace = workspaces.items[0];
    if (!workspace) return fallbackDashboard();

    const [projects, feedback] = await Promise.all([
      fetchJson<ListResponse<ClientProject>>(`/workspaces/${workspace.id}/projects`),
      fetchJson<ListResponse<FeedbackItem>>(`/workspaces/${workspace.id}/feedback`)
    ]);

    return {
      workspace,
      projects: projects.items,
      items: feedback.items,
      summary: getDashboardSummary(feedback.items),
      usingFallback: false,
      authenticated: true
    };
  } catch {
    return fallbackDashboard();
  }
}

export async function getFeedbackDetailData(projectId: string, feedbackId: string): Promise<FeedbackDetailData | null> {
  try {
    const workspaces = await fetchJson<ListResponse<AgencyWorkspace>>("/workspaces");
    const workspace = workspaces.items[0];
    if (!workspace) return fallbackDetail(projectId, feedbackId);

    const [projects, users, feedbackResponse] = await Promise.all([
      fetchJson<ListResponse<ClientProject>>(`/workspaces/${workspace.id}/projects`),
      fetchJson<ListResponse<User>>(`/workspaces/${workspace.id}/users`),
      fetchJson<ItemResponse<FeedbackItem>>(`/feedback/${feedbackId}`)
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
    usingFallback: true,
    authenticated: false
  };
}
