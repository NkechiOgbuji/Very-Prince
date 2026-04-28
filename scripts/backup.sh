#!/bin/bash
# Exit immediately if a command exits with a non-zero status
set -e

echo "🗄️ Starting automated PostgreSQL backup..."

# Variables
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
BACKUP_DIR="/tmp"
BACKUP_FILE="${BACKUP_DIR}/very_princess_backup_${TIMESTAMP}.sql.gz"
S3_BUCKET="${BACKUP_S3_BUCKET:-s3://very-princess-backups/database/}"

# Ensure required database variables are set
if [ -z "$PGUSER" ] || [ -z "$PGPASSWORD" ] || [ -z "$PGDATABASE" ]; then
    echo "❌ Error: Database credentials (PGUSER, PGPASSWORD, PGDATABASE) must be exported as environment variables."
    exit 1
fi

echo "📦 Dumping and compressing database: $PGDATABASE..."
# Use pg_dump and pipe directly into gzip
pg_dump -h "${PGHOST:-localhost}" -p "${PGPORT:-5432}" -U "$PGUSER" -d "$PGDATABASE" | gzip > "$BACKUP_FILE"

echo "✅ Local backup created: $BACKUP_FILE"

# Secure Offsite Transfer
if command -v aws &> /dev/null; then
    echo "☁️ Transferring securely to offsite storage ($S3_BUCKET)..."
    aws s3 cp "$BACKUP_FILE" "$S3_BUCKET"
    echo "✅ Offsite transfer complete."
else
    echo "⚠️ Warning: AWS CLI not found. Skipping S3 upload. If this is production, please install AWS CLI."
fi

# Cleanup
echo "🧹 Cleaning up local compressed file to save disk space..."
rm "$BACKUP_FILE"

echo "🎉 Backup process finished successfully."