# Mantooth Tasks repository guide

- Keep application source, tests, Dockerfile, CI, and Kustomize overlays here.
- Keep cluster creation, host mounts, and lifecycle safety in `mantooth-homelab`.
- Follow `docs/spec.md`; track delivery work in `tasks/todo.md`.
- Run `make verify` before publishing changes. It is the CI quality gate.
- Keep dependency versions exact and commit `package-lock.json`; `.npmrc`
  disables dependency lifecycle scripts during install.
- Keep Kubernetes image tags immutable outside the local `dev` overlay.
- Preserve one replica and `Recreate` rollout while using SQLite.
- Keep secrets, local databases, kubeconfigs, generated output, and machine-
  specific paths out of version control.
