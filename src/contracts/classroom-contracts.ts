import { z } from 'zod';

/**
 * Common Envelopes & Types
 */
export const ApiResponseEnvelope = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.boolean(),
    data: dataSchema.optional(),
    error: z
      .object({
        code: z.string(),
        message: z.string(),
        details: z.any().optional(),
      })
      .optional(),
    meta: z
      .object({
        timestamp: z.string(),
        requestId: z.string().optional(),
      })
      .default(() => ({ timestamp: new Date().toISOString() })),
  });

/**
 * 1. Whiteboard Synchronization Contracts
 */
export const WhiteboardTabLockSchema = z.record(z.string(), z.boolean());

export const WhiteboardPermissionsContract = z.object({
  canDraw: z.boolean().default(true),
  canAddPages: z.boolean().default(false),
  canDeletePages: z.boolean().default(false),
  canManageMaterials: z.boolean().default(false),
  tabLocks: WhiteboardTabLockSchema.default({}),
});

export const WhiteboardPageContract = z.object({
  id: z.string().min(1, 'Page ID required'),
  title: z.string().default('Untitled Page'),
  pageIndex: z.number().int().nonnegative(),
  isLocked: z.boolean().default(false),
  storagePath: z.string().optional(),
  canvasJson: z.string().optional(),
  backgroundImageUrl: z.string().optional(),
  pdfDocumentId: z.string().optional(),
  pdfPageIndex: z.number().int().nonnegative().optional(),
  updatedAt: z.string().datetime().optional(),
});

export const WhiteboardSyncDeltaContract = z.object({
  type: z.enum([
    'object-added',
    'object-modified',
    'object-removed',
    'clear',
    'page-switch',
    'page-added',
    'page-deleted',
    'tab-lock-toggle',
    'laser-trail',
    'viewport-sync',
  ]),
  roomId: z.string().min(1),
  pageId: z.string().min(1),
  senderId: z.string().min(1),
  senderRole: z.enum(['teacher', 'student']),
  payload: z.record(z.string(), z.any()),
  timestamp: z.number().positive(),
});

export const SaveWhiteboardSnapshotRequestContract = z.object({
  roomId: z.string().min(1),
  activePageIndex: z.number().int().nonnegative().default(0),
  pages: z.array(WhiteboardPageContract).min(1),
  permissions: WhiteboardPermissionsContract.optional(),
});

export const SaveWhiteboardSnapshotResponseContract = ApiResponseEnvelope(
  z.object({
    sessionId: z.string(),
    roomId: z.string(),
    savedPagesCount: z.number(),
    updatedAt: z.string(),
  })
);

/**
 * 2. Room Management Contracts
 */
export const CreateRoomRequestContract = z.object({
  title: z.string().min(1).max(120),
  teacherId: z.string().min(1),
  teacherName: z.string().min(1),
  type: z.enum(['instant', 'scheduled']).default('instant'),
  ttlMinutes: z.number().int().min(1).max(480).default(15),
  scheduledStart: z.string().datetime().optional(),
  idempotencyKey: z.string().uuid().optional(),
});

export const RoomParticipantContract = z.object({
  id: z.string(),
  roomId: z.string(),
  identity: z.string(),
  name: z.string(),
  role: z.enum(['teacher', 'student']),
  joinedAt: z.string(),
  isAudioMuted: z.boolean().default(false),
  isVideoMuted: z.boolean().default(false),
});

export const RoomDetailsContract = z.object({
  id: z.string(),
  title: z.string(),
  teacherId: z.string(),
  teacherName: z.string(),
  status: z.enum(['pending', 'active', 'expired', 'archived']),
  type: z.enum(['instant', 'scheduled']),
  ttlMinutes: z.number(),
  createdAt: z.string(),
  joinedAt: z.string().nullable().optional(),
  expiresAt: z.string().nullable().optional(),
  participantsCount: z.number().default(0),
});

export const CreateRoomResponseContract = ApiResponseEnvelope(RoomDetailsContract);

export const RecordRoomJoinRequestContract = z.object({
  identity: z.string().min(1),
  name: z.string().min(1),
  role: z.enum(['teacher', 'student']),
});

export const RecordRoomJoinResponseContract = ApiResponseEnvelope(
  z.object({
    room: RoomDetailsContract,
    participant: RoomParticipantContract,
    expiresAt: z.string().nullable(),
  })
);

/**
 * 3. Past Classes & Archival Contracts
 */
export const ArchiveClassRequestContract = z.object({
  roomId: z.string().min(1),
  title: z.string().min(1),
  durationSeconds: z.number().int().nonnegative(),
  teacherName: z.string().min(1),
  snapshot: z.object({
    pages: z.array(WhiteboardPageContract),
    activePageIndex: z.number().int().nonnegative().default(0),
  }),
});

export const PastClassItemContract = z.object({
  id: z.string(),
  roomId: z.string(),
  title: z.string(),
  date: z.string(),
  durationSeconds: z.number(),
  pageCount: z.number(),
  thumbnailUrl: z.string().optional(),
  storagePath: z.string().optional(),
  archivedAt: z.string(),
});

export const ListPastClassesResponseContract = ApiResponseEnvelope(
  z.object({
    classes: z.array(PastClassItemContract),
    totalCount: z.number(),
  })
);

export const GetPastClassWhiteboardResponseContract = ApiResponseEnvelope(
  z.object({
    classDetails: PastClassItemContract,
    snapshot: z.object({
      pages: z.array(WhiteboardPageContract),
      activePageIndex: z.number(),
    }),
  })
);

/**
 * 4. Booking Portal Contracts
 */
export const TeacherAvailabilitySlotContract = z.object({
  dayOfWeek: z.enum([
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
    'sunday',
  ]),
  startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time format (HH:MM)'),
  endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time format (HH:MM)'),
  timezone: z.string().default('Asia/Kolkata'),
  slotDurationMinutes: z.number().int().positive().default(45),
});

export const TeacherProfileContract = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  bio: z.string().optional(),
  subject: z.string().default('Punjabi'),
  timezone: z.string().default('Asia/Kolkata'),
  availability: z.array(TeacherAvailabilitySlotContract).default([]),
});

export const CreateBookingRequestContract = z.object({
  teacherId: z.string().min(1),
  studentName: z.string().min(2).max(100),
  studentEmail: z.string().email(),
  studentTimezone: z.string().min(1),
  scheduledStart: z.string().datetime(),
  scheduledEnd: z.string().datetime(),
  subject: z.string().min(1).default('Punjabi'),
  notes: z.string().max(500).optional(),
  idempotencyKey: z.string().uuid().optional(),
});

export const BookingRecordContract = z.object({
  id: z.string(),
  teacherId: z.string(),
  roomId: z.string(),
  studentName: z.string(),
  studentEmail: z.string(),
  scheduledStart: z.string(),
  scheduledEnd: z.string(),
  status: z.enum(['confirmed', 'cancelled', 'completed']),
  createdAt: z.string(),
});

export const CreateBookingResponseContract = ApiResponseEnvelope(BookingRecordContract);

/**
 * 5. Vercel Cron Sweeper Contracts
 */
export const RoomSweeperResultContract = z.object({
  sweptAt: z.string(),
  expiredRoomsCount: z.number(),
  archivedRoomsCount: z.number(),
  affectedRoomIds: z.array(z.string()),
  durationMs: z.number(),
});

export const RoomSweeperResponseContract = ApiResponseEnvelope(RoomSweeperResultContract);
