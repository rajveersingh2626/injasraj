import { NextRequest, NextResponse } from 'next/server';
import { AccessToken } from 'livekit-server-sdk';

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
      room: room.trim(),
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
      room: room.trim(),
    });
  } catch (error: any) {
    console.error('Error generating LiveKit token:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to generate LiveKit token' },
      { status: 500 }
    );
  }
}
