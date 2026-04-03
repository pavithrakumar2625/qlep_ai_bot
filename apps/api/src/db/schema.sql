CREATE TABLE IF NOT EXISTS agency_workspaces (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL UNIQUE,
  created_at DATETIME(3) NOT NULL
);

CREATE TABLE IF NOT EXISTS client_projects (
  id VARCHAR(64) PRIMARY KEY,
  workspace_id VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  `key` VARCHAR(255) NOT NULL UNIQUE,
  client_name VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  widget_token VARCHAR(255) NOT NULL UNIQUE,
  CONSTRAINT fk_client_projects_workspace
    FOREIGN KEY (workspace_id) REFERENCES agency_workspaces(id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) PRIMARY KEY,
  workspace_id VARCHAR(64) NOT NULL,
  email VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('owner', 'manager', 'contributor', 'client_viewer') NOT NULL,
  CONSTRAINT fk_users_workspace
    FOREIGN KEY (workspace_id) REFERENCES agency_workspaces(id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS feedback_items (
  id VARCHAR(64) PRIMARY KEY,
  workspace_id VARCHAR(64) NOT NULL,
  project_id VARCHAR(64) NOT NULL,
  source ENUM('widget', 'admin', 'api') NOT NULL,
  status ENUM('new', 'triaged', 'in_progress', 'resolved', 'archived') NOT NULL,
  assigned_to VARCHAR(64) NULL,
  reporter_json JSON NOT NULL,
  content_json JSON NOT NULL,
  attachments_json JSON NOT NULL,
  environment_json JSON NOT NULL,
  labels_json JSON NOT NULL,
  priority_json JSON NOT NULL,
  voice_transcript_json JSON NULL,
  ai_analysis_json JSON NULL,
  comments_json JSON NOT NULL,
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  INDEX idx_feedback_workspace (workspace_id),
  INDEX idx_feedback_project (project_id),
  INDEX idx_feedback_status (status),
  CONSTRAINT fk_feedback_workspace
    FOREIGN KEY (workspace_id) REFERENCES agency_workspaces(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_feedback_project
    FOREIGN KEY (project_id) REFERENCES client_projects(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_feedback_assigned_user
    FOREIGN KEY (assigned_to) REFERENCES users(id)
    ON DELETE SET NULL
);
