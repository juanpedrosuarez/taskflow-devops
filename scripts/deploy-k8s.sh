#!/usr/bin/env bash
# Faz o deploy no Kubernetes (rolling update) e desfaz se o rollout falhar.
# Uso: ./scripts/deploy-k8s.sh ghcr.io/usuario/taskflow-api:<tag>
set -euo pipefail

IMAGE="${1:?Informe a imagem}"
NS="${NAMESPACE:-taskflow}"

cd "$(dirname "$0")/.."

kubectl apply -k k8s/
kubectl -n "$NS" set image deployment/taskflow-api app="$IMAGE"

if ! kubectl -n "$NS" rollout status deployment/taskflow-api --timeout=120s; then
  echo "!! Rollout falhou, desfazendo" >&2
  kubectl -n "$NS" rollout undo deployment/taskflow-api
  exit 1
fi

kubectl -n "$NS" get pods -o wide
