# Mantooth Tasks Checklist

## Provisioning and contract

- [x] Add safe persistent host mounts and explicit `dev` cluster recreation to `mantooth-homelab`.
- [x] Record project spec, implementation plan, and tracked acceptance checklist.
- [x] Establish pinned dependencies and format/lint/type/test/build commands.

## Application

- [x] Add versioned SQLite startup migration and tested task domain invariants.
- [x] Implement validated API, consistent errors, readiness, and graceful shutdown.
- [x] Cover create/list, Today move/reorder, edit, complete/reopen, delete, malformed and not-found behavior.
- [x] Build responsive Inbox/Today/Completed interface and test critical keyboard/accessibility workflows.

## Delivery

- [x] Build non-root multi-stage runtime image with writable persistent `/data` only.
- [x] Render dev/k3d/homelab Kustomize overlays with exactly one storage backend each.
- [x] Add all documented Make targets and exercise local `make dev`.
- [x] Add PR verification and multi-architecture immutable SHA-tagged GHCR workflow.
- [x] Document GitOps onboarding, backup/restore, reset, troubleshooting, and future database migration.

## Runtime proof and final review

- [x] Verify health/readiness and create/retrieve a unique task through k3d.
- [x] Prove same task ID survives pod restart and `make undeploy` + `make dev`.
- [x] Prove same task ID survives `dev` cluster recreation when safe.
- [x] Run final `make verify` in both repositories and complete the quality review.
- [ ] Report evidence, PR order, deferred work, and genuine blockers.
