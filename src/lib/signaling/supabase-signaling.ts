import { z } from 'zod';
import { ISignalingAdapter } from '../webrtc/p2p-session';
import { SignalingMessage } from '../../types/media';
import { createBrowserClient } from '../supabase/client';

export const SignalingPayloadSchema = z.object({
  type: z.enum([
    'sdp-offer',
    'sdp-answer',
    'ice-candidate',
    'peer-joined',
    'peer-left',
  ]),
  senderId: z.string().optional(),
  sdp: z.any().optional(),
  candidate: z.any().optional(),
  payload: z.any().optional(),
});

export type SignalingPayloadType =
  | 'sdp-offer'
  | 'sdp-answer'
  | 'ice-candidate'
  | 'peer-joined'
  | 'peer-left';

export interface SignalingPayload {
  type: SignalingPayloadType;
  senderId: string;
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
  [key: string]: any;
}

export interface SignalingBroadcastEnvelope {
  type: 'broadcast';
  event: 'signaling';
  payload: SignalingPayload;
}

export class SupabaseSignalingAdapter implements ISignalingAdapter {
  public client?: any;
  public channel?: any;
  public userId: string;
  public roomId?: string;
  private channelRoomId?: string;
  private isListening: boolean = false;

  // Callback registries
  private offerCallbacks: Array<(sdp: RTCSessionDescriptionInit, senderId: string) => void> = [];
  private answerCallbacks: Array<(sdp: RTCSessionDescriptionInit, senderId: string) => void> = [];
  private candidateCallbacks: Array<(candidate: RTCIceCandidateInit, senderId: string) => void> = [];
  private peerJoinedCallbacks: Array<(peerId: string) => void> = [];
  private peerLeftCallbacks: Array<(peerId: string) => void> = [];

  constructor(clientOrChannel?: any, currentUserId?: string) {
    this.userId =
      currentUserId ||
      `peer_${Math.random().toString(36).substring(2, 9)}`;

    if (clientOrChannel) {
      if (typeof clientOrChannel.channel === 'function') {
        this.client = clientOrChannel;
      } else if (
        typeof clientOrChannel.send === 'function' ||
        typeof clientOrChannel.on === 'function'
      ) {
        this.channel = clientOrChannel;
        this.setupChannelListeners();
      } else {
        this.client = clientOrChannel;
      }
    } else {
      this.client = createBrowserClient();
    }
  }

  public getUserId(): string {
    return this.userId;
  }

  public getRoomId(): string | undefined {
    return this.roomId;
  }

  public getChannel(): any {
    return this.channel;
  }

  async connect(roomId: string, userId?: string): Promise<void> {
    this.roomId = roomId;
    if (userId) {
      this.userId = userId;
    }

    if (this.client) {
      this.channel = this.client.channel(`room:${roomId}`, {
        config: { broadcast: { self: false } },
      });
      this.channelRoomId = roomId;
      this.isListening = false;
    }

    this.setupChannelListeners();

    if (!this.channel || typeof this.channel.subscribe !== 'function') {
      return;
    }

    let resolvedByCallback = false;
    const subscribedPromise = new Promise<void>((resolve) => {
      const subscribeCallback = (status: string) => {
        if (status === 'SUBSCRIBED') {
          const p = this.broadcastPeerJoined().catch((broadcastErr) => {
            console.error('Failed to broadcast peer-joined on subscription:', broadcastErr);
          });
          if (!resolvedByCallback) {
            resolvedByCallback = true;
            p.finally(resolve);
          }
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          if (!resolvedByCallback) {
            resolvedByCallback = true;
            resolve();
          }
        }
      };

      const subscribeResult = this.channel.subscribe(subscribeCallback);
      if (subscribeResult && typeof subscribeResult.then === 'function') {
        subscribeResult.then(() => {
          if (!resolvedByCallback) {
            resolvedByCallback = true;
            resolve();
          }
        }).catch(() => {
          if (!resolvedByCallback) {
            resolvedByCallback = true;
            resolve();
          }
        });
      } else if (!resolvedByCallback) {
        // Synchronous mock that did not invoke subscribeCallback immediately
        resolvedByCallback = true;
        resolve();
      }
    });

    await subscribedPromise;
  }

  private setupChannelListeners(): void {
    if (!this.channel || typeof this.channel.on !== 'function') {
      return;
    }
    if (this.isListening) {
      return;
    }

    this.channel.on(
      'broadcast',
      { event: 'signaling' },
      (message: any) => {
        this.handleIncomingSignaling(message);
      }
    );
    this.isListening = true;
  }

  private handleIncomingSignaling(message: any): void {
    if (!message || typeof message !== 'object') return;

    const rawData = message.payload ?? message;
    const parsed = SignalingPayloadSchema.safeParse(rawData);
    if (!parsed.success) return;

    const data = parsed.data;
    const { type, senderId } = data;

    // Filter out messages originated by self
    if (senderId && senderId === this.userId) {
      return;
    }

    const effectiveSenderId = senderId ?? '';

    switch (type) {
      case 'sdp-offer': {
        const sdp = data.sdp ?? data.payload;
        if (sdp) {
          for (const cb of this.offerCallbacks) {
            try {
              cb(sdp, effectiveSenderId);
            } catch (err) {
              console.error('Error in onOffer callback:', err);
            }
          }
        }
        break;
      }
      case 'sdp-answer': {
        const sdp = data.sdp ?? data.payload;
        if (sdp) {
          for (const cb of this.answerCallbacks) {
            try {
              cb(sdp, effectiveSenderId);
            } catch (err) {
              console.error('Error in onAnswer callback:', err);
            }
          }
        }
        break;
      }
      case 'ice-candidate': {
        const candidate = data.candidate ?? data.payload;
        if (candidate) {
          for (const cb of this.candidateCallbacks) {
            try {
              cb(candidate, effectiveSenderId);
            } catch (err) {
              console.error('Error in onCandidate callback:', err);
            }
          }
        }
        break;
      }
      case 'peer-joined': {
        for (const cb of this.peerJoinedCallbacks) {
          try {
            cb(effectiveSenderId);
          } catch (err) {
            console.error('Error in onPeerJoined callback:', err);
          }
        }
        break;
      }
      case 'peer-left': {
        for (const cb of this.peerLeftCallbacks) {
          try {
            cb(effectiveSenderId);
          } catch (err) {
            console.error('Error in onPeerLeft callback:', err);
          }
        }
        break;
      }
      default:
        break;
    }
  }

  async sendOffer(sdp: RTCSessionDescriptionInit): Promise<void> {
    if (!this.channel || typeof this.channel.send !== 'function') {
      throw new Error('Signaling channel is not available. Connect first or provide a channel.');
    }
    const result = this.channel.send({
      type: 'broadcast',
      event: 'signaling',
      payload: {
        type: 'sdp-offer',
        senderId: this.userId,
        sdp,
      },
    });
    if (result && typeof result.then === 'function') {
      await result;
    }
  }

  async sendAnswer(sdp: RTCSessionDescriptionInit): Promise<void> {
    if (!this.channel || typeof this.channel.send !== 'function') {
      throw new Error('Signaling channel is not available. Connect first or provide a channel.');
    }
    const result = this.channel.send({
      type: 'broadcast',
      event: 'signaling',
      payload: {
        type: 'sdp-answer',
        senderId: this.userId,
        sdp,
      },
    });
    if (result && typeof result.then === 'function') {
      await result;
    }
  }

  async sendCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (!this.channel || typeof this.channel.send !== 'function') {
      throw new Error('Signaling channel is not available. Connect first or provide a channel.');
    }
    const result = this.channel.send({
      type: 'broadcast',
      event: 'signaling',
      payload: {
        type: 'ice-candidate',
        senderId: this.userId,
        candidate,
      },
    });
    if (result && typeof result.then === 'function') {
      await result;
    }
  }

  public async broadcastPeerJoined(): Promise<void> {
    if (!this.channel || typeof this.channel.send !== 'function') {
      return;
    }
    const result = this.channel.send({
      type: 'broadcast',
      event: 'signaling',
      payload: {
        type: 'peer-joined',
        senderId: this.userId,
      },
    });
    if (result && typeof result.then === 'function') {
      await result;
    }
  }

  public async broadcastPeerLeft(): Promise<void> {
    if (!this.channel || typeof this.channel.send !== 'function') {
      return;
    }
    const result = this.channel.send({
      type: 'broadcast',
      event: 'signaling',
      payload: {
        type: 'peer-left',
        senderId: this.userId,
      },
    });
    if (result && typeof result.then === 'function') {
      await result;
    }
  }

  disconnect(): void {
    if (this.channel && typeof this.channel.send === 'function') {
      this.channel
        .send({
          type: 'broadcast',
          event: 'signaling',
          payload: {
            type: 'peer-left',
            senderId: this.userId,
          },
        })
        .catch((err: any) => {
          console.warn('Failed to broadcast peer-left on disconnect:', err);
        });
    }

    if (this.channel && typeof this.channel.unsubscribe === 'function') {
      this.channel.unsubscribe();
    }

    if (this.client && typeof this.client.removeChannel === 'function' && this.channel) {
      this.client.removeChannel(this.channel);
    }

    this.channel = null;
    this.channelRoomId = undefined;
    this.isListening = false;
  }

  onOffer(callback: (sdp: RTCSessionDescriptionInit, senderId: string) => void): void {
    this.offerCallbacks.push(callback);
  }

  onAnswer(callback: (sdp: RTCSessionDescriptionInit, senderId: string) => void): void {
    this.answerCallbacks.push(callback);
  }

  onCandidate(callback: (candidate: RTCIceCandidateInit, senderId: string) => void): void {
    this.candidateCallbacks.push(callback);
  }

  onPeerJoined(callback: (peerId: string) => void): void {
    this.peerJoinedCallbacks.push(callback);
  }

  onPeerLeft(callback: (peerId: string) => void): void {
    this.peerLeftCallbacks.push(callback);
  }
}
