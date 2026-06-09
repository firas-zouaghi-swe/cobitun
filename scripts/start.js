const { spawn, spawnSync } = require('child_process');
const fs = require('fs');

const port = process.env.PORT || '3000';
const databaseUrl = process.env.DATABASE_URL || 'file:/app/data/db.sqlite';
process.env.DATABASE_URL = databaseUrl;

const shouldSeedEmptyDatabase = (() => {
  if (!databaseUrl.startsWith('file:')) return false;
  const dbPath = databaseUrl.slice('file:'.length);
  return !fs.existsSync(dbPath);
})();

console.log(`[start] Using DATABASE_URL=${databaseUrl}`);
console.log('[start] Applying Prisma migrations before Next.js startup...');
const migrateResult = spawnSync('npx', ['prisma', 'migrate', 'deploy'], {
  stdio: 'inherit',
});

if (migrateResult.status !== 0) {
  console.error('[start] Prisma migrate deploy failed');
  process.exit(migrateResult.status || 1);
}

if (shouldSeedEmptyDatabase && process.env.RUN_DB_SEED !== 'false') {
  console.log('[start] Database file missing; running db:seed...');
  const seedResult = spawnSync('npm', ['run', 'db:seed', '--if-present'], {
    stdio: 'inherit',
  });

  if (seedResult.status !== 0) {
    console.error('[start] Database seed failed');
    process.exit(seedResult.status || 1);
  }
}

const child = spawn('npx', ['next', 'start', '-p', port], {
  stdio: 'inherit',
});

child.on('exit', (code) => process.exit(code));
child.on('error', (error) => {
  console.error(error);
  process.exit(1);
});
