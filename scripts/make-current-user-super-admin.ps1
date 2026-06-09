
# This script makes the current user a super admin
# It requires database connection parameters

# Database connection parameters (modify as needed)
$DB_HOST = "localhost"
$DB_USER = "your_username"
$DB_PASS = "your_password"
$DB_NAME = "your_database"

# Step 1: Find the SUPER_ADMIN role ID
Write-Host "Finding SUPER_ADMIN role ID..."
$SUPER_ADMIN_ROLE_ID = mysql -h"$DB_HOST" -u"$DB_USER" -p"$DB_PASS" "$DB_NAME" -e "SELECT id FROM enum_user_role WHERE role_code = 'SUPER_ADMIN' AND is_current = 1;" -s -N

if (-not $SUPER_ADMIN_ROLE_ID) {
    Write-Error "SUPER_ADMIN role not found"
    exit 1
}

Write-Host "Found SUPER_ADMIN role ID: $SUPER_ADMIN_ROLE_ID"

# Step 2: Find the current user ID
Write-Host "Finding current user ID..."
$CURRENT_USER_ID = mysql -h"$DB_HOST" -u"$DB_USER" -p"$DB_PASS" "$DB_NAME" -e "SELECT id FROM user WHERE is_active = 1 LIMIT 1;" -s -N

if (-not $CURRENT_USER_ID) {
    Write-Error "No active user found"
    exit 1
}

Write-Host "Found current user ID: $CURRENT_USER_ID"

# Step 3: Update the user role
Write-Host "Updating user role..."
mysql -h"$DB_HOST" -u"$DB_USER" -p"$DB_PASS" "$DB_NAME" -e "UPDATE user SET role_id = $SUPER_ADMIN_ROLE_ID, updated_at = NOW() WHERE id = $CURRENT_USER_ID;"

# Step 4: Verify the update
Write-Host "Verifying the update..."
mysql -h"$DB_HOST" -u"$DB_USER" -p"$DB_PASS" "$DB_NAME" -e "SELECT u.id, u.username, u.first_name, u.last_name, r.role_code, r.role_name FROM user u JOIN enum_user_role r ON u.role_id = r.id WHERE u.id = $CURRENT_USER_ID;"

Write-Host "Done! Current user has been made a SUPER_ADMIN."
