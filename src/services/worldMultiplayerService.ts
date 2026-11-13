import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { VehicleModelType } from '../components/world/worldModels';
import type { PlayerProfile } from './playerService';

export const DEFAULT_DISCOVERY_RADIUS = 110;
const HEARTBEAT_INTERVAL_MS = 35_000;
const NEARBY_POLL_INTERVAL_MS = 8_000;
const BROADCAST_MIN_INTERVAL_MS = 110;
const STALE_PEER_TIMEOUT_MS = 10 * 60 * 1000;

export interface RemotePlayerPeer {
  playerId: string;
  nickname: string;
  vehicleModel: VehicleModelType;
  paintColor: string;
  worldRegion: string;
  x: number;
  y: number;
  z: number;
  heading: number;
  speed: number;
  distance: number;
  isOnline: boolean;
  lastUpdatedAtMs: number;
}

export interface ChatInvitationItem {
  id: string;
  senderPlayerId: string;
  senderNickname: string;
  recipientPlayerId: string;
  status: 'pending' | 'accepted' | 'declined' | 'expired' | 'cancelled';
  createdAt: string;
  expiresAt: string;
}

export interface ChatMessageItem {
  id: string;
  conversationId: string;
  senderPlayerId: string;
  content: string;
  createdAt: string;
}

export interface ActiveConversationState {
  conversationId: string;
  peerPlayerId: string;
  peerNickname: string;
  peerOnline: boolean;
  messages: ChatMessageItem[];
  unreadCount: number;
}

export interface ModerationBlockFeedback {
  message: string;
  explanation?: string;
  category?: string;
  violationCount?: number;
  restrictedUntil?: string | null;
}

export function inferLagosRegion(x: number, z: number): string {
  if (x > 1420) return 'Epe Coastal Highway';
  if (x > 600) return 'Lekki Peninsula & Ajah';
  if (x > 420 && z > -250 && z < 350) return 'Ikoyi & Link Bridge';
  if (z < -260) return 'Third Mainland Bridge / Mainland';
  if (x < -160) return 'Surulere & Mainland West';
  return 'Lagos Island';
}

export class WorldMultiplayerSession {
  private me: PlayerProfile;
  private channel: RealtimeChannel | null = null;
  private heartbeatTimer: number | null = null;
  private nearbyPollTimer: number | null = null;
  private lastBroadcastMs = 0;
  private lastKnownPos = { x: 0, y: 0, z: 10, heading: Math.PI, speed: 0 };
  private remotePeers = new Map<string, RemotePlayerPeer>();
  private discoveryRadius = DEFAULT_DISCOVERY_RADIUS;

  private onPeersChange: (peers: RemotePlayerPeer[]) => void;
  private onIncomingInvite: (inv: ChatInvitationItem | null) => void;
  private onConversationOpen: (conv: ActiveConversationState) => void;
  private onMessageReceived: (msg: ChatMessageItem) => void;
  private onConversationClosed: (conversationId: string, reason: string) => void;

  private nicknameCache = new Map<string, string>();
  private activeConversationId: string | null = null;

  constructor(
    profile: PlayerProfile,
    callbacks: {
      onPeersChange: (peers: RemotePlayerPeer[]) => void;
      onIncomingInvite: (inv: ChatInvitationItem | null) => void;
      onConversationOpen: (conv: ActiveConversationState) => void;
      onMessageReceived: (msg: ChatMessageItem) => void;
      onConversationClosed: (conversationId: string, reason: string) => void;
    }
  ) {
    this.me = profile;
    this.onPeersChange = callbacks.onPeersChange;
    this.onIncomingInvite = callbacks.onIncomingInvite;
    this.onConversationOpen = callbacks.onConversationOpen;
    this.onMessageReceived = callbacks.onMessageReceived;
    this.onConversationClosed = callbacks.onConversationClosed;
  }

  public updateProfile(profile: PlayerProfile) {
    this.me = profile;
  }

  public async start(): Promise<void> {
    // 1. Send immediate presence heartbeat
    await this.sendHeartbeat();
    await this.refreshNearbyPlayers();
    await this.fetchPendingInvitation();

    // 2. Subscribe to Supabase Realtime channel (low-latency vehicle broadcast + DB changes)
    const ch = supabase.channel('manifold-world-live', {
      config: { broadcast: { self: false } },
    });

    ch.on('broadcast', { event: 'player_motion' }, ({ payload }) => {
      if (!payload || payload.playerId === this.me.id) return;
      const dist = Math.hypot(payload.x - this.lastKnownPos.x, payload.z - this.lastKnownPos.z);
      const existing = this.remotePeers.get(payload.playerId);
      this.nicknameCache.set(payload.playerId, payload.nickname);

      if (dist <= this.discoveryRadius * 1.45) {
        this.remotePeers.set(payload.playerId, {
          playerId: payload.playerId,
          nickname: payload.nickname,
          vehicleModel: payload.vehicleModel || existing?.vehicleModel || 'SPORTS_COUPE',
          paintColor: payload.paintColor || existing?.paintColor || '#DC2626',
          worldRegion: payload.worldRegion || 'Lagos Island',
          x: payload.x,
          y: payload.y ?? 0,
          z: payload.z,
          heading: payload.heading ?? Math.PI,
          speed: payload.speed ?? 0,
          distance: Math.round(dist),
          isOnline: true,
          lastUpdatedAtMs: Date.now(),
        });
        this.emitPeers();
      } else if (existing) {
        this.remotePeers.delete(payload.playerId);
        this.emitPeers();
      }
    });

    ch.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'player_presence',
      },
      (payload) => {
        const row = (payload.new || payload.old) as any;
        if (!row || row.player_id === this.me.id) return;
        if (payload.eventType === 'DELETE' || row.is_online === false) {
          this.remotePeers.delete(row.player_id);
          this.emitPeers();
        } else {
          this.nicknameCache.set(row.player_id, row.nickname);
          const dist = Math.hypot((row.pos_x ?? 0) - this.lastKnownPos.x, (row.pos_z ?? 0) - this.lastKnownPos.z);
          if (dist <= this.discoveryRadius) {
            this.remotePeers.set(row.player_id, {
              playerId: row.player_id,
              nickname: row.nickname,
              vehicleModel: row.vehicle_model || 'SPORTS_COUPE',
              paintColor: row.paint_color || '#DC2626',
              worldRegion: row.world_region || 'Lagos Island',
              x: row.pos_x ?? 0,
              y: row.pos_y ?? 0,
              z: row.pos_z ?? 0,
              heading: row.heading ?? Math.PI,
              speed: row.speed ?? 0,
              distance: Math.round(dist),
              isOnline: true,
              lastUpdatedAtMs: Date.now(),
            });
            this.emitPeers();
          }
        }
      }
    );

    ch.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'chat_invitations',
      },
      async (payload) => {
        const row = payload.new as any;
        if (!row) return;

        // Recipient receives new pending invite
        if (row.recipient_player_id === this.me.id) {
          if (row.status === 'pending' && Date.parse(row.expires_at) > Date.now()) {
            const senderNickname =
              this.nicknameCache.get(row.sender_player_id) ||
              (await this.lookupPeerNickname(row.sender_player_id));
            this.onIncomingInvite({
              id: row.id,
              senderPlayerId: row.sender_player_id,
              senderNickname,
              recipientPlayerId: row.recipient_player_id,
              status: row.status,
              createdAt: row.created_at,
              expiresAt: row.expires_at,
            });
          } else {
            this.onIncomingInvite(null);
          }
        }

        // Sender sees invitation accepted -> open conversation immediately
        if (row.sender_player_id === this.me.id && row.status === 'accepted') {
          await this.loadConversationWithPeer(row.recipient_player_id);
        }
      }
    );

    ch.on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
      },
      (payload) => {
        const row = payload.new as any;
        if (
          !row ||
          (row.moderation_status !== 'approved' && row.moderation_status !== 'flagged_review')
        ) {
          return;
        }
        if (row.conversation_id === this.activeConversationId) {
          this.onMessageReceived({
            id: row.id,
            conversationId: row.conversation_id,
            senderPlayerId: row.sender_player_id,
            content: row.content,
            createdAt: row.created_at,
          });
        }
      }
    );

    ch.on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'chat_conversations',
      },
      (payload) => {
        const row = payload.new as any;
        if (!row) return;
        if (
          row.id === this.activeConversationId &&
          (row.status === 'blocked' || row.status === 'closed')
        ) {
          this.activeConversationId = null;
          this.onConversationClosed(row.id, 'This chat session was closed.');
        }
      }
    );

    ch.subscribe();
    this.channel = ch;

    // 3. Periodic 35s server heartbeat + 8s nearby scan
    this.heartbeatTimer = window.setInterval(() => {
      void this.sendHeartbeat();
      this.pruneStalePeers();
    }, HEARTBEAT_INTERVAL_MS);

    this.nearbyPollTimer = window.setInterval(() => {
      void this.refreshNearbyPlayers();
      this.pruneStalePeers();
    }, NEARBY_POLL_INTERVAL_MS);
  }

  public stop() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.nearbyPollTimer) {
      clearInterval(this.nearbyPollTimer);
      this.nearbyPollTimer = null;
    }
    if (this.channel) {
      supabase.removeChannel(this.channel);
      this.channel = null;
    }
    this.remotePeers.clear();
    this.emitPeers();
  }

  public publishLocalMotion(pos: { x: number; y?: number; z: number; heading: number; speed?: number }) {
    this.lastKnownPos = {
      x: pos.x,
      y: pos.y ?? 0,
      z: pos.z,
      heading: pos.heading,
      speed: pos.speed ?? 0,
    };

    const now = performance.now();
    if (!this.channel || now - this.lastBroadcastMs < BROADCAST_MIN_INTERVAL_MS) return;
    this.lastBroadcastMs = now;

    this.channel.send({
      type: 'broadcast',
      event: 'player_motion',
      payload: {
        playerId: this.me.id,
        nickname: this.me.nickname,
        vehicleModel: this.me.selected_vehicle || 'SPORTS_COUPE',
        paintColor: this.me.selected_vehicle_color || '#DC2626',
        worldRegion: inferLagosRegion(pos.x, pos.z),
        x: pos.x,
        y: pos.y ?? 0,
        z: pos.z,
        heading: pos.heading,
        speed: pos.speed ?? 0,
      },
    });
  }

  private async sendHeartbeat() {
    try {
      const { data } = await supabase.rpc('heartbeat_player_presence', {
        p_x: this.lastKnownPos.x,
        p_y: this.lastKnownPos.y,
        p_z: this.lastKnownPos.z,
        p_heading: this.lastKnownPos.heading,
        p_speed: this.lastKnownPos.speed,
        p_region: inferLagosRegion(this.lastKnownPos.x, this.lastKnownPos.z),
      });
      if (data && typeof data.discoveryRadius === 'number') {
        this.discoveryRadius = data.discoveryRadius;
      }
    } catch {}
  }

  public async refreshNearbyPlayers(): Promise<void> {
    try {
      const { data, error } = await supabase.rpc('get_nearby_active_players');
      if (error || !Array.isArray(data)) return;

      const freshIds = new Set<string>();
      for (const row of data) {
        freshIds.add(row.player_id);
        this.nicknameCache.set(row.player_id, row.nickname);
        const existing = this.remotePeers.get(row.player_id);
        // Preserve fresher broadcast coords if received in the last 3s
        const keepBroadcast = existing && Date.now() - existing.lastUpdatedAtMs < 3000;
        this.remotePeers.set(row.player_id, {
          playerId: row.player_id,
          nickname: row.nickname,
          vehicleModel: row.vehicle_model || 'SPORTS_COUPE',
          paintColor: row.paint_color || '#DC2626',
          worldRegion: row.world_region || 'Lagos Island',
          x: keepBroadcast ? existing.x : row.pos_x,
          y: keepBroadcast ? existing.y : row.pos_y,
          z: keepBroadcast ? existing.z : row.pos_z,
          heading: keepBroadcast ? existing.heading : row.heading,
          speed: keepBroadcast ? existing.speed : row.speed,
          distance: Math.round(row.distance),
          isOnline: true,
          lastUpdatedAtMs: keepBroadcast ? existing.lastUpdatedAtMs : Date.parse(row.last_heartbeat_at) || Date.now(),
        });
      }

      for (const id of Array.from(this.remotePeers.keys())) {
        if (!freshIds.has(id)) {
          this.remotePeers.delete(id);
        }
      }
      this.emitPeers();
    } catch {}
  }

  private pruneStalePeers() {
    const cutoff = Date.now() - STALE_PEER_TIMEOUT_MS;
    let changed = false;
    for (const [id, peer] of this.remotePeers.entries()) {
      if (peer.lastUpdatedAtMs < cutoff) {
        this.remotePeers.delete(id);
        changed = true;
      }
    }
    if (changed) this.emitPeers();
  }

  private emitPeers() {
    const list = Array.from(this.remotePeers.values()).sort((a, b) => a.distance - b.distance);
    this.onPeersChange(list);
  }

  private async lookupPeerNickname(playerId: string): Promise<string> {
    const cached = this.nicknameCache.get(playerId);
    if (cached) return cached;
    const { data } = await supabase
      .from('player_presence')
      .select('nickname')
      .eq('player_id', playerId)
      .maybeSingle();
    const nick = data?.nickname || 'Driver';
    this.nicknameCache.set(playerId, nick);
    return nick;
  }

  private async fetchPendingInvitation() {
    const { data } = await supabase
      .from('chat_invitations')
      .select('*')
      .eq('recipient_player_id', this.me.id)
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) {
      const senderNickname = await this.lookupPeerNickname(data.sender_player_id);
      this.onIncomingInvite({
        id: data.id,
        senderPlayerId: data.sender_player_id,
        senderNickname,
        recipientPlayerId: data.recipient_player_id,
        status: data.status,
        createdAt: data.created_at,
        expiresAt: data.expires_at,
      });
    }
  }

  private async loadConversationWithPeer(peerPlayerId: string) {
    const [a, b] = this.me.id < peerPlayerId ? [this.me.id, peerPlayerId] : [peerPlayerId, this.me.id];
    const { data: conv } = await supabase
      .from('chat_conversations')
      .select('*')
      .eq('player_a_id', a)
      .eq('player_b_id', b)
      .eq('status', 'active')
      .maybeSingle();

    if (!conv) return;
    await this.openConversationById(conv.id, peerPlayerId);
  }

  public async openConversationById(conversationId: string, peerPlayerId: string, peerNicknameHint?: string) {
    this.activeConversationId = conversationId;
    const peerNickname = peerNicknameHint || (await this.lookupPeerNickname(peerPlayerId));

    const { data: msgs } = await supabase
      .from('chat_messages')
      .select('id, conversation_id, sender_player_id, content, created_at')
      .eq('conversation_id', conversationId)
      .in('moderation_status', ['approved', 'flagged_review'])
      .order('created_at', { ascending: true })
      .limit(100);

    const mapped: ChatMessageItem[] = (msgs || []).map((m: any) => ({
      id: m.id,
      conversationId: m.conversation_id,
      senderPlayerId: m.sender_player_id,
      content: m.content,
      createdAt: m.created_at,
    }));

    this.onConversationOpen({
      conversationId,
      peerPlayerId,
      peerNickname,
      peerOnline: this.remotePeers.has(peerPlayerId),
      messages: mapped,
      unreadCount: 0,
    });
  }

  public async sendChatInvitation(
    recipientPlayerId: string
  ): Promise<{ success: boolean; recipientNickname?: string; expiresAt?: string; error?: string }> {
    const { data, error } = await supabase.rpc('send_chat_invitation', {
      p_recipient_player_id: recipientPlayerId,
    });
    if (error) return { success: false, error: error.message };
    return {
      success: true,
      recipientNickname: data?.recipientNickname,
      expiresAt: data?.expiresAt,
    };
  }

  public async respondToInvitation(
    invitationId: string,
    accept: boolean
  ): Promise<{ success: boolean; error?: string }> {
    const { data, error } = await supabase.rpc('respond_chat_invitation', {
      p_invitation_id: invitationId,
      p_accept: accept,
    });
    this.onIncomingInvite(null);
    if (error) return { success: false, error: error.message };
    if (accept && data?.conversationId && data?.peerPlayerId) {
      await this.openConversationById(data.conversationId, data.peerPlayerId, data.peerNickname);
    }
    return { success: true };
  }

  public async sendChatMessage(
    conversationId: string,
    content: string
  ): Promise<{
    delivered: boolean;
    messageRecord?: ChatMessageItem;
    moderationWarning?: ModerationBlockFeedback;
    error?: string;
  }> {
    const trimmed = content.trim();
    if (!trimmed) return { delivered: false, error: 'Message cannot be empty.' };

    // Contextual pre-screen when API route is available; server SQL RPC remains authoritative
    try {
      const modRes = await fetch('/api/world/moderate-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: trimmed }),
      });
      if (modRes.ok) {
        const modData = await modRes.json();
        if (modData && modData.allowed === false && modData.action === 'block') {
          return {
            delivered: false,
            moderationWarning: {
              message: 'THIS MESSAGE DOES NOT MEET MANIFOLD COMMUNITY CHAT GUIDELINES.',
              explanation: modData.reason,
              category: modData.category,
            },
          };
        }
      }
    } catch {}

    const { data, error } = await supabase.rpc('send_moderated_chat_message', {
      p_conversation_id: conversationId,
      p_content: trimmed,
    });

    if (error) {
      return { delivered: false, error: error.message };
    }

    if (!data?.delivered) {
      return {
        delivered: false,
        moderationWarning: {
          message: data?.message || 'THIS MESSAGE DOES NOT MEET MANIFOLD COMMUNITY CHAT GUIDELINES.',
          explanation: data?.explanation,
          category: data?.category,
          violationCount: data?.violationCount,
          restrictedUntil: data?.restrictedUntil,
        },
      };
    }

    const r = data.messageRecord;
    return {
      delivered: true,
      messageRecord: {
        id: r.id,
        conversationId: r.conversation_id,
        senderPlayerId: r.sender_player_id,
        content: r.content,
        createdAt: r.created_at,
      },
    };
  }

  public clearActiveConversation() {
    this.activeConversationId = null;
  }
}
