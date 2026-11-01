-- 015_add_agent_role.sql
-- Allow 'agent' role for field representatives and track creator/assigner

ALTER TABLE organization_memberships 
  DROP CONSTRAINT IF EXISTS organization_memberships_role_check;

ALTER TABLE organization_memberships 
  ADD CONSTRAINT organization_memberships_role_check 
  CHECK (role IN ('owner', 'admin', 'manager', 'viewer', 'agent'));

ALTER TABLE locations 
  ADD COLUMN IF NOT EXISTS created_by_user_id UUID REFERENCES merchant_users(id) ON DELETE SET NULL;

ALTER TABLE standee_inventory 
  ADD COLUMN IF NOT EXISTS assigned_by_user_id UUID REFERENCES merchant_users(id) ON DELETE SET NULL;
