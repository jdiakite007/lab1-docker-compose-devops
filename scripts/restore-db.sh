
#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ $# -lt 1 || $# -gt 2 ]]; then
  echo "Usage : $0 backups/fichier.sql [base_cible]" >&2
  exit 2
fi

BACKUP_FILE="$1"

if [[ ! -f "$BACKUP_FILE" || ! -s "$BACKUP_FILE" ]]; then
  echo "Erreur : fichier absent ou vide : $BACKUP_FILE" >&2
  exit 1
fi

if [[ ! -f .env ]]; then
  echo "Erreur : fichier .env absent." >&2
  exit 1
fi

set -a
source ./.env
set +a

TARGET_DB="${2:-$POSTGRES_DB}"

echo "ATTENTION : restauration SQL dans la base : ${TARGET_DB}"
echo "Fichier utilisé : ${BACKUP_FILE}"
echo "Les objets existants peuvent être supprimés et recréés."

read -r -p "Tapez RESTAURER pour continuer : " CONFIRM

if [[ "$CONFIRM" != "RESTAURER" ]]; then
  echo "Restauration annulée."
  exit 0
fi

docker compose exec -T db psql -v ON_ERROR_STOP=1 \
  -U "$POSTGRES_USER" -d "$TARGET_DB" < "$BACKUP_FILE"

echo "Restauration terminée dans ${TARGET_DB}."

