# Mantooth Tasks

A quiet, compact daily planner for one local user. Capture tasks in Inbox, pick
what belongs in Today, order the day, and review completed work. The React UI,
TypeScript API, and SQLite database ship as one container; task data is stored
outside the container so redeploys do not reset it.

## Requirements

- Node.js **24.13.0** and npm **11.6.2** for the local test/build toolchain.
- Docker Desktop or another working Docker daemon.
- `k3d`, `kubectl`, and `kustomize` for the local Kubernetes loop.
- GNU Make and Chromium (installed by `make install` for browser tests).

## Quick start

Install the locked dependencies and test browser, then run the complete quality
gate:

```bash
make install
make verify
```

The local k3d cluster must first have the two Mantooth Tasks host mounts. The
one-time, destructive recreation is explicit and restores the existing Argo CD
root application:

```bash
cd ../mantooth-homelab
make cluster-recreate # review the warning, then type dev
cd ../mantooth-tasks
make dev
make port-forward
```

Open <http://localhost:8090>. The local development copy is isolated in
namespace `mantooth-tasks-dev`; it can run alongside Argo CD-managed apps.

```bash
make smoke       # create, retrieve, and clean up a task through the live API
make undeploy    # remove only mantooth-tasks-dev; keeps the Mac data directory
make dev         # rebuild, import, and redeploy using that same data directory
```

## Daily commands

| Command | Purpose |
|---|---|
| `make help` | List supported targets |
| `make install` | Install the lockfile and Playwright Chromium |
| `make fmt` / `make fmt-check` | Format / verify source formatting |
| `make lint` | Run TypeScript and JSX accessibility lint rules |
| `make typecheck` | Type-check frontend, API, tests, and emitted server build |
| `make test` | Run unit, API integration, Chromium workflow, keyboard, and axe tests |
| `make verify` | Full local/CI quality gate, including all overlay renders |
| `make build` | Build the production web bundle and server |
| `make image` | Build a local image for the host architecture |
| `make load` | Build and import the image into k3d cluster `dev` |
| `make dev` | Deploy to `mantooth-tasks-dev` and wait for rollout |
| `make port-forward` | Forward the development Service to port 8090 |
| `make smoke` | Exercise health, create/list, and cleanup against the running pod |
| `make undeploy` | Delete only the development namespace, not its data |
| `make manifests ENV=dev\|k3d\|homelab` | Render an environment's manifests |
| `make clean` | Remove generated build and browser-test output |

`make verify` checks formatting, lint, TypeScript, SQLite/API tests, real-browser
workflows and accessibility, production builds, and rendering of all three
Kustomize overlays. Browser tests use a fresh disposable SQLite file and clean
their test tasks; they never use the real host data directories.

## Architecture

```text
apps/server/        Express API, task domain, SQLite adapter, migrations
apps/web/           React planner and responsive styling
src/shared/         Task and view contracts shared by server and browser
deploy/base/        Single-replica Deployment and ClusterIP Service
deploy/overlays/    dev, k3d, and homelab storage/environment choices
docs/               Approved specification and architecture decisions
tasks/              Implementation plan and completion checklist
```

The server validates request bodies and UUIDs, uses parameterized SQLite
queries, and returns `{ "error": { "code", "message" } }` for API errors.
Startup applies numbered schema migrations before readiness succeeds. Stored
timestamps are UTC ISO-8601 strings; completed dates are presented in the
browser's local timezone. SQLite is a single-writer database, so each
Deployment uses one replica and `Recreate` rollout strategy.

The container serves the built UI and REST API from the same origin. It runs as
UID/GID 10001, with a read-only root filesystem, no Linux capabilities,
privilege escalation disabled, no mounted Kubernetes API token, and explicit
writable `/data` and `/tmp` mounts.
Liveness checks process health; readiness checks database/migration usability.
The app is a private `ClusterIP` service with no Ingress or public exposure.

## Data persistence and recovery

| Overlay | Data mount | Lifetime |
|---|---|---|
| `dev` | `${HOME}/.local/share/mantooth-tasks/dev` → `/var/lib/mantooth-tasks/dev` | Survives pod/namespace and k3d recreation |
| `k3d` | `${HOME}/.local/share/mantooth-tasks/prod` → `/var/lib/mantooth-tasks/prod` | Separate production-like local GitOps data |
| `homelab` | `mantooth-tasks-data` PVC, 1 GiB request, default StorageClass | Survives pod replacement; use the cluster storage backup policy |

The dev and k3d Mac paths are distinct and are mounted into every k3d node. Do
not delete these directories as part of normal deploy/undeploy. The app database
is `/data/tasks.sqlite3`; SQLite WAL sidecars can exist while the pod is active.

### Back up or restore local development data

Stop the app first so SQLite has closed cleanly, then copy the database while
preserving owner-only access:

```bash
make undeploy
umask 077
mkdir -p "$HOME/.local/share/mantooth-tasks/backups"
cp "$HOME/.local/share/mantooth-tasks/dev/tasks.sqlite3" \
  "$HOME/.local/share/mantooth-tasks/backups/tasks-$(date +%Y%m%d-%H%M%S).sqlite3"
```

To restore, stop the development app, copy the chosen backup to
`$HOME/.local/share/mantooth-tasks/dev/tasks.sqlite3`, then run `make dev`.
Keep backups outside the application data directory and test a restore
periodically. On the homelab, use a consistent SQLite backup plus the selected
PVC/Longhorn snapshot and offsite backup policy; those platform backup services
are not configured by this app repository.

### Reset local development data

This permanently deletes all tasks in the dev environment. Back up first and
verify the exact path before removing it:

```bash
make undeploy
for suffix in "" -wal -shm; do
  database="$HOME/.local/share/mantooth-tasks/dev/tasks.sqlite3${suffix}"
  if [ -f "$database" ]; then rm "$database"; fi
done
make dev
```

Never use the dev reset procedure on the separate `prod` directory.

## GitOps onboarding

The `k3d` and `homelab` overlays are ready for the `mantooth-homelab` apps
ApplicationSet at `deploy/overlays/k3d` and `deploy/overlays/homelab`. The
application repo is public so Argo CD can read source without credentials.
Merge the storage provisioning change, then this app. The GitHub Actions build
publishes immutable `sha-<full-commit>` multi-architecture images to
`ghcr.io/jmansmann/mantooth-tasks`; after publishing, the workflow updates the
pinned k3d and homelab image references directly on `main` with the installed
GitHub App token. Once that commit is present, arrange public GHCR access (or an
image-pull secret) and then merge the homelab ApplicationSet onboarding change.
Human changes to `main` remain PR-only; the image update is the explicitly
authorized GitHub App bypass.

The publish workflow requires repository secrets `APP_ID` and
`APP_PRIVATE_KEY`. The installed GitHub App needs `Contents: write` on this repo
and must be an allowed bypass actor for the protected `main` ruleset. Never put
the App private key or registry credentials in Git. Those secrets must be
configured before the first image build on `main`.

GHCR packages are private by default. After the first image publication, either
make the package public so the cluster can pull it without a secret, or create
an image pull secret outside Git and add its reference to the Deployment via a
reviewed change. Complete this before merging the ApplicationSet onboarding PR.

The `dev` overlay intentionally uses the locally built `:dev` image and the
`mantooth-tasks-dev` namespace. GitOps manifests never deploy from that mutable
local tag. `make manifests ENV=k3d` and `make manifests ENV=homelab` render future
deployment configuration only; this repository does not claim those future
environments have been synced or runtime-tested.

## Troubleshooting

- **`make dev` reports the wrong context:** select `k3d-dev`; every local
  cluster mutation checks this context and refuses other targets.
- **The pod cannot write `/data`:** confirm the Mac directories are owned by
  your account, owner-only, and mounted by the recreated cluster config. Check
  the pod's events and logs with
  `kubectl -n mantooth-tasks-dev describe pod -l app.kubernetes.io/name=mantooth-tasks`.
- **Image pull fails in a GitOps namespace:** make the GHCR package public or
  configure a namespace-local image-pull secret. The local `make dev` path uses
  `k3d image import` and does not need a registry.
- **A local request fails:** check `kubectl -n mantooth-tasks-dev get pods`,
  `kubectl -n mantooth-tasks-dev logs deploy/mantooth-tasks`, and confirm
  `/readyz` succeeds before running `make smoke`.
- **A browser test cannot start:** run `make install` to install Playwright's
  Chromium browser; CI installs the same browser and Linux dependencies.
- **The database migration fails:** readiness stays false and the pod does not
  receive traffic. Preserve the host database and logs; do not delete the data
  directory as a troubleshooting shortcut.

## Scope and future work

This is a one-user, trusted-local-network application with no authentication,
collaboration, due dates, tags, reminders, search, analytics, or public access.
Keep the replica count at one while the embedded SQLite store is used. A future
PostgreSQL/CloudNativePG and Longhorn migration is an explicit future decision:
it requires a tested data export/import and an operational backup plan, not a
partial repository abstraction. See [the specification](docs/spec.md) and
[decisions](docs/decisions.md).
