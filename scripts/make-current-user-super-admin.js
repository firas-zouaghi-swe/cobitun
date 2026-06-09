
// This script directly updates the database to make the current user a super admin
// Run this script with Node.js

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function makeCurrentUserSuperAdmin() {
  try {
    // Find the SUPER_ADMIN role
    const superAdminRole = await prisma.enumUserRole.findFirst({
      where: { roleCode: 'SUPER_ADMIN', isCurrent: 1 }
    });

    if (!superAdminRole) {
      console.error('SUPER_ADMIN role not found');
      return;
    }

    // Find the current user (you can modify this condition if needed)
    const currentUser = await prisma.user.findFirst({
      where: { 
        // This condition finds the first active user, modify as needed
        isActive: 1,
        // You can add more conditions to identify the correct user
        // For example: username: 'current-username'
      }
    });

    if (!currentUser) {
      console.error('No active user found');
      return;
    }

    // Update user role
    const updatedUser = await prisma.user.update({
      where: { id: currentUser.id },
      data: { 
        roleId: superAdminRole.id,
        updatedAt: new Date()
      }
    });

    console.log(`✅ User ${updatedUser.username} (ID: ${updatedUser.id}) has been made a SUPER_ADMIN`);
  } catch (error) {
    console.error(`❌ Error updating user role: ${error.message}`);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the function
makeCurrentUserSuperAdmin();
