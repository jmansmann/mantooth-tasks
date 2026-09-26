# Architecture Decisions

## ADR-001: Use SQLite for a single local user

**Status:** Accepted

**Context:** Mantooth Tasks is a personal planner with no authentication,
collaboration, or public endpoint. It needs transactional Today ordering and
durability without running a separate database service.

**Decision:** Store task records in a versioned SQLite database at
`/data/tasks.sqlite3`. Apply migrations during startup and use a single app
replica with a `Recreate` deployment strategy.

**Consequences:** The app has no database service to provision and transactions
are local. SQLite's single-writer constraint prevents multi-replica scaling.
Persistent storage and consistent backups are operational requirements. A
future PostgreSQL/CloudNativePG migration must be separately designed and
verified; this decision does not introduce a generic storage framework.

## ADR-002: Serve the React UI and API from one Node.js container

**Status:** Accepted

**Context:** The app has one browser client and is accessed locally. A separate
frontend origin would add deployment and CORS configuration without providing
a current benefit.

**Decision:** Build a React/TypeScript frontend and TypeScript/Node backend into
one deployable image. Express serves both `/api` and the production Vite assets
on the same origin.

**Consequences:** There is one image and one deployment to operate. API and UI
are released together and can use shared TypeScript task contracts. The
application boundary remains small; no microservice or plugin layer is added.

## ADR-003: Separate development, k3d GitOps, and homelab persistence

**Status:** Accepted

**Context:** Local development, production-like GitOps on the Mac, and the
future physical cluster need different data lifetimes and storage providers.

**Decision:** The local `dev` overlay mounts
`/var/lib/mantooth-tasks/dev`; the GitOps `k3d` overlay mounts
`/var/lib/mantooth-tasks/prod`; the homelab overlay claims a regular PVC.

**Consequences:** Dev redeploys, namespace deletion, and cluster recreation do
not remove their host data. GitOps and imperative development use different
namespaces and databases. Homelab storage can use the default StorageClass,
eventually Longhorn. Backups remain a separately documented operational task.
