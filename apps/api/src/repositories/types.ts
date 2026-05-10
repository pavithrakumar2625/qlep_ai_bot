import type {
  AgencyWorkspace,
  ClientProject,
  FeedbackItem,
  FeedbackStatus,
  User,
  WorkspaceRole,
} from "@qelp/shared/contracts";

export interface ProjectInput {
  name: string;
  clientName: string;
  description: string;
}

export interface UserInput {
  email: string;
  name: string;
  role: WorkspaceRole;
  password: string;
}

export interface FeedbackRepository {
  listWorkspaces(): Promise<AgencyWorkspace[]>;
  listProjects(workspaceId?: string): Promise<ClientProject[]>;
  getProjectById(projectId: string): Promise<ClientProject | null>;
  createProject(workspaceId: string, input: ProjectInput): Promise<ClientProject>;
  updateProject(projectId: string, input: Partial<ProjectInput>): Promise<ClientProject | null>;
  deleteProject(projectId: string): Promise<boolean>;
  rotateProjectToken(projectId: string): Promise<ClientProject | null>;
  listUsers(workspaceId?: string): Promise<User[]>;
  getUserById(userId: string): Promise<User | null>;
  countOwners(workspaceId: string): Promise<number>;
  createUser(workspaceId: string, input: UserInput): Promise<User>;
  updateUser(userId: string, input: Partial<Omit<UserInput, "password">> & { password?: string }): Promise<User | null>;
  deleteUser(userId: string): Promise<boolean>;
  getUserAuthByEmail(email: string): Promise<{ user: User; passwordHash: string } | null>;
  listFeedback(filters?: {
    workspaceId?: string;
    projectId?: string;
    status?: FeedbackStatus;
    priorityLabel?: "low" | "medium" | "high" | "urgent";
    query?: string;
    cursor?: string;
    limit?: number;
  }): Promise<{ items: FeedbackItem[]; nextCursor: string | null }>;
  getFeedback(feedbackId: string): Promise<FeedbackItem | null>;
  createFeedback(
    payload: Pick<
      FeedbackItem,
      "workspaceId" | "projectId" | "reporter" | "content" | "environment" | "source" | "voiceTranscript"
    > & { attachments: { id: string }[] },
  ): Promise<FeedbackItem>;
  updateFeedback(feedbackId: string, update: Partial<FeedbackItem>): Promise<FeedbackItem | null>;
}
