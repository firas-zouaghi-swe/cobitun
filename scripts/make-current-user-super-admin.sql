
-- This script will make the current user a super admin directly in the database
-- First, find the SUPER_ADMIN role ID
SELECT id, role_code, role_name 
FROM enum_user_role 
WHERE role_code = 'SUPER_ADMIN' AND is_current = 1;

-- Then update the current user's role (replace [SUPER_ADMIN_ROLE_ID] with the actual ID from the query above)
UPDATE user 
SET role_id = [SUPER_ADMIN_ROLE_ID], 
    updated_at = NOW()
WHERE id = (SELECT id FROM user WHERE is_active = 1 LIMIT 1);

-- Verify the update
SELECT u.id, u.username, u.first_name, u.last_name, r.role_code, r.role_name
FROM user u
JOIN enum_user_role r ON u.role_id = r.id
WHERE u.id = (SELECT id FROM user WHERE is_active = 1 LIMIT 1);
