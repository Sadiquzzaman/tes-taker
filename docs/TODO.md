# TODO

Out-of-scope items noted during other tasks. One line each, with the reason.

- Add a type-check step to CI (`tsc --noEmit` for backend and frontend) — Development Plan P0-02 asks for it; `ci.yml` does not run it yet.
- Add a CI job that runs migrations on an empty PostgreSQL database — Development Plan P0-02 and §5; schema changes are not checked before deploy yet.
- Add a root `Makefile` (`make test`, `make lint`, `make build`, `make migrate`) — Development Plan §2.1 step 3.
- Move the frontend to pnpm — Development Plan §2.1 step 3 ("one package manager"); the frontend still uses npm and `package-lock.json`.
- Add the "TaskTaker Production Deployment Runbook" to the repo or fix the reference — `scripts/deploy/deploy-beta.sh` cites its §4 and §15, but it is not in the repo and `DEPLOYMENT.md` §4 covers pgAdmin.
- Confirm the beta server can `git pull` from GitHub (deploy key) — `deploy-beta.sh` fetches `develop` on the server.
- Add a frontend test harness and tests for `ExamCountdown`, the join pages and the fetch hooks — the lint-fix PR (#69) changed them with only manual browser checks.
