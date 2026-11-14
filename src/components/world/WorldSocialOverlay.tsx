import React, { useEffect, useRef, useState } from 'react';
import {
  MessageSquare,
  Send,
  X,
  Minimize2,
  Maximize2,
  Ban,
  Flag,
  AlertTriangle,
  Users,
  Check,
  Loader2,
  ShieldAlert,
  Car as CarIcon,
} from 'lucide-react';
import type { ProjectedRemotePlayer } from './WorldCanvas';
import type {
  ActiveConversationState,
  ChatInvitationItem,
  ModerationBlockFeedback,
  OutgoingInvitationState,
  RemotePlayerPeer,
} from '../../services/worldMultiplayerService';
import { VEHICLE_SPEC_PROFILES } from './worldModels';
import {
  blockDriverById,
  fetchMyBlockedPlayers,
  reportDriverById,
  unblockDriverById,
  type BlockedPlayerEntry,
} from '../../services/playerService';

interface WorldSocialOverlayProps {
  myPlayerId: string;
  remotePlayers: RemotePlayerPeer[];
  projectedPlayers: ProjectedRemotePlayer[];
  incomingInvite: ChatInvitationItem | null;
  outgoingInvite?: OutgoingInvitationState | null;
  activeConversation: ActiveConversationState | null;
  isChatMinimized: boolean;
  onToggleMinimizeChat: () => void;
  onCloseChat: () => void;
  onSendInvite: (recipientPlayerId: string) => Promise<{
    success: boolean;
    invitationId?: string;
    error?: string;
  }>;
  onCancelInvite?: (invitationId: string) => Promise<void>;
  onRespondInvite: (invitationId: string, accept: boolean) => Promise<void>;
  onSendMessage: (
    conversationId: string,
    content: string
  ) => Promise<{
    delivered: boolean;
    moderationWarning?: ModerationBlockFeedback;
    error?: string;
  }>;
  onPeerBlocked: (blockedPlayerId: string) => void;
  isNearbyPanelOpen: boolean;
  onCloseNearbyPanel: () => void;
  isBlockedPanelOpen: boolean;
  onCloseBlockedPanel: () => void;
  chatRestriction?: {
    restricted: boolean;
    permanent: boolean;
    untilFormatted: string;
    reason?: string | null;
  };
}

const REPORT_REASONS = [
  'Contact-sharing attempt (phone/email/social handle)',
  'Dating or unwanted personal solicitation',
  'Sexually explicit or inappropriate messages',
  'Harassment, threats, or abusive behavior',
  'Spam or scam attempt',
];

export const WorldSocialOverlay: React.FC<WorldSocialOverlayProps> = ({
  myPlayerId,
  remotePlayers,
  projectedPlayers,
  incomingInvite,
  outgoingInvite,
  activeConversation,
  isChatMinimized,
  onToggleMinimizeChat,
  onCloseChat,
  onSendInvite,
  onCancelInvite,
  onRespondInvite,
  onSendMessage,
  onPeerBlocked,
  isNearbyPanelOpen,
  onCloseNearbyPanel,
  isBlockedPanelOpen,
  onCloseBlockedPanel,
  chatRestriction,
}) => {
  const [selectedPeer, setSelectedPeer] = useState<RemotePlayerPeer | null>(null);
  const [inviteStatusMsg, setInviteStatusMsg] = useState<string | null>(null);
  const [isSendingInvite, setIsSendingInvite] = useState(false);
  const [isRespondingInvite, setIsRespondingInvite] = useState(false);
  const [confirmBlockPeerId, setConfirmBlockPeerId] = useState<string | null>(null);

  // Incoming invitation countdown
  const [inviteSecondsLeft, setInviteSecondsLeft] = useState<number>(30);
  useEffect(() => {
    if (!incomingInvite) return;
    const updateTimer = () => {
      const rem = Math.max(0, Math.ceil((Date.parse(incomingInvite.expiresAt) - Date.now()) / 1000));
      setInviteSecondsLeft(rem);
    };
    updateTimer();
    const id = window.setInterval(updateTimer, 500);
    return () => clearInterval(id);
  }, [incomingInvite]);

  // Outgoing invitation countdown
  const [outgoingSecondsLeft, setOutgoingSecondsLeft] = useState<number>(30);
  useEffect(() => {
    if (!outgoingInvite || outgoingInvite.status !== 'pending') return;
    const updateTimer = () => {
      const rem = Math.max(0, Math.ceil((Date.parse(outgoingInvite.expiresAt) - Date.now()) / 1000));
      setOutgoingSecondsLeft(rem);
    };
    updateTimer();
    const id = window.setInterval(updateTimer, 500);
    return () => clearInterval(id);
  }, [outgoingInvite]);

  // Reflect outgoing invite updates cleanly inside selectedPeer card if open
  useEffect(() => {
    if (!outgoingInvite || !selectedPeer) return;
    if (outgoingInvite.recipientPlayerId !== selectedPeer.playerId) return;
    if (outgoingInvite.status === 'accepted') {
      setSelectedPeer(null);
      setInviteStatusMsg(null);
    } else if (outgoingInvite.status === 'declined') {
      setInviteStatusMsg(`${outgoingInvite.recipientNickname} declined your chat request.`);
    } else if (outgoingInvite.status === 'expired') {
      setInviteStatusMsg(`Chat request to ${outgoingInvite.recipientNickname} expired.`);
    } else if (outgoingInvite.status === 'cancelled') {
      setInviteStatusMsg('Chat request cancelled.');
    }
  }, [outgoingInvite, selectedPeer]);

  // Keep selectedPeer synchronized with live peer list (clear if peer goes offline or leaves range)
  useEffect(() => {
    if (!selectedPeer) return;
    const livePeer = remotePlayers.find((p) => p.playerId === selectedPeer.playerId);
    if (!livePeer) {
      setSelectedPeer(null);
      setConfirmBlockPeerId(null);
    } else {
      setSelectedPeer(livePeer);
    }
  }, [remotePlayers, selectedPeer]);

  // Chat composer & moderation feedback
  const [draftText, setDraftText] = useState('');
  const [isSendingMsg, setIsSendingMsg] = useState(false);
  const [modWarning, setModWarning] = useState<ModerationBlockFeedback | null>(null);
  const [chatError, setChatError] = useState<string | null>(null);
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState(REPORT_REASONS[0]);
  const [reportDesc, setReportDesc] = useState('');
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const [blockedList, setBlockedList] = useState<BlockedPlayerEntry[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeConversation && !isChatMinimized) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeConversation?.messages.length, isChatMinimized]);

  useEffect(() => {
    if (isBlockedPanelOpen) {
      void fetchMyBlockedPlayers().then(setBlockedList);
    }
  }, [isBlockedPanelOpen]);

  const handleRequestChatClick = async (peerId: string) => {
    setIsSendingInvite(true);
    setInviteStatusMsg(null);
    try {
      const res = await onSendInvite(peerId);
      if (res.success) {
        setInviteStatusMsg('Chat request sent! Waiting for player response...');
      } else {
        setInviteStatusMsg(res.error || 'Could not send chat request.');
      }
    } finally {
      setIsSendingInvite(false);
    }
  };

  const handleBlockPeerDirect = async (peerId: string) => {
    const res = await blockDriverById(peerId);
    if (res.success) {
      setSelectedPeer(null);
      setConfirmBlockPeerId(null);
      onPeerBlocked(peerId);
    }
  };

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeConversation || !draftText.trim() || isSendingMsg) return;
    setChatError(null);
    setModWarning(null);
    setIsSendingMsg(true);
    try {
      const res = await onSendMessage(activeConversation.conversationId, draftText.trim());
      if (res.delivered) {
        setDraftText('');
      } else if (res.moderationWarning) {
        setModWarning(res.moderationWarning);
      } else {
        setChatError(res.error || 'Message could not be sent.');
      }
    } finally {
      setIsSendingMsg(false);
    }
  };

  const handleConfirmBlock = async () => {
    if (!activeConversation) return;
    const res = await blockDriverById(activeConversation.peerPlayerId);
    if (res.success) {
      setShowBlockConfirm(false);
      onPeerBlocked(activeConversation.peerPlayerId);
      onCloseChat();
    }
  };

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeConversation) return;
    const res = await reportDriverById({
      reportedPlayerId: activeConversation.peerPlayerId,
      conversationId: activeConversation.conversationId,
      reason: reportReason,
      description: reportDesc.trim(),
    });
    if (res.success) {
      setReportSubmitted(true);
      setTimeout(() => {
        setShowReportModal(false);
        setReportSubmitted(false);
        setReportDesc('');
      }, 1500);
    }
  };

  const isPendingInviteToSelected = Boolean(
    selectedPeer &&
      outgoingInvite &&
      outgoingInvite.recipientPlayerId === selectedPeer.playerId &&
      outgoingInvite.status === 'pending' &&
      outgoingSecondsLeft > 0
  );

  const isSelectedAlreadyInChat = Boolean(
    selectedPeer &&
      activeConversation &&
      activeConversation.peerPlayerId === selectedPeer.playerId
  );

  return (
    <>
      {/* 1. 3D PROJECTED VEHICLE NICKNAME TAGS (Online Active Unblocked Players Only) */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-15">
        {projectedPlayers
          .filter((p) => p.visible)
          .map((proj) => {
            const peer = remotePlayers.find((r) => r.playerId === proj.playerId);
            if (!peer) return null;
            return (
              <button
                key={proj.playerId}
                type="button"
                onClick={() => {
                  setSelectedPeer(peer);
                  setConfirmBlockPeerId(null);
                  setInviteStatusMsg(null);
                }}
                style={{
                  transform: `translate(${Math.round(proj.screenX)}px, ${Math.round(
                    proj.screenY
                  )}px) translate(-50%, -100%)`,
                }}
                className="pointer-events-auto absolute top-0 left-0 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-xl bg-[#071A2B]/86 hover:bg-[#EF233C] backdrop-blur-md border border-white/25 text-white shadow-lg transition-colors flex items-center gap-1.5 cursor-pointer group min-h-[26px]"
                title={`Tap to interact with ${proj.nickname}`}
              >
                <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-emerald-400 shrink-0" />
                <span className="text-[10px] sm:text-[11px] font-black tracking-wide max-w-[96px] truncate">
                  {proj.nickname}
                </span>
                <span className="text-[9px] font-mono text-gray-300 group-hover:text-white/90">
                  {proj.distance}m
                </span>
              </button>
            );
          })}
      </div>

      {/* 2. INTERACTIVE PLAYER CARD ("REQUEST CHAT") */}
      {selectedPeer && (
        <div className="absolute top-[138px] sm:top-[156px] left-1/2 -translate-x-1/2 z-40 w-[calc(100vw-2rem)] max-w-xs bg-[#071A2B]/96 backdrop-blur-2xl border border-white/20 rounded-2xl p-4 shadow-2xl pointer-events-auto">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400">
                  STATUS: ONLINE
                </span>
              </div>
              <h3 className="text-sm font-black text-white mt-1 uppercase tracking-wide truncate">
                PLAYER: {selectedPeer.nickname}
              </h3>
              <p className="text-[11px] text-gray-200 flex items-center gap-1.5 mt-1 truncate">
                <CarIcon className="w-3.5 h-3.5 text-[#EF233C] shrink-0" />
                <span className="truncate">
                  {VEHICLE_SPEC_PROFILES[selectedPeer.vehicleModel]?.name ||
                    selectedPeer.vehicleModel}
                </span>
              </p>
              <p className="text-[10px] text-gray-400 mt-0.5 truncate">
                {selectedPeer.worldRegion} • {selectedPeer.distance}m away
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setSelectedPeer(null);
                setConfirmBlockPeerId(null);
              }}
              className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 shrink-0 cursor-pointer"
              aria-label="Close Player Card"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {inviteStatusMsg && (
            <div className="mt-2.5 p-2 rounded-xl bg-white/10 text-[11px] text-sky-200">
              {inviteStatusMsg}
            </div>
          )}

          {isSelectedAlreadyInChat ? (
            <button
              type="button"
              onClick={() => {
                if (isChatMinimized) onToggleMinimizeChat();
                setSelectedPeer(null);
              }}
              className="mt-3 w-full h-9 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Open Active Chat</span>
            </button>
          ) : isPendingInviteToSelected && outgoingInvite ? (
            <div className="mt-3 flex items-center gap-2">
              <div className="flex-1 h-9 px-3 rounded-xl bg-white/10 border border-sky-400/30 text-[11px] font-bold text-sky-200 flex items-center justify-between">
                <span>Request Sent</span>
                <span className="font-mono text-amber-300">{outgoingSecondsLeft}s</span>
              </div>
              {onCancelInvite && (
                <button
                  type="button"
                  onClick={() => void onCancelInvite(outgoingInvite.invitationId)}
                  className="h-9 px-3 rounded-xl bg-white/10 hover:bg-red-500/25 text-gray-200 hover:text-white text-[10px] font-black uppercase cursor-pointer"
                >
                  Cancel
                </button>
              )}
            </div>
          ) : (
            <button
              type="button"
              disabled={isSendingInvite || Boolean(chatRestriction?.restricted)}
              onClick={() => void handleRequestChatClick(selectedPeer.playerId)}
              className="mt-3 w-full h-9 rounded-xl bg-[#EF233C] hover:bg-[#d90429] disabled:opacity-50 text-white text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer"
            >
              {isSendingInvite ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <MessageSquare className="w-3.5 h-3.5" />
              )}
              <span>
                {chatRestriction?.restricted ? 'CHAT RESTRICTED' : 'REQUEST CHAT'}
              </span>
            </button>
          )}

          {chatRestriction?.restricted && (
            <p className="mt-2 text-[10px] text-amber-300 leading-snug">
              {chatRestriction.permanent
                ? 'Your chat privileges are permanently restricted. Driving remains active.'
                : `Chat temporarily restricted${
                    chatRestriction.untilFormatted ? ` until ${chatRestriction.untilFormatted}` : ''
                  }.`}
            </p>
          )}

          {/* Direct Safety Block Option */}
          <div className="mt-2.5 pt-2 border-t border-white/10 flex items-center justify-between">
            {confirmBlockPeerId === selectedPeer.playerId ? (
              <div className="flex items-center justify-between w-full gap-2">
                <span className="text-[10px] text-red-300 font-bold">
                  Block {selectedPeer.nickname}?
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => void handleBlockPeerDirect(selectedPeer.playerId)}
                    className="px-2.5 py-1 rounded-lg bg-red-600 text-white text-[10px] font-black uppercase cursor-pointer"
                  >
                    Confirm
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmBlockPeerId(null)}
                    className="px-2 py-1 rounded-lg bg-white/10 text-gray-300 text-[10px] cursor-pointer"
                  >
                    No
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmBlockPeerId(selectedPeer.playerId)}
                className="text-[10px] font-bold text-gray-400 hover:text-red-400 flex items-center gap-1 cursor-pointer"
              >
                <Ban className="w-3 h-3" />
                <span>Block Player</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* 3. INCOMING CHAT INVITATION CARD (Two-Way Acceptance Prompt) */}
      {incomingInvite && inviteSecondsLeft > 0 && (
        <div className="absolute top-[138px] sm:top-[156px] left-3 sm:left-6 z-40 w-[calc(100vw-1.5rem)] max-w-xs bg-[#071A2B]/96 backdrop-blur-2xl border border-emerald-400/55 rounded-2xl p-3.5 shadow-2xl pointer-events-auto">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400">
              PLAYER WANTS TO CHAT
            </span>
            <span className="text-[10px] font-mono font-bold text-amber-300 tabular-nums">
              {inviteSecondsLeft}s
            </span>
          </div>
          <p className="text-xs text-white font-semibold mb-3">
            <strong className="font-black">{incomingInvite.senderNickname}</strong> wants to start
            a conversation with you.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={isRespondingInvite}
              onClick={async () => {
                setIsRespondingInvite(true);
                try {
                  await onRespondInvite(incomingInvite.id, true);
                } finally {
                  setIsRespondingInvite(false);
                }
              }}
              className="h-8.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 text-xs font-black uppercase flex items-center justify-center gap-1 cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Accept</span>
            </button>
            <button
              type="button"
              disabled={isRespondingInvite}
              onClick={async () => {
                setIsRespondingInvite(true);
                try {
                  await onRespondInvite(incomingInvite.id, false);
                } finally {
                  setIsRespondingInvite(false);
                }
              }}
              className="h-8.5 rounded-xl bg-white/10 hover:bg-white/20 disabled:opacity-50 text-gray-200 text-xs font-bold uppercase flex items-center justify-center gap-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Decline</span>
            </button>
          </div>
        </div>
      )}

      {/* 4. COMPACT FLOATING PRIVATE TWO-WAY CHAT CARD (Above Mobile Pedals Safe Zone) */}
      {activeConversation && (
        <div
          className={`absolute right-3 sm:right-6 top-[138px] sm:top-[156px] lg:top-auto lg:bottom-28 z-40 pointer-events-auto transition-all ${
            isChatMinimized ? 'w-56' : 'w-[calc(100vw-1.5rem)] sm:w-88'
          }`}
        >
          <div className="bg-[#071A2B]/96 backdrop-blur-2xl border border-white/20 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <div className="px-3.5 py-2.5 bg-[#0b233a] border-b border-white/10 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    activeConversation.peerOnline ? 'bg-emerald-400' : 'bg-gray-400'
                  }`}
                />
                <div className="min-w-0">
                  <span className="text-xs font-black text-white block truncate">
                    {activeConversation.peerNickname}
                  </span>
                  <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-400 block">
                    {activeConversation.peerOnline ? 'Online Nearby' : 'Connected'}
                  </span>
                </div>
                {isChatMinimized && activeConversation.unreadCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-[#EF233C] text-[10px] font-black text-white">
                    {activeConversation.unreadCount}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {!isChatMinimized && (
                  <>
                    <button
                      type="button"
                      onClick={() => setShowReportModal(true)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-amber-300 hover:bg-white/10 cursor-pointer"
                      title="Report Driver"
                    >
                      <Flag className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowBlockConfirm((p) => !p)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-white/10 cursor-pointer"
                      title="Block Driver"
                    >
                      <Ban className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={onToggleMinimizeChat}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 cursor-pointer"
                  title={isChatMinimized ? 'Expand Chat' : 'Minimize Chat'}
                >
                  {isChatMinimized ? (
                    <Maximize2 className="w-3.5 h-3.5" />
                  ) : (
                    <Minimize2 className="w-3.5 h-3.5" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={onCloseChat}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 cursor-pointer"
                  title="Close Chat"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {!isChatMinimized && (
              <>
                {showBlockConfirm && (
                  <div className="p-2.5 bg-red-500/15 border-b border-red-500/30 flex items-center justify-between gap-2 text-[11px]">
                    <span className="text-red-200 font-semibold">
                      Block {activeConversation.peerNickname}? Chat will close.
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => void handleConfirmBlock()}
                        className="px-2 py-1 rounded-lg bg-red-600 text-white font-black uppercase text-[10px] cursor-pointer"
                      >
                        Block
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowBlockConfirm(false)}
                        className="px-2 py-1 rounded-lg bg-white/10 text-gray-200 text-[10px] cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                <div className="h-44 sm:h-52 overflow-y-auto p-3 space-y-2 text-xs">
                  {activeConversation.messages.length === 0 ? (
                    <p className="text-center text-gray-400 text-[11px] py-6">
                      Say hello to {activeConversation.peerNickname}. Keep chat friendly and about
                      cars, routes, or music.
                    </p>
                  ) : (
                    activeConversation.messages.map((m) => {
                      const isMine = m.senderPlayerId === myPlayerId;
                      return (
                        <div
                          key={m.id}
                          className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
                        >
                          <div
                            className={`max-w-[85%] px-3 py-1.5 rounded-2xl leading-snug ${
                              isMine
                                ? 'bg-[#EF233C] text-white rounded-br-sm'
                                : 'bg-white/10 text-gray-100 rounded-bl-sm'
                            }`}
                          >
                            {m.content}
                          </div>
                          <span className="text-[9px] text-gray-500 mt-0.5 px-1">
                            {new Date(m.createdAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {modWarning && (
                  <div className="mx-3 mb-2 p-2.5 rounded-xl bg-amber-500/15 border border-amber-400/50 text-[11px] text-amber-200 space-y-1">
                    <div className="flex items-center gap-1.5 font-black text-amber-300">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span>{modWarning.message}</span>
                    </div>
                    {modWarning.explanation && (
                      <p className="text-[10px] text-gray-200">{modWarning.explanation}</p>
                    )}
                  </div>
                )}

                {chatError && (
                  <div className="mx-3 mb-2 p-2 rounded-xl bg-red-500/15 border border-red-500/40 text-[11px] text-red-200">
                    {chatError}
                  </div>
                )}

                {chatRestriction?.restricted && (
                  <div className="mx-3 mb-2 p-2.5 rounded-xl bg-amber-500/15 border border-amber-400/50 text-[11px] text-amber-200 space-y-0.5">
                    <div className="flex items-center gap-1.5 font-black text-amber-300">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span>
                        {chatRestriction.permanent
                          ? 'Chat Permanently Restricted'
                          : `Chat Restricted${
                              chatRestriction.untilFormatted
                                ? ` Until ${chatRestriction.untilFormatted}`
                                : ''
                            }`}
                      </span>
                    </div>
                    {chatRestriction.reason && (
                      <p className="text-[10px] text-gray-200">{chatRestriction.reason}</p>
                    )}
                  </div>
                )}

                <form
                  onSubmit={handleSendChat}
                  className="p-2.5 border-t border-white/10 bg-black/25 space-y-1.5"
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      maxLength={500}
                      disabled={Boolean(chatRestriction?.restricted)}
                      value={draftText}
                      onChange={(e) => setDraftText(e.target.value)}
                      placeholder={
                        chatRestriction?.restricted
                          ? 'Chat access currently restricted...'
                          : 'Message driver (no phone/socials/links)...'
                      }
                      className="flex-1 h-9 px-3 rounded-xl bg-white/5 border border-white/15 text-xs text-white placeholder-gray-500 focus:border-[#EF233C] outline-none disabled:opacity-50"
                    />
                    <button
                      type="submit"
                      disabled={
                        isSendingMsg ||
                        !draftText.trim() ||
                        Boolean(chatRestriction?.restricted)
                      }
                      className="h-9 px-3 rounded-xl bg-[#EF233C] hover:bg-[#d90429] disabled:opacity-45 text-white flex items-center justify-center cursor-pointer shrink-0"
                    >
                      {isSendingMsg ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Send className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                  <div className="flex justify-between text-[9px] text-gray-500 px-1">
                    <span>Community-moderated private chat</span>
                    <span className="font-mono tabular-nums">{draftText.length}/500</span>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}

      {/* 5. NEARBY DRIVERS MODAL (From Game Menu) */}
      {isNearbyPanelOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 pointer-events-auto">
          <div className="w-full max-w-md bg-[#071A2B] border border-white/15 rounded-3xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-black uppercase text-white">
                  Nearby Drivers ({remotePlayers.length})
                </h3>
              </div>
              <button
                type="button"
                onClick={onCloseNearbyPanel}
                className="p-1 text-gray-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {chatRestriction?.restricted && (
              <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-400/40 text-xs text-amber-200">
                <strong className="font-black text-amber-300 block">
                  {chatRestriction.permanent
                    ? 'Chat Permanently Restricted'
                    : `Chat Restricted${
                        chatRestriction.untilFormatted
                          ? ` Until ${chatRestriction.untilFormatted}`
                          : ''
                      }`}
                </strong>
                <span>
                  You can continue driving across Lagos normally, but sending chat requests is
                  disabled.
                </span>
              </div>
            )}

            {inviteStatusMsg && (
              <div className="p-2.5 rounded-xl bg-sky-500/15 border border-sky-400/30 text-xs text-sky-200">
                {inviteStatusMsg}
              </div>
            )}

            <div className="max-h-72 overflow-y-auto space-y-2">
              {remotePlayers.length === 0 ? (
                <div className="p-6 text-center text-xs text-gray-400">
                  No other active drivers within proximity range right now. Cruise Lagos Island,
                  Third Mainland Bridge, or Lekki to meet drivers nearby.
                </div>
              ) : (
                remotePlayers.map((peer) => {
                  const isPending =
                    outgoingInvite?.recipientPlayerId === peer.playerId &&
                    outgoingInvite?.status === 'pending';
                  return (
                    <div
                      key={peer.playerId}
                      className="p-3 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-400" />
                          <span className="text-xs font-black text-white truncate">
                            {peer.nickname}
                          </span>
                        </div>
                        <span className="text-[11px] text-gray-400 block truncate">
                          {VEHICLE_SPEC_PROFILES[peer.vehicleModel]?.name} • {peer.distance}m away
                        </span>
                      </div>
                      <button
                        type="button"
                        disabled={Boolean(chatRestriction?.restricted) || isPending}
                        onClick={() => void handleRequestChatClick(peer.playerId)}
                        className="px-3 py-1.5 rounded-xl bg-[#EF233C] hover:bg-[#d90429] disabled:opacity-45 text-white text-[11px] font-black uppercase shrink-0 whitespace-nowrap cursor-pointer"
                      >
                        {chatRestriction?.restricted
                          ? 'Restricted'
                          : isPending
                          ? 'Pending'
                          : 'Request Chat'}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* 6. BLOCKED PLAYERS MODAL (From Player Menu) */}
      {isBlockedPanelOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 pointer-events-auto">
          <div className="w-full max-w-md bg-[#071A2B] border border-white/15 rounded-3xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Ban className="w-4 h-4 text-red-400" />
                <h3 className="text-sm font-black uppercase text-white">Blocked Drivers</h3>
              </div>
              <button
                type="button"
                onClick={onCloseBlockedPanel}
                className="p-1 text-gray-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="max-h-64 overflow-y-auto space-y-2">
              {blockedList.length === 0 ? (
                <p className="text-center text-xs text-gray-400 py-6">
                  You have not blocked any drivers.
                </p>
              ) : (
                blockedList.map((entry) => (
                  <div
                    key={entry.block_id}
                    className="p-3 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between"
                  >
                    <span className="text-xs font-bold text-white">{entry.nickname}</span>
                    <button
                      type="button"
                      onClick={async () => {
                        await unblockDriverById(entry.blocked_player_id);
                        setBlockedList((prev) =>
                          prev.filter((x) => x.block_id !== entry.block_id)
                        );
                      }}
                      className="px-3 py-1 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold text-gray-200 cursor-pointer"
                    >
                      Unblock
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* 7. REPORT DRIVER MODAL */}
      {showReportModal && activeConversation && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 pointer-events-auto">
          <form
            onSubmit={handleSubmitReport}
            className="w-full max-w-md bg-[#071A2B] border border-white/15 rounded-3xl p-5 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-black uppercase text-white">
                  Report {activeConversation.peerNickname}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowReportModal(false)}
                className="p-1 text-gray-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {reportSubmitted ? (
              <div className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-400/40 text-xs text-emerald-200 text-center font-bold">
                Report submitted to MANIFOLD Safety Review. Thank you.
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-[11px] font-bold uppercase text-gray-300 mb-1.5">
                    Reason
                  </label>
                  <select
                    value={reportReason}
                    onChange={(e) => setReportReason(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl bg-white/5 border border-white/15 text-xs text-white outline-none"
                  >
                    {REPORT_REASONS.map((r) => (
                      <option key={r} value={r} className="bg-[#071A2B] text-white">
                        {r}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase text-gray-300 mb-1.5">
                    Additional Details (Optional)
                  </label>
                  <textarea
                    rows={3}
                    maxLength={500}
                    value={reportDesc}
                    onChange={(e) => setReportDesc(e.target.value)}
                    placeholder="Describe what happened..."
                    className="w-full p-3 rounded-xl bg-white/5 border border-white/15 text-xs text-white outline-none resize-none"
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowReportModal(false)}
                    className="px-4 py-2 rounded-xl bg-white/10 text-xs font-bold text-gray-300 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-[#EF233C] text-white text-xs font-black uppercase cursor-pointer"
                  >
                    Submit Report
                  </button>
                </div>
              </>
            )}
          </form>
        </div>
      )}
    </>
  );
};
