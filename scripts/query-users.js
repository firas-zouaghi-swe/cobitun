const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('=== Querying Users ===\n');

  const users = await prisma.user.findMany({
    take: 15,
    select: {
      id: true,
      username: true,
      email: true,
      role: { select: { roleCode: true } },
      customer: { select: { id: true, companyName: true } },
    },
  });

  console.log('Users:');
  console.table(users);

  console.log('\n\n=== First Customer User ===');
  const firstCustomer = users.find(u => u.role.roleCode === 'CUSTOMER');
  if (firstCustomer) {
    console.log(`Username: ${firstCustomer.username}`);
    console.log(`User ID: ${firstCustomer.id}`);
    console.log(`Email: ${firstCustomer.email}`);
    console.log(`Customer ID: ${firstCustomer.customer?.id}`);
    console.log(`Company: ${firstCustomer.customer?.companyName}`);
  } else {
    console.log('No customer users found!');
  }

  console.log('\n\n=== Sessions ===');
  const sessions = await prisma.userSession.findMany({
    take: 5,
    select: {
      id: true,
      sessionId: true,
      userId: true,
      createdAt: true,
      expiresAt: true,
      revokedAt: true,
    },
  });
  console.log('Sessions:');
  console.table(sessions);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
