import { ConnectionQuality, CandidateType } from '../../types/media';

export interface StatsSnapshot {
  timestamp: number;
  bytesReceived: number;
  packetsReceived: number;
  packetsLost: number;
}

export function parseRTCStats(
  report: RTCStatsReport | Map<string, any>,
  prevSnapshot?: StatsSnapshot
): { quality: ConnectionQuality; nextSnapshot: StatsSnapshot } {
  const allStats: any[] = [];
  const statsById = new Map<string, any>();

  if (report && typeof (report as any).forEach === 'function') {
    (report as any).forEach((value: any, key: any) => {
      if (value && typeof value === 'object') {
        allStats.push(value);
        if (value.id) {
          statsById.set(value.id, value);
        } else if (key) {
          statsById.set(String(key), value);
        }
      }
    });
  } else if (report && typeof (report as any)[Symbol.iterator] === 'function') {
    for (const item of (report as any)) {
      if (Array.isArray(item) && item.length === 2) {
        const [key, value] = item;
        if (value && typeof value === 'object') {
          allStats.push(value);
          if (value.id) {
            statsById.set(value.id, value);
          } else if (key) {
            statsById.set(String(key), value);
          }
        }
      } else if (item && typeof item === 'object') {
        allStats.push(item);
        if (item.id) {
          statsById.set(item.id, item);
        }
      }
    }
  }

  function getStat(id: string | undefined): any {
    if (!id) return undefined;
    if (typeof (report as any).get === 'function') {
      const val = (report as any).get(id);
      if (val) return val;
    }
    return statsById.get(id);
  }

  function extractCandidateType(candidate: any): string | undefined {
    if (!candidate) return undefined;
    if (typeof candidate.candidateType === 'string') {
      return candidate.candidateType.toLowerCase();
    }
    if (
      typeof candidate.type === 'string' &&
      ['host', 'srflx', 'prflx', 'relay'].includes(candidate.type.toLowerCase())
    ) {
      return candidate.type.toLowerCase();
    }
    return undefined;
  }

  // 1. Find active candidate-pair
  let activePair: any = null;
  let failedPair: any = null;

  for (const stat of allStats) {
    if (!stat || stat.type !== 'candidate-pair') continue;

    if (stat.state === 'failed') {
      failedPair = stat;
    }

    const isNominated = stat.nominated === true;
    const isSucceeded = stat.state === 'succeeded';
    const isSelected = stat.selected === true;

    if (isSelected || (isNominated && isSucceeded)) {
      activePair = stat;
      break;
    } else if (isNominated || isSucceeded) {
      if (!activePair) {
        activePair = stat;
      }
    }
  }

  // Determine connection type and RTT
  let connectionType: CandidateType = 'unknown';
  let rttMs = 0;

  if (activePair) {
    const localCandidate =
      getStat(activePair.localCandidateId) || activePair.localCandidate;
    const remoteCandidate =
      getStat(activePair.remoteCandidateId) || activePair.remoteCandidate;

    const localType =
      extractCandidateType(localCandidate) ||
      (typeof activePair.localCandidateType === 'string'
        ? activePair.localCandidateType.toLowerCase()
        : undefined);
    const remoteType =
      extractCandidateType(remoteCandidate) ||
      (typeof activePair.remoteCandidateType === 'string'
        ? activePair.remoteCandidateType.toLowerCase()
        : undefined);

    if (localType === 'relay' || remoteType === 'relay') {
      connectionType = 'relay';
    } else if (
      localType === 'host' ||
      localType === 'srflx' ||
      localType === 'prflx' ||
      remoteType === 'host' ||
      remoteType === 'srflx' ||
      remoteType === 'prflx'
    ) {
      connectionType = 'direct';
    } else if (localType || remoteType) {
      connectionType = (localType || remoteType) as CandidateType;
    }

    const rttSec =
      typeof activePair.currentRoundTripTime === 'number'
        ? activePair.currentRoundTripTime
        : typeof activePair.roundTripTime === 'number'
          ? activePair.roundTripTime
          : 0;
    rttMs = Math.max(0, Math.round(rttSec * 1000));
  } else if (failedPair) {
    connectionType = 'failed';
  }

  // 2. Inbound Video / Audio stats
  let videoResolution: { width: number; height: number } | undefined = undefined;
  let fps: number | undefined = undefined;
  let packetsLost = 0;
  let packetsReceived = 0;
  let bytesReceived = 0;

  for (const stat of allStats) {
    if (!stat || stat.type !== 'inbound-rtp') continue;

    const isVideo =
      stat.kind === 'video' ||
      stat.mediaType === 'video' ||
      typeof stat.frameWidth === 'number';

    if (isVideo) {
      if (typeof stat.frameWidth === 'number' && typeof stat.frameHeight === 'number') {
        videoResolution = {
          width: stat.frameWidth,
          height: stat.frameHeight,
        };
      }
      if (typeof stat.framesPerSecond === 'number') {
        fps = Math.round(stat.framesPerSecond * 100) / 100;
      }
    }

    if (typeof stat.packetsLost === 'number') {
      packetsLost += stat.packetsLost;
    }
    if (typeof stat.packetsReceived === 'number') {
      packetsReceived += stat.packetsReceived;
    }
    if (typeof stat.bytesReceived === 'number') {
      bytesReceived += stat.bytesReceived;
    }
  }

  // 3. Compute packet loss percentage
  let packetLossPercent = 0;

  if (prevSnapshot) {
    const deltaLost = Math.max(0, packetsLost - prevSnapshot.packetsLost);
    const deltaRecv = Math.max(0, packetsReceived - prevSnapshot.packetsReceived);
    const deltaTotal = deltaLost + deltaRecv;

    if (deltaTotal > 0) {
      packetLossPercent = Math.round(((deltaLost / deltaTotal) * 100) * 100) / 100;
    } else {
      packetLossPercent = 0;
    }
  } else {
    const total = packetsLost + packetsReceived;
    if (total > 0) {
      packetLossPercent = Math.round(((packetsLost / total) * 100) * 100) / 100;
    } else {
      packetLossPercent = 0;
    }
  }

  // 4. Status & Audio-Priority rules
  const isAudioPrioritized =
    connectionType === 'relay' || packetLossPercent > 10 || rttMs > 600;

  let status: ConnectionQuality['status'];

  if (!activePair && connectionType !== 'failed') {
    status = 'connecting';
  } else if (connectionType === 'failed' || packetLossPercent > 5 || rttMs > 350) {
    status = 'poor';
  } else if (connectionType === 'relay' || packetLossPercent > 1 || rttMs > 150) {
    status = 'fair';
  } else if (connectionType === 'direct' && rttMs <= 150 && packetLossPercent <= 1) {
    status = 'good';
  } else {
    status = 'fair';
  }

  const quality: ConnectionQuality = {
    status,
    rttMs,
    packetLossPercent,
    connectionType,
    isAudioPrioritized,
    ...(videoResolution ? { videoResolution } : {}),
    ...(fps !== undefined ? { fps } : {}),
  };

  const nextSnapshot: StatsSnapshot = {
    timestamp: Date.now(),
    bytesReceived,
    packetsReceived,
    packetsLost,
  };

  return { quality, nextSnapshot };
}
