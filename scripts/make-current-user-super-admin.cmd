
@echo off
echo Making current user a SUPER_ADMIN...
echo.

REM Database connection parameters (modify as needed)
set DB_HOST=localhost
set DB_USER=your_username
set DB_PASS=your_password
set DB_NAME=your_database

REM Step 1: Find the SUPER_ADMIN role ID
echo Finding SUPER_ADMIN role ID...
mysql -h%DB_HOST% -u%DB_USER% -p%DB_PASS% %DB_NAME% -e "SELECT id FROM enum_user_role WHERE role_code = 'SUPER_ADMIN' AND is_current = 1;" > temp_role_id.txt
set /p SUPER_ADMIN_ROLE_ID=<temp_role_id.txt

if "%SUPER_ADMIN_ROLE_ID%"=="" (
    echo Error: SUPER_ADMIN role not found
    del temp_role_id.txt
    pause
    exit /b 1
)

echo Found SUPER_ADMIN role ID: %SUPER_ADMIN_ROLE_ID%

REM Step 2: Find the current user ID
echo Finding current user ID...
mysql -h%DB_HOST% -u%DB_USER% -p%DB_PASS% %DB_NAME% -e "SELECT id FROM user WHERE is_active = 1 LIMIT 1;" > temp_user_id.txt
set /p CURRENT_USER_ID=<temp_user_id.txt

if "%CURRENT_USER_ID%"=="" (
    echo Error: No active user found
    del temp_role_id.txt
    del temp_user_id.txt
    pause
    exit /b 1
)

echo Found current user ID: %CURRENT_USER_ID%

REM Step 3: Update the user role
echo Updating user role...
mysql -h%DB_HOST% -u%DB_USER% -p%DB_PASS% %DB_NAME% -e "UPDATE user SET role_id = %SUPER_ADMIN_ROLE_ID%, updated_at = NOW() WHERE id = %CURRENT_USER_ID%;"

REM Step 4: Verify the update
echo Verifying the update...
mysql -h%DB_HOST% -u%DB_USER% -p%DB_PASS% %DB_NAME% -e "SELECT u.id, u.username, u.first_name, u.last_name, r.role_code, r.role_name FROM user u JOIN enum_user_role r ON u.role_id = r.id WHERE u.id = %CURRENT_USER_ID%;"

REM Clean up temporary files
del temp_role_id.txt
del temp_user_id.txt

echo.
echo Done! Current user has been made a SUPER_ADMIN.
pause
