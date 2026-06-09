#!/bin/sh
set -e

# Ensure DB directory exists
mkdir -p /app/data

# If RUN_DB_SEED is enabled, run seeding in production
if [ "$RUN_DB_SEED" = "true" ] || [ "$SEED_ON_DEPLOY" = "true" ]; then
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
