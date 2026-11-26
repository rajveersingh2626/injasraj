import { NextRequest, NextResponse } from 'next/server';
import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const room = searchParams.get('room');
    const username = searchParams.get('username');
    const userId = searchParams.get('userId');
    const role = searchParams.get('role') || 'student';

    if (!room || !room.trim()) {
      return NextResponse.json({ error: 'Room parameter is required' }, { status: 400 });
    }

    if (!username || !username.trim()) {
      return NextResponse.json({ error: 'Username parameter is required' }, { status: 400 });
    }

    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const wsUrl = process.env.LIVEKIT_URL || process.env.NEXT_PUBLIC_LIVEKIT_URL || '';

    if (!apiKey || !apiSecret) {
      return NextResponse.json(
        { error: 'LiveKit API key or secret not configured on server' },
        { status: 500 }
      );
    }

    const trimmedRoom = room.trim();
    const httpUrl = wsUrl.replace('wss://', 'https://').replace('ws://', 'http://');

    // Automatically configure/ensure room lifecycle with 15-minute (900s) timeout on abandonment
    if (httpUrl && httpUrl.startsWith('http')) {
      try {
        const roomService = new RoomServiceClient(httpUrl, apiKey, apiSecret);
        await roomService.createRoom({
          name: trimmedRoom,
          emptyTimeout: 900,      // 15 minutes = 900 seconds
          departureTimeout: 900,  // 15 minutes = 900 seconds
          maxParticipants: 10,
        });
      } catch (roomErr: any) {
        // Room already exists or non-fatal room creation notice
      }
    }

    const participantIdentity =
      userId && userId.trim()
        ? userId.trim()
        : `${username.trim()}__${Math.random().toString(36).substring(2, 7)}`;

    const at = new AccessToken(apiKey, apiSecret, {
      identity: participantIdentity,
      name: username.trim(),
    });

    const isTeacher = role.toLowerCase() === 'teacher';

    at.addGrant({
      room: trimmedRoom,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
      roomAdmin: isTeacher,
    });

    const token = await at.toJwt();

    return NextResponse.json({
      token,
      url: wsUrl,
      identity: username.trim(),
      room: trimmedRoom,
    });
  } catch (error: any) {
    console.error('Error generating LiveKit token:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to generate LiveKit token' },
      { status: 500 }
    );
  }
}
