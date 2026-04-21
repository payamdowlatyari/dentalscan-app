# DentalScan AI - Engineering Challenge

## Implemented Scope

### Phase 1: Explore and Audit

- Audit document added: [AUDIT.md](AUDIT.md)

### Phase 2: Core Implementation

- Scan enhancement in [src/components/ScanningFlow.tsx](src/components/ScanningFlow.tsx)
  - Mouth guide overlay
  - Live quality feedback (`good`, `adjusting`, `too-close`, `too-far`)
  - Capture flash, progress UI, and status states
- Notification API in [src/app/api/notify/route.ts](src/app/api/notify/route.ts)
  - Creates Prisma `Notification` records when scans complete
- Messaging APIs in [src/app/api/messaging/route.ts](src/app/api/messaging/route.ts)
  - Send and fetch messages for threads

### Phase 3: Messaging UX and Returning User Access

- Quick-message sidebar in [src/components/QuickMessageSidebar.tsx](src/components/QuickMessageSidebar.tsx)
- Per-scan thread model in [prisma/schema.prisma](prisma/schema.prisma)
  - `Thread.scanId` (unique), `status`, `lastMessageAt`
- Thread create/find and list APIs in [src/app/api/messaging/thread/route.ts](src/app/api/messaging/thread/route.ts)
  - One thread per scan
  - Returning user thread history listing by `patientId`
- Resume chat shortcuts in [src/components/ScanningFlow.tsx](src/components/ScanningFlow.tsx)
  - Resume last conversation
  - Open one of the latest threads quickly

## Local Setup

1. Install dependencies

```bash
npm install
```

2. Sync Prisma and generate client

```bash
npx prisma db push
npx prisma generate
```

3. Start the app

```bash
npm run dev
```

4. Open

```text
http://localhost:3000
```

## API Summary

### Notifications

- `POST /api/notify`
  - Body: `{ scanId, status, userId }`
  - Creates a `Notification` when `status === "completed"`

### Messaging

- `GET /api/messaging?threadId=<id>`
  - Returns messages for a thread (ascending by creation time)
- `GET /api/messaging?scanId=<scanId>`
  - Returns messages by scan-linked thread
- `POST /api/messaging`
  - Body: `{ threadId, content, sender }`
  - Persists a message and updates thread `lastMessageAt`

### Thread Management

- `POST /api/messaging/thread`
  - Body: `{ patientId, scanId }`
  - Idempotent: returns existing thread for that scan or creates one
- `GET /api/messaging/thread?patientId=<patientId>`
  - Returns patient thread list sorted by latest activity

## Notes

- Current persistence uses SQLite in local development via Prisma.
- Demo identity values (such as `example-user-id`) are placeholders and should be replaced by authenticated user context in production.
- Walkthrough video https://www.loom.com/share/d877b6d4f11d438895128bab88e18046
