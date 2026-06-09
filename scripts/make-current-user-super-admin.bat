
@echo off
echo Making current user a SUPER_ADMIN...
echo.

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Node.js is not installed. Please install Node.js first.
    exit /b 1
)

REM Run the script
echo Making current user a SUPER_ADMIN...
node make-current-user-super-admin.js

echo.
echo Script completed.
pause
