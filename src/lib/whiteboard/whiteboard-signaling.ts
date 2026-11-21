/**
 * Real-Time Supabase Broadcast Whiteboard Signaling Adapter
 *
 * Implements real-time synchronization of canvas mutations, laser pointer streams,
 * page navigation, and teacher permission changes over Supabase Realtime broadcast
 * channels (`whiteboard:${roomId}`) with zero database overhead and $0 egress.
 */

import {
  WhiteboardDeltaMessage,
  WhiteboardDeltaType,
  LaserPoint,
  WhiteboardPermissions,
  createWhiteboardDeltaMessage,
} from '../../types/whiteboard';

export const WHITEBOARD_BROADCAST_EVENT = 'whiteboard-delta';

export interface WhiteboardRealtimeAdapterOptions {
  /**
   * If true (default), messages whose senderId matches currentUserId are dropped
   * so the local client never re-processes or loops its own outgoing operations.
   */
  filterSelf?: boolean;
}

/**
 * Derives the canonical Supabase Realtime channel topic for a classroom room ID.
 */
export function getWhiteboardChannelName(roomId: string): string {
  return `whiteboard:${roomId}`;
}

/**
 * Creates and configures a Supabase RealtimeChannel for whiteboard signaling with
 * broadcast self: false by default.
 */
export function createWhiteboardChannel(
  supabase: any,
  roomId: string,
  options?: { self?: boolean; ack?: boolean }
): any {
  if (!supabase || typeof supabase.channel !== 'function') {
    throw new Error('Valid Supabase client with .channel() is required');
  }

  return supabase.channel(getWhiteboardChannelName(roomId), {
    config: {
      broadcast: {
        self: options?.self ?? false,
        ack: options?.ack ?? false,
      },
    },
  });
}

/**
 * Real-time signaling adapter connecting local whiteboard operations to a Supabase
 * Realtime broadcast channel.
 */
export class WhiteboardRealtimeAdapter {
  private channel: any;
  private currentUserId: string;
  private filterSelf: boolean;
  private listeners: Set<(delta: WhiteboardDeltaMessage) => void> = new Set();
  private disconnected: boolean = false;

  constructor(
    channel: any,
    currentUserId: string,
    options?: WhiteboardRealtimeAdapterOptions
  ) {
    this.channel = channel;
    this.currentUserId = currentUserId;
    this.filterSelf = options?.filterSelf ?? true;

    this.setupChannelListener();
  }

  /**
   * Subscribes to the broadcast channel's 'whiteboard-delta' events.
   */
  private setupChannelListener(): void {
    if (this.channel && typeof this.channel.on === 'function') {
      this.channel.on(
        'broadcast',
        { event: WHITEBOARD_BROADCAST_EVENT },
        (envelope: any) => {
          this.handleIncomingBroadcast(envelope);
        }
      );
    }
  }

  /**
   * Parses, filters, and dispatches an incoming broadcast payload to all registered listeners.
   */
  private handleIncomingBroadcast(envelope: any): void {
    if (this.disconnected || !envelope) return;

    // Supabase broadcast wraps payloads in { type: 'broadcast', event: '...', payload: {...} }
    // but in direct dispatch or test contexts it might be passed directly.
    const delta: WhiteboardDeltaMessage =
      envelope && typeof envelope === 'object' && 'payload' in envelope
        ? envelope.payload
        : envelope;

    if (!delta || typeof delta !== 'object' || !delta.type) {
      return;
    }

    // Drop self-echoed messages to avoid redundant re-application
    if (this.filterSelf && delta.senderId && delta.senderId === this.currentUserId) {
      return;
    }

    for (const listener of this.listeners) {
      try {
        listener(delta);
      } catch (err) {
        console.error('Error invoking WhiteboardRealtimeAdapter listener:', err);
      }
    }
  }

  /**
   * Internal transport helper emitting a formatted WhiteboardDeltaMessage over the broadcast channel.
   */
  private async sendDelta(delta: WhiteboardDeltaMessage): Promise<void> {
    if (this.disconnected) {
      throw new Error('WhiteboardRealtimeAdapter is disconnected');
    }

    if (!this.channel || typeof this.channel.send !== 'function') {
      throw new Error('RealtimeChannel is not available or invalid');
    }

    const result = await this.channel.send({
      type: 'broadcast',
      event: WHITEBOARD_BROADCAST_EVENT,
      payload: delta,
    });

    if (result === 'error' || result === 'timed out') {
      throw new Error(`Broadcast failed with status: ${result}`);
    }
  }

  /**
   * Broadcasts the addition of a canvas object to peers on the specified page.
   */
  public async broadcastAdd(pageId: string, objectJson: any): Promise<void> {
    if (!pageId) {
      throw new Error('pageId is required to broadcast object addition');
    }
    if (!objectJson) {
      throw new Error('objectJson is required to broadcast object addition');
    }

    const delta = createWhiteboardDeltaMessage('object-added', this.currentUserId, {
      pageId,
      objectId: objectJson.id ?? objectJson.uid,
      objectJson,
    });

    await this.sendDelta(delta);
  }

  /**
   * Broadcasts mutation properties of an existing object to peers.
   */
  public async broadcastModify(
    pageId: string,
    objectId: string,
    properties: any
  ): Promise<void> {
    if (!pageId) {
      throw new Error('pageId is required to broadcast object modification');
    }
    if (!objectId) {
      throw new Error('objectId is required to broadcast object modification');
    }

    const delta = createWhiteboardDeltaMessage('object-modified', this.currentUserId, {
      pageId,
      objectId,
      properties,
    });

    await this.sendDelta(delta);
  }

  /**
   * Broadcasts deletion of an object to peers.
   */
  public async broadcastDelete(pageId: string, objectId: string): Promise<void> {
    if (!pageId) {
      throw new Error('pageId is required to broadcast object deletion');
    }
    if (!objectId) {
      throw new Error('objectId is required to broadcast object deletion');
    }

    const delta = createWhiteboardDeltaMessage('object-removed', this.currentUserId, {
      pageId,
      objectId,
    });

    await this.sendDelta(delta);
  }

  /**
   * Broadcasts laser pointer cursor coordinates and trail timestamp.
   */
  public async broadcastLaser(pageId: string, point: LaserPoint): Promise<void> {
    if (!pageId) {
      throw new Error('pageId is required to broadcast laser pointer');
    }
    if (!point) {
      throw new Error('LaserPoint is required to broadcast laser pointer');
    }

    const delta = createWhiteboardDeltaMessage('laser-move', this.currentUserId, {
      pageId,
      laserPoint: point,
      timestamp: point.timestamp ?? Date.now(),
    });

    await this.sendDelta(delta);
  }

  /**
   * Broadcasts an authoritative page navigation switch to sync all classroom participants.
   */
  public async broadcastPageSwitch(pageId: string): Promise<void> {
    if (!pageId) {
      throw new Error('pageId is required to broadcast page switch');
    }

    const delta = createWhiteboardDeltaMessage('page-switch', this.currentUserId, {
      pageId,
    });

    await this.sendDelta(delta);
  }

  /**
   * Broadcasts teacher permission policy updates to peers.
   */
  public async broadcastPermissions(
    permissions: WhiteboardPermissions
  ): Promise<void> {
    if (!permissions) {
      throw new Error('permissions object is required to broadcast permissions update');
    }

    const delta = createWhiteboardDeltaMessage(
      'permissions-update',
      this.currentUserId,
      {
        permissions,
      }
    );

    await this.sendDelta(delta);
  }

  /**
   * Broadcasts page creation to sync peer page lists.
   */
  public async broadcastPageAdd(
    pageId: string,
    pageNumber?: number,
    title?: string
  ): Promise<void> {
    if (!pageId) {
      throw new Error('pageId is required to broadcast page addition');
    }

    const delta = createWhiteboardDeltaMessage('page-added', this.currentUserId, {
      pageId,
      properties: { pageNumber, title },
    });

    await this.sendDelta(delta);
  }

  /**
   * Broadcasts page deletion to sync peer page lists.
   */
  public async broadcastPageDelete(pageId: string): Promise<void> {
    if (!pageId) {
      throw new Error('pageId is required to broadcast page deletion');
    }

    const delta = createWhiteboardDeltaMessage('page-deleted', this.currentUserId, {
      pageId,
    });

    await this.sendDelta(delta);
  }

  /**
   * Registers a subscriber callback for incoming whiteboard delta events.
   * Returns an unsubscribe function.
   */
  public onDelta(callback: (delta: WhiteboardDeltaMessage) => void): () => void {
    if (typeof callback !== 'function') {
      throw new Error('Callback must be a function');
    }

    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  /**
   * Convenience alias for onDelta.
   */
  public onEvent(callback: (delta: WhiteboardDeltaMessage) => void): () => void {
    return this.onDelta(callback);
  }

  /**
   * Optional helper to trigger channel subscription if not already subscribed.
   */
  public subscribe(callback?: (status: string, err?: any) => void): this {
    if (this.channel && typeof this.channel.subscribe === 'function') {
      this.channel.subscribe(callback);
    }
    return this;
  }

  /**
   * Disconnects the adapter, unsubscribes from the channel, and clears all listeners.
   */
  public disconnect(): void {
    this.disconnected = true;
    this.listeners.clear();

    if (this.channel && typeof this.channel.unsubscribe === 'function') {
      try {
        this.channel.unsubscribe();
      } catch (err) {
        console.warn('Error during channel unsubscribe:', err);
      }
    }
  }

  /**
   * Returns the current user ID associated with this adapter.
   */
  public getUserId(): string {
    return this.currentUserId;
  }

  /**
   * Returns the underlying RealtimeChannel instance.
   */
  public getChannel(): any {
    return this.channel;
  }

  /**
   * Checks whether the adapter is actively connected.
   */
  public isConnected(): boolean {
    return !this.disconnected;
  }

  /**
   * Returns the current count of active delta subscribers.
   */
  public getListenerCount(): number {
    return this.listeners.size;
  }
}
