const { spawn, spawnSync } = require('child_process');

const port = process.env.PORT || '3000';
const databaseUrl = process.env.DATABASE_URL || 'file:/app/data/db.sqlite';
process.env.DATABASE_URL = databaseUrl;

console.log(`[start] Using DATABASE_URL=${databaseUrl}`);
console.log('[start] Applying Prisma migrations before Next.js startup...');
const migrateResult = spawnSync('npx', ['prisma', 'migrate', 'deploy'], {
  stdio: 'inherit',
});

if (migrateResult.status !== 0) {
  console.error('[start] Prisma migrate deploy failed');
  process.exit(migrateResult.status || 1);
}

const child = spawn('npx', ['next', 'start', '-p', port], {
  stdio: 'inherit',
});

child.on('exit', (code) => process.exit(code));
child.on('error', (error) => {
  console.error(error);
  process.exit(1);
});
