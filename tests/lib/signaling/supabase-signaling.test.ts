import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  SupabaseSignalingAdapter,
  SignalingPayload,
} from '../../../src/lib/signaling/supabase-signaling';
import { P2PWebRTCMediaSession } from '../../../src/lib/webrtc/p2p-session';

describe('SupabaseSignalingAdapter', () => {
  let mockChannel: {
    send: any;
    on: any;
    subscribe: any;
    unsubscribe: any;
  };
  let mockClient: {
    channel: any;
    removeChannel: any;
  };
  let registeredListener: ((msg: any) => void) | null = null;
  let subscribeStatusCallback: ((status: string, err?: any) => void) | null = null;

  beforeEach(() => {
    registeredListener = null;
    subscribeStatusCallback = null;

    mockChannel = {
      send: vi.fn().mockResolvedValue('ok'),
      on: vi.fn((_type: string, _filter: any, cb: any) => {
        registeredListener = cb;
        return mockChannel;
      }),
      subscribe: vi.fn((cb: any) => {
        subscribeStatusCallback = cb;
        return mockChannel;
      }),
      unsubscribe: vi.fn().mockReturnValue(undefined),
    };

    mockClient = {
      channel: vi.fn().mockReturnValue(mockChannel),
      removeChannel: vi.fn().mockReturnValue(undefined),
    };
  });

  describe('Constructor & User ID Management', () => {
    it('initializes with custom userId when provided', () => {
      const adapter = new SupabaseSignalingAdapter(mockChannel, 'user-teacher-42');
      expect(adapter.getUserId()).toBe('user-teacher-42');
      expect(adapter.userId).toBe('user-teacher-42');
    });

    it('generates a random peer_ prefixed userId when none provided', () => {
      const adapter = new SupabaseSignalingAdapter(mockChannel);
      expect(adapter.getUserId()).toMatch(/^peer_[a-z0-9]+$/);
    });

    it('attaches directly to injected mock channel', () => {
      const adapter = new SupabaseSignalingAdapter(mockChannel, 'teacher-1');
      expect(adapter.getChannel()).toBe(mockChannel);
      expect(mockChannel.on).toHaveBeenCalledWith(
        'broadcast',
        { event: 'signaling' },
        expect.any(Function)
      );
    });

    it('stores client when mock client is passed', () => {
      const adapter = new SupabaseSignalingAdapter(mockClient, 'student-1');
      expect(adapter.client).toBe(mockClient);
    });

    it('defaults to creating browser client when no client or channel passed', () => {
      const adapter = new SupabaseSignalingAdapter();
      expect(adapter.client).toBeDefined();
      expect(adapter.getUserId()).toMatch(/^peer_[a-z0-9]+$/);
    });
  });

  describe('Room Connection & Subscription', () => {
    it('creates channel room:<roomId> with broadcast self: false', async () => {
      const adapter = new SupabaseSignalingAdapter(mockClient, 'teacher-1');
      await adapter.connect('lesson-99');

      expect(mockClient.channel).toHaveBeenCalledWith('room:lesson-99', {
        config: { broadcast: { self: false } },
      });
      expect(adapter.getRoomId()).toBe('lesson-99');
      expect(mockChannel.subscribe).toHaveBeenCalled();
    });

    it('updates userId when userId is provided in connect()', async () => {
      const adapter = new SupabaseSignalingAdapter(mockClient, 'temp-id');
      await adapter.connect('lesson-100', 'permanent-teacher-id');

      expect(adapter.getUserId()).toBe('permanent-teacher-id');
    });

    it('broadcasts peer-joined when channel successfully subscribes', async () => {
      const adapter = new SupabaseSignalingAdapter(mockClient, 'teacher-1');
      await adapter.connect('lesson-101');

      // Trigger SUBSCRIBED status
      expect(subscribeStatusCallback).toBeTruthy();
      subscribeStatusCallback!('SUBSCRIBED');

      expect(mockChannel.send).toHaveBeenCalledWith({
        type: 'broadcast',
        event: 'signaling',
        payload: {
          type: 'peer-joined',
          senderId: 'teacher-1',
        },
      });
    });

    it('resolves synchronously if subscribe calls callback synchronously', async () => {
      mockChannel.subscribe = vi.fn((cb) => {
        cb?.('SUBSCRIBED');
        return mockChannel;
      });

      const adapter = new SupabaseSignalingAdapter(mockClient, 'teacher-sync');
      await adapter.connect('lesson-sync');

      expect(mockChannel.send).toHaveBeenCalledWith({
        type: 'broadcast',
        event: 'signaling',
        payload: {
          type: 'peer-joined',
          senderId: 'teacher-sync',
        },
      });
    });
  });

  describe('Sending Signaling Messages', () => {
    it('broadcasts sdp-offer event through Supabase Realtime channel', async () => {
      const adapter = new SupabaseSignalingAdapter(mockChannel, 'user-teacher');
      const offer = { type: 'offer' as const, sdp: 'v=0\r\no=teacher 1234...' };

      await adapter.sendOffer(offer);

      expect(mockChannel.send).toHaveBeenCalledWith({
        type: 'broadcast',
        event: 'signaling',
        payload: {
          type: 'sdp-offer',
          senderId: 'user-teacher',
          sdp: offer,
        },
      });
    });

    it('broadcasts sdp-answer event through Supabase Realtime channel', async () => {
      const adapter = new SupabaseSignalingAdapter(mockChannel, 'user-student');
      const answer = { type: 'answer' as const, sdp: 'v=0\r\no=student 5678...' };

      await adapter.sendAnswer(answer);

      expect(mockChannel.send).toHaveBeenCalledWith({
        type: 'broadcast',
        event: 'signaling',
        payload: {
          type: 'sdp-answer',
          senderId: 'user-student',
          sdp: answer,
        },
      });
    });

    it('broadcasts ice-candidate event through Supabase Realtime channel', async () => {
      const adapter = new SupabaseSignalingAdapter(mockChannel, 'user-teacher');
      const candidate: RTCIceCandidateInit = {
        candidate: 'candidate:1 1 UDP 2130706431 192.168.1.100 50000 typ host',
        sdpMid: '0',
        sdpMLineIndex: 0,
      };

      await adapter.sendCandidate(candidate);

      expect(mockChannel.send).toHaveBeenCalledWith({
        type: 'broadcast',
        event: 'signaling',
        payload: {
          type: 'ice-candidate',
          senderId: 'user-teacher',
          candidate,
        },
      });
    });

    it('throws descriptive error if sending before connecting or without channel', async () => {
      const adapter = new SupabaseSignalingAdapter(mockClient, 'user-teacher');
      // Did not call connect() so channel is undefined

      await expect(
        adapter.sendOffer({ type: 'offer', sdp: 'v=0' })
      ).rejects.toThrow(/Signaling channel is not available/);

      await expect(
        adapter.sendAnswer({ type: 'answer', sdp: 'v=0' })
      ).rejects.toThrow(/Signaling channel is not available/);

      await expect(
        adapter.sendCandidate({ candidate: 'c=...' })
      ).rejects.toThrow(/Signaling channel is not available/);
    });
  });

  describe('Incoming Signaling Event Routing', () => {
    let adapter: SupabaseSignalingAdapter;

    beforeEach(() => {
      adapter = new SupabaseSignalingAdapter(mockChannel, 'local-user');
    });

    it('routes incoming sdp-offer to registered onOffer listeners', () => {
      const offerCb = vi.fn();
      adapter.onOffer(offerCb);

      const remoteOffer = { type: 'offer' as const, sdp: 'v=0\r\no=remote...' };
      registeredListener!({
        payload: {
          type: 'sdp-offer',
          senderId: 'remote-user',
          sdp: remoteOffer,
        },
      });

      expect(offerCb).toHaveBeenCalledWith(remoteOffer, 'remote-user');
    });

    it('routes incoming sdp-answer to registered onAnswer listeners', () => {
      const answerCb = vi.fn();
      adapter.onAnswer(answerCb);

      const remoteAnswer = { type: 'answer' as const, sdp: 'v=0\r\no=remote...' };
      registeredListener!({
        payload: {
          type: 'sdp-answer',
          senderId: 'remote-user',
          sdp: remoteAnswer,
        },
      });

      expect(answerCb).toHaveBeenCalledWith(remoteAnswer, 'remote-user');
    });

    it('routes incoming ice-candidate to registered onCandidate listeners', () => {
      const candidateCb = vi.fn();
      adapter.onCandidate(candidateCb);

      const remoteCandidate = { candidate: 'candidate:foo' };
      registeredListener!({
        payload: {
          type: 'ice-candidate',
          senderId: 'remote-user',
          candidate: remoteCandidate,
        },
      });

      expect(candidateCb).toHaveBeenCalledWith(remoteCandidate, 'remote-user');
    });

    it('routes incoming peer-joined to registered onPeerJoined listeners', () => {
      const peerJoinedCb = vi.fn();
      adapter.onPeerJoined(peerJoinedCb);

      registeredListener!({
        payload: {
          type: 'peer-joined',
          senderId: 'peer-alice',
        },
      });

      expect(peerJoinedCb).toHaveBeenCalledWith('peer-alice');
    });

    it('routes incoming peer-left to registered onPeerLeft listeners', () => {
      const peerLeftCb = vi.fn();
      adapter.onPeerLeft(peerLeftCb);

      registeredListener!({
        payload: {
          type: 'peer-left',
          senderId: 'peer-bob',
        },
      });

      expect(peerLeftCb).toHaveBeenCalledWith('peer-bob');
    });

    it('filters out self-originated messages', () => {
      const offerCb = vi.fn();
      const peerJoinedCb = vi.fn();
      adapter.onOffer(offerCb);
      adapter.onPeerJoined(peerJoinedCb);

      // Sent by local-user itself
      registeredListener!({
        payload: {
          type: 'sdp-offer',
          senderId: 'local-user',
          sdp: { type: 'offer', sdp: 'echo' },
        },
      });
      registeredListener!({
        payload: {
          type: 'peer-joined',
          senderId: 'local-user',
        },
      });

      expect(offerCb).not.toHaveBeenCalled();
      expect(peerJoinedCb).not.toHaveBeenCalled();
    });

    it('handles direct unnested payload objects', () => {
      const peerJoinedCb = vi.fn();
      adapter.onPeerJoined(peerJoinedCb);

      registeredListener!({
        type: 'peer-joined',
        senderId: 'peer-charlie',
      });

      expect(peerJoinedCb).toHaveBeenCalledWith('peer-charlie');
    });

    it('supports fallback data.payload when sdp or candidate is mapped as payload', () => {
      const offerCb = vi.fn();
      const candidateCb = vi.fn();
      adapter.onOffer(offerCb);
      adapter.onCandidate(candidateCb);

      const sdpData = { type: 'offer' as const, sdp: 'nested-sdp' };
      registeredListener!({
        payload: {
          type: 'sdp-offer',
          senderId: 'peer-nested',
          payload: sdpData,
        },
      });
      expect(offerCb).toHaveBeenCalledWith(sdpData, 'peer-nested');

      const candData = { candidate: 'nested-cand' };
      registeredListener!({
        payload: {
          type: 'ice-candidate',
          senderId: 'peer-nested',
          payload: candData,
        },
      });
      expect(candidateCb).toHaveBeenCalledWith(candData, 'peer-nested');
    });

    it('safely handles non-object messages or missing fields', () => {
      const offerCb = vi.fn();
      adapter.onOffer(offerCb);

      expect(() => {
        registeredListener!(null);
        registeredListener!(undefined);
        registeredListener!('string-message');
        registeredListener!({ type: 'unknown-event' });
      }).not.toThrow();

      expect(offerCb).not.toHaveBeenCalled();
    });

    it('catches listener errors without halting subsequent callbacks', () => {
      const badCb = vi.fn().mockImplementation(() => {
        throw new Error('Callback boom');
      });
      const goodCb = vi.fn();

      adapter.onPeerJoined(badCb);
      adapter.onPeerJoined(goodCb);

      registeredListener!({
        payload: {
          type: 'peer-joined',
          senderId: 'peer-david',
        },
      });

      expect(badCb).toHaveBeenCalledWith('peer-david');
      expect(goodCb).toHaveBeenCalledWith('peer-david');
    });
  });

  describe('Disconnect & Teardown', () => {
    it('broadcasts peer-left and unsubscribes channel', async () => {
      const adapter = new SupabaseSignalingAdapter(mockClient, 'user-leaving');
      await adapter.connect('room-exit');

      adapter.disconnect();

      expect(mockChannel.send).toHaveBeenCalledWith({
        type: 'broadcast',
        event: 'signaling',
        payload: {
          type: 'peer-left',
          senderId: 'user-leaving',
        },
      });
      expect(mockChannel.unsubscribe).toHaveBeenCalled();
      expect(mockClient.removeChannel).toHaveBeenCalledWith(mockChannel);
      expect(adapter.getChannel()).toBeNull();
    });

    it('is safe to call disconnect multiple times or when not connected', () => {
      const adapter = new SupabaseSignalingAdapter(mockClient, 'user-safe');
      expect(() => {
        adapter.disconnect();
        adapter.disconnect();
      }).not.toThrow();
    });
  });

  describe('Integration with P2PWebRTCMediaSession', () => {
    it('can be passed as ISignalingAdapter to P2PWebRTCMediaSession', async () => {
      const adapter = new SupabaseSignalingAdapter(mockChannel, 'user-teacher');
      const session = new P2PWebRTCMediaSession(adapter);

      expect(session).toBeDefined();
      expect(typeof session.connect).toBe('function');
      expect(typeof session.disconnect).toBe('function');
    });
  });
});
