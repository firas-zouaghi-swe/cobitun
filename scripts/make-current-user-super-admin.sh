
#!/bin/bash

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Run the script
echo "Making current user a SUPER_ADMIN..."
node make-current-user-super-admin.js

echo ""
echo "Script completed."
