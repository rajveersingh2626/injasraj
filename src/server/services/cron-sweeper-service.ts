import { roomRepository } from '@/server/repositories/room-repository';
import { logger } from '@/server/logger';

export interface SweepResult {
  sweptAt: string;
  expiredRoomsCount: number;
  archivedRoomsCount: number;
  affectedRoomIds: string[];
  durationMs: number;
}

export class CronSweeperService {
  public async sweepExpiredRooms(requestId?: string): Promise<SweepResult> {
    const startTime = performance.now();
    const now = new Date();
    const expiredRooms = await roomRepository.findExpiredActiveRooms(now);

    const affectedRoomIds: string[] = [];

    for (const room of expiredRooms) {
      // Transition from active to archived (safe non-destructive archival)
      await roomRepository.update(room.id, {
        status: 'archived',
      });
      affectedRoomIds.push(room.id);
      logger.info(`Cron Sweeper archived expired room: ${room.id}`, { roomId: room.id, expiresAt: room.expiresAt }, requestId);
    }

    const durationMs = Math.round(performance.now() - startTime);

    const result: SweepResult = {
      sweptAt: now.toISOString(),
      expiredRoomsCount: expiredRooms.length,
      archivedRoomsCount: affectedRoomIds.length,
      affectedRoomIds,
      durationMs,
    };

    logger.info(`Cron Sweeper completed sweep run`, { count: result.archivedRoomsCount, durationMs }, requestId);
    return result;
  }
}

export const cronSweeperService = new CronSweeperService();
