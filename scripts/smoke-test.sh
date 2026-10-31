#!/usr/bin/env bash
# Testa rapidamente uma instância no ar: health, criação e leitura de tarefa, métricas.
# Uso: ./scripts/smoke-test.sh http://localhost:8080
set -euo pipefail

BASE="${1:-http://localhost:8080}"

echo ">> Aguardando $BASE/health"
for _ in $(seq 1 30); do
  curl -fsS "$BASE/health" >/dev/null 2>&1 && break
  sleep 2
done

curl -fsS "$BASE/health" | grep -q '"status":"ok"'
id=$(curl -fsS -X POST "$BASE/api/tasks" -H 'Content-Type: application/json' \
  -d '{"title":"smoke test"}' | sed -E 's/.*"id":"([^"]+)".*/\1/')
curl -fsS "$BASE/api/tasks/$id" | grep -q 'smoke test'
curl -fsS -X DELETE "$BASE/api/tasks/$id" -o /dev/null
curl -fsS "$BASE/metrics" | grep -q 'http_requests_total'

echo ">> Smoke test OK em $BASE"
