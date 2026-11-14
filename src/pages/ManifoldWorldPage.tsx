import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  WorldCanvas,
  CameraViewMode,
  TimeOfDay,
  type ProjectedRemotePlayer,
} from '../components/world/WorldCanvas';
import { WorldHUD } from '../components/world/WorldHUD';
import { CustomizerDrawer } from '../components/world/CustomizerDrawer';
import { MarketplaceGatewayModal } from '../components/world/MarketplaceGatewayModal';
import { VehicleInspectorModal } from '../components/world/VehicleInspectorModal';
import { DealerLoungeModal } from '../components/world/DealerLoungeModal';
import { CityMapModal } from '../components/world/CityMapModal';
import { MissionHUDOverlay } from '../components/world/MissionHUDOverlay';
import { WorldGateAuth } from '../components/world/WorldGateAuth';
import { WorldBriefingPortal } from '../components/world/WorldBriefingPortal';
import { VehicleConfigPortal } from '../components/world/VehicleConfigPortal';
import { WorldSocialOverlay } from '../components/world/WorldSocialOverlay';
import {
  MissionManager,
  ActiveMissionSession,
  MissionId,
  MISSIONS_CATALOG,
} from '../components/world/missionEngine';
import {
  CarCustomization,
  VehicleModelType,
  type MusicPreference,
} from '../components/world/worldModels';
import {
  HeadlightState,
  TurnSignalState,
  CockpitHotspot,
} from '../components/world/CockpitDashboardOverlay';
import { AudioDriveMode, engineAudio } from '../utils/engineAudio';
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
  type RemotePlayerPeer,
} from '../services/worldMultiplayerService';
import { Ban, Loader2, LogOut } from 'lucide-react';

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

  // Virtual Economy (MANIFOLD Credits)
  const [playerCredits, setPlayerCredits] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('manifold_player_credits');
      return saved ? parseInt(saved, 10) : 5000;
    } catch {
      return 5000;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('manifold_player_credits', playerCredits.toString());
    } catch {}
  }, [playerCredits]);

  const [creditNotification, setCreditNotification] = useState<{
    amount: number;
    reason: string;
  } | null>(null);

  const handleAwardCredits = (amount: number, reason: string) => {
    setPlayerCredits((prev) => prev + amount);
    setCreditNotification({ amount, reason });
    setTimeout(() => {
      setCreditNotification(null);
    }, 3500);
  };

  // World & Camera State (Default: DAYLIGHT and CHASE)
  const [cameraMode, setCameraMode] = useState<CameraViewMode>('CHASE');
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>('DAYLIGHT');
  const [activeZone, setActiveZone] = useState<string | null>(null);

  // Cockpit & Vehicle Systems State
  const [isEngineRunning, setIsEngineRunning] = useState<boolean>(true);
  const [driveMode, setDriveMode] = useState<AudioDriveMode>('SPORT');
  const [headlightState, setHeadlightState] = useState<HeadlightState>('LOW');
  const [turnSignal, setTurnSignal] = useState<TurnSignalState>('OFF');
  const [hazardLights, setHazardLights] = useState<boolean>(false);
  const [hornActive, setHornActive] = useState<boolean>(false);
  const [radioStation, setRadioStation] = useState<number>(1);
  const [radioVolume, setRadioVolume] = useState<number>(0.7);
  const [cockpitHotspot, setCockpitHotspot] = useState<CockpitHotspot>('DRIVER');

  // Vehicle Telemetry
  const [speedKmh, setSpeedKmh] = useState<number>(0);
  const [rpm, setRpm] = useState<number>(850);
  const [gear, setGear] = useState<string>('P');
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
  const [virtualInputState, setVirtualInputState] = useState({
    forward: false,
    backward: false,
    left: false,
    right: false,
    handbrake: false,
  });

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
  const missionManagerRef = useRef<MissionManager>(new MissionManager());
  const lastMissionUiHashRef = useRef<string>('');

  const applyProfileToWorld = useCallback((profile: PlayerProfile, offsetMs: number) => {
    const isAccountSwitch = lastAppliedPlayerIdRef.current !== profile.id;
    lastAppliedPlayerIdRef.current = profile.id;
    setPlayerProfile(profile);
    setServerClockOffsetMs(offsetMs);

    const musicPref = profile.selected_music_preference || 'AFROBEATS';
    const station = MUSIC_TO_STATION[musicPref] ?? 1;

    setCustomization((prev) => ({
      ...(isAccountSwitch ? DEFAULT_CUSTOMIZATION : prev),
      vehicleType: profile.selected_vehicle || DEFAULT_CUSTOMIZATION.vehicleType || 'SPORTS_COUPE',
      paintColor: profile.selected_vehicle_color || DEFAULT_CUSTOMIZATION.paintColor || '#DC2626',
      interiorTheme: profile.selected_interior || DEFAULT_CUSTOMIZATION.interiorTheme || 'BLACK',
      musicPreference: musicPref,
    }));

    setRadioStation(station);
    engineAudio.setMusicPreference(musicPref);

    if (isAccountSwitch && typeof profile.credits_balance === 'number') {
      setPlayerCredits(profile.credits_balance);
    } else if (typeof profile.credits_balance === 'number' && profile.credits_balance > 0) {
      setPlayerCredits((prev) => Math.max(prev, profile.credits_balance));
    }
  }, []);

  // Bootstrap World DB status + existing authenticated session
  useEffect(() => {
    let mounted = true;
    const bootstrap = async () => {
      const status = await checkWorldDbStatus();
      if (!mounted) return;
      setDbStatus(status);

      if (isSupabaseConfigured && !status.migrationRequired) {
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

  // Stop audio if returning to Auth/Briefing screens
  useEffect(() => {
    if (worldStage !== 'GAME') {
      engineAudio.stop();
    }
  }, [worldStage]);

  // Multiplayer Session Lifecycle (runs strictly when player is active inside GAME)
  useEffect(() => {
    if (worldStage !== 'GAME' || !playerProfile) {
      if (mpSessionRef.current) {
        mpSessionRef.current.stop();
        mpSessionRef.current = null;
      }
      return;
    }

    const session = new WorldMultiplayerSession(playerProfile, {
      onPeersChange: (peers) => setRemotePlayers(peers),
      onIncomingInvite: (inv) => setIncomingInvite(inv),
      onConversationOpen: (conv) => {
        setActiveConversation(conv);
        setIsChatMinimized(false);
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

    const handlePageHide = () => {
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

  const handleLogout = async () => {
    if (mpSessionRef.current) {
      mpSessionRef.current.stop();
      mpSessionRef.current = null;
    }
    engineAudio.stop();
    await logoutPlayerAccount();
    lastAppliedPlayerIdRef.current = null;
    setPlayerProfile(null);
    setCustomization(DEFAULT_CUSTOMIZATION);
    setPlayerCredits(5000);
    setIsConfigViewerOpen(false);
    setActiveConversation(null);
    setIncomingInvite(null);
    setRemotePlayers([]);
    setProjectedPlayers([]);
  };

  useEffect(() => {
    missionManagerRef.current.setRewardCallback(handleAwardCredits);
  });

  const syncMissionUi = useCallback((session: ActiveMissionSession | null, force = false) => {
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
      session.currentRaceCheckpointIdx
    }|${session.playerRaceRank}`;
    if (force || hash !== lastMissionUiHashRef.current) {
      lastMissionUiHashRef.current = hash;
      setMissionSession({ ...session });
    }
  }, []);

  const handleOpenMissionBriefing = useCallback(
    (id: MissionId) => {
      const s = missionManagerRef.current.openBriefing(id);
      syncMissionUi(s, true);
    },
    [syncMissionUi]
  );

  const handleStartMission = useCallback(() => {
    const s = missionManagerRef.current.startMission();
    if (s) {
      const def = MISSIONS_CATALOG[s.missionId];
      setActiveDestination({ x: def.destX, z: def.destZ, name: def.destinationName });
    }
    syncMissionUi(s, true);
  }, [syncMissionUi]);

  const handleAbandonMission = useCallback(() => {
    missionManagerRef.current.abandonMission();
    setActiveDestination(null);
    syncMissionUi(null, true);
  }, [syncMissionUi]);

  const handleMissionUpdate = useCallback(
    (
      delta: number,
      playerPos: { x: number; z: number; speed: number },
      onCollisionImpact?: boolean
    ) => {
      const updated = missionManagerRef.current.update(delta, playerPos, onCollisionImpact);
      syncMissionUi(updated);
    },
    [syncMissionUi]
  );

  const handleRaceCheckpointPassed = useCallback(
    (cpIdx: number, rank: number) => {
      const updated = missionManagerRef.current.onPlayerReachRaceCheckpoint(cpIdx + 1, rank);
      syncMissionUi(updated, true);
    },
    [syncMissionUi]
  );

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

  const handleCarPositionUpdate = useCallback(
    (pos: { x: number; y?: number; z: number; heading: number; speed?: number }) => {
      setCarPosition(pos);
      if (mpSessionRef.current) {
        mpSessionRef.current.publishLocalMotion(pos);
      }
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
    <div className="relative w-full h-[calc(100vh-76px)] mt-[76px] bg-[#071A2B] overflow-hidden select-none">
      {/* 3D WebGL Canvas Layer (Aerial presentation mode before onboarding completes; full driving inside GAME) */}
      {worldStage !== 'CONFIG' && (
        <WorldCanvas
          customization={customization}
          cameraMode={worldStage === 'GAME' ? cameraMode : 'ORBIT'}
          timeOfDay={timeOfDay}
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
          isCustomizerOpen={isCustomizerOpen}
          virtualInput={virtualInputState}
          isEngineRunning={isEngineRunning}
          driveMode={driveMode}
          headlightState={headlightState}
          turnSignal={turnSignal}
          hazardLights={hazardLights}
          hornActive={hornActive}
          cockpitHotspot={cockpitHotspot}
          onAwardCredits={handleAwardCredits}
          activeDestination={activeDestination}
          activeMissionSession={missionSession}
          onMissionUpdate={handleMissionUpdate}
          onRaceCheckpointPassed={handleRaceCheckpointPassed}
          onTrafficPositionsUpdate={setTrafficPositions}
          onRivalPositionsUpdate={setRivalPositions}
          resetVehicleTrigger={resetVehicleTrigger}
        />
      )}

      {/* STAGE 0: INITIAL SESSION CHECK */}
      {worldStage === 'CHECKING' && (
        <div className="absolute inset-0 z-40 bg-[#04101B]/80 backdrop-blur-md flex flex-col items-center justify-center gap-3">
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
        <div className="absolute inset-0 z-40 bg-[#04101B]/85 backdrop-blur-xl flex items-center justify-center p-4">
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
            onVirtualInput={(input) => setVirtualInputState(input)}
            virtualInputState={virtualInputState}
            playerCredits={playerCredits}
            creditNotification={creditNotification}
            isEngineRunning={isEngineRunning}
            onToggleEngine={handleToggleEngine}
            driveMode={driveMode}
            onSelectDriveMode={(mode) => setDriveMode(mode)}
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
            cockpitHotspot={cockpitHotspot}
            onSelectHotspot={(spot) => setCockpitHotspot(spot)}
            onOpenCityMap={() => setIsCityMapOpen(true)}
            onOpenMissions={() => setIsMissionDrawerOpen(true)}
            onResetVehicle={() => setResetVehicleTrigger((prev) => prev + 1)}
            activeDestination={activeDestination}
            onClearDestination={() => setActiveDestination(null)}
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
          />

          <MissionHUDOverlay
            session={missionSession}
            onStartMission={handleStartMission}
            onAbandonMission={handleAbandonMission}
            onOpenMissionBriefing={handleOpenMissionBriefing}
            isMissionDrawerOpen={isMissionDrawerOpen}
            onCloseMissionDrawer={() => setIsMissionDrawerOpen(false)}
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
              navigate('/car-marketplace');
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
            onNavigate={navigate}
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
