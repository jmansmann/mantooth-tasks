SHELL := /bin/bash
.SHELLFLAGS := -euo pipefail -c

IMAGE ?= ghcr.io/jmansmann/mantooth-tasks
TAG ?= dev
ENV ?= dev
CLUSTER ?= dev
NAMESPACE ?= mantooth-tasks-dev
APP ?= mantooth-tasks
DOCKER ?= docker
K3D ?= k3d
KUBECTL ?= kubectl
KUSTOMIZE ?= kustomize
NPM ?= npm

.DEFAULT_GOAL := help

.PHONY: help install fmt fmt-check lint typecheck test verify build image load dev undeploy port-forward manifests verify-manifests smoke clean

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

install: ## Install locked dependencies and the Chromium test browser
	$(NPM) ci
	npx playwright install chromium

fmt: ## Format TypeScript, TSX, CSS, and JSON source
	$(NPM) run fmt

fmt-check: ## Check source formatting
	$(NPM) run fmt:check

lint: ## Lint source and accessibility rules
	$(NPM) run lint

typecheck: ## Type-check frontend, backend, and tests
	$(NPM) run typecheck

test: ## Run unit, API integration, browser, keyboard, and accessibility tests
	$(NPM) test

verify: fmt-check lint typecheck test build verify-manifests ## Full local and CI quality gate

build: ## Build production frontend and server
	$(NPM) run build

image: ## Build the local architecture container image
	$(DOCKER) build --build-arg VERSION=$(TAG) --build-arg REVISION="$$(git rev-parse HEAD)" -t $(IMAGE):$(TAG) .

load: ## Build and import the image into k3d cluster dev
	@test "$(CLUSTER)" = dev || { printf 'refusing to target cluster %s; only dev is permitted\n' "$(CLUSTER)" >&2; exit 1; }
	@test "$$($(KUBECTL) config current-context)" = k3d-dev || { printf 'kubectl context must be k3d-dev\n' >&2; exit 1; }
	@$(K3D) cluster list --no-headers | awk '$$1 == "dev" { found = 1 } END { exit !found }' || { printf 'k3d cluster dev does not exist\n' >&2; exit 1; }
	$(MAKE) image TAG=$(TAG) IMAGE=$(IMAGE)
	$(K3D) image import $(IMAGE):$(TAG) -c dev

dev: load ## Build, import, deploy, and wait for Mantooth Tasks in k3d
	@test "$(NAMESPACE)" = mantooth-tasks-dev || { printf 'refusing to target namespace %s\n' "$(NAMESPACE)" >&2; exit 1; }
	@test "$(IMAGE)" = ghcr.io/jmansmann/mantooth-tasks && test "$(TAG)" = dev || { printf 'make dev requires the local ghcr.io/jmansmann/mantooth-tasks:dev image\n' >&2; exit 1; }
	@test "$$($(KUBECTL) config current-context)" = k3d-dev || { printf 'kubectl context must be k3d-dev\n' >&2; exit 1; }
	$(KUBECTL) create namespace mantooth-tasks-dev --dry-run=client -o yaml | $(KUBECTL) apply -f -
	$(KUSTOMIZE) build deploy/overlays/dev | $(KUBECTL) apply -f -
	$(KUBECTL) -n mantooth-tasks-dev rollout status deployment/mantooth-tasks --timeout=180s

undeploy: ## Delete only the mantooth-tasks-dev namespace (never its host data)
	@test "$(NAMESPACE)" = mantooth-tasks-dev || { printf 'refusing to target namespace %s\n' "$(NAMESPACE)" >&2; exit 1; }
	@test "$$($(KUBECTL) config current-context)" = k3d-dev || { printf 'kubectl context must be k3d-dev\n' >&2; exit 1; }
	$(KUBECTL) delete namespace mantooth-tasks-dev --ignore-not-found

port-forward: ## Forward the local development service to http://localhost:8090
	@test "$$($(KUBECTL) config current-context)" = k3d-dev || { printf 'kubectl context must be k3d-dev\n' >&2; exit 1; }
	$(KUBECTL) -n mantooth-tasks-dev port-forward svc/mantooth-tasks 8090:80

manifests: ## Render ENV (dev|k3d|homelab)
	@case "$(ENV)" in dev|k3d|homelab) ;; *) printf 'unknown ENV=%s\n' "$(ENV)" >&2; exit 1 ;; esac
	$(KUSTOMIZE) build deploy/overlays/$(ENV)

verify-manifests: ## Render all three deployment overlays
	KUSTOMIZE=$(KUSTOMIZE) node scripts/verify-manifests.mjs

smoke: ## Create, read, and delete a temporary task through the running dev service
	./scripts/smoke.sh

clean: ## Remove generated builds and test output
	rm -rf dist coverage playwright-report test-results
