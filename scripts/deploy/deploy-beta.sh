#!/usr/bin/env bash
# Deploys the develop branch on the beta server, following DEPLOYMENT.md
# ("Automatic beta deploys", §2 build and start, §3 migrations). Never resets or deletes data.
# Inputs (env): RUN_MIGRATIONS=true|false, EXPECTED_SHA=<commit the workflow built>
#
# The workflow pipes this file into `bash -s` over SSH. Everything runs inside main(),
# which bash only calls after reading the whole file, so no command can swallow the rest
# of the script from stdin. Commands that could read stdin also get </dev/null or -T.
set -euo pipefail

main() {

  APP_DIR=/opt/instructor/apps/tasktaker
  BRANCH=develop
  COMPOSE="docker compose --env-file .env.production -f docker-compose.prod.yml"

  cd "$APP_DIR"
  echo "==> $(date -u +%FT%TZ) deploying $BRANCH in $APP_DIR"

  # 1. Refuse to deploy over unexpected server-side edits.
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

  # 3. Validate compose configuration without printing or saving it (it contains secrets).
  $COMPOSE config --quiet

  # 4. Build application images only.
  $COMPOSE build backend frontend worker

  # 5. Optional migrations, always after a database backup (DEPLOYMENT.md §3).
  if [ "${RUN_MIGRATIONS:-false}" = "true" ]; then
    mkdir -p backups && chmod 700 backups
    BACKUP="backups/tasktaker_$(date +%Y%m%d_%H%M%S)_pre_${DEPLOYED_SHA:0:7}.dump"
    # Database user and name come from the postgres container's own environment.
    $COMPOSE exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$BACKUP"
    test -s "$BACKUP" || { echo "ERROR: backup is empty, stopping." >&2; exit 1; }
    echo "Backup: $BACKUP ($(du -h "$BACKUP" | cut -f1))"
    $COMPOSE run --rm -T backend npm run migration:show:prod < /dev/null
    $COMPOSE run --rm -T backend npm run migration:run:prod < /dev/null
  else
    echo "Migrations skipped (RUN_MIGRATIONS=false). Pending migrations:"
    $COMPOSE run --rm -T backend npm run migration:show:prod < /dev/null || true
  fi

  # 6. Recreate backend, worker and frontend only (databases and volumes untouched).
  $COMPOSE up -d backend frontend worker

  # 7. Health check: backend /api/health, frontend /, and the worker container's heartbeat check.
  for i in $(seq 1 30); do
    worker_health=$(docker inspect -f '{{.State.Health.Status}}' "$($COMPOSE ps -q worker)" 2>/dev/null || echo missing)
    if curl -fsS http://127.0.0.1:4000/api/health > /dev/null && curl -fsS -o /dev/null http://127.0.0.1:3000/ \
      && [ "$worker_health" = "healthy" ]; then
      echo "==> healthy. Deployed $DEPLOYED_SHA"
      echo "$(date -u +%FT%TZ) $DEPLOYED_SHA" >> deployments.log
      exit 0
    fi
    sleep 5
  done
  # The Actions log is public: show container states only, never application logs (they can hold user data).
  echo "ERROR: health check failed after deploy. Container states:" >&2
  $COMPOSE ps --format '{{.Service}}: {{.State}} {{.Health}}' >&2 || true
  echo "Read the logs on the server: docker compose --env-file .env.production -f docker-compose.prod.yml logs --tail=100 backend" >&2
  exit 1
}

main "$@"
exit $?
