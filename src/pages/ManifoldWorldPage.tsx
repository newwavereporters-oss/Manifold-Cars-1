import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  WorldCanvas,
  CameraViewMode,
  TimeOfDay,
  type ProjectedRemotePlayer,
} from '../components/world/WorldCanvas';
import { WorldHUD } from '../components/world/WorldHUD';
import { type VirtualDrivingInput } from '../components/world/MobileTouchControls';
import { CustomizerDrawer } from '../components/world/CustomizerDrawer';
import { MarketplaceGatewayModal } from '../components/world/MarketplaceGatewayModal';
import { VehicleInspectorModal } from '../components/world/VehicleInspectorModal';
import { DealerLoungeModal } from '../components/world/DealerLoungeModal';
import { CityMapModal } from '../components/world/CityMapModal';
import { MissionHUDOverlay } from '../components/world/MissionHUDOverlay';
import { MusicLibraryModal } from '../components/world/MusicLibraryModal';
import { WorldGateAuth } from '../components/world/WorldGateAuth';
import { WorldBriefingPortal } from '../components/world/WorldBriefingPortal';
import { VehicleConfigPortal } from '../components/world/VehicleConfigPortal';
import { WorldSocialOverlay } from '../components/world/WorldSocialOverlay';
import {
  MissionManager,
  ActiveMissionSession,
  MissionDef,
  MissionId,
  MISSIONS_CATALOG,
} from '../components/world/missionEngine';
import type { CoastalRaceState } from '../components/world/rivalsEngine';
import {
  CarCustomization,
  VehicleModelType,
  HeadlightState,
  TurnSignalState,
  TransmissionGear,
  type MusicPreference,
} from '../components/world/worldModels';
import { AudioDriveMode, engineAudio } from '../utils/engineAudio';
import { musicLibrary } from '../utils/musicLibraryService';
import { billboardService, type GameBillboardItem } from '../services/billboardService';
import {
  dispatchBestEffortPageExitAbandon,
  missionService,
  type MissionProgressStat,
} from '../services/missionService';
import { Car } from '../types';
import {
  isSupabaseConfigured,
  supabase,
  supabasePublishableKey,
  supabaseUrl,
} from '../lib/supabase';
import {
  checkWorldDbStatus,
  computeLockStatus,
  fetchMyPlayerProfile,
  isPlayerChatRestricted,
  logoutPlayerAccount,
  type PlayerProfile,
  type WorldDbStatus,
} from '../services/playerService';
import {
  WorldMultiplayerSession,
  type ActiveConversationState,
  type ChatInvitationItem,
  type ChatMessageItem,
  type OutgoingInvitationState,
  type RemotePlayerPeer,
} from '../services/worldMultiplayerService';
import { Ban, Loader2, LogOut, RotateCcw } from 'lucide-react';
import {
  getSavedQualityMode,
  saveQualityMode,
  resolveWebGLProfile,
  type WebGLQualityMode,
} from '../utils/webglPerformance';

interface ManifoldWorldPageProps {
  cars: Car[];
  navigate: (route: string) => void;
  onSelectCar: (car: Car) => void;
  onPlayVideo: (car: Car) => void;
  onInterested: (car: Car) => void;
}

const MUSIC_TO_STATION: Record<MusicPreference, number> = {
  NO_MUSIC: 0,
  AFROBEATS: 1,
  HIP_HOP: 2,
  RNB: 3,
  GOSPEL: 4,
  INSTRUMENTAL: 5,
  ELECTRONIC_HOUSE: 6,
};

const DEFAULT_CUSTOMIZATION: CarCustomization = {
  vehicleType: 'SPORTS_COUPE',
  paintColor: '#DC2626',
  finish: 'metallic',
  rimColor: '#E2E8F0',
  caliperColor: '#EF233C',
  headlightTint: '#ffffff',
  windowTint: 0.45,
  spoiler: 'GT_WING',
  underglow: 'NONE',
  ecuStage: 0,
  suspension: 'STOCK',
  brakes: 'OEM',
  tires: 'ALL_SEASON',
  interiorTheme: 'BLACK',
  musicPreference: 'AFROBEATS',
};

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    target.isContentEditable
  );
}

export const ManifoldWorldPage: React.FC<ManifoldWorldPageProps> = ({
  cars,
  navigate,
  onSelectCar,
  onPlayVideo,
  onInterested,
}) => {
  // Authentication, Onboarding & 24h Lock State
  const [authChecking, setAuthChecking] = useState(true);
  const [dbStatus, setDbStatus] = useState<WorldDbStatus | null>(null);
  const [playerProfile, setPlayerProfile] = useState<PlayerProfile | null>(null);
  const [serverClockOffsetMs, setServerClockOffsetMs] = useState(0);
  const [isConfigViewerOpen, setIsConfigViewerOpen] = useState(false);
  const [lockTick, setLockTick] = useState(0);
  const accessTokenRef = useRef<string | null>(null);
  const lastAppliedPlayerIdRef = useRef<string | null>(null);

  // Vehicle Customization & Active Model State
  const [customization, setCustomization] = useState<CarCustomization>(() => {
    try {
      const saved = localStorage.getItem('manifold_world_custom');
      return saved ? { ...DEFAULT_CUSTOMIZATION, ...JSON.parse(saved) } : DEFAULT_CUSTOMIZATION;
    } catch {
      return DEFAULT_CUSTOMIZATION;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('manifold_world_custom', JSON.stringify(customization));
    } catch {}
  }, [customization]);

  // Virtual Economy (MANIFOLD Credits - authoritative from player_profiles DB)
  const [playerCredits, setPlayerCredits] = useState<number>(5000);

  const [creditNotification, setCreditNotification] = useState<{
    amount: number;
    reason: string;
  } | null>(null);

  const [qualityMode, setQualityMode] = useState<WebGLQualityMode>(() => getSavedQualityMode());
  const [initStage, setInitStage] = useState<{ step: string; progress: number }>({
    step: 'Preparing Lagos world...',
    progress: 15,
  });
  const [webglContextLost, setWebglContextLost] = useState(false);
  const [worldRetryKey, setWorldRetryKey] = useState(0);
  const [initStalled, setInitStalled] = useState(false);

  const handleQualityModeChange = useCallback((mode: WebGLQualityMode) => {
    setQualityMode(mode);
    saveQualityMode(mode);
  }, []);

  const handleAwardCredits = useCallback((amount: number, reason: string) => {
    setPlayerCredits((prev) => prev + amount);
    setCreditNotification({ amount, reason });
    setTimeout(() => {
      setCreditNotification(null);
    }, 3500);
  }, []);

  // World & Camera State (Default: DAYLIGHT and CHASE)
  const [cameraMode, setCameraMode] = useState<CameraViewMode>('CHASE');
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>('DAYLIGHT');
  const [activeZone, setActiveZone] = useState<string | null>(null);

  // Vehicle Systems State
  const [isEngineRunning, setIsEngineRunning] = useState<boolean>(true);
  const [driveMode, setDriveMode] = useState<AudioDriveMode>('SPORT');
  const [selectedGear, setSelectedGear] = useState<TransmissionGear>('D2');
  const [headlightState, setHeadlightState] = useState<HeadlightState>('LOW');
  const [turnSignal, setTurnSignal] = useState<TurnSignalState>('OFF');
  const [hazardLights, setHazardLights] = useState<boolean>(false);
  const [hornActive, setHornActive] = useState<boolean>(false);
  const [radioStation, setRadioStation] = useState<number>(1);
  const [radioVolume, setRadioVolume] = useState<number>(0.7);

  // Music Library & Dealer Billboard State
  const [isMusicLibraryOpen, setIsMusicLibraryOpen] = useState(false);
  const [isMusicPlaying, setIsMusicPlaying] = useState(false);
  const [billboardItems, setBillboardItems] = useState<GameBillboardItem[]>([]);

  // Vehicle Telemetry
  const [speedKmh, setSpeedKmh] = useState<number>(0);
  const [rpm, setRpm] = useState<number>(850);
  const [gear, setGear] = useState<string>('D2');
  const [speedTrapRecord, setSpeedTrapRecord] = useState<number | null>(null);
  const [carPosition, setCarPosition] = useState<{
    x: number;
    y?: number;
    z: number;
    heading: number;
    speed?: number;
  }>({
    x: 0,
    y: 0,
    z: 10,
    heading: Math.PI,
    speed: 0,
  });

  // Virtual Touch Input
  const [virtualInputState, setVirtualInputState] = useState<VirtualDrivingInput>({
    forward: false,
    backward: false,
    left: false,
    right: false,
    handbrake: false,
  });

  const handleVirtualInput = useCallback((input: VirtualDrivingInput) => {
    setVirtualInputState(input);
  }, []);

  // Modals & Drawers
  const [isCustomizerOpen, setIsCustomizerOpen] = useState(false);
  const [isMarketplaceModalOpen, setIsMarketplaceModalOpen] = useState(false);
  const [isDealerLoungeOpen, setIsDealerLoungeOpen] = useState(false);
  const [isCityMapOpen, setIsCityMapOpen] = useState(false);
  const [isMissionDrawerOpen, setIsMissionDrawerOpen] = useState(false);
  const [inspectingCar, setInspectingCar] = useState<Car | null>(null);
  const [resetVehicleTrigger, setResetVehicleTrigger] = useState<number>(0);

  // Multiplayer & Social Chat State
  const mpSessionRef = useRef<WorldMultiplayerSession | null>(null);
  const [remotePlayers, setRemotePlayers] = useState<RemotePlayerPeer[]>([]);
  const [projectedPlayers, setProjectedPlayers] = useState<ProjectedRemotePlayer[]>([]);
  const [incomingInvite, setIncomingInvite] = useState<ChatInvitationItem | null>(null);
  const [outgoingInvite, setOutgoingInvite] = useState<OutgoingInvitationState | null>(null);
  const [activeConversation, setActiveConversation] = useState<ActiveConversationState | null>(
    null
  );
  const [isChatMinimized, setIsChatMinimized] = useState(false);
  const [isNearbyPanelOpen, setIsNearbyPanelOpen] = useState(false);
  const [isBlockedPanelOpen, setIsBlockedPanelOpen] = useState(false);
  const [socialToast, setSocialToast] = useState<string | null>(null);

  const isChatMinimizedRef = useRef(isChatMinimized);
  isChatMinimizedRef.current = isChatMinimized;

  // Lagos GPS Waypoint, Traffic/Rival Radar & Active Mission Engine
  const [activeDestination, setActiveDestination] = useState<{
    x: number;
    z: number;
    name: string;
  } | null>(null);
  const [trafficPositions, setTrafficPositions] = useState<{ x: number; z: number }[]>([]);
  const [rivalPositions, setRivalPositions] = useState<
    { name: string; x: number; z: number }[]
  >([]);
  const [missionSession, setMissionSession] = useState<ActiveMissionSession | null>(null);
  const [coastalRaceCommand, setCoastalRaceCommand] = useState<{
    action: 'START' | 'EXIT';
    seq: number;
  } | null>(null);
  const [coastalRaceState, setCoastalRaceState] = useState<CoastalRaceState | null>(null);
  const [missionOverrides, setMissionOverrides] = useState<Record<string, Partial<MissionDef>>>({});
  const [missionProgress, setMissionProgress] = useState<Record<string, MissionProgressStat>>({});
  const [serverMissionOffsetMs, setServerMissionOffsetMs] = useState(0);
  const missionOverridesRef = useRef<Record<string, Partial<MissionDef>>>({});
  missionOverridesRef.current = missionOverrides;
  const missionManagerRef = useRef<MissionManager>(new MissionManager());
  const lastMissionUiHashRef = useRef<string>('');
  const rewardedRunTokensRef = useRef<Set<string>>(new Set());
  const activeUnfinalizedRunRef = useRef<{ missionId: string; runToken: string } | null>(null);
  const keepaliveAbandonSentRef = useRef<Set<string>>(new Set());

  const applyProfileToWorld = useCallback((profile: PlayerProfile, offsetMs: number) => {
    const isAccountSwitch = lastAppliedPlayerIdRef.current !== profile.id;
    lastAppliedPlayerIdRef.current = profile.id;
    setPlayerProfile(profile);
    setServerClockOffsetMs(offsetMs);

    const musicPref = profile.selected_music_preference || 'AFROBEATS';

    setCustomization((prev) => ({
      ...(isAccountSwitch ? DEFAULT_CUSTOMIZATION : prev),
      vehicleType: profile.selected_vehicle || DEFAULT_CUSTOMIZATION.vehicleType || 'SPORTS_COUPE',
      paintColor: profile.selected_vehicle_color || DEFAULT_CUSTOMIZATION.paintColor || '#DC2626',
      interiorTheme: profile.selected_interior || DEFAULT_CUSTOMIZATION.interiorTheme || 'BLACK',
      musicPreference: musicPref,
    }));

    // Keep synth FM radio muted while Default Music Library ("Downtown") is the primary soundtrack
    setRadioStation(0);
    engineAudio.setRadioStation(0);

    if (typeof profile.credits_balance === 'number') {
      setPlayerCredits(profile.credits_balance);
    }
  }, []);

  const hasAutoStartedMusicRef = useRef(false);

  // Bootstrap World DB status + existing authenticated session
  useEffect(() => {
    let mounted = true;
    const bootstrap = async () => {
      const status = await checkWorldDbStatus();
      if (!mounted) return;
      setDbStatus(status);

      if (isSupabaseConfigured) {
        const { data: sessionData } = await supabase.auth.getSession();
        accessTokenRef.current = sessionData.session?.access_token || null;

        if (sessionData.session) {
          const res = await fetchMyPlayerProfile();
          if (mounted && res.success && res.profile) {
            applyProfileToWorld(res.profile, res.serverClockOffsetMs || 0);
          }
        }
      }
      if (mounted) setAuthChecking(false);
    };

    void bootstrap();

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      accessTokenRef.current = session?.access_token || null;
      if (event === 'SIGNED_OUT') {
        lastAppliedPlayerIdRef.current = null;
        setPlayerProfile(null);
        setCustomization(DEFAULT_CUSTOMIZATION);
        setPlayerCredits(5000);
        setIsConfigViewerOpen(false);
        setActiveConversation(null);
        setIncomingInvite(null);
        setOutgoingInvite(null);
        setRemotePlayers([]);
        setProjectedPlayers([]);
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [applyProfileToWorld]);

  // Determine Current Gate Stage
  const worldStage: 'CHECKING' | 'AUTH' | 'SUSPENDED' | 'BRIEFING' | 'CONFIG' | 'GAME' = (() => {
    if (authChecking) return 'CHECKING';
    if (!playerProfile) return 'AUTH';
    if (playerProfile.account_status === 'suspended') return 'SUSPENDED';
    if (!playerProfile.terms_accepted || playerProfile.onboarding_status === 'registered') {
      return 'BRIEFING';
    }
    if (playerProfile.onboarding_status === 'briefing_accepted' || isConfigViewerOpen) {
      return 'CONFIG';
    }
    return 'GAME';
  })();

  const webglProfileHint = useMemo(() => resolveWebGLProfile(qualityMode), [qualityMode]);
  const shouldRenderWorldCanvas =
    worldStage === 'GAME' ||
    (worldStage !== 'CONFIG' &&
      !webglProfileHint.isMobileViewport &&
      !webglProfileHint.isSoftwareRenderer &&
      qualityMode !== 'PERFORMANCE');

  useEffect(() => {
    if (!shouldRenderWorldCanvas) {
      setInitStage({ step: 'Preparing Lagos world...', progress: 15 });
      setInitStalled(false);
      return;
    }
    setWebglContextLost(false);
    setInitStalled(false);
  }, [shouldRenderWorldCanvas, worldRetryKey]);

  useEffect(() => {
    if (worldStage !== 'GAME' || initStage.progress >= 100 || webglContextLost) {
      setInitStalled(false);
      return;
    }
    const timer = window.setTimeout(() => setInitStalled(true), 14000);
    return () => window.clearTimeout(timer);
  }, [worldStage, initStage.progress, webglContextLost, worldRetryKey]);

  // Live 1s countdown tick for 24h lock state
  useEffect(() => {
    if (worldStage !== 'GAME') return;
    const id = window.setInterval(() => setLockTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [worldStage]);

  void lockTick;
  const lockStatus = computeLockStatus(
    playerProfile?.settings_lock_expires_at,
    serverClockOffsetMs
  );

  // Subscribe to persistent Music Library player state
  useEffect(() => {
    return musicLibrary.subscribe((snap) => {
      setIsMusicPlaying(snap.isPlaying);
    });
  }, []);

  // Fetch Dealer Game Billboards & Server Mission Config/Progress inside GAME stage
  const loadMissionOverview = useCallback(async () => {
    const overview = await missionService.getMyMissionOverview();
    const map: Record<string, Partial<MissionDef>> = {};
    for (const row of overview.missions) {
      const parsedCheckpoints = Array.isArray(row.checkpoints)
        ? row.checkpoints
            .filter((cp) => typeof cp?.x === 'number' && typeof cp?.z === 'number')
            .map((cp, idx) => ({
              x: cp.x,
              z: cp.z,
              radius: typeof cp.radius === 'number' && cp.radius > 0 ? cp.radius : 14,
              name: cp.name || `Checkpoint ${idx + 1}`,
            }))
        : undefined;

      map[row.id] = {
        title: row.title,
        subTitle: row.subtitle,
        briefing: row.description,
        ...(row.start_location_name ? { startLocationName: row.start_location_name } : {}),
        ...(typeof row.start_x === 'number' ? { startX: row.start_x } : {}),
        ...(typeof row.start_z === 'number' ? { startZ: row.start_z } : {}),
        ...(row.destination_name ? { destinationName: row.destination_name } : {}),
        ...(typeof row.dest_x === 'number' ? { destX: row.dest_x } : {}),
        ...(typeof row.dest_z === 'number' ? { destZ: row.dest_z } : {}),
        ...(typeof row.dest_radius === 'number' ? { destRadius: row.dest_radius } : {}),
        ...(parsedCheckpoints ? { checkpoints: parsedCheckpoints } : {}),
        distanceMeters: row.distance_meters,
        estimatedMinutes: row.estimated_minutes,
        baseRewardCredits: row.reward_credits,
        reputationXP: row.reward_xp,
        rewardBadge: row.reward_badge ?? undefined,
        timeLimitSec: row.time_limit_seconds,
        difficulty: row.difficulty,
        cooldownSec: row.cooldown_seconds,
        requiresNoCollision: row.requires_no_collision,
        requireParkGear: row.require_park_gear,
        is_active: row.is_active,
      };
    }
    setMissionOverrides(map);
    setMissionProgress(overview.progress || {});
    const parsedNow = Date.parse(overview.serverNow);
    if (!Number.isNaN(parsedNow)) {
      setServerMissionOffsetMs(parsedNow - Date.now());
    }
  }, []);

  useEffect(() => {
    if (worldStage !== 'GAME') return;
    let mounted = true;
    const refreshBillboards = () => {
      void billboardService.getActiveBillboards().then((items) => {
        if (mounted) setBillboardItems(items);
      });
    };
    refreshBillboards();
    void loadMissionOverview();
    const timer = window.setInterval(refreshBillboards, 60000);
    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, [worldStage, loadMissionOverview]);

  // Autoplay default track ("Downtown" by Petula Clark) on entering GAME; pause cleanly when leaving
  useEffect(() => {
    if (worldStage === 'GAME') {
      if (!hasAutoStartedMusicRef.current) {
        hasAutoStartedMusicRef.current = true;
        engineAudio.setRadioStation(0);
        setRadioStation(0);
        musicLibrary.play();
      }
    } else {
      engineAudio.stop();
      if (worldStage === 'AUTH' || worldStage === 'SUSPENDED') {
        hasAutoStartedMusicRef.current = false;
        musicLibrary.pause();
      }
    }
  }, [worldStage]);

  // Guarantee all game sound (engine, horn, radio, and music tracks) stops immediately on leaving the 3D world
  useEffect(() => {
    return () => {
      hasAutoStartedMusicRef.current = false;
      engineAudio.stop();
      musicLibrary.pause();
    };
  }, []);

  // Multiplayer Session Lifecycle (runs strictly when player is active inside GAME)
  useEffect(() => {
    if (worldStage !== 'GAME' || !playerProfile) {
      if (mpSessionRef.current) {
        mpSessionRef.current.stop();
        mpSessionRef.current = null;
      }
      setOutgoingInvite(null);
      return;
    }

    const session = new WorldMultiplayerSession(playerProfile, {
      onPeersChange: (peers) => setRemotePlayers(peers),
      onIncomingInvite: (inv) => setIncomingInvite(inv),
      onOutgoingInviteUpdate: (inv) => {
        if (!inv) {
          setOutgoingInvite(null);
          return;
        }
        if (inv.status === 'pending') {
          setOutgoingInvite(inv);
        } else {
          setOutgoingInvite(null);
          if (inv.status === 'declined') {
            setSocialToast(`${inv.recipientNickname} declined your chat request.`);
            setTimeout(() => setSocialToast(null), 3500);
          } else if (inv.status === 'expired') {
            setSocialToast(`Chat request to ${inv.recipientNickname} expired.`);
            setTimeout(() => setSocialToast(null), 3500);
          }
        }
      },
      onConversationOpen: (conv) => {
        setOutgoingInvite(null);
        setActiveConversation(conv);
        setIsChatMinimized(false);
      },
      onPeerPresenceChange: (peerPlayerId, online) => {
        setActiveConversation((prev) =>
          prev && prev.peerPlayerId === peerPlayerId && prev.peerOnline !== online
            ? { ...prev, peerOnline: online }
            : prev
        );
      },
      onMessageReceived: (msg: ChatMessageItem) => {
        setActiveConversation((prev) => {
          if (!prev || prev.conversationId !== msg.conversationId) return prev;
          if (prev.messages.some((m) => m.id === msg.id)) return prev;
          const shouldIncUnread =
            isChatMinimizedRef.current && msg.senderPlayerId !== playerProfile.id;
          return {
            ...prev,
            messages: [...prev.messages, msg],
            unreadCount: shouldIncUnread ? prev.unreadCount + 1 : prev.unreadCount,
          };
        });
      },
      onConversationClosed: (conversationId, reason) => {
        setActiveConversation((prev) =>
          prev && prev.conversationId === conversationId ? null : prev
        );
        setSocialToast(reason);
        setTimeout(() => setSocialToast(null), 3500);
      },
    });

    mpSessionRef.current = session;
    void session.start();

    // Best-effort page-exit fallback only: browsers do not guarantee keepalive completion
    // on tab close/reload. Normal abandonment stays server-confirmed via MissionManager, and
    // server start_game_mission cleans up stale in_progress runs if exit delivery is dropped.
    const sendKeepaliveAbandonIfNeeded = () => {
      if (!isSupabaseConfigured) return;
      dispatchBestEffortPageExitAbandon({
        run: activeUnfinalizedRunRef.current,
        sentTokens: keepaliveAbandonSentRef.current,
        supabaseUrl,
        publishableKey: supabasePublishableKey,
        accessToken: accessTokenRef.current,
      });
    };

    const handlePageHide = () => {
      sendKeepaliveAbandonIfNeeded();
      if (
        isSupabaseConfigured &&
        accessTokenRef.current &&
        supabaseUrl &&
        supabasePublishableKey
      ) {
        fetch(`${supabaseUrl}/rest/v1/rpc/logout_player_presence`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: supabasePublishableKey,
            Authorization: `Bearer ${accessTokenRef.current}`,
          },
          body: '{}',
          keepalive: true,
        }).catch(() => {});
      }
    };

    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('beforeunload', handlePageHide);

    return () => {
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('beforeunload', handlePageHide);
      sendKeepaliveAbandonIfNeeded();
      session.stop();
      mpSessionRef.current = null;
    };
  }, [worldStage, playerProfile?.id]);

  // Keep profile updates synced inside running multiplayer session
  useEffect(() => {
    if (playerProfile && mpSessionRef.current) {
      mpSessionRef.current.updateProfile(playerProfile);
    }
  }, [playerProfile]);

  const handleAuthenticated = (profile: PlayerProfile, offsetMs: number) => {
    applyProfileToWorld(profile, offsetMs);
  };

  const handleBriefingAccepted = (updatedProfile: PlayerProfile, offsetMs: number) => {
    applyProfileToWorld(updatedProfile, offsetMs);
  };

  const handleConfigConfirmed = (updatedProfile: PlayerProfile, offsetMs: number) => {
    setIsConfigViewerOpen(false);
    applyProfileToWorld(updatedProfile, offsetMs);
  };

  const syncMissionUi = useCallback((session: ActiveMissionSession | null, force = false) => {
    if (session && missionManagerRef.current.hasUnfinalizedServerRun() && session.runToken) {
      activeUnfinalizedRunRef.current = {
        missionId: session.missionId,
        runToken: session.runToken,
      };
    } else {
      activeUnfinalizedRunRef.current = null;
    }

    if (!session) {
      if (lastMissionUiHashRef.current !== 'NONE') {
        lastMissionUiHashRef.current = 'NONE';
        setMissionSession(null);
      }
      return;
    }
    const hash = `${session.missionId}|${session.state}|${Math.ceil(
      session.timeRemainingSec
    )}|${session.cargoIntegrityPercent}|${Math.ceil(session.countdownVal)}|${
      session.currentCheckpointIdx
    }|${session.acknowledgedCheckpointIdx}|${session.pendingCheckpoint?.index ?? -1}:${
      session.pendingCheckpoint?.status ?? ''
    }:${session.pendingCheckpoint?.failureType ?? ''}:${session.pendingCheckpoint?.attempts ?? 0}|${
      session.insideDestAwaitingPark ? 1 : 0
    }|${session.currentRaceCheckpointIdx}|${session.playerRaceRank}|${
      session.resultSummary?.persisted ? 1 : 0
    }`;
    if (force || hash !== lastMissionUiHashRef.current) {
      lastMissionUiHashRef.current = hash;
      setMissionSession({ ...session });
    }
  }, []);

  const awaitAbandonActiveRunBeforeExit = useCallback(async (): Promise<boolean> => {
    const s = missionManagerRef.current.session;
    if (!s) return true;
    if (!missionManagerRef.current.hasUnfinalizedServerRun() || !s.runToken) {
      missionManagerRef.current.forceClearSession();
      setActiveDestination(null);
      syncMissionUi(null, true);
      return true;
    }

    const { missionId, runToken } = s;
    const { cleared } = missionManagerRef.current.abandonMission();
    syncMissionUi(missionManagerRef.current.session, true);
    if (cleared) {
      setActiveDestination(null);
      return true;
    }

    const res = await missionService.abandonMission(missionId, runToken);
    const nextSession = missionManagerRef.current.applyServerAbandonResult(
      missionId,
      runToken,
      res
    );
    if (!nextSession || nextSession.state === 'COMPLETED' || nextSession.state === 'FAILED') {
      keepaliveAbandonSentRef.current.add(runToken);
      setActiveDestination(null);
      syncMissionUi(nextSession, true);
      if (nextSession?.state === 'COMPLETED') {
        rewardedRunTokensRef.current.add(runToken);
        void fetchMyPlayerProfile().then((profRes) => {
          if (profRes.success && profRes.profile) {
            applyProfileToWorld(profRes.profile, profRes.serverClockOffsetMs || 0);
          }
        });
      }
      return true;
    }

    syncMissionUi(nextSession, true);
    setSocialToast(
      nextSession.resultSummary?.message ||
        res.message ||
        'Could not confirm mission abandonment with server. Tap Retry.'
    );
    setTimeout(() => setSocialToast(null), 4000);
    return false;
  }, [applyProfileToWorld, syncMissionUi]);

  const safeNavigateWithAbandon = useCallback(
    async (route: string) => {
      const ok = await awaitAbandonActiveRunBeforeExit();
      if (ok) {
        navigate(route);
      }
    },
    [awaitAbandonActiveRunBeforeExit, navigate]
  );

  const handleLogout = async () => {
    await awaitAbandonActiveRunBeforeExit();
    if (mpSessionRef.current) {
      mpSessionRef.current.stop();
      mpSessionRef.current = null;
    }
    missionManagerRef.current.forceClearSession();
    setActiveDestination(null);
    syncMissionUi(null, true);
    engineAudio.stop();
    await logoutPlayerAccount();
    lastAppliedPlayerIdRef.current = null;
    setPlayerProfile(null);
    setCustomization(DEFAULT_CUSTOMIZATION);
    setPlayerCredits(5000);
    setIsConfigViewerOpen(false);
    setActiveConversation(null);
    setIncomingInvite(null);
    setOutgoingInvite(null);
    setRemotePlayers([]);
    setProjectedPlayers([]);
  };

  useEffect(() => {
    missionManagerRef.current.setCheckpointCallback((missionId, cpIdx, x, z, runToken) => {
      if (!runToken) {
        const updated = missionManagerRef.current.applyCheckpointSyncResult(
          missionId,
          runToken,
          cpIdx,
          {
            recorded: false,
            rejected: true,
            networkError: false,
            message: 'Missing server run token for checkpoint.',
          }
        );
        syncMissionUi(updated, true);
        return;
      }

      syncMissionUi(missionManagerRef.current.session, true);
      void missionService
        .reportCheckpoint({
          missionId,
          runToken,
          checkpointIndex: cpIdx,
          x,
          z,
        })
        .then((res) => {
          const updated = missionManagerRef.current.applyCheckpointSyncResult(
            missionId,
            runToken,
            cpIdx,
            res
          );
          syncMissionUi(updated, true);
          if (!res.recorded && !res.alreadyRecorded) {
            if (res.expired || updated?.state === 'FAILED') {
              setActiveDestination(null);
              void loadMissionOverview();
              setSocialToast(res.message || 'Mission run ended on the server.');
              setTimeout(() => setSocialToast(null), 4000);
            } else if (res.rejected && !res.networkError) {
              setSocialToast(
                res.message ||
                  `Checkpoint ${cpIdx + 1} was rejected by the server. Re-drive the checkpoint or abandon.`
              );
              setTimeout(() => setSocialToast(null), 4500);
            } else {
              setSocialToast(
                res.message || `Checkpoint ${cpIdx + 1} could not sync with server. Tap Retry.`
              );
              setTimeout(() => setSocialToast(null), 4000);
            }
          }
        });
    });

    missionManagerRef.current.setAbandonCallback((missionId, runToken) => {
      syncMissionUi(missionManagerRef.current.session, true);
      void missionService.abandonMission(missionId, runToken).then((res) => {
        const nextSession = missionManagerRef.current.applyServerAbandonResult(
          missionId,
          runToken,
          res
        );
        if (!nextSession) {
          keepaliveAbandonSentRef.current.add(runToken);
          setActiveDestination(null);
        } else if (nextSession.state === 'COMPLETED') {
          keepaliveAbandonSentRef.current.add(runToken);
          rewardedRunTokensRef.current.add(runToken);
          setActiveDestination(null);
          void fetchMyPlayerProfile().then((profRes) => {
            if (profRes.success && profRes.profile) {
              applyProfileToWorld(profRes.profile, profRes.serverClockOffsetMs || 0);
            }
          });
          setSocialToast(
            nextSession.resultSummary?.message || 'Mission was already completed on the server.'
          );
          setTimeout(() => setSocialToast(null), 4000);
        } else if (nextSession.state === 'FAILED') {
          keepaliveAbandonSentRef.current.add(runToken);
          setActiveDestination(null);
          setSocialToast(
            nextSession.resultSummary?.message || 'Mission had already failed on the server.'
          );
          setTimeout(() => setSocialToast(null), 4000);
        } else {
          setSocialToast(
            nextSession.resultSummary?.message ||
              res.message ||
              'Unable to confirm mission abandonment with server. Tap Retry.'
          );
          setTimeout(() => setSocialToast(null), 4000);
        }
        syncMissionUi(nextSession, true);
        if (
          !nextSession ||
          nextSession.state === 'COMPLETED' ||
          nextSession.state === 'FAILED'
        ) {
          void loadMissionOverview();
        }
      });
    });

    missionManagerRef.current.setCompletionCallback(
      (missionId, success, _credits, _xp, reason, runToken, telemetry) => {
        if (!runToken) {
          if (success) {
            const updated = missionManagerRef.current.applyServerVerificationResult(
              missionId,
              runToken,
              {
                persisted: false,
                reason: 'Missing server run token; mission run cannot be recorded.',
              }
            );
            syncMissionUi(updated, true);
          }
          return;
        }

        if (!success) {
          syncMissionUi(missionManagerRef.current.session, true);
          void missionService
            .failMission({
              missionId,
              runToken,
              failureReason: reason,
            })
            .then((res) => {
              const settled = missionManagerRef.current.applyServerFailureResult(
                missionId,
                runToken,
                res
              );
              syncMissionUi(settled, true);
              if (!settled) {
                setActiveDestination(null);
                void loadMissionOverview();
              } else if (settled.state === 'COMPLETED') {
                // Reconciled as already completed on server: sync authoritative profile without double-crediting.
                rewardedRunTokensRef.current.add(runToken);
                setActiveDestination(null);
                void fetchMyPlayerProfile().then((profRes) => {
                  if (profRes.success && profRes.profile) {
                    applyProfileToWorld(profRes.profile, profRes.serverClockOffsetMs || 0);
                  }
                });
                void loadMissionOverview();
                setSocialToast(
                  settled.resultSummary?.message ||
                    'Mission was already completed and saved on the server.'
                );
                setTimeout(() => setSocialToast(null), 4000);
              } else if (settled.state === 'FAILED') {
                void loadMissionOverview();
              } else {
                setSocialToast(
                  settled.resultSummary?.message ||
                    res.message ||
                    'Unable to save mission failure with server. Tap Retry.'
                );
                setTimeout(() => setSocialToast(null), 4000);
              }
            });
          return;
        }

        // Immediately sync UI into VERIFYING state while server RPC runs
        syncMissionUi(missionManagerRef.current.session, true);

        void missionService
          .completeMission({
            missionId,
            runToken,
            finalX: telemetry?.finalX ?? 0,
            finalZ: telemetry?.finalZ ?? 0,
            gear: telemetry?.gear || 'D1',
            collisionCount: telemetry?.collisionCount ?? 0,
            finishRank: telemetry?.finishRank ?? null,
          })
          .then((res) => {
            const settled = missionManagerRef.current.applyServerVerificationResult(
              missionId,
              runToken,
              res
            );
            syncMissionUi(settled, true);

            if (res.persisted && !res.rejected) {
              if (!rewardedRunTokensRef.current.has(runToken)) {
                rewardedRunTokensRef.current.add(runToken);
                if (typeof res.creditsBalance === 'number') {
                  setPlayerCredits(res.creditsBalance);
                }
                setPlayerProfile((prev) => {
                  if (!prev) return prev;
                  const existingBadges = Array.isArray(prev.badges_earned)
                    ? prev.badges_earned
                    : [];
                  const nextBadges =
                    res.rewardBadge && !existingBadges.includes(res.rewardBadge)
                      ? [...existingBadges, res.rewardBadge]
                      : existingBadges;
                  return {
                    ...prev,
                    credits_balance:
                      typeof res.creditsBalance === 'number'
                        ? res.creditsBalance
                        : prev.credits_balance,
                    xp_balance:
                      typeof res.xpBalance === 'number' ? res.xpBalance : prev.xp_balance,
                    missions_completed_count: (prev.missions_completed_count ?? 0) + 1,
                    badges_earned: nextBadges,
                  };
                });
                const awarded = typeof res.creditsAwarded === 'number' ? res.creditsAwarded : 0;
                if (awarded > 0) {
                  setCreditNotification({ amount: awarded, reason });
                  setTimeout(() => setCreditNotification(null), 3500);
                }
              }
              void loadMissionOverview();
            } else {
              setSocialToast(
                res.reason || 'Mission run could not be accepted or persisted by the server.'
              );
              setTimeout(() => setSocialToast(null), 4000);
              if (res.persisted && res.rejected) {
                void loadMissionOverview();
              }
            }
          });
      }
    );
  }, [applyProfileToWorld, loadMissionOverview, syncMissionUi]);

  const handleOpenMissionBriefing = useCallback(
    (id: MissionId) => {
      const s = missionManagerRef.current.openBriefing(id, missionOverridesRef.current);
      syncMissionUi(s, true);
    },
    [syncMissionUi]
  );

  const handleStartMission = useCallback(async () => {
    const activeId = missionManagerRef.current.session?.missionId;
    if (!activeId) return;

    if (coastalRaceState) {
      setCoastalRaceCommand((prev) => ({ action: 'EXIT', seq: (prev?.seq ?? 0) + 1 }));
      setCoastalRaceState(null);
    }

    const startRes = await missionService.startMission(activeId);
    if (!startRes.success || !startRes.runToken) {
      setSocialToast(startRes.message || 'This mission is currently unavailable or on cooldown.');
      setTimeout(() => setSocialToast(null), 3800);
      return;
    }

    const s = missionManagerRef.current.startMission(
      startRes.runToken,
      startRes.timeLimitSeconds,
      missionOverridesRef.current
    );
    if (s) {
      const target = missionManagerRef.current.getActiveTarget(missionOverridesRef.current);
      if (target) {
        setActiveDestination({ x: target.x, z: target.z, name: target.name });
      } else {
        const def = missionManagerRef.current.getMissionDef(
          s.missionId,
          missionOverridesRef.current
        );
        setActiveDestination({ x: def.destX, z: def.destZ, name: def.destinationName });
      }
    }
    syncMissionUi(s, true);
  }, [syncMissionUi]);

  const handleAbandonMission = useCallback(() => {
    const { cleared } = missionManagerRef.current.abandonMission();
    if (cleared) {
      setActiveDestination(null);
    }
    syncMissionUi(missionManagerRef.current.session, true);
  }, [syncMissionUi]);

  const handleRetryCheckpointSync = useCallback(() => {
    const updated = missionManagerRef.current.retryPendingCheckpoint();
    syncMissionUi(updated, true);
  }, [syncMissionUi]);

  const handleRecoverPermanentCheckpoint = useCallback(() => {
    const updated = missionManagerRef.current.recoverPermanentCheckpoint();
    const target = missionManagerRef.current.getActiveTarget(missionOverridesRef.current);
    if (target) {
      setActiveDestination({ x: target.x, z: target.z, name: target.name });
    }
    syncMissionUi(updated, true);
  }, [syncMissionUi]);

  const handleRetryCompletion = useCallback(() => {
    const updated = missionManagerRef.current.retryCompletionSubmission();
    syncMissionUi(updated, true);
  }, [syncMissionUi]);

  const handleRetryFailureSync = useCallback(() => {
    const updated = missionManagerRef.current.retryFailureSubmission();
    syncMissionUi(updated, true);
  }, [syncMissionUi]);

  const handleRetryAbandonment = useCallback(() => {
    const { cleared } = missionManagerRef.current.retryAbandonment();
    if (cleared) {
      setActiveDestination(null);
    }
    syncMissionUi(missionManagerRef.current.session, true);
  }, [syncMissionUi]);

  const handleMissionUpdate = useCallback(
    (
      delta: number,
      playerPos: { x: number; z: number; speed: number; gear?: TransmissionGear },
      onCollisionImpact?: boolean
    ) => {
      const prevCpIdx = missionManagerRef.current.session?.currentCheckpointIdx ?? -1;
      const updated = missionManagerRef.current.update(
        delta,
        playerPos,
        onCollisionImpact,
        missionOverridesRef.current
      );
      if (
        updated &&
        updated.state === 'ACTIVE' &&
        updated.currentCheckpointIdx !== prevCpIdx
      ) {
        const nextTarget = missionManagerRef.current.getActiveTarget(missionOverridesRef.current);
        if (nextTarget) {
          setActiveDestination({ x: nextTarget.x, z: nextTarget.z, name: nextTarget.name });
        }
      }
      syncMissionUi(updated);
    },
    [syncMissionUi]
  );

  const handleRaceCheckpointPassed = useCallback(
    (cpIdx: number, rank: number, coords?: { x: number; z: number; gear?: TransmissionGear }) => {
      const updated = missionManagerRef.current.onPlayerReachRaceCheckpoint(
        cpIdx + 1,
        rank,
        missionOverridesRef.current,
        coords
      );
      syncMissionUi(updated, true);
    },
    [syncMissionUi]
  );

  const activeMissionTarget = useMemo(() => {
    if (
      !missionSession ||
      (missionSession.state !== 'ACTIVE' && missionSession.state !== 'COUNTDOWN')
    ) {
      return null;
    }
    const def = missionOverrides[missionSession.missionId]
      ? { ...MISSIONS_CATALOG[missionSession.missionId], ...missionOverrides[missionSession.missionId] }
      : MISSIONS_CATALOG[missionSession.missionId];
    if (!def || def.category === 'STREET_RACE') return null;

    if (missionSession.currentCheckpointIdx < def.checkpoints.length) {
      const cp = def.checkpoints[missionSession.currentCheckpointIdx];
      return {
        x: cp.x,
        z: cp.z,
        radius: cp.radius,
        name: cp.name,
        isFinalDestination: false,
      };
    }
    return {
      x: def.destX,
      z: def.destZ,
      radius: def.destRadius,
      name: def.destinationName,
      isFinalDestination: true,
    };
  }, [
    missionSession?.missionId,
    missionSession?.state,
    missionSession?.currentCheckpointIdx,
    missionOverrides,
  ]);

  const distToMissionTargetMeters = useMemo(() => {
    if (!activeMissionTarget) return 0;
    return Math.round(
      Math.hypot(carPosition.x - activeMissionTarget.x, carPosition.z - activeMissionTarget.z) *
        2.5
    );
  }, [carPosition.x, carPosition.z, activeMissionTarget]);

  const handleStartCoastalRace = useCallback(async () => {
    const canProceed = await awaitAbandonActiveRunBeforeExit();
    if (!canProceed) return;
    setActiveDestination(null);
    setIsCityMapOpen(false);
    setIsCustomizerOpen(false);
    setIsMissionDrawerOpen(false);
    setCoastalRaceCommand((prev) => ({ action: 'START', seq: (prev?.seq ?? 0) + 1 }));
  }, [awaitAbandonActiveRunBeforeExit]);

  const handleExitCoastalRace = useCallback(() => {
    setCoastalRaceCommand((prev) => ({ action: 'EXIT', seq: (prev?.seq ?? 0) + 1 }));
    setCoastalRaceState(null);
  }, []);

  const handleSpeedTrap = (recordedSpeed: number) => {
    setSpeedTrapRecord(recordedSpeed);
    setTimeout(() => {
      setSpeedTrapRecord(null);
    }, 4500);
  };

  const handleInspectShowroomCar = (carIdentifier: string) => {
    const matched =
      cars.find((c) => c.id === carIdentifier || c.slug === carIdentifier) || cars[0];
    if (matched) {
      setInspectingCar(matched);
    }
  };

  // Enforce 24-hour setting lock across all vehicle customization handlers
  const mergeWithLockEnforcement = (candidate: CarCustomization): CarCustomization => {
    if (!lockStatus.isLocked) return candidate;
    return {
      ...candidate,
      vehicleType: customization.vehicleType,
      paintColor: customization.paintColor,
      finish: customization.finish,
      interiorTheme: customization.interiorTheme,
      musicPreference: customization.musicPreference,
    };
  };

  const handleCustomizerChange = (updated: CarCustomization) => {
    setCustomization(mergeWithLockEnforcement(updated));
  };

  const handlePurchaseUpgrade = (cost: number, newCustom: CarCustomization) => {
    if (cost > 0) {
      if (playerCredits < cost) return;
      setPlayerCredits((prev) => prev - cost);
    }
    setCustomization(mergeWithLockEnforcement(newCustom));
  };

  const handleSelectVehicleType = (type: VehicleModelType) => {
    if (lockStatus.isLocked) return;
    setCustomization((prev) => ({
      ...prev,
      vehicleType: type,
    }));
  };

  const handleToggleEngine = () => {
    const newState = !isEngineRunning;
    setIsEngineRunning(newState);
    engineAudio.setEngineRunning(newState);
  };

  const handleCycleHeadlights = () => {
    setHeadlightState((prev) => (prev === 'OFF' ? 'LOW' : prev === 'LOW' ? 'HIGH' : 'OFF'));
  };

  const handleToggleTurnSignal = (signal: 'LEFT' | 'RIGHT') => {
    setTurnSignal((prev) => (prev === signal ? 'OFF' : signal));
  };

  const handleToggleHazard = () => {
    setHazardLights((prev) => !prev);
  };

  const handleRadioStation = (st: number) => {
    if (lockStatus.isLocked) return;
    setRadioStation(st);
    if (st > 0) {
      musicLibrary.pause();
    }
    engineAudio.setRadioStation(st);
  };

  const handleRadioVolume = (vol: number) => {
    setRadioVolume(vol);
    engineAudio.setRadioVolume(vol);
  };

  // Keyboard shortcut listener for cockpit systems (guarded against focused text inputs and pre-game stages)
  useEffect(() => {
    if (worldStage !== 'GAME') return;

    const handleKey = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target) || isEditableTarget(document.activeElement)) {
        return;
      }
      const k = e.key.toLowerCase();
      if (k === 'q' && e.type === 'keydown') {
        handleToggleTurnSignal('LEFT');
      } else if (k === 'h') {
        setHornActive(e.type === 'keydown');
      } else if (k === 'm' && e.type === 'keydown') {
        setIsCityMapOpen((prev) => !prev);
      }
    };

    const clearHornOnBlur = () => setHornActive(false);

    window.addEventListener('keydown', handleKey);
    window.addEventListener('keyup', handleKey);
    window.addEventListener('blur', clearHornOnBlur);
    return () => {
      window.removeEventListener('keydown', handleKey);
      window.removeEventListener('keyup', handleKey);
      window.removeEventListener('blur', clearHornOnBlur);
    };
  }, [worldStage]);

  const handleMotionSample = useCallback(
    (pos: { x: number; y?: number; z: number; heading: number; speed?: number }) => {
      mpSessionRef.current?.publishLocalMotion(pos);
    },
    []
  );

  const handleCarPositionUpdate = useCallback(
    (pos: { x: number; y?: number; z: number; heading: number; speed?: number }) => {
      setCarPosition(pos);
    },
    []
  );

  const handleProjectedPlayers = useCallback((projected: ProjectedRemotePlayer[]) => {
    setProjectedPlayers((prev) => {
      if (prev.length === 0 && projected.length === 0) return prev;
      return projected;
    });
  }, []);

  // Chat & Social callbacks
  const handleSendInvite = async (recipientPlayerId: string) => {
    if (!mpSessionRef.current) return { success: false, error: 'Multiplayer not active.' };
    return await mpSessionRef.current.sendChatInvitation(recipientPlayerId);
  };

  const handleCancelInvite = async (invitationId: string) => {
    if (!mpSessionRef.current) return;
    const res = await mpSessionRef.current.cancelChatInvitation(invitationId);
    if (!res.success && res.error) {
      setSocialToast(res.error);
      setTimeout(() => setSocialToast(null), 3200);
    }
  };

  const handleRespondInvite = async (invitationId: string, accept: boolean) => {
    if (!mpSessionRef.current) return;
    await mpSessionRef.current.respondToInvitation(invitationId, accept);
  };

  const handleSendMessage = async (conversationId: string, content: string) => {
    if (!mpSessionRef.current) return { delivered: false, error: 'Chat service offline.' };
    const res = await mpSessionRef.current.sendChatMessage(conversationId, content);
    if (res.delivered && res.messageRecord) {
      const newMsg = res.messageRecord;
      setActiveConversation((prev) => {
        if (!prev || prev.conversationId !== conversationId) return prev;
        if (prev.messages.some((m) => m.id === newMsg.id)) return prev;
        return {
          ...prev,
          messages: [...prev.messages, newMsg],
        };
      });
    } else if (res.moderationWarning?.restrictedUntil !== undefined) {
      // Sync authoritative chat_status & expiry from server DB
      void fetchMyPlayerProfile().then((profRes) => {
        if (profRes.success && profRes.profile) {
          applyProfileToWorld(profRes.profile, profRes.serverClockOffsetMs || 0);
        }
      });
    }
    return {
      delivered: res.delivered,
      moderationWarning: res.moderationWarning,
      error: res.error,
    };
  };

  const handlePeerBlocked = (blockedPlayerId: string) => {
    setRemotePlayers((prev) => prev.filter((p) => p.playerId !== blockedPlayerId));
    setProjectedPlayers((prev) => prev.filter((p) => p.playerId !== blockedPlayerId));
    setOutgoingInvite((prev) =>
      prev && prev.recipientPlayerId === blockedPlayerId ? null : prev
    );
    setActiveConversation((prev) => {
      if (prev && prev.peerPlayerId === blockedPlayerId) {
        mpSessionRef.current?.clearActiveConversation();
        return null;
      }
      return prev;
    });
    setSocialToast('Driver blocked. Interaction terminated.');
    setTimeout(() => setSocialToast(null), 3200);
  };

  return (
    <div
      className={`relative w-full h-[calc(100dvh-var(--header-height,76px))] min-h-[320px] mt-[var(--header-height,76px)] bg-[#071A2B] select-none ${
        worldStage === 'GAME' ? 'overflow-hidden' : 'overflow-y-auto'
      }`}
    >
      {/* Lightweight CSS gradient backdrop when pre-game mobile/performance mode skips heavy WebGL */}
      {!shouldRenderWorldCanvas && worldStage !== 'CONFIG' && (
        <div
          aria-hidden="true"
          className="fixed inset-0 top-[var(--header-height,76px)] bg-[radial-gradient(ellipse_at_top,_#123456_0%,_#071A2B_55%,_#030D17_100%)] pointer-events-none"
        />
      )}

      {/* 3D WebGL Canvas Layer (Full driving inside GAME; desktop aerial preview before onboarding) */}
      {shouldRenderWorldCanvas && (
        <WorldCanvas
          key={worldRetryKey}
          customization={customization}
          cameraMode={cameraMode}
          timeOfDay={timeOfDay}
          qualityMode={qualityMode}
          isCityMapOpen={isCityMapOpen}
          presentationMode={worldStage !== 'GAME'}
          remotePlayers={worldStage === 'GAME' ? remotePlayers : []}
          onProjectedRemotePlayers={worldStage === 'GAME' ? handleProjectedPlayers : undefined}
          onZoneChange={(zone) => setActiveZone(zone)}
          onSpeedChange={(speed, revs, g) => {
            setSpeedKmh(speed);
            setRpm(revs);
            setGear(g);
          }}
          onSpeedTrapTrigger={handleSpeedTrap}
          onInspectCar={handleInspectShowroomCar}
          onEnterMarketplace={() => setIsMarketplaceModalOpen(true)}
          onOpenCustomizer={() => setIsCustomizerOpen(true)}
          onOpenDealerLounge={() => setIsDealerLoungeOpen(true)}
          onCarPositionUpdate={handleCarPositionUpdate}
          onMotionSample={handleMotionSample}
          onInitStageChange={setInitStage}
          onContextLost={setWebglContextLost}
          isCustomizerOpen={isCustomizerOpen}
          virtualInput={virtualInputState}
          isEngineRunning={isEngineRunning}
          driveMode={driveMode}
          selectedGear={selectedGear}
          onSelectGear={setSelectedGear}
          headlightState={headlightState}
          turnSignal={turnSignal}
          hazardLights={hazardLights}
          hornActive={hornActive}
          onAwardCredits={handleAwardCredits}
          activeDestination={activeDestination}
          activeMissionTarget={activeMissionTarget}
          activeMissionSession={missionSession}
          onMissionUpdate={handleMissionUpdate}
          onRaceCheckpointPassed={handleRaceCheckpointPassed}
          onTrafficPositionsUpdate={setTrafficPositions}
          onRivalPositionsUpdate={setRivalPositions}
          resetVehicleTrigger={resetVehicleTrigger}
          coastalRaceCommand={coastalRaceCommand}
          onCoastalRaceUpdate={setCoastalRaceState}
          onStartCoastalRace={() => void handleStartCoastalRace()}
        />
      )}

      {/* Staged 3D Engine Loader / WebGL Context Recovery inside GAME */}
      {worldStage === 'GAME' && (initStage.progress < 100 || webglContextLost) && (
        <div className="absolute inset-0 z-40 bg-[#04101B]/95 flex flex-col items-center justify-center p-5 text-center">
          <div className="w-full max-w-sm bg-[#071A2B] border border-white/15 rounded-2xl p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-center gap-2.5">
              <Loader2 className="w-6 h-6 text-[#EF233C] animate-spin shrink-0" />
              <h2 className="text-sm font-black uppercase tracking-wider text-white">
                {webglContextLost
                  ? '3D Graphics Interrupted'
                  : initStalled
                  ? 'World Taking Longer Than Usual'
                  : 'Loading Lagos Open World'}
              </h2>
            </div>

            <div className="space-y-1.5">
              <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full bg-[#EF233C] transition-all duration-300"
                  style={{ width: `${Math.max(10, Math.min(100, initStage.progress))}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] font-bold text-gray-300">
                <span>{webglContextLost ? 'GPU context paused by device.' : initStage.step}</span>
                <span>{Math.round(initStage.progress)}%</span>
              </div>
            </div>

            {(initStalled || webglContextLost) && (
              <div className="flex flex-col sm:flex-row gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    handleQualityModeChange('PERFORMANCE');
                    setWebglContextLost(false);
                    setInitStalled(false);
                    setInitStage({ step: 'Switching to Smooth Mode...', progress: 15 });
                    setWorldRetryKey((k) => k + 1);
                  }}
                  className="flex-1 min-h-[44px] px-3 py-2 rounded-xl bg-[#EF233C] hover:bg-red-700 text-white text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Smooth Mode & Retry</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setWebglContextLost(false);
                    setInitStalled(false);
                    setInitStage({ step: 'Reconnecting 3D world...', progress: 15 });
                    setWorldRetryKey((k) => k + 1);
                  }}
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold cursor-pointer"
                >
                  Retry
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* STAGE 0: INITIAL SESSION CHECK */}
      {worldStage === 'CHECKING' && (
        <div className="absolute inset-0 z-40 bg-[#04101B]/90 flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 text-[#EF233C] animate-spin" />
          <p className="text-xs font-black uppercase tracking-widest text-white">
            Connecting to MANIFOLD World...
          </p>
        </div>
      )}

      {/* STAGE 1: AUTH GATE */}
      {worldStage === 'AUTH' && (
        <WorldGateAuth
          dbStatus={dbStatus}
          onAuthenticated={handleAuthenticated}
          onNavigateMarketplace={() => navigate('/car-marketplace')}
        />
      )}

      {/* SUSPENDED ACCOUNT NOTICE */}
      {worldStage === 'SUSPENDED' && (
        <div className="absolute inset-0 z-40 bg-[#04101B]/92 flex items-center justify-center p-4 overflow-y-auto">
          <div className="max-w-md w-full bg-[#071A2B]/95 border border-red-500/40 rounded-3xl p-6 text-center space-y-4 shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-red-500/20 text-red-400 flex items-center justify-center mx-auto">
              <Ban className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-black text-white uppercase tracking-wider">
              Account Suspended
            </h2>
            <p className="text-xs text-gray-300 leading-relaxed">
              Access to MANIFOLD CARS 3D has been suspended due to community safety policy
              violations. Marketplace browsing remains accessible outside the game.
            </p>
            {playerProfile?.suspended_reason && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/25 text-[11px] text-red-200">
                <strong className="font-bold block text-red-300 mb-0.5">Reason:</strong>
                <span>{playerProfile.suspended_reason}</span>
              </div>
            )}
            <div className="flex gap-2.5 pt-2">
              <button
                onClick={() => navigate('/car-marketplace')}
                className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition cursor-pointer"
              >
                Marketplace
              </button>
              <button
                onClick={() => void handleLogout()}
                className="flex-1 py-2.5 rounded-xl bg-[#EF233C] hover:bg-red-700 text-white text-xs font-black transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STAGE 2: MANDATORY GAME BRIEFING & TERMS */}
      {worldStage === 'BRIEFING' && playerProfile && (
        <WorldBriefingPortal
          profile={playerProfile}
          onAccepted={handleBriefingAccepted}
          onLogout={() => void handleLogout()}
        />
      )}

      {/* STAGE 3: INTERACTIVE 3D VEHICLE CONFIGURATION & 24H LOCK PORTAL */}
      {worldStage === 'CONFIG' && playerProfile && (
        <VehicleConfigPortal
          profile={playerProfile}
          serverClockOffsetMs={serverClockOffsetMs}
          onConfirmed={handleConfigConfirmed}
          onCancelToGame={
            playerProfile.onboarding_status === 'active'
              ? () => setIsConfigViewerOpen(false)
              : undefined
          }
          onLogout={() => void handleLogout()}
        />
      )}

      {/* STAGE 4: ACTIVE GAMEPLAY WORLD, SOCIAL MULTIPLAYER & SLEEK CONSOLIDATED HUD */}
      {worldStage === 'GAME' && playerProfile && (
        <>
          <WorldSocialOverlay
            myPlayerId={playerProfile.id}
            remotePlayers={remotePlayers}
            projectedPlayers={projectedPlayers}
            incomingInvite={incomingInvite}
            outgoingInvite={outgoingInvite}
            activeConversation={activeConversation}
            isChatMinimized={isChatMinimized}
            onToggleMinimizeChat={() => {
              setIsChatMinimized((prev) => {
                const next = !prev;
                if (!next) {
                  setActiveConversation((c) => (c ? { ...c, unreadCount: 0 } : c));
                }
                return next;
              });
            }}
            onCloseChat={() => {
              mpSessionRef.current?.clearActiveConversation();
              setActiveConversation(null);
            }}
            onSendInvite={handleSendInvite}
            onCancelInvite={handleCancelInvite}
            onRespondInvite={handleRespondInvite}
            onSendMessage={handleSendMessage}
            onPeerBlocked={handlePeerBlocked}
            isNearbyPanelOpen={isNearbyPanelOpen}
            onCloseNearbyPanel={() => setIsNearbyPanelOpen(false)}
            isBlockedPanelOpen={isBlockedPanelOpen}
            onCloseBlockedPanel={() => setIsBlockedPanelOpen(false)}
            chatRestriction={{
              ...isPlayerChatRestricted(playerProfile, serverClockOffsetMs),
              reason: playerProfile.chat_restriction_reason,
            }}
          />

          {socialToast && (
            <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-[#071A2B]/95 border border-white/15 px-4 py-2 rounded-xl text-xs font-bold text-white shadow-2xl pointer-events-none">
              {socialToast}
            </div>
          )}

          <WorldHUD
            speedKmh={speedKmh}
            rpm={rpm}
            gear={gear}
            activeZone={activeZone}
            cameraMode={cameraMode}
            onCameraChange={(mode) => setCameraMode(mode)}
            timeOfDay={timeOfDay}
            onTimeOfDayChange={(time) => setTimeOfDay(time)}
            selectedVehicleType={customization.vehicleType || 'SPORTS_COUPE'}
            onSelectVehicleType={handleSelectVehicleType}
            onOpenCustomizer={() => setIsCustomizerOpen(true)}
            onEnterMarketplace={() => setIsMarketplaceModalOpen(true)}
            onInspectCar={handleInspectShowroomCar}
            onOpenDealerLounge={() => setIsDealerLoungeOpen(true)}
            carPosition={carPosition}
            speedTrapRecord={speedTrapRecord}
            onVirtualInput={handleVirtualInput}
            virtualInputState={virtualInputState}
            playerCredits={playerCredits}
            creditNotification={creditNotification}
            isEngineRunning={isEngineRunning}
            onToggleEngine={handleToggleEngine}
            driveMode={driveMode}
            onSelectDriveMode={(mode) => setDriveMode(mode)}
            selectedGear={selectedGear}
            onSelectGear={setSelectedGear}
            headlightState={headlightState}
            onCycleHeadlights={handleCycleHeadlights}
            turnSignal={turnSignal}
            onToggleTurnSignal={handleToggleTurnSignal}
            hazardLights={hazardLights}
            onToggleHazard={handleToggleHazard}
            hornActive={hornActive}
            onHornDown={() => setHornActive(true)}
            onHornUp={() => setHornActive(false)}
            radioStation={radioStation}
            onSelectRadioStation={handleRadioStation}
            radioVolume={radioVolume}
            onRadioVolumeChange={handleRadioVolume}
            onOpenCityMap={() => setIsCityMapOpen(true)}
            onOpenMissions={() => setIsMissionDrawerOpen(true)}
            onOpenMusicLibrary={() => setIsMusicLibraryOpen(true)}
            isMusicPlaying={isMusicPlaying}
            onResetVehicle={() => setResetVehicleTrigger((prev) => prev + 1)}
            activeDestination={activeDestination}
            onClearDestination={() => setActiveDestination(null)}
            billboardItems={billboardItems}
            onOpenBillboardListing={(slug) => {
              void safeNavigateWithAbandon(`/cars/${slug}`);
            }}
            playerNickname={playerProfile.nickname}
            nearbyPlayersCount={remotePlayers.length}
            lockStatus={{
              isLocked: lockStatus.isLocked,
              hhmmss: lockStatus.hhmmss,
              unlockFormatted: lockStatus.unlockFormatted,
            }}
            onOpenNearbyDrivers={() => setIsNearbyPanelOpen(true)}
            onOpenVehicleConfig={() => setIsConfigViewerOpen(true)}
            onOpenBlockedDrivers={() => setIsBlockedPanelOpen(true)}
            onOpenShowroomSample={() => handleInspectShowroomCar('car-highlander-2021')}
            onLogout={() => void handleLogout()}
            qualityMode={qualityMode}
            onQualityModeChange={handleQualityModeChange}
            coastalRaceState={coastalRaceState}
            onStartCoastalRace={() => void handleStartCoastalRace()}
            onExitCoastalRace={handleExitCoastalRace}
          />

          <MissionHUDOverlay
            session={missionSession}
            missionOverrides={missionOverrides}
            missionProgress={missionProgress}
            serverClockOffsetMs={serverMissionOffsetMs}
            selectedGear={selectedGear}
            onStartMission={() => void handleStartMission()}
            onAbandonMission={handleAbandonMission}
            onRetryCheckpointSync={handleRetryCheckpointSync}
            onRecoverPermanentCheckpoint={handleRecoverPermanentCheckpoint}
            onRetryCompletion={handleRetryCompletion}
            onRetryFailureSync={handleRetryFailureSync}
            onRetryAbandonment={handleRetryAbandonment}
            onOpenMissionBriefing={handleOpenMissionBriefing}
            isMissionDrawerOpen={isMissionDrawerOpen}
            onCloseMissionDrawer={() => setIsMissionDrawerOpen(false)}
            distToDestMeters={distToMissionTargetMeters}
            activeTargetName={activeMissionTarget?.name}
          />

          <MusicLibraryModal
            isOpen={isMusicLibraryOpen}
            onClose={() => setIsMusicLibraryOpen(false)}
          />

          <CustomizerDrawer
            isOpen={isCustomizerOpen}
            onClose={() => setIsCustomizerOpen(false)}
            customization={customization}
            onChange={handleCustomizerChange}
            playerCredits={playerCredits}
            onPurchaseUpgrade={handlePurchaseUpgrade}
            onViewMarketplaceCar={(carId) => {
              setIsCustomizerOpen(false);
              handleInspectShowroomCar(carId);
            }}
            lockStatus={{
              isLocked: lockStatus.isLocked,
              hhmmss: lockStatus.hhmmss,
              unlockFormatted: lockStatus.unlockFormatted,
            }}
          />

          <MarketplaceGatewayModal
            isOpen={isMarketplaceModalOpen}
            onClose={() => setIsMarketplaceModalOpen(false)}
            onNavigateToMarketplace={() => {
              setIsMarketplaceModalOpen(false);
              void safeNavigateWithAbandon('/car-marketplace');
            }}
            onSelectCar={onSelectCar}
            cars={cars}
          />

          <VehicleInspectorModal
            isOpen={Boolean(inspectingCar)}
            onClose={() => setInspectingCar(null)}
            car={inspectingCar}
            onViewDetails={(c) => {
              setInspectingCar(null);
              onSelectCar(c);
            }}
            onPlayVideo={onPlayVideo}
            onInterested={onInterested}
          />

          <DealerLoungeModal
            isOpen={isDealerLoungeOpen}
            onClose={() => setIsDealerLoungeOpen(false)}
            onNavigate={(route) => {
              void safeNavigateWithAbandon(route);
            }}
          />

          <CityMapModal
            isOpen={isCityMapOpen}
            onClose={() => setIsCityMapOpen(false)}
            playerPos={carPosition}
            activeDestination={activeDestination}
            onSelectDestination={(dest) => {
              setActiveDestination(dest);
              setIsCityMapOpen(false);
            }}
            onClearDestination={() => setActiveDestination(null)}
            trafficPositions={trafficPositions}
            rivalPositions={rivalPositions}
          />
        </>
      )}
    </div>
  );
};
