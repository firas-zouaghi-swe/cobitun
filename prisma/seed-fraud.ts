import { PrismaClient } from '@prisma/client';
import { FraudDetector } from '../src/lib/fraud-detector';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Seeding fraud detection test data...');

  // Create test users with different risk profiles
  const legitimateUsers = await Promise.all(
    Array.from({ length: 8 }, async (_, i) => {
      const firstName = `Legitimate${i + 1}`;
      const lastName = `User${i + 1}`;
      const email = `legitimate${i + 1}@example.com`;
      const username = `legitimate${i + 1}`;

      const u = await prisma.user.create({
        data: {
          username,
          passwordHash: '$2b$10$dummyhash', // dummy hash
          passwordSalt: 'dummysalt',
          firstName,
          lastName,
          email,
          roleId: 2, // Customer role
          isActive: 1,
          emailVerified: 1,
          emailVerifiedAt: new Date(),
          lastLoginAt: new Date(Date.now() - Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000),
          lastLoginIp: `192.168.1.${Math.floor(Math.random() * 255)}`,
          createdAt: new Date(Date.now() - Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000),
        },
      });

      const customer = await prisma.customer.create({
        data: {
          userId: u.id,
          companyName: `Legitimate Business ${i + 1}`,
          address: '',
          mobile: `+216 50 123 456${i + 1}`,
          website: `https://legitimatebusiness${i + 1}.com`,
          createdBy: 1,
        },
      });

      return { ...u, customer };
    })
  );

  const fakeUsers = await Promise.all(
    Array.from({ length: 5 }, async (_, i) => {
      const firstName = `Fake${i + 1}`;
      const lastName = `User${i + 1}`;
      const email = `fake${i + 1}@${['tempmail.com', '10minutemail.com', 'guerrillamail.com'][Math.floor(Math.random() * 3)]}`;
      const username = `fakeuser${i + 1}${Math.floor(Math.random() * 1000)}`;

      const u = await prisma.user.create({
        data: {
          username,
          passwordHash: '$2b$10$dummyhash',
          passwordSalt: 'dummysalt',
          firstName,
          lastName,
          email,
          roleId: 2,
          isActive: 1,
          emailVerified: 0,
          createdAt: new Date(Date.now() - Math.floor(Math.random() * 5) * 24 * 60 * 60 * 1000),
          lastLoginIp: `10.0.0.${Math.floor(Math.random() * 255)}`,
        },
      });

      const customer = await prisma.customer.create({
        data: {
          userId: u.id,
          companyName: '',
          address: '',
          mobile: null,
          website: null,
          createdBy: 1,
        },
      });

      return { ...u, customer };
    })
  );

  const reviewUsers = await Promise.all(
    Array.from({ length: 3 }, async (_, i) => {
      const firstName = `Review${i + 1}`;
      const lastName = `User${i + 1}`;
      const email = `review${i + 1}@example.com`;
      const username = `review${i + 1}`;

      const u = await prisma.user.create({
        data: {
          username,
          passwordHash: '$2b$10$dummyhash',
          passwordSalt: 'dummysalt',
          firstName,
          lastName,
          email,
          roleId: 2,
          isActive: 1,
          emailVerified: 1,
          createdAt: new Date(Date.now() - Math.floor(Math.random() * 15) * 24 * 60 * 60 * 1000),
          lastLoginIp: `172.16.0.${Math.floor(Math.random() * 255)}`,
          failedLoginCount: Math.floor(Math.random() * 3),
        },
      });

      const customer = await prisma.customer.create({
        data: {
          userId: u.id,
          companyName: `Review Business ${i + 1}`,
          address: '',
          mobile: `+216 50 123 456${i + 1}`,
          website: null,
          createdBy: 1,
        },
      });

      return { ...u, customer };
    })
  );

  // Create IP reputation data
  const ipReputations = await Promise.all([
    // 3 blocked malicious IPs
    ...Array.from({ length: 3 }, (_, i) => 
      prisma.ipReputation.create({
        data: {
          ip: `10.0.0.${i}`,
          riskScore: 85,
          blocked: 1,
          fakeCount: 5,
          accountCount: 10,
          notes: 'Known malicious IP - associated with bot activity',
        },
      })
    ),
    // 2 suspicious IPs
    ...Array.from({ length: 2 }, (_, i) => 
      prisma.ipReputation.create({
        data: {
          ip: `172.16.0.${i}`,
          riskScore: 45,
          blocked: 0,
          fakeCount: 2,
          accountCount: 5,
          notes: 'Associated with multiple accounts',
        },
      })
    ),
    // 3 clean/Tunisian ISP IPs
    ...Array.from({ length: 3 }, (_, i) => 
      prisma.ipReputation.create({
        data: {
          ip: `41.225.${i}.1`,
          riskScore: 5,
          blocked: 0,
          fakeCount: 0,
          accountCount: 1,
          notes: 'Tunisian ISP IP',
        },
      })
    ),
  ]);

  // Create device fingerprints
  const deviceFingerprints = await Promise.all([
    // 3 shared devices
    ...Array.from({ length: 3 }, (_, i) => 
      prisma.deviceFingerprint.create({
        data: {
          fingerprint: `shared-device-${i}`,
          userCount: Math.floor(Math.random() * 10) + 5,
          riskScore: Math.floor(Math.random() * 30) + 40,
          blocked: 0,
        },
      })
    ),
    // 2 unique devices
    ...Array.from({ length: 2 }, (_, i) => 
      prisma.deviceFingerprint.create({
        data: {
          fingerprint: `unique-device-${i}`,
          userCount: 1,
          riskScore: 5,
          blocked: 0,
        },
      })
    ),
  ]);

  // Create fraud detection results for test users
  const detector = new FraudDetector(prisma);

  // Run fraud detection on all test users
  const allUsers = [...legitimateUsers, ...fakeUsers, ...reviewUsers];

  for (const user of allUsers) {
    console.log(`Running fraud detection for user: ${user.username}`);
    try {
      await detector.detect({
        user,
        customer: user.customer,
        ip: user.lastLoginIp || '0.0.0.0',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        deviceFingerprint: `device-${user.id}`,
      });
    } catch (error) {
      console.error(`Error scanning user ${user.username}:`, error);
    }
  }

  console.log('✅ Fraud detection test data seeded successfully!');
  console.log(`Created ${legitimateUsers.length} legitimate users, ${fakeUsers.length} fake users, and ${reviewUsers.length} review users.`);
  console.log(`Created ${ipReputations.length} IP reputation entries and ${deviceFingerprints.length} device fingerprints.`);
}

main()
  .catch((e) => {
    console.error('Error seeding fraud detection data:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
