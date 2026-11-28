import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { cronSweeperService } from '@/server/services/cron-sweeper-service';
import { formatErrorEnvelope, HttpStatus } from '@/server/errors';
import { logger } from '@/server/logger';

/**
 * Validates the Vercel Cron invocation header against CRON_SECRET using timing-safe comparison.
 */
function verifyCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const envSecret = process.env.CRON_SECRET;
  const cronSecret =
    envSecret ||
    (process.env.NODE_ENV !== 'production' ? 'dev_cron_secret_injasraj' : '');

  if (!cronSecret || !authHeader || !authHeader.startsWith('Bearer ')) {
    return false;
  }

  const token = authHeader.replace('Bearer ', '').trim();

  try {
    const tokenBuffer = Buffer.from(token);
    const secretBuffer = Buffer.from(cronSecret);

    if (tokenBuffer.length !== secretBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(tokenBuffer, secretBuffer);
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  const requestId = `cron-${Date.now()}`;

  // 1. Authenticate Vercel Cron invocation
  if (!verifyCronSecret(request)) {
    logger.warn('Unauthorized cron invocation rejected', {}, requestId);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'UNAUTHORIZED_CRON',
          message: 'Invalid or missing CRON_SECRET in Authorization header',
        },
      },
      { status: HttpStatus.UNAUTHORIZED }
    );
  }

  try {
    // 2. Execute Room Sweeper via Service Layer
    const result = await cronSweeperService.sweepExpiredRooms(requestId);

    return NextResponse.json(
      {
        success: true,
        data: result,
        meta: {
          timestamp: new Date().toISOString(),
          requestId,
        },
      },
      { status: HttpStatus.OK }
    );
  } catch (error) {
    logger.error('Error during cron room sweep execution', { error }, requestId);
    return NextResponse.json(formatErrorEnvelope(error, requestId), {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
    });
  }
}

export async function POST(request: NextRequest) {
  // Allow manual triggered invocation via POST with the same authentication
  return GET(request);
}
