# ADR-002: Blob Storage Separation for Whiteboard Canvas JSON & PDF Raster Slides

## Status
Accepted

## Context
Injasraj Classroom allows teachers to load multi-page PDF documents (worksheets, slides, textbooks) and annotate them with freehand paths, shapes, text, LaTeX math formulas, and images. Each page produces a Fabric.js canvas JSON serialization and high-DPI rendered background images.

Previously, large canvas JSON payloads (often 500 KB - 5 MB) and raw raster images were stored directly in Postgres columns (`jsonb` or `text`). This architectural pattern caused:
- **Table Bloat & Write Amplification**: PostgreSQL TOAST tables grew excessively, degrading WAL generation, autovacuum cycles, and buffer pool efficiency.
- **High Egress Latency**: Fetching room history or room metadata transferred megabytes of unused canvas JSON over database connections.
- **Backup Degradation**: Database backups (`pg_dump`) expanded dramatically in size and duration due to embedded binary and massive JSON blobs.

## Decision Drivers
- **Relational Leanliness**: Keep PostgreSQL relational tables strictly for structured metadata, access control, indexes, and session states.
- **Fast Metadata Queries**: Room queries, participant listings, and session lookups must execute in under 5ms.
- **Cost-Effective Scalable Storage**: Supabase Storage / S3-compatible object storage is 10x cheaper per GB than managed PostgreSQL storage.
- **CDN Caching**: Static PDF slides and immutable past class snapshots can be edge-cached via CDN URLs.

## Considered Options

### Option 1: Inline PostgreSQL Storage (`jsonb` & `text`)
- **Pros**: Single transactional store, simple rollback.
- **Cons**: Severe table bloat, slow index scans, high memory consumption in shared buffers, high cost.

### Option 2: External AWS S3 / Cloudflare R2 Bucket
- **Pros**: Global CDN, cheap storage.
- **Cons**: Additional credentials to manage, separate security and IAM boundaries, disjointed auth from Supabase RLS.

### Option 3: Supabase Storage Buckets (`whiteboard-assets` & `classroom-documents`)
- **Pros**:
  - Unified authentication and RLS security model with existing Supabase project.
  - Fast signed URLs and public CDN caching for static PDF slide rasters.
  - Postgres tables store only small metadata pointers (`storage_path`, `content_type`, `byte_size`, `page_index`).
  - Automatic media compression and streaming delivery.
- **Cons**: Requires two-step save/load workflow (upload asset to storage -> persist storage key in Postgres).

## Decision
We adopt **Option 3: Blob Storage Separation via Supabase Storage**.
1. Canvas page JSON payloads exceeding 64 KB and all PDF raster images are uploaded to the `whiteboard-assets` Supabase Storage bucket under the path:
   `rooms/{roomId}/pages/{pageId}/canvas.json`
2. The `whiteboard_pages` relational table retains metadata:
   - `id`, `session_id`, `room_id`, `page_index`, `title`, `storage_path`, `storage_bucket`, `checksum_sha256`, `updated_at`.
3. High-frequency queries (listing pages, switching tabs, checking permissions) query Postgres instantly without fetching multi-megabyte canvas state until requested.

## Consequences
- Postgres database size remains minimal and index scans remain sub-5ms.
- Client and server adapters load canvas JSON on demand via lightweight REST/Storage endpoints.
- Database backups remain lean and fast.
