#!/usr/bin/env bash
# Faz o deploy de uma versão da imagem com Docker Compose e volta para a
# versão anterior automaticamente se o health check falhar.
#
# Uso: ./scripts/deploy.sh ghcr.io/usuario/taskflow-api:<tag>
set -euo pipefail

IMAGE="${1:?Informe a imagem. Ex.: ghcr.io/usuario/taskflow-api:sha-abc1234}"
APP_PORT="${APP_PORT:-8080}"
STATE_FILE="${STATE_FILE:-.deployed-image}"
HEALTH_URL="http://127.0.0.1:${APP_PORT}/health"

cd "$(dirname "$0")/.."

previous=""
[[ -f "$STATE_FILE" ]] && previous="$(cat "$STATE_FILE")"

wait_healthy() {
  for _ in $(seq 1 20); do
    if curl -fsS "$HEALTH_URL" >/dev/null 2>&1; then
      return 0
    fi
    sleep 3
  done
  return 1
}

up() {
  export IMAGE="$1" APP_PORT
  docker compose pull app
  docker compose up -d --no-build app
}

echo ">> Deploy de $IMAGE (anterior: ${previous:-nenhuma})"

# O primeiro container (criado pelo user_data do Terraform) não é gerenciado
# pelo Compose; ele é removido para o Compose assumir a partir daqui.
if docker inspect taskflow-api >/dev/null 2>&1 &&
   [[ -z "$(docker inspect -f '{{index .Config.Labels "com.docker.compose.project"}}' taskflow-api)" ]]; then
  [[ -z "$previous" ]] && previous="$(docker inspect -f '{{.Config.Image}}' taskflow-api)"
  docker rm -f taskflow-api >/dev/null
fi

up "$IMAGE"

if wait_healthy; then
  echo "$IMAGE" > "$STATE_FILE"
  echo ">> Deploy concluído: $(curl -fsS "$HEALTH_URL")"
  docker image prune -f >/dev/null
  exit 0
fi

echo "!! Health check falhou para $IMAGE" >&2
docker compose logs --tail=50 app >&2 || true

if [[ -n "$previous" ]]; then
  echo ">> Rollback para $previous" >&2
  up "$previous"
  wait_healthy && echo ">> Rollback concluído" >&2
fi
exit 1
