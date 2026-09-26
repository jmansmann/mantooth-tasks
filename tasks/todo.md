# Mantooth Tasks Checklist

## Provisioning and contract

- [ ] Add safe persistent host mounts and explicit `dev` cluster recreation to `mantooth-homelab`.
- [ ] Record project spec, implementation plan, and tracked acceptance checklist.
- [ ] Establish pinned dependencies and format/lint/type/test/build commands.

## Application

- [ ] Add versioned SQLite startup migration and tested task domain invariants.
- [ ] Implement validated API, consistent errors, readiness, and graceful shutdown.
- [ ] Cover create/list, Today move/reorder, edit, complete/reopen, delete, malformed and not-found behavior.
- [ ] Build responsive Inbox/Today/Completed interface and test critical keyboard/accessibility workflows.

## Delivery

- [ ] Build non-root multi-stage runtime image with writable persistent `/data` only.
- [ ] Render dev/k3d/homelab Kustomize overlays with exactly one storage backend each.
- [ ] Add all documented Make targets and exercise local `make dev`.
- [ ] Add PR verification and multi-architecture immutable SHA-tagged GHCR workflow.
- [ ] Document GitOps onboarding, backup/restore, reset, troubleshooting, and future database migration.

## Runtime proof and final review

- [ ] Verify health/readiness and create/retrieve a unique task through k3d.
- [ ] Prove same task ID survives pod restart and `make undeploy` + `make dev`.
- [ ] Prove same task ID survives `dev` cluster recreation when safe.
- [ ] Run `make verify` in both repositories and review security/accessibility/docs.
- [ ] Report evidence, PR order, deferred work, and genuine blockers.
