#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ ! -f .env ]]; then
  echo "Erreur : fichier .env absent. Copiez .env.example vers .env." >&2
  exit 1
fi

set -a
source ./.env
set +a

mkdir -p backups
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="backups/${POSTGRES_DB}-${STAMP}.sql"

echo "Création de la sauvegarde : $OUT"
docker compose exec -T db pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  --clean --if-exists --no-owner --no-privileges > "$OUT"

if [[ ! -s "$OUT" ]]; then
  echo "Erreur : sauvegarde vide." >&2
  rm -f "$OUT"
  exit 1
fi

echo "Sauvegarde terminée : $OUT"
