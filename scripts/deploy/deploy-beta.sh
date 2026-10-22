#!/usr/bin/env bash
# Deploys the develop branch on the beta server. Follows the routine in
# "TaskTaker Production Deployment Runbook" §4 and §15. Never resets or deletes data.
# Inputs (env): RUN_MIGRATIONS=true|false, EXPECTED_SHA=<commit the workflow built>
set -euo pipefail

APP_DIR=/opt/instructor/apps/tasktaker
BRANCH=develop
COMPOSE="docker compose --env-file .env.production -f docker-compose.prod.yml"

cd "$APP_DIR"
echo "==> $(date -u +%FT%TZ) deploying $BRANCH in $APP_DIR"

# 1. Refuse to deploy over unexpected server-side edits (runbook §3).
if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  echo "ERROR: tracked files changed on the server. Resolve by hand before deploying." >&2
  git status --short >&2
  exit 1
fi

# 2. Update code (fast-forward only) and confirm we deploy the commit CI tested.
git fetch origin "$BRANCH"
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"
DEPLOYED_SHA=$(git rev-parse HEAD)
if [ -n "${EXPECTED_SHA:-}" ] && [ "$DEPLOYED_SHA" != "$EXPECTED_SHA" ]; then
  echo "ERROR: server is at $DEPLOYED_SHA but CI tested $EXPECTED_SHA." >&2
  exit 1
fi

# 3. Validate compose configuration (output stays on the server, secrets are not printed).
$COMPOSE config > /tmp/tasktaker-compose-rendered.yml

# 4. Build application images only.
$COMPOSE build backend frontend

# 5. Optional migrations, always after a database backup (runbook §7, §8).
if [ "${RUN_MIGRATIONS:-false}" = "true" ]; then
  mkdir -p backups && chmod 700 backups
  BACKUP="backups/tasktaker_$(date +%Y%m%d_%H%M%S)_pre_${DEPLOYED_SHA:0:7}.dump"
  # Database user and name come from the postgres container's own environment.
  $COMPOSE exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$BACKUP"
  test -s "$BACKUP" || { echo "ERROR: backup is empty, stopping." >&2; exit 1; }
  echo "Backup: $BACKUP ($(du -h "$BACKUP" | cut -f1))"
  $COMPOSE run --rm backend npm run migration:show:prod
  $COMPOSE run --rm backend npm run migration:run:prod
else
  echo "Migrations skipped (RUN_MIGRATIONS=false). Pending migrations:"
  $COMPOSE run --rm backend npm run migration:show:prod || true
fi

# 6. Recreate backend and frontend only (databases and volumes untouched).
$COMPOSE up -d backend frontend

# 7. Health check: backend /api/health, frontend /.
for i in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:4000/api/health > /dev/null && curl -fsS -o /dev/null http://127.0.0.1:3000/; then
    echo "==> healthy. Deployed $DEPLOYED_SHA"
    echo "$(date -u +%FT%TZ) $DEPLOYED_SHA" >> deployments.log
    exit 0
  fi
  sleep 5
done
echo "ERROR: health check failed after deploy. Recent backend logs:" >&2
$COMPOSE logs --tail=100 backend >&2
exit 1
