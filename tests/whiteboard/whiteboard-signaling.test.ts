import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  WhiteboardRealtimeAdapter,
  getWhiteboardChannelName,
  createWhiteboardChannel,
  WHITEBOARD_BROADCAST_EVENT,
} from '../../src/lib/whiteboard/whiteboard-signaling';
import {
  LaserPoint,
  WhiteboardPermissions,
  WhiteboardDeltaMessage,
  defaultWhiteboardPermissions,
} from '../../src/types/whiteboard';

interface MockRealtimeChannel {
  send: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
  subscribe: ReturnType<typeof vi.fn>;
  unsubscribe: ReturnType<typeof vi.fn>;
  triggerBroadcast?: (envelope: any) => void;
}

function createMockChannel(): MockRealtimeChannel {
  let broadcastCallback: ((envelope: any) => void) | null = null;

  const mock: MockRealtimeChannel = {
    send: vi.fn().mockResolvedValue('ok'),
    on: vi.fn((type: string, filter: any, callback: (envelope: any) => void) => {
      if (type === 'broadcast' && filter?.event === WHITEBOARD_BROADCAST_EVENT) {
        broadcastCallback = callback;
      }
      return mock;
    }),
    subscribe: vi.fn((cb?: (status: string, err?: any) => void) => {
      if (cb) cb('SUBSCRIBED');
      return mock;
    }),
    unsubscribe: vi.fn().mockResolvedValue('ok'),
    triggerBroadcast: (envelope: any) => {
      if (broadcastCallback) {
        broadcastCallback(envelope);
      }
    },
  };

  return mock;
}

describe('WhiteboardRealtimeAdapter: Real-Time Broadcast Signaling', () => {
  let mockChannel: MockRealtimeChannel;
  let adapter: WhiteboardRealtimeAdapter;
  const CURRENT_USER_ID = 'teacher-1';
  const REMOTE_USER_ID = 'student-alice';

  beforeEach(() => {
    mockChannel = createMockChannel();
    adapter = new WhiteboardRealtimeAdapter(mockChannel, CURRENT_USER_ID);
  });

  describe('Initialization & Registration', () => {
    it('initializes with channel and currentUserId', () => {
      expect(adapter.getUserId()).toBe(CURRENT_USER_ID);
      expect(adapter.getChannel()).toBe(mockChannel);
      expect(adapter.isConnected()).toBe(true);
      expect(adapter.getListenerCount()).toBe(0);
    });

    it('registers Supabase broadcast listener on whiteboard-delta event', () => {
      expect(mockChannel.on).toHaveBeenCalledWith(
        'broadcast',
        { event: WHITEBOARD_BROADCAST_EVENT },
        expect.any(Function)
      );
    });

    it('delegates subscribe call to underlying channel if present', () => {
      const statusCallback = vi.fn();
      adapter.subscribe(statusCallback);
      expect(mockChannel.subscribe).toHaveBeenCalledWith(statusCallback);
    });
  });

  describe('Broadcasting Deltas', () => {
    it('broadcasts object-added delta with pageId and senderId', async () => {
      const objectJson = {
        id: 'rect-1',
        type: 'rect',
        left: 100,
        top: 200,
        width: 50,
        height: 50,
        fill: '#ef4444',
      };

      await adapter.broadcastAdd('page-1', objectJson);

      expect(mockChannel.send).toHaveBeenCalledTimes(1);
      expect(mockChannel.send).toHaveBeenCalledWith({
        type: 'broadcast',
        event: WHITEBOARD_BROADCAST_EVENT,
        payload: expect.objectContaining({
          type: 'object-added',
          pageId: 'page-1',
          objectId: 'rect-1',
          objectJson,
          senderId: CURRENT_USER_ID,
          timestamp: expect.any(Number),
        }),
      });
    });

    it('broadcasts object-modified delta with objectId and properties', async () => {
      const properties = {
        left: 300,
        top: 400,
        fill: '#3b82f6',
      };

      await adapter.broadcastModify('page-1', 'rect-1', properties);

      expect(mockChannel.send).toHaveBeenCalledWith({
        type: 'broadcast',
        event: WHITEBOARD_BROADCAST_EVENT,
        payload: expect.objectContaining({
          type: 'object-modified',
          pageId: 'page-1',
          objectId: 'rect-1',
          properties,
          senderId: CURRENT_USER_ID,
          timestamp: expect.any(Number),
        }),
      });
    });

    it('broadcasts object-removed delta with objectId', async () => {
      await adapter.broadcastDelete('page-1', 'rect-1');

      expect(mockChannel.send).toHaveBeenCalledWith({
        type: 'broadcast',
        event: WHITEBOARD_BROADCAST_EVENT,
        payload: expect.objectContaining({
          type: 'object-removed',
          pageId: 'page-1',
          objectId: 'rect-1',
          senderId: CURRENT_USER_ID,
          timestamp: expect.any(Number),
        }),
      });
    });

    it('broadcasts laser pointer coordinate with pageId', async () => {
      const laserPoint: LaserPoint = {
        x: 450,
        y: 600,
        timestamp: Date.now(),
        opacity: 0.8,
      };

      await adapter.broadcastLaser('page-2', laserPoint);

      expect(mockChannel.send).toHaveBeenCalledWith({
        type: 'broadcast',
        event: WHITEBOARD_BROADCAST_EVENT,
        payload: expect.objectContaining({
          type: 'laser-move',
          pageId: 'page-2',
          laserPoint,
          senderId: CURRENT_USER_ID,
          timestamp: laserPoint.timestamp,
        }),
      });
    });

    it('broadcasts page switch delta with target pageId', async () => {
      await adapter.broadcastPageSwitch('page-3');

      expect(mockChannel.send).toHaveBeenCalledWith({
        type: 'broadcast',
        event: WHITEBOARD_BROADCAST_EVENT,
        payload: expect.objectContaining({
          type: 'page-switch',
          pageId: 'page-3',
          senderId: CURRENT_USER_ID,
          timestamp: expect.any(Number),
        }),
      });
    });

    it('broadcasts permissions update delta', async () => {
      const permissions: WhiteboardPermissions = {
        ...defaultWhiteboardPermissions(),
        isLockedGlobally: false,
        studentDrawingGranted: { [REMOTE_USER_ID]: true },
      };

      await adapter.broadcastPermissions(permissions);

      expect(mockChannel.send).toHaveBeenCalledWith({
        type: 'broadcast',
        event: WHITEBOARD_BROADCAST_EVENT,
        payload: expect.objectContaining({
          type: 'permissions-update',
          permissions,
          senderId: CURRENT_USER_ID,
          timestamp: expect.any(Number),
        }),
      });
    });

    it('broadcasts page addition and page deletion deltas', async () => {
      await adapter.broadcastPageAdd('page-new', 4, 'Worksheet Page 4');

      expect(mockChannel.send).toHaveBeenCalledWith({
        type: 'broadcast',
        event: WHITEBOARD_BROADCAST_EVENT,
        payload: expect.objectContaining({
          type: 'page-added',
          pageId: 'page-new',
          properties: { pageNumber: 4, title: 'Worksheet Page 4' },
          senderId: CURRENT_USER_ID,
        }),
      });

      await adapter.broadcastPageDelete('page-old');

      expect(mockChannel.send).toHaveBeenCalledWith({
        type: 'broadcast',
        event: WHITEBOARD_BROADCAST_EVENT,
        payload: expect.objectContaining({
          type: 'page-deleted',
          pageId: 'page-old',
          senderId: CURRENT_USER_ID,
        }),
      });
    });
  });

  describe('Validation of Broadcast Inputs', () => {
    it('throws error when pageId is missing in broadcastAdd', async () => {
      await expect(adapter.broadcastAdd('', { id: '1' })).rejects.toThrow(
        /pageId is required/i
      );
    });

    it('throws error when objectJson is missing in broadcastAdd', async () => {
      await expect(adapter.broadcastAdd('page-1', null as any)).rejects.toThrow(
        /objectJson is required/i
      );
    });

    it('throws error when objectId is missing in broadcastModify', async () => {
      await expect(adapter.broadcastModify('page-1', '', { left: 10 })).rejects.toThrow(
        /objectId is required/i
      );
    });

    it('throws error when objectId is missing in broadcastDelete', async () => {
      await expect(adapter.broadcastDelete('page-1', '')).rejects.toThrow(
        /objectId is required/i
      );
    });

    it('throws error when laserPoint is missing in broadcastLaser', async () => {
      await expect(adapter.broadcastLaser('page-1', null as any)).rejects.toThrow(
        /LaserPoint is required/i
      );
    });

    it('throws error when permissions is missing in broadcastPermissions', async () => {
      await expect(adapter.broadcastPermissions(null as any)).rejects.toThrow(
        /permissions.*required/i
      );
    });
  });

  describe('Incoming Event Dispatching & Subscription', () => {
    it('dispatches incoming Supabase broadcast payload to registered onDelta subscribers', () => {
      const received: WhiteboardDeltaMessage[] = [];
      const unsubscribe = adapter.onDelta((delta) => {
        received.push(delta);
      });

      expect(adapter.getListenerCount()).toBe(1);

      const incomingEnvelope = {
        type: 'broadcast',
        event: WHITEBOARD_BROADCAST_EVENT,
        payload: {
          type: 'object-added',
          pageId: 'page-1',
          objectId: 'circle-1',
          objectJson: { id: 'circle-1', type: 'circle', radius: 30 },
          senderId: REMOTE_USER_ID,
          timestamp: 1732200000000,
        },
      };

      mockChannel.triggerBroadcast?.(incomingEnvelope);

      expect(received).toHaveLength(1);
      expect(received[0]).toEqual(incomingEnvelope.payload);

      unsubscribe();
      expect(adapter.getListenerCount()).toBe(0);
    });

    it('dispatches incoming delta when passed directly without broadcast wrapper', () => {
      const received: WhiteboardDeltaMessage[] = [];
      adapter.onDelta((delta) => {
        received.push(delta);
      });

      const rawDelta: WhiteboardDeltaMessage = {
        type: 'laser-move',
        pageId: 'page-1',
        laserPoint: { x: 100, y: 200, timestamp: Date.now() },
        senderId: REMOTE_USER_ID,
        timestamp: Date.now(),
      };

      mockChannel.triggerBroadcast?.(rawDelta);

      expect(received).toHaveLength(1);
      expect(received[0]).toEqual(rawDelta);
    });

    it('supports onEvent as an alias for onDelta', () => {
      const received: WhiteboardDeltaMessage[] = [];
      const unsubscribe = adapter.onEvent((delta) => {
        received.push(delta);
      });

      mockChannel.triggerBroadcast?.({
        payload: {
          type: 'page-switch',
          pageId: 'page-2',
          senderId: REMOTE_USER_ID,
          timestamp: 12345,
        },
      });

      expect(received).toHaveLength(1);
      expect(received[0].pageId).toBe('page-2');

      unsubscribe();
    });

    it('filters out self-echoed messages when senderId matches currentUserId', () => {
      const received: WhiteboardDeltaMessage[] = [];
      adapter.onDelta((delta) => {
        received.push(delta);
      });

      // Self message: should be ignored so sender never re-processes own actions
      mockChannel.triggerBroadcast?.({
        payload: {
          type: 'object-added',
          pageId: 'page-1',
          objectId: 'rect-self',
          senderId: CURRENT_USER_ID,
          timestamp: 1732200000000,
        },
      });

      expect(received).toHaveLength(0);

      // Remote message: should be processed
      mockChannel.triggerBroadcast?.({
        payload: {
          type: 'object-added',
          pageId: 'page-1',
          objectId: 'rect-remote',
          senderId: REMOTE_USER_ID,
          timestamp: 1732200000001,
        },
      });

      expect(received).toHaveLength(1);
      expect(received[0].objectId).toBe('rect-remote');
    });

    it('allows disabling filterSelf via constructor options if desired', () => {
      const customAdapter = new WhiteboardRealtimeAdapter(mockChannel, CURRENT_USER_ID, {
        filterSelf: false,
      });

      const received: WhiteboardDeltaMessage[] = [];
      customAdapter.onDelta((delta) => {
        received.push(delta);
      });

      mockChannel.triggerBroadcast?.({
        payload: {
          type: 'object-added',
          objectId: 'rect-self',
          senderId: CURRENT_USER_ID,
          timestamp: 1732200000000,
        },
      });

      expect(received).toHaveLength(1);
      expect(received[0].objectId).toBe('rect-self');
    });

    it('dispatches to multiple listeners and supports isolated unsubscribes', () => {
      const listener1Received: string[] = [];
      const listener2Received: string[] = [];

      const unsub1 = adapter.onDelta((d) => listener1Received.push(d.type));
      const unsub2 = adapter.onDelta((d) => listener2Received.push(d.type));

      mockChannel.triggerBroadcast?.({
        payload: { type: 'laser-move', senderId: REMOTE_USER_ID, timestamp: 1 },
      });

      expect(listener1Received).toEqual(['laser-move']);
      expect(listener2Received).toEqual(['laser-move']);

      // Unsubscribe only listener 1
      unsub1();

      mockChannel.triggerBroadcast?.({
        payload: { type: 'page-switch', senderId: REMOTE_USER_ID, timestamp: 2 },
      });

      expect(listener1Received).toEqual(['laser-move']);
      expect(listener2Received).toEqual(['laser-move', 'page-switch']);

      unsub2();
      expect(adapter.getListenerCount()).toBe(0);
    });

    it('prevents throwing in one listener from interrupting other listeners', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const faultyListener = vi.fn().mockImplementation(() => {
        throw new Error('Listener crash');
      });
      const healthyListener = vi.fn();

      adapter.onDelta(faultyListener);
      adapter.onDelta(healthyListener);

      mockChannel.triggerBroadcast?.({
        payload: { type: 'page-switch', senderId: REMOTE_USER_ID, timestamp: 1 },
      });

      expect(faultyListener).toHaveBeenCalledTimes(1);
      expect(healthyListener).toHaveBeenCalledTimes(1);

      consoleErrorSpy.mockRestore();
    });

    it('safely ignores invalid, null, or empty payloads', () => {
      const listener = vi.fn();
      adapter.onDelta(listener);

      mockChannel.triggerBroadcast?.(null);
      mockChannel.triggerBroadcast?.(undefined);
      mockChannel.triggerBroadcast?.({});
      mockChannel.triggerBroadcast?.({ payload: null });
      mockChannel.triggerBroadcast?.({ payload: 'invalid-string' });

      expect(listener).not.toHaveBeenCalled();
    });

    it('throws when onDelta is called with a non-function', () => {
      expect(() => adapter.onDelta(null as any)).toThrow(/callback must be a function/i);
    });
  });

  describe('Disconnection & Network Error Handling', () => {
    it('disconnects cleanly, unsubscribes channel, and clears listeners', () => {
      const listener = vi.fn();
      adapter.onDelta(listener);
      expect(adapter.getListenerCount()).toBe(1);

      adapter.disconnect();

      expect(adapter.isConnected()).toBe(false);
      expect(adapter.getListenerCount()).toBe(0);
      expect(mockChannel.unsubscribe).toHaveBeenCalledTimes(1);

      // After disconnect, incoming events are not dispatched
      mockChannel.triggerBroadcast?.({
        payload: { type: 'page-switch', senderId: REMOTE_USER_ID, timestamp: 1 },
      });
      expect(listener).not.toHaveBeenCalled();
    });

    it('rejects broadcasts after disconnect() is called', async () => {
      adapter.disconnect();

      await expect(adapter.broadcastPageSwitch('page-1')).rejects.toThrow(
        /WhiteboardRealtimeAdapter is disconnected/i
      );
    });

    it('handles channel unsubscribe throwing during disconnect cleanly', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      mockChannel.unsubscribe.mockImplementationOnce(() => {
        throw new Error('Socket already closed');
      });

      expect(() => adapter.disconnect()).not.toThrow();
      expect(adapter.isConnected()).toBe(false);

      consoleWarnSpy.mockRestore();
    });

    it('rejects if channel.send returns "error"', async () => {
      mockChannel.send.mockResolvedValueOnce('error');

      await expect(adapter.broadcastPageSwitch('page-1')).rejects.toThrow(
        /broadcast failed with status: error/i
      );
    });

    it('rejects if channel.send returns "timed out"', async () => {
      mockChannel.send.mockResolvedValueOnce('timed out');

      await expect(adapter.broadcastPageSwitch('page-1')).rejects.toThrow(
        /broadcast failed with status: timed out/i
      );
    });

    it('rejects if channel.send throws an exception', async () => {
      mockChannel.send.mockRejectedValueOnce(new Error('Network failure'));

      await expect(adapter.broadcastPageSwitch('page-1')).rejects.toThrow(
        /Network failure/i
      );
    });
  });

  describe('Channel Construction Helpers', () => {
    it('computes standardized channel name: whiteboard:${roomId}', () => {
      expect(getWhiteboardChannelName('room-abc')).toBe('whiteboard:room-abc');
      expect(getWhiteboardChannelName('12345')).toBe('whiteboard:12345');
    });

    it('creates Supabase Realtime channel with { config: { broadcast: { self: false } } }', () => {
      const mockSupabase = {
        channel: vi.fn().mockReturnValue(mockChannel),
      };

      const channel = createWhiteboardChannel(mockSupabase, 'room-101');

      expect(mockSupabase.channel).toHaveBeenCalledWith('whiteboard:room-101', {
        config: {
          broadcast: {
            self: false,
            ack: false,
          },
        },
      });
      expect(channel).toBe(mockChannel);
    });

    it('allows overriding broadcast options in createWhiteboardChannel', () => {
      const mockSupabase = {
        channel: vi.fn().mockReturnValue(mockChannel),
      };

      createWhiteboardChannel(mockSupabase, 'room-102', { self: true, ack: true });

      expect(mockSupabase.channel).toHaveBeenCalledWith('whiteboard:room-102', {
        config: {
          broadcast: {
            self: true,
            ack: true,
          },
        },
      });
    });
  });
});
