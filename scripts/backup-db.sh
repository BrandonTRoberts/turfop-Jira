#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/turfops}"
DB_NAME="${DB_NAME:-greenkeeper_ops}"
DB_USER="${DB_USER:-postgres}"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
FILENAME="$BACKUP_DIR/${DB_NAME}-${TIMESTAMP}.sql.gz"

mkdir -p "$BACKUP_DIR"

sudo -u "$DB_USER" pg_dump "$DB_NAME" | gzip > "$FILENAME"
find "$BACKUP_DIR" -type f -name "${DB_NAME}-*.sql.gz" -mtime +14 -delete

echo "Backup written to $FILENAME"
