#!/bin/sh
set -e

# Ensure DB directory exists
mkdir -p /app/data

# Default DATABASE_URL for SQLite if none is provided at runtime
if [ -z "$DATABASE_URL" ]; then
  export DATABASE_URL="file:/app/data/db.sqlite"
fi

# Detect a missing SQLite database file before migrations
db_missing=false
if echo "$DATABASE_URL" | grep -q '^file:'; then
  db_path="${DATABASE_URL#file:}"
  if [ ! -f "$db_path" ]; then
    db_missing=true
  fi
fi

# Apply migrations first so runtime DB has required tables
if [ "$RUN_DB_MIGRATE" != "false" ]; then
  echo "[entrypoint] Applying Prisma migrations (NODE_ENV=$NODE_ENV)..."
  npx prisma migrate deploy
fi

# Run seed on first database creation or when explicitly enabled
if [ "$RUN_DB_SEED" = "true" ] || [ "$SEED_ON_DEPLOY" = "true" ] || [ "$db_missing" = "true" ]; then
  echo "[entrypoint] Running database seed (NODE_ENV=$NODE_ENV)..."
  # Ensure prisma client is generated
  npm run prisma:generate || npx prisma generate || true

  # Run seed with npm script; fall back to npx tsx
  if npm run db:seed --if-present; then
    echo "[entrypoint] db:seed completed via npm script"
  else
    npx tsx prisma/seed.ts || node prisma/seed.js || echo "[entrypoint] seed failed (continuing)"
  fi
fi

# Exec the main process (npm start)
exec npm start
