# Injasraj Classroom Disaster Recovery & Database Backup Runbook

## 1. Overview & Objectives

This runbook defines the disaster recovery (DR) protocols, automated backup strategies, and point-in-time recovery (PITR) procedures for Injasraj Classroom running on Vercel and Supabase Postgres.

### Service Level Objectives
- **RTO (Recovery Time Objective)**: < 15 minutes (Total time to restore database and resume live classroom operations).
- **RPO (Recovery Point Objective)**: < 1 hour (Maximum acceptable data loss window in the event of catastrophic region failure).

---

## 2. Backup Strategy Architecture

```
                    ┌────────────────────────┐
                    │ Supabase Postgres (DB) │
                    └───────────┬────────────┘
                                │
             ┌──────────────────┴──────────────────┐
             ▼                                     ▼
┌─────────────────────────┐           ┌─────────────────────────┐
│ Automated Daily Snapshots│           │ Automated GitHub Action │
│   & Continuous WAL Logs │           │  Scheduled pg_dump      │
│  (Supabase Managed PITR)│           │  (Off-Site Redundancy)  │
└─────────────────────────┘           └────────────┬────────────┘
                                                   │
                                                   ▼
                                      ┌─────────────────────────┐
                                      │ GPG Encrypted (AES-256) │
                                      │ Injasraj S3 / R2 Vault  │
                                      │   (30-Day Retention)    │
                                      └─────────────────────────┘
```

### Backup Types & Frequencies
1. **Continuous WAL Archiving (PITR)**:
   - Supabase native Write-Ahead Logging allows second-by-second rollbacks up to 7 days.
2. **Scheduled Off-Site Logical Backups (`pg_dump`)**:
   - Automated via GitHub Actions (`.github/workflows/db-backup.yml`) daily at 02:00 UTC.
   - Encrypted with AES-256 GPG before egress.
   - Uploaded to isolated cloud storage bucket with 30-day lifecycle expiration.

---

## 3. Automated Backup Pipeline (`.github/workflows/db-backup.yml`)

The automated workflow performs:
1. **Connection**: Connects via session port 5432 using `SUPABASE_DB_URL`.
2. **Dump**: Executes `pg_dump --format=custom --blobs --verbose --no-owner --no-privileges`.
3. **Encryption**: Symmetrically encrypts using `gpg --symmetric --cipher-algo AES256`.
4. **Off-site Ship**: Pushes encrypted archive `injasraj_backup_YYYYMMDD_HHMMSS.dump.gpg` to S3/R2.
5. **Health Notification**: Alerts DevOps channel if any stage fails.

---

## 4. Disaster Recovery Scenarios & Runbooks

### Scenario A: Accidental Data Deletion / Corrupt Migration
**Goal**: Restore database to a point in time 5 minutes prior to incident.
1. Open Supabase Dashboard -> **Database** -> **Backups** -> **Point in Time**.
2. Select target recovery timestamp (e.g., `2026-11-28 14:20:00 UTC`).
3. Click **Restore Database**. Supabase spins up the restored instance and replays WAL files.
4. Verify room tables and teacher availability:
   ```sql
   SELECT count(*) FROM public.rooms;
   SELECT count(*) FROM public.teacher_profiles;
   ```
5. Resume traffic. Total downtime: ~6-10 minutes.

---

### Scenario B: Catastrophic Region Outage / Complete Supabase Account Failure
**Goal**: Stand up fresh Postgres instance in an alternate cloud region using off-site GPG backup.
1. **Retrieve latest backup** from off-site storage:
   ```bash
   aws s3 cp s3://injasraj-db-backups/latest.dump.gpg /tmp/backup.dump.gpg
   ```
2. **Decrypt archive**:
   ```bash
   gpg --batch --decrypt --passphrase "$BACKUP_ENCRYPTION_KEY" \
     /tmp/backup.dump.gpg > /tmp/backup.dump
   ```
3. **Restore to fresh PostgreSQL instance**:
   ```bash
   pg_restore --clean --if-exists --no-owner --no-privileges \
     --dbname="$TARGET_DATABASE_URL" /tmp/backup.dump
   ```
4. **Apply forward migrations if needed**:
   ```bash
   npx supabase db push
   ```
5. **Update Vercel environment variables**:
   - `SUPABASE_DB_HOST`, `SUPABASE_DB_PASSWORD`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
6. Trigger production redeployment on Vercel.

---

## 5. Routine Verification Drill Checklist
- [ ] Monthly automated dry-run restoration to test staging database.
- [ ] GPG decryption key verification every 90 days.
- [ ] Review S3 storage lifecycle rules to enforce 30-day auto-purge of stale dumps.
