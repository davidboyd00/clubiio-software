# Backup and Recovery Procedures

## Overview

This document describes the backup strategy and disaster recovery procedures for Clubio's infrastructure. Our goal is to ensure data durability and enable rapid recovery from failures.

## Table of Contents

1. [Backup Strategy](#backup-strategy)
2. [Database Backups](#database-backups)
3. [Application Data Backups](#application-data-backups)
4. [Recovery Procedures](#recovery-procedures)
5. [Disaster Recovery](#disaster-recovery)
6. [Testing & Validation](#testing--validation)
7. [Runbooks](#runbooks)

---

## Backup Strategy

### Recovery Objectives

| Metric | Target | Description |
|--------|--------|-------------|
| **RPO** (Recovery Point Objective) | 1 hour | Maximum acceptable data loss |
| **RTO** (Recovery Time Objective) | 4 hours | Maximum acceptable downtime |
| **Backup Retention** | 30 days | Standard backup retention |
| **Long-term Retention** | 1 year | Monthly snapshots |

### Backup Types

| Type | Frequency | Retention | Use Case |
|------|-----------|-----------|----------|
| Continuous (PITR) | Real-time | 7 days | Point-in-time recovery |
| Daily Snapshot | Daily 2:00 UTC | 30 days | Regular restores |
| Weekly Snapshot | Sunday 2:00 UTC | 90 days | Weekly checkpoints |
| Monthly Archive | 1st of month | 1 year | Compliance/audit |

### Backup Locations

```
Primary: Neon (us-east-1)
├── Continuous WAL streaming (PITR)
├── Daily automated snapshots
└── Cross-region replication (us-west-2)

Secondary: S3 (us-east-1)
├── Application configs
├── Static assets
└── Exported data (encrypted)
```

---

## Database Backups

### Neon PostgreSQL

Neon provides built-in backup capabilities:

#### Continuous Backup (PITR)

```bash
# Neon automatically maintains WAL for point-in-time recovery
# Restore to any point within the retention window

# Using Neon CLI
neon branches create \
  --project-id $PROJECT_ID \
  --name recovery-$(date +%Y%m%d-%H%M%S) \
  --parent main \
  --at "2024-01-15T10:30:00Z"
```

#### Branch-Based Backups

```bash
# Create a backup branch (instant, copy-on-write)
neon branches create \
  --project-id $PROJECT_ID \
  --name backup-$(date +%Y%m%d) \
  --parent main

# List backup branches
neon branches list --project-id $PROJECT_ID | grep backup-
```

#### Automated Backup Script

```bash
#!/bin/bash
# scripts/backup-database.sh

set -euo pipefail

PROJECT_ID="${NEON_PROJECT_ID}"
BACKUP_PREFIX="backup"
RETENTION_DAYS=30

# Create daily backup branch
BACKUP_NAME="${BACKUP_PREFIX}-$(date +%Y%m%d)"

echo "Creating backup branch: ${BACKUP_NAME}"
neon branches create \
  --project-id "$PROJECT_ID" \
  --name "$BACKUP_NAME" \
  --parent main

# Clean up old backups
echo "Cleaning up backups older than ${RETENTION_DAYS} days"
CUTOFF_DATE=$(date -d "-${RETENTION_DAYS} days" +%Y%m%d)

neon branches list --project-id "$PROJECT_ID" --output json | \
  jq -r ".[] | select(.name | startswith(\"${BACKUP_PREFIX}-\")) | .name" | \
  while read -r branch; do
    BRANCH_DATE=$(echo "$branch" | sed "s/${BACKUP_PREFIX}-//")
    if [[ "$BRANCH_DATE" < "$CUTOFF_DATE" ]]; then
      echo "Deleting old backup: $branch"
      neon branches delete --project-id "$PROJECT_ID" --branch "$branch" --force
    fi
  done

echo "Backup completed successfully"
```

#### Export to S3 (Monthly Archive)

```bash
#!/bin/bash
# scripts/export-database.sh

set -euo pipefail

DATABASE_URL="${DATABASE_URL}"
S3_BUCKET="${BACKUP_S3_BUCKET}"
ENCRYPTION_KEY="${BACKUP_ENCRYPTION_KEY}"

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
FILENAME="clubio-db-${TIMESTAMP}.sql.gz.enc"

# Export, compress, and encrypt
echo "Exporting database..."
pg_dump "$DATABASE_URL" | \
  gzip | \
  openssl enc -aes-256-cbc -salt -pbkdf2 -pass env:ENCRYPTION_KEY > "/tmp/${FILENAME}"

# Upload to S3
echo "Uploading to S3..."
aws s3 cp "/tmp/${FILENAME}" "s3://${S3_BUCKET}/database/${FILENAME}" \
  --sse aws:kms \
  --storage-class STANDARD_IA

# Verify upload
aws s3api head-object --bucket "$S3_BUCKET" --key "database/${FILENAME}"

# Clean up
rm "/tmp/${FILENAME}"

echo "Export completed: s3://${S3_BUCKET}/database/${FILENAME}"
```

### Backup Verification

```bash
#!/bin/bash
# scripts/verify-backup.sh

set -euo pipefail

PROJECT_ID="${NEON_PROJECT_ID}"
LATEST_BACKUP=$(neon branches list --project-id "$PROJECT_ID" --output json | \
  jq -r '[.[] | select(.name | startswith("backup-"))] | sort_by(.created_at) | last | .name')

if [ -z "$LATEST_BACKUP" ]; then
  echo "ERROR: No backup branches found"
  exit 1
fi

echo "Latest backup: $LATEST_BACKUP"

# Get backup age
BACKUP_DATE=$(echo "$LATEST_BACKUP" | sed 's/backup-//')
BACKUP_AGE=$(( ($(date +%s) - $(date -d "$BACKUP_DATE" +%s)) / 86400 ))

if [ "$BACKUP_AGE" -gt 1 ]; then
  echo "WARNING: Latest backup is ${BACKUP_AGE} days old"
  exit 1
fi

echo "Backup verification passed"
```

---

## Application Data Backups

### Configuration Backups

```bash
#!/bin/bash
# scripts/backup-configs.sh

S3_BUCKET="${BACKUP_S3_BUCKET}"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

# Backup environment configurations (sanitized)
cat > /tmp/config-backup.json << EOF
{
  "timestamp": "${TIMESTAMP}",
  "environment": "${NODE_ENV}",
  "config": {
    "api_version": "$(git describe --tags --always)",
    "features": $(cat config/features.json 2>/dev/null || echo '{}'),
    "rate_limits": $(cat config/rate-limits.json 2>/dev/null || echo '{}')
  }
}
EOF

aws s3 cp /tmp/config-backup.json \
  "s3://${S3_BUCKET}/configs/config-${TIMESTAMP}.json" \
  --sse aws:kms

rm /tmp/config-backup.json
```

### Static Assets Backup

```bash
#!/bin/bash
# scripts/sync-assets.sh

SOURCE_BUCKET="${ASSETS_S3_BUCKET}"
BACKUP_BUCKET="${BACKUP_S3_BUCKET}"

# Sync assets to backup bucket
aws s3 sync \
  "s3://${SOURCE_BUCKET}/" \
  "s3://${BACKUP_BUCKET}/assets/" \
  --sse aws:kms \
  --storage-class STANDARD_IA

echo "Assets synced to backup bucket"
```

---

## Recovery Procedures

### Database Recovery

#### Point-in-Time Recovery (PITR)

```bash
#!/bin/bash
# scripts/pitr-recovery.sh

set -euo pipefail

PROJECT_ID="${NEON_PROJECT_ID}"
RECOVERY_POINT="${1:-}"  # ISO 8601 timestamp

if [ -z "$RECOVERY_POINT" ]; then
  echo "Usage: $0 <recovery-point>"
  echo "Example: $0 '2024-01-15T10:30:00Z'"
  exit 1
fi

RECOVERY_BRANCH="recovery-$(date +%Y%m%d-%H%M%S)"

echo "Creating recovery branch from point: ${RECOVERY_POINT}"

# Create branch at specific point in time
neon branches create \
  --project-id "$PROJECT_ID" \
  --name "$RECOVERY_BRANCH" \
  --parent main \
  --at "$RECOVERY_POINT"

echo "Recovery branch created: $RECOVERY_BRANCH"
echo ""
echo "Next steps:"
echo "1. Verify data in recovery branch"
echo "2. If correct, promote to main:"
echo "   neon branches set-primary --project-id $PROJECT_ID --branch $RECOVERY_BRANCH"
```

#### Restore from Backup Branch

```bash
#!/bin/bash
# scripts/restore-from-backup.sh

set -euo pipefail

PROJECT_ID="${NEON_PROJECT_ID}"
BACKUP_BRANCH="${1:-}"

if [ -z "$BACKUP_BRANCH" ]; then
  echo "Available backup branches:"
  neon branches list --project-id "$PROJECT_ID" | grep backup-
  echo ""
  echo "Usage: $0 <backup-branch-name>"
  exit 1
fi

echo "WARNING: This will replace the main branch with $BACKUP_BRANCH"
read -p "Are you sure? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
  echo "Aborted"
  exit 1
fi

# Create a safety snapshot of current main
SAFETY_BRANCH="pre-restore-$(date +%Y%m%d-%H%M%S)"
neon branches create \
  --project-id "$PROJECT_ID" \
  --name "$SAFETY_BRANCH" \
  --parent main

echo "Safety snapshot created: $SAFETY_BRANCH"

# Reset main from backup
# Note: This requires using Neon's branch operations
echo "Restoring from backup..."
neon branches reset \
  --project-id "$PROJECT_ID" \
  --branch main \
  --parent "$BACKUP_BRANCH"

echo "Restore completed"
echo "Safety snapshot available at: $SAFETY_BRANCH"
```

#### Restore from S3 Export

```bash
#!/bin/bash
# scripts/restore-from-s3.sh

set -euo pipefail

S3_BUCKET="${BACKUP_S3_BUCKET}"
ENCRYPTION_KEY="${BACKUP_ENCRYPTION_KEY}"
TARGET_DATABASE_URL="${1:-}"
BACKUP_FILE="${2:-}"

if [ -z "$TARGET_DATABASE_URL" ] || [ -z "$BACKUP_FILE" ]; then
  echo "Available backups:"
  aws s3 ls "s3://${S3_BUCKET}/database/" | tail -10
  echo ""
  echo "Usage: $0 <target-database-url> <backup-filename>"
  exit 1
fi

echo "Downloading backup: $BACKUP_FILE"
aws s3 cp "s3://${S3_BUCKET}/database/${BACKUP_FILE}" /tmp/restore.sql.gz.enc

echo "Decrypting and decompressing..."
openssl enc -d -aes-256-cbc -pbkdf2 -pass env:ENCRYPTION_KEY \
  -in /tmp/restore.sql.gz.enc | \
  gunzip > /tmp/restore.sql

echo "Restoring to database..."
psql "$TARGET_DATABASE_URL" < /tmp/restore.sql

# Clean up
rm /tmp/restore.sql /tmp/restore.sql.gz.enc

echo "Restore completed"
```

### Application Recovery

#### Rollback Deployment

```bash
#!/bin/bash
# scripts/rollback-deployment.sh

PREVIOUS_VERSION="${1:-}"

if [ -z "$PREVIOUS_VERSION" ]; then
  echo "Recent deployments:"
  aws ecs describe-task-definition \
    --task-definition clubio-api \
    --query 'taskDefinition.revision'
  exit 1
fi

echo "Rolling back to version: $PREVIOUS_VERSION"

# Update service to previous task definition
aws ecs update-service \
  --cluster clubio-production \
  --service clubio-api \
  --task-definition "clubio-api:${PREVIOUS_VERSION}"

echo "Rollback initiated. Monitor deployment status."
```

---

## Disaster Recovery

### DR Scenarios

| Scenario | RTO | RPO | Procedure |
|----------|-----|-----|-----------|
| Database corruption | 1 hour | 15 min | PITR to before corruption |
| Accidental deletion | 30 min | 0 | Restore from backup branch |
| Region failure | 4 hours | 1 hour | Failover to DR region |
| Complete data loss | 8 hours | 24 hours | Restore from S3 archive |

### Region Failover

```bash
#!/bin/bash
# scripts/dr-failover.sh

set -euo pipefail

PRIMARY_PROJECT="${NEON_PROJECT_ID_PRIMARY}"
DR_PROJECT="${NEON_PROJECT_ID_DR}"

echo "=== DISASTER RECOVERY FAILOVER ==="
echo "Primary: $PRIMARY_PROJECT"
echo "DR: $DR_PROJECT"
echo ""

# Step 1: Verify DR project is available
echo "Step 1: Checking DR project health..."
neon projects show --project-id "$DR_PROJECT"

# Step 2: Update application configuration
echo "Step 2: Update application to use DR database..."
# This would update your application's database connection

# Step 3: Verify connectivity
echo "Step 3: Verifying database connectivity..."
# Run health check against DR database

# Step 4: Update DNS/Load Balancer
echo "Step 4: Updating traffic routing..."
# Update Route53 or load balancer configuration

echo ""
echo "Failover initiated. Verify application health."
```

### DR Testing Checklist

```markdown
## Monthly DR Test Checklist

### Pre-Test
- [ ] Notify stakeholders of planned test
- [ ] Document current system state
- [ ] Verify DR environment is ready

### Test Execution
- [ ] Create point-in-time snapshot
- [ ] Simulate primary failure
- [ ] Execute failover procedure
- [ ] Verify application functionality
- [ ] Test data integrity

### Post-Test
- [ ] Document test results
- [ ] Measure actual RTO/RPO
- [ ] Identify improvement areas
- [ ] Restore normal operations
- [ ] Update procedures if needed
```

---

## Testing & Validation

### Backup Testing Schedule

| Test Type | Frequency | Owner | Duration |
|-----------|-----------|-------|----------|
| Backup verification | Daily | Automated | 5 min |
| PITR test | Weekly | On-call | 30 min |
| Full restore test | Monthly | DevOps | 2 hours |
| DR failover test | Quarterly | Team | 4 hours |

### Automated Backup Monitoring

```yaml
# .github/workflows/backup-verification.yml
name: Backup Verification

on:
  schedule:
    - cron: '0 6 * * *'  # Daily at 6 AM UTC

jobs:
  verify-backups:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install Neon CLI
        run: npm install -g neonctl

      - name: Verify database backup
        env:
          NEON_API_KEY: ${{ secrets.NEON_API_KEY }}
          NEON_PROJECT_ID: ${{ secrets.NEON_PROJECT_ID }}
        run: ./scripts/verify-backup.sh

      - name: Verify S3 backups
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
        run: |
          LATEST=$(aws s3 ls s3://$BACKUP_S3_BUCKET/database/ | tail -1)
          echo "Latest S3 backup: $LATEST"

      - name: Alert on failure
        if: failure()
        uses: slackapi/slack-github-action@v1
        with:
          payload: |
            {
              "text": "Backup verification failed!"
            }
```

---

## Runbooks

### Runbook: Daily Backup Failure

```markdown
## Alert: Daily Backup Failed

### Severity: P2

### Symptoms
- Backup verification job failed
- No new backup branch created

### Diagnosis
1. Check Neon project status:
   ```bash
   neon projects show --project-id $PROJECT_ID
   ```

2. Check for errors in backup script logs

3. Verify Neon API connectivity

### Resolution
1. **If Neon is available:**
   - Manually trigger backup:
     ```bash
     ./scripts/backup-database.sh
     ```

2. **If Neon is unavailable:**
   - Wait for Neon status to recover
   - Document incident
   - Run backup when recovered

### Escalation
- If backup fails for 2+ consecutive days, escalate to P1
- Contact: oncall@clubio.com
```

### Runbook: Data Corruption Detected

```markdown
## Alert: Data Corruption Detected

### Severity: P1

### Symptoms
- Application errors related to data integrity
- Database constraint violations
- Unexpected null values or data inconsistencies

### Immediate Actions
1. **Stop writes to affected tables** (if possible)
   ```sql
   ALTER TABLE affected_table SET (autovacuum_enabled = off);
   ```

2. **Identify corruption timeframe**
   ```sql
   SELECT MAX(updated_at) FROM affected_table
   WHERE data_looks_corrupted;
   ```

3. **Create safety snapshot**
   ```bash
   neon branches create --name safety-$(date +%s) --parent main
   ```

### Recovery
1. **Determine recovery point**
   - Identify last known good state
   - Usually 15-30 minutes before corruption

2. **Execute PITR**
   ```bash
   ./scripts/pitr-recovery.sh "2024-01-15T10:30:00Z"
   ```

3. **Verify recovered data**

4. **Promote recovery branch if verified**

### Post-Incident
- Document root cause
- Update monitoring to detect earlier
- Review data validation procedures
```

---

## Appendix: Backup Commands Reference

### Neon CLI Commands

```bash
# List all branches
neon branches list --project-id $PROJECT_ID

# Create backup branch
neon branches create --name backup-$(date +%Y%m%d) --parent main

# Restore to point in time
neon branches create --name recovery --parent main --at "2024-01-15T10:30:00Z"

# Delete old backup
neon branches delete --branch backup-20231201 --force

# Reset branch from another branch
neon branches reset --branch main --parent backup-20240115
```

### AWS CLI Commands

```bash
# List S3 backups
aws s3 ls s3://$BACKUP_BUCKET/database/

# Download specific backup
aws s3 cp s3://$BACKUP_BUCKET/database/file.sql.gz.enc /tmp/

# Check backup metadata
aws s3api head-object --bucket $BACKUP_BUCKET --key database/file.sql.gz.enc
```

### Verification Queries

```sql
-- Check table row counts
SELECT
  schemaname,
  relname,
  n_live_tup as row_count
FROM pg_stat_user_tables
ORDER BY n_live_tup DESC;

-- Check latest data timestamps
SELECT
  'users' as table_name,
  MAX(updated_at) as latest_update
FROM users
UNION ALL
SELECT 'orders', MAX(updated_at) FROM orders
UNION ALL
SELECT 'transactions', MAX(created_at) FROM transactions;
```
