
# Make Current User Super Admin Scripts

These scripts will directly update the database to make the current user a super admin.

## Files

- `make-current-user-super-admin.js` - Node.js script to make the current user a super admin
- `make-current-user-super-admin.bat` - Windows batch script to run the Node.js script
- `make-current-user-super-admin.sh` - Linux/Mac shell script to run the Node.js script

## How to Use

### Windows Users

1. Run the batch script:
   ```
   make-current-user-super-admin.bat
   ```

### Linux/Mac Users

1. Make the shell script executable:
   ```
   chmod +x make-current-user-super-admin.sh
   ```
2. Run the script:
   ```
   ./make-current-user-super-admin.sh
   ```

### Direct Node.js Usage

1. Run the script directly with Node.js:
   ```
   node make-current-user-super-admin.js
   ```

## Notes

- You need Node.js installed to run these scripts
- The script will update the current user's role to SUPER_ADMIN in the database
- Make sure you have the correct permissions to modify the database
- Always test in a development environment first
