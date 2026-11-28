import { NextRequest, NextResponse } from 'next/server';
import { roomService } from '@/server/services/room-service';
import { formatErrorEnvelope, AppError, HttpStatus } from '@/server/errors';
import { CreateRoomRequestContract } from '@/contracts/classroom-contracts';
import { roomRepository } from '@/server/repositories/room-repository';

export async function POST(request: NextRequest) {
  const requestId = `req-${Date.now()}`;
  try {
    const body = await request.json();
    const parsed = CreateRoomRequestContract.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid room creation request parameters',
            details: parsed.error.format(),
          },
        },
        { status: HttpStatus.BAD_REQUEST }
      );
    }

    const room = await roomService.createRoom(parsed.data, requestId);

    return NextResponse.json(
      {
        success: true,
        data: room,
        meta: {
          timestamp: new Date().toISOString(),
          requestId,
        },
      },
      { status: HttpStatus.CREATED }
    );
  } catch (error) {
    const statusCode = error instanceof AppError ? error.statusCode : HttpStatus.INTERNAL_SERVER_ERROR;
    return NextResponse.json(formatErrorEnvelope(error, requestId), { status: statusCode });
  }
}

export async function GET() {
  const rooms = await roomService.listActiveRooms();
  return NextResponse.json({
    success: true,
    data: {
      rooms,
      totalCount: rooms.length,
    },
    meta: {
      timestamp: new Date().toISOString(),
    },
  });
}
