import type { AgencyWorkspace, ClientProject, FeedbackItem, FeedbackStatus, User } from "@qelp/shared/contracts";

export interface FeedbackRepository {
  listWorkspaces(): Promise<AgencyWorkspace[]>;
  listProjects(workspaceId?: string): Promise<ClientProject[]>;
  getProjectById(projectId: string): Promise<ClientProject | null>;
  listUsers(workspaceId?: string): Promise<User[]>;
  getUserById(userId: string): Promise<User | null>;
  getUserAuthByEmail(email: string): Promise<{ user: User; passwordHash: string } | null>;
  listFeedback(filters?: { workspaceId?: string; projectId?: string; status?: FeedbackStatus }): Promise<FeedbackItem[]>;
  getFeedback(feedbackId: string): Promise<FeedbackItem | null>;
  createFeedback(
    payload: Pick<
      FeedbackItem,
      "workspaceId" | "projectId" | "reporter" | "content" | "attachments" | "environment" | "source" | "voiceTranscript"
    >,
  ): Promise<FeedbackItem>;
  updateFeedback(feedbackId: string, update: Partial<FeedbackItem>): Promise<FeedbackItem | null>;
}
