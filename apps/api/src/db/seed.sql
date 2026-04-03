INSERT INTO agency_workspaces (id, name, slug, created_at)
VALUES ('ws_studio', 'Northstar Studio', 'northstar-studio', '2026-04-03 10:00:00.000')
ON DUPLICATE KEY UPDATE name = VALUES(name), slug = VALUES(slug);

INSERT INTO client_projects (id, workspace_id, name, `key`, client_name, description, widget_token)
VALUES
  ('proj_meteor', 'ws_studio', 'Meteor Console', 'meteor-console', 'Meteor Health', 'Operations portal for staff, patients, and admin teams.', 'widget_live_meteor'),
  ('proj_orbit', 'ws_studio', 'Orbit Workspace', 'orbit-workspace', 'Orbit Commerce', 'Commerce backoffice used by regional retail teams.', 'widget_live_orbit')
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  client_name = VALUES(client_name),
  description = VALUES(description),
  widget_token = VALUES(widget_token);

INSERT INTO users (id, workspace_id, email, name, role)
VALUES
  ('usr_ana', 'ws_studio', 'ana@northstar.test', 'Ana Shah', 'owner'),
  ('usr_lee', 'ws_studio', 'lee@northstar.test', 'Lee Wong', 'manager'),
  ('usr_maya', 'ws_studio', 'maya@meteor.test', 'Maya Clarke', 'client_viewer')
ON DUPLICATE KEY UPDATE
  email = VALUES(email),
  name = VALUES(name),
  role = VALUES(role);
