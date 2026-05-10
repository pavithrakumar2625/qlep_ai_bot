CREATE TYPE "public"."attachment_type" AS ENUM('image', 'audio', 'video', 'file');--> statement-breakpoint
CREATE TYPE "public"."feedback_source" AS ENUM('widget', 'admin', 'api');--> statement-breakpoint
CREATE TYPE "public"."feedback_status" AS ENUM('new', 'triaged', 'in_progress', 'resolved', 'archived');--> statement-breakpoint
CREATE TYPE "public"."triage_status" AS ENUM('pending', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."workspace_role" AS ENUM('owner', 'manager', 'contributor', 'client_viewer');--> statement-breakpoint
CREATE TABLE "agency_workspaces" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agency_workspaces_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "attachments" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"workspace_id" varchar(64) NOT NULL,
	"project_id" varchar(64) NOT NULL,
	"feedback_id" varchar(64),
	"storage_key" varchar(512) NOT NULL,
	"type" "attachment_type" NOT NULL,
	"mime_type" varchar(128) NOT NULL,
	"size_bytes" integer NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "client_projects" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"workspace_id" varchar(64) NOT NULL,
	"name" varchar(255) NOT NULL,
	"key" varchar(255) NOT NULL,
	"client_name" varchar(255) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"widget_token" varchar(255) NOT NULL,
	CONSTRAINT "client_projects_key_unique" UNIQUE("key"),
	CONSTRAINT "client_projects_widget_token_unique" UNIQUE("widget_token")
);
--> statement-breakpoint
CREATE TABLE "comments" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"feedback_id" varchar(64) NOT NULL,
	"author_id" varchar(64) NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feedback_items" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"workspace_id" varchar(64) NOT NULL,
	"project_id" varchar(64) NOT NULL,
	"source" "feedback_source" NOT NULL,
	"status" "feedback_status" NOT NULL,
	"triage_status" "triage_status" DEFAULT 'pending' NOT NULL,
	"assigned_to" varchar(64),
	"reporter" jsonb NOT NULL,
	"content" jsonb NOT NULL,
	"environment" jsonb NOT NULL,
	"labels" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"priority" jsonb NOT NULL,
	"voice_transcript" jsonb,
	"ai_analysis" jsonb,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"workspace_id" varchar(64) NOT NULL,
	"email" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"role" "workspace_role" NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_workspace_id_agency_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."agency_workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_project_id_client_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."client_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_feedback_id_feedback_items_id_fk" FOREIGN KEY ("feedback_id") REFERENCES "public"."feedback_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_projects" ADD CONSTRAINT "client_projects_workspace_id_agency_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."agency_workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_feedback_id_feedback_items_id_fk" FOREIGN KEY ("feedback_id") REFERENCES "public"."feedback_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_items" ADD CONSTRAINT "feedback_items_workspace_id_agency_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."agency_workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_items" ADD CONSTRAINT "feedback_items_project_id_client_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."client_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_items" ADD CONSTRAINT "feedback_items_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_workspace_id_agency_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."agency_workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "attachments_feedback_idx" ON "attachments" USING btree ("feedback_id");--> statement-breakpoint
CREATE INDEX "comments_feedback_idx" ON "comments" USING btree ("feedback_id");--> statement-breakpoint
CREATE INDEX "feedback_workspace_idx" ON "feedback_items" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "feedback_project_idx" ON "feedback_items" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "feedback_status_idx" ON "feedback_items" USING btree ("status");--> statement-breakpoint
CREATE INDEX "feedback_created_at_idx" ON "feedback_items" USING btree ("created_at");