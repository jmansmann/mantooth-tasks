# Mantooth Tasks Specification

## Objective

Mantooth Tasks is a compact, responsive daily planner for one local user. It
provides Inbox, Today, and Completed views; task capture, editing, Today
membership and ordering, completion/reopening, and confirmed deletion. Task
records live in SQLite and survive browser sessions, pod restarts, redeploys,
and k3d recreation through persistent storage.

## Architecture and API

- React + TypeScript frontend and Node.js + TypeScript backend ship in one
  container and use same-origin requests.
- SQLite stores stable opaque IDs, titles, view/status, Today ordering, and UTC
  creation/update/completion timestamps. Versioned migrations run before the
  server becomes ready. SQLite and HTTP details stay behind domain contracts.
- One Kubernetes replica avoids concurrent multi-writer SQLite access. The
  database lives under `/data`; API input is runtime-validated and errors use
  `{ "error": { "code": "...", "message": "..." } }`.
- `GET /api/tasks?view=inbox|today|completed`, `POST /api/tasks`,
  `PATCH /api/tasks/:id`, `PUT /api/tasks/today-order`,
  `POST /api/tasks/:id/today`, `DELETE /api/tasks/:id`, `GET /healthz`, and
  `GET /readyz` form the initial contract. Today reorder is transactional.
- Liveness reflects process health; readiness requires completed migrations and
  a usable database.

## Environments

- `dev`: imperative deployment in `mantooth-tasks-dev`; locally built/imported
  image and `/var/lib/mantooth-tasks/dev` host path.
- `k3d`: Argo CD-ready namespace `mantooth-tasks`; production-like host path
  `/var/lib/mantooth-tasks/prod`.
- `homelab`: Argo CD-ready namespace `mantooth-tasks`; one replica and a normal
  PVC using the cluster's StorageClass.

The image uses a multi-stage build, runs non-root, uses a read-only root
filesystem, drops capabilities, disallows privilege escalation, and writes
application data only to `/data` plus explicitly mounted temporary storage.
GitHub Actions runs `make verify` and publishes immutable multi-architecture
GHCR images for `linux/amd64` and `linux/arm64`.

## User experience

The interface supports quick-add with keyboard submission, keyboard-usable
actions, accessible reorder controls, predictable focus, confirmation before
deletion, and explicit loading, error/retry, and empty states. It adapts from
narrow mobile to desktop and respects reduced-motion preferences. It uses
semantic HTML, visible focus, and local-time presentation of UTC timestamps.

## Exclusions

No authentication, multiple users, collaboration, projects, tags, due dates,
recurrence, notifications, calendar, search, public exposure, analytics,
PostgreSQL implementation, or multi-replica deployment.

## Commands and verification

`make help`, `make install`, `make fmt`, `make fmt-check`, `make lint`,
`make typecheck`, `make test`, `make verify`, `make build`, `make image`,
`make load`, `make manifests ENV=dev|k3d|homelab`, `make dev`, `make undeploy`,
`make port-forward`, `make smoke`, and `make clean` are the supported interface.
The verification gate covers formatting, lint, type checking, tests, production
builds, and rendering of all deployment overlays. Integration and cluster
smoke tests prove API behavior and persistence across pod restart, namespace
recreation, and (when safely provisioned) k3d recreation.

## Boundaries

- **Always:** validate external input, use parameterized SQL, preserve task data
  outside ephemeral containers, test behavior, pin production image versions,
  and keep secrets and local database files out of Git.
- **Ask first:** authentication, user accounts, public exposure, multi-replica
  operation, or a change to the approved product scope.
- **Never:** store tasks in browser storage/JSON, expose internal errors, weaken
  tests or static checks, commit credentials, or run more than one app replica
  while using SQLite.

## Success criteria

The approved Definition of Done is tracked in `tasks/todo.md`; evidence and
runtime limitations are maintained in this repository's README.

## Decisions and deferred work

SQLite is selected for a single local user and single-writer deployment. A
future PostgreSQL/CloudNativePG and Longhorn migration remains a documented
future decision; no PostgreSQL abstraction or partial migration is included.
