
# Make Current User Super Admin Scripts

This directory contains multiple scripts to make the current user a super admin.

## Files

### Node.js Scripts
- `make-current-user-super-admin.js` - Node.js script to make the current user a super admin
- `make-current-user-super-admin.bat` - Windows batch script to run the Node.js script
- `make-current-user-super-admin.sh` - Linux/Mac shell script to run the Node.js script

### SQL Scripts
- `make-current-user-super-admin.sql` - SQL script to make the current user a super admin directly in the database

### Python Scripts
- `make-current-user-super-admin.py` - Python script to make the current user a super admin
- `requirements.txt` - Python dependencies

### Windows CMD Script
- `make-current-user-super-admin.cmd` - Windows command script to make the current user a super admin

## How to Use

### Node.js Scripts

#### Windows Users
1. Run the batch script:
   ```
   make-current-user-super-admin.bat
   ```

#### Linux/Mac Users
1. Make the shell script executable:
   ```
   chmod +x make-current-user-super-admin.sh
   ```
2. Run the script:
   ```
   ./make-current-user-super-admin.sh
   ```

#### Direct Node.js Usage
1. Run the script directly with Node.js:
   ```
   node make-current-user-super-admin.js
   ```

### SQL Scripts
1. Connect to your database using a SQL client
2. Run the SQL commands in `make-current-user-super-admin.sql`
3. Make sure to replace `[SUPER_ADMIN_ROLE_ID]` with the actual ID of the SUPER_ADMIN role

### Python Scripts
1. Install the required dependencies:
   ```
   pip install -r requirements.txt
   ```
2. Run the script:
   ```
   python make-current-user-super-admin.py
   ```

### Windows CMD Script
1. Run the command script:
   ```
   make-current-user-super-admin.cmd
   ```

## Notes

- All scripts will update the current user's role to SUPER_ADMIN in the database
- Make sure you have the correct permissions to modify the database
- Always test in a development environment first
- Modify the database connection parameters in each script as needed
