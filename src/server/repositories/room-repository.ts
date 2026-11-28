export interface RoomRecord {
  id: string;
  teacherId: string;
  teacherName: string;
  title: string;
  type: 'instant' | 'scheduled';
  status: 'pending' | 'active' | 'expired' | 'archived';
  ttlMinutes: number;
  idempotencyKey?: string;
  scheduledStart?: string;
  joinedAt?: string | null;
  expiresAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ParticipantRecord {
  id: string;
  roomId: string;
  identity: string;
  name: string;
  role: 'teacher' | 'student';
  joinedAt: string;
  leftAt?: string | null;
  isAudioMuted: boolean;
  isVideoMuted: boolean;
}

export class RoomRepository {
  private static roomsStore = new Map<string, RoomRecord>();
  private static participantsStore = new Map<string, ParticipantRecord[]>();
  private static idempotencyStore = new Map<string, RoomRecord>();

  public async findById(id: string): Promise<RoomRecord | null> {
    return RoomRepository.roomsStore.get(id) || null;
  }

  public async findByIdempotencyKey(key: string): Promise<RoomRecord | null> {
    return RoomRepository.idempotencyStore.get(key) || null;
  }

  public async create(room: RoomRecord): Promise<RoomRecord> {
    RoomRepository.roomsStore.set(room.id, room);
    if (room.idempotencyKey) {
      RoomRepository.idempotencyStore.set(room.idempotencyKey, room);
    }
    return room;
  }

  public async update(id: string, updates: Partial<RoomRecord>): Promise<RoomRecord | null> {
    const existing = RoomRepository.roomsStore.get(id);
    if (!existing) return null;
    const updated: RoomRecord = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    RoomRepository.roomsStore.set(id, updated);
    return updated;
  }

  public async findExpiredActiveRooms(now: Date = new Date()): Promise<RoomRecord[]> {
    const result: RoomRecord[] = [];
    for (const room of RoomRepository.roomsStore.values()) {
      if (room.status === 'active' && room.expiresAt) {
        if (new Date(room.expiresAt) <= now) {
          result.push(room);
        }
      }
    }
    return result;
  }

  public async listActiveRooms(): Promise<RoomRecord[]> {
    return Array.from(RoomRepository.roomsStore.values()).filter(
      (r) => r.status === 'active' || r.status === 'pending'
    );
  }

  public async addParticipant(participant: ParticipantRecord): Promise<ParticipantRecord> {
    const list = RoomRepository.participantsStore.get(participant.roomId) || [];
    const filtered = list.filter((p) => p.identity !== participant.identity);
    filtered.push(participant);
    RoomRepository.participantsStore.set(participant.roomId, filtered);
    return participant;
  }

  public async getParticipants(roomId: string): Promise<ParticipantRecord[]> {
    return RoomRepository.participantsStore.get(roomId) || [];
  }

  public async clearAll(): Promise<void> {
    RoomRepository.roomsStore.clear();
    RoomRepository.participantsStore.clear();
    RoomRepository.idempotencyStore.clear();
  }
}

export const roomRepository = new RoomRepository();
