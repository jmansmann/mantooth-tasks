#!/usr/bin/env bash
set -euo pipefail

namespace=mantooth-tasks-dev
expected_context=k3d-dev
actual_context="$(kubectl config current-context)"

if [[ "$actual_context" != "$expected_context" ]]; then
  printf 'Refusing smoke test: current context is %s, expected %s.\n' \
    "$actual_context" "$expected_context" >&2
  exit 1
fi

kubectl -n "$namespace" rollout status deployment/mantooth-tasks --timeout=30s
port=18090
kubectl -n "$namespace" port-forward svc/mantooth-tasks "${port}:80" >/dev/null 2>&1 &
port_forward_pid=$!
cleanup() {
  kill "$port_forward_pid" 2>/dev/null || true
  wait "$port_forward_pid" 2>/dev/null || true
}
trap cleanup EXIT

ready=false
for _ in {1..30}; do
  if curl --fail --silent "http://127.0.0.1:${port}/readyz" >/dev/null; then
    ready=true
    break
  fi
  sleep 1
done

if [[ "$ready" != true ]]; then
  printf 'Mantooth Tasks did not become ready on localhost:%s.\n' "$port" >&2
  exit 1
fi

SMOKE_URL="http://127.0.0.1:${port}" node scripts/smoke.mjs
