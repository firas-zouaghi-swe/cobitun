const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const argon2 = require('@node-rs/argon2');

function parseDotenv(filepath) {
  const content = fs.readFileSync(filepath, 'utf8');
  return Object.fromEntries(
    content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
      .map((line) => {
        const eq = line.indexOf('=');
        return [line.slice(0, eq).trim(), line.slice(eq + 1).trim()];
      })
  );
}

function splitPasswordHash(hashedPassword) {
  if (hashedPassword.startsWith('$argon2')) {
    return { passwordSalt: '', passwordHash: hashedPassword };
  }
  const [salt, derivedKey] = hashedPassword.split(':');
  return { passwordSalt: salt || '', passwordHash: derivedKey || hashedPassword };
}

async function hashPassword(password) {
  try {
    return await argon2.hash(password, { type: argon2.argon2id });
  } catch (error) {
    console.error('Argon2 hashing failed:', error);
    throw error;
  }
}

async function main() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) {
    throw new Error('.env file not found in project root');
  }

  const env = parseDotenv(envPath);
  const databaseUrl = env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL not found in .env');
  }

  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });

  const accounts = [
    {
      username: 'admin',
      password: 'admin@123456',
      email: 'zouaghi.firas.eng@gmail.com',
      roleCode: 'ADMIN',
      firstName: 'Firas',
      lastName: 'Zouaghi',
    },
    {
      username: 'superadmin',
      password: 'superadmin@123456',
      email: 'firas.zouaghi.ing@gmail.com',
      roleCode: 'SUPER_ADMIN',
      firstName: 'Firas',
      lastName: 'Zouaghi',
    },
  ];

  for (const account of accounts) {
    console.log(`Processing ${account.username}`);

    const role = await prisma.enumUserRole.findFirst({ where: { roleCode: account.roleCode } });
    if (!role) {
      throw new Error(`Role not found: ${account.roleCode}`);
    }

    const hashedPassword = await hashPassword(account.password);
    const { passwordSalt, passwordHash } = splitPasswordHash(hashedPassword);

    let user = await prisma.user.findUnique({ where: { username: account.username } });
    if (!user) {
      user = await prisma.user.findUnique({ where: { email: account.email } });
    }

    if (user) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          username: account.username,
          email: account.email,
          firstName: account.firstName,
          lastName: account.lastName,
          passwordHash,
          passwordSalt,
          roleId: role.id,
          isActive: 1,
          emailVerified: 1,
          passwordChangedAt: new Date(),
          updatedAt: new Date(),
          updatedBy: user.id,
        },
      });
      console.log(`Updated existing user ${account.username} (id=${user.id})`);
    } else {
      const newUser = await prisma.user.create({
        data: {
          username: account.username,
          email: account.email,
          firstName: account.firstName,
          lastName: account.lastName,
          passwordHash,
          passwordSalt,
          roleId: role.id,
          isActive: 1,
          emailVerified: 1,
          passwordChangedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
      console.log(`Created user ${account.username} (id=${newUser.id})`);
    }
  }

  await prisma.$disconnect();
  console.log('Admin account creation complete.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
