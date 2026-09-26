# Mantooth Tasks Implementation Plan

## Overview

Deliver the approved single-user task planner, its tests and production
container, three Kustomize environments, a repeatable local k3d loop, and
GitOps-ready CI. Provision host mounts in `mantooth-homelab` first so runtime
data survives cluster recreation.

## Architecture decisions

- One TypeScript workspace with a React/Vite frontend and Node HTTP server.
- SQLite with versioned SQL migrations and a domain interface; one app replica.
- The application serves the built frontend and API on one origin.
- Local dev and GitOps k3d use separate Mac-backed host directories; homelab
  uses PVC storage.
- Make is the user-facing command interface; Make and CI call shared package
  scripts for quality checks.

## Ordered tasks

1. **Provision persistent k3d mounts** — Update k3d config, safe recreation
   helper, Make target, and docs. Verify rendered homelab configs and guards;
   recreate only `dev` after confirming restoration is safe.
2. **Create project contract and tooling** — Approved spec, this plan, checklist,
   TypeScript workspace, lockfile, lint/format/type/test/build scripts. Verify
   clean install and empty baseline gate.
3. **Implement SQLite and task domain** — Versioned startup migrations, data
   model, input invariants, and temporary database tests.
4. **Implement API vertical slices** — Create/list, Today membership and
   transactional ordering, editing/completion/reopening/deletion, health and
   readiness; integration tests use disposable databases.
5. **Implement accessible planner UI** — Three views and all workflows,
   loading/error/empty states, keyboard focus and responsive/reduced-motion
   behavior. Verify component tests and browser-level workflow.
6. **Build and harden container** — Multi-stage pinned base, non-root runtime,
   read-only filesystem compatibility, graceful shutdown, local image build.
7. **Add deploy environments and developer loop** — Shared base plus dev, k3d,
   homelab overlays; probes, resources, SQLite persistence, Make commands.
   Render/validate all environments and exercise `make dev`.
8. **Add CI and GitOps delivery wiring** — `make verify` PR gate and pinned
   action versions, immutable SHA-tagged multi-arch GHCR image publication,
   README onboarding steps.
9. **Prove live persistence** — API smoke test through k3d, restart pod, undeploy
   and redeploy, and recreate `dev` when safe; confirm same task IDs survive.
10. **Finish docs and final review** — backup/reset/troubleshooting, security and
    storage decisions, quality review, both repositories' `make verify`, and
    update completion evidence.

## Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| k3d recreation drops cluster-local state | Argo/apps disappear | Inspect existing objects and remote accessibility; bootstrap via existing Make targets |
| SQLite database is lost if host mount is missing | User data loss | Restrict to one replica, mount `/data`, test real pod and cluster recreation |
| Native SQLite module architecture mismatch | Image fails on Mac or amd64 | Build in target-platform Docker stages; test local architecture and CI manifest |
| Async UI/API failures lose typed input | User work loss | Keep form input until server confirms success; add error/retry tests |
| Package audit finds reachable advisories | Supply-chain risk | Pin versions, review advisories by reachability, avoid forced bulk upgrades |

## PR sequencing

1. `mantooth-homelab` branch `feat/mantooth-tasks-storage-mounts` — merge first.
2. `mantooth-tasks` branch `feat/mantooth-tasks-app` — depends on the host mount
   contract from PR 1.
3. The `mantooth-tasks` publish workflow opens an image-tag PR after PR 2 is
   merged; merge it before onboarding so Argo CD references an available image.
4. `mantooth-homelab` branch `feat/onboard-mantooth-tasks` — based on PR 1 and
   merged after PR 3 so Argo CD does not look for an unavailable image.

Each branch contains small verified conventional commits; `main` stays
protected and is not modified directly.
