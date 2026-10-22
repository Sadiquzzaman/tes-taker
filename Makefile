# Developer commands for the Instructor (task-taker) repo.
# Run `make` or `make help` to list the targets.
#
# The targets call the scripts that already exist in backend/package.json and
# frontend/package.json; they add no new tools.

# Package managers. The frontend still uses npm (package-lock.json); when it
# moves to pnpm, change the two FRONTEND_* lines below.
BACKEND_PM       ?= pnpm
BACKEND_INSTALL  ?= $(BACKEND_PM) install --frozen-lockfile
FRONTEND_PM      ?= npm
FRONTEND_INSTALL ?= npm ci

BACKEND_DIR  ?= backend
FRONTEND_DIR ?= frontend

.DEFAULT_GOAL := help

.PHONY: help install lint typecheck test build check migrate migrate-show \
	backend-install backend-lint backend-typecheck backend-test backend-build \
	frontend-install frontend-lint frontend-typecheck frontend-test frontend-build

help: ## List the available targets
	@echo "Usage: make <target>"
	@echo ""
	@grep -hE '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  %-20s %s\n", $$1, $$2}'

## ---------------------------------------------------------------- all apps

install: backend-install frontend-install ## Install backend and frontend dependencies (lockfiles, no updates)

lint: backend-lint frontend-lint ## Lint backend and frontend

typecheck: backend-typecheck frontend-typecheck ## Type-check backend and frontend (tsc --noEmit)

test: backend-test frontend-test ## Run unit tests

build: backend-build frontend-build ## Production build of backend and frontend

check: lint typecheck test build ## lint + typecheck + test + build (run before opening a PR)

## ----------------------------------------------------------------- backend

backend-install: ## Backend: install dependencies
	cd $(BACKEND_DIR) && $(BACKEND_INSTALL)

backend-lint: ## Backend: lint (no lint script yet, see docs/TODO.md)
	@echo "backend: no lint script in backend/package.json yet; skipping (see docs/TODO.md)"

backend-typecheck: ## Backend: tsc --noEmit
	cd $(BACKEND_DIR) && $(BACKEND_PM) exec tsc --noEmit -p tsconfig.json

backend-test: ## Backend: jest
	cd $(BACKEND_DIR) && $(BACKEND_PM) test

backend-build: ## Backend: nest build
	cd $(BACKEND_DIR) && $(BACKEND_PM) run build

## ---------------------------------------------------------------- frontend

frontend-install: ## Frontend: install dependencies
	cd $(FRONTEND_DIR) && $(FRONTEND_INSTALL)

frontend-lint: ## Frontend: eslint
	cd $(FRONTEND_DIR) && $(FRONTEND_PM) run lint

# `next typegen` writes next-env.d.ts (gitignored; image and route types),
# which tsc needs on a fresh checkout before `next build` or `next dev` has run.
frontend-typecheck: ## Frontend: next typegen + tsc --noEmit
	cd $(FRONTEND_DIR) && $(FRONTEND_PM) exec -- next typegen && $(FRONTEND_PM) exec -- tsc --noEmit -p tsconfig.json

frontend-test: ## Frontend: tests (no test harness yet, see docs/TODO.md)
	@echo "frontend: no test script in frontend/package.json yet; skipping (see docs/TODO.md)"

frontend-build: ## Frontend: next build
	cd $(FRONTEND_DIR) && $(FRONTEND_PM) run build

## -------------------------------------------------------------- migrations
#
# LOCAL DATABASE ONLY.
# These targets run the TypeORM CLI from backend/, which reads the connection
# from backend/.env (the developer's own local database).
# Beta migrations run only through the "Deploy beta" workflow
# (.github/workflows/deploy-beta.yml). Never point these targets at the beta or
# production database, and never run production migrations by hand.

migrate: guard-not-production ## Run pending migrations on your LOCAL database (backend/.env)
	cd $(BACKEND_DIR) && $(BACKEND_PM) run migration:run

migrate-show: guard-not-production ## Show migration status of your LOCAL database (backend/.env)
	cd $(BACKEND_DIR) && $(BACKEND_PM) run migration:show

.PHONY: guard-not-production
guard-not-production:
	@if [ "$$NODE_ENV" = "production" ]; then \
		echo "Refusing to run: NODE_ENV=production. These targets are for your local database only;"; \
		echo "beta migrations run through the Deploy beta workflow."; \
		exit 1; \
	fi
