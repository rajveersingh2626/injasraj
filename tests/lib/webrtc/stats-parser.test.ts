import { describe, it, expect } from 'vitest';
import { parseRTCStats, StatsSnapshot } from '../../../src/lib/webrtc/stats-parser';

describe('WebRTC Stats Parser & Telemetry', () => {
  describe('Direct P2P Detection', () => {
    it('detects direct host-to-host candidate pairs and marks good quality', () => {
      const report = new Map<string, any>();

      report.set('pair-1', {
        id: 'pair-1',
        type: 'candidate-pair',
        state: 'succeeded',
        nominated: true,
        currentRoundTripTime: 0.045, // 45ms
        localCandidateId: 'local-cand-1',
        remoteCandidateId: 'remote-cand-1',
      });

      report.set('local-cand-1', {
        id: 'local-cand-1',
        type: 'local-candidate',
        candidateType: 'host',
      });

      report.set('remote-cand-1', {
        id: 'remote-cand-1',
        type: 'remote-candidate',
        candidateType: 'host',
      });

      report.set('inbound-video', {
        id: 'inbound-video',
        type: 'inbound-rtp',
        kind: 'video',
        packetsLost: 0,
        packetsReceived: 100,
        bytesReceived: 50000,
        frameWidth: 1280,
        frameHeight: 720,
        framesPerSecond: 30,
      });

      const { quality, nextSnapshot } = parseRTCStats(report);

      expect(quality.connectionType).toBe('direct');
      expect(quality.rttMs).toBe(45);
      expect(quality.packetLossPercent).toBe(0);
      expect(quality.isAudioPrioritized).toBe(false);
      expect(quality.status).toBe('good');
      expect(quality.videoResolution).toEqual({ width: 1280, height: 720 });
      expect(quality.fps).toBe(30);

      expect(nextSnapshot.packetsReceived).toBe(100);
      expect(nextSnapshot.packetsLost).toBe(0);
      expect(nextSnapshot.bytesReceived).toBe(50000);
    });

    it('detects direct connection when srflx candidate is used', () => {
      const report = new Map<string, any>();

      report.set('pair-active', {
        id: 'pair-active',
        type: 'candidate-pair',
        state: 'succeeded',
        nominated: true,
        currentRoundTripTime: 0.08,
        localCandidateId: 'loc-srflx',
        remoteCandidateId: 'rem-host',
      });

      report.set('loc-srflx', {
        id: 'loc-srflx',
        type: 'local-candidate',
        candidateType: 'srflx',
      });

      report.set('rem-host', {
        id: 'rem-host',
        type: 'remote-candidate',
        candidateType: 'host',
      });

      const { quality } = parseRTCStats(report);

      expect(quality.connectionType).toBe('direct');
      expect(quality.rttMs).toBe(80);
      expect(quality.isAudioPrioritized).toBe(false);
      expect(quality.status).toBe('good');
    });
  });

  describe('Relay Detection & Audio Prioritization', () => {
    it('detects TURN relay candidate and automatically prioritizes audio', () => {
      const report = new Map<string, any>();

      report.set('pair-turn', {
        id: 'pair-turn',
        type: 'candidate-pair',
        state: 'succeeded',
        nominated: true,
        currentRoundTripTime: 0.05, // 50ms
        localCandidateId: 'loc-turn',
        remoteCandidateId: 'rem-host',
      });

      report.set('loc-turn', {
        id: 'loc-turn',
        type: 'local-candidate',
        candidateType: 'relay',
      });

      report.set('rem-host', {
        id: 'rem-host',
        type: 'remote-candidate',
        candidateType: 'host',
      });

      const { quality } = parseRTCStats(report);

      expect(quality.connectionType).toBe('relay');
      expect(quality.isAudioPrioritized).toBe(true);
      // Status is 'fair' when relayed, even with low RTT and 0 loss
      expect(quality.status).toBe('fair');
    });

    it('detects remote relay candidate and sets relay connectionType', () => {
      const report = new Map<string, any>();

      report.set('pair-remote-turn', {
        id: 'pair-remote-turn',
        type: 'candidate-pair',
        state: 'succeeded',
        nominated: true,
        currentRoundTripTime: 0.06,
        localCandidateId: 'loc-host',
        remoteCandidateId: 'rem-turn',
      });

      report.set('loc-host', {
        id: 'loc-host',
        type: 'local-candidate',
        candidateType: 'host',
      });

      report.set('rem-turn', {
        id: 'rem-turn',
        type: 'remote-candidate',
        candidateType: 'relay',
      });

      const { quality } = parseRTCStats(report);

      expect(quality.connectionType).toBe('relay');
      expect(quality.isAudioPrioritized).toBe(true);
      expect(quality.status).toBe('fair');
    });
  });

  describe('RTT Calculation & Thresholds', () => {
    it('accurately converts seconds to rounded milliseconds', () => {
      const report = new Map<string, any>();

      report.set('pair-rtt', {
        type: 'candidate-pair',
        state: 'succeeded',
        nominated: true,
        currentRoundTripTime: 0.1236,
        localCandidateId: 'loc',
        remoteCandidateId: 'rem',
      });

      report.set('loc', { candidateType: 'host' });
      report.set('rem', { candidateType: 'host' });

      const { quality } = parseRTCStats(report);
      expect(quality.rttMs).toBe(124);
      expect(quality.status).toBe('good');
    });

    it('triggers status poor when RTT exceeds 350ms', () => {
      const report = new Map<string, any>();

      report.set('pair-high-rtt', {
        type: 'candidate-pair',
        state: 'succeeded',
        nominated: true,
        currentRoundTripTime: 0.42, // 420ms
        localCandidateId: 'loc',
        remoteCandidateId: 'rem',
      });

      report.set('loc', { candidateType: 'host' });
      report.set('rem', { candidateType: 'host' });

      const { quality } = parseRTCStats(report);
      expect(quality.rttMs).toBe(420);
      expect(quality.status).toBe('poor');
      expect(quality.isAudioPrioritized).toBe(false); // <= 600ms
    });

    it('triggers isAudioPrioritized when RTT exceeds 600ms', () => {
      const report = new Map<string, any>();

      report.set('pair-extreme-rtt', {
        type: 'candidate-pair',
        state: 'succeeded',
        nominated: true,
        currentRoundTripTime: 0.65, // 650ms
        localCandidateId: 'loc',
        remoteCandidateId: 'rem',
      });

      report.set('loc', { candidateType: 'host' });
      report.set('rem', { candidateType: 'host' });

      const { quality } = parseRTCStats(report);
      expect(quality.rttMs).toBe(650);
      expect(quality.status).toBe('poor');
      expect(quality.isAudioPrioritized).toBe(true);
    });
  });

  describe('Packet Loss Calculation Across Sequential Snapshots', () => {
    it('calculates cumulative packet loss when no prevSnapshot is provided', () => {
      const report = new Map<string, any>();

      report.set('pair-1', {
        type: 'candidate-pair',
        state: 'succeeded',
        nominated: true,
        currentRoundTripTime: 0.05,
        localCandidateId: 'loc',
        remoteCandidateId: 'rem',
      });
      report.set('loc', { candidateType: 'host' });
      report.set('rem', { candidateType: 'host' });

      report.set('inbound-video', {
        type: 'inbound-rtp',
        kind: 'video',
        packetsLost: 5,
        packetsReceived: 95,
        bytesReceived: 20000,
      });

      const { quality, nextSnapshot } = parseRTCStats(report);

      // 5 / (5 + 95) = 5%
      expect(quality.packetLossPercent).toBe(5);
      expect(quality.status).toBe('fair'); // > 1% and <= 5%
      expect(quality.isAudioPrioritized).toBe(false);

      expect(nextSnapshot.packetsLost).toBe(5);
      expect(nextSnapshot.packetsReceived).toBe(95);
    });

    it('computes delta packet loss accurately over sequential intervals', () => {
      const report1 = new Map<string, any>();
      report1.set('pair-1', {
        type: 'candidate-pair',
        state: 'succeeded',
        nominated: true,
        currentRoundTripTime: 0.05,
        localCandidateId: 'loc',
        remoteCandidateId: 'rem',
      });
      report1.set('loc', { candidateType: 'host' });
      report1.set('rem', { candidateType: 'host' });
      report1.set('inbound-rtp-audio', {
        type: 'inbound-rtp',
        kind: 'audio',
        packetsLost: 2,
        packetsReceived: 98,
        bytesReceived: 10000,
      });

      // Interval 1: initial snapshot
      const res1 = parseRTCStats(report1);
      expect(res1.quality.packetLossPercent).toBe(2);
      expect(res1.quality.status).toBe('fair');

      // Interval 2: 50 new packets received, 0 new packets lost
      const report2 = new Map<string, any>();
      report2.set('pair-1', {
        type: 'candidate-pair',
        state: 'succeeded',
        nominated: true,
        currentRoundTripTime: 0.05,
        localCandidateId: 'loc',
        remoteCandidateId: 'rem',
      });
      report2.set('loc', { candidateType: 'host' });
      report2.set('rem', { candidateType: 'host' });
      report2.set('inbound-rtp-audio', {
        type: 'inbound-rtp',
        kind: 'audio',
        packetsLost: 2, // delta lost = 0
        packetsReceived: 148, // delta recv = 50
        bytesReceived: 15000,
      });

      const res2 = parseRTCStats(report2, res1.nextSnapshot);
      // Delta loss = 0 / 50 = 0%
      expect(res2.quality.packetLossPercent).toBe(0);
      expect(res2.quality.status).toBe('good');
      expect(res2.quality.isAudioPrioritized).toBe(false);

      // Interval 3: Network degradation with 15% delta loss
      const report3 = new Map<string, any>();
      report3.set('pair-1', {
        type: 'candidate-pair',
        state: 'succeeded',
        nominated: true,
        currentRoundTripTime: 0.05,
        localCandidateId: 'loc',
        remoteCandidateId: 'rem',
      });
      report3.set('loc', { candidateType: 'host' });
      report3.set('rem', { candidateType: 'host' });
      report3.set('inbound-rtp-audio', {
        type: 'inbound-rtp',
        kind: 'audio',
        packetsLost: 17, // delta lost = 15
        packetsReceived: 233, // delta recv = 85 (total delta = 100)
        bytesReceived: 22000,
      });

      const res3 = parseRTCStats(report3, res2.nextSnapshot);
      // Delta loss = 15 / 100 = 15%
      expect(res3.quality.packetLossPercent).toBe(15);
      expect(res3.quality.status).toBe('poor'); // > 5%
      expect(res3.quality.isAudioPrioritized).toBe(true); // > 10%
    });

    it('aggregates audio and video packets and bytes across streams', () => {
      const report = new Map<string, any>();
      report.set('pair-1', {
        type: 'candidate-pair',
        state: 'succeeded',
        nominated: true,
        currentRoundTripTime: 0.04,
        localCandidateId: 'loc',
        remoteCandidateId: 'rem',
      });
      report.set('loc', { candidateType: 'host' });
      report.set('rem', { candidateType: 'host' });

      report.set('audio-stream', {
        type: 'inbound-rtp',
        kind: 'audio',
        packetsLost: 1,
        packetsReceived: 100,
        bytesReceived: 12000,
      });

      report.set('video-stream', {
        type: 'inbound-rtp',
        kind: 'video',
        packetsLost: 3,
        packetsReceived: 300,
        bytesReceived: 80000,
      });

      const prevSnapshot: StatsSnapshot = {
        timestamp: Date.now() - 2000,
        packetsLost: 0,
        packetsReceived: 0,
        bytesReceived: 0,
      };

      const { quality, nextSnapshot } = parseRTCStats(report, prevSnapshot);

      expect(nextSnapshot.packetsLost).toBe(4); // 1 + 3
      expect(nextSnapshot.packetsReceived).toBe(400); // 100 + 300
      expect(nextSnapshot.bytesReceived).toBe(92000); // 12000 + 80000
      // 4 / 404 = ~0.99%
      expect(quality.packetLossPercent).toBe(0.99);
      expect(quality.status).toBe('good');
    });
  });

  describe('Edge Cases & State Handling', () => {
    it('returns connecting state when no active candidate pair exists', () => {
      const report = new Map<string, any>();

      report.set('pair-waiting', {
        type: 'candidate-pair',
        state: 'waiting',
        nominated: false,
      });

      const { quality } = parseRTCStats(report);

      expect(quality.status).toBe('connecting');
      expect(quality.connectionType).toBe('unknown');
      expect(quality.rttMs).toBe(0);
      expect(quality.packetLossPercent).toBe(0);
      expect(quality.isAudioPrioritized).toBe(false);
    });

    it('returns poor status when candidate pair has failed state', () => {
      const report = new Map<string, any>();

      report.set('pair-failed', {
        type: 'candidate-pair',
        state: 'failed',
        nominated: false,
      });

      const { quality } = parseRTCStats(report);

      expect(quality.connectionType).toBe('failed');
      expect(quality.status).toBe('poor');
    });

    it('handles zero packet activity gracefully without NaN', () => {
      const report = new Map<string, any>();
      report.set('pair-1', {
        type: 'candidate-pair',
        state: 'succeeded',
        nominated: true,
        currentRoundTripTime: 0.05,
        localCandidateId: 'loc',
        remoteCandidateId: 'rem',
      });
      report.set('loc', { candidateType: 'host' });
      report.set('rem', { candidateType: 'host' });

      report.set('inbound-video', {
        type: 'inbound-rtp',
        kind: 'video',
        packetsLost: 0,
        packetsReceived: 0,
        bytesReceived: 0,
      });

      const prevSnapshot: StatsSnapshot = {
        timestamp: Date.now() - 2000,
        packetsLost: 0,
        packetsReceived: 0,
        bytesReceived: 0,
      };

      const { quality } = parseRTCStats(report, prevSnapshot);
      expect(quality.packetLossPercent).toBe(0);
      expect(isNaN(quality.packetLossPercent)).toBe(false);
      expect(quality.status).toBe('good');
    });

    it('works with native RTCStatsReport mock (forEach iteration)', () => {
      const mockReport = {
        _data: new Map<string, any>(),
        get(id: string) {
          return this._data.get(id);
        },
        forEach(callback: (value: any, key: string) => void) {
          this._data.forEach(callback);
        },
      };

      mockReport._data.set('pair-1', {
        type: 'candidate-pair',
        state: 'succeeded',
        nominated: true,
        currentRoundTripTime: 0.03,
        localCandidateId: 'loc',
        remoteCandidateId: 'rem',
      });
      mockReport._data.set('loc', { candidateType: 'host' });
      mockReport._data.set('rem', { candidateType: 'host' });

      const { quality } = parseRTCStats(mockReport as any);
      expect(quality.connectionType).toBe('direct');
      expect(quality.rttMs).toBe(30);
      expect(quality.status).toBe('good');
    });
  });
});
