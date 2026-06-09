
#!/usr/bin/env python3
# This script makes the current user a super admin
# Requires Python and the mysql-connector-python package

import mysql.connector
from mysql.connector import Error

def make_current_user_super_admin():
    # Database connection parameters (modify as needed)
    db_config = {
        'host': 'localhost',
        'user': 'your_username',
        'password': 'your_password',
        'database': 'your_database'
    }

    connection = None
    try:
        # Connect to the database
        connection = mysql.connector.connect(**db_config)
        cursor = connection.cursor()

        # Step 1: Find the SUPER_ADMIN role ID
        cursor.execute("SELECT id FROM enum_user_role WHERE role_code = 'SUPER_ADMIN' AND is_current = 1")
        result = cursor.fetchone()

        if not result:
            print("Error: SUPER_ADMIN role not found")
            return

        super_admin_role_id = result[0]
        print(f"Found SUPER_ADMIN role ID: {super_admin_role_id}")

        # Step 2: Find the current user ID
        cursor.execute("SELECT id FROM user WHERE is_active = 1 LIMIT 1")
        result = cursor.fetchone()

        if not result:
            print("Error: No active user found")
            return

        current_user_id = result[0]
        print(f"Found current user ID: {current_user_id}")

        # Step 3: Update the user role
        update_query = "UPDATE user SET role_id = %s, updated_at = NOW() WHERE id = %s"
        cursor.execute(update_query, (super_admin_role_id, current_user_id))
        connection.commit()

        print(f"Updated user ID {current_user_id} to SUPER_ADMIN role")

        # Step 4: Verify the update
        verify_query = "SELECT u.id, u.username, u.first_name, u.last_name, r.role_code, r.role_name FROM user u JOIN enum_user_role r ON u.role_id = r.id WHERE u.id = %s"
        cursor.execute(verify_query, (current_user_id,))
        result = cursor.fetchone()

        if result:
            print("
Verification:")
            print(f"User ID: {result[0]}")
            print(f"Username: {result[1]}")
            print(f"First Name: {result[2]}")
            print(f"Last Name: {result[3]}")
            print(f"Role Code: {result[4]}")
            print(f"Role Name: {result[5]}")

        print("
Done! Current user has been made a SUPER_ADMIN.")

    except Error as e:
        print(f"Error: {e}")
    finally:
        if connection and connection.is_connected():
            cursor.close()
            connection.close()

if __name__ == "__main__":
    make_current_user_super_admin()
